export const SIMULATOR_TUTORIAL_CONTRACT_VERSION = 1;

export const SIMULATOR_TUTORIAL_ACTION_TYPES = Object.freeze({
  MATCH_READY: "match-ready",
  RP_COLLECTED: "rp-collected",
  CARD_DRAWN: "card-drawn",
  CARD_BUILT: "card-built",
  ATTACK_RESOLVED: "attack-resolved",
  TURN_ENDED: "turn-ended",
  VP_EARNED: "vp-earned",
});

export const SIMULATOR_TUTORIAL_LIFECYCLE_TYPES = Object.freeze({
  DUEL_STARTED: "duel-started",
  DUEL_RESTARTED: "duel-restarted",
  DUEL_FINISHED: "duel-finished",
  DUEL_EXITED: "duel-exited",
});

const ACTION_TYPE_SET = new Set(Object.values(SIMULATOR_TUTORIAL_ACTION_TYPES));
const EVENT_TYPE_SET = new Set([
  ...ACTION_TYPE_SET,
  ...Object.values(SIMULATOR_TUTORIAL_LIFECYCLE_TYPES),
]);
const ACTORS = new Set(["player", "opponent", "system"]);
const REQUIREMENT_OPERATORS = new Set(["equals", "at-least", "greater-than", "truthy"]);

const DEFAULT_REQUIREMENTS = Object.freeze({
  [SIMULATOR_TUTORIAL_ACTION_TYPES.MATCH_READY]: [
    { path: "actor", operator: "equals", value: "player" },
    { path: "details.foundationCount", operator: "at-least", value: 1 },
  ],
  [SIMULATOR_TUTORIAL_ACTION_TYPES.RP_COLLECTED]: [
    { path: "actor", operator: "equals", value: "player" },
    { path: "details.collected", operator: "at-least", value: 1 },
  ],
  [SIMULATOR_TUTORIAL_ACTION_TYPES.CARD_DRAWN]: [
    { path: "actor", operator: "equals", value: "player" },
    { path: "details.count", operator: "at-least", value: 1 },
  ],
  [SIMULATOR_TUTORIAL_ACTION_TYPES.CARD_BUILT]: [
    { path: "actor", operator: "equals", value: "player" },
    { path: "phase", operator: "equals", value: "main" },
  ],
  [SIMULATOR_TUTORIAL_ACTION_TYPES.ATTACK_RESOLVED]: [
    { path: "actor", operator: "equals", value: "player" },
    { path: "details.accepted", operator: "truthy" },
  ],
  [SIMULATOR_TUTORIAL_ACTION_TYPES.TURN_ENDED]: [
    { path: "actor", operator: "equals", value: "player" },
  ],
  [SIMULATOR_TUTORIAL_ACTION_TYPES.VP_EARNED]: [
    { path: "actor", operator: "equals", value: "player" },
    { path: "details.delta", operator: "greater-than", value: 0 },
  ],
});

export const DEFAULT_SIMULATOR_TUTORIAL_CHECKPOINTS = Object.freeze([
  { id: "tutorial-setup", actionType: "match-ready", instruction: "Set out your deck, hand, RP bank, and play areas." },
  { id: "tutorial-collect-rp", actionType: "rp-collected", instruction: "Collect Resource Points (RP), the energy used to play cards." },
  { id: "tutorial-draw-card", actionType: "card-drawn", instruction: "Draw a card so you have a new option for this turn." },
  { id: "tutorial-build-card", actionType: "card-built", instruction: "Spend RP to build a habitat, foundation, or creature." },
  { id: "tutorial-attack", actionType: "attack-resolved", instruction: "Choose a legal attacker and resolve one attack." },
  { id: "tutorial-end-turn", actionType: "turn-ended", instruction: "End your turn after checking your hand, board, and RP." },
  { id: "tutorial-earn-vp", actionType: "vp-earned", instruction: "Earn Victory Points (VP) by growing a successful ecosystem." },
]);

function requireObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
  return value;
}

function requireText(value, label) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new TypeError(`${label} is required.`);
  return normalized;
}

function requireInteger(value, label, minimum) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < minimum) {
    throw new RangeError(`${label} must be a safe integer of at least ${minimum}.`);
  }
  return normalized;
}

function cloneJson(value, label) {
  let serialized;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new TypeError(`${label} must be JSON serializable.`);
  }
  if (serialized === undefined) throw new TypeError(`${label} must be JSON serializable.`);
  const parsed = JSON.parse(serialized);
  const containsInvalidNumber = (candidate) => {
    if (typeof candidate === "number") return !Number.isFinite(candidate);
    if (Array.isArray(candidate)) return candidate.some(containsInvalidNumber);
    if (candidate && typeof candidate === "object") return Object.values(candidate).some(containsInvalidNumber);
    return false;
  };
  if (containsInvalidNumber(value)) throw new TypeError(`${label} cannot contain non-finite numbers.`);
  return parsed;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function normalizeRequirement(requirement, label) {
  const value = requireObject(requirement, label);
  const path = requireText(value.path, `${label}.path`);
  if (!/^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)*$/.test(path)) {
    throw new TypeError(`${label}.path must be a dot-separated event field path.`);
  }
  const operator = requireText(value.operator, `${label}.operator`);
  if (!REQUIREMENT_OPERATORS.has(operator)) throw new RangeError(`${label}.operator is unsupported.`);
  if (operator === "truthy") return { path, operator };
  return { path, operator, value: cloneJson(value.value, `${label}.value`) };
}

