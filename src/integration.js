import { createLogger } from "@gladysassistant/integration-sdk";
import { MempoolClient } from "./api/mempoolClient.js";
import {
  DEFAULT_CONFIG,
  normalizeConfig,
  simulatorDefaults,
} from "./config.js";
import {
  DATA_DIRECTORY,
  DEVICE_KEYS,
  MEMPOOL_API_BASE_URL,
  PRIORITIES,
  getDeviceIds,
} from "./constants.js";
import { buildDiscoveredDevices, getDeviceKey } from "./devices/index.js";
import { SIMULATOR_FEATURES } from "./devices/simulator.js";
import { Collector } from "./services/collector.js";
import { DeviceRegistry } from "./services/deviceRegistry.js";
import { Scheduler } from "./services/scheduler.js";
import { registerWidgets, WIDGET_KEYS } from "./widgets.js";
import {
  normalizeSimulatorState,
  SimulatorStateStore,
} from "./services/simulatorState.js";

const logger = createLogger({ name: "bitcoin-monitor" });
const apiLogger = createLogger({ name: "bitcoin-api" });
const schedulerLogger = createLogger({ name: "bitcoin-scheduler" });
const simulatorLogger = createLogger({ name: "bitcoin-simulator" });

function friendlyActionError(error) {
  const reason = error instanceof Error ? error.message : String(error);
  return new Error(
    `Unable to complete the operation: ${reason} / Opération impossible : ${reason}`,
  );
}

export class BitcoinMonitorIntegration {
  constructor({ gladys, dataDirectory = DATA_DIRECTORY } = {}) {
    this.gladys = gladys;
    this.config = normalizeConfig(DEFAULT_CONFIG);
    this.registry = new DeviceRegistry();
    this.scheduler = new Scheduler({ logger: schedulerLogger });
    this.stateStore = new SimulatorStateStore({
      directory: dataDirectory,
      logger: simulatorLogger,
    });
    this.simulatorState = simulatorDefaults(this.config);
    this.client = new MempoolClient({ baseUrl: MEMPOOL_API_BASE_URL });
    this.collector = new Collector({
      gladys,
      client: this.client,
      registry: this.registry,
      logger: apiLogger,
      config: this.config,
      simulatorState: this.simulatorState,
    });
    this.connectedInitialization = null;
    this.connectionGeneration = 0;
  }

  async start() {
    this.simulatorState = await this.stateStore.load(
      simulatorDefaults(this.config),
    );
    this.collector.setSimulatorState(this.simulatorState);
    this.registerHandlers();
    this.gladys.handleShutdown((signal) => this.shutdown(signal));
    logger.info("Starting Bitcoin Monitor integration");
    await this.gladys.connect();
  }

  registerHandlers() {
    registerWidgets(this);
    this.gladys.onScanRequest(() => this.publishDiscovery());
    this.gladys.onSetValue((device, feature, value) =>
      this.onSetValue(device, feature, value),
    );
    this.gladys.onPoll((device) => this.onPoll(device));
    this.gladys.onConfigUpdated((config) => this.onConfigUpdated(config));
    this.gladys.onDeviceCreated((device) => this.onDeviceUpserted(device));
    this.gladys.onDeviceUpdated((device) => this.onDeviceUpserted(device));
    this.gladys.onDeviceDeleted((device) => {
      this.registry.remove(device);
      this.collector.resetPublishedCache();
    });

    this.gladys.onAction("test_connection", async () => {
      try {
        const result = await this.collector.testConnection();
        return {
          en: `Connection successful. Current height: ${result.height}. Fastest fee: ${result.fees.fastestFee} sat/vB.`,
          fr: `Connexion réussie. Hauteur actuelle : ${result.height}. Frais rapides : ${result.fees.fastestFee} sat/vB.`,
        };
      } catch (error) {
        throw friendlyActionError(error);
      }
    });

    this.gladys.onAction("refresh_now", async () => {
      const success = await this.collector.collectAll({ force: true });
      if (!success)
        throw friendlyActionError(
          new Error("the mempool API did not return valid data"),
        );
      return {
        en: "Bitcoin data refreshed successfully.",
        fr: "Données Bitcoin actualisées avec succès.",
      };
    });

    this.gladys.onAction("update_simulator", async (fields) => {
      try {
        const nextState = normalizeSimulatorState(
          {
            amountBtc: this.simulatorState.amountBtc,
            txVsize: fields.tx_vsize,
            priority: fields.priority,
          },
          this.simulatorState,
        );
        await this.updateSimulator(nextState);
        return {
          en: `Simulator settings updated: ${nextState.txVsize} vB, ${nextState.priority}.`,
          fr: `Réglages du simulateur mis à jour : ${nextState.txVsize} vB, ${nextState.priority}.`,
        };
      } catch (error) {
        throw friendlyActionError(error);
      }
    });

    this.gladys.on("connected", () => {
      const generation = ++this.connectionGeneration;
      this.initializeAfterConnection(generation).catch((error) => {
        if (generation !== this.connectionGeneration) return;
        logger.error("Post-connection initialization failed", error);
        this.gladys
          .setConnectionStatus(false, {
            en: "Initialization failed. Check the integration logs.",
            fr: "Échec de l'initialisation. Consultez les logs de l'intégration.",
          })
          .catch(() => {});
      });
    });
    this.gladys.on("disconnected", () => {
      this.connectionGeneration += 1;
      this.scheduler
        .stop()
        .catch((error) => logger.error("Unable to stop scheduler", error));
    });
  }

