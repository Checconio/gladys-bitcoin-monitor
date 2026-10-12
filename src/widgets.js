import { WIDGET_CHART_INTERVALS } from "@gladysassistant/integration-sdk";
import { DEVICE_KEYS as D, getDeviceIds } from "./constants.js";
import { getStatesForDevice } from "./devices/index.js";
import { FEES_FEATURES as F } from "./devices/fees.js";
import { MEMPOOL_FEATURES as M } from "./devices/mempool.js";
import { NETWORK_FEATURES as N } from "./devices/network.js";
import { MARKET_FEATURES } from "./devices/market.js";
import { SIMULATOR_FEATURES as S } from "./devices/simulator.js";

export const WIDGET_KEYS = [
  "fees",
  "simulator",
  "network",
  "mining",
  "history",
];
const text = (en, fr) => ({ en, fr });
const heading = (en, fr) => ({
  type: "text",
  variant: "heading",
  text: text(en, fr),
});
const unknown = text("Unavailable", "Indisponible");

export const CHARTS = {
  fees: {
    title: text("Bitcoin fees", "Frais Bitcoin"),
    device: D.FEES,
    features: [F.ECONOMY, F.HOUR, F.HALF_HOUR, F.FASTEST],
    unit: "sat/vB",
    interval: "last-day",
  },
  projected: {
    title: text("Projected blocks", "Blocs projetés"),
    device: D.FEES,
    features: [F.BLOCK_1_MEDIAN, F.BLOCK_2_MEDIAN, F.BLOCK_3_MEDIAN],
    unit: "sat/vB",
    interval: "last-twelve-hours",
  },
  cost: {
    title: text("Transaction cost", "Coût transaction"),
    device: D.SIMULATOR,
    features: [S.ECONOMY_FIAT, S.HOUR_FIAT, S.HALF_HOUR_FIAT, S.FASTEST_FIAT],
    interval: "last-day",
  },
  price: {
    title: text("Bitcoin price", "Prix Bitcoin"),
    device: D.MARKET,
    features: [MARKET_FEATURES.PRICE],
    interval: "last-week",
  },
  pressure: {
    title: text("Fee pressure", "Pression sur les frais"),
    device: D.MEMPOOL,
    features: [M.GE_1, M.GE_2, M.GE_5, M.GE_10],
    unit: "vMB",
    interval: "last-day",
  },
  blocks: {
    title: text("Block timing", "Rythme des blocs"),
    device: D.NETWORK,
    features: [N.BLOCK_AGE, N.AVERAGE_BLOCK_TIME],
    unit: "min",
    interval: "last-day",
  },
};

const priorities = {
  fastest: text("Fastest", "Rapide"),
  half_hour: text("30 minutes", "30 minutes"),
  hour: text("1 hour", "1 heure"),
  economy: text("Economy", "Économique"),
};

