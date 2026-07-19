import assert from "node:assert/strict";
import test from "node:test";
import {
  getAcademyActionBlock,
  getAcademyCardPlayBlock,
  getAcademyEndTurnBlock,
  getAcademyPlacementBlock,
  isAcademyPlacementAllowed,
} from "./tutorialInteractionGate.mjs";

const route = Object.freeze({
  active: true,
  plan: {
    curriculumVersion: 3,
    placementPlan: {
      "great-barracuda": {
        foundationCardId: "pillar-coral-base",
        slotClass: "predator",
      },
    },
  },
  cards: {
    economy: { cardId: "pillar-coral-base", cardName: "Pillar Coral" },
    predator: { cardId: "great-barracuda", cardName: "Great Barracuda" },
  },
});

test("Academy card play accepts only the card named by the live Professor cue", () => {
  const help = { target: "play-card", targetCardId: "pillar-coral-base" };
  assert.equal(getAcademyCardPlayBlock({ route, help, cardId: "pillar-coral-base" }), "");
  assert.match(
    getAcademyCardPlayBlock({ route, help, cardId: "great-barracuda", guideName: "Mr. Easterling" }),
    /Mr\. Easterling.*Pillar Coral.*highlighted card/i,
  );
  assert.match(
    getAcademyCardPlayBlock({ route, help: { target: "turn-button" }, cardId: "arrow-crab" }),
    /board action or the end of the turn/i,
  );
});

test("Academy actions must match both the highlighted control and instance key", () => {
  const help = { target: "utility-action-button", targetActionKey: "slot-nudi:munch" };
  assert.equal(getAcademyActionBlock({ route, help, actionKey: "slot-nudi:munch", target: "utility-action-button" }), "");
  assert.match(getAcademyActionBlock({ route, help, actionKey: "slot-hogfish:crunch", target: "attack-button" }), /different action/i);
});

test("Academy turns end only when the Professor cue reaches the turn control", () => {
  assert.equal(getAcademyEndTurnBlock({ route, help: { target: "turn-button" } }), "");
  assert.match(getAcademyEndTurnBlock({ route, help: { target: "hand" } }), /Mr\. Easterling's highlighted lesson step/i);
  assert.equal(getAcademyEndTurnBlock({ route: null, help: null }), "");
});

test("Academy placement reserves the authored foundation and slot class", () => {
  const intended = {
    route,
    cardId: "great-barracuda",
    foundationCardId: "pillar-coral-base",
    slotClass: "predator",
  };
  assert.equal(isAcademyPlacementAllowed(intended), true);
  assert.equal(getAcademyPlacementBlock(intended), "");

  const apexSlot = { ...intended, foundationCardId: "brain-coral-stage-2", slotClass: "apex" };
  assert.equal(isAcademyPlacementAllowed(apexSlot), false);
  assert.match(getAcademyPlacementBlock(apexSlot), /Pillar Coral's predator slot.*Apex/i);

  assert.equal(isAcademyPlacementAllowed({ ...apexSlot, route: null }), true);
});
