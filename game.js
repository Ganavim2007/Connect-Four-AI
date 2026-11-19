(function () {
  "use strict";

  const ROWS = 6, COLS = 7;
  const P1 = 1, P2 = 2, EMPTY = 0;
  const Engine = ConnectFourEngine;

  const boardEl  = document.getElementById("board");
  const colsEl   = document.getElementById("cols");
  const statusEl = document.getElementById("status");
  const undoBtn  = document.getElementById("undo-btn");
  const resetBtn = document.getElementById("reset-btn");
  const chipsEl  = document.getElementById("chips");
  const modeSel  = document.getElementById("mode");

  const DEPTHS = { easy: 2, medium: 4, hard: 6 };
  const store = Gamekit.storage("connect-four:");

  let diff = store.get("diff", "medium");
  if (!DEPTHS[diff]) diff = "medium";
  let mode = store.get("mode", "ai-first-p1");
  if (!["ai-first-p1", "ai-first-p2", "local"].includes(mode)) mode = "ai-first-p1";
  modeSel.value = mode;

  let grid = newGrid();       // 6×7, grid[r][c]
  let history = [];           // stack of {col, row, player}
  let current = P1;
  let gameOver = false;
  let winLine = null;         // [{r,c},...]
  let thinking = false;
  let humanIs = P1;           // set per mode

  function newGrid() {
    return Engine.createGrid();
  }

  function renderShell() {
    colsEl.innerHTML = "";
    for (let c = 0; c < COLS; c++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "c4-col-btn";
      btn.textContent = "↓";
      btn.setAttribute("aria-label", "Drop in column " + (c + 1));
      btn.dataset.col = String(c);
      btn.addEventListener("click", () => onColClick(c));
      colsEl.appendChild(btn);
    }
    boardEl.innerHTML = "";
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement("div");
        cell.className = "c4-slot";
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        boardEl.appendChild(cell);
      }
    }
  }

  function renderBoard() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        const el = boardEl.children[i];
        el.classList.remove("p1", "p2", "win");
        if (grid[r][c] === P1) el.classList.add("p1");
        else if (grid[r][c] === P2) el.classList.add("p2");
      }
    }
    if (winLine) {
      winLine.forEach(({ r, c }) => {
        boardEl.children[r * COLS + c].classList.add("win");
      });
    }
    // Disable full columns
    for (let c = 0; c < COLS; c++) {
      const btn = colsEl.children[c];
      btn.disabled = gameOver || thinking || grid[0][c] !== EMPTY;
    }
  }

  function dropRow(g, c) {
    return Engine.dropRow(g, c);
  }

  function makeMove(c, p) {
    const r = dropRow(grid, c);
    if (r < 0) return false;
    grid[r][c] = p;
    history.push({ r, c, p });
    return true;
  }

  function undoMove() {
    const m = history.pop();
    if (!m) return false;
    grid[m.r][m.c] = EMPTY;
    return true;
  }

  function onColClick(c) {
    if (gameOver || thinking || mode !== "local" && current !== humanIs) return;
    if (!playMove(c)) return;
    advance();
  }

  function playMove(c) {
    if (dropRow(grid, c) < 0) return false;
    const ok = makeMove(c, current);
    if (!ok) return false;
    const last = history[history.length - 1];
    const win = Engine.winAt(grid, last.r, last.c, last.p);
    if (win) {
      winLine = win;
      gameOver = true;
      const who = (mode === "local")
        ? (last.p === P1 ? "Amber" : "Mint") + " wins."
        : (last.p === humanIs ? "You win." : "AI wins.");
      statusEl.innerHTML = '<span class="ok">' + who + '</span>';
    } else if (Engine.isFull(grid)) {
      gameOver = true;
      statusEl.textContent = "Draw.";
    } else {
      current = current === P1 ? P2 : P1;
      updateTurnStatus();
    }
    renderBoard();
    return true;
  }

  function updateTurnStatus() {
    if (gameOver) return;
    if (mode === "local") {
      statusEl.textContent = (current === P1 ? "Amber" : "Mint") + " to move.";
    } else if (current === humanIs) {
      statusEl.textContent = "Your turn · drop a checker.";
    } else {
      statusEl.textContent = "AI thinking…";
    }
  }

  let aiTimer = null;
  let aiWorker = null;
  let searchId = 0;
  function cancelAI() {
    searchId++;
    if (aiTimer !== null) { clearTimeout(aiTimer); aiTimer = null; }
    if (aiWorker) { aiWorker.terminate(); aiWorker = null; }
    thinking = false;
  }

  function finishSearch(id) {
    if (id !== searchId) return false;
    if (aiWorker) { aiWorker.terminate(); aiWorker = null; }
    thinking = false;
    renderBoard();
    return true;
  }

  function advance() {
    if (gameOver) return;
    if (mode === "local") return;
    if (current !== humanIs) {
      thinking = true;
      renderBoard();
      const gen = aiTimer = setTimeout(() => {
        if (aiTimer !== gen) return;
        aiTimer = null;
        if (gameOver || mode === "local" || current === humanIs) { thinking = false; renderBoard(); return; }
        const id = ++searchId;
        const player = current;
        const board = grid.map((row) => Array.from(row));
        try {
          aiWorker = new Worker("./connect-four-worker.js");
          aiWorker.onmessage = (event) => {
            const result = event.data;
            if (!result || result.id !== id || id !== searchId) return;
            if (!finishSearch(id)) return;
            if (result.error) {
              statusEl.textContent = "AI search failed. Reset the game to try again.";
              return;
            }
            let col = result.move;
            if (!Number.isInteger(col) || dropRow(grid, col) < 0) {
              for (let c = 0; c < COLS; c++) if (dropRow(grid, c) >= 0) { col = c; break; }
            }
            if (col >= 0 && !gameOver && mode !== "local" && current === player && current !== humanIs) {
              // Keep the completed search details available for diagnostics without changing the UI.
              console.debug("Connect Four AI search", { score: result.score, depth: result.depth, stats: result.stats });
              playMove(col);
            }
          };
          aiWorker.onerror = (event) => {
            event.preventDefault();
            if (!finishSearch(id)) return;
            statusEl.textContent = "AI worker failed. Reset the game to try again.";
          };
          aiWorker.postMessage({ id, board, player, difficulty: diff, depth: DEPTHS[diff] });
        } catch (error) {
          if (finishSearch(id)) statusEl.textContent = "AI worker is unavailable. Reset the game to try again.";
        }
      }, 150);
    }
  }

  function applyMode() {
    if (mode === "ai-first-p1") humanIs = P1;
    else if (mode === "ai-first-p2") humanIs = P2;
    else humanIs = P1; // unused in local
    reset();
  }

  function reset() {
    cancelAI();
    grid = newGrid();
    history = [];
    current = P1;
    gameOver = false;
    winLine = null;
    renderShell();
    renderBoard();
    updateTurnStatus();
    if (mode !== "local" && current !== humanIs) advance();
  }

  undoBtn.addEventListener("click", () => {
    if (thinking) return;
    if (history.length === 0) return;
    // Undo last move; in AI mode, undo the pair so it's the player's turn again.
    undoMove();
    if (mode !== "local" && !gameOver && history.length > 0) {
      const last = history[history.length - 1];
      if (last.p === humanIs) undoMove();
    }
    gameOver = false;
    winLine = null;
    // Recompute whose turn it is based on history
    current = history.length % 2 === 0 ? P1 : P2;
    renderBoard();
    updateTurnStatus();
  });

  resetBtn.addEventListener("click", () => reset());

  modeSel.addEventListener("change", () => {
    mode = modeSel.value;
    store.set("mode", mode);
    applyMode();
  });

  Gamekit.wireDifficultyChips({
    el: chipsEl,
    difficulties: ["easy", "medium", "hard"],
    initial: diff,
    storage: store,
    storageKey: "diff",
    onChange: (d) => { diff = d; reset(); },
  });
  // sync local diff after wiring
  diff = store.get("diff", diff);
  if (!DEPTHS[diff]) diff = "medium";

  // Init
  applyMode();
  window.addEventListener("load", () => Manpage.autoOpen("connect-four"));
})();
