import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
} from "@gladysassistant/integration-sdk";
import {
  aggregateFeeHistogram,
  vsizeToVirtualMegabytes,
} from "../calculations/mempool.js";
import {
  PUBLICATION_PRECISION,
  roundForPublication,
} from "../calculations/precision.js";
import { DEVICE_KEYS, getDeviceIds } from "../constants.js";
import { numericFeature, stateEntries } from "./helpers.js";

export const MEMPOOL_FEATURES = Object.freeze({
  COUNT: "unconfirmed-transactions",
  BACKLOG: "mempool-backlog",
  TOTAL_FEES: "total-mempool-fees",
  GE_1: "backlog-ge-1",
  GE_2: "backlog-ge-2",
  GE_5: "backlog-ge-5",
  GE_10: "backlog-ge-10",
});

export function buildMempoolDevice(gladys) {
  const ids = getDeviceIds(gladys, DEVICE_KEYS.MEMPOOL);
  const backlog = (key, name) =>
    numericFeature(ids, key, `${name} (vMB)`, {
      category: DEVICE_FEATURE_CATEGORIES.DATA,
      type: DEVICE_FEATURE_TYPES.DATA.SIZE,
      max: 1_000_000,
    });
  return {
    name: "Bitcoin Mempool",
    external_id: ids.device,
    features: [
      numericFeature(ids, MEMPOOL_FEATURES.COUNT, "Unconfirmed transactions", {
        category: DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
        type: DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
      }),
      backlog(MEMPOOL_FEATURES.BACKLOG, "Mempool backlog"),
      numericFeature(
        ids,
        MEMPOOL_FEATURES.TOTAL_FEES,
        "Total mempool fees (sats)",
        {
          category: DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR,
          type: DEVICE_FEATURE_TYPES.SENSOR.INTEGER,
        },
      ),
      backlog(MEMPOOL_FEATURES.GE_1, "Backlog >= 1 sat/vB"),
      backlog(MEMPOOL_FEATURES.GE_2, "Backlog >= 2 sat/vB"),
      backlog(MEMPOOL_FEATURES.GE_5, "Backlog >= 5 sat/vB"),
      backlog(MEMPOOL_FEATURES.GE_10, "Backlog >= 10 sat/vB"),
    ],
  };
}

export function getMempoolStates(gladys, data) {
  if (!data.mempool) return [];
  const pressure = aggregateFeeHistogram(data.mempool.feeHistogram);
  return stateEntries(gladys, DEVICE_KEYS.MEMPOOL, [
    { key: MEMPOOL_FEATURES.COUNT, state: data.mempool.count },
    {
      key: MEMPOOL_FEATURES.BACKLOG,
      state: roundForPublication(
        vsizeToVirtualMegabytes(data.mempool.vsize),
        PUBLICATION_PRECISION.VIRTUAL_MEGABYTES,
      ),
    },
    {
      key: MEMPOOL_FEATURES.TOTAL_FEES,
      state: Math.round(data.mempool.totalFee),
    },
    {
      key: MEMPOOL_FEATURES.GE_1,
      state: roundForPublication(
        pressure[1],
        PUBLICATION_PRECISION.VIRTUAL_MEGABYTES,
      ),
    },
    {
      key: MEMPOOL_FEATURES.GE_2,
      state: roundForPublication(
        pressure[2],
        PUBLICATION_PRECISION.VIRTUAL_MEGABYTES,
      ),
    },
    {
      key: MEMPOOL_FEATURES.GE_5,
      state: roundForPublication(
        pressure[5],
        PUBLICATION_PRECISION.VIRTUAL_MEGABYTES,
      ),
    },
    {
      key: MEMPOOL_FEATURES.GE_10,
      state: roundForPublication(
        pressure[10],
        PUBLICATION_PRECISION.VIRTUAL_MEGABYTES,
      ),
    },
  ]);
}
