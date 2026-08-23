import { PRIORITIES } from "../constants.js";
import { calculateNetworkFee } from "./fees.js";

const PRIORITY_TO_FEE_FIELD = Object.freeze({
  [PRIORITIES.FASTEST]: "fastestFee",
  [PRIORITIES.HALF_HOUR]: "halfHourFee",
  [PRIORITIES.HOUR]: "hourFee",
  [PRIORITIES.ECONOMY]: "economyFee",
});

export function feeRateForPriority(fees, priority) {
  const field = PRIORITY_TO_FEE_FIELD[priority];
  if (!field || !Number.isFinite(fees?.[field])) {
    throw new TypeError(`No fee rate is available for priority ${priority}`);
  }
  return fees[field];
}

export function simulateTransaction({
  amountBtc,
  txVsize,
  feeRate,
  btcFiatPrice,
}) {
  for (const [name, value] of Object.entries({
    amountBtc,
    txVsize,
    feeRate,
    btcFiatPrice,
  })) {
    if (!Number.isFinite(value) || value < 0) {
      throw new TypeError(`${name} must be a non-negative finite number`);
    }
  }
  const { feeSats, feeBtc } = calculateNetworkFee(txVsize, feeRate);
  const feeFiat = feeBtc * btcFiatPrice;
  const transferValueFiat = amountBtc * btcFiatPrice;
  const feePercent = amountBtc > 0 ? (feeBtc / amountBtc) * 100 : null;
  return {
    feeRate,
    feeSats,
    feeBtc,
    feeFiat,
    transferValueFiat,
    feePercent,
  };
}

export function simulatePriorities({
  amountBtc,
  txVsize,
  priority,
  fees,
  btcFiatPrice,
}) {
  const simulations = Object.fromEntries(
    Object.values(PRIORITIES).map((candidate) => [
      candidate,
      simulateTransaction({
        amountBtc,
        txVsize,
        feeRate: feeRateForPriority(fees, candidate),
        btcFiatPrice,
      }),
    ]),
  );
  if (!simulations[priority]) {
    throw new TypeError(`Unsupported priority: ${priority}`);
  }
  return {
    selected: simulations[priority],
    priorities: simulations,
  };
}

export function formatSimulationSummary({ state, simulation, currency }) {
  const selected = simulation.selected;
  const percent =
    selected.feePercent === null ? "n/a" : `${selected.feePercent.toFixed(4)}%`;
  return `${state.amountBtc} BTC (~${selected.transferValueFiat.toFixed(2)} ${currency})\n${selected.feeRate} sat/vB · ${selected.feeSats} sats\nEstimated network fee: ${selected.feeFiat.toFixed(2)} ${currency} · ${percent} of transfer`;
}
