import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from "@gladysassistant/integration-sdk";
import { getGladysCurrencyUnit } from "../config.js";
import {
  simulatePriorities,
  formatSimulationSummary,
} from "../calculations/simulator.js";
import {
  DEVICE_KEYS,
  PRIORITIES,
  PRIORITY_OPTIONS,
  getDeviceIds,
} from "../constants.js";
import {
  fiatFeatureName,
  numericFeature,
  stateEntries,
  textFeature,
} from "./helpers.js";

export const SIMULATOR_FEATURES = Object.freeze({
  AMOUNT: "transfer-amount",
  VSIZE: "transaction-vsize",
  PRIORITY: "priority",
  TRANSFER_FIAT: "transfer-value-fiat",
  SELECTED_RATE: "selected-fee-rate",
  SELECTED_SATS: "selected-fee-sats",
  SELECTED_BTC: "selected-fee-btc",
  SELECTED_FIAT: "selected-fee-fiat",
  SELECTED_PERCENT: "selected-fee-percentage",
  FASTEST_FIAT: "fastest-fee-fiat",
  HALF_HOUR_FIAT: "half-hour-fee-fiat",
  HOUR_FIAT: "hour-fee-fiat",
  ECONOMY_FIAT: "economy-fee-fiat",
  SUMMARY: "simulation-summary",
});

export function buildSimulatorDevice(gladys, config) {
  const ids = getDeviceIds(gladys, DEVICE_KEYS.SIMULATOR);
  const fiatUnit = getGladysCurrencyUnit(config.currency);
  const fiat = (key, name) =>
    numericFeature(ids, key, fiatFeatureName(name, config.currency, fiatUnit), {
      category: DEVICE_FEATURE_CATEGORIES.CURRENCY,
      type: DEVICE_FEATURE_TYPES.CURRENCY.DECIMAL,
      unit: fiatUnit,
      max: 1e15,
    });
  return {
    name: "Bitcoin Transaction Simulator",
    external_id: ids.device,
    features: [
      // Gladys 4.86 has no generic numeric input widget for sensor/decimal.
      // These values are edited through the official update_simulator action.
      numericFeature(ids, SIMULATOR_FEATURES.AMOUNT, "Transfer amount", {
        category: DEVICE_FEATURE_CATEGORIES.CURRENCY,
        type: DEVICE_FEATURE_TYPES.CURRENCY.DECIMAL,
        unit: DEVICE_FEATURE_UNITS.BITCOIN,
        max: 21_000_000,
      }),
      numericFeature(ids, SIMULATOR_FEATURES.VSIZE, "Transaction vSize (vB)", {
        min: 50,
        max: 10_000,
      }),
      textFeature(ids, SIMULATOR_FEATURES.PRIORITY, "Priority", {
        readOnly: false,
        supportedOptions: PRIORITY_OPTIONS,
      }),
      fiat(SIMULATOR_FEATURES.TRANSFER_FIAT, "Transfer value"),
      numericFeature(
        ids,
        SIMULATOR_FEATURES.SELECTED_RATE,
        "Selected fee rate (sat/vB)",
        {
          max: 1_000_000,
        },
      ),
      numericFeature(
        ids,
        SIMULATOR_FEATURES.SELECTED_SATS,
        "Selected fee (sats)",
        {
          category: DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
          type: DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
        },
      ),
      numericFeature(ids, SIMULATOR_FEATURES.SELECTED_BTC, "Selected fee", {
        category: DEVICE_FEATURE_CATEGORIES.CURRENCY,
        type: DEVICE_FEATURE_TYPES.CURRENCY.DECIMAL,
        unit: DEVICE_FEATURE_UNITS.BITCOIN,
        max: 21_000_000,
      }),
      fiat(SIMULATOR_FEATURES.SELECTED_FIAT, "Selected fee"),
      numericFeature(
        ids,
        SIMULATOR_FEATURES.SELECTED_PERCENT,
        "Selected fee percentage",
        {
          unit: DEVICE_FEATURE_UNITS.PERCENT,
          max: 1e12,
        },
      ),
      fiat(SIMULATOR_FEATURES.FASTEST_FIAT, "Fastest fee"),
      fiat(SIMULATOR_FEATURES.HALF_HOUR_FIAT, "30 min fee"),
      fiat(SIMULATOR_FEATURES.HOUR_FIAT, "1 hour fee"),
      fiat(SIMULATOR_FEATURES.ECONOMY_FIAT, "Economy fee"),
      textFeature(ids, SIMULATOR_FEATURES.SUMMARY, "Simulation summary"),
    ],
  };
}

export function getSimulatorStates(gladys, data, config, simulatorState) {
  const entries = [
    { key: SIMULATOR_FEATURES.AMOUNT, state: simulatorState.amountBtc },
    { key: SIMULATOR_FEATURES.VSIZE, state: simulatorState.txVsize },
    { key: SIMULATOR_FEATURES.PRIORITY, text: simulatorState.priority },
  ];
  const price = data.prices?.[config.currency];
  if (!data.fees || !Number.isFinite(price)) {
    return stateEntries(gladys, DEVICE_KEYS.SIMULATOR, entries);
  }
  const simulation = simulatePriorities({
    amountBtc: simulatorState.amountBtc,
    txVsize: simulatorState.txVsize,
    priority: simulatorState.priority,
    fees: data.fees,
    btcFiatPrice: price,
  });
  const selected = simulation.selected;
  entries.push(
    {
      key: SIMULATOR_FEATURES.TRANSFER_FIAT,
      state: selected.transferValueFiat,
    },
    { key: SIMULATOR_FEATURES.SELECTED_RATE, state: selected.feeRate },
    { key: SIMULATOR_FEATURES.SELECTED_SATS, state: selected.feeSats },
    { key: SIMULATOR_FEATURES.SELECTED_BTC, state: selected.feeBtc },
    { key: SIMULATOR_FEATURES.SELECTED_FIAT, state: selected.feeFiat },
    {
      key: SIMULATOR_FEATURES.SELECTED_PERCENT,
      state: selected.feePercent ?? 0,
    },
    {
      key: SIMULATOR_FEATURES.FASTEST_FIAT,
      state: simulation.priorities[PRIORITIES.FASTEST].feeFiat,
    },
    {
      key: SIMULATOR_FEATURES.HALF_HOUR_FIAT,
      state: simulation.priorities[PRIORITIES.HALF_HOUR].feeFiat,
    },
    {
      key: SIMULATOR_FEATURES.HOUR_FIAT,
      state: simulation.priorities[PRIORITIES.HOUR].feeFiat,
    },
    {
      key: SIMULATOR_FEATURES.ECONOMY_FIAT,
      state: simulation.priorities[PRIORITIES.ECONOMY].feeFiat,
    },
    {
      key: SIMULATOR_FEATURES.SUMMARY,
      text: formatSimulationSummary({
        state: simulatorState,
        simulation,
        currency: config.currency,
      }),
    },
  );
  return stateEntries(gladys, DEVICE_KEYS.SIMULATOR, entries);
}
