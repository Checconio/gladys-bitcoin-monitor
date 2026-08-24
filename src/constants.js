export const INTEGRATION_NAME = "Bitcoin Monitor";
export const INTEGRATION_VERSION = "1.0.0";
export const DATA_DIRECTORY = process.env.DATA_DIRECTORY || "/data";
export const MEMPOOL_API_BASE_URL = "https://mempool.space";

export const DEVICE_NAMESPACE = "bitcoin-monitor";

export const DEVICE_KEYS = Object.freeze({
  FEES: "fees",
  MEMPOOL: "mempool",
  NETWORK: "network",
  MARKET: "market",
  SIMULATOR: "simulator",
});

export const PRIORITIES = Object.freeze({
  FASTEST: "fastest",
  HALF_HOUR: "half_hour",
  HOUR: "hour",
  ECONOMY: "economy",
});

export const PRIORITY_OPTIONS = Object.freeze([
  { value: PRIORITIES.FASTEST, label: "Fastest", sort_order: 0 },
  { value: PRIORITIES.HALF_HOUR, label: "30 minutes", sort_order: 1 },
  { value: PRIORITIES.HOUR, label: "1 hour", sort_order: 2 },
  { value: PRIORITIES.ECONOMY, label: "Economy", sort_order: 3 },
]);

export const SATOSHIS_PER_BITCOIN = 100_000_000;
export const DEFAULT_TRANSFER_BTC = 0.01;
export const VBYTES_PER_VIRTUAL_MEGABYTE = 1_000_000;
export const HASHES_PER_EXAHASH = 1e18;
export const DIFFICULTY_PER_TRILLION = 1e12;
export const MILLISECONDS_PER_MINUTE = 60_000;

export function getDeviceIds(gladys, deviceKey) {
  return gladys.externalIds(DEVICE_NAMESPACE, deviceKey);
}
