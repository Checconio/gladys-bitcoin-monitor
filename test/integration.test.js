import assert from "node:assert/strict";
import test from "node:test";
import { GladysIntegration } from "@gladysassistant/integration-sdk";
import { BitcoinMonitorIntegration } from "../src/integration.js";
import { buildDiscoveredDevices } from "../src/devices/index.js";

function setup() {
  const gladys = new GladysIntegration({
    hostApiUrl: "http://localhost:1443",
    token: "test",
    selector: "test",
  });
  const app = new BitcoinMonitorIntegration({ gladys });
  app.stateStore.loadedFromDisk = true;
  gladys.getConfig = async () => ({});
  gladys.getDevices = async () => buildDiscoveredDevices(gladys, app.config);
  gladys.publishDiscoveredDevices = async () => {};
  return { gladys, app };
}

test("reconnection during initialization resyncs again and starts only the current scheduler", async () => {
  const { app } = setup();
  let release;
  let entered;
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  const started = new Promise((resolve) => {
    entered = resolve;
  });
  let calls = 0;
  app.collector.collectAll = async () => {
    calls += 1;
    if (calls === 1) {
      entered();
      await blocked;
    }
  };
  app.connectionGeneration = 1;
  const first = app.initializeAfterConnection(1);
  await started;
  app.connectionGeneration = 2;
  const second = app.initializeAfterConnection(2);
  release();
  try {
    await Promise.all([first, second]);
    assert.equal(calls, 2);
    assert.equal(app.scheduler.timers.size, 3);
    assert.equal(app.connectedInitialization, null);
  } finally {
    await app.scheduler.stop();
  }
});

test("disconnect while scheduler waits for an active poll prevents restart", async () => {
  const { app } = setup();
  let release;
  const active = new Promise((resolve) => {
    release = resolve;
  });
  app.scheduler.active.add(active);
  const starting = app.startScheduler();
  app.connectionGeneration += 1;
  release();
  await starting;
  assert.equal(app.scheduler.timers.size, 0);
});

test("transport entries pass through the real SDK mapper with only created device IDs", async () => {
  const { app, gladys } = setup();
  const devices = buildDiscoveredDevices(gladys, app.config);
  app.registry.sync([devices[0]]);
  const calls = [];
  gladys.httpClient.post = async (path, body) => {
    calls.push({ path, body });
    return { success: true };
  };
  app.collector.sourceHealth.set("fees", {
    success: true,
    updatedAt: Date.now(),
  });
  await app.collector.publishTransports();
  assert.equal(calls[0].path, "/device/transport");
  assert.deepEqual(
    calls[0].body.transports.map((entry) => entry.device_external_id),
    [devices[0].external_id],
  );
  assert.equal(calls[0].body.transports[0].degraded, true);
  app.collector.sourceHealth.set("projectedBlocks", {
    success: true,
    updatedAt: Date.now(),
  });
  await app.collector.publishTransports();
  assert.deepEqual(calls[1].body.transports, [
    { device_external_id: devices[0].external_id, transport: "cloud" },
  ]);
});