function normalizeCheckpoint(checkpoint, index) {
  const value = requireObject(checkpoint, `checkpoints[${index}]`);
  const id = requireText(value.id, `checkpoints[${index}].id`);
  const actionType = requireText(value.actionType, `checkpoints[${index}].actionType`);
  if (!ACTION_TYPE_SET.has(actionType)) throw new RangeError(`checkpoints[${index}].actionType is unsupported.`);
  const suppliedRequirements = value.requirements ?? DEFAULT_REQUIREMENTS[actionType] ?? [];
  if (!Array.isArray(suppliedRequirements)) throw new TypeError(`checkpoints[${index}].requirements must be an array.`);
  return {
    id,
    actionType,
    title: requireText(value.title ?? `Step ${index + 1}`, `checkpoints[${index}].title`),
    instruction: requireText(value.instruction, `checkpoints[${index}].instruction`),
    requirements: suppliedRequirements.map((requirement, requirementIndex) => (
      normalizeRequirement(requirement, `checkpoints[${index}].requirements[${requirementIndex}]`)
    )),
  };
}

export function createSimulatorTutorialContract(input = {}) {
  const value = requireObject(input, "Tutorial contract input");
  const checkpointsInput = value.checkpoints ?? DEFAULT_SIMULATOR_TUTORIAL_CHECKPOINTS;
  if (!Array.isArray(checkpointsInput) || !checkpointsInput.length) {
    throw new TypeError("Tutorial checkpoints must be a non-empty array.");
  }
  const checkpoints = checkpointsInput.map(normalizeCheckpoint);
  const checkpointIds = checkpoints.map((checkpoint) => checkpoint.id);
  if (new Set(checkpointIds).size !== checkpointIds.length) throw new TypeError("Tutorial checkpoint ids must be unique.");
  return deepFreeze({
    contractVersion: SIMULATOR_TUTORIAL_CONTRACT_VERSION,
    id: requireText(value.id ?? value.tutorialId ?? "tutorial-shellshore-live-basics", "Tutorial id"),
    title: requireText(value.title ?? "SeaPals Live Tutorial", "Tutorial title"),
    ordered: value.ordered !== false,
    checkpoints,
  });
}

export function createSimulatorTutorialEvent(input) {
  const value = requireObject(input, "Tutorial event input");
  const type = requireText(value.type ?? value.actionType, "Tutorial event type");
  if (!EVENT_TYPE_SET.has(type)) throw new RangeError(`Unsupported tutorial event type: ${type}.`);
  const actor = requireText(value.actor ?? "system", "Tutorial event actor");
  if (!ACTORS.has(actor)) throw new RangeError(`Unsupported tutorial event actor: ${actor}.`);
  return deepFreeze({
    contractVersion: SIMULATOR_TUTORIAL_CONTRACT_VERSION,
    eventId: requireText(value.eventId, "Tutorial event id"),
    tutorialId: requireText(value.tutorialId, "Tutorial id"),
    actionType: type,
    actor,
    phase: requireText(value.phase, "Tutorial event phase"),
    round: requireInteger(value.round, "Tutorial event round", 0),
    turn: requireInteger(value.turn, "Tutorial event turn", 1),
    details: cloneJson(value.details ?? {}, "Tutorial event details"),
  });
}

export function createSimulatorTutorialProgress(contractInput, options = {}) {
  const contract = contractInput?.contractVersion === SIMULATOR_TUTORIAL_CONTRACT_VERSION
    ? contractInput
    : createSimulatorTutorialContract(contractInput);
  const suppliedCompletedCheckpointIds = options.completedCheckpointIds ?? options.completedStepIds;
  const completedCheckpointIds = Array.isArray(suppliedCompletedCheckpointIds)
    ? suppliedCompletedCheckpointIds.filter((id) => contract.checkpoints.some((checkpoint) => checkpoint.id === id))
    : [];
  const orderedPrefix = [];
  for (const checkpoint of contract.checkpoints) {
    if (!completedCheckpointIds.includes(checkpoint.id)) break;
    orderedPrefix.push(checkpoint.id);
  }
  return deepFreeze({
    contractVersion: SIMULATOR_TUTORIAL_CONTRACT_VERSION,
    tutorialId: contract.id,
    attempt: requireInteger(options.attempt ?? 1, "Tutorial attempt", 1),
    status: orderedPrefix.length === contract.checkpoints.length ? "complete" : "active",
    completedCheckpointIds: orderedPrefix,
    observedEventIds: [],
    deferredCheckpointEvents: {},
    nextCheckpointId: contract.checkpoints[orderedPrefix.length]?.id ?? null,
    lastEvent: null,
    lastDuelOutcome: null,
  });
}

