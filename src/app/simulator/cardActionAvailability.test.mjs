import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCardActionAvailability } from "./cardActionAvailability.mjs";

const READY_ACTION = Object.freeze({
  actionName: "Scavenge",
  actionCost: 2,
  availableRp: 2,
  gamePhase: "main",
  gameOver: false,
  interactionBlocked: false,
  sourceStunned: false,
  usedThisTurn: false,
  currentTurn: 4,
  cooldownUntil: 0,
  specificBlock: null,
});

function evaluate(overrides = {}) {
  return evaluateCardActionAvailability({ ...READY_ACTION, ...overrides });
}

function assertBlocked(result, blockType, reasonPattern, statusPattern) {
  assert.deepEqual(Object.keys(result).sort(), ["blockType", "ready", "reason", "status"]);
  assert.equal(result.ready, false);
  assert.equal(result.blockType, blockType);
  assert.equal(typeof result.reason, "string");
  assert.match(result.reason, reasonPattern);
  assert.equal(typeof result.status, "string");
  assert.match(result.status, statusPattern);
}

test("an action is ready when its shared legality inputs are satisfied", () => {
  const ready = evaluate();
  assert.deepEqual(Object.keys(ready).sort(), ["blockType", "ready", "reason", "status"]);
  assert.equal(ready.ready, true);
  assert.equal(ready.blockType, null);
  assert.match(ready.reason, /Scavenge.*ready/i);
  assert.equal(ready.status, "Ready");
  assert.equal(evaluate({ availableRp: 3 }).ready, true);
  assert.equal(evaluate({ currentTurn: 4, cooldownUntil: 4 }).ready, true);
});

test("the shared evaluator explains an insufficient-RP action", () => {
  assertBlocked(
    evaluate({ availableRp: 1 }),
    "rp",
    /Scavenge.*costs? 2 RP.*(?:have|available) 1 RP/i,
    /(?:need|requires?).*1.*RP/i,
  );
});

test("the shared evaluator explains phase, usage, and cooldown blockers", () => {
  assertBlocked(
    evaluate({ gamePhase: "draw" }),
    "phase",
    /Scavenge.*action phase/i,
    /action phase/i,
  );
  assertBlocked(
    evaluate({ usedThisTurn: true }),
    "used",
    /Scavenge.*used.*this turn/i,
    /used.*turn/i,
  );
  assertBlocked(
    evaluate({ currentTurn: 4, cooldownUntil: 6 }),
    "cooldown",
    /Shatter|turn 6|unavailable/i,
    /turn|cooldown|unavailable/i,
  );
});

test("the shared evaluator explains stunned, in-progress, and ended-game blockers", () => {
  assertBlocked(
    evaluate({ sourceStunned: true }),
    "stunned",
    /Scavenge.*stunned/i,
    /stunned/i,
  );
  assertBlocked(
    evaluate({ interactionBlocked: true }),
    "interaction",
    /finish.*(?:current|card) action/i,
    /finish|current action/i,
  );
  assertBlocked(
    evaluate({ gameOver: true }),
    "game-over",
    /(?:duel|game).*(?:ended|over)/i,
    /game|duel|ended/i,
  );
});

test("a card-specific blocker is preserved for the proxy and execution path", () => {
  const specificBlock = Object.freeze({
    blockType: "targets",
    reason: "Scavenge needs at least one card in your discard pile.",
    status: "Discard empty",
  });
  assert.deepEqual(evaluate({ specificBlock }), {
    ready: false,
    ...specificBlock,
  });
});

test("evaluation is pure and does not mutate the action snapshot", () => {
  const input = {
    ...READY_ACTION,
    specificBlock: {
      blockType: "targets",
      reason: "No legal target.",
      status: "No target",
    },
  };
  const snapshot = structuredClone(input);
  evaluateCardActionAvailability(input);
  assert.deepEqual(input, snapshot);
});
