import { DEVICE_FEATURE_UNITS } from "@gladysassistant/integration-sdk";
import { DEFAULT_TRANSFER_BTC, PRIORITIES } from "./constants.js";

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
  currency: "EUR",
  fast_poll_seconds: 60,
  difficulty_poll_seconds: 600,
  hashrate_poll_seconds: 1800,
  default_tx_vsize: 250,
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

function integerInRange(value, name, min, max) {
  const parsed = numberInRange(value, name, min, max);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer`);
  }
  return parsed;
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
    default_tx_vsize: integerInRange(
      raw.default_tx_vsize ?? DEFAULT_CONFIG.default_tx_vsize,
      "default_tx_vsize",
      50,
      10000,
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
    amountBtc: DEFAULT_TRANSFER_BTC,
    txVsize: config.default_tx_vsize,
    priority: config.default_priority,
  };
}
