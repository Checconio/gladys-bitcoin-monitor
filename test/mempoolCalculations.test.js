import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateFeeHistogram,
  vsizeToVirtualMegabytes,
} from "../src/calculations/mempool.js";

test("converts vsize to virtual megabytes", () => {
  assert.equal(vsizeToVirtualMegabytes(1_900_000), 1.9);
});

test("aggregates fee histogram pressure at the documented thresholds", () => {
  assert.deepEqual(
    aggregateFeeHistogram([
      [10, 1_000_000],
      [5, 500_000],
      [2, 250_000],
      [1, 100_000],
      [0.5, 50_000],
    ]),
    { 1: 1.85, 2: 1.75, 5: 1.5, 10: 1 },
  );
});

test("rejects malformed histogram entries instead of silently converting to zero", () => {
  assert.throws(() => aggregateFeeHistogram([[2, "bad"]]), /entries/);
});
