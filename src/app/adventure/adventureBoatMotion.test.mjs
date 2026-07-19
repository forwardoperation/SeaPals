import assert from "node:assert/strict";
import test from "node:test";

import {
  BOAT_MOTION_DEFAULTS,
  createBoatMotionState,
  getBoatFacingFromHeading,
  getContinuousBoatHeading,
  stepBoatMotion,
} from "./adventureBoatMotion.mjs";

test("boat headings take the shortest continuous turn across every adjacent facing", () => {
  let heading = getContinuousBoatHeading(null, "up");
  assert.equal(heading, 180);

  heading = getContinuousBoatHeading(heading, "left");
  assert.equal(heading, 270);

  heading = getContinuousBoatHeading(heading, "down");
  assert.equal(heading, 360);

  heading = getContinuousBoatHeading(heading, "right");
  assert.equal(heading, 450);

  heading = getContinuousBoatHeading(heading, "up");
  assert.equal(heading, 540);

  heading = getContinuousBoatHeading(heading, "right");
  assert.equal(heading, 450);
});

test("boat heading validation rejects malformed movement state", () => {
  assert.throws(() => getContinuousBoatHeading(0, "north"), /Unknown boat facing/);
  assert.throws(() => getContinuousBoatHeading(Number.NaN, "down"), /finite number/);
});

test("throttle accelerates forward, release coasts, and reverse first brakes", () => {
  const initial = createBoatMotionState({ position: { x: 2, y: 2 }, heading: 90 });
  const underway = stepBoatMotion(initial, { throttle: 1, rudder: 0 }, 1000);

  assert.ok(underway.speed > 2.4 && underway.speed < 2.5);
  assert.ok(underway.position.x > 3);
  assert.ok(Math.abs(underway.position.y - 2) < 1e-9);

  const coasting = stepBoatMotion(underway, { throttle: 0, rudder: 0 }, 500);
  assert.ok(coasting.speed > 0, "releasing throttle should preserve momentum");
  assert.ok(coasting.speed < underway.speed, "water drag should gradually slow the hull");

  const braking = stepBoatMotion(coasting, { throttle: -1, rudder: 0 }, 250);
  assert.ok(braking.speed >= 0, "reverse input should brake forward motion before going astern");
  const reversing = stepBoatMotion(braking, { throttle: -1, rudder: 0 }, 1000);
  assert.ok(reversing.speed < 0);
  assert.ok(reversing.speed >= -BOAT_MOTION_DEFAULTS.maxReverseSpeed);
});

test("the rudder turns only underway, gains authority with speed, and reverses astern", () => {
  const stopped = createBoatMotionState({ position: { x: 0, y: 0 }, heading: 0 });
  assert.equal(stepBoatMotion(stopped, { throttle: 0, rudder: 1 }, 1000).heading, 0);

  const slow = stepBoatMotion(
    createBoatMotionState({ position: { x: 0, y: 0 }, heading: 0, speed: 0.35 }),
    { throttle: 0, rudder: 1 },
    100,
  );
  const fast = stepBoatMotion(
    createBoatMotionState({ position: { x: 0, y: 0 }, heading: 0, speed: 2.8 }),
    { throttle: 0, rudder: 1 },
    100,
  );
  assert.ok(slow.heading > 0);
  assert.ok(fast.heading > slow.heading, "a faster flow across the rudder should turn more strongly");

  const astern = stepBoatMotion(
    createBoatMotionState({ position: { x: 0, y: 0 }, heading: 0, speed: -0.8 }),
    { throttle: -1, rudder: 1 },
    100,
  );
  assert.ok(astern.heading < 0, "rudder response reverses while backing");
});

test("speed remains bounded under sustained throttle", () => {
  let motion = createBoatMotionState({ position: { x: 0, y: 0 }, heading: 0 });
  motion = stepBoatMotion(motion, { throttle: 1, rudder: 0 }, 10000);
  assert.equal(motion.speed, BOAT_MOTION_DEFAULTS.maxForwardSpeed);
  motion = stepBoatMotion(motion, { throttle: -1, rudder: 0 }, 10000);
  assert.equal(motion.speed, -BOAT_MOTION_DEFAULTS.maxReverseSpeed);
});

test("collision sweeps cannot tunnel through a narrow barrier and stop the hull", () => {
  const initial = createBoatMotionState({ position: { x: 0, y: 0 }, heading: 90, speed: 3.2 });
  const result = stepBoatMotion(initial, { throttle: 1, rudder: 0 }, 1000, {
    maxIntegrationMs: 250,
    maxStepDistance: 0.05,
    canOccupy: (position) => position.x < 0.48,
  });

  assert.equal(result.collided, true);
  assert.ok(result.position.x < 0.48);
  assert.equal(result.speed, 0);
});

test("collision resolution can slide along a shoreline without entering it", () => {
  const initial = createBoatMotionState({ position: { x: 0, y: 0 }, heading: 45, speed: 2 });
  const result = stepBoatMotion(initial, { throttle: 0, rudder: 0 }, 250, {
    canOccupy: (position) => position.x < 0.12,
  });

  assert.equal(result.collided, true);
  assert.ok(result.position.x < 0.12);
  assert.ok(result.position.y > 0, "the open axis should still advance before the collision stops momentum");
  assert.equal(result.speed, 0);
});

test("continuous headings map back to the save contract's nearest facing", () => {
  assert.equal(getBoatFacingFromHeading(2), "down");
  assert.equal(getBoatFacingFromHeading(88), "right");
  assert.equal(getBoatFacingFromHeading(181), "up");
  assert.equal(getBoatFacingFromHeading(271), "left");
  assert.equal(getBoatFacingFromHeading(450), "right");
  assert.equal(getBoatFacingFromHeading(-90), "left");
});

test("boat simulation rejects malformed state and collision options", () => {
  assert.throws(() => createBoatMotionState({ position: { x: 0, y: 0 }, heading: Number.NaN }), /finite number/);
  assert.throws(
    () => stepBoatMotion({ position: { x: 0, y: 0 }, heading: 0, speed: 0 }, {}, 16, { canOccupy: true }),
    /must be a function/,
  );
});
