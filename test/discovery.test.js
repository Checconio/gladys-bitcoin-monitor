import assert from "node:assert/strict";
import test from "node:test";
import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
} from "@gladysassistant/integration-sdk";
import { normalizeConfig } from "../src/config.js";
import { FEES_FEATURES } from "../src/devices/fees.js";
import { buildDiscoveredDevices } from "../src/devices/index.js";
import { SIMULATOR_FEATURES } from "../src/devices/simulator.js";

function fakeGladys() {
  return {
    externalIds(type, platformId) {
      const device = `ext:test:${type}:${platformId}`;
      return { device, feature: (key) => `${device}:${key}` };
    },
  };
}

const GLADYS_TRANSLATED_FEATURE_PAIRS = new Set([
  `${DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR}/${DEVICE_FEATURE_TYPES.SENSOR.INTEGER}`,
  `${DEVICE_FEATURE_CATEGORIES.CURRENCY}/${DEVICE_FEATURE_TYPES.CURRENCY.DECIMAL}`,
  `${DEVICE_FEATURE_CATEGORIES.DATA}/${DEVICE_FEATURE_TYPES.DATA.SIZE}`,
  `${DEVICE_FEATURE_CATEGORIES.DATARATE}/${DEVICE_FEATURE_TYPES.DATARATE.RATE}`,
  `${DEVICE_FEATURE_CATEGORIES.DURATION}/${DEVICE_FEATURE_TYPES.DURATION.DECIMAL}`,
  `${DEVICE_FEATURE_CATEGORIES.LEVEL_SENSOR}/${DEVICE_FEATURE_TYPES.SENSOR.DECIMAL}`,
  `${DEVICE_FEATURE_CATEGORIES.RISK}/${DEVICE_FEATURE_TYPES.RISK.INTEGER}`,
  `${DEVICE_FEATURE_CATEGORIES.SWITCH}/${DEVICE_FEATURE_TYPES.SWITCH.TARGET_CURRENT}`,
  `${DEVICE_FEATURE_CATEGORIES.TEXT}/${DEVICE_FEATURE_TYPES.TEXT.SELECT}`,
  `${DEVICE_FEATURE_CATEGORIES.TEXT}/${DEVICE_FEATURE_TYPES.TEXT.TEXT}`,
]);

test("discovers exactly the five logical Bitcoin devices with stable unique IDs", () => {
  const devices = buildDiscoveredDevices(fakeGladys(), normalizeConfig());
  assert.deepEqual(
    devices.map((device) => device.name),
    [
      "Bitcoin Fees",
      "Bitcoin Mempool",
      "Bitcoin Network",
      "Bitcoin Market",
      "Bitcoin Transaction Simulator",
    ],
  );
  assert.equal(new Set(devices.map((device) => device.external_id)).size, 5);
  const featureIds = devices.flatMap((device) =>
    device.features.map((feature) => feature.external_id),
  );
  assert.equal(new Set(featureIds).size, featureIds.length);
  assert.equal(
    featureIds.every((id) => id.startsWith("ext:test:bitcoin-monitor:")),
    true,
  );
});

test("uses supported Gladys contracts for direct simulator editing", () => {
  const simulator = buildDiscoveredDevices(fakeGladys(), normalizeConfig()).at(
    -1,
  );
  const priority = simulator.features.find((feature) =>
    feature.external_id.endsWith(`:${SIMULATOR_FEATURES.PRIORITY}`),
  );
  const amount = simulator.features.find((feature) =>
    feature.external_id.endsWith(`:${SIMULATOR_FEATURES.AMOUNT}`),
  );
  assert.equal(priority.category, DEVICE_FEATURE_CATEGORIES.TEXT);
  assert.equal(priority.type, DEVICE_FEATURE_TYPES.TEXT.SELECT);
  assert.equal(priority.read_only, false);
  assert.deepEqual(
    priority.supported_options.map((option) => option.value),
    ["fastest", "half_hour", "hour", "economy"],
  );
  assert.equal(amount.name, "Transfer amount (BTC)");
  assert.equal(amount.category, DEVICE_FEATURE_CATEGORIES.SWITCH);
  assert.equal(amount.type, DEVICE_FEATURE_TYPES.SWITCH.TARGET_CURRENT);
  assert.equal(amount.step, 0.00000001);
  assert.equal(amount.read_only, false);
  assert.equal(amount.has_feedback, true);
});

test("publishes feerates as generic rates without a currency icon", () => {
  const devices = buildDiscoveredDevices(fakeGladys(), normalizeConfig());
  const fees = devices[0];
  const simulator = devices.at(-1);
  const fastest = fees.features.find((feature) =>
    feature.external_id.endsWith(`:${FEES_FEATURES.FASTEST}`),
  );
  const selected = simulator.features.find((feature) =>
    feature.external_id.endsWith(`:${SIMULATOR_FEATURES.SELECTED_RATE}`),
  );

  for (const feature of [fastest, selected]) {
    assert.equal(feature.category, DEVICE_FEATURE_CATEGORIES.DATARATE);
    assert.equal(feature.type, DEVICE_FEATURE_TYPES.DATARATE.RATE);
    assert.equal(Object.hasOwn(feature, "unit"), false);
  }
});

test("uses only category/type pairs translated by Gladys Discovery", () => {
  const devices = buildDiscoveredDevices(fakeGladys(), normalizeConfig());
  for (const device of devices) {
    for (const feature of device.features) {
      const pair = `${feature.category}/${feature.type}`;
      assert.equal(
        GLADYS_TRANSLATED_FEATURE_PAIRS.has(pair),
        true,
        `${device.name}: ${feature.name} uses untranslated pair ${pair}`,
      );
    }
  }
});

test("adds the ISO currency code when Gladys has no matching fiat unit", () => {
  const config = normalizeConfig({ currency: "CHF" });
  const market = buildDiscoveredDevices(fakeGladys(), config)[3];
  assert.equal(market.features[0].name, "Bitcoin price (CHF)");
  assert.equal(Object.hasOwn(market.features[0], "unit"), false);
});
