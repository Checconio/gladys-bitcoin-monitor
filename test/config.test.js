import assert from "node:assert/strict";
import test from "node:test";
import { DEVICE_FEATURE_UNITS } from "@gladysassistant/integration-sdk";
import {
  DEFAULT_CONFIG,
  getGladysCurrencyUnit,
  normalizeConfig,
} from "../src/config.js";
import { MEMPOOL_API_BASE_URL } from "../src/constants.js";
import { SIMULATOR_FEATURES } from "../src/devices/simulator.js";
import { BitcoinMonitorIntegration } from "../src/integration.js";

function fakeGladys() {
  return {
    externalIds(type, platformId) {
      const device = `ext:test:${type}:${platformId}`;
      return { device, feature: (key) => `${device}:${key}` };
    },
  };
}

test("normalizes a complete valid configuration", () => {
  assert.deepEqual(
    normalizeConfig({
      currency: "usd",
      fast_poll_seconds: "30",
      difficulty_poll_seconds: "300",
      hashrate_poll_seconds: "600",
      default_tx_vsize: "250",
      default_priority: "economy",
    }),
    {
      currency: "USD",
      fast_poll_seconds: 30,
      difficulty_poll_seconds: 300,
      hashrate_poll_seconds: 600,
      default_tx_vsize: 250,
      default_priority: "economy",
    },
  );
});

test("default configuration stays valid", () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
});

test("ignores legacy API URL values because the endpoint is fixed", () => {
  const config = normalizeConfig({ api_base_url: "https://example.com" });
  assert.equal(Object.hasOwn(config, "api_base_url"), false);
  assert.equal(MEMPOOL_API_BASE_URL, "https://mempool.space");

  const integration = new BitcoinMonitorIntegration({
    gladys: {},
    dataDirectory: ".",
  });
  integration.collector.setConfig(config);
  assert.equal(integration.client.baseUrl, MEMPOOL_API_BASE_URL);
});

test("validates currency, intervals, integer vSize and priority", () => {
  assert.throws(() => normalizeConfig({ currency: "BTC" }), /currency/);
  assert.throws(
    () => normalizeConfig({ fast_poll_seconds: 29 }),
    /fast_poll_seconds/,
  );
  assert.throws(
    () => normalizeConfig({ difficulty_poll_seconds: 299 }),
    /difficulty_poll_seconds/,
  );
  assert.throws(
    () => normalizeConfig({ hashrate_poll_seconds: 599 }),
    /hashrate_poll_seconds/,
  );
  assert.throws(
    () => normalizeConfig({ default_tx_vsize: 49 }),
    /default_tx_vsize/,
  );
  assert.throws(
    () => normalizeConfig({ default_tx_vsize: 250.5 }),
    /default_tx_vsize/,
  );
  assert.throws(
    () => normalizeConfig({ default_priority: "unknown" }),
    /default_priority/,
  );
});

test("ignores the legacy configured transfer amount", () => {
  const config = normalizeConfig({ default_transfer_btc: 0.05 });
  assert.equal(Object.hasOwn(config, "default_transfer_btc"), false);
});

test("accepts a BTC transfer amount set directly by Gladys", async () => {
  const gladys = fakeGladys();
  const integration = new BitcoinMonitorIntegration({
    gladys,
    dataDirectory: ".",
  });
  let capturedState;
  integration.updateSimulator = async (state) => {
    capturedState = state;
  };
  const feature = {
    external_id: gladys
      .externalIds("bitcoin-monitor", "simulator")
      .feature(SIMULATOR_FEATURES.AMOUNT),
  };

  await integration.onSetValue(null, feature, "0.02500000");
  assert.deepEqual(capturedState, {
    amountBtc: 0.025,
    txVsize: 250,
    priority: "fastest",
  });
  await assert.rejects(
    integration.onSetValue(null, feature, "not-a-number"),
    /Simulator amount/,
  );
});

test("maps only genuine Gladys fiat units", () => {
  assert.equal(getGladysCurrencyUnit("EUR"), DEVICE_FEATURE_UNITS.EURO);
  assert.equal(getGladysCurrencyUnit("USD"), DEVICE_FEATURE_UNITS.DOLLAR);
  assert.equal(
    getGladysCurrencyUnit("GBP"),
    DEVICE_FEATURE_UNITS.POUND_STERLING,
  );
  assert.equal(getGladysCurrencyUnit("CAD"), undefined);
  assert.equal(getGladysCurrencyUnit("CHF"), undefined);
});
