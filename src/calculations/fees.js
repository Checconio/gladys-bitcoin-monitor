import { SATOSHIS_PER_BITCOIN } from "../constants.js";

function requireNonNegativeFinite(value, name) {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative finite number`);
  }
}

export function calculateNetworkFee(vsize, feeRate) {
  requireNonNegativeFinite(vsize, "vsize");
  requireNonNegativeFinite(feeRate, "feeRate");
  const feeSats = Math.ceil(vsize * feeRate);
  return {
    feeSats,
    feeBtc: feeSats / SATOSHIS_PER_BITCOIN,
  };
}

export function calculateFastEconomySpread(fees) {
  requireNonNegativeFinite(fees.fastestFee, "fastestFee");
  requireNonNegativeFinite(fees.economyFee, "economyFee");
  return Math.max(0, fees.fastestFee - fees.economyFee);
}
