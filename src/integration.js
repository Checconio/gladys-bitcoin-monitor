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
  PRIORITIES,
  getDeviceIds,
} from "./constants.js";
import { buildDiscoveredDevices, getDeviceKey } from "./devices/index.js";
import { SIMULATOR_FEATURES } from "./devices/simulator.js";
import { Collector } from "./services/collector.js";
import { DeviceRegistry } from "./services/deviceRegistry.js";
import { Scheduler } from "./services/scheduler.js";
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
    this.client = new MempoolClient({ baseUrl: this.config.api_base_url });
    this.collector = new Collector({
      gladys,
      client: this.client,
      registry: this.registry,
      logger: apiLogger,
      config: this.config,
      simulatorState: this.simulatorState,
    });
    this.connectedInitialization = null;
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
    this.gladys.onScanRequest(() => this.publishDiscovery());
    this.gladys.onSetValue((device, feature, value) =>
      this.onSetValue(device, feature, value),
    );
    this.gladys.onPoll((device) => this.onPoll(device));
    this.gladys.onConfigUpdated((config) => this.onConfigUpdated(config));
    this.gladys.onDeviceCreated((device) => this.onDeviceUpserted(device));
    this.gladys.onDeviceUpdated((device) => this.onDeviceUpserted(device));
    this.gladys.onDeviceDeleted((device) => this.registry.remove(device));

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
            amountBtc: fields.amount_btc,
            txVsize: fields.tx_vsize,
            priority: fields.priority,
          },
          this.simulatorState,
        );
        await this.updateSimulator(nextState);
        return {
          en: `Simulator updated: ${nextState.amountBtc} BTC, ${nextState.txVsize} vB, ${nextState.priority}.`,
          fr: `Simulateur mis à jour : ${nextState.amountBtc} BTC, ${nextState.txVsize} vB, ${nextState.priority}.`,
        };
      } catch (error) {
        throw friendlyActionError(error);
      }
    });

    this.gladys.on("connected", () => {
      this.initializeAfterConnection().catch((error) => {
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
      this.scheduler
        .stop()
        .catch((error) => logger.error("Unable to stop scheduler", error));
    });
  }

  async initializeAfterConnection() {
    if (this.connectedInitialization) return this.connectedInitialization;
    this.connectedInitialization = (async () => {
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
      await this.startScheduler();
    })();
    try {
      return await this.connectedInitialization;
    } finally {
      this.connectedInitialization = null;
    }
  }

  publishDiscovery() {
    return this.gladys.publishDiscoveredDevices(
      buildDiscoveredDevices(this.gladys, this.config),
    );
  }

  async startScheduler() {
    await this.scheduler.reconfigure([
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
    ]);
  }

  async onSetValue(_device, feature, value) {
    const priorityExternalId = getDeviceIds(
      this.gladys,
      DEVICE_KEYS.SIMULATOR,
    ).feature(SIMULATOR_FEATURES.PRIORITY);
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
    this.simulatorState = normalizeSimulatorState(
      nextState,
      this.simulatorState,
    );
    this.collector.setSimulatorState(this.simulatorState);
    await this.stateStore.save(this.simulatorState);
    await this.collector.publishSimulator({ force: true });
  }

  async onPoll(device) {
    const deviceKey = getDeviceKey(this.gladys, device.external_id);
    if (deviceKey)
      await this.collector.collectForDevice(deviceKey, { force: true });
  }

  async onDeviceUpserted(device) {
    this.registry.upsert(device);
    const deviceKey = getDeviceKey(this.gladys, device.external_id);
    if (!deviceKey) return;
    await this.collector.collectForDevice(deviceKey, { force: true });
  }

  async onConfigUpdated(rawConfig) {
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
    if (next.default_transfer_btc !== previous.default_transfer_btc) {
      simulatorPatch.amountBtc = next.default_transfer_btc;
    }
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
    await this.startScheduler();
  }

  async shutdown(signal) {
    logger.info(`Received ${signal}; stopping Bitcoin Monitor`);
    await this.scheduler.stop();
    await this.stateStore.save(this.simulatorState);
  }
}
