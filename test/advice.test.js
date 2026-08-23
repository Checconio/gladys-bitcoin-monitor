import assert from "node:assert/strict";
import test from "node:test";
import { calculateStorageOpportunity } from "../src/calculations/advice.js";

test("storage opportunity thresholds include every documented boundary", () => {
  for (const [fee, score] of [
    [1, 5],
    [2, 4],
    [3, 3],
    [5, 2],
    [10, 1],
    [10.01, 0],
  ]) {
    assert.equal(
      calculateStorageOpportunity(fee, 3).score,
      score,
      `fee ${fee}`,
    );
  }
});

test("projected congestion caps a favorable score at Wait", () => {
  const result = calculateStorageOpportunity(2, 5.01);
  assert.equal(result.score, 1);
  assert.equal(result.congestionAdjusted, true);
  assert.match(result.text, /projected congestion/);
});
