/**
 * Leaf-level persistence contract for the Elverson opening.
 *
 * Save normalization and runtime story orchestration both import these values
 * so a persisted beat can never be accepted by one layer and ignored by the
 * other. Keep this module dependency-free.
 */
export const ADVENTURE_OPENING_CONTENT_VERSION = 1;

export const ADVENTURE_OPENING_STATUS = Object.freeze({
  NOT_STARTED: "notStarted",
  ACTIVE: "active",
  COMPLETE: "complete",
  LEGACY_SKIPPED: "legacySkipped",
});

export const ADVENTURE_OPENING_STATUSES = Object.freeze(
  Object.values(ADVENTURE_OPENING_STATUS),
);

export const ELVERSON_PROLOGUE_BEATS = Object.freeze({
  breakfast: "elverson-opening-breakfast",
  permission: "elverson-opening-permission",
  race: "elverson-opening-race",
  challenge: "elverson-opening-challenge",
  starter: "elverson-opening-starter",
  tutorial: "elverson-opening-tutorial",
  rivalDeparture: "elverson-opening-rival-departure",
});

export const ELVERSON_PROLOGUE_BEAT_IDS = Object.freeze([
  ELVERSON_PROLOGUE_BEATS.breakfast,
  ELVERSON_PROLOGUE_BEATS.permission,
  ELVERSON_PROLOGUE_BEATS.race,
  ELVERSON_PROLOGUE_BEATS.challenge,
  ELVERSON_PROLOGUE_BEATS.starter,
  ELVERSON_PROLOGUE_BEATS.tutorial,
  ELVERSON_PROLOGUE_BEATS.rivalDeparture,
]);
