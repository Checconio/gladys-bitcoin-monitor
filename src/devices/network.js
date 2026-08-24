import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_FEATURE_UNITS,
} from "@gladysassistant/integration-sdk";
import {
  DEVICE_KEYS,
  DIFFICULTY_PER_TRILLION,
  HASHES_PER_EXAHASH,
  MILLISECONDS_PER_MINUTE,
  getDeviceIds,
} from "../constants.js";
import {
  PUBLICATION_PRECISION,
  roundForPublication,
} from "../calculations/precision.js";
import { numericFeature, stateEntries, textFeature } from "./helpers.js";

export const NETWORK_FEATURES = Object.freeze({
  HEIGHT: "blockchain-height",
  BLOCK_AGE: "last-block-age",
  BLOCK_TX_COUNT: "last-block-transaction-count",
  BLOCK_SIZE: "last-block-size",
  BLOCK_WEIGHT: "last-block-weight",
  DIFFICULTY_CHANGE: "difficulty-adjustment-estimate",
  DIFFICULTY_PROGRESS: "difficulty-progress",
  BLOCKS_UNTIL_ADJUSTMENT: "blocks-until-adjustment",
  AVERAGE_BLOCK_TIME: "average-block-time",
  RETARGET_DATE: "estimated-retarget-date",
  HASHRATE: "network-hashrate",
  DIFFICULTY: "network-difficulty",
});

export function buildNetworkDevice(gladys) {
  const ids = getDeviceIds(gladys, DEVICE_KEYS.NETWORK);
  return {
    name: "Bitcoin Network",
    external_id: ids.device,
    features: [
      numericFeature(ids, NETWORK_FEATURES.HEIGHT, "Blockchain height", {
        category: DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
        type: DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
      }),
      numericFeature(ids, NETWORK_FEATURES.BLOCK_AGE, "Last block age", {
        category: DEVICE_FEATURE_CATEGORIES.DURATION,
        type: DEVICE_FEATURE_TYPES.DURATION.DECIMAL,
        unit: DEVICE_FEATURE_UNITS.MINUTES,
        max: 100_000,
      }),
      numericFeature(
        ids,
        NETWORK_FEATURES.BLOCK_TX_COUNT,
        "Last block transaction count",
        {
          category: DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
          type: DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
        },
      ),
      numericFeature(ids, NETWORK_FEATURES.BLOCK_SIZE, "Last block size", {
        category: DEVICE_FEATURE_CATEGORIES.DATA,
        type: DEVICE_FEATURE_TYPES.DATA.SIZE,
        unit: DEVICE_FEATURE_UNITS.BYTE,
      }),
      numericFeature(
        ids,
        NETWORK_FEATURES.BLOCK_WEIGHT,
        "Last block weight (WU)",
        {
          category: DEVICE_FEATURE_CATEGORIES.DATA,
          type: DEVICE_FEATURE_TYPES.DATA.SIZE,
        },
      ),
      numericFeature(
        ids,
        NETWORK_FEATURES.DIFFICULTY_CHANGE,
        "Difficulty adjustment estimate",
        {
          category: DEVICE_FEATURE_CATEGORIES.LEVEL_SENSOR,
          type: DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
          unit: DEVICE_FEATURE_UNITS.PERCENT,
          min: -100,
          max: 100,
        },
      ),
      numericFeature(
        ids,
        NETWORK_FEATURES.DIFFICULTY_PROGRESS,
        "Difficulty progress",
        {
          category: DEVICE_FEATURE_CATEGORIES.LEVEL_SENSOR,
          type: DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
          unit: DEVICE_FEATURE_UNITS.PERCENT,
          min: 0,
          max: 100,
        },
      ),
      numericFeature(
        ids,
        NETWORK_FEATURES.BLOCKS_UNTIL_ADJUSTMENT,
        "Blocks until adjustment",
        {
          category: DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
          type: DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
          max: 2016,
        },
      ),
      numericFeature(
        ids,
        NETWORK_FEATURES.AVERAGE_BLOCK_TIME,
        "Average block time",
        {
          category: DEVICE_FEATURE_CATEGORIES.DURATION,
          type: DEVICE_FEATURE_TYPES.DURATION.DECIMAL,
          unit: DEVICE_FEATURE_UNITS.MINUTES,
          max: 10_000,
        },
      ),
      textFeature(
        ids,
        NETWORK_FEATURES.RETARGET_DATE,
        "Estimated retarget date",
      ),
      numericFeature(
        ids,
        NETWORK_FEATURES.HASHRATE,
        "Network hashrate (EH/s)",
        {
          category: DEVICE_FEATURE_CATEGORIES.DATARATE,
          type: DEVICE_FEATURE_TYPES.DATARATE.RATE,
          max: 1_000_000,
        },
      ),
      numericFeature(
        ids,
        NETWORK_FEATURES.DIFFICULTY,
        "Network difficulty (T)",
        {
          category: DEVICE_FEATURE_CATEGORIES.LEVEL_SENSOR,
          type: DEVICE_FEATURE_TYPES.SENSOR.DECIMAL,
          max: 1_000_000,
        },
      ),
    ],
  };
}

