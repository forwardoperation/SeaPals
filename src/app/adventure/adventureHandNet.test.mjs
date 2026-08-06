import assert from "node:assert/strict";
import test from "node:test";

import { ELVERSON_REEF_CATCHES } from "./adventureFishing.mjs";
import {
  HAND_NET_ACTIONS,
  HAND_NET_PHASES,
  applyHandNetAction,
  createHandNetState,
  tickHandNetState,
} from "./adventureHandNet.mjs";

function mutableCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function controlledSingleCreature({ assisted = false, reducedMotion = false } = {}) {
  const state = mutableCopy(createHandNetState({
    seed: 19,
    creatureCount: 1,
    requiredCreatureId: "cleaner-wrasse",
    assisted,
    reducedMotion,
  }));
  state.player.position = { x: 6, y: 7.1 };
  state.player.intent = { x: 0, y: 0 };
  state.player.velocity = { x: 0, y: 0 };
  state.player.facing = { x: 0, y: -1 };
  state.net.position = { x: 6, y: 7.1 - state.net.reach };
  state.creatures[0].position = { x: 6, y: 5.7 };
  state.creatures[0].heading = { x: 0.15, y: -0.988686 };
  state.creatures[0].turnRemainingMs = 10_000;
  state.creatures[0].alert = 0;
  state.creatures[0].status = "wandering";
  return state;
}

function tickRepeatedly(state, elapsedMs, count) {
  let next = state;
  for (let index = 0; index < count; index += 1) next = tickHandNetState(next, elapsedMs);
  return next;
}

test("seeded school generation is deterministic, frozen, and sourced from Elverson catches", () => {
  const first = createHandNetState({
    seed: 2_024,
    creatureCount: 7,
    requiredCreatureId: "french-angelfish",
  });
  const repeated = createHandNetState({
    seed: 2_024,
    creatureCount: 7,
    requiredCreatureId: "french-angelfish",
  });
  const differentSeed = createHandNetState({ seed: 2_025, creatureCount: 7 });
  const knownSpecies = new Set(ELVERSON_REEF_CATCHES.map(({ id }) => id));

  assert.deepEqual(repeated, first);
  assert.notDeepEqual(differentSeed.creatures, first.creatures);
  assert.equal(first.creatures.length, 7);
  assert.equal(first.creatures[0].speciesId, "french-angelfish");
  assert.equal(first.creatures.every(({ speciesId }) => knownSpecies.has(speciesId)), true);
  assert.equal(first.creatures.every(({ cardId }) => typeof cardId === "string" && cardId.length > 0), true);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.player.position), true);
  assert.equal(Object.isFrozen(first.creatures[0]), true);
});

test("fixed simulation steps make replay independent of UI frame partitioning", () => {
  const initial = applyHandNetAction(
    createHandNetState({ seed: 44, creatureCount: 4 }),
    { type: HAND_NET_ACTIONS.MOVE, x: 0.35, y: -0.2 },
  );
  const oneFrame = tickHandNetState(initial, 1_000);
  const manyFrames = tickRepeatedly(initial, 20, 50);
  const serializedReplay = tickHandNetState(JSON.parse(JSON.stringify(initial)), 1_000);

  assert.deepEqual(manyFrames, oneFrame);
  assert.deepEqual(serializedReplay, oneFrame);
  assert.equal(oneFrame.tickCount, 50);
  assert.equal(oneFrame.simulationTimeMs, 1_000);
});

test("move actions drive the player and forward net without mutating prior state", () => {
  const initial = createHandNetState({ seed: 5, creatureCount: 2 });
  const before = structuredClone(initial);
  const moving = applyHandNetAction(initial, {
    type: HAND_NET_ACTIONS.MOVE,
    x: 1,
    y: -1,
  });
  const advanced = tickHandNetState(moving, 500);

  assert.deepEqual(initial, before);
  assert.notStrictEqual(moving, initial);
  assert.ok(advanced.player.position.x > initial.player.position.x);
  assert.ok(advanced.player.position.y < initial.player.position.y);
  assert.ok(advanced.net.position.x > advanced.player.position.x);
  assert.ok(advanced.net.position.y < advanced.player.position.y);
  assert.ok(Math.hypot(
    advanced.net.position.x - advanced.player.position.x,
    advanced.net.position.y - advanced.player.position.y,
  ) <= advanced.net.reach + 1e-9);
  assert.equal(Object.isFrozen(advanced), true);

  const stopped = applyHandNetAction(advanced, { type: HAND_NET_ACTIONS.STOP });
  const stoppedPosition = stopped.player.position;
  const afterStop = tickHandNetState(stopped, 200);
  assert.deepEqual(afterStop.player.position, stoppedPosition);
});

