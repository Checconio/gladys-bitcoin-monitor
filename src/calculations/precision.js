export const PUBLICATION_PRECISION = Object.freeze({
  FIAT_VALUE: 2,
  FIAT_FEE: 4,
  FEE_RATE: 3,
  PERCENT: 4,
  BITCOIN: 8,
  NETWORK_METRIC: 3,
  VIRTUAL_MEGABYTES: 6,
});

export function roundForPublication(value, decimalPlaces) {
  if (!Number.isFinite(value)) {
    throw new TypeError("Published values must be finite numbers");
  }
  if (
    !Number.isInteger(decimalPlaces) ||
    decimalPlaces < 0 ||
    decimalPlaces > 100
  ) {
    throw new TypeError("decimalPlaces must be an integer between 0 and 100");
  }
  const rounded = Number(value.toFixed(decimalPlaces));
  return Object.is(rounded, -0) ? 0 : rounded;
}
