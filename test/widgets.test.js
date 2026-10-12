import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  GladysIntegration,
  validateWidgetContent,
} from "@gladysassistant/integration-sdk";
import { BitcoinMonitorIntegration } from "../src/integration.js";
import { buildDiscoveredDevices } from "../src/devices/index.js";
import { buildWidget, CHARTS, WIDGET_KEYS } from "../src/widgets.js";

function appWithData() {
  const gladys = new GladysIntegration({
    hostApiUrl: "http://localhost:1443",
    token: "test",
    selector: "test",
  });
  const app = new BitcoinMonitorIntegration({ gladys });
  app.registry.sync(buildDiscoveredDevices(gladys, app.config));
  app.collector.data.fees = {
    fastestFee: 1.51,
    halfHourFee: 0.9,
    hourFee: 0.4,
    economyFee: 0.2,
    minimumFee: 0.1,
  };
  app.collector.data.prices = { EUR: 74600, CHF: 70000 };
  app.collector.data.projectedBlocks = [
    { medianFee: 1, nTx: 1, blockVSize: 1 },
    { medianFee: 0.5 },
    { medianFee: 0.2 },
  ];
  return app;
}

test("all declared widget variants fit the published SDK vocabulary and content budgets", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../gladys-assistant-integration.json", import.meta.url),
    ),
  );
  assert.deepEqual(
    manifest.widgets.map((widget) => widget.key),
    WIDGET_KEYS,
  );
  assert.deepEqual(manifest.transports, ["cloud"]);
  assert.equal(manifest.gladys_version, ">=5.1.0");
  const app = appWithData();
  const cases = [
    ["fees", {}],
    ["fees", { view: "current" }],
    ["simulator", {}],
    ["simulator", { view: "comparison" }],
    ["network", {}],
    ["mining", {}],
    ...Object.keys(CHARTS).map((metric) => ["history", { metric }]),
  ];
  for (const currency of ["EUR", "CHF"]) {
    app.config.currency = currency;
    for (const [key, settings] of cases) {
      assert.deepEqual(
        validateWidgetContent(buildWidget(app, key, { settings })),
        [],
        `${key}/${JSON.stringify(settings)}`,
      );
    }
  }
  app.collector.data = {};
  app.registry.sync([]);
  for (const [key, settings] of cases) {
    assert.deepEqual(
      validateWidgetContent(buildWidget(app, key, { settings })),
      [],
      `empty ${key}`,
    );
  }
});

test("six charts reference existing features and preserve the screenshot time windows", () => {
  const app = appWithData();
  for (const [metric, preset] of Object.entries(CHARTS)) {
    const chart = buildWidget(app, "history", { settings: { metric } })
      .components[0];
    assert.equal(chart.type, "chart");
    assert.equal(chart.interval, preset.interval);
    assert.ok(chart.device_features.every((id) => app.registry.hasFeature(id)));
    assert.ok(chart.device_features.length <= 4);
  }
  assert.equal(
    buildWidget(app, "history", {
      settings: { metric: "price", interval: "last-month" },
    }).components[0].interval,
    "last-month",
  );
  app.registry.sync([]);
  assert.equal(buildWidget(app, "history").components[0].type, "text");
});

test("SDK widget handler applies explicit inputs only on action, validates and persists before publication", async () => {
  const app = appWithData();
  app.registerHandlers();
  const calls = [];
  app.stateStore.save = async (state) => calls.push(["save", state]);
  app.collector.publishSimulator = async () => calls.push(["publish"]);
  const settings = { amount_btc: 0.03, tx_vsize: 300, priority: "economy" };
  const get = app.gladys.handlers["widget:simulator"];
  const action = app.gladys.handlers["widgetAction:simulator"];
  get({ settings });
  assert.equal(app.simulatorState.amountBtc, 0.01);
  await action("apply_settings", {}, { settings });
  assert.deepEqual(app.simulatorState, {
    amountBtc: 0.03,
    txVsize: 300,
    priority: "economy",
  });
  assert.deepEqual(
    calls.map(([name]) => name),
    ["save", "publish"],
  );
  await assert.rejects(
    action(
      "apply_settings",
      {},
      { settings: { ...settings, tx_vsize: 250.5 } },
    ),
    /integer/,
  );
  await assert.rejects(action("apply_settings", {}, {}), /Configure/);
  await assert.rejects(action("unknown", {}, { settings }), /Unsupported/);
  app.stateStore.save = async () => {
    throw new Error("disk full");
  };
  await assert.rejects(
    action("apply_settings", {}, { settings: { ...settings, amount_btc: 1 } }),
    /disk full/,
  );
  assert.equal(app.simulatorState.amountBtc, 0.03);
});

test("unavailable data and zero amounts are not displayed as fresh zero-cost estimates", () => {
  const app = appWithData();
  app.collector.sourceHealth.set("fees", {
    success: false,
    updatedAt: Date.now(),
  });
  const fees = buildWidget(app, "fees", { settings: { view: "current" } });
  assert.equal(fees.components[1].value.fr, "Indisponible");
  app.simulatorState.amountBtc = 0;
  const simulation = buildWidget(app, "simulator");
  assert.equal(simulation.components[4].value.fr, "Indisponible");
  assert.equal(simulation.components[5].value, "—");
});

test("a failed projected congestion source cannot produce a favorable opportunity score", () => {
  const app = appWithData();
  app.collector.sourceHealth.set("projectedBlocks", {
    success: false,
    updatedAt: Date.now(),
  });
  const opportunity = buildWidget(app, "fees");
  assert.equal(opportunity.components[1].value.fr, "Indisponible");
  assert.equal(
    buildWidget(app, "fees", { settings: { view: "current" } }).components[1]
      .value,
    0.2,
  );
});
