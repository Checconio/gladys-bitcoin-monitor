import { DEVICE_KEYS, getDeviceIds } from "../constants.js";
import { buildFeesDevice, getFeesStates } from "./fees.js";
import { buildMempoolDevice, getMempoolStates } from "./mempool.js";
import { buildNetworkDevice, getNetworkStates } from "./network.js";
import { buildMarketDevice, getMarketStates } from "./market.js";
import { buildSimulatorDevice, getSimulatorStates } from "./simulator.js";

export const DEVICE_DEFINITIONS = Object.freeze([
  { key: DEVICE_KEYS.FEES, build: buildFeesDevice, states: getFeesStates },
  {
    key: DEVICE_KEYS.MEMPOOL,
    build: buildMempoolDevice,
    states: getMempoolStates,
  },
  {
    key: DEVICE_KEYS.NETWORK,
    build: buildNetworkDevice,
    states: getNetworkStates,
  },
  {
    key: DEVICE_KEYS.MARKET,
    build: buildMarketDevice,
    states: getMarketStates,
  },
  {
    key: DEVICE_KEYS.SIMULATOR,
    build: buildSimulatorDevice,
    states: getSimulatorStates,
  },
]);

export function buildDiscoveredDevices(gladys, config) {
  return DEVICE_DEFINITIONS.map((definition) =>
    definition.build(gladys, config),
  );
}

export function getDeviceKey(gladys, externalId) {
  return DEVICE_DEFINITIONS.find(
    (definition) => getDeviceIds(gladys, definition.key).device === externalId,
  )?.key;
}

export function getStatesForDevice(
  gladys,
  deviceKey,
  data,
  config,
  simulatorState,
  nowMs,
) {
  const definition = DEVICE_DEFINITIONS.find(
    (candidate) => candidate.key === deviceKey,
  );
  if (!definition) return [];
  if (deviceKey === DEVICE_KEYS.NETWORK)
    return definition.states(gladys, data, nowMs);
  if (deviceKey === DEVICE_KEYS.SIMULATOR) {
    return definition.states(gladys, data, config, simulatorState);
  }
  if (deviceKey === DEVICE_KEYS.MARKET)
    return definition.states(gladys, data, config);
  return definition.states(gladys, data);
}
