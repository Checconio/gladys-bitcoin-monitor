import assert from "node:assert/strict";
import test from "node:test";
import { normalizeConfig } from "../src/config.js";
import { DEVICE_KEYS } from "../src/constants.js";
import { FEES_FEATURES } from "../src/devices/fees.js";
import { Collector } from "../src/services/collector.js";

function externalIds(_namespace, deviceKey) {
  const device = `device:${deviceKey}`;
  return { device, feature: (key) => `${device}:${key}` };
}

function healthyClient() {
  return {
    async getPreciseFees() {
      return {
        fastestFee: 8,
        halfHourFee: 6,
        hourFee: 4,
        economyFee: 2,
        minimumFee: 1,
      };
    },
    async getMempoolBlocks() {
      return [{ blockSize: 1, blockVSize: 1, nTx: 1, medianFee: 5 }];
    },
    async getMempool() {
      return { count: 1, vsize: 1, totalFee: 1, feeHistogram: [[1, 1]] };
    },
    async getPrices() {
      return { time: 1, EUR: 50_000 };
    },
    async getTipHeight() {
      return 900_000;
    },
    async getBlocksAtHeight() {
      return {
        height: 900_000,
        timestamp: 1_700_000_000,
        transactionCount: 1,
        size: 1,
        weight: 1,
      };
    },
  };
}

function collectorWith({ client = healthyClient(), registry } = {}) {
  const statuses = [];
  const batches = [];
  const gladys = {
    externalIds,
    async setConnectionStatus(...args) {
      statuses.push(args);
    },
    async publishStates(states) {
      batches.push(states);
    },
  };
  const collector = new Collector({
    gladys,
    client,
    registry: registry ?? { hasFeature: () => false },
    config: normalizeConfig(),
    simulatorState: { amountBtc: 0.01, txVsize: 250, priority: "fastest" },
  });
  return { collector, statuses, batches };
}

test("keeps the last valid data and marks the API unavailable after three failed fast cycles", async () => {
  const client = healthyClient();
  const { collector, statuses } = collectorWith({ client });
  assert.equal(await collector.collectFast(), true);
  const lastFees = collector.data.fees;
  const failure = async () => {
    throw new Error("offline");
  };
  client.getPreciseFees = failure;
  client.getMempoolBlocks = failure;
  client.getMempool = failure;
  client.getPrices = failure;
  client.getTipHeight = failure;

  assert.equal(await collector.collectFast(), false);
  assert.equal(await collector.collectFast(), false);
  assert.equal(await collector.collectFast(), false);
  assert.equal(collector.data.fees, lastFees);
  assert.equal(statuses[0][0], true);
  assert.equal(statuses.at(-1)[0], false);
});

test("publishes only states belonging to features the user created", async () => {
  const allowedId = `device:${DEVICE_KEYS.FEES}:${FEES_FEATURES.FASTEST}`;
  const { collector, batches } = collectorWith({
    registry: { hasFeature: (externalId) => externalId === allowedId },
  });
  collector.data.fees = await healthyClient().getPreciseFees();
  assert.equal(await collector.publishDevice(DEVICE_KEYS.FEES), 1);
  assert.deepEqual(batches, [
    [
      {
        device_feature_external_id: allowedId,
        state: 8,
      },
    ],
  ]);
});
