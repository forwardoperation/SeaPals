import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  RULES_CHAT_PLACEMENTS,
  getRulesChatGreeting,
  getRulesChatSuggestions,
  shouldRenderRulesChat,
} from "./rulesChatPresentation.mjs";

test("the global Finn launcher stays hidden on game routes while the embedded one is allowed", () => {
  assert.equal(shouldRenderRulesChat("/", RULES_CHAT_PLACEMENTS.SITE), true);
  assert.equal(shouldRenderRulesChat("/simulator", RULES_CHAT_PLACEMENTS.SITE), false);
  assert.equal(shouldRenderRulesChat("/adventure", RULES_CHAT_PLACEMENTS.SITE), false);
  assert.equal(shouldRenderRulesChat("/adventure/elverson", RULES_CHAT_PLACEMENTS.SITE), false);
  assert.equal(shouldRenderRulesChat("/instructions", RULES_CHAT_PLACEMENTS.SITE), true);
  assert.equal(shouldRenderRulesChat("/instructions/tutorial", RULES_CHAT_PLACEMENTS.SITE), false);
  assert.equal(shouldRenderRulesChat("/simulator", RULES_CHAT_PLACEMENTS.SIMULATOR), true);
  assert.equal(shouldRenderRulesChat("/instructions/tutorial", RULES_CHAT_PLACEMENTS.SIMULATOR), true);
  assert.equal(shouldRenderRulesChat("/adventure", RULES_CHAT_PLACEMENTS.SIMULATOR), true);
});

test("simulator Finn greets the player without claiming to alter or pause the match", () => {
  const greeting = getRulesChatGreeting(RULES_CHAT_PLACEMENTS.SIMULATOR);
  assert.match(greeting, /rule.*card.*simulator control/i);
  assert.match(greeting, /will not change your match/i);
  assert.doesNotMatch(greeting, /pause/i);
});

test("simulator suggestions follow the current phase and Condition", () => {
  const setup = getRulesChatSuggestions({ placement: RULES_CHAT_PLACEMENTS.SIMULATOR, gamePhase: "setup" });
  assert.deepEqual(setup, [
    "What should I do now?",
    "What can I play during setup?",
    "What does Coral Reef require?",
  ]);

  const main = getRulesChatSuggestions({
    placement: RULES_CHAT_PLACEMENTS.SIMULATOR,
    gamePhase: "main",
    activeConditionName: "Murky Water",
  });
  assert.deepEqual(main, [
    "What should I do now?",
    "Why can’t I play this card?",
    "What does Murky Water do?",
  ]);
});

test("Simulator mounts the embedded contextual Finn chat while the global chat remains route-aware", () => {
  const simulator = readFileSync(fileURLToPath(new URL("../../app/simulator/Simulator.jsx", import.meta.url)), "utf8");
  const chat = readFileSync(fileURLToPath(new URL("./RulesChat.jsx", import.meta.url)), "utf8");

  assert.match(simulator, /import RulesChat from "@\/components\/rules\/RulesChat"/);
  assert.match(simulator, /<RulesChat[\s\S]{0,500}placement="simulator"[\s\S]{0,1200}gameContext=/);
  assert.match(simulator, /tutorialAction: tutorialTargetBeaconHelp\?\.action/);
  assert.match(simulator, /selectedCardPlayError: handPopoverCard \? handPopoverPlayError : null/);
  assert.match(chat, /shouldRenderRulesChat\(pathname, placement\)/);
  assert.match(chat, /resolveSimulatorFinnQuestion\(nextQuestion, gameContext \?\? \{\}\)/);
  assert.match(chat, /top: "calc\(100% \+ 0\.75rem\)".*zIndex: 150/);
  assert.match(chat, /style=\{simulatorPlacement \? \{ zIndex: 140 \}/);
  assert.match(chat, /dorian-sprites\.png/);
  assert.doesNotMatch(chat, /🐠/u);
});
