const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const MAX_RETRY_DELAY_MS = 30_000;

function normalizeApiBaseUrl(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    throw new Error("API base URL must be a valid absolute URL");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("API base URL must use HTTP or HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("API base URL must not contain credentials");
  }
  if (url.search || url.hash) {
    throw new Error("API base URL must not contain a query string or fragment");
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new Error("API base URL must not contain a path");
  }
  return url.origin;
}

export class MempoolApiError extends Error {
  constructor(message, { status, path, code, retryAfterMs, cause } = {}) {
    super(message, { cause });
    this.name = "MempoolApiError";
    this.status = status;
    this.path = path;
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

export function parseRetryAfter(value, nowMs = Date.now()) {
  if (!value) return 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000);
  }
  const dateMs = Date.parse(value);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - nowMs) : 0;
}

function object(value, endpoint) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new MempoolApiError(`Invalid object returned by ${endpoint}`, {
      path: endpoint,
      code: "INVALID_RESPONSE",
    });
  }
  return value;
}

function number(value, field, endpoint, { integer = false, minimum = 0 } = {}) {
  if (
    !Number.isFinite(value) ||
    value < minimum ||
    (integer && !Number.isInteger(value))
  ) {
    throw new MempoolApiError(`Invalid ${field} returned by ${endpoint}`, {
      path: endpoint,
      code: "INVALID_RESPONSE",
    });
  }
  return value;
}

