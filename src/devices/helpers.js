import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
} from "@gladysassistant/integration-sdk";

export function numericFeature(
  ids,
  key,
  name,
  {
    category,
    type,
    unit,
    step,
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
    readOnly = true,
    keepHistory = true,
  } = {},
) {
  if (!category || !type) {
    throw new TypeError(
      `A Gladys category and type are required for numeric feature ${key}`,
    );
  }
  const feature = {
    name,
    external_id: ids.feature(key),
    category,
    type,
    min,
    max,
    read_only: readOnly,
    has_feedback: !readOnly,
    keep_history: keepHistory,
  };
  if (unit !== undefined) feature.unit = unit;
  if (step !== undefined) feature.step = step;
  return feature;
}

export function textFeature(
  ids,
  key,
  name,
  { readOnly = true, supportedOptions } = {},
) {
  const feature = {
    name,
    external_id: ids.feature(key),
    category: DEVICE_FEATURE_CATEGORIES.TEXT,
    type: supportedOptions
      ? DEVICE_FEATURE_TYPES.TEXT.SELECT
      : DEVICE_FEATURE_TYPES.TEXT.TEXT,
    min: 0,
    max: 0,
    read_only: readOnly,
    has_feedback: !readOnly,
    keep_history: false,
  };
  if (supportedOptions) feature.supported_options = supportedOptions;
  return feature;
}

export function fiatFeatureName(baseName, currency, unit) {
  return unit === undefined ? `${baseName} (${currency})` : baseName;
}

export function stateEntries(gladys, deviceKey, entries) {
  const ids = gladys.externalIds("bitcoin-monitor", deviceKey);
  return entries.map(({ key, ...state }) => ({
    device_feature_external_id: ids.feature(key),
    ...state,
  }));
}
