import assert from "node:assert/strict";
import test from "node:test";

import {
  MOBILE_HAND_DROP_SNAP_DISTANCE,
  distanceFromClientPointToRect,
  findNearestHandDropElement,
} from "./mobileHandDrop.mjs";

function dropElement(left, top, width, height) {
  return {
    getBoundingClientRect() {
      return { left, top, right: left + width, bottom: top + height, width, height };
    },
  };
}

test("slot drop distance is zero inside the slot and screen-space outside it", () => {
  const rect = { left: 100, top: 100, right: 140, bottom: 140 };
  assert.equal(distanceFromClientPointToRect(120, 120, rect), 0);
  assert.equal(distanceFromClientPointToRect(170, 140, rect), 30);
  assert.equal(distanceFromClientPointToRect(170, 180, rect), 50);
});

test("a visually small zoomed slot remains a forgiving hand-drop target", () => {
  const invertebrate = dropElement(200, 100, 36, 36);
  invertebrate.dataset = { handDropSlotId: "invertebrate" };
  const closerFish = dropElement(237, 100, 36, 36);
  closerFish.dataset = { handDropSlotId: "fish" };

  assert.equal(
    findNearestHandDropElement([closerFish, invertebrate], 238, 118, {
      isEligible: (element) => element.dataset.handDropSlotId === "invertebrate",
    }),
    invertebrate,
    "a closer incompatible Fish slot must not steal Sea Urchin from the highlighted Invertebrate slot",
  );

  const fartherInvertebrate = dropElement(160, 100, 36, 36);
  fartherInvertebrate.dataset = { handDropSlotId: "invertebrate" };
  const eligible = (element) => element.dataset.handDropSlotId === "invertebrate";
  assert.equal(
    findNearestHandDropElement([invertebrate, fartherInvertebrate], 238, 118, { isEligible: eligible }),
    invertebrate,
  );
  assert.equal(
    findNearestHandDropElement([fartherInvertebrate, invertebrate], 238, 118, { isEligible: eligible }),
    invertebrate,
    "nearest selection should not depend on DOM order when both eligible slots are in range",
  );
  assert.equal(
    findNearestHandDropElement(
      [invertebrate],
      200 + 36 + MOBILE_HAND_DROP_SNAP_DISTANCE + 1,
      118,
    ),
    null,
    "a distant release should still snap the card back",
  );
});