function sleep(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export class MempoolClient {
  constructor({
    baseUrl,
    fetchImpl = globalThis.fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    sleepImpl = sleep,
    random = Math.random,
    now = Date.now,
  } = {}) {
    if (typeof fetchImpl !== "function") {
      throw new TypeError("A fetch implementation is required");
    }
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.maxRetries = maxRetries;
    this.sleepImpl = sleepImpl;
    this.random = random;
    this.now = now;
    this.setBaseUrl(baseUrl);
  }

  setBaseUrl(baseUrl) {
    this.baseUrl = normalizeApiBaseUrl(baseUrl);
  }

  buildUrl(path) {
    if (typeof path !== "string" || !path.startsWith("/api/")) {
      throw new TypeError("Mempool API paths must start with /api/");
    }
    const url = new URL(path, `${this.baseUrl}/`);
    if (url.origin !== new URL(this.baseUrl).origin) {
      throw new TypeError("Mempool API path escaped the configured origin");
    }
    return url;
  }

  retryDelay(attempt, retryAfterMs = 0) {
    const exponential = Math.min(MAX_RETRY_DELAY_MS, 1000 * 2 ** attempt);
    const jitter = Math.floor(this.random() * 250);
    return Math.min(
      MAX_RETRY_DELAY_MS,
      Math.max(exponential + jitter, retryAfterMs),
    );
  }

  async request(path, { responseType = "json" } = {}) {
    const url = this.buildUrl(path);
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          method: "GET",
          headers: {
            Accept: responseType === "json" ? "application/json" : "text/plain",
            "User-Agent": "Gladys-Bitcoin-Monitor/1.0",
          },
          signal: controller.signal,
        });
        if (!response.ok) {
          const retryAfterMs = parseRetryAfter(
            response.headers?.get?.("retry-after"),
            this.now(),
          );
          const retriable = response.status === 429 || response.status >= 500;
          if (retriable && attempt < this.maxRetries) {
            await this.sleepImpl(this.retryDelay(attempt, retryAfterMs));
            continue;
          }
          throw new MempoolApiError(
            `mempool API returned HTTP ${response.status} for ${path}`,
            {
              status: response.status,
              path,
              code: response.status === 429 ? "RATE_LIMITED" : "HTTP_ERROR",
              retryAfterMs,
            },
          );
        }
        try {
          return responseType === "text"
            ? await response.text()
            : await response.json();
        } catch (cause) {
          throw new MempoolApiError(
            `Invalid ${responseType} returned by ${path}`,
            {
              path,
              code: "INVALID_RESPONSE",
              cause,
            },
          );
        }
      } catch (cause) {
        if (cause instanceof MempoolApiError) throw cause;
        const timedOut =
          controller.signal.aborted || cause?.name === "AbortError";
        if (attempt < this.maxRetries) {
          await this.sleepImpl(this.retryDelay(attempt));
          continue;
        }
        throw new MempoolApiError(
          timedOut
            ? `Request timed out for ${path}`
            : `Unable to reach mempool API for ${path}`,
          {
            path,
            code: timedOut ? "TIMEOUT" : "NETWORK_ERROR",
            cause,
          },
        );
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new MempoolApiError(`Unable to complete request for ${path}`, {
      path,
    });
  }

  async getPreciseFees() {
    const endpoint = "/api/v1/fees/precise";
    const data = object(await this.request(endpoint), endpoint);
    return Object.fromEntries(
      ["fastestFee", "halfHourFee", "hourFee", "economyFee", "minimumFee"].map(
        (field) => [field, number(data[field], field, endpoint)],
      ),
    );
  }

  async getMempoolBlocks() {
    const endpoint = "/api/v1/fees/mempool-blocks";
    const data = await this.request(endpoint);
    if (!Array.isArray(data) || data.length === 0) {
      throw new MempoolApiError(
        `Invalid projected blocks returned by ${endpoint}`,
        {
          path: endpoint,
          code: "INVALID_RESPONSE",
        },
      );
    }
    return data.map((raw, index) => {
      const block = object(raw, endpoint);
      return {
        blockSize: number(
          block.blockSize,
          `blocks[${index}].blockSize`,
          endpoint,
        ),
        blockVSize: number(
          block.blockVSize,
          `blocks[${index}].blockVSize`,
          endpoint,
        ),
        nTx: number(block.nTx, `blocks[${index}].nTx`, endpoint, {
          integer: true,
        }),
        medianFee: number(
          block.medianFee,
          `blocks[${index}].medianFee`,
          endpoint,
        ),
      };
    });
  }

  async getMempool() {
    const endpoint = "/api/mempool";
    const data = object(await this.request(endpoint), endpoint);
    if (!Array.isArray(data.fee_histogram)) {
      throw new MempoolApiError(
        `Invalid fee_histogram returned by ${endpoint}`,
        {
          path: endpoint,
          code: "INVALID_RESPONSE",
        },
      );
    }
    const feeHistogram = data.fee_histogram.map((entry, index) => {
      if (!Array.isArray(entry) || entry.length < 2) {
        throw new MempoolApiError(
          `Invalid fee_histogram[${index}] returned by ${endpoint}`,
          {
            path: endpoint,
            code: "INVALID_RESPONSE",
          },
        );
      }
      return [
        number(entry[0], `fee_histogram[${index}][0]`, endpoint),
        number(entry[1], `fee_histogram[${index}][1]`, endpoint),
      ];
    });
    return {
      count: number(data.count, "count", endpoint, { integer: true }),
      vsize: number(data.vsize, "vsize", endpoint),
      totalFee: number(data.total_fee, "total_fee", endpoint),
      feeHistogram,
    };
  }

  async getPrices() {
    const endpoint = "/api/v1/prices";
    const data = object(await this.request(endpoint), endpoint);
    const prices = {
      time: number(data.time, "time", endpoint, { integer: true }),
    };
    for (const [currency, value] of Object.entries(data)) {
      if (currency !== "time" && Number.isFinite(value) && value >= 0)
        prices[currency] = value;
    }
    return prices;
  }

  async getTipHeight() {
    const endpoint = "/api/blocks/tip/height";
    const raw = await this.request(endpoint, { responseType: "text" });
    return number(Number(String(raw).trim()), "height", endpoint, {
      integer: true,
    });
  }

  async getDifficultyAdjustment() {
    const endpoint = "/api/v1/difficulty-adjustment";
    const data = object(await this.request(endpoint), endpoint);
    return {
      progressPercent: number(
        data.progressPercent,
        "progressPercent",
        endpoint,
      ),
      difficultyChange: number(
        data.difficultyChange,
        "difficultyChange",
        endpoint,
        {
          minimum: -100,
        },
      ),
      estimatedRetargetDateMs: number(
        data.estimatedRetargetDate,
        "estimatedRetargetDate",
        endpoint,
        { minimum: 1e12 },
      ),
      remainingBlocks: number(
        data.remainingBlocks,
        "remainingBlocks",
        endpoint,
        {
          integer: true,
        },
      ),
      averageBlockTimeMs: number(data.timeAvg, "timeAvg", endpoint),
    };
  }

  async getHashrate() {
    const endpoint = "/api/v1/mining/hashrate/1m";
    const data = object(await this.request(endpoint), endpoint);
    return {
      currentHashrate: number(
        data.currentHashrate,
        "currentHashrate",
        endpoint,
      ),
      currentDifficulty: number(
        data.currentDifficulty,
        "currentDifficulty",
        endpoint,
      ),
    };
  }

  async getBlocksAtHeight(height) {
    if (!Number.isInteger(height) || height < 0)
      throw new TypeError("height must be a positive integer");
    const endpoint = `/api/v1/blocks/${height}`;
    const data = await this.request(endpoint);
    if (!Array.isArray(data) || data.length === 0) {
      throw new MempoolApiError(`Invalid blocks returned by ${endpoint}`, {
        path: endpoint,
        code: "INVALID_RESPONSE",
      });
    }
    const raw = object(
      data.find((block) => block?.height === height) ?? data[0],
      endpoint,
    );
    return {
      height: number(raw.height, "height", endpoint, { integer: true }),
      timestamp: number(raw.timestamp, "timestamp", endpoint, {
        integer: true,
      }),
      transactionCount: number(raw.tx_count, "tx_count", endpoint, {
        integer: true,
      }),
      size: number(raw.size, "size", endpoint, { integer: true }),
      weight: number(raw.weight, "weight", endpoint, { integer: true }),
    };
  }
}
