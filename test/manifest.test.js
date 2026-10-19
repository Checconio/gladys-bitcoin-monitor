import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const manifestUrl = new URL(
  "../gladys-assistant-integration.json",
  import.meta.url,
);
const packageUrl = new URL("../package.json", import.meta.url);

test("keeps every localized widget label within the catalog limit", async (t) => {
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));

  for (const [index, widget] of manifest.widgets.entries()) {
    const languages = new Set(["en", "fr", ...Object.keys(widget.label ?? {})]);
    for (const language of languages) {
      const path = `widgets[${index}] (${widget.key}).label.${language}`;
      await t.test(path, () => {
        const label = widget.label?.[language];
        assert.equal(typeof label, "string", `${path} must be a string`);
        assert.ok(label.trim().length > 0, `${path} must not be empty`);
        const length = [...label].length;
        assert.ok(
          length <= 30,
          `${path} must have at most 30 Unicode code points (received ${length})`,
        );
      });
    }
  }
});

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
