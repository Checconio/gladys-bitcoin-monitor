import { VBYTES_PER_VIRTUAL_MEGABYTE } from "../constants.js";

export const PRESSURE_THRESHOLDS = Object.freeze([1, 2, 5, 10]);

export function vsizeToVirtualMegabytes(vsize) {
  if (!Number.isFinite(vsize) || vsize < 0) {
    throw new TypeError("vsize must be a non-negative finite number");
  }
  return vsize / VBYTES_PER_VIRTUAL_MEGABYTE;
}

export function aggregateFeeHistogram(
  feeHistogram,
  thresholds = PRESSURE_THRESHOLDS,
) {
  if (!Array.isArray(feeHistogram)) {
    throw new TypeError("feeHistogram must be an array");
  }
  const totals = Object.fromEntries(
    thresholds.map((threshold) => [threshold, 0]),
  );
  for (const entry of feeHistogram) {
    if (
      !Array.isArray(entry) ||
      entry.length < 2 ||
      !Number.isFinite(entry[0]) ||
      !Number.isFinite(entry[1]) ||
      entry[0] < 0 ||
      entry[1] < 0
    ) {
      throw new TypeError(
        "feeHistogram entries must contain non-negative feerate and vsize numbers",
      );
    }
    const [feeRate, vsize] = entry;
    for (const threshold of thresholds) {
      if (feeRate >= threshold) {
        totals[threshold] += vsize;
      }
    }
  }
  return Object.fromEntries(
    Object.entries(totals).map(([threshold, vsize]) => [
      threshold,
      vsizeToVirtualMegabytes(vsize),
    ]),
  );
}
