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
  const analysisEls = {
    depth: document.getElementById("analysis-depth"),
    nodes: document.getElementById("analysis-nodes"),
    cutoffs: document.getElementById("analysis-cutoffs"),
    hits: document.getElementById("analysis-hits"),
    time: document.getElementById("analysis-time"),
    score: document.getElementById("analysis-score"),
    move: document.getElementById("analysis-move"),
    history: document.getElementById("move-history"),
    back: document.getElementById("history-back"),
    forward: document.getElementById("history-forward"),
    replay: document.getElementById("history-replay"),
  };

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
  let thinking = false;
  let humanIs = P1;           // set per mode
  let viewPly = 0;
  let replayTimer = null;

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
    const shownGrid = gridAtPly(viewPly);
    const shownWin = winAtPly(viewPly, shownGrid);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        const el = boardEl.children[i];
        el.classList.remove("p1", "p2", "win");
        if (shownGrid[r][c] === P1) el.classList.add("p1");
        else if (shownGrid[r][c] === P2) el.classList.add("p2");
      }
    }
    if (shownWin) {
      shownWin.forEach(({ r, c }) => {
        boardEl.children[r * COLS + c].classList.add("win");
      });
    }
    // Disable full columns
    for (let c = 0; c < COLS; c++) {
      const btn = colsEl.children[c];
      btn.disabled = gameOver || thinking || viewPly !== history.length || shownGrid[0][c] !== EMPTY;
    }
  }

  function gridAtPly(ply) {
    if (ply >= history.length) return grid;
    const snapshot = newGrid();
    for (let i = 0; i < ply; i++) {
      const move = history[i];
      snapshot[move.r][move.c] = move.p;
    }
    return snapshot;
  }

  function winAtPly(ply, shownGrid) {
    if (ply <= 0) return null;
    const move = history[ply - 1];
    return Engine.winAt(shownGrid, move.r, move.c, move.p);
  }

  function renderAnalysis() {
    const formatter = new Intl.NumberFormat();
    analysisEls.history.innerHTML = "";
    history.forEach((move, index) => {
      const button = document.createElement("button");
      const localName = move.p === P1 ? "Amber" : "Mint";
      const isAI = mode !== "local" && move.p !== humanIs;
      button.type = "button";
      button.className = "history-move";
      button.setAttribute("aria-current", viewPly === index + 1 ? "step" : "false");
      const label = mode === "local" ? localName : (isAI ? "AI" : "You");
      const notation = index % 2 === 0 ? "." : "…";
      button.textContent = `${Math.floor(index / 2) + 1}${notation} ${label} · column ${move.c + 1}`;
      if (move.analysis) {
        const note = document.createElement("small");
        note.textContent = `score ${formatter.format(move.analysis.score)}`;
        button.appendChild(note);
      }
      button.addEventListener("click", () => showHistoryPly(index + 1));
      analysisEls.history.appendChild(button);
    });

    let latestAI = null;
    for (let i = 0; i < viewPly; i++) if (history[i].analysis) latestAI = history[i];
    const values = latestAI && latestAI.analysis;
    analysisEls.depth.textContent = values ? String(values.depth) : "—";
    analysisEls.nodes.textContent = values ? formatter.format(values.stats.nodes) : "—";
    analysisEls.cutoffs.textContent = values ? formatter.format(values.stats.prunedBranches) : "—";
    analysisEls.hits.textContent = values ? formatter.format(values.stats.tableHits) : "—";
    analysisEls.time.textContent = values ? `${values.searchMs.toFixed(2)} ms` : "—";
    analysisEls.score.textContent = values ? formatter.format(values.score) : "—";
    if (values) {
      const col = latestAI.c + 1;
      analysisEls.move.innerHTML = `<p><strong>AI selected column ${col}</strong></p><p>Evaluation score: <strong>${formatter.format(values.score)}</strong></p><p>Depth ${values.depth} · ${formatter.format(values.stats.nodes)} nodes · ${values.searchMs.toFixed(2)} ms</p>`;
    } else {
      analysisEls.move.innerHTML = "<p>No AI move has been analyzed at this position.</p>";
    }
    analysisEls.back.disabled = viewPly <= 0;
    analysisEls.forward.disabled = viewPly >= history.length;
    analysisEls.replay.disabled = !gameOver || history.length === 0 || replayTimer !== null;
  }

  function showHistoryPly(ply) {
    if (replayTimer !== null) { clearInterval(replayTimer); replayTimer = null; }
    viewPly = Math.max(0, Math.min(history.length, ply));
    renderBoard();
    renderAnalysis();
  }

  function replayGame() {
    if (!gameOver || history.length === 0 || thinking) return;
    showHistoryPly(0);
    replayTimer = setInterval(() => {
      viewPly++;
      renderBoard();
      renderAnalysis();
      if (viewPly >= history.length) {
        clearInterval(replayTimer);
        replayTimer = null;
        renderAnalysis();
      }
    }, 650);
    renderAnalysis();
  }

  function dropRow(g, c) {
    return Engine.dropRow(g, c);
  }

  function makeMove(c, p, analysis = null) {
    const r = dropRow(grid, c);
    if (r < 0) return false;
    grid[r][c] = p;
    history.push({ r, c, p, analysis });
    viewPly = history.length;
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

  function playMove(c, analysis = null) {
    if (dropRow(grid, c) < 0) return false;
    const ok = makeMove(c, current, analysis);
    if (!ok) return false;
    const last = history[history.length - 1];
    const win = Engine.winAt(grid, last.r, last.c, last.p);
    if (win) {
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
    renderAnalysis();
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
              playMove(col, {
                score: result.score,
                depth: result.depth,
                stats: result.stats,
                searchMs: result.searchMs,
              });
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
    if (replayTimer !== null) { clearInterval(replayTimer); replayTimer = null; }
    grid = newGrid();
    history = [];
    current = P1;
    gameOver = false;
    viewPly = 0;
    renderShell();
    renderBoard();
    renderAnalysis();
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
    // Recompute whose turn it is based on history
    current = history.length % 2 === 0 ? P1 : P2;
    viewPly = history.length;
    renderBoard();
    renderAnalysis();
    updateTurnStatus();
  });

  resetBtn.addEventListener("click", () => reset());
  analysisEls.back.addEventListener("click", () => showHistoryPly(viewPly - 1));
  analysisEls.forward.addEventListener("click", () => showHistoryPly(viewPly + 1));
  analysisEls.replay.addEventListener("click", replayGame);

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
