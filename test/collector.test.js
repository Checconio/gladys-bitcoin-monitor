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

function collectorWith({ client = healthyClient(), registry, now } = {}) {
  const statuses = [];
  const batches = [];
  const transports = [];
  const gladys = {
    externalIds,
    async setConnectionStatus(...args) {
      statuses.push(args);
    },
    async publishStates(states) {
      batches.push(states);
    },
    async publishTransports(entries) {
      transports.push(entries);
    },
  };
  const collector = new Collector({
    gladys,
    client,
    registry: { hasDevice: () => false, hasFeature: () => false, ...registry },
    now,
    config: normalizeConfig(),
    simulatorState: { amountBtc: 0.01, txVsize: 250, priority: "fastest" },
  });
  return { collector, statuses, batches, transports };
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

test("transport follows per-device failures and recovery, and clears degraded status", async () => {
  const client = healthyClient();
  const getFees = client.getPreciseFees;
  const getBlocks = client.getMempoolBlocks;
  const { collector, transports } = collectorWith({
    client,
    registry: {
      hasDevice: (id) => id === "device:fees",
    },
  });
  await collector.collectFast();
  assert.deepEqual(transports.at(-1), [
    { external_id: "device:fees", transport: "cloud" },
  ]);
  await collector.collectFast();
  assert.equal(transports.length, 1);
  client.getMempoolBlocks = async () => {
    throw new Error("offline");
  };
  await collector.collectFast();
  assert.equal(transports.at(-1)[0].degraded, true);
  assert.ok(transports.at(-1)[0].message.fr);
  client.getPreciseFees = async () => {
    throw new Error("offline");
  };
  await collector.collectFast();
  assert.equal(transports.at(-1)[0].transport, "unreachable");
  client.getPreciseFees = getFees;
  client.getMempoolBlocks = getBlocks;
  await collector.collectFast();
  assert.deepEqual(transports.at(-1), [
    { external_id: "device:fees", transport: "cloud" },
  ]);
  collector.resetPublishedCache();
  await collector.publishTransports();
  assert.equal(transports.length, 5);
});

test("unchanged healthy measurements refresh history; failed sources do not get new timestamps", async () => {
  let time = 1_000_000;
  const client = healthyClient();
  const { collector, batches } = collectorWith({
    client,
    now: () => time,
    registry: {
      hasFeature: (id) => id === "device:fees:economy-fee",
    },
  });
  await collector.collectFast();
  time += 60_000;
  await collector.collectFast();
  assert.equal(batches.length, 1);
  time += 300_000;
  await collector.collectFast();
  assert.equal(batches.length, 2);
  const lastFees = collector.data.fees;
  client.getPreciseFees = async () => {
    throw new Error("offline");
  };
  time += 300_000;
  await collector.collectFast({ force: true });
  assert.equal(batches.length, 2);
  assert.equal(collector.data.fees, lastFees);
});

test("transport publish failures are retried without blocking state publication", async () => {
  const { collector, batches, transports } = collectorWith({
    registry: {
      hasDevice: () => true,
      hasFeature: () => true,
    },
  });
  const publish = collector.gladys.publishTransports;
  collector.gladys.publishTransports = async () => {
    throw new Error("host unavailable");
  };
  await collector.collectFast();
  assert.ok(batches.length > 0);
  assert.equal(collector.lastTransports.size, 0);
  collector.gladys.publishTransports = publish;
  await collector.publishTransports();
  assert.equal(transports[0].length, 5);
});

test("expired slow sources are withheld even if fast API requests succeed", async () => {
  let time = 1_000_000;
  const { collector } = collectorWith({ now: () => time });
  collector.data.hashrate = {
    currentHashrate: 100e18,
    currentDifficulty: 1e12,
  };
  collector.sourceHealth.set("hashrate", { success: true, updatedAt: time });
  time += 4_000_000;
  await collector.collectFast();
  assert.equal(collector.publicationData().hashrate, null);
  assert.ok(collector.data.hashrate);
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
