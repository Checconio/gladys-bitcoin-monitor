import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
} from "@gladysassistant/integration-sdk";
import { getGladysCurrencyUnit } from "../config.js";
import {
  PUBLICATION_PRECISION,
  roundForPublication,
} from "../calculations/precision.js";
import { DEVICE_KEYS, getDeviceIds } from "../constants.js";
import { fiatFeatureName, numericFeature, stateEntries } from "./helpers.js";

export const MARKET_FEATURES = Object.freeze({ PRICE: "bitcoin-price" });

export function buildMarketDevice(gladys, config) {
  const ids = getDeviceIds(gladys, DEVICE_KEYS.MARKET);
  const unit = getGladysCurrencyUnit(config.currency);
  return {
    name: "Bitcoin Market",
    external_id: ids.device,
    features: [
      numericFeature(
        ids,
        MARKET_FEATURES.PRICE,
        fiatFeatureName("Bitcoin price", config.currency, unit),
        {
          category: DEVICE_FEATURE_CATEGORIES.CURRENCY,
          type: DEVICE_FEATURE_TYPES.CURRENCY.DECIMAL,
          unit,
          max: 1e12,
        },
      ),
    ],
  };
}

export function getMarketStates(gladys, data, config) {
  const price = data.prices?.[config.currency];
  return Number.isFinite(price)
    ? stateEntries(gladys, DEVICE_KEYS.MARKET, [
        {
          key: MARKET_FEATURES.PRICE,
          state: roundForPublication(price, PUBLICATION_PRECISION.FIAT_VALUE),
        },
      ])
    : [];
}