function getPathValue(value, path) {
  return path.split(".").reduce((current, segment) => current?.[segment], value);
}

function matchesRequirement(event, requirement) {
  const actual = getPathValue(event, requirement.path);
  if (requirement.operator === "equals") return actual === requirement.value;
  if (requirement.operator === "at-least") return Number(actual) >= Number(requirement.value);
  if (requirement.operator === "greater-than") return Number(actual) > Number(requirement.value);
  if (requirement.operator === "truthy") return Boolean(actual);
  return false;
}

export function getSimulatorTutorialCurrentCheckpoint(contract, progress) {
  if (!contract || !progress?.nextCheckpointId) return null;
  return contract.checkpoints.find((checkpoint) => checkpoint.id === progress.nextCheckpointId) ?? null;
}

export function observeSimulatorTutorialEvent(contract, progress, event) {
  if (contract.id !== progress?.tutorialId || contract.id !== event?.tutorialId) {
    throw new RangeError("Tutorial contract, progress, and event must use the same tutorial id.");
  }
  if (event.contractVersion !== SIMULATOR_TUTORIAL_CONTRACT_VERSION) {
    throw new RangeError("Tutorial event contract version is unsupported.");
  }
  if (progress.observedEventIds.includes(event.eventId)) {
    return { progress, checkpointEvent: null, checkpointEvents: [], checkpoint: null, accepted: false, reason: "duplicate-event" };
  }

  const currentCheckpoint = getSimulatorTutorialCurrentCheckpoint(contract, progress);
  const matchesCurrent = Boolean(
    currentCheckpoint
    && event.actionType === currentCheckpoint.actionType
    && currentCheckpoint.requirements.every((requirement) => matchesRequirement(event, requirement)),
  );
  let completedCheckpointIds = matchesCurrent
    ? [...progress.completedCheckpointIds, currentCheckpoint.id]
    : progress.completedCheckpointIds;
  const checkpointEvents = matchesCurrent
    ? [deepFreeze({ ...event, checkpointId: currentCheckpoint.id })]
    : [];
  const deferredCheckpointEvents = { ...(progress.deferredCheckpointEvents ?? {}) };
  if (!matchesCurrent && event.actionType === SIMULATOR_TUTORIAL_ACTION_TYPES.VP_EARNED) {
    const futureCheckpoint = contract.checkpoints.slice(completedCheckpointIds.length + 1).find((checkpoint) => (
      checkpoint.actionType === event.actionType
      && checkpoint.requirements.every((requirement) => matchesRequirement(event, requirement))
    ));
    if (futureCheckpoint && !deferredCheckpointEvents[futureCheckpoint.id]) {
      deferredCheckpointEvents[futureCheckpoint.id] = event;
    }
  }

  let nextCheckpoint = contract.checkpoints[completedCheckpointIds.length] ?? null;
  while (nextCheckpoint && deferredCheckpointEvents[nextCheckpoint.id]) {
    const deferredEvent = deferredCheckpointEvents[nextCheckpoint.id];
    completedCheckpointIds = [...completedCheckpointIds, nextCheckpoint.id];
    checkpointEvents.push(deepFreeze({ ...deferredEvent, checkpointId: nextCheckpoint.id }));
    delete deferredCheckpointEvents[nextCheckpoint.id];
    nextCheckpoint = contract.checkpoints[completedCheckpointIds.length] ?? null;
  }
  const lifecycleStatus = event.actionType === SIMULATOR_TUTORIAL_LIFECYCLE_TYPES.DUEL_EXITED && nextCheckpoint
    ? "exited"
    : nextCheckpoint
      ? "active"
      : "complete";
  const nextProgress = deepFreeze({
    ...progress,
    status: lifecycleStatus,
    completedCheckpointIds,
    observedEventIds: [...progress.observedEventIds, event.eventId],
    deferredCheckpointEvents,
    nextCheckpointId: nextCheckpoint?.id ?? null,
    lastEvent: event,
    lastDuelOutcome: event.actionType === SIMULATOR_TUTORIAL_LIFECYCLE_TYPES.DUEL_FINISHED
      ? String(event.details.outcome ?? "") || null
      : progress.lastDuelOutcome,
  });
  const checkpointEvent = checkpointEvents[0] ?? null;
  return {
    progress: nextProgress,
    checkpointEvent,
    checkpointEvents,
    checkpoint: matchesCurrent ? currentCheckpoint : null,
    accepted: true,
    reason: checkpointEvents.length ? "checkpoint-completed" : currentCheckpoint ? "waiting-for-current-checkpoint" : "tutorial-complete",
  };
}

export function restartSimulatorTutorialProgress(contract, progress) {
  return createSimulatorTutorialProgress(contract, {
    attempt: Number(progress?.attempt ?? 0) + 1,
    completedCheckpointIds: progress?.completedCheckpointIds ?? [],
  });
}
