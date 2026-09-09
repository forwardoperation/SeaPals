function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function resolveCard(cardLookup, cardId) {
  return typeof cardLookup === "function" ? cardLookup(cardId) : cardLookup?.[cardId];
}

function damageKind(foundation, cardLookup) {
  const card = resolveCard(cardLookup, foundation?.cardId);
  if (card?.tags?.includes("creature-school")) return "schoolDamage";
  if (card?.kind === "coral") return "coralDamage";
  return null;
}

function isStunned(foundation) {
  return (foundation?.statuses ?? []).some((status) => status?.type === "stunned");
}

function incurredDamage(foundation) {
  const maxHealth = nonNegativeNumber(foundation?.maxHealth);
  const health = foundation?.health == null ? maxHealth : nonNegativeNumber(foundation.health);
  return Math.max(0, maxHealth - health);
}

/** Copy only the anonymous numeric and foundation fields needed for comparisons. */
export function createSimulatorAnalyticsSnapshot(snapshot = {}) {
  return {
    foundations: (snapshot.foundations ?? []).map((foundation) => ({
      id: foundation.id,
      cardId: foundation.cardId,
      health: foundation.health == null ? null : nonNegativeNumber(foundation.health),
      maxHealth: nonNegativeNumber(foundation.maxHealth),
      statuses: (foundation.statuses ?? []).map((status) => ({ type: status?.type })),
    })),
    rp: nonNegativeNumber(snapshot.rp),
    ecoBoost: nonNegativeNumber(snapshot.ecoBoost),
    schoolDensity: nonNegativeNumber(snapshot.schoolDensity),
    vp: nonNegativeNumber(snapshot.vp),
  };
}

/**
 * Conservative observations between committed board snapshots.
 *
 * Eco Boost is the capacity supplied by cards, excluding the shared Condition;
 * School Density is total capacity, not its available/uncommitted remainder.
 * Both metrics count observed positive changes, so remove-and-replace batches
 * can hide a gain. RP receipts must be recorded at their transaction boundaries:
 * a bank delta cannot distinguish spending and collection in the same action.
 *
 * Damage compares total damage counters on surviving, matching foundations of
 * each kind. This preserves damage through upgrades/continuous HP modifiers,
 * excludes sacrifices/removals, and avoids counting Neural Network transfers.
 * Destruction and damage offset by simultaneous healing need explicit events;
 * these observations must not be presented as complete gross damage totals.
 * Stuns count new transitions into Stunned, not reapplications or turns stunned.
 */
export function getSimulatorAnalyticsSnapshotDelta(previous, next, cardLookup) {
  const delta = {
    ecoBoostGained: 0,
    schoolDensityGained: 0,
    stunsApplied: 0,
    coralDamage: 0,
    schoolDamage: 0,
  };
  if (!previous || !next) return delta;

  delta.ecoBoostGained = Math.max(0, nonNegativeNumber(next.ecoBoost) - nonNegativeNumber(previous.ecoBoost));
  delta.schoolDensityGained = Math.max(0, nonNegativeNumber(next.schoolDensity) - nonNegativeNumber(previous.schoolDensity));

  const previousFoundations = new Map((previous.foundations ?? [])
    .filter((foundation) => foundation?.id != null)
    .map((foundation) => [foundation.id, foundation]));
  const damageChanges = { coralDamage: 0, schoolDamage: 0 };
  for (const foundation of next.foundations ?? []) {
    const prior = previousFoundations.get(foundation?.id);
    if (!prior) continue;
    const kind = damageKind(foundation, cardLookup);
    if (!kind || kind !== damageKind(prior, cardLookup)) continue;
    damageChanges[kind] += incurredDamage(foundation) - incurredDamage(prior);
    if (kind === "coralDamage" && isStunned(foundation) && !isStunned(prior)) delta.stunsApplied += 1;
  }
  delta.coralDamage = Math.max(0, damageChanges.coralDamage);
  delta.schoolDamage = Math.max(0, damageChanges.schoolDamage);
  return delta;
}
