import { DEVICE_TRANSPORTS } from "@gladysassistant/integration-sdk";
import { DEVICE_KEYS, getDeviceIds } from "../constants.js";
import { getStatesForDevice } from "../devices/index.js";
import { DEVICE_SOURCES, isSourceHealthy } from "./sourceHealth.js";

const ALL_DEVICE_KEYS = Object.values(DEVICE_KEYS);

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export class Collector {
  constructor({
    gladys,
    client,
    registry,
    logger,
    config,
    simulatorState,
    now = Date.now,
  }) {
    this.gladys = gladys;
    this.client = client;
    this.registry = registry;
    this.logger = logger;
    this.config = config;
    this.simulatorState = simulatorState;
    this.now = now;
    this.data = {
      fees: null,
      projectedBlocks: null,
      mempool: null,
      prices: null,
      tipHeight: null,
      lastBlock: null,
      difficulty: null,
      hashrate: null,
      lastSuccessfulUpdate: null,
    };
    this.locks = new Map();
    this.lastPublished = new Map();
    this.lastPublishedAt = new Map();
    this.sourceHealth = new Map();
    this.lastTransports = new Map();
    this.failedFastCycles = 0;
    this.connectionStatus = undefined;
  }

  setConfig(config) {
    this.config = config;
  }

  setSimulatorState(state) {
    this.simulatorState = state;
  }

  resetPublishedCache() {
    this.lastPublished.clear();
    this.lastPublishedAt.clear();
    this.lastTransports.clear();
    this.connectionStatus = undefined;
  }

  async exclusive(name, operation) {
    if (this.locks.has(name)) {
      this.logger?.debug(`Skipping overlapping ${name} collection`);
      return false;
    }
    const execution = Promise.resolve().then(operation);
    this.locks.set(name, execution);
    try {
      return await execution;
    } finally {
      this.locks.delete(name);
    }
  }

  async step(name, operation, assign) {
    try {
      const value = await operation();
      assign(value);
      this.sourceHealth.set(name, { success: true, updatedAt: this.now() });
      this.data.lastSuccessfulUpdate = new Date(this.now()).toISOString();
      return true;
    } catch (error) {
      this.sourceHealth.set(name, { success: false, updatedAt: this.now() });
      this.logger?.warn(`${name} collection failed: ${errorMessage(error)}`);
      return false;
    }
  }

  isSourceHealthy(source) {
    return isSourceHealthy(source, this.sourceHealth, this.config, this.now());
  }

  // Keep the last-known-good cache, but never present a failed source as a new sample.
  publicationData() {
    const data = { ...this.data };
    for (const source of this.sourceHealth.keys()) {
      if (!this.isSourceHealthy(source)) data[source] = null;
    }
    if (data.lastBlock?.height !== data.tipHeight) data.lastBlock = null;
    return data;
  }

  async publishTransports() {
    const entries = [];
    for (const [deviceKey, sources] of Object.entries(DEVICE_SOURCES)) {
      const external_id = getDeviceIds(this.gladys, deviceKey).device;
      if (!this.registry.hasDevice(external_id)) continue;
      const healthy = sources.filter((source) => this.isSourceHealthy(source));
      const entry = {
        external_id,
        transport: healthy.length
          ? DEVICE_TRANSPORTS.CLOUD
          : DEVICE_TRANSPORTS.UNREACHABLE,
      };
      if (healthy.length > 0 && healthy.length < sources.length) {
        entry.degraded = true;
        entry.message = {
          en: "Some mempool.space data is unavailable. Last valid values are retained.",
          fr: "Certaines données mempool.space sont indisponibles. Les dernières valeurs valides sont conservées.",
        };
      }
      if (this.lastTransports.get(external_id) !== JSON.stringify(entry))
        entries.push(entry);
    }
    if (!entries.length) return;
    try {
      await this.gladys.publishTransports(entries);
      for (const entry of entries)
        this.lastTransports.set(entry.external_id, JSON.stringify(entry));
    } catch (error) {
      this.logger?.warn(`Unable to publish transports: ${errorMessage(error)}`);
    }
  }

  async updateConnectionStatus(connected, message) {
    const signature = JSON.stringify({ connected, message });
    if (signature === this.connectionStatus) return;
    try {
      await this.gladys.setConnectionStatus(connected, message);
      this.connectionStatus = signature;
    } catch (error) {
      this.logger?.warn(
        `Unable to update Gladys connection status: ${errorMessage(error)}`,
      );
    }
  }

  async trackFastCycle(successCount) {
    if (successCount > 0) {
      this.failedFastCycles = 0;
      await this.updateConnectionStatus(
        true,
        successCount < 5
          ? {
              en: "Some mempool.space endpoints are unavailable; data is incomplete.",
              fr: "Certains endpoints mempool.space sont indisponibles ; les données sont partielles.",
            }
          : undefined,
      );
      return;
    }
    this.failedFastCycles += 1;
    if (this.failedFastCycles >= 3) {
      await this.updateConnectionStatus(false, {
        en: "Unable to reach the mempool.space API.",
        fr: "Impossible de joindre l'API mempool.space.",
      });
    }
  }

  valueSignature(state) {
    return Object.hasOwn(state, "text")
      ? `text:${state.text}`
      : `state:${state.state}`;
  }

  async publishDevice(deviceKey, { force = false } = {}) {
    const states = getStatesForDevice(
      this.gladys,
      deviceKey,
      this.publicationData(),
      this.config,
      this.simulatorState,
      this.now(),
    );
    const publishable = states.filter((state) => {
      if (!this.registry.hasFeature(state.device_feature_external_id))
        return false;
      return (
        force ||
        this.now() -
          (this.lastPublishedAt.get(state.device_feature_external_id) ??
            -Infinity) >=
          300_000 ||
        this.lastPublished.get(state.device_feature_external_id) !==
          this.valueSignature(state)
      );
    });
    if (publishable.length === 0) return 0;
    await this.gladys.publishStates(publishable);
    for (const state of publishable) {
      this.lastPublished.set(
        state.device_feature_external_id,
        this.valueSignature(state),
      );
      this.lastPublishedAt.set(state.device_feature_external_id, this.now());
    }
    return publishable.length;
  }

  async publishDevices(deviceKeys, options) {
    for (const deviceKey of deviceKeys)
      await this.publishDevice(deviceKey, options);
  }

  async collectFast({ force = false } = {}) {
    return this.exclusive("fast", async () => {
      let successes = 0;
      if (
        await this.step(
          "fees",
          () => this.client.getPreciseFees(),
          (value) => {
            this.data.fees = value;
          },
        )
      )
        successes += 1;
      if (
        await this.step(
          "projectedBlocks",
          () => this.client.getMempoolBlocks(),
          (value) => {
            this.data.projectedBlocks = value;
          },
        )
      )
        successes += 1;
      if (
        await this.step(
          "mempool",
          () => this.client.getMempool(),
          (value) => {
            this.data.mempool = value;
          },
        )
      )
        successes += 1;
      if (
        await this.step(
          "prices",
          () => this.client.getPrices(),
          (value) => {
            this.data.prices = value;
          },
        )
      )
        successes += 1;

      const previousHeight = this.data.tipHeight;
      let tipChanged = false;
      if (
        await this.step(
          "tipHeight",
          () => this.client.getTipHeight(),
          (value) => {
            this.data.tipHeight = value;
            tipChanged =
              previousHeight !== value || this.data.lastBlock?.height !== value;
            if (!tipChanged)
              this.sourceHealth.set("lastBlock", {
                success: true,
                updatedAt: this.now(),
              });
          },
        )
      )
        successes += 1;
      if (tipChanged) {
        await this.step(
          "lastBlock",
          () => this.client.getBlocksAtHeight(this.data.tipHeight),
          (value) => {
            this.data.lastBlock = value;
          },
        );
      }

      await this.trackFastCycle(successes);
      await this.publishTransports();
      await this.publishDevices(
        [
          DEVICE_KEYS.FEES,
          DEVICE_KEYS.MEMPOOL,
          DEVICE_KEYS.NETWORK,
          DEVICE_KEYS.MARKET,
          DEVICE_KEYS.SIMULATOR,
        ],
        { force },
      );
      return successes > 0;
    });
  }

  async collectDifficulty({ force = false } = {}) {
    return this.exclusive("difficulty", async () => {
      const success = await this.step(
        "difficulty",
        () => this.client.getDifficultyAdjustment(),
        (value) => {
          this.data.difficulty = value;
        },
      );
      await this.publishTransports();
      if (success) await this.publishDevice(DEVICE_KEYS.NETWORK, { force });
      return success;
    });
  }

  async collectHashrate({ force = false } = {}) {
    return this.exclusive("hashrate", async () => {
      const success = await this.step(
        "hashrate",
        () => this.client.getHashrate(),
        (value) => {
          this.data.hashrate = value;
        },
      );
      await this.publishTransports();
      if (success) await this.publishDevice(DEVICE_KEYS.NETWORK, { force });
      return success;
    });
  }

  async collectAll({ force = false } = {}) {
    const results = [];
    results.push(await this.collectFast({ force }));
    results.push(await this.collectDifficulty({ force }));
    results.push(await this.collectHashrate({ force }));
    return results.some(Boolean);
  }

  async collectForDevice(deviceKey, { force = true } = {}) {
    if (deviceKey === DEVICE_KEYS.NETWORK) return this.collectAll({ force });
    if (ALL_DEVICE_KEYS.includes(deviceKey)) return this.collectFast({ force });
    return false;
  }

  async publishSimulator({ force = true } = {}) {
    return this.publishDevice(DEVICE_KEYS.SIMULATOR, { force });
  }

  async testConnection() {
    try {
      const fees = await this.client.getPreciseFees();
      const height = await this.client.getTipHeight();
      await this.updateConnectionStatus(true);
      return { fees, height };
    } catch (error) {
      await this.updateConnectionStatus(false, {
        en: "Unable to reach the mempool.space API.",
        fr: "Impossible de joindre l'API mempool.space.",
      });
      throw error;
    }
  }
}
