import assert from "node:assert/strict";
import test from "node:test";
import { normalizeConfig } from "../src/config.js";
import { roundForPublication } from "../src/calculations/precision.js";
import { getFeesStates, FEES_FEATURES } from "../src/devices/fees.js";
import { getMarketStates, MARKET_FEATURES } from "../src/devices/market.js";
import {
  getSimulatorStates,
  SIMULATOR_FEATURES,
} from "../src/devices/simulator.js";

function fakeGladys() {
  return {
    externalIds(type, platformId) {
      const device = `ext:test:${type}:${platformId}`;
      return { device, feature: (key) => `${device}:${key}` };
    },
  };
}

function statesByFeature(states) {
  return Object.fromEntries(
    states.map((entry) => [
      entry.device_feature_external_id.split(":").at(-1),
      entry.state ?? entry.text,
    ]),
  );
}

test("rounds classic JavaScript floating-point artifacts", () => {
  assert.equal(roundForPublication(0.06269999999999999, 4), 0.0627);
  assert.equal(roundForPublication(0.17220950999999998, 4), 0.1722);
  assert.equal(roundForPublication(-0.0000001, 4), 0);
});

test("publishes each simulator metric with its display precision", () => {
  const config = normalizeConfig();
  const states = statesByFeature(
    getSimulatorStates(
      fakeGladys(),
      {
        fees: {
          fastestFee: 2.508,
          halfHourFee: 1.756,
          hourFee: 1.012,
          economyFee: 0.2,
        },
        prices: { EUR: 68067 },
      },
      config,
      { amountBtc: 0.01, txVsize: 250, priority: "fastest" },
    ),
  );

  assert.equal(states[SIMULATOR_FEATURES.AMOUNT], 0.01);
  assert.equal(states[SIMULATOR_FEATURES.VSIZE], 250);
  assert.equal(states[SIMULATOR_FEATURES.TRANSFER_FIAT], 680.67);
  assert.equal(states[SIMULATOR_FEATURES.SELECTED_RATE], 2.508);
  assert.equal(states[SIMULATOR_FEATURES.SELECTED_SATS], 627);
  assert.equal(states[SIMULATOR_FEATURES.SELECTED_BTC], 0.00000627);
  assert.equal(states[SIMULATOR_FEATURES.SELECTED_FIAT], 0.4268);
  assert.equal(states[SIMULATOR_FEATURES.SELECTED_PERCENT], 0.0627);
  assert.equal(states[SIMULATOR_FEATURES.FASTEST_FIAT], 0.4268);
  assert.equal(states[SIMULATOR_FEATURES.HOUR_FIAT], 0.1722);
  assert.equal(states[SIMULATOR_FEATURES.ECONOMY_FIAT], 0.034);
});

test("rounds market prices and feerates before publication", () => {
  const market = statesByFeature(
    getMarketStates(
      fakeGladys(),
      { prices: { EUR: 68067.129 } },
      normalizeConfig(),
    ),
  );
  assert.equal(market[MARKET_FEATURES.PRICE], 68067.13);

  const fees = statesByFeature(
    getFeesStates(fakeGladys(), {
      fees: {
        fastestFee: 2.50849,
        halfHourFee: 0.1 + 0.2,
        hourFee: 1.01249,
        economyFee: 0.2,
        minimumFee: 0.1,
      },
      projectedBlocks: [
        { medianFee: 2.50849, nTx: 2500, blockVSize: 997500.25 },
      ],
    }),
  );
  assert.equal(fees[FEES_FEATURES.FASTEST], 2.508);
  assert.equal(fees[FEES_FEATURES.HALF_HOUR], 0.3);
  assert.equal(fees[FEES_FEATURES.SPREAD], 2.308);
  assert.equal(fees[FEES_FEATURES.BLOCK_1_VSIZE], 997500);
});