test("creatures wander deterministically and remain inside the shallow-water arena", () => {
  const initial = createHandNetState({ seed: 71, creatureCount: 5 });
  const advanced = tickHandNetState(initial, 2_000);

  assert.equal(
    advanced.creatures.some((creature, index) => (
      creature.position.x !== initial.creatures[index].position.x
      || creature.position.y !== initial.creatures[index].position.y
    )),
    true,
  );
  for (const creature of advanced.creatures) {
    assert.ok(creature.position.x >= 0.45 && creature.position.x <= 11.55);
    assert.ok(creature.position.y >= 0.65 && creature.position.y <= 6.45);
    assert.equal(creature.status, "wandering");
  }
});

test("a quick direct approach raises alert, starts flight, and can end in escape", () => {
  const initial = controlledSingleCreature();
  const approaching = applyHandNetAction(initial, {
    type: HAND_NET_ACTIONS.MOVE,
    x: 0,
    y: -1,
  });
  const alarmed = tickHandNetState(approaching, 700);

  assert.ok(alarmed.creatures[0].alert >= alarmed.settings.alertThreshold);
  assert.ok(["fleeing", "escaped"].includes(alarmed.creatures[0].status));
  assert.equal(alarmed.lastEvent?.type, "creature-fled");

  const stopped = applyHandNetAction(alarmed, { type: HAND_NET_ACTIONS.STOP });
  let escaped = stopped;
  for (let index = 0; index < 10 && escaped.phase === HAND_NET_PHASES.PLAYING; index += 1) {
    escaped = tickHandNetState(escaped, 1_000);
  }
  assert.equal(escaped.phase, HAND_NET_PHASES.ESCAPED);
  assert.equal(escaped.outcome.type, "escaped");
  assert.deepEqual(escaped.outcome.speciesIds, ["cleaner-wrasse"]);
  assert.equal(escaped.creatures[0].status, "escaped");
});

test("assisted mode gives a wider net, longer scoop, and a calmer approach response", () => {
  const standard = createHandNetState({ seed: 8, creatureCount: 1 });
  const assisted = createHandNetState({ seed: 8, creatureCount: 1, assisted: true });
  assert.ok(assisted.net.radius > standard.net.radius);
  assert.ok(assisted.net.reach > standard.net.reach);
  assert.ok(standard.net.reach >= 1.4);
  assert.ok(assisted.settings.scoopWindowMs > standard.settings.scoopWindowMs);
  assert.ok(assisted.settings.cooldownMs < standard.settings.cooldownMs);
  assert.ok(assisted.settings.alertThreshold > standard.settings.alertThreshold);

  const standardApproach = tickHandNetState(applyHandNetAction(
    controlledSingleCreature(),
    { type: HAND_NET_ACTIONS.MOVE, x: 0, y: -1 },
  ), 500);
  const assistedApproach = tickHandNetState(applyHandNetAction(
    controlledSingleCreature({ assisted: true }),
    { type: HAND_NET_ACTIONS.MOVE, x: 0, y: -1 },
  ), 500);

  assert.ok(standardApproach.creatures[0].alert > assistedApproach.creatures[0].alert);
  assert.equal(assistedApproach.creatures[0].status, "wandering");
});

test("the active scoop window catches a creature and reports its matching card", () => {
  const initial = controlledSingleCreature();
  initial.creatures[0].position = { ...initial.net.position };
  initial.creatures[0].turnRemainingMs = 10_000;
  const before = structuredClone(initial);
  const scooping = applyHandNetAction(initial, { type: HAND_NET_ACTIONS.SCOOP });

  assert.equal(scooping.net.scoopRemainingMs, scooping.settings.scoopWindowMs);
  assert.equal(scooping.scoopCount, 1);
  assert.deepEqual(scooping.presentation.netImpact, {
    sequence: 1,
    position: initial.net.position,
  });
  assert.ok(Object.isFrozen(scooping.presentation.netImpact));
  assert.ok(Object.isFrozen(scooping.presentation.netImpact.position));
  assert.equal(scooping.phase, HAND_NET_PHASES.PLAYING);

  const caught = tickHandNetState(scooping, 20);
  assert.equal(caught.phase, HAND_NET_PHASES.CAUGHT);
  assert.equal(caught.outcome.type, "caught");
  assert.equal(caught.outcome.speciesId, "cleaner-wrasse");
  assert.equal(caught.outcome.cardId, "cleaner-wrasse");
  assert.equal(caught.creatures[0].status, "caught");
  assert.equal(caught.net.scoopRemainingMs, 0);
  assert.deepEqual(initial, before);
  assert.strictEqual(
    applyHandNetAction(caught, { type: HAND_NET_ACTIONS.MOVE, x: 1, y: 0 }),
    caught,
  );
  assert.strictEqual(tickHandNetState(caught, 100), caught);
});

