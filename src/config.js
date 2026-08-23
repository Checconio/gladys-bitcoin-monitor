import { DEVICE_FEATURE_UNITS } from "@gladysassistant/integration-sdk";
import { PRIORITIES } from "./constants.js";

export const SUPPORTED_CURRENCIES = Object.freeze([
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "CAD",
  "AUD",
  "JPY",
]);

export const DEFAULT_CONFIG = Object.freeze({
  api_base_url: "https://mempool.space",
  currency: "EUR",
  fast_poll_seconds: 60,
  difficulty_poll_seconds: 600,
  hashrate_poll_seconds: 1800,
  default_tx_vsize: 250,
  default_transfer_btc: 0.01,
  default_priority: PRIORITIES.FASTEST,
});

const PRIORITY_VALUES = new Set(Object.values(PRIORITIES));

function numberInRange(value, name, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(
      `${name} must be a finite number between ${min} and ${max}`,
    );
  }
  return parsed;
}

export function normalizeApiBaseUrl(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    throw new Error("API base URL must be a valid absolute URL");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("API base URL must use HTTP or HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("API base URL must not contain credentials");
  }
  if (url.search || url.hash) {
    throw new Error("API base URL must not contain a query string or fragment");
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new Error("API base URL must not contain a path");
  }
  return url.origin;
}

export function normalizeConfig(raw = {}) {
  const currency = String(
    raw.currency ?? DEFAULT_CONFIG.currency,
  ).toUpperCase();
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    throw new Error(
      `currency must be one of: ${SUPPORTED_CURRENCIES.join(", ")}`,
    );
  }

  const defaultPriority = String(
    raw.default_priority ?? DEFAULT_CONFIG.default_priority,
  );
  if (!PRIORITY_VALUES.has(defaultPriority)) {
    throw new Error(
      `default_priority must be one of: ${[...PRIORITY_VALUES].join(", ")}`,
    );
  }

  return {
    api_base_url: normalizeApiBaseUrl(
      raw.api_base_url ?? DEFAULT_CONFIG.api_base_url,
    ),
    currency,
    fast_poll_seconds: numberInRange(
      raw.fast_poll_seconds ?? DEFAULT_CONFIG.fast_poll_seconds,
      "fast_poll_seconds",
      30,
      900,
    ),
    difficulty_poll_seconds: numberInRange(
      raw.difficulty_poll_seconds ?? DEFAULT_CONFIG.difficulty_poll_seconds,
      "difficulty_poll_seconds",
      300,
      3600,
    ),
    hashrate_poll_seconds: numberInRange(
      raw.hashrate_poll_seconds ?? DEFAULT_CONFIG.hashrate_poll_seconds,
      "hashrate_poll_seconds",
      600,
      21600,
    ),
    default_tx_vsize: numberInRange(
      raw.default_tx_vsize ?? DEFAULT_CONFIG.default_tx_vsize,
      "default_tx_vsize",
      50,
      10000,
    ),
    default_transfer_btc: numberInRange(
      raw.default_transfer_btc ?? DEFAULT_CONFIG.default_transfer_btc,
      "default_transfer_btc",
      0.00000001,
      21_000_000,
    ),
    default_priority: defaultPriority,
  };
}

export function getGladysCurrencyUnit(currency) {
  switch (currency) {
    case "EUR":
      return DEVICE_FEATURE_UNITS.EURO;
    case "USD":
      return DEVICE_FEATURE_UNITS.DOLLAR;
    case "GBP":
      return DEVICE_FEATURE_UNITS.POUND_STERLING;
    default:
      return undefined;
  }
}

export function simulatorDefaults(config) {
  return {
    amountBtc: config.default_transfer_btc,
    txVsize: config.default_tx_vsize,
    priority: config.default_priority,
  };
}
