export const VP_COUNTER_MAX_DURATION_MS = 720;
export const VP_COUNTER_MIN_STEP_MS = 30;
export const VP_COUNTER_MAX_STEP_MS = 92;
export const VP_COUNTER_GLOW_HOLD_MS = 560;

export function normalizeVpCounterValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

export function getVpCounterDirection(from, to) {
  const start = normalizeVpCounterValue(from);
  const target = normalizeVpCounterValue(to);
  if (target === start) return null;
  return target > start ? "gain" : "loss";
}

export function getVpCounterStepDelay(from, to) {
  const distance = Math.abs(normalizeVpCounterValue(to) - normalizeVpCounterValue(from));
  if (!distance) return 0;
  return Math.max(
    VP_COUNTER_MIN_STEP_MS,
    Math.min(VP_COUNTER_MAX_STEP_MS, Math.round(VP_COUNTER_MAX_DURATION_MS / distance)),
  );
}
