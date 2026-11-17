(function () {
  "use strict";

  const statusEl = document.getElementById("status");
  const statusDisplay = document.getElementById("status-display");
  const modeSelect = document.getElementById("mode");
  const board = document.getElementById("board");
  const columns = document.getElementById("cols");
  const youCard = document.getElementById("player-you");
  const aiCard = document.getElementById("player-ai");
  const playButton = document.getElementById("play-game");
  let lastOutcome = "";

  function setCard(card, piece, name, color) {
    card.dataset.piece = piece;
    card.querySelector(".player-name").textContent = name;
    card.querySelector(".player-piece").textContent = color + " disc";
  }

  function updatePresentation() {
    const local = modeSelect.value === "local";
    const aiFirst = modeSelect.value === "ai-first-p2";
    const youPiece = aiFirst ? "p2" : "p1";
    const aiPiece = aiFirst ? "p1" : "p2";

    setCard(youCard, youPiece, local ? "Player 1" : "You", youPiece === "p1" ? "Red" : "Yellow");
    setCard(aiCard, aiPiece, local ? "Player 2" : "AI opponent", aiPiece === "p1" ? "Red" : "Yellow");

    const message = statusEl.textContent.trim();
    const thinking = /AI thinking/i.test(message);
    const draw = /\bdraw\b/i.test(message);
    const win = /\bwin(?:s)?\b/i.test(message);
    const p1Turn = local ? /^Amber to move/i.test(message) : thinking ? aiFirst : !win && !draw && youPiece === "p1";
    const p2Turn = local ? /^Mint to move/i.test(message) : thinking ? !aiFirst : !win && !draw && youPiece === "p2";
    const turnCard = p1Turn ? (local ? youCard : youPiece === "p1" ? youCard : aiCard)
      : p2Turn ? (local ? aiCard : youPiece === "p2" ? youCard : aiCard)
        : null;

    [youCard, aiCard].forEach((card) => {
      card.classList.toggle("is-active", card === turnCard);
      card.classList.toggle("is-thinking", thinking && card === aiCard);
      card.querySelector(".player-state").textContent =
        card === turnCard ? (thinking && card === aiCard ? "Thinking" : "To move") : "Waiting";
    });

    statusDisplay.textContent = message || "Your turn";
    statusDisplay.dataset.state = thinking ? "thinking" : draw ? "draw" : win ? "win" : "turn";
    const outcome = win ? message : "";
    if (outcome && outcome !== lastOutcome) celebrate();
    lastOutcome = outcome;
  }

  function celebrate() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const colors = ["#ff526d", "#ffd166", "#9d7bff", "#6c8cff", "#6de5b3"];
    for (let i = 0; i < 42; i++) {
      const piece = document.createElement("i");
      piece.className = "confetti-piece";
      piece.style.left = Math.random() * 100 + "vw";
      piece.style.backgroundColor = colors[i % colors.length];
      piece.style.setProperty("--drift", (Math.random() * 180 - 90) + "px");
      piece.style.setProperty("--spin", (Math.random() * 900 - 450) + "deg");
      piece.style.animationDelay = Math.random() * .45 + "s";
      document.body.appendChild(piece);
      window.setTimeout(() => piece.remove(), 3000);
    }
  }

  function setHoveredColumn(event) {
    const button = event.target.closest(".c4-col-btn");
    if (button && columns.contains(button)) board.dataset.hoverCol = button.dataset.col;
  }

  function clearHoveredColumn(event) {
    if (!columns.contains(event.relatedTarget)) delete board.dataset.hoverCol;
  }

  playButton.addEventListener("click", () => {
    document.getElementById("game").scrollIntoView({ behavior: "smooth", block: "start" });
    const firstOpenColumn = Array.from(columns.querySelectorAll(".c4-col-btn")).find((button) => !button.disabled);
    if (firstOpenColumn) firstOpenColumn.focus({ preventScroll: true });
  });
  modeSelect.addEventListener("change", updatePresentation);
  columns.addEventListener("pointerover", setHoveredColumn);
  columns.addEventListener("pointerout", clearHoveredColumn);
  columns.addEventListener("focusin", setHoveredColumn);
  columns.addEventListener("focusout", clearHoveredColumn);

  new MutationObserver(updatePresentation).observe(statusEl, {
    childList: true,
    characterData: true,
    subtree: true,
  });
  updatePresentation();
})();
