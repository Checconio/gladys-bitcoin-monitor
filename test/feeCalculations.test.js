import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateFastEconomySpread,
  calculateNetworkFee,
} from "../src/calculations/fees.js";

test("calculates fee sats and BTC from vSize and feerate", () => {
  assert.deepEqual(calculateNetworkFee(250, 10), {
    feeSats: 2500,
    feeBtc: 0.000025,
  });
});

test("rounds fractional satoshi fees upward", () => {
  assert.deepEqual(calculateNetworkFee(141, 1.01), {
    feeSats: 143,
    feeBtc: 0.00000143,
  });
});

test("calculates the non-negative fast/economy spread", () => {
  assert.equal(
    calculateFastEconomySpread({ fastestFee: 10, economyFee: 2.5 }),
    7.5,
  );
  assert.equal(calculateFastEconomySpread({ fastestFee: 1, economyFee: 2 }), 0);
});
