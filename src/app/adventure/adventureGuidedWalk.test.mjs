import assert from "node:assert/strict";
import test from "node:test";
import {
  GUIDED_WALK_CLOCK_VERSION,
  GUIDED_WALK_PLAN_VERSION,
  advanceGuidedWalkClock,
  createGuidedWalkPlan,
  sampleGuidedWalk,
} from "./adventureGuidedWalk.mjs";

const CORNER_PATH = Object.freeze([
  Object.freeze({ x: 0, y: 0 }),
  Object.freeze({ x: 3, y: 0 }),
  Object.freeze({ x: 3, y: 4 }),
]);

test("guided walk plans validate, copy, and freeze their predetermined path", () => {
  const sourcePath = [{ x: 0, y: 0 }, { x: 3, y: 4 }];
  const plan = createGuidedWalkPlan({ path: sourcePath, speed: 2, followerDelayMs: 500 });

  assert.equal(plan.version, GUIDED_WALK_PLAN_VERSION);
  assert.equal(plan.totalDistance, 5);
  assert.equal(plan.leaderDurationMs, 2500);
  assert.equal(plan.durationMs, 3000);
  assert.equal(plan.speed, 2);
  assert.ok(Object.isFrozen(plan));
  assert.ok(Object.isFrozen(plan.path[0]));

  sourcePath[0].x = 99;
  assert.deepEqual(plan.path[0], { x: 0, y: 0 });
});

test("guided walk plan validation rejects malformed geometry and timing", () => {
  assert.throws(() => createGuidedWalkPlan({ path: [{ x: 0, y: 0 }] }), /at least two points/);
  assert.throws(
    () => createGuidedWalkPlan({ path: [{ x: 0, y: 0 }, { x: 0, y: 0 }] }),
    /must differ/,
  );
  assert.throws(
    () => createGuidedWalkPlan({ path: [{ x: 0, y: 0 }, { x: Number.NaN, y: 1 }] }),
    /must be finite/,
  );
  assert.throws(() => createGuidedWalkPlan({ path: CORNER_PATH, speed: 0 }), /greater than zero/);
  assert.throws(
    () => createGuidedWalkPlan({ path: CORNER_PATH, followerDelayMs: -1 }),
    /zero or greater/,
  );
  assert.throws(
    () => createGuidedWalkPlan({ path: CORNER_PATH, reducedMotion: "yes" }),
    /must be boolean/,
  );
  assert.throws(
    () => createGuidedWalkPlan({ path: CORNER_PATH, followerPath: [{ x: 1, y: 1 }] }),
    /at least two points/,
  );
});

test("leader and follower sample the same path at one constant speed with a delay", () => {
  const plan = createGuidedWalkPlan({ path: CORNER_PATH, speed: 1, followerDelayMs: 1000 });

  assert.deepEqual(sampleGuidedWalk(plan, 0), {
    elapsedMs: 0,
    durationMs: 8000,
    leader: {
      position: { x: 0, y: 0 }, facing: "right", moving: true, complete: false,
    },
    follower: {
      position: { x: 0, y: 0 }, facing: "right", moving: false, complete: false,
    },
    moving: true,
    complete: false,
  });

  const sample = sampleGuidedWalk(plan, 3500);
  assert.deepEqual(sample.leader, {
    position: { x: 3, y: 0.5 }, facing: "down", moving: true, complete: false,
  });
  assert.deepEqual(sample.follower, {
    position: { x: 2.5, y: 0 }, facing: "right", moving: true, complete: false,
  });
});

test("leader waits at the destination until the delayed follower completes", () => {
  const plan = createGuidedWalkPlan({ path: CORNER_PATH, speed: 1, followerDelayMs: 1000 });
  const sample = sampleGuidedWalk(plan, 7000);

  assert.deepEqual(sample.leader, {
    position: { x: 3, y: 4 }, facing: "down", moving: false, complete: true,
  });
  assert.deepEqual(sample.follower, {
    position: { x: 3, y: 3 }, facing: "down", moving: true, complete: false,
  });
  assert.equal(sample.complete, false);
  assert.equal(sample.moving, true);
});

