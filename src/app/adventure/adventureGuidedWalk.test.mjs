import assert from "node:assert/strict";
import test from "node:test";
import {
  GUIDED_WALK_PLAN_VERSION,
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
