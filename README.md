# Bitcoin Monitor for Gladys Assistant

Bitcoin Monitor is a production-oriented external device integration for [Gladys Assistant](https://gladysassistant.com). It discovers five virtual devices that expose Bitcoin fee estimates, projected blocks, mempool pressure, chain and mining data, fiat prices, and a local transaction-cost simulator.

It uses the official [`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js) and the public REST API of [mempool.space](https://mempool.space/docs/api/rest). No account, API key, MQTT setup, Node-RED flow, telemetry, or manually created device is required.

## Features

- Precise fee rates and the first three projected blocks.
- Mempool backlog and fee-rate pressure at 1, 2, 5, and 10 sat/vB.
- Tip height and new-block details fetched only when the height changes.
- Difficulty-adjustment progress and current network hashrate/difficulty.
- BTC price in EUR, USD, GBP, CHF, CAD, AUD, or JPY.
- Persistent transaction simulator using amount, vSize, priority, current fee rates, and public price.
- Conservative, non-overlapping polling with timeout, exponential backoff, jitter, and `Retry-After` support.
- Last-known-good data retention and an application connection status in Gladys.

## Discovered devices

```text
Bitcoin Monitor
├── Bitcoin Fees
├── Bitcoin Mempool
├── Bitcoin Network
├── Bitcoin Market
└── Bitcoin Transaction Simulator
```

Discovery does not create devices behind the user's back. Open the integration's **Discovery** tab and create the devices you want. States are published only for devices and features that exist in Gladys.

## Installation from the decentralized store

After the first public release is indexed:

1. Open **Integrations** in Gladys.
2. Search for **Bitcoin Monitor**.
3. Review the manifest and install it.
4. Configure the currency, polling, and simulator defaults.
5. Open **Discovery** and create the five virtual devices (or only the ones you need).

## Configuration

| Key                       |   Default | Accepted values                   |
| ------------------------- | --------: | --------------------------------- |
| `currency`                |     `EUR` | EUR, USD, GBP, CHF, CAD, AUD, JPY |
| `fast_poll_seconds`       |        60 | 30–900 seconds                    |
| `difficulty_poll_seconds` |       600 | 300–3600 seconds                  |
| `hashrate_poll_seconds`   |      1800 | 600–21600 seconds                 |
| `default_tx_vsize`        |       250 | 50–10000 vB                       |
| `default_transfer_btc`    |      0.01 | 0.00000001–21000000 BTC           |
| `default_priority`        | `fastest` | fastest, half_hour, hour, economy |

The Configuration screen also exposes **Test connection**, **Refresh now**, and **Update transaction simulator** actions.

### Gladys numeric-input limitation

Gladys 4.86 does not render a generic numeric input for a writable `sensor/decimal` device feature. Marking such a feature writable would display it as a sensor and would not let the user enter a value. Bitcoin Monitor therefore follows the official fallback contract: **Transfer amount** and **Transaction vSize** are state features edited through the `update_simulator` action's `number` fields. **Priority** is directly editable through the supported `text/select` feature contract.

## Simulator semantics

The transferred BTC amount does **not** determine the Bitcoin network fee. The estimate is:

```text
fee_sats = ceil(transaction_vsize × feerate_sat_per_vB)
fee_btc = fee_sats / 100,000,000
fee_fiat = fee_btc × public_BTC_price
```

The local BTC amount is used only to calculate the transfer's fiat value and the percentage represented by the fee. It is persisted in `/data/simulator-state.json` and is never sent to mempool.space.

## Data sources

- `/api/v1/fees/precise`
- `/api/v1/fees/mempool-blocks`
- `/api/mempool`
- `/api/v1/prices`
- `/api/blocks/tip/height`
- `/api/v1/blocks/:startHeight` only after a height change
- `/api/v1/difficulty-adjustment`
- `/api/v1/mining/hashrate/1m`

## Architecture

```text
index.js                         SDK bootstrap
src/api/mempoolClient.js         HTTP validation, timeout, retry and rate limiting
src/calculations/                Pure fee, mempool, advice and simulation calculations
src/devices/                     Five Gladys discovery/state definitions
src/services/collector.js        Last-known-good cache and batched publication
src/services/scheduler.js        Non-overlapping setTimeout scheduler
src/services/simulatorState.js   Atomic /data persistence
src/integration.js               SDK handlers and lifecycle orchestration
```

## Development

Requirements: Node.js 20 or newer (Node 24 matches the Docker image) and npm.

```bash
npm install
npm run format:check
npm run lint
npm test
```

To connect the integration directly to a development Gladys instance:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="bitcoin-monitor-dev" \
DATA_DIRECTORY="./data" \
LOG_LEVEL=debug \
npm start
```

The three `GLADYS_*` values are the current environment contract of the official SDK. Register all handlers before connection; the implementation already does this.

## Docker

```bash
BITCOIN_MANIFEST="$(jq -c . gladys-assistant-integration.json)"
docker build \
  --build-arg "GLADYS_INTEGRATION_MANIFEST=${BITCOIN_MANIFEST}" \
  -t bitcoin-monitor:test .
docker run --rm --read-only --user 1000:1000 \
  --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  -v bitcoin-monitor-data:/data \
  -e GLADYS_HOST_API_URL="http://<gladys-host>:<port>" \
  -e GLADYS_INTEGRATION_TOKEN="<token>" \
  -e GLADYS_INTEGRATION_SELECTOR="bitcoin-monitor-dev" \
  bitcoin-monitor:test
```

PowerShell equivalent for the build:

```powershell
$bitcoinManifest = Get-Content gladys-assistant-integration.json -Raw |
  ConvertFrom-Json |
  ConvertTo-Json -Compress -Depth 100
docker build `
  --build-arg "GLADYS_INTEGRATION_MANIFEST=$bitcoinManifest" `
  -t bitcoin-monitor:test .
```

The build fails if the manifest label differs from the manifest copied into the image. Gladys uses the `io.gladysassistant.manifest` label for development installation by image name and for targeted image lifecycle management.

The release workflow publishes `linux/amd64` and `linux/arm64` images to GHCR.

## Publishing

1. Create a public GitHub repository and update the owner in `docker_image` and `cover_image` if it is not `Checconio`.
2. Add the repository topic `gladys-assistant-integration`.
3. Push `main`; ensure CI passes.
4. For the initial `1.0.0` release, create and push the annotated `v1.0.0` tag; the Build workflow publishes `:1.0.0` and `:latest`. For later releases, use **Actions → Release** with `patch`, `minor`, or `major` so all version fields are bumped together.
5. Make the GHCR package public if the account defaults to private packages.
6. Confirm that the versioned image has both `linux/amd64` and `linux/arm64` manifests.
7. Run `npx github:GladysAssistant/integration-store .` again after the image is public.
8. Wait for the hourly decentralized-store index, then check its `rejected.json` if the integration is absent.

## Privacy and security

Bitcoin Monitor sends only documented public-data requests to the fixed `https://mempool.space` endpoint. It has no telemetry, tracker, account, secret, inbound port, hardware access, sub-container, shell command, or Docker socket access. The API endpoint is not exposed in the Gladys configuration and legacy `api_base_url` values are ignored.

## License

Apache License 2.0. See [LICENSE](LICENSE).
