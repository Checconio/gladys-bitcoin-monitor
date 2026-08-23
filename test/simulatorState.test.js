import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { SimulatorStateStore } from "../src/services/simulatorState.js";

const defaults = { amountBtc: 0.01, txVsize: 250, priority: "fastest" };

test("persists and reloads simulator state atomically", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "bitcoin-monitor-state-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const store = new SimulatorStateStore({ directory });
  assert.deepEqual(await store.load(defaults), defaults);
  await store.save({ amountBtc: 0.5, txVsize: 400, priority: "economy" });
  assert.deepEqual(
    JSON.parse(await readFile(join(directory, "simulator-state.json"), "utf8")),
    {
      amountBtc: 0.5,
      txVsize: 400,
      priority: "economy",
    },
  );
  assert.deepEqual(await store.load(defaults), {
    amountBtc: 0.5,
    txVsize: 400,
    priority: "economy",
  });
});

test("corrupt persistence never prevents startup", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "bitcoin-monitor-state-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(join(directory, "simulator-state.json"), "{broken", "utf8");
  const store = new SimulatorStateStore({ directory });
  assert.deepEqual(await store.load(defaults), defaults);
  assert.equal(store.loadedFromDisk, false);
});

test("reports a persistence failure instead of claiming a saved state", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "bitcoin-monitor-state-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const blockedPath = join(directory, "not-a-directory");
  await writeFile(blockedPath, "file", "utf8");
  const store = new SimulatorStateStore({ directory: blockedPath });
  await assert.rejects(store.save(defaults));
});
