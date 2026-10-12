export const ADVENTURE_LOCAL_PREVIEW_STORAGE_PREFIX = "reefbound-local-playtest-v1:";

export const ADVENTURE_LOCAL_PREVIEW_ACCOUNT = Object.freeze({
  id: "local-playtest",
  email: "Local playtest",
});

export function isAdventureLocalPreviewEnabled(requested, environment) {
  return requested === true && environment === "development";
}

/** Isolate every save key, including backups and legacy migration lookups. */
export function createAdventureLocalPreviewStorage(backend) {
  return Object.freeze({
    getItem(key) { return backend.getItem(`${ADVENTURE_LOCAL_PREVIEW_STORAGE_PREFIX}${key}`); },
    setItem(key, value) { backend.setItem(`${ADVENTURE_LOCAL_PREVIEW_STORAGE_PREFIX}${key}`, value); },
    removeItem(key) { backend.removeItem(`${ADVENTURE_LOCAL_PREVIEW_STORAGE_PREFIX}${key}`); },
  });
}