test("leader and follower can use separate authored paths without snapping together", () => {
  const plan = createGuidedWalkPlan({
    path: [{ x: 0, y: 0 }, { x: 4, y: 0 }],
    followerPath: [{ x: 0, y: 1 }, { x: 3, y: 1 }],
    speed: 1,
    followerDelayMs: 500,
  });

  assert.equal(plan.leaderDurationMs, 4000);
  assert.equal(plan.followerDurationMs, 3000);
  assert.equal(plan.durationMs, 4000);
  assert.deepEqual(sampleGuidedWalk(plan, 0).follower.position, { x: 0, y: 1 });
  assert.deepEqual(sampleGuidedWalk(plan, 2000).leader.position, { x: 2, y: 0 });
  assert.deepEqual(sampleGuidedWalk(plan, 2000).follower.position, { x: 1.5, y: 1 });
  assert.deepEqual(sampleGuidedWalk(plan, plan.durationMs).follower.position, { x: 3, y: 1 });
  assert.equal(sampleGuidedWalk(plan, plan.durationMs).complete, true);
});

test("terminal guided-walk sampling is deterministic and idempotent", () => {
  const plan = createGuidedWalkPlan({ path: CORNER_PATH, speed: 1, followerDelayMs: 1000 });
  const terminal = sampleGuidedWalk(plan, plan.durationMs);

  assert.deepEqual(sampleGuidedWalk(plan, plan.durationMs), terminal);
  assert.deepEqual(sampleGuidedWalk(plan, plan.durationMs + 60_000), terminal);
  assert.deepEqual(terminal.leader.position, { x: 3, y: 4 });
  assert.deepEqual(terminal.follower.position, { x: 3, y: 4 });
  assert.equal(terminal.moving, false);
  assert.equal(terminal.complete, true);
  assert.ok(Object.isFrozen(terminal));
});

test("reduced motion selects its own constant speed while preserving follower delay", () => {
  const normal = createGuidedWalkPlan({
    path: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    speed: 2,
    followerDelayMs: 400,
    reducedMotionSpeed: 5,
  });
  const reduced = createGuidedWalkPlan({
    path: [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    speed: 2,
    followerDelayMs: 400,
    reducedMotion: true,
    reducedMotionSpeed: 5,
  });

  assert.equal(normal.speed, 2);
  assert.equal(normal.durationMs, 5400);
  assert.equal(reduced.speed, 5);
  assert.equal(reduced.durationMs, 2400);
  assert.deepEqual(sampleGuidedWalk(reduced, 1000).leader.position, { x: 5, y: 0 });
  assert.deepEqual(sampleGuidedWalk(reduced, 200).follower.position, { x: 0, y: 0 });
});

test("guided walk sampling rejects invalid plans and elapsed time", () => {
  const plan = createGuidedWalkPlan({ path: CORNER_PATH });
  assert.throws(() => sampleGuidedWalk({}, 0), /must use version/);
  assert.throws(() => sampleGuidedWalk(plan, -1), /zero or greater/);
  assert.throws(() => sampleGuidedWalk(plan, Number.POSITIVE_INFINITY), /must be finite/);
});

test("guided walk frame clock progresses across arbitrary and regressed timestamp origins", () => {
  const plan = createGuidedWalkPlan({
    path: [{ x: 0, y: 0 }, { x: 2, y: 0 }],
    speed: 1,
    followerDelayMs: 0,
  });

  let clock = advanceGuidedWalkClock(plan, null, 50_000);
  assert.deepEqual(clock, {
    version: GUIDED_WALK_CLOCK_VERSION,
    elapsedMs: 0,
    lastTimestampMs: 50_000,
    complete: false,
  });
  clock = advanceGuidedWalkClock(plan, clock, 50_750);
  assert.equal(clock.elapsedMs, 750);

  // A resumed document timeline may establish a lower baseline. The reset
  // frame contributes no time, but subsequent frames must continue advancing.
  clock = advanceGuidedWalkClock(plan, clock, 10);
  assert.equal(clock.elapsedMs, 750);
  clock = advanceGuidedWalkClock(plan, clock, 510);
  assert.equal(clock.elapsedMs, 1250);
  clock = advanceGuidedWalkClock(plan, clock, 1510);
  assert.equal(clock.elapsedMs, plan.durationMs);
  assert.equal(clock.complete, true);
  assert.equal(advanceGuidedWalkClock(plan, clock, 2510).elapsedMs, plan.durationMs);
});

test("guided walk frame clock validates state and timestamps", () => {
  const plan = createGuidedWalkPlan({ path: CORNER_PATH });
  assert.throws(() => advanceGuidedWalkClock(plan, {}, 0), /must use version/);
  assert.throws(() => advanceGuidedWalkClock(plan, null, -1), /zero or greater/);
  assert.throws(
    () => advanceGuidedWalkClock(plan, {
      version: GUIDED_WALK_CLOCK_VERSION,
      elapsedMs: Number.NaN,
      lastTimestampMs: null,
    }, 0),
    /must be finite/,
  );
});
