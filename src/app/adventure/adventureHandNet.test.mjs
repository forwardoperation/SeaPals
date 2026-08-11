import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ELVERSON_BAITS_BY_ID } from "./adventureBait.mjs";
import { ELVERSON_REEF_CATCHES } from "./adventureFishing.mjs";
import {
  HAND_NET_ACTIONS,
  HAND_NET_BAIT_PLACEMENT_PHASES,
  HAND_NET_PHASES,
  HAND_NET_ROCKS,
  HAND_NET_SCOOP_PHASES,
  HAND_NET_SIMULATION_STEP_MS,
  applyHandNetAction,
  consumeHandNetFrameElapsed,
  createHandNetState,
  getHandNetEffectiveCatchRadius,
  interpolateHandNetRenderPositions,
  tickHandNetState,
} from "./adventureHandNet.mjs";

const handNetSource = readFileSync(new URL("./adventureHandNet.mjs", import.meta.url), "utf8");

function mutableCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function controlledSingleCreature({
  reducedMotion = false,
  speciesId = "cleaner-wrasse",
} = {}) {
  const state = mutableCopy(createHandNetState({
    seed: 19,
    creatureCount: 1,
    requiredCreatureId: speciesId,
    reducedMotion,
  }));
  state.player.position = { x: 6, y: 7.1 };
  state.player.intent = { x: 0, y: 0 };
  state.player.velocity = { x: 0, y: 0 };
  state.player.facing = { x: Math.SQRT1_2, y: -Math.SQRT1_2 };
  const atlasLandingLength = Math.hypot(1, -0.1);
  state.net.position = {
    x: 6 + (1 / atlasLandingLength) * state.net.reach,
    y: 7.1 + (-0.1 / atlasLandingLength) * state.net.reach,
  };
  state.creatures[0].position = { ...state.net.position };
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

function tickForDuration(state, durationMs) {
  let next = state;
  let remainingMs = durationMs;
  while (remainingMs > 0) {
    const elapsedMs = Math.min(10_000, remainingMs);
    next = tickHandNetState(next, elapsedMs);
    remainingMs -= elapsedMs;
  }
  return next;
}

function beginBaitPlacement(state, definition) {
  return applyHandNetAction(state, {
    type: HAND_NET_ACTIONS.PLACE_BAIT,
    baitId: definition.id,
  });
}

function settleBait(state, definition) {
  return tickHandNetState(
    beginBaitPlacement(state, definition),
    state.settings.baitPlacementReleaseMs,
  );
}

function waitingCreatures(state) {
  return state.creatures.filter(({ status }) => status === "waiting");
}

function controlledHiddenCreature({ hideRemainingMs = 5_000 } = {}) {
  const state = controlledSingleCreature({ speciesId: "cleaner-wrasse" });
  const rock = state.rocks[0];
  const creature = state.creatures[0];
  creature.position = { ...rock.position };
  creature.heading = { x: 1, y: 0 };
  creature.alert = 1;
  creature.status = "hidden";
  creature.homeRockId = rock.id;
  creature.seekingRockId = null;
  creature.hiddenByRockId = rock.id;
  creature.hideRemainingMs = hideRemainingMs;
  creature.baitTargetId = null;
  return { state, creature, rock };
}

function placeNetAt(state, position) {
  const landingLength = Math.hypot(1, -0.1);
  state.player.position = {
    x: position.x - (1 / landingLength) * state.net.reach,
    y: position.y - (-0.1 / landingLength) * state.net.reach,
  };
  state.player.intent = { x: 0, y: 0 };
  state.player.velocity = { x: 0, y: 0 };
  state.player.facing = { x: Math.SQRT1_2, y: -Math.SQRT1_2 };
  state.net.position = { ...position };
  return state;
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

test("authored hand-net rocks are frozen geometry copied into every attempt", () => {
  const state = createHandNetState({ seed: 31, creatureCount: 2 });

  assert.equal(Object.isFrozen(HAND_NET_ROCKS), true);
  assert.deepEqual(state.rocks, HAND_NET_ROCKS);
  assert.notStrictEqual(state.rocks, HAND_NET_ROCKS);
  assert.equal(Object.isFrozen(state.rocks), true);
  assert.equal(new Set(state.rocks.map(({ id }) => id)).size, state.rocks.length);
  for (const [index, rock] of state.rocks.entries()) {
    assert.equal(Object.isFrozen(HAND_NET_ROCKS[index]), true);
    assert.equal(Object.isFrozen(HAND_NET_ROCKS[index].position), true);
    assert.equal(Object.isFrozen(HAND_NET_ROCKS[index].coverRadius), true);
    assert.equal(Object.isFrozen(rock), true);
    assert.equal(Object.isFrozen(rock.position), true);
    assert.equal(Object.isFrozen(rock.coverRadius), true);
    assert.ok(rock.position.x > 0 && rock.position.x < state.arena.width);
    assert.ok(rock.position.y > 0 && rock.position.y < state.arena.height);
    assert.ok(rock.shelterRadius > 0);
    assert.ok(rock.influenceRadius > rock.shelterRadius);
    assert.ok(rock.coverRadius.x >= rock.shelterRadius);
    assert.ok(rock.coverRadius.y > 0);
  }
});

test("population caps preallocate stable waiting slots while creatureCount controls the initial school", () => {
  const state = createHandNetState({
    seed: 2_606,
    creatureCount: 2,
    populationCap: 6,
    requiredCreatureId: "cleaner-wrasse",
  });
  const ids = state.creatures.map(({ id }) => id);

  assert.equal(state.population.initialCount, 2);
  assert.equal(state.population.cap, 6);
  assert.equal(state.creatures.length, 6);
  assert.equal(new Set(ids).size, 6);
  assert.equal(state.creatures.filter(({ status }) => status !== "waiting").length, 2);
  assert.equal(state.creatures.filter(({ status }) => status === "wandering").length, 2);
  assert.equal(waitingCreatures(state).length, 4);
  assert.equal(state.creatures.slice(2).every(({ spawnedAtMs }) => spawnedAtMs === null), true);
  assert.equal(Object.isFrozen(state.population), true);
  assert.equal(Object.isFrozen(state.creatures), true);
});

test("a calm player gets the first arrival at 2600ms deterministically, then fills only to the cap", () => {
  const initial = createHandNetState({
    seed: 4_204,
    creatureCount: 2,
    populationCap: 5,
  });
  const stableIds = initial.creatures.map(({ id }) => id);
  const beforeArrival = tickHandNetState(initial, 2_580);

  assert.equal(beforeArrival.population.stillnessMs, 2_580);
  assert.equal(beforeArrival.population.arrivalCount, 0);
  assert.equal(waitingCreatures(beforeArrival).length, 3);

  const oneTickLater = tickHandNetState(beforeArrival, HAND_NET_SIMULATION_STEP_MS);
  const oneShot = tickHandNetState(initial, 2_600);
  const evenPartitions = tickRepeatedly(initial, HAND_NET_SIMULATION_STEP_MS, 130);
  const unevenPartitions = [377, 611, 1_612].reduce(
    (state, elapsedMs) => tickHandNetState(state, elapsedMs),
    initial,
  );

  assert.deepEqual(oneTickLater, oneShot);
  assert.deepEqual(evenPartitions, oneShot);
  assert.deepEqual(unevenPartitions, oneShot);
  assert.equal(oneShot.population.arrivalCount, 1);
  assert.equal(oneShot.population.stillnessMs, 0);
  assert.equal(waitingCreatures(oneShot).length, 2);
  assert.deepEqual(oneShot.creatures.map(({ id }) => id), stableIds);
  assert.equal(oneShot.lastEvent.type, "creature-arrived");
  assert.equal(oneShot.lastEvent.atMs, 2_600);
  assert.equal(
    oneShot.creatures.find(({ id }) => id === oneShot.lastEvent.creatureId)?.spawnedAtMs,
    2_600,
  );

  let capped = oneShot;
  while (waitingCreatures(capped).length > 0) {
    capped = tickForDuration(
      capped,
      capped.population.nextArrivalMs + HAND_NET_SIMULATION_STEP_MS,
    );
  }
  assert.equal(capped.population.arrivalCount, 3);
  assert.equal(capped.creatures.length, capped.population.cap);
  assert.equal(waitingCreatures(capped).length, 0);
  assert.deepEqual(capped.creatures.map(({ id }) => id), stableIds);

  const afterExtraCalm = tickHandNetState(capped, 10_000);
  assert.equal(afterExtraCalm.population.arrivalCount, capped.population.arrivalCount);
  assert.equal(afterExtraCalm.creatures.length, capped.creatures.length);
});

test("movement resets calm time while scoop and bait placement hold it at zero", () => {
  const calm = tickHandNetState(
    createHandNetState({ seed: 802, creatureCount: 1, populationCap: 2 }),
    1_000,
  );
  assert.equal(calm.population.stillnessMs, 1_000);

  const moving = applyHandNetAction(calm, { type: HAND_NET_ACTIONS.MOVE, x: 1, y: 0 });
  assert.equal(moving.population.stillnessMs, 0);
  const whileMoving = tickHandNetState(moving, 200);
  assert.equal(whileMoving.population.stillnessMs, 0);
  const stopped = applyHandNetAction(whileMoving, { type: HAND_NET_ACTIONS.STOP });
  assert.equal(tickHandNetState(stopped, HAND_NET_SIMULATION_STEP_MS).population.stillnessMs, 20);

  const scooping = applyHandNetAction(calm, { type: HAND_NET_ACTIONS.SCOOP });
  assert.equal(scooping.population.stillnessMs, 0);
  assert.equal(tickHandNetState(scooping, 200).population.stillnessMs, 0);

  const bait = ELVERSON_BAITS_BY_ID["bait-plankton-puff"];
  const placingBait = beginBaitPlacement(calm, bait);
  assert.equal(placingBait.population.stillnessMs, 0);
  assert.equal(tickHandNetState(placingBait, 200).population.stillnessMs, 0);
});

test("cleaner wrasses are much smaller rock-affine residents with a stable home shelter", () => {
  const wrasseState = createHandNetState({
    seed: 93,
    creatureCount: 1,
    requiredCreatureId: "cleaner-wrasse",
  });
  const gruntState = createHandNetState({
    seed: 93,
    creatureCount: 1,
    requiredCreatureId: "white-grunt",
  });
  const wrasse = wrasseState.creatures[0];
  const grunt = gruntState.creatures[0];
  const homeRock = wrasseState.rocks.find(({ id }) => id === wrasse.homeRockId);

  assert.ok(wrasse.visualScale < grunt.visualScale * 0.5);
  assert.ok(wrasse.radius < grunt.radius * 0.5);
  assert.equal(wrasse.rockAffine, true);
  assert.ok(homeRock, "cleaner wrasses must receive an authored home rock");
  const normalizedCoverDistance = (
    ((wrasse.position.x - homeRock.position.x) / homeRock.coverRadius.x) ** 2
    + ((wrasse.position.y - homeRock.position.y) / homeRock.coverRadius.y) ** 2
  );
  assert.ok(normalizedCoverDistance > 1, "a catchable resident must begin outside the painted rock cover");
  assert.ok(
    Math.hypot(
      wrasse.position.x - homeRock.position.x,
      wrasse.position.y - homeRock.position.y,
    ) < homeRock.influenceRadius * wrasse.homeRangeScale,
  );
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

test("display frames retain partial time and request React updates only for whole simulation steps", () => {
  assert.equal(HAND_NET_SIMULATION_STEP_MS, 20);
  assert.deepEqual(consumeHandNetFrameElapsed(0, 19), {
    simulationElapsedMs: 0,
    remainderMs: 19,
  });
  assert.deepEqual(consumeHandNetFrameElapsed(19, 100), {
    simulationElapsedMs: 100,
    remainderMs: 19,
  }, "a clamped long frame must not discard its carried partial step");

  let remainderMs = 0;
  let simulatedMs = 0;
  let reactUpdateCount = 0;
  const refreshRate = 165;
  for (let frame = 0; frame < refreshRate * 60; frame += 1) {
    const partition = consumeHandNetFrameElapsed(remainderMs, 1_000 / refreshRate);
    remainderMs = partition.remainderMs;
    simulatedMs += partition.simulationElapsedMs;
    if (partition.simulationElapsedMs > 0) reactUpdateCount += 1;
  }

  assert.equal(simulatedMs, 60_000);
  assert.equal(reactUpdateCount, 3_000, "a high-refresh display should commit at the 50 Hz simulation rate");
  assert.ok(remainderMs < 1e-7);
});

test("render positions interpolate immutable fixed-step snapshots", () => {
  const previous = applyHandNetAction(
    createHandNetState({ seed: 71, creatureCount: 2 }),
    { type: HAND_NET_ACTIONS.MOVE, x: 1, y: 0 },
  );
  const previousCopy = structuredClone(previous);
  const current = tickHandNetState(previous, HAND_NET_SIMULATION_STEP_MS);
  const midpoint = interpolateHandNetRenderPositions(previous, current, 10);

  assert.equal(midpoint.interpolationAlpha, 0.5);
  assert.equal(
    midpoint.player.position.x,
    (previous.player.position.x + current.player.position.x) / 2,
  );
  assert.equal(
    midpoint.player.position.y,
    (previous.player.position.y + current.player.position.y) / 2,
  );
  assert.equal(midpoint.creatures[0].id, previous.creatures[0].id);
  assert.equal(
    midpoint.creatures[0].position.x,
    (previous.creatures[0].position.x + current.creatures[0].position.x) / 2,
  );
  assert.deepEqual(previous, previousCopy);
  assert.equal(Object.isFrozen(midpoint), true);
  assert.equal(Object.isFrozen(midpoint.player.position), true);

  const start = interpolateHandNetRenderPositions(previous, current, 0);
  assert.deepEqual(start.player.position, previous.player.position);
  const nearEnd = interpolateHandNetRenderPositions(previous, current, 19.999);
  assert.ok(Math.abs(nearEnd.player.position.x - current.player.position.x) < 0.00001);

  assert.throws(
    () => interpolateHandNetRenderPositions(previous, current, 20),
    /render remainderMs/,
  );
  const mismatched = mutableCopy(current);
  mismatched.creatures[0].id = "different-creature";
  assert.throws(
    () => interpolateHandNetRenderPositions(previous, mismatched, 10),
    /missing creature/,
  );
});

test("render interpolation gives every common desktop refresh an even movement delta", () => {
  for (const refreshRate of [60, 120, 144, 165]) {
    const initial = applyHandNetAction(
      createHandNetState({ seed: 81, creatureCount: 1 }),
      { type: HAND_NET_ACTIONS.MOVE, x: 1, y: 0 },
    );
    const clock = { previous: initial, current: initial, remainderMs: 0 };
    const deltas = [];
    let priorX = null;
    const frameCount = Math.floor(refreshRate / 2);
    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const frame = consumeHandNetFrameElapsed(clock.remainderMs, 1_000 / refreshRate);
      clock.remainderMs = frame.remainderMs;
      for (
        let simulationElapsedMs = frame.simulationElapsedMs;
        simulationElapsedMs > 0;
        simulationElapsedMs -= HAND_NET_SIMULATION_STEP_MS
      ) {
        clock.previous = clock.current;
        clock.current = tickHandNetState(clock.current, HAND_NET_SIMULATION_STEP_MS);
      }
      const render = interpolateHandNetRenderPositions(
        clock.previous,
        clock.current,
        clock.remainderMs,
      );
      if (priorX !== null && frameIndex >= 5) {
        deltas.push(render.player.position.x - priorX);
      }
      priorX = render.player.position.x;
    }

    const expectedDelta = initial.player.speed / refreshRate;
    assert.ok(deltas.length > 0);
    assert.equal(
      deltas.every((delta) => delta > 0),
      true,
      `${refreshRate} Hz rendering must not hold a 50 Hz position for a display frame`,
    );
    for (const delta of deltas) {
      assert.ok(
        Math.abs(delta - expectedDelta) < 1e-9,
        `${refreshRate} Hz displacement should be uniform`,
      );
    }
  }
});

test("long display frames retain adjacent interpolation endpoints", () => {
  const initial = applyHandNetAction(
    createHandNetState({ seed: 91, creatureCount: 1 }),
    { type: HAND_NET_ACTIONS.MOVE, x: 1, y: 0 },
  );
  const frame = consumeHandNetFrameElapsed(0, 100);
  const clock = { previous: initial, current: initial, remainderMs: frame.remainderMs };
  for (
    let simulationElapsedMs = frame.simulationElapsedMs;
    simulationElapsedMs > 0;
    simulationElapsedMs -= HAND_NET_SIMULATION_STEP_MS
  ) {
    clock.previous = clock.current;
    clock.current = tickHandNetState(clock.current, HAND_NET_SIMULATION_STEP_MS);
  }

  assert.equal(clock.previous.tickCount, 4);
  assert.equal(clock.current.tickCount, 5);
  assert.equal(
    clock.current.simulationTimeMs - clock.previous.simulationTimeMs,
    HAND_NET_SIMULATION_STEP_MS,
  );
  assert.deepEqual(
    interpolateHandNetRenderPositions(
      clock.previous,
      clock.current,
      clock.remainderMs,
    ).player.position,
    clock.previous.player.position,
  );
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

test("repeating an unchanged move intent preserves state identity and walk cadence", () => {
  const initial = createHandNetState({ seed: 6, creatureCount: 2 });
  const moving = applyHandNetAction(initial, {
    type: HAND_NET_ACTIONS.MOVE,
    x: 1,
    y: -1,
  });
  const repeated = applyHandNetAction(moving, {
    type: HAND_NET_ACTIONS.MOVE,
    x: 1,
    y: -1,
  });
  assert.strictEqual(repeated, moving);

  const advanced = tickHandNetState(moving, 120);
  assert.strictEqual(applyHandNetAction(advanced, {
    type: HAND_NET_ACTIONS.MOVE,
    x: 1,
    y: -1,
  }), advanced);
  assert.equal(advanced.presentation.walkElapsedMs, 120);

  const redirected = applyHandNetAction(advanced, {
    type: HAND_NET_ACTIONS.MOVE,
    x: -1,
    y: 0,
  });
  assert.notStrictEqual(redirected, advanced);
  assert.equal(redirected.presentation.walkElapsedMs, 120);
});

test("walk presentation starts predictably, advances locally, and resets when movement stops", () => {
  assert.match(handNetSource, /const WALK_FRAME_DURATION_MS = 110;/);
  assert.match(handNetSource, /const WALK_FRAME_SEQUENCE = Object\.freeze\(\[1, 0, 2, 0\]\);/);

  const initial = createHandNetState({ seed: 15, creatureCount: 1 });
  const idled = tickHandNetState(initial, 1_000);
  assert.equal(idled.presentation.walkElapsedMs, 0);
  assert.equal(idled.presentation.walkFrameIndex, 0);

  const started = applyHandNetAction(idled, { type: HAND_NET_ACTIONS.MOVE, x: 1, y: 0 });
  assert.equal(started.presentation.walkElapsedMs, 0);
  assert.equal(started.presentation.walkFrameIndex, 1, "movement immediately plants the first stepping leg");

  const firstPose = tickHandNetState(started, 100);
  assert.equal(firstPose.presentation.walkElapsedMs, 100);
  assert.equal(firstPose.presentation.walkFrameIndex, 1);
  const secondPose = tickHandNetState(firstPose, 20);
  assert.equal(secondPose.presentation.walkElapsedMs, 120);
  assert.equal(secondPose.presentation.walkFrameIndex, 0, "neutral separates the two planted steps");
  const thirdPose = tickHandNetState(secondPose, 100);
  assert.equal(thirdPose.presentation.walkElapsedMs, 220);
  assert.equal(thirdPose.presentation.walkFrameIndex, 2);
  const oppositeStep = tickHandNetState(thirdPose, 120);
  assert.equal(oppositeStep.presentation.walkElapsedMs, 340);
  assert.equal(oppositeStep.presentation.walkFrameIndex, 0);

  const redirected = applyHandNetAction(thirdPose, { type: HAND_NET_ACTIONS.MOVE, x: 0, y: -1 });
  assert.equal(redirected.presentation.walkElapsedMs, 220, "turning mid-stride preserves cadence");
  assert.equal(redirected.presentation.walkFrameIndex, 2);

  const stopped = applyHandNetAction(redirected, { type: HAND_NET_ACTIONS.STOP });
  assert.equal(stopped.presentation.walkElapsedMs, 0);
  assert.equal(stopped.presentation.walkFrameIndex, 0);
  const restarted = applyHandNetAction(
    tickHandNetState(stopped, 500),
    { type: HAND_NET_ACTIONS.MOVE, x: -1, y: 0 },
  );
  assert.equal(restarted.presentation.walkElapsedMs, 0);
  assert.equal(restarted.presentation.walkFrameIndex, 1);
});

test("bait placement is immutable, fixed-step deterministic, and presents frames 3, 4, 5, then 0", () => {
  const definition = Object.values(ELVERSON_BAITS_BY_ID)[0];
  const initial = controlledSingleCreature({ speciesId: definition.speciesIds[0] });
  const before = structuredClone(initial);
  const started = beginBaitPlacement(initial, definition);

  assert.deepEqual(initial, before);
  assert.notStrictEqual(started, initial);
  assert.equal(started.player.intent.x, 0);
  assert.equal(started.player.velocity.x, 0);
  assert.equal(started.bait.active, null);
  assert.equal(started.bait.placement.baitId, definition.id);
  assert.deepEqual(started.bait.placement.position, started.net.position);
  assert.equal(started.presentation.baitPlacementPhase, HAND_NET_BAIT_PLACEMENT_PHASES.WINDUP);
  assert.equal(started.presentation.baitPlacementFrameIndex, 3);
  assert.equal(Object.isFrozen(started.bait.placement.position), true);
  assert.strictEqual(
    applyHandNetAction(started, { type: HAND_NET_ACTIONS.MOVE, x: 1, y: 0 }),
    started,
  );
  assert.strictEqual(applyHandNetAction(started, { type: HAND_NET_ACTIONS.SCOOP }), started);

  const lowering = tickHandNetState(started, started.settings.baitPlacementLoweringMs);
  assert.equal(lowering.bait.active, null);
  assert.equal(lowering.presentation.baitPlacementPhase, HAND_NET_BAIT_PLACEMENT_PHASES.LOWERING);
  assert.equal(lowering.presentation.baitPlacementFrameIndex, 4);
  const beforeRelease = tickHandNetState(
    lowering,
    lowering.settings.baitPlacementReleaseMs
      - lowering.settings.baitPlacementLoweringMs
      - HAND_NET_SIMULATION_STEP_MS,
  );
  assert.equal(beforeRelease.bait.active, null);
  assert.equal(beforeRelease.presentation.baitPlacementFrameIndex, 4);

  const settled = tickHandNetState(beforeRelease, HAND_NET_SIMULATION_STEP_MS);
  assert.equal(settled.presentation.baitPlacementPhase, HAND_NET_BAIT_PLACEMENT_PHASES.SETTLING);
  assert.equal(settled.presentation.baitPlacementFrameIndex, 5);
  assert.equal(settled.bait.active.baitId, definition.id);
  assert.deepEqual(settled.bait.active.position, started.net.position);
  assert.equal(settled.bait.active.durationMs, definition.durationMs);
  assert.equal(settled.bait.active.remainingMs, definition.durationMs);
  assert.equal(settled.bait.active.placedAtMs, settled.simulationTimeMs);
  assert.equal(settled.lastEvent.type, "bait-placed");
  assert.deepEqual(settled.presentation.baitImpact, {
    sequence: 1,
    baitId: definition.id,
    position: settled.bait.active.position,
  });

  const completed = tickHandNetState(
    settled,
    settled.settings.baitPlacementAnimationMs - settled.settings.baitPlacementReleaseMs,
  );
  assert.equal(completed.bait.placement, null);
  assert.equal(completed.presentation.baitPlacementPhase, HAND_NET_BAIT_PLACEMENT_PHASES.COMPLETE);
  assert.equal(completed.presentation.baitPlacementFrameIndex, 0);
  assert.equal(completed.presentation.baitPlacementProgress, 1);
  assert.strictEqual(
    beginBaitPlacement(completed, Object.values(ELVERSON_BAITS_BY_ID)[1]),
    completed,
    "an active pouch cannot be silently replaced",
  );
  const idled = tickHandNetState(completed, HAND_NET_SIMULATION_STEP_MS);
  assert.equal(idled.presentation.baitPlacementPhase, HAND_NET_BAIT_PLACEMENT_PHASES.IDLE);
  assert.equal(idled.presentation.baitPlacementFrameIndex, 0);

  const oneFrame = tickHandNetState(started, 1_000);
  const fixedSteps = tickRepeatedly(started, HAND_NET_SIMULATION_STEP_MS, 50);
  assert.deepEqual(fixedSteps, oneFrame);
});

test("bait placed at the bottom shoreline remains inside a creature's feeding reach", () => {
  const definition = ELVERSON_BAITS_BY_ID["bait-kelp-crumble"];
  let edgeState = createHandNetState({
    seed: 3,
    creatureCount: 1,
    requiredCreatureId: definition.speciesIds[0],
  });
  edgeState = applyHandNetAction(edgeState, { type: HAND_NET_ACTIONS.MOVE, x: 0, y: 1 });
  edgeState = tickHandNetState(edgeState, 1_000);
  const started = beginBaitPlacement(edgeState, definition);
  const closestCreaturePoint = {
    x: Math.max(0.45, Math.min(11.55, started.bait.placement.position.x)),
    y: Math.max(0.65, Math.min(6.45, started.bait.placement.position.y)),
  };
  const distanceToReachableWater = Math.hypot(
    started.bait.placement.position.x - closestCreaturePoint.x,
    started.bait.placement.position.y - closestCreaturePoint.y,
  );
  assert.ok(started.bait.placement.position.y < started.net.position.y);
  assert.ok(distanceToReachableWater < started.settings.baitFeedingRadius);

  const ready = mutableCopy(started);
  ready.creatures[0].position = closestCreaturePoint;
  ready.creatures[0].speed = 0;
  ready.creatures[0].turnRemainingMs = 10_000;
  const settled = tickHandNetState(ready, ready.settings.baitPlacementReleaseMs);
  assert.equal(settled.creatures[0].status, "feeding");
});

test("matching creatures approach settled bait, feed, and resume wandering after it expires", () => {
  const definition = Object.values(ELVERSON_BAITS_BY_ID)[0];
  const matchingSpeciesId = definition.speciesIds[0];
  const settled = settleBait(
    controlledSingleCreature({ speciesId: matchingSpeciesId }),
    definition,
  );
  const approaching = mutableCopy(settled);
  approaching.creatures[0].position = {
    x: settled.bait.active.position.x - 2,
    y: settled.bait.active.position.y,
  };
  approaching.creatures[0].heading = { x: -1, y: 0 };
  approaching.creatures[0].status = "wandering";
  approaching.creatures[0].baitTargetId = null;
  approaching.creatures[0].turnRemainingMs = 10_000;
  const distanceBefore = Math.abs(
    approaching.creatures[0].position.x - approaching.bait.active.position.x,
  );
  const attracted = tickHandNetState(approaching, HAND_NET_SIMULATION_STEP_MS);
  const distanceAfter = Math.abs(
    attracted.creatures[0].position.x - attracted.bait.active.position.x,
  );
  assert.equal(attracted.creatures[0].status, "attracted");
  assert.equal(attracted.creatures[0].baitTargetId, definition.id);
  assert.ok(distanceAfter < distanceBefore);

  const readyToFeed = mutableCopy(attracted);
  readyToFeed.creatures[0].position = {
    x: readyToFeed.bait.active.position.x + readyToFeed.settings.baitFeedingRadius * 0.75,
    y: readyToFeed.bait.active.position.y,
  };
  readyToFeed.creatures[0].status = "attracted";
  const feeding = tickHandNetState(readyToFeed, HAND_NET_SIMULATION_STEP_MS);
  assert.equal(feeding.creatures[0].status, "feeding");
  assert.equal(feeding.creatures[0].baitTargetId, definition.id);

  const expired = tickForDuration(feeding, feeding.bait.active.remainingMs);
  assert.equal(expired.bait.active, null);
  assert.equal(expired.creatures[0].status, "wandering");
  assert.equal(expired.creatures[0].baitTargetId, null);
  assert.equal(expired.lastEvent.type, "bait-expired");

  const nonmatchingSpecies = ELVERSON_REEF_CATCHES.find(
    ({ id }) => !definition.speciesIds.includes(id),
  );
  assert.ok(nonmatchingSpecies);
  const nonmatching = settleBait(
    controlledSingleCreature({ speciesId: nonmatchingSpecies.id }),
    definition,
  );
  const nearbyNonmatch = mutableCopy(nonmatching);
  nearbyNonmatch.creatures[0].position = {
    x: nearbyNonmatch.bait.active.position.x + 0.2,
    y: nearbyNonmatch.bait.active.position.y,
  };
  nearbyNonmatch.creatures[0].speed = 0;
  const ignored = tickHandNetState(nearbyNonmatch, HAND_NET_SIMULATION_STEP_MS);
  assert.equal(ignored.creatures[0].status, "wandering");
  assert.equal(ignored.creatures[0].baitTargetId, null);
});

test("even the slowest matching creature reaches feeding range before bait expires", () => {
  const definition = ELVERSON_BAITS_BY_ID["bait-kelp-crumble"];
  const settled = settleBait(
    controlledSingleCreature({ speciesId: "sea-urchin" }),
    definition,
  );
  const farUrchin = mutableCopy(settled);
  farUrchin.creatures[0].position = {
    x: Math.max(0.45, farUrchin.bait.active.position.x - 2.4),
    y: 6.45,
  };
  farUrchin.creatures[0].status = "attracted";
  farUrchin.creatures[0].baitTargetId = definition.id;
  const feeding = tickHandNetState(
    farUrchin,
    Math.floor(farUrchin.bait.active.remainingMs * 0.85 / HAND_NET_SIMULATION_STEP_MS)
      * HAND_NET_SIMULATION_STEP_MS,
  );
  assert.equal(feeding.creatures[0].status, "feeding");
  assert.ok(feeding.bait.active.remainingMs > 0);
});

test("feeding bait multiplies the real scoop collision envelope", () => {
  const definition = Object.values(ELVERSON_BAITS_BY_ID)[0];
  assert.ok(definition.hitboxMultiplier > 1);
  const placementStarted = beginBaitPlacement(
    controlledSingleCreature({ speciesId: definition.speciesIds[0] }),
    definition,
  );
  const ready = tickHandNetState(
    placementStarted,
    placementStarted.settings.baitPlacementAnimationMs,
  );
  const baited = mutableCopy(ready);
  const creature = baited.creatures[0];
  const baseRadius = baited.net.radius + creature.radius * 0.5;
  const catchDistance = Math.min(
    baited.settings.baitFeedingRadius * 0.9,
    baseRadius * 1.2,
  );
  creature.position = {
    x: baited.net.position.x + catchDistance,
    y: baited.net.position.y,
  };
  creature.heading = { x: 1, y: 0 };
  creature.speed = 0;
  creature.status = "feeding";
  creature.baitTargetId = definition.id;
  creature.turnRemainingMs = 10_000;

  const effectiveRadius = getHandNetEffectiveCatchRadius(baited, creature);
  assert.ok(catchDistance > baseRadius);
  assert.ok(catchDistance < effectiveRadius);
  assert.equal(
    effectiveRadius,
    baited.net.radius + creature.radius * 0.5 * definition.hitboxMultiplier,
  );

  const control = mutableCopy(baited);
  control.bait.active = null;
  control.creatures[0].status = "wandering";
  control.creatures[0].baitTargetId = null;
  assert.equal(getHandNetEffectiveCatchRadius(control, control.creatures[0]), baseRadius);

  const baitedOutcome = tickHandNetState(
    applyHandNetAction(baited, { type: HAND_NET_ACTIONS.SCOOP }),
    baited.settings.scoopAnimationMs,
  );
  const controlOutcome = tickHandNetState(
    applyHandNetAction(control, { type: HAND_NET_ACTIONS.SCOOP }),
    control.settings.scoopAnimationMs,
  );
  assert.equal(baitedOutcome.phase, HAND_NET_PHASES.CAUGHT);
  assert.equal(baitedOutcome.outcome.speciesId, creature.speciesId);
  assert.equal(controlOutcome.phase, HAND_NET_PHASES.PLAYING);
  assert.equal(controlOutcome.lastEvent.type, "scoop-missed");
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

test("a startled fish seeks its authored rock and hides without ending the attempt", () => {
  const initial = controlledSingleCreature({ speciesId: "cleaner-wrasse" });
  const rock = initial.rocks[0];
  const creature = initial.creatures[0];
  creature.position = { x: rock.position.x, y: rock.position.y + 1.25 };
  creature.homeRockId = rock.id;
  creature.alert = initial.settings.alertThreshold - 0.02;
  initial.player.position = { x: creature.position.x, y: creature.position.y + 1 };
  initial.player.intent = { x: 0, y: -1 };
  initial.player.velocity = { x: 0, y: -initial.player.speed };

  const seeking = tickHandNetState(initial, HAND_NET_SIMULATION_STEP_MS);
  assert.equal(seeking.creatures[0].status, "seeking-cover");
  assert.equal(seeking.creatures[0].seekingRockId, rock.id);
  assert.ok(seeking.creatures[0].alert >= seeking.settings.alertThreshold);
  assert.equal(seeking.lastEvent?.type, "creature-fled");
  assert.equal(seeking.lastEvent?.rockId, rock.id);
  assert.equal(seeking.phase, HAND_NET_PHASES.PLAYING);

  let sheltered = applyHandNetAction(seeking, { type: HAND_NET_ACTIONS.STOP });
  for (let index = 0; index < 200 && sheltered.creatures[0].status !== "hidden"; index += 1) {
    sheltered = tickHandNetState(sheltered, HAND_NET_SIMULATION_STEP_MS);
  }
  assert.equal(sheltered.creatures[0].status, "hidden");
  assert.equal(sheltered.creatures[0].hiddenByRockId, rock.id);
  assert.ok(sheltered.creatures[0].hideRemainingMs > 0);
  assert.equal(sheltered.lastEvent?.type, "creature-hidden");
  assert.equal(sheltered.phase, HAND_NET_PHASES.PLAYING);
  assert.equal(sheltered.outcome, null);
});

test("baited creatures can still be startled by a fast direct approach", () => {
  const definition = ELVERSON_BAITS_BY_ID["bait-plankton-puff"];
  const feeding = mutableCopy(settleBait(
    controlledSingleCreature({ speciesId: definition.speciesIds[0] }),
    definition,
  ));
  feeding.bait.active.position = { x: 6, y: 5.7 };
  feeding.creatures[0].position = { x: 6, y: 5.7 };
  feeding.creatures[0].status = "feeding";
  feeding.creatures[0].baitTargetId = definition.id;
  feeding.player.position = { x: 6, y: 7.05 };
  feeding.player.intent = { x: 0, y: -1 };
  feeding.player.velocity = { x: 0, y: -feeding.player.speed };
  const alarmed = tickHandNetState(feeding, 700);

  assert.ok(alarmed.creatures[0].alert >= alarmed.settings.alertThreshold);
  assert.ok(["seeking-cover", "hidden"].includes(alarmed.creatures[0].status));
  assert.equal(alarmed.creatures[0].baitTargetId, null);
});

test("a creature hidden directly under the net is uncatchable and the attempt keeps playing", () => {
  const { state, creature } = controlledHiddenCreature();
  placeNetAt(state, creature.position);
  const before = structuredClone(state);

  const missed = tickHandNetState(
    applyHandNetAction(state, { type: HAND_NET_ACTIONS.SCOOP }),
    state.settings.scoopAnimationMs,
  );

  assert.equal(missed.phase, HAND_NET_PHASES.PLAYING);
  assert.equal(missed.outcome, null);
  assert.equal(missed.creatures[0].status, "hidden");
  assert.equal(missed.net.contactedCreatureId, null);
  assert.equal(missed.lastEvent.type, "scoop-missed");
  assert.equal(missed.missCount, 1);
  assert.deepEqual(state, before);
});

test("painted rock cover and simulation catchability cannot disagree", () => {
  const state = controlledSingleCreature({ speciesId: "white-grunt" });
  const rock = state.rocks[0];
  const creature = state.creatures[0];
  creature.position = { ...rock.position };
  creature.speed = 0;
  creature.turnRemainingMs = 10_000;
  placeNetAt(state, rock.position);

  const cleared = tickHandNetState(state, HAND_NET_SIMULATION_STEP_MS);
  const visibleCreature = cleared.creatures[0];
  const normalizedCoverDistance = (
    ((visibleCreature.position.x - rock.position.x) / rock.coverRadius.x) ** 2
    + ((visibleCreature.position.y - rock.position.y) / rock.coverRadius.y) ** 2
  );
  assert.ok(normalizedCoverDistance > 1, "wandering creatures are pushed in front of the foreground mask");

  const missed = tickHandNetState(
    applyHandNetAction(state, { type: HAND_NET_ACTIONS.SCOOP }),
    state.settings.scoopAnimationMs,
  );
  assert.equal(missed.phase, HAND_NET_PHASES.PLAYING);
  assert.equal(missed.outcome, null);
  assert.equal(missed.lastEvent.type, "scoop-missed");
});

test("hidden fish emerge only when their timer has elapsed and the player is calm and far away", () => {
  const hidden = controlledHiddenCreature({ hideRemainingMs: 0 });

  const movingFar = mutableCopy(hidden.state);
  movingFar.player.position = { x: 11, y: 6.8 };
  movingFar.player.intent = { x: -1, y: 0 };
  movingFar.player.velocity = { x: -movingFar.player.speed, y: 0 };
  const stillHiddenWhileMoving = tickHandNetState(movingFar, HAND_NET_SIMULATION_STEP_MS);
  assert.equal(stillHiddenWhileMoving.creatures[0].status, "hidden");

  const stillNear = mutableCopy(hidden.state);
  stillNear.player.position = {
    x: hidden.rock.position.x,
    y: hidden.rock.position.y + hidden.rock.shelterRadius + 0.5,
  };
  stillNear.player.intent = { x: 0, y: 0 };
  stillNear.player.velocity = { x: 0, y: 0 };
  const stillHiddenNearRock = tickHandNetState(stillNear, HAND_NET_SIMULATION_STEP_MS);
  assert.equal(stillHiddenNearRock.creatures[0].status, "hidden");

  const calmAndFar = mutableCopy(hidden.state);
  calmAndFar.player.position = { x: 11, y: 6.8 };
  calmAndFar.player.intent = { x: 0, y: 0 };
  calmAndFar.player.velocity = { x: 0, y: 0 };
  const emerged = tickHandNetState(calmAndFar, HAND_NET_SIMULATION_STEP_MS);
  assert.equal(emerged.creatures[0].status, "wandering");
  assert.equal(emerged.creatures[0].hiddenByRockId, null);
  assert.equal(emerged.creatures[0].hideRemainingMs, 0);
  assert.equal(emerged.creatures[0].alert, 0);
  const normalizedCoverDistance = (
    ((emerged.creatures[0].position.x - hidden.rock.position.x) / hidden.rock.coverRadius.x) ** 2
    + ((emerged.creatures[0].position.y - hidden.rock.position.y) / hidden.rock.coverRadius.y) ** 2
  );
  assert.ok(normalizedCoverDistance > 1, "an emerged fish must be painted in front of the rock");
  assert.equal(emerged.lastEvent.type, "creature-emerged");
  assert.equal(emerged.phase, HAND_NET_PHASES.PLAYING);
});

test("an escaped invertebrate leaves play running and its stable slot can be recycled by calm water", () => {
  const initial = controlledSingleCreature({ speciesId: "emerald-crab" });
  initial.creatures[0].status = "fleeing";
  initial.creatures[0].position = { x: 12.3, y: 4 };
  const stableId = initial.creatures[0].id;
  const escaped = tickHandNetState(initial, HAND_NET_SIMULATION_STEP_MS);

  assert.equal(escaped.creatures[0].status, "escaped");
  assert.equal(escaped.creatures[0].category, "invertebrate");
  assert.equal(escaped.phase, HAND_NET_PHASES.PLAYING);
  assert.equal(escaped.outcome, null);
  assert.equal(escaped.lastEvent.type, "creature-escaped");

  const calm = mutableCopy(escaped);
  calm.population.stillnessMs = 0;
  const beforeArrival = tickHandNetState(calm, 2_580);
  assert.equal(beforeArrival.creatures[0].status, "escaped");
  const recycled = tickHandNetState(beforeArrival, HAND_NET_SIMULATION_STEP_MS);

  assert.equal(recycled.phase, HAND_NET_PHASES.PLAYING);
  assert.equal(recycled.creatures[0].id, stableId);
  assert.equal(recycled.creatures[0].status, "wandering");
  assert.equal(recycled.creatures[0].spawnedAtMs, recycled.simulationTimeMs);
  assert.equal(recycled.population.arrivalCount, 1);
  assert.equal(recycled.lastEvent.type, "creature-arrived");
});

test("a scoop winds up, contacts near the landing frame, recovers, then reports its matching card", () => {
  const initial = controlledSingleCreature();
  initial.creatures[0].position = { ...initial.net.position };
  initial.creatures[0].speed = 0;
  initial.creatures[0].turnRemainingMs = 10_000;
  const before = structuredClone(initial);
  const scooping = applyHandNetAction(initial, { type: HAND_NET_ACTIONS.SCOOP });

  assert.equal(scooping.net.scoopRemainingMs, scooping.settings.scoopAnimationMs);
  assert.equal(scooping.scoopCount, 1);
  assert.equal(scooping.presentation.netImpact, null);
  assert.equal(scooping.presentation.scoopPhase, HAND_NET_SCOOP_PHASES.WINDUP);
  assert.equal(scooping.presentation.scoopElapsedMs, 0);
  assert.equal(scooping.presentation.scoopDurationMs, 700);
  assert.equal(scooping.presentation.scoopProgress, 0);
  assert.equal(scooping.presentation.scoopPhaseProgress, 0);
  assert.equal(scooping.presentation.scoopFrameIndex, 3);
  assert.equal(scooping.presentation.scoopHitboxActive, false);
  assert.equal(scooping.phase, HAND_NET_PHASES.PLAYING);

  const beforeImpact = tickHandNetState(scooping, scooping.settings.scoopContactMs - 20);
  assert.equal(beforeImpact.phase, HAND_NET_PHASES.PLAYING);
  assert.equal(beforeImpact.creatures[0].status, "wandering");
  assert.equal(beforeImpact.outcome, null);
  assert.equal(beforeImpact.presentation.netImpact, null);
  assert.equal(beforeImpact.presentation.scoopPhase, HAND_NET_SCOOP_PHASES.SWING);
  assert.equal(beforeImpact.presentation.scoopFrameIndex, 4);
  assert.equal(beforeImpact.presentation.scoopHitboxActive, false);

  const contacted = tickHandNetState(beforeImpact, 20);
  assert.equal(contacted.phase, HAND_NET_PHASES.PLAYING);
  assert.equal(contacted.outcome, null);
  assert.equal(contacted.creatures[0].status, "caught");
  assert.equal(contacted.net.contactedCreatureId, "hand-net-creature-1");
  assert.equal(contacted.lastEvent.type, "creature-netted");
  assert.equal(contacted.presentation.scoopPhase, HAND_NET_SCOOP_PHASES.IMPACT);
  assert.equal(contacted.presentation.scoopElapsedMs, 440);
  assert.equal(contacted.presentation.scoopFrameIndex, 5);
  assert.equal(contacted.presentation.scoopHitboxActive, true);
  assert.deepEqual(contacted.presentation.netImpact, {
    sequence: 1,
    position: contacted.net.position,
  });
  assert.ok(Object.isFrozen(contacted.presentation.netImpact));
  assert.ok(Object.isFrozen(contacted.presentation.netImpact.position));

  const blockedDuringRecovery = applyHandNetAction(contacted, { type: HAND_NET_ACTIONS.SCOOP });
  assert.strictEqual(blockedDuringRecovery, contacted);
  const recovering = tickHandNetState(
    contacted,
    contacted.settings.scoopRecoveryStartMs - contacted.settings.scoopContactMs,
  );
  assert.equal(recovering.phase, HAND_NET_PHASES.PLAYING);
  assert.equal(recovering.outcome, null);
  assert.equal(recovering.presentation.scoopPhase, HAND_NET_SCOOP_PHASES.RECOVERY);
  assert.equal(recovering.presentation.scoopHitboxActive, false);

  const caught = tickHandNetState(
    recovering,
    recovering.settings.scoopAnimationMs - recovering.settings.scoopRecoveryStartMs,
  );
  assert.equal(caught.phase, HAND_NET_PHASES.CAUGHT);
  assert.equal(caught.outcome.type, "caught");
  assert.equal(caught.outcome.speciesId, "cleaner-wrasse");
  assert.equal(caught.outcome.cardId, "cleaner-wrasse");
  assert.equal(caught.creatures[0].status, "caught");
  assert.equal(caught.net.scoopRemainingMs, 0);
  assert.equal(caught.net.contactedCreatureId, null);
  assert.equal(caught.outcome.atMs, 700);
  assert.equal(caught.presentation.scoopPhase, HAND_NET_SCOOP_PHASES.COMPLETE);
  assert.equal(caught.presentation.scoopElapsedMs, 700);
  assert.equal(caught.presentation.scoopProgress, 1);
  assert.equal(caught.presentation.scoopPhaseProgress, 1);
  assert.equal(caught.presentation.scoopFrameIndex, 6);
  assert.equal(caught.presentation.scoopHitboxActive, false);
  assert.deepEqual(tickHandNetState(scooping, 700), caught);
  assert.deepEqual(initial, before);
  assert.strictEqual(
    applyHandNetAction(caught, { type: HAND_NET_ACTIONS.MOVE, x: 1, y: 0 }),
    caught,
  );
  assert.strictEqual(tickHandNetState(caught, 100), caught);
});

test("an empty scoop completes recovery, records the miss, cools down, and can remount impact", () => {
  const standard = controlledSingleCreature();
  standard.creatures[0].position = { x: standard.net.position.x + 1.5, y: standard.net.position.y };
  standard.creatures[0].speed = 0;
  const started = applyHandNetAction(standard, { type: HAND_NET_ACTIONS.SCOOP });
  const beforeImpact = tickHandNetState(started, started.settings.scoopContactMs - 20);
  const impact = tickHandNetState(beforeImpact, 20);
  const recovery = tickHandNetState(
    impact,
    impact.settings.scoopRecoveryStartMs - impact.settings.scoopContactMs,
  );
  const almostFinished = tickHandNetState(
    recovery,
    recovery.settings.scoopAnimationMs - recovery.settings.scoopRecoveryStartMs - 20,
  );
  const missed = tickHandNetState(almostFinished, 20);

  assert.equal(beforeImpact.presentation.netImpact, null);
  assert.equal(impact.presentation.scoopPhase, HAND_NET_SCOOP_PHASES.IMPACT);
  assert.equal(impact.presentation.scoopHitboxActive, true);
  assert.deepEqual(impact.presentation.netImpact, {
    sequence: 1,
    position: impact.net.position,
  });
  const lateArrival = mutableCopy(impact);
  lateArrival.creatures[0].position = { ...lateArrival.net.position };
  const afterContact = tickHandNetState(lateArrival, 20);
  assert.equal(afterContact.net.contactedCreatureId, null);
  assert.equal(afterContact.creatures[0].status, "wandering");
  assert.equal(afterContact.presentation.scoopHitboxActive, false);
  assert.equal(recovery.presentation.scoopPhase, HAND_NET_SCOOP_PHASES.RECOVERY);
  assert.equal(recovery.presentation.scoopHitboxActive, false);
  assert.equal(almostFinished.net.scoopRemainingMs, 20);
  assert.equal(missed.net.scoopRemainingMs, 0);
  assert.equal(missed.net.cooldownRemainingMs, missed.settings.cooldownMs);
  assert.equal(missed.missCount, 1);
  assert.equal(missed.lastEvent.type, "scoop-missed");
  assert.ok(missed.creatures[0].alert > 0);
  assert.equal(missed.presentation.scoopPhase, HAND_NET_SCOOP_PHASES.COMPLETE);
  assert.equal(missed.presentation.scoopProgress, 1);

  const blockedRepeat = applyHandNetAction(missed, { type: HAND_NET_ACTIONS.SCOOP });
  assert.strictEqual(blockedRepeat, missed);

  const firstImpact = impact.presentation.netImpact;
  const readyAgain = tickHandNetState(missed, missed.settings.cooldownMs);
  assert.equal(readyAgain.presentation.scoopPhase, HAND_NET_SCOOP_PHASES.IDLE);
  const repeated = applyHandNetAction(readyAgain, { type: HAND_NET_ACTIONS.SCOOP });
  assert.equal(repeated.scoopCount, 2);
  assert.equal(repeated.presentation.netImpact, null);
  assert.equal(repeated.presentation.scoopPhase, HAND_NET_SCOOP_PHASES.WINDUP);
  const repeatedImpact = tickHandNetState(repeated, repeated.settings.scoopContactMs);
  assert.deepEqual(repeatedImpact.presentation.netImpact, {
    sequence: 2,
    position: readyAgain.net.position,
  });
  assert.notStrictEqual(repeatedImpact.presentation.netImpact, firstImpact);
  assert.deepEqual(impact.presentation.netImpact, firstImpact);
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
  controlled.creatures[0].speed = 0;
  const caught = tickHandNetState(
    applyHandNetAction(controlled, { type: HAND_NET_ACTIONS.SCOOP }),
    controlled.settings.scoopAnimationMs,
  );
  assert.equal(caught.phase, HAND_NET_PHASES.CAUGHT);
  assert.equal(controlled.settings.scoopAnimationMs, standard.settings.scoopAnimationMs);
  assert.equal(controlled.settings.scoopContactMs, standard.settings.scoopContactMs);
});

test("public functions reject malformed options, actions, state, and elapsed time", () => {
  for (const seed of [-1, UINT32_MAX_PLUS_ONE(), 1.5, Number.NaN]) {
    assert.throws(() => createHandNetState({ seed }), /unsigned 32-bit integer/);
  }
  for (const creatureCount of [0, 9, 1.5]) {
    assert.throws(() => createHandNetState({ creatureCount }), /creatureCount/);
  }
  for (const populationCap of [0, 9, 1.5, Number.NaN]) {
    assert.throws(() => createHandNetState({ populationCap }), /populationCap/);
  }
  assert.throws(
    () => createHandNetState({ creatureCount: 3, populationCap: 2 }),
    /populationCap must be at least creatureCount/,
  );
  assert.throws(
    () => createHandNetState({ requiredCreatureId: "imaginary-fish" }),
    /Unknown required hand-net creature/,
  );
  assert.throws(() => createHandNetState({ reducedMotion: 1 }), /reducedMotion must be boolean/);

  const state = createHandNetState({ seed: 1, creatureCount: 1 });
  assert.throws(() => applyHandNetAction(state, null), /action requires a type/);
  assert.throws(() => applyHandNetAction(state, { type: "jump" }), /Unknown hand-net action/);
  assert.throws(
    () => applyHandNetAction(state, { type: HAND_NET_ACTIONS.PLACE_BAIT, baitId: "imaginary-bait" }),
    /Unknown Elverson bait/,
  );
  assert.throws(
    () => applyHandNetAction(state, { type: HAND_NET_ACTIONS.PLACE_BAIT, baitId: "toString" }),
    /Unknown Elverson bait/,
  );
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
  assert.throws(() => consumeHandNetFrameElapsed(-1, 20), /accumulatorMs must stay between/);
  assert.throws(() => consumeHandNetFrameElapsed(20, 20), /accumulatorMs must stay between/);
  assert.throws(() => consumeHandNetFrameElapsed(0, Number.NaN), /elapsedMs must be finite/);
  assert.throws(
    () => getHandNetEffectiveCatchRadius(state, null),
    /requires a creature with a non-negative finite radius/,
  );
});

function UINT32_MAX_PLUS_ONE() {
  return 0x1_0000_0000;
}
