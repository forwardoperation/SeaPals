export const MOBILE_STORAGE_KEY = "searealm.mobile.v1";

export function parseStoredValues(raw) {
  if (raw === null || raw === undefined) return {};
  const value = JSON.parse(raw);
  if (!value || value.version !== 1 || !value.values || Array.isArray(value.values)
      || typeof value.values !== "object" || Object.values(value.values).some((entry) => typeof entry !== "string")) {
    throw new Error("This device's saved data could not be read. It has not been replaced.");
  }
  return value.values;
}

// A synchronous Storage interface for the existing game, with serialized,
// retryable writes to native Preferences. Hydrate before mounting React.
export function createDurableStorage(initialValues, persist) {
  const values = new Map(Object.entries(initialValues));
  const listeners = new Set();
  let revision = 0;
  let persistedRevision = 0;
  let writing = null;
  let error = null;
  const notify = () => listeners.forEach((listener) => listener(error));

  function flush() {
    if (writing) return writing;
    if (revision === persistedRevision) return Promise.resolve();
    writing = (async () => {
      while (persistedRevision !== revision) {
        const snapshotRevision = revision;
        const snapshot = JSON.stringify({ version: 1, values: Object.fromEntries(values) });
        await persist(snapshot);
        persistedRevision = snapshotRevision;
      }
      error = null;
      notify();
    })().catch((cause) => {
      error = cause instanceof Error ? cause : new Error(String(cause));
      notify();
      throw error;
    }).finally(() => {
      writing = null;
      if (!error && revision !== persistedRevision) queueMicrotask(() => { void flush().catch(() => {}); });
    });
    return writing;
  }

  function changed() {
    revision += 1;
    // Coalesce synchronous React/game writes. Failed writes remain dirty and
    // retry on the next change or an explicit flush; never erase the last save.
    queueMicrotask(() => { void flush().catch(() => {}); });
  }

  return {
    getItem(key) { return values.get(String(key)) ?? null; },
    setItem(key, value) {
      key = String(key); value = String(value);
      if (values.get(key) === value) return;
      values.set(key, value); changed();
    },
    removeItem(key) { if (values.delete(String(key))) changed(); },
    flush,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    getError() { return error; },
  };
}
