import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifestUrl = new URL(
  "../gladys-assistant-integration.json",
  import.meta.url,
);
const packageUrl = new URL("../package.json", import.meta.url);

test("keeps simulator inputs and release versions coherent in the manifest", async () => {
  const manifestSource = await readFile(manifestUrl, "utf8");
  const manifest = JSON.parse(manifestSource);
  const packageJson = JSON.parse(await readFile(packageUrl, "utf8"));
  const simulatorAction = manifest.actions.find(
    (action) => action.key === "update_simulator",
  );

  assert.equal(manifestSource.includes('"default_transfer_btc"'), false);
  assert.deepEqual(
    simulatorAction.fields.map((field) => field.key),
    ["tx_vsize", "priority"],
  );
  assert.equal(manifest.version, packageJson.version);
  assert.equal(
    manifest.docker_image,
    `ghcr.io/checconio/gladys-bitcoin-monitor:${manifest.version}`,
  );
});