// Read only from the collector: opening several dashboards never adds API polling.
export function buildWidget(app, key, { settings = {} } = {}) {
  const { gladys, collector, registry, config, simulatorState } = app;
  const data = collector.publicationData();
  const states = new Map(
    Object.values(D)
      .flatMap((device) =>
        getStatesForDevice(
          gladys,
          device,
          data,
          config,
          simulatorState,
          collector.now(),
        ),
      )
      .map((entry) => [
        entry.device_feature_external_id,
        entry.state ?? entry.text,
      ]),
  );
  const id = (device, feature) => getDeviceIds(gladys, device).feature(feature);
  const value = (device, feature) => states.get(id(device, feature));
  const tile = (device, feature, en, fr, unit) => ({
    type: "value",
    label: text(en, fr),
    value: value(device, feature) ?? unknown,
    ...(unit ? { unit } : {}),
  });
  const row = (device, feature, en, fr, unit = "") => ({
    label: text(en, fr),
    value:
      value(device, feature) === undefined
        ? unknown
        : unit
          ? `${value(device, feature)} ${unit}`
          : value(device, feature),
  });
  let components;
  if (key === "fees") {
    if (settings.view === "current") {
      components = [
        heading("Current fees", "Situation actuelle"),
        tile(D.FEES, F.ECONOMY, "Economy", "Éco", "sat/vB"),
        tile(D.FEES, F.FASTEST, "Fastest", "Rapide", "sat/vB"),
        tile(
          D.FEES,
          F.SPREAD,
          "Fast / economy spread",
          "Écart rapide / éco",
          "sat/vB",
        ),
      ];
    } else {
      const score = value(D.FEES, F.OPPORTUNITY_SCORE);
      components = [
        heading("Transfer opportunity", "Opportunité de transfert"),
        ...(score === undefined
          ? [tile(D.FEES, F.OPPORTUNITY_SCORE, "Score", "Score")]
          : [
              {
                type: "gauge",
                value: score,
                min: 0,
                max: 5,
                label: text("Score / 5", "Score / 5"),
                color:
                  score < 2.5 ? "danger" : score <= 3.5 ? "warning" : "success",
              },
            ]),
        {
          type: "text",
          variant: "caption",
          text: text(
            "Low < 2.5 · Fair 2.5–3.5 · Good > 3.5",
            "Faible < 2,5 · Moyen 2,5–3,5 · Bon > 3,5",
          ),
        },
      ];
    }
  } else if (key === "simulator") {
    if (settings.view === "comparison") {
      components = [
        heading("Current comparison", "Comparatif actuel"),
        tile(D.SIMULATOR, S.ECONOMY_FIAT, "Economy", "Éco", config.currency),
        tile(
          D.SIMULATOR,
          S.HALF_HOUR_FIAT,
          "30 min",
          "30 min",
          config.currency,
        ),
        tile(D.SIMULATOR, S.HOUR_FIAT, "1 hour", "1 h", config.currency),
        tile(D.SIMULATOR, S.FASTEST_FIAT, "Fastest", "Rapide", config.currency),
      ];
    } else {
      components = [
        heading("Transfer simulation", "Simulation de transfert"),
        {
          type: "status",
          items: [
            row(D.SIMULATOR, S.AMOUNT, "BTC amount", "Montant BTC", "BTC"),
            row(D.SIMULATOR, S.VSIZE, "Transaction size", "Taille TX", "vB"),
            {
              label: text("Priority", "Priorité"),
              value: priorities[simulatorState.priority],
            },
          ],
        },
        tile(
          D.SIMULATOR,
          S.TRANSFER_FIAT,
          "Transfer value",
          "Valeur du transfert",
          config.currency,
        ),
        tile(D.SIMULATOR, S.SELECTED_RATE, "Feerate", "Feerate", "sat/vB"),
        tile(
          D.SIMULATOR,
          S.SELECTED_FIAT,
          "Network fee",
          "Frais réseau",
          config.currency,
        ),
        simulatorState.amountBtc === 0
          ? {
              type: "value",
              label: text("Fee / transfer", "Frais / transfert"),
              value: "—",
              unit: "%",
            }
          : tile(
              D.SIMULATOR,
              S.SELECTED_PERCENT,
              "Fee / transfer",
              "Frais / transfert",
              "%",
            ),
        {
          type: "button",
          label: text("Apply widget settings", "Appliquer les réglages"),
          icon: "check",
          action: { key: "apply_settings" },
        },
      ];
    }
  } else if (key === "network") {
    components = [
      heading("Network status", "État du réseau"),
      {
        type: "status",
        items: [
          row(D.MEMPOOL, M.COUNT, "Pending transactions", "TX en attente"),
          row(D.MEMPOOL, M.BACKLOG, "Mempool", "Mempool", "vMB"),
          row(
            D.NETWORK,
            N.BLOCK_AGE,
            "Last block age",
            "Âge dernier bloc",
            "min",
          ),
          row(
            D.NETWORK,
            N.AVERAGE_BLOCK_TIME,
            "Average block time",
            "Temps moyen bloc",
            "min",
          ),
          row(D.NETWORK, N.HEIGHT, "Height", "Hauteur"),
        ],
      },
    ];
  } else if (key === "mining") {
    components = [
      heading("Mining & difficulty", "Minage & difficulté"),
      {
        type: "status",
        items: [
          row(D.NETWORK, N.HASHRATE, "Hashrate", "Hashrate", "EH/s"),
          row(
            D.NETWORK,
            N.DIFFICULTY_CHANGE,
            "Estimated adjustment",
            "Ajustement estimé",
            "%",
          ),
          row(D.NETWORK, N.DIFFICULTY_PROGRESS, "Progress", "Progression", "%"),
          row(
            D.NETWORK,
            N.BLOCKS_UNTIL_ADJUSTMENT,
            "Remaining blocks",
            "Blocs restants",
          ),
        ],
      },
    ];
  } else if (key === "history") {
    const chart = CHARTS[settings.metric] ?? CHARTS.fees;
    const features = chart.features.map((feature) => id(chart.device, feature));
    components = features.every((feature) => registry.hasFeature(feature))
      ? [
          {
            type: "chart",
            title: chart.title,
            device_features: features,
            interval: Object.values(WIDGET_CHART_INTERVALS).includes(
              settings.interval,
            )
              ? settings.interval
              : chart.interval,
            chart_type: "line",
            unit: chart.unit ?? config.currency,
          },
        ]
      : [
          {
            type: "text",
            text: text(
              "Create or update the Bitcoin devices in Discovery to enable this history chart.",
              "Créez ou mettez à jour les appareils Bitcoin dans Découverte pour activer ce graphique historique.",
            ),
          },
        ];
  } else {
    throw new Error(`Unknown Bitcoin widget: ${key}`);
  }
  return { version: 1, ttl_seconds: 30, components };
}

export function registerWidgets(app) {
  for (const key of WIDGET_KEYS)
    app.gladys.onWidgetGet(key, (options) => buildWidget(app, key, options));
  app.gladys.onWidgetAction(
    "simulator",
    async (actionKey, _params, { settings = {} } = {}) => {
      if (actionKey !== "apply_settings" || settings.view === "comparison")
        throw new Error("Unsupported simulator action");
      if (
        settings.amount_btc === undefined ||
        settings.tx_vsize === undefined ||
        settings.priority === undefined
      ) {
        throw new Error(
          "Configure the widget amount, vSize and priority first / Configurez le montant, la vSize et la priorité du widget",
        );
      }
      await app.updateSimulator({
        amountBtc: settings.amount_btc,
        txVsize: settings.tx_vsize,
        priority: settings.priority,
      });
      return text(
        "Simulator settings applied.",
        "Réglages du simulateur appliqués.",
      );
    },
  );
}