  async initializeAfterConnection(generation = this.connectionGeneration) {
    const previous = this.connectedInitialization;
    const initialization = (async () => {
      if (previous) await previous.catch(() => {});
      if (generation !== this.connectionGeneration) return;
      await this.scheduler.stop();
      const loadedConfig = normalizeConfig(await this.gladys.getConfig());
      this.config = loadedConfig;
      this.collector.setConfig(loadedConfig);
      if (!this.stateStore.loadedFromDisk) {
        this.simulatorState = simulatorDefaults(loadedConfig);
        this.collector.setSimulatorState(this.simulatorState);
        await this.stateStore.save(this.simulatorState);
      }
      this.registry.sync(await this.gladys.getDevices());
      await this.publishDiscovery();
      this.collector.resetPublishedCache();
      await this.collector.collectAll({ force: true });
      if (generation === this.connectionGeneration)
        await this.startScheduler(generation);
    })();
    this.connectedInitialization = initialization;
    try {
      return await initialization;
    } finally {
      if (this.connectedInitialization === initialization)
        this.connectedInitialization = null;
    }
  }

  publishDiscovery() {
    return this.gladys.publishDiscoveredDevices(
      buildDiscoveredDevices(this.gladys, this.config),
    );
  }

  async startScheduler(generation = this.connectionGeneration) {
    await this.scheduler.reconfigure(
      [
        {
          name: "fast",
          intervalSeconds: this.config.fast_poll_seconds,
          run: () => this.collector.collectFast(),
        },
        {
          name: "difficulty",
          intervalSeconds: this.config.difficulty_poll_seconds,
          run: () => this.collector.collectDifficulty(),
        },
        {
          name: "hashrate",
          intervalSeconds: this.config.hashrate_poll_seconds,
          run: () => this.collector.collectHashrate(),
        },
      ],
      { shouldRun: () => generation === this.connectionGeneration },
    );
  }

  async onSetValue(_device, feature, value) {
    const amountExternalId = getDeviceIds(
      this.gladys,
      DEVICE_KEYS.SIMULATOR,
    ).feature(SIMULATOR_FEATURES.AMOUNT);
    const priorityExternalId = getDeviceIds(
      this.gladys,
      DEVICE_KEYS.SIMULATOR,
    ).feature(SIMULATOR_FEATURES.PRIORITY);
    if (feature.external_id === amountExternalId) {
      const nextState = normalizeSimulatorState(
        { ...this.simulatorState, amountBtc: Number(value) },
        this.simulatorState,
      );
      await this.updateSimulator(nextState);
      return;
    }
    if (
      feature.external_id !== priorityExternalId ||
      !Object.values(PRIORITIES).includes(value)
    ) {
      throw new Error(
        `Unsupported Bitcoin Monitor command for ${feature.external_id}`,
      );
    }
    await this.updateSimulator({ ...this.simulatorState, priority: value });
  }

  async updateSimulator(nextState) {
    const normalized = normalizeSimulatorState(nextState, this.simulatorState);
    await this.stateStore.save(normalized);
    this.simulatorState = normalized;
    this.collector.setSimulatorState(normalized);
    await this.collector.publishSimulator({ force: true });
    this.gladys.requestWidgetRefresh("simulator");
  }

  async onPoll(device) {
    const deviceKey = getDeviceKey(this.gladys, device.external_id);
    if (deviceKey)
      await this.collector.collectForDevice(deviceKey, { force: true });
  }

  async onDeviceUpserted(device) {
    this.registry.upsert(device);
    this.collector.resetPublishedCache();
    const deviceKey = getDeviceKey(this.gladys, device.external_id);
    if (!deviceKey) return;
    await this.collector.collectForDevice(deviceKey, { force: true });
  }

  async onConfigUpdated(rawConfig) {
    const generation = this.connectionGeneration;
    const previous = this.config;
    let next;
    try {
      next = normalizeConfig(rawConfig);
    } catch (error) {
      throw friendlyActionError(error);
    }
    await this.scheduler.stop();
    this.config = next;
    this.collector.setConfig(next);

    const simulatorPatch = { ...this.simulatorState };
    if (next.default_tx_vsize !== previous.default_tx_vsize) {
      simulatorPatch.txVsize = next.default_tx_vsize;
    }
    if (next.default_priority !== previous.default_priority) {
      simulatorPatch.priority = next.default_priority;
    }
    if (
      JSON.stringify(simulatorPatch) !== JSON.stringify(this.simulatorState)
    ) {
      await this.updateSimulator(simulatorPatch);
    }

    await this.publishDiscovery();
    this.collector.resetPublishedCache();
    await this.collector.collectAll({ force: true });
    await this.startScheduler(generation);
    for (const key of WIDGET_KEYS) this.gladys.requestWidgetRefresh(key);
  }

  async shutdown(signal) {
    this.connectionGeneration += 1;
    logger.info(`Received ${signal}; stopping Bitcoin Monitor`);
    await this.scheduler.stop();
    await this.stateStore.save(this.simulatorState);
  }
}
