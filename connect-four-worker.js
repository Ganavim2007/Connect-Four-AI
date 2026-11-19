"use strict";

importScripts("./connect-four-engine.js");

self.onmessage = (event) => {
  const { id, board, player, depth } = event.data || {};
  try {
    if (!Array.isArray(board) || board.length !== 6 || ![1, 2].includes(player)) {
      throw new Error("Invalid search request");
    }
    const grid = board.map((row) => Uint8Array.from(row));
    const startedAt = performance.now();
    const result = self.ConnectFourEngine.chooseMove(grid, player, depth);
    const searchMs = performance.now() - startedAt;
    self.postMessage({
      id,
      move: result.col,
      score: result.score,
      depth: result.depth,
      stats: result.stats,
      searchMs,
    });
  } catch (error) {
    self.postMessage({ id, error: error && error.message ? error.message : String(error) });
  }
};
