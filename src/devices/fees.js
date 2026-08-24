import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
} from "@gladysassistant/integration-sdk";
import { calculateStorageOpportunity } from "../calculations/advice.js";
import { calculateFastEconomySpread } from "../calculations/fees.js";
import { DEVICE_KEYS, getDeviceIds } from "../constants.js";
import { numericFeature, stateEntries, textFeature } from "./helpers.js";

export const FEES_FEATURES = Object.freeze({
  FASTEST: "fastest-fee",
  HALF_HOUR: "half-hour-fee",
  HOUR: "hour-fee",
  ECONOMY: "economy-fee",
  MINIMUM: "minimum-fee",
  BLOCK_1_MEDIAN: "projected-block-1-median",
  BLOCK_2_MEDIAN: "projected-block-2-median",
  BLOCK_3_MEDIAN: "projected-block-3-median",
  BLOCK_1_TX_COUNT: "projected-block-1-transaction-count",
  BLOCK_1_VSIZE: "projected-block-1-vsize",
  SPREAD: "fast-economy-spread",
  OPPORTUNITY_SCORE: "storage-opportunity-score",
  OPPORTUNITY_ADVICE: "storage-opportunity-advice",
});

const feeFeature = (ids, key, name) =>
  numericFeature(ids, key, `${name} (sat/vB)`, {
    category: DEVICE_FEATURE_CATEGORIES.CURRENCY,
    type: DEVICE_FEATURE_TYPES.CURRENCY.DECIMAL,
    max: 1_000_000,
  });

export function buildFeesDevice(gladys) {
  const ids = getDeviceIds(gladys, DEVICE_KEYS.FEES);
  return {
    name: "Bitcoin Fees",
    external_id: ids.device,
    features: [
      feeFeature(ids, FEES_FEATURES.FASTEST, "Fastest fee"),
      feeFeature(ids, FEES_FEATURES.HALF_HOUR, "30 min fee"),
      feeFeature(ids, FEES_FEATURES.HOUR, "1 hour fee"),
      feeFeature(ids, FEES_FEATURES.ECONOMY, "Economy fee"),
      feeFeature(ids, FEES_FEATURES.MINIMUM, "Minimum fee"),
      feeFeature(
        ids,
        FEES_FEATURES.BLOCK_1_MEDIAN,
        "Projected block 1 median fee",
      ),
      feeFeature(
        ids,
        FEES_FEATURES.BLOCK_2_MEDIAN,
        "Projected block 2 median fee",
      ),
      feeFeature(
        ids,
        FEES_FEATURES.BLOCK_3_MEDIAN,
        "Projected block 3 median fee",
      ),
      numericFeature(
        ids,
        FEES_FEATURES.BLOCK_1_TX_COUNT,
        "Projected block 1 transaction count",
        {
          category: DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
          type: DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
        },
      ),
      numericFeature(
        ids,
        FEES_FEATURES.BLOCK_1_VSIZE,
        "Projected block 1 virtual size (vB)",
        {
          category: DEVICE_FEATURE_CATEGORIES.DATA,
          type: DEVICE_FEATURE_TYPES.DATA.SIZE,
        },
      ),
      feeFeature(ids, FEES_FEATURES.SPREAD, "Fast/economy spread"),
      numericFeature(
        ids,
        FEES_FEATURES.OPPORTUNITY_SCORE,
        "Storage opportunity score",
        {
          category: DEVICE_FEATURE_CATEGORIES.RISK,
          type: DEVICE_FEATURE_TYPES.RISK.INTEGER,
          min: 0,
          max: 5,
        },
      ),
      textFeature(
        ids,
        FEES_FEATURES.OPPORTUNITY_ADVICE,
        "Storage opportunity advice",
      ),
    ],
  };
}

export function getFeesStates(gladys, data) {
  if (!data.fees) return [];
  const blocks = data.projectedBlocks ?? [];
  const block2Median = blocks[1]?.medianFee;
  const advice = calculateStorageOpportunity(
    data.fees.economyFee,
    block2Median,
  );
  const entries = [
    { key: FEES_FEATURES.FASTEST, state: data.fees.fastestFee },
    { key: FEES_FEATURES.HALF_HOUR, state: data.fees.halfHourFee },
    { key: FEES_FEATURES.HOUR, state: data.fees.hourFee },
    { key: FEES_FEATURES.ECONOMY, state: data.fees.economyFee },
    { key: FEES_FEATURES.MINIMUM, state: data.fees.minimumFee },
    { key: FEES_FEATURES.SPREAD, state: calculateFastEconomySpread(data.fees) },
    { key: FEES_FEATURES.OPPORTUNITY_SCORE, state: advice.score },
    { key: FEES_FEATURES.OPPORTUNITY_ADVICE, text: advice.text },
  ];
  [
    FEES_FEATURES.BLOCK_1_MEDIAN,
    FEES_FEATURES.BLOCK_2_MEDIAN,
    FEES_FEATURES.BLOCK_3_MEDIAN,
  ].forEach((key, index) => {
    if (blocks[index]) entries.push({ key, state: blocks[index].medianFee });
  });
  if (blocks[0]) {
    entries.push(
      { key: FEES_FEATURES.BLOCK_1_TX_COUNT, state: blocks[0].nTx },
      { key: FEES_FEATURES.BLOCK_1_VSIZE, state: blocks[0].blockVSize },
    );
  }
  return stateEntries(gladys, DEVICE_KEYS.FEES, entries);
}