test("an empty scoop expires briefly, records the miss, and alerts nearby creatures", () => {
  const standard = controlledSingleCreature();
  standard.creatures[0].position = { x: standard.net.position.x + 1.5, y: standard.net.position.y };
  const started = applyHandNetAction(standard, { type: HAND_NET_ACTIONS.SCOOP });
  const almostFinished = tickHandNetState(started, started.settings.scoopWindowMs - 20);
  const missed = tickHandNetState(almostFinished, 20);

  assert.equal(almostFinished.net.scoopRemainingMs, 20);
  assert.equal(missed.net.scoopRemainingMs, 0);
  assert.equal(missed.net.cooldownRemainingMs, missed.settings.cooldownMs);
  assert.equal(missed.missCount, 1);
  assert.equal(missed.lastEvent.type, "scoop-missed");
  assert.ok(missed.creatures[0].alert > 0);

  const blockedRepeat = applyHandNetAction(missed, { type: HAND_NET_ACTIONS.SCOOP });
  assert.strictEqual(blockedRepeat, missed);

  const firstImpact = started.presentation.netImpact;
  const readyAgain = tickHandNetState(missed, missed.settings.cooldownMs);
  const repeated = applyHandNetAction(readyAgain, { type: HAND_NET_ACTIONS.SCOOP });
  assert.equal(repeated.scoopCount, 2);
  assert.deepEqual(repeated.presentation.netImpact, {
    sequence: 2,
    position: readyAgain.net.position,
  });
  assert.notStrictEqual(repeated.presentation.netImpact, firstImpact);
  assert.deepEqual(started.presentation.netImpact, firstImpact);
});

test("reduced-motion mode slows simulation movement while keeping catch outcomes playable", () => {
  const standard = createHandNetState({ seed: 333, creatureCount: 1 });
  const reduced = createHandNetState({ seed: 333, creatureCount: 1, reducedMotion: true });
  const standardAdvanced = tickHandNetState(standard, 500);
  const reducedAdvanced = tickHandNetState(reduced, 500);
  const standardTravel = Math.hypot(
    standardAdvanced.creatures[0].position.x - standard.creatures[0].position.x,
    standardAdvanced.creatures[0].position.y - standard.creatures[0].position.y,
  );
  const reducedTravel = Math.hypot(
    reducedAdvanced.creatures[0].position.x - reduced.creatures[0].position.x,
    reducedAdvanced.creatures[0].position.y - reduced.creatures[0].position.y,
  );

  assert.equal(reduced.presentation.waveMotion, false);
  assert.ok(reduced.presentation.motionScale < standard.presentation.motionScale);
  assert.ok(reducedTravel < standardTravel);

  const controlled = controlledSingleCreature({ reducedMotion: true });
  controlled.creatures[0].position = { ...controlled.net.position };
  const caught = tickHandNetState(
    applyHandNetAction(controlled, { type: HAND_NET_ACTIONS.SCOOP }),
    20,
  );
  assert.equal(caught.phase, HAND_NET_PHASES.CAUGHT);
});

test("public functions reject malformed options, actions, state, and elapsed time", () => {
  for (const seed of [-1, UINT32_MAX_PLUS_ONE(), 1.5, Number.NaN]) {
    assert.throws(() => createHandNetState({ seed }), /unsigned 32-bit integer/);
  }
  for (const creatureCount of [0, 9, 1.5]) {
    assert.throws(() => createHandNetState({ creatureCount }), /creatureCount/);
  }
  assert.throws(
    () => createHandNetState({ requiredCreatureId: "imaginary-fish" }),
    /Unknown required hand-net creature/,
  );
  assert.throws(() => createHandNetState({ assisted: "yes" }), /assisted must be boolean/);
  assert.throws(() => createHandNetState({ reducedMotion: 1 }), /reducedMotion must be boolean/);

  const state = createHandNetState({ seed: 1, creatureCount: 1 });
  assert.throws(() => applyHandNetAction(state, null), /action requires a type/);
  assert.throws(() => applyHandNetAction(state, { type: "jump" }), /Unknown hand-net action/);
  assert.throws(
    () => applyHandNetAction(state, { type: HAND_NET_ACTIONS.MOVE, x: 2, y: 0 }),
    /between -1 and 1/,
  );
  assert.throws(
    () => applyHandNetAction(state, { type: HAND_NET_ACTIONS.MOVE, x: Number.NaN, y: 0 }),
    /move x must be finite/,
  );
  assert.throws(() => tickHandNetState({}, 20), /state must use version/);
  assert.throws(() => tickHandNetState(state, -1), /elapsedMs must stay between/);
  assert.throws(() => tickHandNetState(state, 10_001), /elapsedMs must stay between/);
  assert.throws(() => tickHandNetState(state, Number.NaN), /elapsedMs must be finite/);
});

function UINT32_MAX_PLUS_ONE() {
  return 0x1_0000_0000;
}
