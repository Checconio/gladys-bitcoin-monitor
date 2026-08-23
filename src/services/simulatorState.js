import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PRIORITIES } from "../constants.js";

const PRIORITY_VALUES = new Set(Object.values(PRIORITIES));

export function normalizeSimulatorState(raw, defaults) {
  const amountBtc = Number(raw?.amountBtc ?? defaults.amountBtc);
  const txVsize = Number(raw?.txVsize ?? defaults.txVsize);
  const priority = String(raw?.priority ?? defaults.priority);
  if (!Number.isFinite(amountBtc) || amountBtc < 0 || amountBtc > 21_000_000) {
    throw new Error("Simulator amount must be between 0 and 21000000 BTC");
  }
  if (!Number.isFinite(txVsize) || txVsize < 50 || txVsize > 10_000) {
    throw new Error("Simulator vSize must be between 50 and 10000 vB");
  }
  if (!PRIORITY_VALUES.has(priority)) {
    throw new Error(
      `Simulator priority must be one of: ${[...PRIORITY_VALUES].join(", ")}`,
    );
  }
  return { amountBtc, txVsize, priority };
}

export class SimulatorStateStore {
  constructor({
    directory = "/data",
    filename = "simulator-state.json",
    logger,
  } = {}) {
    this.filePath = join(directory, filename);
    this.logger = logger;
    this.loadedFromDisk = false;
  }

  async load(defaults) {
    try {
      const stored = JSON.parse(await readFile(this.filePath, "utf8"));
      const state = normalizeSimulatorState(stored, defaults);
      this.loadedFromDisk = true;
      return state;
    } catch (error) {
      this.loadedFromDisk = false;
      if (error?.code !== "ENOENT") {
        this.logger?.warn(
          "Ignoring unreadable simulator state; using configured defaults",
          error,
        );
      }
      return normalizeSimulatorState(defaults, defaults);
    }
  }

  async save(state) {
    const normalized = normalizeSimulatorState(state, state);
    const directory = dirname(this.filePath);
    const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    try {
      await mkdir(directory, { recursive: true });
      await writeFile(
        temporaryPath,
        `${JSON.stringify(normalized, null, 2)}\n`,
        {
          encoding: "utf8",
          mode: 0o600,
        },
      );
      await rename(temporaryPath, this.filePath);
      this.loadedFromDisk = true;
    } catch (error) {
      await rm(temporaryPath, { force: true }).catch(() => {});
      this.logger?.warn("Unable to persist simulator state", error);
      throw error;
    }
  }
}
