(function (global, factory) {
  "use strict";

  const engine = factory();
  if (typeof module === "object" && module.exports) module.exports = engine;
  if (global) global.ConnectFourEngine = engine;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const ROWS = 6, COLS = 7;
  const P1 = 1, P2 = 2, EMPTY = 0;
  const WIN_SCORE = 10000000;
  const WIN_SCORE_THRESHOLD = WIN_SCORE - ROWS * COLS;
  const COL_ORDER = [3, 2, 4, 1, 5, 0, 6];
  const COL_WEIGHT = [3, 4, 5, 7, 5, 4, 3];
  // Alpha-beta table entries are exact scores, lower bounds, or upper bounds.
  const EXACT = 0, LOWER = 1, UPPER = 2;

  function createGrid() {
    const grid = [];
    for (let r = 0; r < ROWS; r++) grid.push(new Uint8Array(COLS));
    return grid;
  }

  function dropRow(grid, col) {
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r][col] === EMPTY) return r;
    }
    return -1;
  }

  function winAt(grid, row, col, player) {
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]];
    for (const [dr, dc] of directions) {
      const line = [{ r: row, c: col }];
      for (let k = 1; k < 4; k++) {
        const nr = row + dr * k, nc = col + dc * k;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || grid[nr][nc] !== player) break;
        line.push({ r: nr, c: nc });
      }
      for (let k = 1; k < 4; k++) {
        const nr = row - dr * k, nc = col - dc * k;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || grid[nr][nc] !== player) break;
        line.unshift({ r: nr, c: nc });
      }
      if (line.length >= 4) return line.slice(0, 4);
    }
    return null;
  }

  function isFull(grid) {
    for (let col = 0; col < COLS; col++) {
      if (grid[0][col] === EMPTY) return false;
    }
    return true;
  }

  function countImmediateWinningMoves(grid, player) {
    let count = 0;
    for (const col of COL_ORDER) {
      const row = dropRow(grid, col);
      if (row < 0) continue;
      grid[row][col] = player;
      const wins = winAt(grid, row, col, player) !== null;
      grid[row][col] = EMPTY;
      if (wins) count++;
    }
    return count;
  }

  function evalWindow(window, me, them) {
    let mine = 0, theirs = 0, empty = 0;
    for (const cell of window) {
      if (cell === me) mine++;
      else if (cell === them) theirs++;
      else empty++;
    }
    if (mine > 0 && theirs > 0) return 0;
    if (mine === 4) return 100000;
    if (theirs === 4) return -100000;
    if (mine === 3 && empty === 1) return 50;
    if (mine === 2 && empty === 2) return 5;
    if (theirs === 3 && empty === 1) return -80;
    if (theirs === 2 && empty === 2) return -4;
    return 0;
  }

  function evaluate(grid, me) {
    const them = me === P1 ? P2 : P1;
    let score = 0;

    for (let row = 0; row < ROWS; row++) {
      if (grid[row][3] === me) score += 3;
    }
    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row < ROWS; row++) {
        if (grid[row][col] === me) score += COL_WEIGHT[col] * 0.3;
      }
    }

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col <= COLS - 4; col++) {
        score += evalWindow(
          [grid[row][col], grid[row][col + 1], grid[row][col + 2], grid[row][col + 3]],
          me,
          them
        );
      }
    }
    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row <= ROWS - 4; row++) {
        score += evalWindow(
          [grid[row][col], grid[row + 1][col], grid[row + 2][col], grid[row + 3][col]],
          me,
          them
        );
      }
    }
    for (let row = 3; row < ROWS; row++) {
      for (let col = 0; col <= COLS - 4; col++) {
        score += evalWindow(
          [grid[row][col], grid[row - 1][col + 1], grid[row - 2][col + 2], grid[row - 3][col + 3]],
          me,
          them
        );
      }
    }
    for (let row = 0; row <= ROWS - 4; row++) {
      for (let col = 0; col <= COLS - 4; col++) {
        score += evalWindow(
          [grid[row][col], grid[row + 1][col + 1], grid[row + 2][col + 2], grid[row + 3][col + 3]],
          me,
          them
        );
      }
    }

    // Two distinct landing columns create a fork; an opponent fork is an urgent threat.
    const ownThreats = countImmediateWinningMoves(grid, me);
    const opponentThreats = countImmediateWinningMoves(grid, them);
    if (ownThreats === 1) score += 500;
    else if (ownThreats > 1) score += 9000 + (ownThreats - 2) * 2000;
    if (opponentThreats === 1) score -= 1200;
    else if (opponentThreats > 1) score -= 12000 + (opponentThreats - 2) * 3000;

    return score;
  }

  function positionKey(grid, sideToMove, me) {
    // Include both players so identical discs with a different turn cannot collide.
    let key = "";
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) key += String.fromCharCode(48 + grid[row][col]);
    }
    return key + ":" + sideToMove + ":" + me;
  }

  // Normalize mate scores so cached wins/losses remain correct at a different search ply.
  function scoreToTable(score, ply) {
    if (score > WIN_SCORE_THRESHOLD) return score + ply;
    if (score < -WIN_SCORE_THRESHOLD) return score - ply;
    return score;
  }

  function scoreFromTable(score, ply) {
    if (score > WIN_SCORE_THRESHOLD) return score - ply;
    if (score < -WIN_SCORE_THRESHOLD) return score + ply;
    return score;
  }

  function orderedMoves(grid, player, preferredCol, stats) {
    const opponent = player === P1 ? P2 : P1;
    const opponentThreatsBefore = countImmediateWinningMoves(grid, opponent);
    const moves = [];

    for (let order = 0; order < COL_ORDER.length; order++) {
      const col = COL_ORDER[order];
      const row = dropRow(grid, col);
      if (row < 0) continue;

      grid[row][col] = player;
      const winsNow = winAt(grid, row, col, player) !== null;
      let priority = 0;

      if (winsNow) {
        priority = 1000000;
      } else {
        const opponentThreatsAfter = countImmediateWinningMoves(grid, opponent);
        const ownThreatsAfter = countImmediateWinningMoves(grid, player);

        if (opponentThreatsBefore > 0) {
          if (opponentThreatsAfter === 0) priority += 300000;
          else if (opponentThreatsAfter < opponentThreatsBefore) {
            priority += 20000 * (opponentThreatsBefore - opponentThreatsAfter);
          }
        }
        if (ownThreatsAfter > 1) priority += 12000 + ownThreatsAfter * 1000;
        else if (ownThreatsAfter === 1) priority += 1000;

        // Prefer cached and prior-iteration moves after tactics, before the center bias.
        if (col === preferredCol) priority += 5000;
        priority += (COL_ORDER.length - order) * 10;
      }
      grid[row][col] = EMPTY;

      moves.push({ col, row, priority });
    }

    moves.sort((a, b) => b.priority - a.priority);
    stats.orderedMoves += moves.length;
    return moves;
  }

  function alphabeta(grid, depth, alpha, beta, maximizing, me, ply, table, stats, preferredCol) {
    stats.nodes++;
    if (depth === 0 || isFull(grid)) return { score: evaluate(grid, me), col: -1 };

    const opponent = me === P1 ? P2 : P1;
    const player = maximizing ? me : opponent;
    const key = positionKey(grid, player, me);
    const alphaOriginal = alpha, betaOriginal = beta;
    const entry = table.get(key);
    let tableMove = preferredCol;

    if (entry) {
      stats.tableHits++;
      if (entry.bestCol >= 0) tableMove = entry.bestCol;
      // Only reuse a score searched at least this deeply; bound entries cut off only safely.
      if (entry.depth >= depth) {
        const cachedScore = scoreFromTable(entry.score, ply);
        if (entry.bound === EXACT
          || (entry.bound === LOWER && cachedScore >= beta)
          || (entry.bound === UPPER && cachedScore <= alpha)) {
          stats.tableCutoffs++;
          return { score: cachedScore, col: entry.bestCol };
        }
      }
    }

    let bestScore = maximizing ? -Infinity : Infinity;
    let bestCol = -1;
    const moves = orderedMoves(grid, player, tableMove, stats);

    for (const move of moves) {
      grid[move.row][move.col] = player;
      const nextPly = ply + 1;
      let score;

      if (winAt(grid, move.row, move.col, player)) {
        score = player === me ? WIN_SCORE - nextPly : -WIN_SCORE + nextPly;
      } else if (isFull(grid)) {
        score = 0;
      } else {
        score = alphabeta(
          grid,
          depth - 1,
          alpha,
          beta,
          !maximizing,
          me,
          nextPly,
          table,
          stats,
          null
        ).score;
      }
      grid[move.row][move.col] = EMPTY;

      if ((maximizing && score > bestScore) || (!maximizing && score < bestScore)) {
        bestScore = score;
        bestCol = move.col;
      }
      if (maximizing) alpha = Math.max(alpha, bestScore);
      else beta = Math.min(beta, bestScore);
      if (beta <= alpha) {
        stats.prunedBranches++;
        break;
      }
    }

    // Classify the fail-soft result against the caller's original alpha-beta window.
    const bound = bestScore <= alphaOriginal ? UPPER
      : bestScore >= betaOriginal ? LOWER
        : EXACT;
    const previous = table.get(key);
    if (!previous
      || depth > previous.depth
      || (depth === previous.depth && (bound === EXACT || previous.bound !== EXACT))) {
      table.set(key, {
        depth,
        score: scoreToTable(bestScore, ply),
        bound,
        bestCol,
      });
    }
    return { score: bestScore, col: bestCol };
  }

  function chooseMove(grid, me, maxDepth) {
    const requestedDepth = Math.max(1, Math.floor(maxDepth));
    const table = new Map();
    const stats = { nodes: 0, tableHits: 0, tableCutoffs: 0, prunedBranches: 0, orderedMoves: 0 };
    let best = { score: -Infinity, col: -1, depth: 0 };
    let previousBest = null;

    // Keep only fully completed iterations; their table entries also help deeper searches.
    for (let depth = 1; depth <= requestedDepth; depth++) {
      const result = alphabeta(
        grid,
        depth,
        -Infinity,
        Infinity,
        true,
        me,
        0,
        table,
        stats,
        previousBest
      );
      if (result.col >= 0) {
        best = { score: result.score, col: result.col, depth };
        previousBest = result.col;
      }
    }

    return { ...best, stats };
  }

  return {
    createGrid,
    dropRow,
    winAt,
    isFull,
    evaluate,
    countImmediateWinningMoves,
    chooseMove,
  };
});
