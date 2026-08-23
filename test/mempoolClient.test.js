import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  MempoolApiError,
  MempoolClient,
  parseRetryAfter,
} from "../src/api/mempoolClient.js";

async function fixture(name) {
  return JSON.parse(
    await readFile(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"),
  );
}

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

test("parses all target API response shapes defensively", async () => {
  const fixtures = {
    "/api/v1/fees/precise": await fixture("precise-fees"),
    "/api/v1/fees/mempool-blocks": await fixture("projected-blocks"),
    "/api/mempool": await fixture("mempool"),
    "/api/v1/prices": await fixture("prices"),
    "/api/v1/difficulty-adjustment": await fixture("difficulty-adjustment"),
    "/api/v1/mining/hashrate/1m": await fixture("hashrate"),
    "/api/v1/blocks/963492": await fixture("blocks"),
  };
  const client = new MempoolClient({
    baseUrl: "https://mempool.example",
    maxRetries: 0,
    fetchImpl: async (url) => {
      if (url.pathname === "/api/blocks/tip/height")
        return new Response("963492");
      return jsonResponse(fixtures[url.pathname]);
    },
  });

  assert.equal((await client.getPreciseFees()).minimumFee, 0.1);
  assert.equal((await client.getMempoolBlocks())[1].medianFee, 6);
  assert.equal((await client.getMempool()).feeHistogram.length, 5);
  assert.equal((await client.getPrices()).EUR, 67010);
  assert.equal(await client.getTipHeight(), 963492);
  assert.deepEqual(await client.getDifficultyAdjustment(), {
    progressPercent: 44.5,
    difficultyChange: -1.25,
    estimatedRetargetDateMs: 1787446234940,
    remainingBlocks: 1120,
    averageBlockTimeMs: 609365,
  });
  assert.equal(
    (await client.getHashrate()).currentDifficulty,
    127479855693691.4,
  );
  assert.equal((await client.getBlocksAtHeight(963492)).transactionCount, 3210);
});

test("handles a normal HTTP 200 response", async () => {
  const expected = await fixture("precise-fees");
  const client = new MempoolClient({
    baseUrl: "https://mempool.example",
    maxRetries: 0,
    fetchImpl: async () => jsonResponse(expected),
  });
  assert.deepEqual(await client.getPreciseFees(), expected);
});

test("rejects invalid JSON without converting it to empty data", async () => {
  const client = new MempoolClient({
    baseUrl: "https://mempool.example",
    maxRetries: 0,
    fetchImpl: async () => new Response("{not-json"),
  });
  await assert.rejects(client.request("/api/v1/prices"), (error) => {
    assert.equal(error.code, "INVALID_RESPONSE");
    return true;
  });
});

test("aborts and reports a timeout", async () => {
  const client = new MempoolClient({
    baseUrl: "https://mempool.example",
    timeoutMs: 5,
    maxRetries: 0,
    fetchImpl: (_url, { signal }) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      }),
  });
  await assert.rejects(client.request("/api/v1/prices"), (error) => {
    assert.equal(error.code, "TIMEOUT");
    return true;
  });
});

test("does not retry HTTP 404", async () => {
  let calls = 0;
  const client = new MempoolClient({
    baseUrl: "https://mempool.example",
    fetchImpl: async () => {
      calls += 1;
      return new Response("missing", { status: 404 });
    },
  });
  await assert.rejects(
    client.request("/api/v1/prices"),
    (error) => error.status === 404,
  );
  assert.equal(calls, 1);
});

test("honors Retry-After on HTTP 429 before retrying", async () => {
  const delays = [];
  let calls = 0;
  const client = new MempoolClient({
    baseUrl: "https://mempool.example",
    maxRetries: 1,
    random: () => 0,
    sleepImpl: async (delay) => delays.push(delay),
    fetchImpl: async () => {
      calls += 1;
      return calls === 1
        ? new Response("limited", {
            status: 429,
            headers: { "retry-after": "2" },
          })
        : jsonResponse({ ok: true });
    },
  });
  assert.deepEqual(await client.request("/api/v1/prices"), { ok: true });
  assert.deepEqual(delays, [2000]);
});

test("retries HTTP 500 with exponential backoff and then succeeds", async () => {
  const delays = [];
  let calls = 0;
  const client = new MempoolClient({
    baseUrl: "https://mempool.example",
    maxRetries: 1,
    random: () => 0,
    sleepImpl: async (delay) => delays.push(delay),
    fetchImpl: async () => {
      calls += 1;
      return calls === 1
        ? new Response("failure", { status: 500 })
        : jsonResponse({ ok: true });
    },
  });
  assert.deepEqual(await client.request("/api/v1/prices"), { ok: true });
  assert.deepEqual(delays, [1000]);
});

test("reports a final 429 as a typed API error", async () => {
  const client = new MempoolClient({
    baseUrl: "https://mempool.example",
    maxRetries: 0,
    fetchImpl: async () => new Response("limited", { status: 429 }),
  });
  await assert.rejects(client.request("/api/v1/prices"), MempoolApiError);
});

test("parses Retry-After seconds and HTTP dates", () => {
  assert.equal(parseRetryAfter("2", 1000), 2000);
  assert.equal(parseRetryAfter("Thu, 01 Jan 1970 00:00:05 GMT", 1000), 4000);
  assert.equal(parseRetryAfter("invalid", 1000), 0);
});
