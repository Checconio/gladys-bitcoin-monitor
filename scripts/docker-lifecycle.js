import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { GladysIntegration } from "@gladysassistant/integration-sdk";
import { BitcoinMonitorIntegration } from "../src/integration.js";

assert.equal(process.getuid(), 1000);
const [major, minor, patch] = process.versions.node.split(".").map(Number);
assert.equal(major, 24);
assert.ok(minor > 22 || (minor === 22 && patch >= 1));
assert.ok(process.release.lts);
assert.match(await readFile("/proc/1/comm", "utf8"), /dumb-init/);
const gladys = new GladysIntegration({
  hostApiUrl: "http://127.0.0.1:1443",
  token: "fixture-only",
  selector: "fixture-only",
});
gladys.connect = async () => {};
gladys.disconnect = async () => {};
const app = new BitcoinMonitorIntegration({ gladys });
await app.start();
if (process.argv[2] === "read") {
  assert.equal(app.stateStore.loadedFromDisk, true);
  assert.equal(app.simulatorState.amountBtc, 0.123);
  process.exit(0);
}
app.simulatorState.amountBtc = 0.123;
setInterval(() => {}, 1000);
await writeFile("/data/ready", "ready");
