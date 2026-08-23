import assert from "node:assert/strict";
import test from "node:test";
import { PRIORITIES } from "../src/constants.js";
import {
  simulatePriorities,
  simulateTransaction,
} from "../src/calculations/simulator.js";

test("250 vB at 10 sat/vB costs 2500 sats and 0.000025 BTC", () => {
  const result = simulateTransaction({
    amountBtc: 0.05,
    txVsize: 250,
    feeRate: 10,
    btcFiatPrice: 50_000,
  });
  assert.equal(result.feeSats, 2500);
  assert.equal(result.feeBtc, 0.000025);
  assert.equal(result.feeFiat, 1.25);
  assert.equal(result.transferValueFiat, 2500);
  assert.equal(result.feePercent, 0.05);
});

test("zero transfer amount does not divide by zero", () => {
  const result = simulateTransaction({
    amountBtc: 0,
    txVsize: 250,
    feeRate: 10,
    btcFiatPrice: 50_000,
  });
  assert.equal(result.feePercent, null);
  assert.equal(Number.isFinite(result.feeFiat), true);
});

test("calculates every priority and selects the requested one", () => {
  const result = simulatePriorities({
    amountBtc: 0.1,
    txVsize: 250,
    priority: PRIORITIES.ECONOMY,
    fees: { fastestFee: 10, halfHourFee: 7, hourFee: 5, economyFee: 2 },
    btcFiatPrice: 60_000,
  });
  assert.equal(result.selected.feeRate, 2);
  assert.equal(result.priorities[PRIORITIES.FASTEST].feeSats, 2500);
});
