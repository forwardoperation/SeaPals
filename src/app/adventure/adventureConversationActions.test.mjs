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
  for (const mode of ["victory", "roundVictory", "exhibitionVictory", "onboardingGate", "locked"]) {
    assert.equal(getAdventureConversationSecondaryAction({ trainer, mode }), null, mode);
  }
});

test("the optional exhibition remains a distinct secondary action", () => {
  assert.deepEqual(getAdventureConversationSecondaryAction({
    trainer: { id: "sunpatch-leader", encounterId: "encounter-sunpatch-qualifier" },
    mode: "victory",
    canOfferSunpatchExhibition: true,
  }), { kind: "exhibition", label: "Play optional 30 VP exhibition" });
});
