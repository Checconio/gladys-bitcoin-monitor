import assert from "node:assert/strict";
import test from "node:test";
import { DEVICE_FEATURE_UNITS } from "@gladysassistant/integration-sdk";
import {
  DEFAULT_CONFIG,
  getGladysCurrencyUnit,
  normalizeApiBaseUrl,
  normalizeConfig,
} from "../src/config.js";

test("normalizes a complete valid configuration", () => {
  assert.deepEqual(
    normalizeConfig({
      api_base_url: "https://mempool.example/",
      currency: "usd",
      fast_poll_seconds: "30",
      difficulty_poll_seconds: "300",
      hashrate_poll_seconds: "600",
      default_tx_vsize: "250",
      default_transfer_btc: "0.05",
      default_priority: "economy",
    }),
    {
      api_base_url: "https://mempool.example",
      currency: "USD",
      fast_poll_seconds: 30,
      difficulty_poll_seconds: 300,
      hashrate_poll_seconds: 600,
      default_tx_vsize: 250,
      default_transfer_btc: 0.05,
      default_priority: "economy",
    },
  );
});

test("default configuration stays valid", () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
});

test("rejects unsafe or ambiguous API base URLs", () => {
  for (const url of [
    "file:///etc/passwd",
    "https://user:pass@example.com",
    "https://example.com/prefix",
    "https://example.com?next=evil",
    "not a url",
  ]) {
    assert.throws(() => normalizeApiBaseUrl(url), /API base URL/);
  }
});

test("validates currency, intervals, vSize, amount and priority", () => {
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
    () => normalizeConfig({ default_transfer_btc: 0 }),
    /default_transfer_btc/,
  );
  assert.throws(
    () => normalizeConfig({ default_priority: "unknown" }),
    /default_priority/,
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
