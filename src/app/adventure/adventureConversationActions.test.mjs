import assert from "node:assert/strict";
import test from "node:test";

import { getAdventureConversationSecondaryAction } from "./adventureConversationActions.mjs";

test("ambient Elverson dialogue has one meaningful Continue exploring action", () => {
  assert.equal(getAdventureConversationSecondaryAction({
    trainer: {
      id: "landon",
      townId: "shellshore-village",
      roleId: "resident",
      encounterId: null,
    },
    mode: "return",
  }), null);
});

test("consequential conversation choices retain a genuine decline action", () => {
  assert.deepEqual(getAdventureConversationSecondaryAction({
    trainer: {
      id: "rosie",
      townId: "shellshore-village",
      roleId: "resident",
      encounterId: "encounter-shellshore-rosie",
    },
    mode: "intro",
  }), { kind: "close", label: "Not yet" });
  assert.deepEqual(getAdventureConversationSecondaryAction({
    trainer: { id: "arena-finalist", encounterId: "arena-final" },
    mode: "defeat",
  }), { kind: "close", label: "Return to the Arena" });
});

test("completed and locked conversations do not render duplicate close actions", () => {
  const trainer = { id: "rosie", encounterId: "encounter-shellshore-rosie" };
  for (const mode of [
    "victory",
    "roundVictory",
    "exhibitionVictory",
    "onboardingGate",
    "locked",
    "fishingGuidance",
    "fishingDelivered",
    "fishingCollectionComplete",
  ]) {
    assert.equal(getAdventureConversationSecondaryAction({ trainer, mode }), null, mode);
  }
});

test("Easterling's catch handoff keeps its meaningful decline action", () => {
  assert.deepEqual(getAdventureConversationSecondaryAction({
    trainer: { id: "academy-mentor", encounterId: "encounter-shellshore-mentor-practice" },
    mode: "fishingTurnIn",
  }), { kind: "close", label: "Not yet" });
});

test("the required one-time world introduction cannot be dismissed and reopened", () => {
  assert.equal(getAdventureConversationSecondaryAction({
    trainer: { id: "academy-mentor", encounterId: "encounter-shellshore-mentor-practice" },
    mode: "worldIntroduction",
  }), null);
});

test("Wyeth's required fishing handoff cannot fall back to a Not yet action", () => {
  const wyeth = {
    id: "fisherman-wyeth",
    townId: "shellshore-village",
    roleId: "field-partner",
    encounterId: null,
  };
  for (const mode of ["fishingLesson", "fishingPractice"]) {
    assert.equal(getAdventureConversationSecondaryAction({ trainer: wyeth, mode }), null, mode);
  }
});

test("the optional exhibition remains a distinct secondary action", () => {
  assert.deepEqual(getAdventureConversationSecondaryAction({
    trainer: { id: "sunpatch-leader", encounterId: "encounter-sunpatch-qualifier" },
    mode: "victory",
    canOfferSunpatchExhibition: true,
  }), { kind: "exhibition", label: "Play optional 30 VP exhibition" });
});
