import assert from "node:assert/strict";
import test from "node:test";

import { getContinuousBoatHeading } from "./adventureBoatMotion.mjs";

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
