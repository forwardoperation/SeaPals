const UINT32_RANGE = 0x100000000;
const MULBERRY_STEP = 0x6D2B79F5;
const DEFAULT_SEED = 0x5EA9A15;

export function isSimulatorRandomStreamState(value) {
  return Boolean(value)
    && typeof value === "object"
    && Number.isInteger(value.seed)
    && value.seed >= 0
    && value.seed < UINT32_RANGE
    && Number.isSafeInteger(value.cursor)
    && value.cursor >= 0;
}

export function createSimulatorRandomStream(seed = DEFAULT_SEED, cursor = 0) {
  const normalizedSeed = Number.isFinite(Number(seed))
    ? Math.trunc(Number(seed)) >>> 0
    : DEFAULT_SEED;
  const normalizedCursor = Number.isSafeInteger(Number(cursor)) && Number(cursor) >= 0
    ? Number(cursor)
    : 0;
  return Object.freeze({ seed: normalizedSeed, cursor: normalizedCursor });
}

export function createSimulatorRandomSeed(random = Math.random, now = Date.now()) {
  const sampled = Math.floor(Math.max(0, Math.min(0.9999999999999999, Number(random()) || 0)) * UINT32_RANGE) >>> 0;
  const timestamp = Math.trunc(Number(now) || 0) >>> 0;
  const mixed = (sampled ^ timestamp ^ 0xA511E9B3) >>> 0;
  return mixed || DEFAULT_SEED;
}

export function sampleSimulatorRandom(streamState) {
  const current = isSimulatorRandomStreamState(streamState)
    ? streamState
    : createSimulatorRandomStream();
  const stepCount = (current.cursor + 1) >>> 0;
  let value = (current.seed + Math.imul(stepCount, MULBERRY_STEP)) >>> 0;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  const sample = ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE;
  return Object.freeze({
    value: sample,
    state: createSimulatorRandomStream(current.seed, current.cursor + 1),
  });
}
