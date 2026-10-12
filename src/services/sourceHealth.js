import { DEVICE_KEYS } from "../constants.js";

export const DEVICE_SOURCES = Object.freeze({
  [DEVICE_KEYS.FEES]: ["fees", "projectedBlocks"],
  [DEVICE_KEYS.MEMPOOL]: ["mempool"],
  [DEVICE_KEYS.NETWORK]: ["tipHeight", "lastBlock", "difficulty", "hashrate"],
  [DEVICE_KEYS.MARKET]: ["prices"],
  [DEVICE_KEYS.SIMULATOR]: ["fees", "prices"],
});

export function sourceInterval(source, config) {
  if (source === "difficulty") return config.difficulty_poll_seconds;
  if (source === "hashrate") return config.hashrate_poll_seconds;
  return config.fast_poll_seconds;
}

export function isSourceHealthy(source, health, config, now) {
  const status = health.get(source);
  return Boolean(
    status?.success &&
    now - status.updatedAt <= (sourceInterval(source, config) * 2 + 30) * 1000,
  );
}
