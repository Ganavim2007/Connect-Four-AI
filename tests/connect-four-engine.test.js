"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const Engine = require("../connect-four-engine.js");

function positionWithBottomRow(values) {
  const grid = Engine.createGrid();
  for (let col = 0; col < values.length; col++) grid[5][col] = values[col];
  return grid;
}

function serialize(grid) {
  return grid.map((row) => Array.from(row).join("")).join("");
}

test("takes an immediate winning move", () => {
  const grid = positionWithBottomRow([1, 1, 1, 0, 0, 2, 2]);

  const result = Engine.chooseMove(grid, 1, 2);

  assert.equal(result.col, 3);
  assert.equal(result.depth, 2);
});

test("blocks the opponent's immediate win", () => {
  const grid = positionWithBottomRow([2, 2, 2, 0, 0, 1, 0]);

  const result = Engine.chooseMove(grid, 1, 2);

  assert.equal(result.col, 3);
});

test("reuses repeated positions without mutating the supplied board", () => {
  const grid = Engine.createGrid();
  const before = serialize(grid);

  const result = Engine.chooseMove(grid, 1, 5);

  assert.ok(result.stats.tableHits > 0);
  assert.ok(result.stats.tableCutoffs > 0);
  assert.equal(result.depth, 5);
  assert.equal(serialize(grid), before);
});
