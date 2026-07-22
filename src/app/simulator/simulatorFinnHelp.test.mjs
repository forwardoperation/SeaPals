import test from "node:test";
import assert from "node:assert/strict";

import {
  expandSimulatorFinnQuestion,
  resolveSimulatorFinnQuestion,
} from "./simulatorFinnHelp.mjs";

test("Finn defers to the exact active Mr. Easterling tutorial step", () => {
  const result = resolveSimulatorFinnQuestion("What should I do now?", {
    gamePhase: "main",
    tutorialAction: "Choose Pillar Coral, then press Play Card.",
    tutorialTargetLabel: "Pillar Coral in your hand",
    tutorialGuideName: "Mr. Easterling",
  });

  assert.match(result.answer.title, /Mr\. Easterling/i);
  assert.match(result.answer.text, /Choose Pillar Coral.*Play Card/i);
  assert.match(result.answer.text, /Pillar Coral in your hand/i);
  assert.doesNotMatch(result.answer.text, /any order/i);
});

test("Finn reports the simulator's exact selected-card play error", () => {
  const result = resolveSimulatorFinnQuestion("Why can't I play this card?", {
    selectedCardName: "Coral Reef",
    selectedCardPlayError: "Coral Reef requires 4 Corals, 2 Fish, and 2 Invertebrates in your ecosystem.",
  });

  assert.equal(result.answer.title, "Why Coral Reef is unavailable");
  assert.equal(result.answer.text, "Coral Reef requires 4 Corals, 2 Fish, and 2 Invertebrates in your ecosystem.");
  assert.equal(result.delegatedQuestion, "Why can't I play Coral Reef?");
});

test("Finn asks for a selected card instead of inventing a legality reason", () => {
  const result = resolveSimulatorFinnQuestion("Why is this card unavailable?");
  assert.match(result.answer.title, /Select the card/i);
  assert.match(result.answer.text, /Open a card from your hand/i);
});

test("Finn reads the current Condition directly from simulator state", () => {
  const result = resolveSimulatorFinnQuestion("What does the current condition do?", {
    activeConditionName: "Murky Water",
    activeConditionText: "Predator and Apex cards cost 1 less RP this round.",
  });
  assert.equal(result.answer.title, "Murky Water");
  assert.equal(result.answer.text, "Predator and Apex cards cost 1 less RP this round.");
});

test("Finn explains pan, zoom, Fit, Coral dragging, and slot dragging together", () => {
  const result = resolveSimulatorFinnQuestion("Where are my slots and how do I move them?");
  assert.match(result.answer.text, /empty water.*pan/i);
  assert.match(result.answer.text, /\+.*−.*Fit/i);
  assert.match(result.answer.text, /Drag a Coral.*connected slots/i);
  assert.match(result.answer.text, /empty slot/i);
  assert.match(result.answer.text, /layout.*not.*legal/i);
});

test("Finn gives phase-aware fallback help when no tutorial cue is active", () => {
  const result = resolveSimulatorFinnQuestion("What's next?", { gamePhase: "draw" });
  assert.match(result.answer.text, /Foundation and Pals decks/i);
  assert.match(result.answer.text, /confirm the draw.*review/i);
});

test("general card questions are expanded and delegated to the existing rules engine", () => {
  assert.equal(
    expandSimulatorFinnQuestion("What does this card do?", { selectedCardName: "Fairy Parrotfish" }),
    "What does Fairy Parrotfish do?",
  );
  const result = resolveSimulatorFinnQuestion("What does this card do?", {
    selectedCardName: "Fairy Parrotfish",
  });
  assert.equal(result.answer, null);
  assert.equal(result.delegatedQuestion, "What does Fairy Parrotfish do?");
});

test("Finn explains the strategic difference between the two personal decks", () => {
  const result = resolveSimulatorFinnQuestion("Which deck should I draw from?");
  assert.match(result.answer.text, /Foundation Deck.*Corals.*Creature Schools.*RP/i);
  assert.match(result.answer.text, /Pals Deck.*creatures.*Habitats.*Support/i);
});
