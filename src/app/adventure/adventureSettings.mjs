export const ADVENTURE_TEXT_SPEEDS = Object.freeze([
  "slow",
  "normal",
  "fast",
  "instant",
]);

export const DEFAULT_ADVENTURE_SETTINGS = Object.freeze({
  textSpeed: "normal",
  reducedMotion: false,
  highContrast: false,
  boatAutoSteer: false,
});

const TEXT_SPEED_SET = new Set(ADVENTURE_TEXT_SPEEDS);
const BOOLEAN_SETTING_KEYS = Object.freeze([
  "reducedMotion",
  "highContrast",
  "boatAutoSteer",
]);
const SETTING_KEYS = Object.freeze([
  "textSpeed",
  ...BOOLEAN_SETTING_KEYS,
]);
const SETTING_KEY_SET = new Set(SETTING_KEYS);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function settingsMatch(left, right) {
  if (!isRecord(left) || Object.keys(left).length !== SETTING_KEYS.length) return false;
  return SETTING_KEYS.every((key) => left[key] === right[key]);
}

/**
 * Returns the canonical four-field settings shape. This tolerant read helper is
 * useful for legacy or interrupted saves: malformed stored values fall back to
 * the schema's existing defaults and unsupported fields are removed.
 */
export function normalizeAdventureSettings(value) {
  const settings = isRecord(value) ? value : {};
  return {
    textSpeed: TEXT_SPEED_SET.has(settings.textSpeed)
      ? settings.textSpeed
      : DEFAULT_ADVENTURE_SETTINGS.textSpeed,
    reducedMotion: typeof settings.reducedMotion === "boolean"
      ? settings.reducedMotion
      : DEFAULT_ADVENTURE_SETTINGS.reducedMotion,
    highContrast: typeof settings.highContrast === "boolean"
      ? settings.highContrast
      : DEFAULT_ADVENTURE_SETTINGS.highContrast,
    boatAutoSteer: typeof settings.boatAutoSteer === "boolean"
      ? settings.boatAutoSteer
      : DEFAULT_ADVENTURE_SETTINGS.boatAutoSteer,
  };
}

/**
 * Immutably applies a partial settings update to an adventure save. Updates are
 * intentionally strict so a UI cannot silently introduce fields that the save
 * schema does not support. The existing save object is returned for a canonical
 * no-op; malformed stored settings are repaired even when the patch is empty.
 */
export function updateAdventureSettings(saveValue, updatesValue = {}) {
  if (!isRecord(saveValue)) {
    throw new TypeError("Adventure settings require a save object.");
  }
  if (!isRecord(updatesValue)) {
    throw new TypeError("Adventure settings updates must be an object.");
  }

  const updateKeys = Object.keys(updatesValue);
  const unknownKey = updateKeys.find((key) => !SETTING_KEY_SET.has(key));
  if (unknownKey) {
    throw new RangeError(`Unknown adventure setting: ${unknownKey}.`);
  }

  if (
    Object.hasOwn(updatesValue, "textSpeed")
    && !TEXT_SPEED_SET.has(updatesValue.textSpeed)
  ) {
    throw new RangeError(
      `Unknown adventure text speed: ${String(updatesValue.textSpeed)}.`,
    );
  }

  for (const key of BOOLEAN_SETTING_KEYS) {
    if (Object.hasOwn(updatesValue, key) && typeof updatesValue[key] !== "boolean") {
      throw new TypeError(`Adventure setting ${key} must be true or false.`);
    }
  }

  const currentSettings = normalizeAdventureSettings(saveValue.settings);
  const nextSettings = {
    ...currentSettings,
    ...updatesValue,
  };
  const changedKeys = SETTING_KEYS.filter(
    (key) => currentSettings[key] !== nextSettings[key],
  );
  const storedSettingsAreCanonical = settingsMatch(
    saveValue.settings,
    currentSettings,
  );
  const applied = changedKeys.length > 0 || !storedSettingsAreCanonical;

  return {
    applied,
    changedKeys,
    settings: nextSettings,
    save: applied
      ? {
          ...saveValue,
          settings: nextSettings,
        }
      : saveValue,
  };
}
