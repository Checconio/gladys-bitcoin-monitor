import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from "@gladysassistant/integration-sdk";
import { getGladysCurrencyUnit } from "../config.js";
import {
  PUBLICATION_PRECISION,
  roundForPublication,
} from "../calculations/precision.js";
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
      // Gladys routes writable numeric setpoints to its dashboard number input.
      numericFeature(ids, SIMULATOR_FEATURES.AMOUNT, "Transfer amount (BTC)", {
        category: DEVICE_FEATURE_CATEGORIES.SWITCH,
        type: DEVICE_FEATURE_TYPES.SWITCH.TARGET_CURRENT,
        unit: DEVICE_FEATURE_UNITS.BITCOIN,
        step: 0.00000001,
        readOnly: false,
        max: 21_000_000,
      }),
      numericFeature(ids, SIMULATOR_FEATURES.VSIZE, "Transaction vSize (vB)", {
        category: DEVICE_FEATURE_CATEGORIES.DATA,
        type: DEVICE_FEATURE_TYPES.DATA.SIZE,
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
          category: DEVICE_FEATURE_CATEGORIES.DATARATE,
          type: DEVICE_FEATURE_TYPES.DATARATE.RATE,
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
          category: DEVICE_FEATURE_CATEGORIES.LEVEL_SENSOR,
          type: DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
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
    {
      key: SIMULATOR_FEATURES.AMOUNT,
      state: roundForPublication(
        simulatorState.amountBtc,
        PUBLICATION_PRECISION.BITCOIN,
      ),
    },
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
      state: roundForPublication(
        selected.transferValueFiat,
        PUBLICATION_PRECISION.FIAT_VALUE,
      ),
    },
    {
      key: SIMULATOR_FEATURES.SELECTED_RATE,
      state: roundForPublication(
        selected.feeRate,
        PUBLICATION_PRECISION.FEE_RATE,
      ),
    },
    { key: SIMULATOR_FEATURES.SELECTED_SATS, state: selected.feeSats },
    {
      key: SIMULATOR_FEATURES.SELECTED_BTC,
      state: roundForPublication(
        selected.feeBtc,
        PUBLICATION_PRECISION.BITCOIN,
      ),
    },
    {
      key: SIMULATOR_FEATURES.SELECTED_FIAT,
      state: roundForPublication(
        selected.feeFiat,
        PUBLICATION_PRECISION.FIAT_FEE,
      ),
    },
    {
      key: SIMULATOR_FEATURES.SELECTED_PERCENT,
      state: roundForPublication(
        selected.feePercent ?? 0,
        PUBLICATION_PRECISION.PERCENT,
      ),
    },
    {
      key: SIMULATOR_FEATURES.FASTEST_FIAT,
      state: roundForPublication(
        simulation.priorities[PRIORITIES.FASTEST].feeFiat,
        PUBLICATION_PRECISION.FIAT_FEE,
      ),
    },
    {
      key: SIMULATOR_FEATURES.HALF_HOUR_FIAT,
      state: roundForPublication(
        simulation.priorities[PRIORITIES.HALF_HOUR].feeFiat,
        PUBLICATION_PRECISION.FIAT_FEE,
      ),
    },
    {
      key: SIMULATOR_FEATURES.HOUR_FIAT,
      state: roundForPublication(
        simulation.priorities[PRIORITIES.HOUR].feeFiat,
        PUBLICATION_PRECISION.FIAT_FEE,
      ),
    },
    {
      key: SIMULATOR_FEATURES.ECONOMY_FIAT,
      state: roundForPublication(
        simulation.priorities[PRIORITIES.ECONOMY].feeFiat,
        PUBLICATION_PRECISION.FIAT_FEE,
      ),
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
