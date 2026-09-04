export const SIMULATOR_RESUME_SCHEMA_VERSION = 1;
export const SIMULATOR_RESUME_STORAGE_KEY = "seapals.simulator-v2.resume.v1";

const RESTORABLE_GAME_PHASES = new Set(["setup", "draw", "main"]);
const RESTORABLE_STARTING_PLAYERS = new Set(["player", "opponent"]);
const RESUME_SAFE_EVENT_OVERLAY_TYPES = new Set(["utility-result"]);
const EVENT_OVERLAY_CONTINUATION_KEYS = [
  "playerStateAfter",
  "opponentStateAfter",
  "gameResultAfter",
  "continueToEndTurn",
  "continueAttackSequence",
  "beginOpponentAfterClose",
  "advanceRoundAfterClose",
  "startOpeningPlayerTurnAfterClose",
  "continueLiveLionfish",
  "opponentSequence",
];

export const SIMULATOR_RESUME_STATE_KEYS = Object.freeze([
  "selectedDeckId",
  "selectedOpponentDeckId",
  "opponentDifficulty",
  "victoryTarget",
  "foundationDeck",
  "palsDeck",
  "hand",
  "playerCorals",
  "playerHabitatInstances",
  "playerReefCreatureInstances",
  "playerOrphanCreatureInstances",
  "opponent",
  "floatingCardOffsets",
  "ecosystemZoom",
  "ecosystemOffset",
  "opponentEcosystemZoom",
  "opponentEcosystemOffset",
  "playerViewportTouched",
  "opponentViewportTouched",
  "mobileBoardView",
  "mobileReefSplit",
  "discardPile",
  "lostZone",
  "conditionDeck",
  "activeConditionId",
  "persistentConditionIds",
  "conditionDensityUses",
  "schoolDensityCommitmentsByInstanceId",
  "blueCrabRecycleUsedTurn",
  "resilienceUsedCardIds",
  "round",
  "gamePhase",
  "startingPlayer",
  "openingOpponentTurn",
  "turn",
  "rp",
  "hasDrawnThisTurn",
  "turnDrawSelection",
  "turnDrawResult",
  "usedAttackers",
  "actionCooldowns",
  "usedCreatureActions",
  "creatureStatuses",
  "poisonImmunityNextPredatorAttack",
  "rovLightsActive",
  "nextOnPlayAttackBonus",
  "flashingAlarmAttackBonus",
  "supportLockSourceId",
  "supportBlockedUntilRound",
  "cardsBlockedFromPlayThisTurn",
  "log",
  "turnLog",
  "gameResult",
]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isResumeSafeEventOverlay(value) {
  if (value == null) return true;
  if (!isObject(value) || !RESUME_SAFE_EVENT_OVERLAY_TYPES.has(value.type)) return false;
  return !EVENT_OVERLAY_CONTINUATION_KEYS.some((key) => (
    Object.prototype.hasOwnProperty.call(value, key)
  ));
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isNullableString(value) {
  return value == null || isNonEmptyString(value);
}

function isNullableStringArray(value) {
  return Array.isArray(value) && value.every(isNullableString);
}

function isTurnDrawResultEntry(entry) {
  return isObject(entry)
    && isNonEmptyString(entry.cardId)
    && (entry.source === "Foundation" || entry.source === "Pals")
    && typeof entry.discarded === "boolean";
}

function isTurnDrawSelection(selection, state, { activeDraw = false } = {}) {
  if (!isObject(selection)) return false;
  const counts = [
    selection.requested,
    selection.target,
    selection.shortfall,
    selection.foundation,
    selection.pals,
  ];
  if (!counts.every(Number.isInteger)) return false;
  if (
    selection.requested <= 0
    || selection.target < 0
    || selection.target > selection.requested
    || selection.shortfall < 0
    || selection.shortfall !== Math.max(0, selection.requested - selection.target)
    || selection.foundation < 0
    || selection.pals < 0
    || selection.foundation + selection.pals > selection.target
    || !isNullableString(selection.mode)
  ) return false;
  if (!activeDraw) return true;
  return selection.target > 0
    && selection.mode == null
    && selection.foundation <= state.foundationDeck.length
    && selection.pals <= state.palsDeck.length
    && selection.target <= state.foundationDeck.length + state.palsDeck.length;
}

function isStatusEntry(status) {
  return isObject(status)
    && isNonEmptyString(status.type)
    && (status.expiresTurn == null || Number.isFinite(status.expiresTurn))
    && (status.sourceCardId == null || isNonEmptyString(status.sourceCardId))
    && (status.dice == null || isNonEmptyString(status.dice));
}

function isStatusArray(value) {
  return Array.isArray(value) && value.every(isStatusEntry);
}

function isStatusRecord(value) {
  return isObject(value) && Object.values(value).every(isStatusArray);
}

function isFinitePoint(value) {
  return isObject(value) && Number.isFinite(value.x) && Number.isFinite(value.y);
}

function isFoundationSlot(slot) {
  return isObject(slot)
    && isNonEmptyString(slot.id)
    && isNullableString(slot.cardId)
    && isNullableString(slot.cardInstanceId)
    && isNullableStringArray(slot.hostedCardIds);
}

function isFoundation(entry) {
  return isObject(entry)
    && isNonEmptyString(entry.id)
    && isNonEmptyString(entry.cardId)
    && Number.isFinite(entry.health)
    && Number.isFinite(entry.maxHealth)
    && Array.isArray(entry.slots)
    && entry.slots.every(isFoundationSlot)
    && (entry.statuses == null || isStatusArray(entry.statuses))
    && new Set(entry.slots.map((slot) => slot.id)).size === entry.slots.length;
}

function isHabitatInstance(entry) {
  return isObject(entry)
    && isNonEmptyString(entry.instanceId)
    && isNonEmptyString(entry.cardId)
    && Number.isFinite(entry.currentHealth)
    && Number.isFinite(entry.maxHealth);
}

function isCreatureInstance(entry) {
  return isObject(entry)
    && isNonEmptyString(entry.instanceId)
    && isNonEmptyString(entry.cardId)
    && isNullableStringArray(entry.hostedCardIds);
}

function isOffsetRecord(value) {
  return isObject(value) && Object.values(value).every(isFinitePoint);
}

function cloneJsonValue(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function pickRestorableState(source) {
  if (!isObject(source)) return null;
  const picked = {};
  for (const key of SIMULATOR_RESUME_STATE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(source, key)) picked[key] = source[key];
  }
  return cloneJsonValue(picked);
}

function hasUniqueIdentity(entries, identityKey) {
  if (!Array.isArray(entries)) return false;
  const identities = entries.map((entry) => entry?.[identityKey]);
  return identities.every((identity) => typeof identity === "string" && identity)
    && new Set(identities).size === identities.length;
}

function hasUniqueZoneIdentities(state) {
  const opponent = state.opponent;
  return hasUniqueIdentity(state.playerCorals, "id")
    && hasUniqueIdentity(state.playerHabitatInstances, "instanceId")
    && hasUniqueIdentity(state.playerReefCreatureInstances, "instanceId")
    && hasUniqueIdentity(state.playerOrphanCreatureInstances, "instanceId")
    && hasUniqueIdentity(opponent.corals ?? [], "id")
    && hasUniqueIdentity(opponent.habitatInstances ?? [], "instanceId")
    && hasUniqueIdentity(opponent.reefCreatureInstances ?? [], "instanceId")
    && hasUniqueIdentity(opponent.orphanCreatures ?? [], "instanceId");
}

function hasValidOpponentState(opponent) {
  return isObject(opponent)
    && isStringArray(opponent.foundationDeck)
    && isStringArray(opponent.palsDeck)
    && isStringArray(opponent.hand)
    && Array.isArray(opponent.corals)
    && opponent.corals.every(isFoundation)
    && isStringArray(opponent.habitats)
    && Array.isArray(opponent.habitatInstances)
    && opponent.habitatInstances.every(isHabitatInstance)
    && isStringArray(opponent.reefCreatures)
    && Array.isArray(opponent.reefCreatureInstances)
    && opponent.reefCreatureInstances.every(isCreatureInstance)
    && Array.isArray(opponent.orphanCreatures)
    && opponent.orphanCreatures.every(isCreatureInstance)
    && isStringArray(opponent.discardPile)
    && isStringArray(opponent.lostZone)
    && Number.isFinite(opponent.rp)
    && opponent.rp >= 0
    && isObject(opponent.actionCooldowns)
    && isObject(opponent.actionUses)
    && isStatusRecord(opponent.creatureStatuses)
    && isObject(opponent.conditionDensityUses)
    && isObject(opponent.schoolDensityCommitmentsByInstanceId)
    && isStringArray(opponent.resilienceUsedCardIds)
    && opponent.habitats.length === opponent.habitatInstances.length
    && opponent.habitats.every((cardId, index) => cardId === opponent.habitatInstances[index].cardId)
    && opponent.reefCreatures.length === opponent.reefCreatureInstances.length
    && opponent.reefCreatures.every((cardId, index) => cardId === opponent.reefCreatureInstances[index].cardId);
}

function getReferencedCardIds(state) {
  const foundationCards = (foundations = []) => foundations.flatMap((foundation) => [
    foundation.cardId,
    ...(foundation.slots ?? []).flatMap((slot) => [
      slot.cardId,
      ...(slot.hostedCardIds ?? []),
    ]),
  ]);
  const instanceCards = (instances = []) => instances.flatMap((instance) => [
    instance.cardId,
    ...(instance.hostedCardIds ?? []),
  ]);
  return [
    ...state.foundationDeck,
    ...state.palsDeck,
    ...state.hand,
    ...state.discardPile,
    ...state.lostZone,
    ...state.conditionDeck,
    state.activeConditionId,
    ...state.persistentConditionIds,
    ...state.cardsBlockedFromPlayThisTurn,
    ...(state.turnDrawResult ?? []).map((entry) => entry.cardId),
    ...foundationCards(state.playerCorals),
    ...instanceCards(state.playerHabitatInstances),
    ...instanceCards(state.playerReefCreatureInstances),
    ...instanceCards(state.playerOrphanCreatureInstances),
    ...state.opponent.foundationDeck,
    ...state.opponent.palsDeck,
    ...state.opponent.hand,
    ...state.opponent.discardPile,
    ...state.opponent.lostZone,
    ...foundationCards(state.opponent.corals),
    ...instanceCards(state.opponent.habitatInstances),
    ...instanceCards(state.opponent.reefCreatureInstances),
    ...instanceCards(state.opponent.orphanCreatures),
  ].filter((cardId) => cardId != null);
}

export function isSimulatorResumeStateEligible(state) {
  if (!isObject(state) || state.gameResult) return false;
  if (!RESTORABLE_GAME_PHASES.has(state.gamePhase)) return false;
  if (!RESTORABLE_STARTING_PLAYERS.has(state.startingPlayer)) return false;
  if (!isNonEmptyString(state.selectedDeckId) || !isNonEmptyString(state.selectedOpponentDeckId)) return false;
  if (!isNonEmptyString(state.opponentDifficulty)) return false;
  if (!Number.isFinite(state.victoryTarget) || state.victoryTarget <= 0) return false;
  if (!Number.isInteger(state.round) || state.round < 0) return false;
  if (!Number.isInteger(state.turn) || state.turn < 1) return false;
  if (!Number.isFinite(state.rp) || state.rp < 0) return false;
  if (typeof state.hasDrawnThisTurn !== "boolean") return false;
  if (
    !isStringArray(state.foundationDeck)
    || !isStringArray(state.palsDeck)
    || !isStringArray(state.hand)
    || !Array.isArray(state.playerCorals)
    || !state.playerCorals.every(isFoundation)
    || !Array.isArray(state.playerHabitatInstances)
    || !state.playerHabitatInstances.every(isHabitatInstance)
    || !Array.isArray(state.playerReefCreatureInstances)
    || !state.playerReefCreatureInstances.every(isCreatureInstance)
    || !Array.isArray(state.playerOrphanCreatureInstances)
    || !state.playerOrphanCreatureInstances.every(isCreatureInstance)
    || !isStringArray(state.discardPile)
    || !isStringArray(state.lostZone)
    || !isStringArray(state.conditionDeck)
    || !hasValidOpponentState(state.opponent)
  ) return false;
  if (!hasUniqueZoneIdentities(state)) return false;
  if (
    !isObject(state.conditionDensityUses)
    || !isObject(state.schoolDensityCommitmentsByInstanceId)
    || !isStringArray(state.resilienceUsedCardIds)
    || !isStringArray(state.usedAttackers)
    || !isObject(state.actionCooldowns)
    || !isStringArray(state.usedCreatureActions)
    || !isStatusRecord(state.creatureStatuses)
    || !isStringArray(state.cardsBlockedFromPlayThisTurn)
    || !(state.turnDrawResult == null || (
      Array.isArray(state.turnDrawResult)
      && state.turnDrawResult.every(isTurnDrawResultEntry)
    ))
    || !isStringArray(state.log)
    || !isStringArray(state.turnLog)
    || !isOffsetRecord(state.floatingCardOffsets)
    || !Number.isFinite(state.ecosystemZoom)
    || !isFinitePoint(state.ecosystemOffset)
    || !Number.isFinite(state.opponentEcosystemZoom)
    || !isFinitePoint(state.opponentEcosystemOffset)
    || !Number.isFinite(state.mobileReefSplit)
  ) return false;
  if (!isNullableString(state.activeConditionId) || !isStringArray(state.persistentConditionIds)) return false;
  if (state.turnDrawSelection != null && !isTurnDrawSelection(state.turnDrawSelection, state, {
    activeDraw: state.gamePhase === "draw",
  })) return false;
  if (
    state.gamePhase === "draw"
    && (state.hasDrawnThisTurn || !isTurnDrawSelection(state.turnDrawSelection, state, { activeDraw: true }))
  ) return false;
  if (state.gamePhase === "main" && !state.hasDrawnThisTurn) return false;
  if (state.gamePhase === "setup" && state.hasDrawnThisTurn) return false;
  return true;
}

export function isSimulatorResumeCheckpointStable(state) {
  if (!isObject(state)) return false;
  if (!state.resumeCheckpointReady || !state.resumeDecisionResolved || state.resumePromptOpen) return false;
  if (state.gameResult || !RESTORABLE_STARTING_PLAYERS.has(state.startingPlayer)) return false;
  if (!RESTORABLE_GAME_PHASES.has(state.gamePhase)) return false;
  if (state.modal && state.modal !== "turn-draw") return false;
  if (state.gamePhase === "draw" && (state.hasDrawnThisTurn || !isObject(state.turnDrawSelection))) return false;
  const blockingBooleans = [
    "opponentThinking",
    "compactOpponentPlaybackLocked",
    "faceoffRolling",
    "roundFlash",
    "reefDividerDragging",
    "isPanning",
    "isOpponentPanning",
    "simulatorExitConfirmationOpen",
  ];
  if (blockingBooleans.some((key) => Boolean(state[key]))) return false;
  if (!isResumeSafeEventOverlay(state.eventOverlay)) return false;
  const blockingValues = [
    "compactTurnSequence",
    "opponentPlacementFlight",
    "compactOpponentCardReader",
    "combatResultCheckpoint",
    "consumedAttackFlight",
    "cardCoinFlip",
    "playingCardId",
    "pendingCreatureAction",
    "attackContext",
    "searchContext",
    "mobileHandDrag",
    "floatingCardDrag",
    "draggingCoralId",
    "slotDragStart",
    "coralDragStart",
  ];
  if (blockingValues.some((key) => state[key] != null)) return false;
  if (state.setupOpeningHandVisibleCount != null) return false;
  if ((state.pendingEvents?.length ?? 0) > 0) return false;
  if ((state.mobileDrawFlights?.length ?? 0) > 0) return false;
  if ((state.compactRpFlights?.length ?? 0) > 0) return false;
  return true;
}

export function createSimulatorResumeCheckpoint(state, { now = Date.now() } = {}) {
  const restorableState = pickRestorableState(state);
  if (!isSimulatorResumeStateEligible(restorableState)) return null;
  const savedAt = Number(now);
  if (!Number.isFinite(savedAt) || savedAt <= 0) return null;
  return {
    version: SIMULATOR_RESUME_SCHEMA_VERSION,
    savedAt,
    state: restorableState,
  };
}

export function parseSimulatorResumeCheckpoint(rawCheckpoint, { isKnownCardId = null } = {}) {
  try {
    const parsed = typeof rawCheckpoint === "string"
      ? JSON.parse(rawCheckpoint)
      : rawCheckpoint;
    if (!isObject(parsed) || parsed.version !== SIMULATOR_RESUME_SCHEMA_VERSION) return null;
    if (!Number.isFinite(parsed.savedAt) || parsed.savedAt <= 0) return null;
    const state = pickRestorableState(parsed.state);
    if (!isSimulatorResumeStateEligible(state)) return null;
    if (
      typeof isKnownCardId === "function"
      && getReferencedCardIds(state).some((cardId) => !isKnownCardId(cardId))
    ) return null;
    return {
      version: SIMULATOR_RESUME_SCHEMA_VERSION,
      savedAt: parsed.savedAt,
      state,
    };
  } catch {
    return null;
  }
}

export function readSimulatorResumeCheckpoint(storage, options) {
  try {
    if (typeof storage?.getItem !== "function") return null;
    const rawCheckpoint = storage.getItem(SIMULATOR_RESUME_STORAGE_KEY);
    if (!rawCheckpoint) return null;
    const checkpoint = parseSimulatorResumeCheckpoint(rawCheckpoint, options);
    if (!checkpoint) storage?.removeItem?.(SIMULATOR_RESUME_STORAGE_KEY);
    return checkpoint;
  } catch {
    return null;
  }
}

export function writeSimulatorResumeCheckpoint(storage, state, options) {
  const checkpoint = createSimulatorResumeCheckpoint(state, options);
  if (!checkpoint || typeof storage?.setItem !== "function") return false;
  try {
    storage.setItem(SIMULATOR_RESUME_STORAGE_KEY, JSON.stringify(checkpoint));
    return true;
  } catch {
    return false;
  }
}

export function clearSimulatorResumeCheckpoint(storage) {
  if (typeof storage?.removeItem !== "function") return false;
  try {
    storage.removeItem(SIMULATOR_RESUME_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