export function getNetworkStates(gladys, data, nowMs = Date.now()) {
  const entries = [];
  if (Number.isFinite(data.tipHeight)) {
    entries.push({ key: NETWORK_FEATURES.HEIGHT, state: data.tipHeight });
  }
  if (data.lastBlock) {
    entries.push(
      {
        key: NETWORK_FEATURES.BLOCK_AGE,
        state: roundForPublication(
          Math.max(0, (nowMs / 1000 - data.lastBlock.timestamp) / 60),
          PUBLICATION_PRECISION.NETWORK_METRIC,
        ),
      },
      {
        key: NETWORK_FEATURES.BLOCK_TX_COUNT,
        state: data.lastBlock.transactionCount,
      },
      { key: NETWORK_FEATURES.BLOCK_SIZE, state: data.lastBlock.size },
      { key: NETWORK_FEATURES.BLOCK_WEIGHT, state: data.lastBlock.weight },
    );
  }
  if (data.difficulty) {
    entries.push(
      {
        key: NETWORK_FEATURES.DIFFICULTY_CHANGE,
        state: roundForPublication(
          data.difficulty.difficultyChange,
          PUBLICATION_PRECISION.PERCENT,
        ),
      },
      {
        key: NETWORK_FEATURES.DIFFICULTY_PROGRESS,
        state: roundForPublication(
          data.difficulty.progressPercent,
          PUBLICATION_PRECISION.PERCENT,
        ),
      },
      {
        key: NETWORK_FEATURES.BLOCKS_UNTIL_ADJUSTMENT,
        state: data.difficulty.remainingBlocks,
      },
      {
        key: NETWORK_FEATURES.AVERAGE_BLOCK_TIME,
        state: roundForPublication(
          data.difficulty.averageBlockTimeMs / MILLISECONDS_PER_MINUTE,
          PUBLICATION_PRECISION.NETWORK_METRIC,
        ),
      },
      {
        key: NETWORK_FEATURES.RETARGET_DATE,
        text: new Date(data.difficulty.estimatedRetargetDateMs).toISOString(),
      },
    );
  }
  if (data.hashrate) {
    entries.push(
      {
        key: NETWORK_FEATURES.HASHRATE,
        state: roundForPublication(
          data.hashrate.currentHashrate / HASHES_PER_EXAHASH,
          PUBLICATION_PRECISION.NETWORK_METRIC,
        ),
      },
      {
        key: NETWORK_FEATURES.DIFFICULTY,
        state: roundForPublication(
          data.hashrate.currentDifficulty / DIFFICULTY_PER_TRILLION,
          PUBLICATION_PRECISION.NETWORK_METRIC,
        ),
      },
    );
  }
  return stateEntries(gladys, DEVICE_KEYS.NETWORK, entries);
}
