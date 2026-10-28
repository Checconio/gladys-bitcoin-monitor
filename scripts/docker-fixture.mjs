import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { GladysIntegration } from "@gladysassistant/integration-sdk";
import { BitcoinMonitorIntegration } from "./src/integration.js";

assert.equal(process.getuid(), 1000);
assert.equal(process.versions.node, "24.22.1");
assert.ok(process.release.lts);
assert.equal((await readFile("/proc/1/comm", "utf8")).trim(), "dumb-init");
const gladys = new GladysIntegration({
  hostApiUrl: "http://127.0.0.1:1",
  token: "fixture",
  selector: "fixture",
});
// Exercise the real SDK shutdown handlers without opening any connection.
gladys.connect = async () => {};
gladys.disconnect = async () => {};
const app = new BitcoinMonitorIntegration({ gladys });
await app.start();
if (process.argv[2] === "read") {
  assert.equal(app.stateStore.loadedFromDisk, true);
  assert.equal(app.simulatorState.amountBtc, Number(process.argv[3]));
  process.exit(0);
}
app.simulatorState.amountBtc = Number(process.argv[3]);
await app.startScheduler();
setInterval(() => {}, 1000);
process.stdout.write("FIXTURE_READY\n");
