import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SIMULATOR_TUTORIAL_CHECKPOINTS } from "./tutorialContract.mjs";
import {
  SIMULATOR_TUTORIAL_HELP_CHECKPOINT_IDS,
  getSimulatorTutorialConditionHelp,
  getSimulatorTutorialHelp,
  hasSimulatorTutorialHelp,
} from "./tutorialHelp.mjs";

const CHECKPOINTS = Object.fromEntries(
  DEFAULT_SIMULATOR_TUTORIAL_CHECKPOINTS.map((checkpoint) => [checkpoint.id, checkpoint]),
);

test("Professor help covers every canonical tutorial checkpoint", () => {
  assert.deepEqual(
    SIMULATOR_TUTORIAL_HELP_CHECKPOINT_IDS,
    DEFAULT_SIMULATOR_TUTORIAL_CHECKPOINTS.map((checkpoint) => checkpoint.id),
  );
  DEFAULT_SIMULATOR_TUTORIAL_CHECKPOINTS.forEach((checkpoint) => {
    assert.equal(hasSimulatorTutorialHelp(checkpoint.id), true);
    const help = getSimulatorTutorialHelp(checkpoint);
    assert.equal(help.id, checkpoint.id);
    assert.ok(help.cueId.startsWith(`${checkpoint.id}:`));
    assert.ok(help.message.length > 20);
    assert.ok(help.playerThought.length > 20);
    assert.ok(help.encouragement.length > 20);
    assert.ok(help.action.length > 10);
    assert.ok(help.target);
    assert.ok(help.targetLabel);
  });
});

test("condition lessons explain the exact effect as a short conversation", () => {
  const sunlight = getSimulatorTutorialConditionHelp({
    id: "abundant-sunlight",
    name: "Abundant Sunlight",
    text: "All players' RP bank cap is increased by +2.",
  }, 1);
  assert.equal(sunlight.title, "Begin by reading the water");
  assert.equal(sunlight.target, "condition-continue");
  assert.match(sunlight.message, /In the ocean.*photosynthesis.*depth.*water clarity.*weather.*season.*In SeaPals/i);
  assert.match(sunlight.message, /bank caps by 2.*does not add RP/i);
  assert.match(sunlight.playerThought, /hold more.*actually collected/i);
  assert.match(sunlight.cueId, /condition:r1:abundant-sunlight/);

  const clearWater = getSimulatorTutorialConditionHelp({
    id: "clear-water",
    name: "Clear Water",
    text: "Predator and Apex cost 1 more RP to play.",
  }, 2);
  assert.match(clearWater.message, /Predator and Apex.*1 more RP/i);
  assert.match(clearWater.message, /clear water.*suspended particles.*predators and prey.*In SeaPals.*visibility shift/i);
  assert.match(clearWater.message, /other Fish and Invertebrates.*normal costs/i);
  assert.match(clearWater.playerThought, /Arrow Crab.*Porcupine Fish/i);

  const algaeBloom = getSimulatorTutorialConditionHelp({
    id: "algae-bloom",
    name: "Algae Bloom",
    text: "Players cannot have more than 7 cards in their hands.",
  }, 3);
  assert.match(algaeBloom.message, /In the ocean.*rapid increases.*not all blooms are harmful.*block light.*lower oxygen/i);
  assert.match(algaeBloom.message, /In SeaPals.*seven-card hand limit.*Complete.*draw.*choose cards from your entire hand.*discard.*seven remain/i);
  assert.match(algaeBloom.playerThought, /keep the cards.*best support my plan.*choose the rest to discard/i);

  const murkyWater = getSimulatorTutorialConditionHelp({
    id: "murky-water",
    name: "Murky Water",
    text: "Predator and Apex cost 1 less RP to play.",
  }, 4);
  assert.match(murkyWater.message, /suspended sediment.*plankton.*reduce visibility.*not automatically mean polluted/i);
  assert.match(murkyWater.message, /In SeaPals.*possible advantage.*Predator and Apex.*1 RP/i);

  const bleaching = getSimulatorTutorialConditionHelp({
    id: "severe-coral-bleaching",
    name: "Severe Coral Bleaching",
    text: "Heat-sensitive Corals do not generate RP this round.",
  }, 5);
  assert.match(bleaching.message, /heat stress.*symbiotic algae.*stressed, not necessarily dead/i);
  assert.match(bleaching.message, /In SeaPals.*remain in play.*keep their slots.*no RP/i);

  const krillBloom = getSimulatorTutorialConditionHelp({
    id: "krill-ball",
    name: "Krill Bloom",
    text: "The next Filter Feeder each player plays costs 150 less School Density.",
  }, 6);
  assert.match(krillBloom.message, /currents.*dense swarms.*temporary food pulse.*filter feeders/i);
  assert.match(krillBloom.message, /next Filter Feeder.*150.*only once/i);
  assert.match(krillBloom.playerThought, /180.*150.*White Grunt.*30.*exactly enough/i);

  const bleakOvercast = getSimulatorTutorialConditionHelp({
    id: "bleak-overcast",
    name: "Bleak Overcast",
    text: "All players' RP bank cap is decreased by 2.",
  }, 7);
  assert.match(bleakOvercast.message, /cloud cover.*sunlight.*photosynthesis.*In SeaPals/i);
  assert.match(bleakOvercast.message, /bank caps by 2.*discarding RP above.*not card costs/i);
  assert.match(bleakOvercast.encouragement, /zero-cost Support.*Apex/i);

  const unfamiliarCondition = getSimulatorTutorialConditionHelp({
    id: "undertow",
    name: "Undertow",
    text: "All creatures must move one slot.",
  }, 8);
  assert.match(unfamiliarCondition.message, /weather.*seasons.*currents.*living processes.*human activity/i);
  assert.match(unfamiliarCondition.message, /simplified model.*Its game rule says.*move one slot/i);
});

test("setup help follows the live board even when saved progress is later", () => {
  const checkpoint = CHECKPOINTS["tutorial-attack"];

  const freshBoard = getSimulatorTutorialHelp(checkpoint, {
    gamePhase: "setup",
    hasCoralInPlay: false,
  });
  assert.equal(freshBoard.id, checkpoint.id);
  assert.equal(freshBoard.title, "Start with a foundation");
  assert.equal(freshBoard.target, "hand");
  assert.match(freshBoard.message, /saved tutorial progress will remain intact/i);

  const selectedFoundation = getSimulatorTutorialHelp(checkpoint, {
    gamePhase: "setup",
    hasCoralInPlay: false,
    modal: "hand",
    selectedHandCard: "lettuce-coral",
  });
  assert.equal(selectedFoundation.target, "play-card");

  const placing = getSimulatorTutorialHelp(checkpoint, {
    gamePhase: "setup",
    hasCoralInPlay: false,
    playingCardId: "lettuce-coral",
  });
  assert.equal(placing.target, "placement");

  const foundationReady = getSimulatorTutorialHelp(checkpoint, {
    gamePhase: "setup",
    hasCoralInPlay: true,
    handPopoverOpen: true,
  });
  assert.equal(foundationReady.title, "Begin Round");
  assert.equal(foundationReady.target, "turn-button");
  assert.match(foundationReady.action, /close your hand.*Begin Round/i);
});

test("scripted setup highlights only the prepared economy foundation", () => {
  const checkpoint = CHECKPOINTS["tutorial-setup"];
  const choose = getSimulatorTutorialHelp(checkpoint, {
    gamePhase: "setup",
    hasCoralInPlay: false,
    scriptedSetupCardId: "mustard-hill-coral-base",
    scriptedSetupCardName: "Mustard Hill Coral",
  });
  assert.equal(choose.title, "Begin with Mustard Hill Coral");
  assert.equal(choose.target, "hand");
  assert.equal(choose.targetCardId, "mustard-hill-coral-base");
  assert.match(choose.message, /Photosynthesis income.*card-action and attack lessons/i);

  const selected = getSimulatorTutorialHelp(checkpoint, {
    gamePhase: "setup",
    hasCoralInPlay: false,
    modal: "hand",
    selectedHandCard: "mustard-hill-coral-base",
    scriptedSetupCardId: "mustard-hill-coral-base",
    scriptedSetupCardName: "Mustard Hill Coral",
  });
  assert.equal(selected.target, "play-card");
  assert.equal(selected.targetCardId, "mustard-hill-coral-base");
  assert.notEqual(selected.cueId, choose.cueId);
  assert.equal(selected.lead, "");
  assert.match(selected.action, /Play Card.*place Mustard Hill Coral/i);

  const placing = getSimulatorTutorialHelp(checkpoint, {
    gamePhase: "setup",
    hasCoralInPlay: false,
    playingCardId: "mustard-hill-coral-base",
    playingCardName: "Mustard Hill Coral",
    scriptedSetupCardId: "mustard-hill-coral-base",
    scriptedSetupCardName: "Mustard Hill Coral",
  });
  assert.equal(placing.target, "placement");
  assert.notEqual(placing.cueId, selected.cueId);
  assert.equal(placing.title, "Place Mustard Hill Coral in Your Reef");
  assert.match(placing.message, /focused on Your Reef.*your cards belong/i);
  assert.match(placing.action, /glowing Place here marker.*Your Reef.*Mustard Hill Coral/i);
  assert.match(placing.targetLabel, /Place here marker in Your Reef/i);
  assert.match(placing.pointerPrompt, /Mustard Hill Coral.*marker in Your Reef/i);
});

test("an open V2 hand-card popout advances guidance without inventing a Close action", () => {
  const checkpoint = CHECKPOINTS["tutorial-setup"];
  const help = getSimulatorTutorialHelp(checkpoint, {
    gamePhase: "setup",
    hasCoralInPlay: false,
    handDockSelectionOpen: true,
    handPopoverOpen: true,
    selectedHandCard: "mustard-hill-coral-base",
    scriptedSetupCardId: "mustard-hill-coral-base",
    scriptedSetupCardName: "Mustard Hill Coral",
  });

  assert.equal(help.target, "play-card");
  assert.doesNotMatch(help.action, /close/i);
});

test("turn draw cues always point inside the blocking draw modal", () => {
  const draw = CHECKPOINTS["tutorial-draw-card"];
  const drawChoice = getSimulatorTutorialHelp(draw, {
    modal: "turn-draw",
    drawSelected: 0,
    drawTarget: 1,
    foundationDeckCount: 10,
    palsDeckCount: 10,
  });
  assert.equal(drawChoice.title, "Choose a deck with a plan");
  assert.equal(drawChoice.target, "draw-controls");
  assert.equal(drawChoice.targetDeck, "foundation");
  assert.match(drawChoice.message, /Foundation Deck.*economy.*best early-game draw/i);
  assert.match(drawChoice.message, /Pals Deck.*creatures.*habitats.*support.*VP/i);

  const foundationChoice = getSimulatorTutorialHelp(draw, {
    modal: "turn-draw",
    drawSelected: 1,
    drawFoundationSelected: 1,
    drawPalsSelected: 0,
    drawTarget: 1,
    foundationDeckCount: 10,
    palsDeckCount: 10,
  });
  assert.equal(foundationChoice.target, "confirm-draw");
  assert.match(foundationChoice.action, /Good early-game choice/i);

  const attack = CHECKPOINTS["tutorial-attack"];
  const attackDraw = getSimulatorTutorialHelp(attack, {
    modal: "turn-draw",
    drawSelected: 0,
    drawTarget: 1,
    foundationDeckCount: 10,
    palsDeckCount: 10,
  });
  assert.equal(attackDraw.title, "Draw toward a legal attack");
  assert.equal(attackDraw.target, "draw-controls");
  assert.equal(attackDraw.targetDeck, "pals");
  assert.match(attackDraw.action, /Pals Deck.*creature.*attack/i);
  assert.notEqual(attackDraw.target, "player-board");

  const plannedAttackDraw = getSimulatorTutorialHelp(attack, {
    modal: "turn-draw",
    drawSelected: 0,
    drawTarget: 1,
    foundationDeckCount: 10,
    palsDeckCount: 10,
    plannedAttack: {
      cardId: "blue-crab",
      cardName: "Blue Crab",
      actionKey: "slot-blue-crab-1",
      attackName: "Claw Snap",
      attackCost: 1,
      targetCount: 2,
    },
  });
  assert.equal(plannedAttackDraw.title, "Draw, then attack with Blue Crab");
  assert.equal(plannedAttackDraw.target, "draw-controls");
  assert.match(plannedAttackDraw.message, /Claw Snap.*2 legal targets/i);

  const plannedHandAttack = getSimulatorTutorialHelp(attack, {
    modal: "turn-draw",
    drawSelected: 0,
    drawTarget: 1,
    foundationDeckCount: 10,
    palsDeckCount: 10,
    plannedAttackSetupCard: {
      cardId: "blue-crab",
      cardName: "Blue Crab",
      cost: 2,
      attackName: "Claw Snap",
      targetCount: 1,
    },
  });
  assert.equal(plannedHandAttack.title, "Draw, then play Blue Crab");
  assert.equal(plannedHandAttack.target, "draw-controls");
  assert.match(plannedHandAttack.message, /action phase.*retain enough RP.*1 legal target/i);
});

test("scripted lesson deliberately bridges the economy turn into Arrow Crab", () => {
  const checkpoint = CHECKPOINTS["tutorial-attack"];
  const firstTurn = getSimulatorTutorialHelp(checkpoint, {
    scriptedLesson: true,
    round: 1,
    nextPalsCardName: "Arrow Crab",
  });
  assert.equal(firstTurn.title, "Let the first reef settle");
  assert.equal(firstTurn.lead, "");
  assert.equal(firstTurn.target, "turn-button");
  assert.match(firstTurn.message, /established a foundation.*economy/i);
  assert.match(firstTurn.message, /Arrow Crab.*next card.*Pals Deck/i);
  assert.match(firstTurn.action, /End your turn.*Round 2.*Pals Deck/i);

  const preparedDraw = getSimulatorTutorialHelp(checkpoint, {
    scriptedLesson: true,
    round: 2,
    modal: "turn-draw",
    drawSelected: 0,
    drawTarget: 1,
    foundationDeckCount: 10,
    palsDeckCount: 10,
    nextPalsCardName: "Arrow Crab",
  });
  assert.equal(preparedDraw.title, "Draw the prepared Arrow Crab");
  assert.equal(preparedDraw.lead, "");
  assert.equal(preparedDraw.target, "draw-controls");
  assert.equal(preparedDraw.targetDeck, "pals");
  assert.match(preparedDraw.message, /card action, not an attack/i);
  assert.match(preparedDraw.message, /Scavenge action deliberately/i);
  assert.match(preparedDraw.action, /Pals Deck/i);
  assert.match(preparedDraw.cueId, /scripted-arrow-crab/);

  const selectedDraw = getSimulatorTutorialHelp(checkpoint, {
    scriptedLesson: true,
    round: 2,
    modal: "turn-draw",
    drawSelected: 1,
    drawFoundationSelected: 0,
    drawPalsSelected: 1,
    drawTarget: 1,
    foundationDeckCount: 10,
    palsDeckCount: 10,
    nextPalsCardName: "Arrow Crab",
  });
  assert.equal(selectedDraw.target, "confirm-draw");
  assert.match(selectedDraw.action, /Draw Selected Cards.*Arrow Crab/i);

  const wrongDeckSelected = getSimulatorTutorialHelp(checkpoint, {
    scriptedLesson: true,
    round: 2,
    modal: "turn-draw",
    drawSelected: 1,
    drawFoundationSelected: 1,
    drawPalsSelected: 0,
    drawTarget: 1,
    foundationDeckCount: 10,
    palsDeckCount: 10,
    nextPalsCardName: "Arrow Crab",
  });
  assert.equal(wrongDeckSelected.target, "draw-controls");
  assert.equal(wrongDeckSelected.targetDeck, "pals");
  assert.match(wrongDeckSelected.action, /switch.*Pals Deck/i);

  const restoredArrowInHand = getSimulatorTutorialHelp(checkpoint, {
    scriptedLesson: true,
    round: 1,
    nextPalsCardName: "Porcupine Fish",
    recommendedBuildCard: {
      cardId: "arrow-crab",
      cardName: "Arrow Crab",
      kindLabel: "Reef Invertebrate",
      cost: 1,
    },
  });
  assert.notEqual(restoredArrowInHand.title, "Let the first reef settle");
  assert.equal(restoredArrowInHand.target, "hand");
  assert.equal(restoredArrowInHand.targetCardId, "arrow-crab");

  const bankForAttack = getSimulatorTutorialHelp(checkpoint, {
    scriptedLesson: true,
    round: 2,
    scriptedAttackCardInHand: true,
    scriptedAttackCardCost: 2,
    scriptedAttackActionCost: 1,
    availableRp: 1,
  });
  assert.equal(bankForAttack.title, "Bank RP for Porcupine Fish");
  assert.equal(bankForAttack.target, "turn-button");
  assert.match(bankForAttack.message, /costs 2 RP.*Crunch.*another 1 RP.*have 1 RP/i);
  assert.match(bankForAttack.action, /End your turn.*next condition.*play Porcupine Fish.*Crunch.*Sea Urchin/i);
  assert.match(bankForAttack.playerThought, /enough RP for the entire sequence/i);

  const bankFromHand = getSimulatorTutorialHelp(checkpoint, {
    scriptedLesson: true,
    round: 2,
    scriptedAttackCardInHand: true,
    scriptedAttackCardCost: 2,
    scriptedAttackActionCost: 1,
    availableRp: 1,
    modal: "hand",
  });
  assert.equal(bankFromHand.title, "Save Porcupine Fish for the next tide");
  assert.equal(bankFromHand.target, "close-modal");
  assert.match(bankFromHand.action, /Close your hand.*end the turn/i);

  const delayedBank = getSimulatorTutorialHelp(checkpoint, {
    scriptedLesson: true,
    round: 4,
    scriptedAttackCardInHand: true,
    scriptedAttackCardCost: 2,
    scriptedAttackActionCost: 1,
    availableRp: 2,
    readyUtilityAction: {
      cardId: "arrow-crab",
      cardName: "Arrow Crab",
      actionKey: "slot-arrow-crab-1",
      utilityActionKey: "slot-arrow-crab-1:scavenge",
      actionName: "Scavenge",
      actionCost: 2,
      ready: true,
    },
  });
  assert.equal(delayedBank.title, "Bank RP for Porcupine Fish");
  assert.equal(delayedBank.target, "turn-button");
});

test("draw-result cue names the actual card and bridges to the next legal action", () => {
  const checkpoint = CHECKPOINTS["tutorial-attack"];
  const help = getSimulatorTutorialHelp(checkpoint, {
    modal: "draw-result",
    drawnCards: [{
      cardId: "leather-starfish",
      name: "Leather Starfish",
      source: "Pals",
      kindLabel: "Reef Invertebrate",
      cost: 1,
      victoryPoints: 1,
      playError: "",
      attack: { name: "Slow Eat", cost: 1, targetCount: 0 },
    }],
    recommendedBuildCard: {
      cardId: "leather-starfish",
      cardName: "Leather Starfish",
      cost: 1,
    },
  });

  assert.equal(help.title, "You drew Leather Starfish");
  assert.equal(help.target, "continue-actions");
  assert.match(help.message, /Pals Deck.*Reef Invertebrate.*1 RP/i);
  assert.match(help.message, /1 VP/i);
  assert.match(help.message, /Slow Eat.*no legal target/i);
  assert.match(help.action, /cannot make a legal attack yet.*play Leather Starfish/i);
  assert.match(help.cueId, /draw-result:r.*leather-starfish/);
});

test("draw-result cue tells the player to choose hand-limit discards", () => {
  const help = getSimulatorTutorialHelp(CHECKPOINTS["tutorial-build-card"], {
    modal: "draw-result",
    drawnCards: [{
      cardId: "brain-coral",
      name: "Brain Coral",
      source: "Foundation",
      discarded: true,
    }],
  });
  assert.match(help.message, /hand over the limit.*choose.*entire hand.*discard/i);
  assert.doesNotMatch(help.action, /play Brain Coral/i);
});

test("build help recommends an actual legal ecosystem card, not a Support", () => {
  const checkpoint = CHECKPOINTS["tutorial-build-card"];
  const recommendation = getSimulatorTutorialHelp(checkpoint, {
    recommendedBuildCard: {
      cardId: "lettuce-coral",
      cardName: "Lettuce Coral",
      kindLabel: "Stage 1 Reef Coral",
      cost: 2,
      victoryPoints: 1,
    },
  });
  assert.equal(recommendation.title, "Play Lettuce Coral");
  assert.equal(recommendation.target, "hand");
  assert.equal(recommendation.targetCardId, "lettuce-coral");
  assert.equal(recommendation.targetLabel, "Lettuce Coral in your hand");
  assert.match(recommendation.message, /2 RP.*1 VP/i);

  const supportHelp = getSimulatorTutorialHelp(checkpoint, {
    modal: "hand",
    selectedHandCard: "coral-gardener",
    selectedCardIsSupport: true,
    selectedCardName: "Coral Gardener",
    selectedCardCost: 0,
    selectedSupportLocksFurtherSupports: true,
  });
  assert.equal(supportHelp.title, "A useful detour, not a build");
  assert.equal(supportHelp.target, "play-card");
  assert.match(supportHelp.message, /does not stay.*will not complete this build step/i);
  assert.match(supportHelp.message, /last Support card this turn/i);

  const unavailable = getSimulatorTutorialHelp(checkpoint, {
    modal: "hand",
    selectedHandCard: "brain-coral-stage-2",
    selectedCardName: "Brain Coral Stage 2",
    selectedCardPlayError: "You do not have the previous stage of Brain Coral in your ecosystem.",
    recommendedBuildCard: {
      cardId: "lettuce-coral",
      cardName: "Lettuce Coral",
      cost: 2,
    },
  });
  assert.equal(unavailable.title, "Brain Coral Stage 2 is not playable yet");
  assert.equal(unavailable.target, "hand");
  assert.equal(unavailable.targetCardId, "lettuce-coral");
  assert.match(unavailable.message, /previous stage/i);
  assert.match(unavailable.action, /Lettuce Coral.*legal right now/i);

  const placing = getSimulatorTutorialHelp(checkpoint, { playingCardId: "lettuce-coral" });
  assert.equal(placing.target, "placement");
});

test("attack help names and focuses a genuinely legal attacker", () => {
  const checkpoint = CHECKPOINTS["tutorial-attack"];
  const readyAttack = {
    cardId: "blue-crab",
    cardName: "Blue Crab",
    actionKey: "slot-blue-crab-1",
    attackName: "Claw Snap",
    attackCost: 1,
    targetCount: 2,
  };

  const boardHelp = getSimulatorTutorialHelp(checkpoint, { readyAttack });
  assert.equal(boardHelp.title, "Attack with Blue Crab");
  assert.equal(boardHelp.target, "player-board");
  assert.equal(boardHelp.targetActionKey, "slot-blue-crab-1");
  assert.match(boardHelp.message, /Claw Snap.*1 RP.*2 legal targets/i);

  const inspectorHelp = getSimulatorTutorialHelp(checkpoint, {
    readyAttack,
    inspectedAttack: { ...readyAttack, ready: true },
  });
  assert.equal(inspectorHelp.target, "attack-button");
  assert.match(inspectorHelp.action, /Use Claw Snap/i);

  const wrongInspector = getSimulatorTutorialHelp(checkpoint, {
    readyAttack,
    inspectedPlayerCard: true,
    inspectedCardName: "Leather Starfish",
    inspectedAttack: {
      cardId: "leather-starfish",
      cardName: "Leather Starfish",
      actionKey: "slot-leather-starfish-1",
      attackName: "Slow Eat",
      attackCost: 1,
      targetCount: 0,
      ready: false,
      blockReason: "Leather Starfish's Slow Eat has no compatible target.",
    },
  });
  assert.equal(wrongInspector.target, "close-modal");
  assert.match(wrongInspector.message, /no compatible target/i);
  assert.match(wrongInspector.action, /close.*Blue Crab.*Claw Snap/i);

  const mobileHand = getSimulatorTutorialHelp(checkpoint, {
    modal: "hand",
    selectedHandCard: "recovery",
    readyAttack,
  });
  assert.equal(mobileHand.target, "close-modal");
  assert.match(mobileHand.action, /Close your hand.*Blue Crab.*Claw Snap/i);

  const targetHelp = getSimulatorTutorialHelp(checkpoint, {
    attackContext: true,
    activeAttack: { cardId: "blue-crab", cardName: "Blue Crab", attackName: "Claw Snap" },
  });
  assert.equal(targetHelp.target, "opponent-board");
  assert.match(targetHelp.title, /Blue Crab is attacking/i);
});

test("attack help recognizes a usable non-attack card action and keeps the lesson honest", () => {
  const checkpoint = CHECKPOINTS["tutorial-attack"];
  const readyUtilityAction = {
    cardId: "arrow-crab",
    cardName: "Arrow Crab",
    actionKey: "slot-arrow-crab-1",
    utilityActionKey: "slot-arrow-crab-1:scavenge",
    actionName: "Scavenge",
    actionText: "Discard two cards from your hand, then search your deck for a card.",
    actionCost: 2,
    ready: true,
  };

  const boardHelp = getSimulatorTutorialHelp(checkpoint, { readyUtilityAction });
  assert.equal(boardHelp.title, "Use Arrow Crab's Scavenge");
  assert.equal(boardHelp.target, "player-board");
  assert.equal(boardHelp.targetActionKey, "slot-arrow-crab-1");
  assert.match(boardHelp.message, /legal card action.*2 RP/i);
  assert.match(boardHelp.message, /discard two cards.*search your deck/i);
  assert.match(boardHelp.message, /not an attack.*attack lesson.*waiting/i);
  assert.match(boardHelp.action, /Select Arrow Crab.*Use Scavenge \(2 RP\).*reassess/i);

  const inspectorHelp = getSimulatorTutorialHelp(checkpoint, {
    readyUtilityAction,
    inspectedPlayerCard: true,
    inspectedCardName: "Arrow Crab",
    inspectedUtilityAction: readyUtilityAction,
  });
  assert.equal(inspectorHelp.title, "Use Scavenge");
  assert.equal(inspectorHelp.target, "utility-action-button");
  assert.equal(inspectorHelp.targetActionKey, "slot-arrow-crab-1:scavenge");
  assert.equal(inspectorHelp.targetLabel, "Scavenge on Arrow Crab");
  assert.match(inspectorHelp.action, /Use Scavenge \(2 RP\).*prompts/i);

  const drawResultHelp = getSimulatorTutorialHelp(checkpoint, {
    modal: "draw-result",
    drawnCards: [{ cardId: "leather-starfish", name: "Leather Starfish", source: "Pals" }],
    readyUtilityAction,
  });
  assert.equal(drawResultHelp.target, "continue-actions");
  assert.match(drawResultHelp.action, /select Arrow Crab.*Scavenge.*2 RP/i);
  assert.match(drawResultHelp.action, /will not complete the attack lesson/i);
});

test("a legal attack remains the guided priority over an optional card action", () => {
  const checkpoint = CHECKPOINTS["tutorial-attack"];
  const help = getSimulatorTutorialHelp(checkpoint, {
    readyAttack: {
      cardId: "blue-crab",
      cardName: "Blue Crab",
      actionKey: "slot-blue-crab-1",
      attackName: "Claw Snap",
      attackCost: 1,
      targetCount: 1,
    },
    readyUtilityAction: {
      cardId: "arrow-crab",
      cardName: "Arrow Crab",
      actionKey: "slot-arrow-crab-1",
      utilityActionKey: "slot-arrow-crab-1:scavenge",
      actionName: "Scavenge",
      actionCost: 2,
      ready: true,
    },
  });

  assert.equal(help.title, "Attack with Blue Crab");
  assert.equal(help.targetActionKey, "slot-blue-crab-1");
});

test("attack help gives a feasible setup or end-turn fallback", () => {
  const checkpoint = CHECKPOINTS["tutorial-attack"];
  const setupCard = {
    cardId: "blue-crab",
    cardName: "Blue Crab",
    kindLabel: "Reef Invertebrate",
    cost: 2,
    attackName: "Claw Snap",
    attackCost: 1,
    targetCount: 1,
  };
  const setupHelp = getSimulatorTutorialHelp(checkpoint, { attackSetupCard: setupCard });
  assert.equal(setupHelp.title, "Play Blue Crab to prepare an attack");
  assert.equal(setupHelp.target, "hand");
  assert.equal(setupHelp.targetCardId, "blue-crab");
  assert.match(setupHelp.action, /placement or effect prompt.*use Claw Snap/i);

  const selectedSetup = getSimulatorTutorialHelp(checkpoint, {
    modal: "hand",
    selectedHandCard: "blue-crab",
    attackSetupCard: setupCard,
  });
  assert.equal(selectedSetup.target, "play-card");
  assert.match(selectedSetup.action, /Press Play Card.*placement or effect prompt.*Claw Snap/i);

  const placingSetup = getSimulatorTutorialHelp(checkpoint, {
    playingCardId: "blue-crab",
    playingCardName: "Blue Crab",
  });
  assert.equal(placingSetup.title, "Place Blue Crab");
  assert.equal(placingSetup.target, "placement");

  const blocked = getSimulatorTutorialHelp(checkpoint, {
    attackBlockReason: "Leather Starfish's Slow Eat has no compatible target on Professor Current's board.",
  });
  assert.equal(blocked.title, "No legal attack yet");
  assert.equal(blocked.target, "turn-button");
  assert.match(blocked.message, /Leather Starfish.*no compatible target/i);
  assert.match(blocked.action, /Pals Deck/i);

  const needsRp = getSimulatorTutorialHelp(checkpoint, {
    attackBlock: { blockType: "rp" },
    attackBlockReason: "Blue Crab's Claw Snap costs 2 RP, but you have 0 RP.",
  });
  assert.equal(needsRp.target, "turn-button");
  assert.match(needsRp.action, /collect RP.*Foundation Deck.*economy/i);
});

test("cue identity changes as the same checkpoint becomes executable", () => {
  const checkpoint = CHECKPOINTS["tutorial-attack"];
  const drawCue = getSimulatorTutorialHelp(checkpoint, {
    modal: "draw-result",
    drawnCards: [{ cardId: "leather-starfish", name: "Leather Starfish", source: "Pals" }],
  });
  const blockedCue = getSimulatorTutorialHelp(checkpoint, {
    attackBlockReason: "No compatible target.",
  });
  const readyCue = getSimulatorTutorialHelp(checkpoint, {
    readyAttack: {
      cardId: "blue-crab",
      cardName: "Blue Crab",
      actionKey: "slot-blue-crab-1",
      attackName: "Claw Snap",
      attackCost: 1,
      targetCount: 1,
    },
  });
  assert.notEqual(drawCue.cueId, blockedCue.cueId);
  assert.notEqual(blockedCue.cueId, readyCue.cueId);
});

const FINISH_DUEL_STATE = Object.freeze({
  victoryPending: true,
  playerVp: 4,
  opponentVp: 2,
  victoryTarget: 10,
  round: 3,
  turn: 5,
  gamePhase: "main",
});

function scriptedFinishRoute({
  activeConditionId = "algae-bloom",
  cards = {},
  utilityAction = null,
  attackAction = null,
  attackTargetInPlay = true,
  finishAttackTargetInPlay = true,
} = {}) {
  const defaults = {
    setup: { cardId: "mustard-hill-coral-base", cardName: "Mustard Hill Coral", cost: 2, printedCost: 2, victoryPoints: 0, inPlay: true },
    economy: { cardId: "pillar-coral-base", cardName: "Pillar Coral", cost: 3, printedCost: 3, victoryPoints: 0, inPlay: true },
    utility: { cardId: "arrow-crab", cardName: "Arrow Crab", cost: 1, printedCost: 1, victoryPoints: 1, inPlay: true },
    attack: { cardId: "porcupine-fish", cardName: "Porcupine Fish", cost: 2, printedCost: 2, victoryPoints: 2, inPlay: true },
    heldFinish: { cardId: "giant-clam", cardName: "Giant Clam", cost: 5, printedCost: 5, victoryPoints: 3, inHand: true, ready: true },
    finishSearch: { cardId: "spinner-dolphins", cardName: "Spinner Dolphins", cost: 4, printedCost: 4, victoryPoints: 4, inPalsDeck: true },
  };
  return {
    active: true,
    plan: {
      setupCardId: "mustard-hill-coral-base",
      economyCardId: "pillar-coral-base",
      utilityCardId: "arrow-crab",
      attackCardId: "porcupine-fish",
      attackTargetCardId: "sea-urchin",
      heldFinishCardId: "giant-clam",
      finishSearchCardId: "spinner-dolphins",
      finishAttackTargetCardId: "frogfish",
      victoryTarget: 10,
      finishRound: 4,
    },
    cards: Object.fromEntries(Object.entries(defaults).map(([key, value]) => [
      key,
      { ...value, ...(cards[key] ?? {}) },
    ])),
    activeConditionId,
    utilityAction,
    attackAction,
    attackTargetInPlay,
    finishAttackTargetInPlay,
  };
}

test("post-checklist help remains active only while the 10 VP victory is pending", () => {
  assert.equal(getSimulatorTutorialHelp(null), null);
  assert.equal(getSimulatorTutorialHelp(null, { ...FINISH_DUEL_STATE, victoryPending: false }), null);
  assert.equal(getSimulatorTutorialHelp(null, { ...FINISH_DUEL_STATE, playerVp: 10 }), null);

  const help = getSimulatorTutorialHelp(null, FINISH_DUEL_STATE);
  assert.equal(help.id, "tutorial-finish-duel");
  assert.equal(help.progressLabel, "Final goal • 4/10 VP");
  assert.equal(help.target, "turn-button");
  assert.match(help.message, /4\/10 VP.*I am at 2/i);
  assert.doesNotMatch(help.message, /Mr\. Easterling/i);

  const customGuide = getSimulatorTutorialHelp(null, {
    ...FINISH_DUEL_STATE,
    guideName: "Marine Biologist Jonah",
  });
  assert.match(customGuide.message, /4\/10 VP.*I am at 2/i);
  assert.doesNotMatch(customGuide.message, /Marine Biologist Jonah|Mr\. Easterling|Professor Current/i);
});

test("post-checklist help preserves draw, result, and placement prerequisites", () => {
  const draw = getSimulatorTutorialHelp(null, {
    ...FINISH_DUEL_STATE,
    gamePhase: "draw",
    modal: "turn-draw",
    drawSelected: 0,
    drawTarget: 1,
    foundationDeckCount: 10,
    palsDeckCount: 10,
  });
  assert.equal(draw.target, "draw-controls");
  assert.equal(draw.targetDeck, "pals");
  assert.match(draw.action, /Pals Deck/i);

  const result = getSimulatorTutorialHelp(null, {
    ...FINISH_DUEL_STATE,
    gamePhase: "draw",
    modal: "draw-result",
    drawnCards: [{ cardId: "blue-crab", name: "Blue Crab", source: "Pals" }],
  });
  assert.equal(result.target, "continue-actions");
  assert.match(result.title, /Blue Crab/i);

  const placement = getSimulatorTutorialHelp(null, {
    ...FINISH_DUEL_STATE,
    playingCardId: "blue-crab",
    playingCardName: "Blue Crab",
  });
  assert.equal(placement.target, "placement");
  assert.match(placement.action, /glowing legal placement/i);
});

test("post-checklist help prioritizes a legal VP build over other legal actions", () => {
  const vpBuild = {
    cardId: "spinner-dolphins",
    cardName: "Spinner Dolphins",
    kindLabel: "Predator",
    cost: 4,
    victoryPoints: 3,
  };
  const help = getSimulatorTutorialHelp(null, {
    ...FINISH_DUEL_STATE,
    recommendedVpBuildCard: vpBuild,
    recommendedBuildCard: { cardId: "brain-coral", cardName: "Brain Coral", cost: 2, victoryPoints: 0 },
    readyUtilityAction: {
      cardId: "arrow-crab",
      cardName: "Arrow Crab",
      actionKey: "slot-arrow-crab-1",
      utilityActionKey: "slot-arrow-crab-1:scavenge",
      actionName: "Scavenge",
      actionCost: 2,
      ready: true,
    },
    readyAttack: {
      cardId: "blue-crab",
      cardName: "Blue Crab",
      actionKey: "slot-blue-crab-1",
      attackName: "Claw Snap",
      attackCost: 1,
      targetCount: 1,
      ready: true,
    },
  });
  assert.equal(help.target, "hand");
  assert.equal(help.targetCardId, "spinner-dolphins");
  assert.match(help.title, /3 VP.*Spinner Dolphins/i);

  const selected = getSimulatorTutorialHelp(null, {
    ...FINISH_DUEL_STATE,
    ...{
      modal: "hand",
      selectedHandCard: "spinner-dolphins",
      selectedCardName: "Spinner Dolphins",
      selectedCardVictoryPoints: 3,
      selectedCardPlayError: "",
      recommendedVpBuildCard: vpBuild,
    },
  });
  assert.equal(selected.target, "play-card");
  assert.match(selected.title, /Play Spinner Dolphins for 3 VP/i);
});

test("post-checklist fallback order is utility, attack, build, then end turn", () => {
  const utility = {
    cardId: "arrow-crab",
    cardName: "Arrow Crab",
    actionKey: "slot-arrow-crab-1",
    utilityActionKey: "slot-arrow-crab-1:scavenge",
    actionName: "Scavenge",
    actionText: "Discard two, then search your deck.",
    actionCost: 2,
    ready: true,
  };
  const attack = {
    cardId: "blue-crab",
    cardName: "Blue Crab",
    actionKey: "slot-blue-crab-1",
    attackName: "Claw Snap",
    attackCost: 1,
    targetCount: 1,
    ready: true,
  };
  const build = { cardId: "brain-coral", cardName: "Brain Coral", cost: 2, victoryPoints: 0 };

  assert.equal(getSimulatorTutorialHelp(null, {
    ...FINISH_DUEL_STATE,
    readyUtilityAction: utility,
    readyAttack: attack,
    recommendedBuildCard: build,
  }).targetActionKey, utility.actionKey);
  assert.equal(getSimulatorTutorialHelp(null, {
    ...FINISH_DUEL_STATE,
    readyAttack: attack,
    recommendedBuildCard: build,
  }).targetActionKey, attack.actionKey);
  assert.equal(getSimulatorTutorialHelp(null, {
    ...FINISH_DUEL_STATE,
    recommendedBuildCard: build,
  }).targetCardId, build.cardId);
  assert.equal(getSimulatorTutorialHelp(null, FINISH_DUEL_STATE).target, "turn-button");
});

test("post-checklist cue changes with score, round, and recommendation", () => {
  const first = getSimulatorTutorialHelp(null, {
    ...FINISH_DUEL_STATE,
    recommendedVpBuildCard: { cardId: "blue-crab", cardName: "Blue Crab", cost: 2, victoryPoints: 1 },
  });
  const scoreChanged = getSimulatorTutorialHelp(null, {
    ...FINISH_DUEL_STATE,
    playerVp: 5,
    recommendedVpBuildCard: { cardId: "blue-crab", cardName: "Blue Crab", cost: 2, victoryPoints: 1 },
  });
  const roundAndCardChanged = getSimulatorTutorialHelp(null, {
    ...FINISH_DUEL_STATE,
    round: 4,
    recommendedVpBuildCard: { cardId: "spinner-dolphins", cardName: "Spinner Dolphins", cost: 4, victoryPoints: 3 },
  });

  assert.notEqual(first.cueId, scoreChanged.cueId);
  assert.notEqual(first.cueId, roundAndCardChanged.cueId);
});

test("scripted post-checklist draws preserve the authored economy and Scavenge route", () => {
  const roundOneRoute = scriptedFinishRoute({
    cards: {
      economy: { inPlay: false, inFoundationDeck: true },
      utility: { inPlay: false, inPalsDeck: true },
      attack: { inPlay: false, inPalsDeck: true },
    },
  });
  const economyDraw = getSimulatorTutorialHelp(null, {
    ...FINISH_DUEL_STATE,
    playerVp: 0,
    round: 1,
    gamePhase: "draw",
    modal: "turn-draw",
    drawSelected: 0,
    drawTarget: 1,
    foundationDeckCount: 10,
    palsDeckCount: 10,
    scriptedFinishRoute: roundOneRoute,
  });
  assert.equal(economyDraw.target, "draw-controls");
  assert.equal(economyDraw.targetDeck, "foundation");
  assert.match(economyDraw.message, /Pillar Coral.*economy/i);

  const wrongEconomyDraw = getSimulatorTutorialHelp(null, {
    ...FINISH_DUEL_STATE,
    playerVp: 0,
    round: 1,
    gamePhase: "draw",
    modal: "turn-draw",
    drawSelected: 1,
    drawFoundationSelected: 0,
    drawPalsSelected: 1,
    drawTarget: 1,
    foundationDeckCount: 10,
    palsDeckCount: 10,
    scriptedFinishRoute: roundOneRoute,
  });
  assert.equal(wrongEconomyDraw.target, "draw-controls");
  assert.equal(wrongEconomyDraw.targetDeck, "pals");
  assert.equal(wrongEconomyDraw.targetDrawAction, "remove");
  assert.match(wrongEconomyDraw.action, /minus.*Pals Deck.*Foundation Deck/i);

  const roundTwoRoute = scriptedFinishRoute({
    cards: {
      utility: { inPlay: false, inPalsDeck: true },
      attack: { inPlay: false, inPalsDeck: true },
    },
  });
  const utilityDraw = getSimulatorTutorialHelp(null, {
    ...FINISH_DUEL_STATE,
    playerVp: 0,
    round: 2,
    gamePhase: "draw",
    modal: "turn-draw",
    drawSelected: 0,
    drawTarget: 1,
    foundationDeckCount: 10,
    palsDeckCount: 10,
    scriptedFinishRoute: roundTwoRoute,
  });
  assert.equal(utilityDraw.targetDeck, "pals");
  assert.match(utilityDraw.message, /Arrow Crab.*Scavenge/i);
});

test("Round 3 explicitly draws Foundation, Scavenges Spinner Dolphins, and banks it", () => {
  const utilityAction = {
    cardId: "arrow-crab",
    cardName: "Arrow Crab",
    actionKey: "slot-arrow-crab",
    utilityActionKey: "slot-arrow-crab:scavenge",
    actionName: "Scavenge",
    actionCost: 2,
    ready: true,
  };
  const route = scriptedFinishRoute({ utilityAction });
  const draw = getSimulatorTutorialHelp(null, {
    ...FINISH_DUEL_STATE,
    playerVp: 3,
    round: 3,
    gamePhase: "draw",
    modal: "turn-draw",
    drawSelected: 0,
    drawTarget: 1,
    foundationDeckCount: 8,
    palsDeckCount: 8,
    scriptedFinishRoute: route,
  });
  assert.equal(draw.targetDeck, "foundation");
  assert.match(draw.message, /Keep Spinner Dolphins inside the Pals Deck/i);

  const scavenge = getSimulatorTutorialHelp(null, {
    ...FINISH_DUEL_STATE,
    playerVp: 3,
    round: 3,
    availableRp: 5,
    scriptedFinishRoute: route,
  });
  assert.equal(scavenge.target, "player-board");
  assert.equal(scavenge.targetActionKey, "slot-arrow-crab");
  assert.match(scavenge.title, /Search for Spinner Dolphins/i);
  assert.match(scavenge.message, /5 RP.*second Scavenge.*Giant Clam/i);

  const bank = getSimulatorTutorialHelp(null, {
    ...FINISH_DUEL_STATE,
    playerVp: 3,
    round: 3,
    availableRp: 3,
    scriptedFinishRoute: scriptedFinishRoute({
      utilityAction: { ...utilityAction, ready: false, blockType: "used" },
      cards: {
        finishSearch: { inPalsDeck: false, inHand: true, ready: false, playError: "Not enough RP" },
      },
    }),
  });
  assert.equal(bank.target, "turn-button");
  assert.match(bank.title, /Protect the two-card finish/i);
  assert.match(bank.message, /Spinner Dolphins.*Giant Clam.*Murky Water/i);
});

test("Round 4 explains Murky Water, Spinner's target, and Giant Clam's exact finish", () => {
  const finalRoute = scriptedFinishRoute({
    activeConditionId: "murky-water",
    cards: {
      finishSearch: { inPalsDeck: false, inHand: true, ready: true, cost: 3, playError: "" },
    },
  });
  const spinner = getSimulatorTutorialHelp(null, {
    ...FINISH_DUEL_STATE,
    playerVp: 3,
    round: 4,
    availableRp: 8,
    scriptedFinishRoute: finalRoute,
  });
  assert.equal(spinner.target, "hand");
  assert.equal(spinner.targetCardId, "spinner-dolphins");
  assert.match(spinner.title, /Murky Water.*Spinner Dolphins/i);
  assert.match(spinner.message, /4 RP to 3 RP.*4 VP/i);

  const spinnerAttack = getSimulatorTutorialHelp(null, {
    ...FINISH_DUEL_STATE,
    playerVp: 7,
    round: 4,
    attackContext: true,
    activeAttack: { cardId: "spinner-dolphins", cardName: "Spinner Dolphins", attackName: "Agile Hunt" },
    scriptedFinishRoute: scriptedFinishRoute({
      activeConditionId: "murky-water",
      cards: {
        finishSearch: { inPalsDeck: false, inHand: false, inPlay: true, cost: 3 },
      },
    }),
  });
  assert.equal(spinnerAttack.target, "opponent-board");
  assert.match(spinnerAttack.message, /Frogfish/i);

  const clam = getSimulatorTutorialHelp(null, {
    ...FINISH_DUEL_STATE,
    playerVp: 7,
    round: 4,
    availableRp: 5,
    scriptedFinishRoute: scriptedFinishRoute({
      activeConditionId: "murky-water",
      cards: {
        finishSearch: { inPalsDeck: false, inHand: false, inPlay: true, cost: 3 },
      },
    }),
  });
  assert.equal(clam.targetCardId, "giant-clam");
  assert.match(clam.message, /remaining 5 RP.*final 3 VP/i);
  assert.match(clam.action, /reach 10 VP/i);
});

test("post-checklist blocking modals keep Professor help actionable inside the modal", () => {
  for (const modal of ["support-draw", "search", "recover", "coral-target", "restock", "discard", "lost"]) {
    const help = getSimulatorTutorialHelp(null, {
      ...FINISH_DUEL_STATE,
      modal,
    });
    assert.equal(help.target, "close-modal", `${modal} target`);
    assert.match(help.action, /Close/i, `${modal} action`);
    assert.match(help.cueId, new RegExp(`blocking-modal:${modal}`), `${modal} cue`);
    assert.match(help.progressLabel, /Final goal.*4\/10 VP/, `${modal} progress`);
  }
});

function academyCurriculumRoute({
  round = 1,
  activeConditionId = "abundant-sunlight",
  expectedDraw = { deckType: "foundation", cardId: "pillar-coral-base" },
  cards = {},
  utilityAction = null,
  attackAction = null,
  searchTargetCardId = null,
} = {}) {
  const defaults = {
    setup: { cardId: "mustard-hill-coral-base", cardName: "Mustard Hill Coral", inPlay: true, victoryPoints: 0 },
    economy: { cardId: "pillar-coral-base", cardName: "Pillar Coral", inHand: true, ready: true, cost: 3, victoryPoints: 0 },
    coralSupport: { cardId: "coral-gardener", cardName: "Coral Gardener", inHand: true, ready: true, cost: 0, victoryPoints: 0 },
    searchedCoral: { cardId: "lettuce-coral-base", cardName: "Lettuce Coral", inFoundationDeck: true, cost: 1, victoryPoints: 0 },
    coralBase: { cardId: "brain-coral-base", cardName: "Brain Coral", inHand: true, ready: true, cost: 1, victoryPoints: 0 },
    coralStageOne: { cardId: "brain-coral-stage-1", cardName: "Brain Coral Stage 1", inHand: true, ready: true, cost: 2, victoryPoints: 0 },
    coralStageTwo: { cardId: "brain-coral-stage-2", cardName: "Brain Coral Stage 2", inHand: true, ready: true, cost: 5, victoryPoints: 0 },
    bankBoost: { cardId: "arrow-crab", cardName: "Arrow Crab", inHand: true, ready: true, cost: 1, victoryPoints: 1 },
    utility: { cardId: "nudibranch", cardName: "Nudibranch", inHand: true, ready: true, cost: 1, victoryPoints: 1 },
    firstFish: { cardId: "porcupine-fish", cardName: "Porcupine Fish", inPalsDeck: true, cost: 2, victoryPoints: 2 },
    secondFish: { cardId: "fairy-parrotfish", cardName: "Parrotfish", inPalsDeck: true, cost: 2, victoryPoints: 2 },
    habitat: { cardId: "coral-reef", cardName: "Coral Reef", inHand: true, ready: true, cost: 0, victoryPoints: 0 },
    predator: { cardId: "great-barracuda", cardName: "Great Barracuda", inPalsDeck: true, cost: 3, victoryPoints: 3 },
    creatureSchool: { cardId: "white-grunt", cardName: "White Grunt", inFoundationDeck: true, cost: 2, victoryPoints: 0 },
    filterFeeder: { cardId: "whale-shark", cardName: "Whale Shark", inPalsDeck: true, cost: 9, victoryPoints: 11 },
    apexSupport: { cardId: "deep-sea-fishing", cardName: "Deep Sea Fishing", inPalsDeck: true, cost: 0, victoryPoints: 0 },
    apex: { cardId: "hammerhead", cardName: "Hammerhead", inPalsDeck: true, cost: 6, victoryPoints: 6 },
  };
  return {
    active: true,
    plan: {
      curriculumVersion: 3,
      victoryTarget: 26,
      utilityCardId: "nudibranch",
      attackCardId: "porcupine-fish",
      predatorCardId: "great-barracuda",
      creatureSchoolCardId: "white-grunt",
      filterFeederCardId: "whale-shark",
      apexCardId: "hammerhead",
    },
    cards: Object.fromEntries(Object.entries(defaults).map(([key, value]) => [
      key,
      { ...value, ...(cards[key] ?? {}) },
    ])),
    round,
    activeConditionId,
    expectedDraw,
    utilityAction,
    attackAction,
    searchTargetCardId,
  };
}

const ACADEMY_STATE = Object.freeze({
  playerVp: 0,
  opponentVp: 0,
  victoryTarget: 26,
  round: 1,
  turn: 1,
  gamePhase: "main",
});

test("the setup lesson requires real zoom, arrangement, and Fit actions before Round 1", () => {
  const checkpoint = { id: "tutorial-collect-rp", title: "Collect RP", instruction: "Collect." };
  const route = academyCurriculumRoute({ round: 0 });
  const baseState = {
    ...ACADEMY_STATE,
    round: 0,
    gamePhase: "setup",
    scriptedFinishRoute: route,
  };
  const progress = {};
  const expected = [
    ["zoom-in", "player-zoom-in"],
    ["zoom-out", "player-zoom-out"],
    ["move-foundation", "foundation-drag"],
    ["move-slot", "slot-drag"],
    ["fit", "player-zoom-fit"],
  ];

  for (const [actionId, target] of expected) {
    const help = getSimulatorTutorialHelp(checkpoint, {
      ...baseState,
      layoutLessonProgress: progress,
    });
    assert.equal(help.actionId, actionId);
    assert.equal(help.target, target);
    progress[actionId] = true;
  }

  const ready = getSimulatorTutorialHelp(checkpoint, {
    ...baseState,
    layoutLessonProgress: progress,
  });
  assert.equal(ready.target, "turn-button");
  assert.match(ready.title, /Begin the first tide/i);
});

test("the streamlined V2 setup proceeds directly to Round 1", () => {
  const checkpoint = { id: "tutorial-collect-rp", title: "Collect RP", instruction: "Collect." };
  const help = getSimulatorTutorialHelp(checkpoint, {
    ...ACADEMY_STATE,
    round: 0,
    gamePhase: "setup",
    streamlinedTutorial: true,
    layoutLessonProgress: {},
    scriptedFinishRoute: academyCurriculumRoute({ round: 0 }),
  });

  assert.equal(help.target, "turn-button");
  assert.match(help.title, /Begin the first tide/i);
  assert.match(help.message, /explain the Condition, RP collection, and draw as each appears/i);
});

test("the second Coral placement explicitly uses a separate authored marker", () => {
  const route = academyCurriculumRoute({
    cards: {
      economy: { inHand: false, isPlaying: true },
    },
  });
  const help = getSimulatorTutorialHelp({ id: "tutorial-build-card" }, {
    ...ACADEMY_STATE,
    playingCardId: "pillar-coral-base",
    scriptedFinishRoute: route,
  });
  assert.equal(help.target, "placement");
  assert.match(help.message, /second foundation, not an upgrade/i);
  assert.match(help.message, /separate glowing.*beside Mustard Hill/i);
  assert.match(help.message, /rather than covering/i);
});

test("the strategy curriculum overrides generic VP rushing even while checkpoints remain", () => {
  const checkpoint = { id: "tutorial-build-card", title: "Build a card", instruction: "Build." };
  const help = getSimulatorTutorialHelp(checkpoint, {
    ...ACADEMY_STATE,
    recommendedVpBuildCard: { cardId: "great-barracuda", cardName: "Great Barracuda", cost: 3, victoryPoints: 3 },
    scriptedFinishRoute: academyCurriculumRoute(),
  });
  assert.equal(help.targetCardId, "pillar-coral-base");
  assert.match(help.title, /Build the economy.*Pillar Coral/i);
  assert.match(help.message, /income.*play spaces.*before.*VP/i);
  assert.doesNotMatch(help.title, /Great Barracuda/i);
  assert.match(help.progressLabel, /0\/26 VP/i);
});

test("the authored draw explains the purpose of each deck and cannot jump to a predator", () => {
  const route = academyCurriculumRoute({
    round: 2,
    expectedDraw: { deckType: "pals", cardId: "porcupine-fish" },
    cards: { economy: { inHand: false, inPlay: true } },
  });
  const help = getSimulatorTutorialHelp({ id: "tutorial-draw-card" }, {
    ...ACADEMY_STATE,
    round: 2,
    gamePhase: "draw",
    modal: "turn-draw",
    drawSelected: 0,
    drawTarget: 1,
    foundationDeckCount: 10,
    palsDeckCount: 10,
    scriptedFinishRoute: route,
  });
  assert.equal(help.targetDeck, "pals");
  assert.match(help.message, /Porcupine Fish.*wait in hand.*Support.*Corals/i);
  assert.doesNotMatch(help.message, /Barracuda.*clearest next step/i);
});

test("every authored draw result explains the actual card and its concrete next use", () => {
  const cases = [
    {
      round: 1,
      cardId: "pillar-coral-base",
      name: "Pillar Coral",
      source: "Foundation",
      message: /Foundation Deck.*Photosynthesis.*Predator slot.*separate foundation/i,
      action: /Continue to Actions.*Pillar Coral.*separate highlighted foundation/i,
    },
    {
      round: 2,
      cardId: "porcupine-fish",
      name: "Porcupine Fish",
      source: "Pals",
      message: /Pals Deck.*any two regular Fish.*one of those spots.*Crunch.*Keep it in hand.*Coral Gardener.*Lettuce Coral/i,
      action: /Continue to Actions.*Coral Gardener.*Round 3/i,
    },
    {
      round: 3,
      cardId: "fairy-parrotfish",
      name: "Parrotfish",
      source: "Pals",
      message: /Pals Deck.*any two regular Fish.*Porcupine Fish.*one spot.*fill the other.*wait in hand.*Arrow Crab.*Nudibranch.*Munch/i,
      action: /Continue to Actions.*Arrow Crab.*Round 4/i,
    },
    {
      round: 4,
      cardId: "great-barracuda",
      name: "Great Barracuda",
      source: "Pals",
      message: /Pals Deck.*Predator.*my reef.*legal targets.*Coral Reef.*second Bite.*First play Parrotfish/i,
      action: /Continue to Actions.*Parrotfish.*Coral Reef.*Great Barracuda/i,
    },
    {
      round: 5,
      cardId: "white-grunt",
      name: "White Grunt",
      source: "Foundation",
      message: /Foundation Deck.*Creature School.*foundation area.*30 School Density.*Eco Foundation.*Bleaching/i,
      action: /Continue to Actions.*White Grunt.*foundation area/i,
    },
    {
      round: 6,
      cardId: "whale-shark",
      name: "Whale Shark",
      source: "Pals",
      message: /Pals Deck.*Filter Feeder.*180.*Krill Bloom.*150.*White Grunt.*30.*Coral Reef.*Habitat.*legal now/i,
      action: /Continue to Actions.*Whale Shark.*open water/i,
    },
    {
      round: 7,
      cardId: "deep-sea-fishing",
      name: "Deep Sea Fishing",
      source: "Pals",
      message: /Pals Deck.*zero-cost.*one-shot Support.*Predator or Apex.*discard pile.*Hammerhead/i,
      action: /Continue to Actions.*Deep Sea Fishing.*Hammerhead.*search results/i,
    },
  ];

  cases.forEach(({ round, cardId, name, source, message, action }) => {
    const help = getSimulatorTutorialHelp({ id: "tutorial-draw-card" }, {
      ...ACADEMY_STATE,
      round,
      gamePhase: "draw",
      modal: "draw-result",
      drawnCards: [{ cardId, name, source, inHand: true }],
      scriptedFinishRoute: academyCurriculumRoute({
        round,
        expectedDraw: { deckType: source.toLowerCase(), cardId },
      }),
    });

    assert.equal(help.title, `Review ${name}`, `round ${round} title`);
    assert.equal(help.target, "continue-actions", `round ${round} target`);
    assert.match(help.message, message, `round ${round} message`);
    assert.match(help.action, action, `round ${round} action`);
    assert.doesNotMatch(help.message, /tutorial fixes the card order|prepared draw|read its type, cost/i, `round ${round} filler`);
  });
});

test("the Parrotfish draw explains that Coral Reef accepts any regular Fish species", () => {
  const help = getSimulatorTutorialHelp({ id: "tutorial-draw-card" }, {
    ...ACADEMY_STATE,
    round: 3,
    gamePhase: "draw",
    modal: "turn-draw",
    drawSelected: 0,
    drawTarget: 1,
    foundationDeckCount: 10,
    palsDeckCount: 10,
    scriptedFinishRoute: academyCurriculumRoute({
      round: 3,
      expectedDraw: { deckType: "pals", cardId: "fairy-parrotfish" },
    }),
  });

  assert.match(help.message, /Coral Reef requires two regular, non-school Fish/i);
  assert.match(help.message, /does not require Parrotfish specifically/i);
  assert.match(help.message, /Porcupine Fish and Parrotfish/i);
  assert.match(help.message, /Invertebrate action and a Fish attack/i);
  assert.doesNotMatch(help.message, /Parrotfish is the second Fish required/i);
});

test("Mr. Easterling refers to himself in first person during the guided duel", () => {
  const help = getSimulatorTutorialHelp({ id: "tutorial-draw-card" }, {
    ...ACADEMY_STATE,
    guideName: "Mr. Easterling",
    round: 4,
    gamePhase: "draw",
    modal: "turn-draw",
    drawSelected: 0,
    drawTarget: 1,
    foundationDeckCount: 10,
    palsDeckCount: 10,
    scriptedFinishRoute: academyCurriculumRoute({
      round: 4,
      expectedDraw: { deckType: "pals", cardId: "great-barracuda" },
    }),
  });

  assert.match(help.message, /until I had compatible creatures for it to target/i);
  assert.doesNotMatch(help.message, /Mr\. Easterling|the guide/i);
});

test("late authored draws explain the School Density chain before the Apex search", () => {
  const cases = [
    {
      round: 5,
      expectedDraw: { deckType: "foundation", cardId: "white-grunt" },
      targetDeck: "foundation",
      pattern: /White Grunt.*Foundation Deck.*Creature School.*30 School Density.*Bleaching.*Eco Foundation.*1 RP/i,
    },
    {
      round: 6,
      expectedDraw: { deckType: "pals", cardId: "whale-shark" },
      targetDeck: "pals",
      pattern: /Whale Shark.*180.*Krill Bloom.*150.*White Grunt.*30.*11 VP.*Pals Deck/i,
    },
    {
      round: 7,
      expectedDraw: { deckType: "pals", cardId: "deep-sea-fishing" },
      targetDeck: "pals",
      pattern: /Deep Sea Fishing.*Support.*Apex finisher.*chance/i,
    },
  ];

  cases.forEach(({ round, expectedDraw, targetDeck, pattern }) => {
    const help = getSimulatorTutorialHelp({ id: "tutorial-draw-card" }, {
      ...ACADEMY_STATE,
      round,
      gamePhase: "draw",
      modal: "turn-draw",
      drawSelected: 0,
      drawTarget: 1,
      foundationDeckCount: 10,
      palsDeckCount: 10,
      scriptedFinishRoute: academyCurriculumRoute({ round, expectedDraw }),
    });
    assert.equal(help.targetDeck, targetDeck);
    assert.match(help.message, pattern);
  });
});

test("Support searches and first-time card classes receive contextual explanations", () => {
  const support = getSimulatorTutorialHelp({ id: "tutorial-build-card" }, {
    ...ACADEMY_STATE,
    round: 2,
    scriptedFinishRoute: academyCurriculumRoute({
      round: 2,
      cards: { economy: { inHand: false, inPlay: true } },
    }),
  });
  assert.equal(support.targetCardId, "coral-gardener");
  assert.match(support.message, /Support cards.*one-shot.*do not occupy.*discard pile/i);

  const search = getSimulatorTutorialHelp({ id: "tutorial-build-card" }, {
    ...ACADEMY_STATE,
    round: 2,
    modal: "search",
    scriptedFinishRoute: academyCurriculumRoute({
      round: 2,
      searchTargetCardId: "lettuce-coral-base",
    }),
  });
  assert.equal(search.target, "search-card");
  assert.equal(search.targetSearchCardId, "lettuce-coral-base");
  assert.match(search.message, /fourth true Coral.*RP income.*legal home/i);
  assert.match(search.message, /empty slots do not count/i);
});

test("Round 3 teaches a non-attack card action before a paid attack", () => {
  const established = {
    economy: { inHand: false, inPlay: true },
    coralSupport: { inHand: false, inDiscard: true },
    coralBase: { inHand: false, inPlay: true },
    searchedCoral: { inFoundationDeck: false, inPlay: true },
    bankBoost: { inHand: false, inPlay: true },
    utility: { inHand: false, inPlay: true },
    firstFish: { inPalsDeck: false, inPlay: true },
  };
  const utilityAction = { cardId: "nudibranch", actionKey: "slot-nudi", utilityActionKey: "slot-nudi:munch", actionName: "Munch", actionCost: 0, ready: true };
  const attackAction = { cardId: "porcupine-fish", actionKey: "slot-porcupine", attackName: "Crunch", attackCost: 1, ready: true };
  const munch = getSimulatorTutorialHelp({ id: "tutorial-attack" }, {
    ...ACADEMY_STATE,
    round: 3,
    scriptedFinishRoute: academyCurriculumRoute({ round: 3, cards: established, utilityAction, attackAction }),
  });
  assert.equal(munch.targetActionKey, "slot-nudi");
  assert.match(munch.message, /separates.*actions.*attacks.*each kind of text/i);

  const crunch = getSimulatorTutorialHelp({ id: "tutorial-attack" }, {
    ...ACADEMY_STATE,
    round: 3,
    scriptedFinishRoute: academyCurriculumRoute({
      round: 3,
      cards: established,
      utilityAction: { ...utilityAction, ready: false, blockType: "used" },
      attackAction,
    }),
  });
  assert.equal(crunch.targetActionKey, "slot-porcupine");
  assert.match(crunch.message, /combat.*only glow targets.*allowed/i);

  const endRound = getSimulatorTutorialHelp({ id: "tutorial-attack" }, {
    ...ACADEMY_STATE,
    round: 3,
    scriptedFinishRoute: academyCurriculumRoute({
      round: 3,
      cards: {
        ...established,
        coralStageOne: { inHand: false, inPlay: true },
      },
      utilityAction: { ...utilityAction, ready: false, blockType: "used", usedThisTurn: true },
      attackAction: { ...attackAction, ready: false, blockType: "used", usedThisTurn: true },
    }),
  });
  assert.equal(endRound.target, "turn-button");
  assert.equal(endRound.action, "Press Next Round. In Round 4, build the Coral Reef Habitat, then play a Predator.");
  assert.doesNotMatch(endRound.action, /Round 4 will assemble/i);
});

test("starting the Brain Coral upgrade cannot send Round 3 guidance back to Munch", () => {
  const established = {
    economy: { inHand: false, inPlay: true },
    coralSupport: { inHand: false, inDiscard: true },
    coralBase: { inHand: false, inPlay: true },
    searchedCoral: { inFoundationDeck: false, inPlay: true },
    bankBoost: { inHand: false, inPlay: true },
    utility: { inHand: false, inPlay: true },
    firstFish: { inPalsDeck: false, inPlay: true },
    coralStageOne: { inHand: true, inPlay: false, isPlaying: true },
  };
  const help = getSimulatorTutorialHelp({ id: "tutorial-attack" }, {
    ...ACADEMY_STATE,
    round: 3,
    playingCardId: "brain-coral-stage-1",
    playingCardName: "Brain Coral Stage 1",
    scriptedFinishRoute: academyCurriculumRoute({
      round: 3,
      cards: established,
      utilityAction: {
        cardId: "nudibranch",
        actionKey: "slot-nudi",
        utilityActionKey: "slot-nudi:munch",
        actionName: "Munch",
        blockType: "interaction",
        blockReason: "Finish the current card action first.",
        usedThisTurn: true,
        ready: false,
      },
      attackAction: {
        cardId: "porcupine-fish",
        actionKey: "slot-porcupine",
        attackName: "Crunch",
        blockType: "interaction",
        blockReason: "Finish the current card action first.",
        usedThisTurn: true,
        ready: false,
      },
    }),
  });

  assert.equal(help.target, "placement");
  assert.equal(help.title, "Place Brain Coral Stage 1");
  assert.match(help.message, /highlighted Brain Coral.*advance it to Stage 1/i);
  assert.match(help.cueId, /scripted-place:brain-coral-stage-1$/);
  assert.doesNotMatch(`${help.title} ${help.message} ${help.action}`, /Nudibranch|Munch|Crunch/i);
});

test("an active placement cannot be preempted by a stale earlier curriculum card", () => {
  const help = getSimulatorTutorialHelp({ id: "tutorial-build-card" }, {
    ...ACADEMY_STATE,
    round: 4,
    playingCardId: "brain-coral-stage-2",
    playingCardName: "Brain Coral Stage 2",
    scriptedFinishRoute: academyCurriculumRoute({
      round: 4,
      cards: {
        secondFish: { inHand: true, inPlay: false },
        coralStageTwo: { inHand: true, inPlay: false, isPlaying: true },
      },
    }),
  });

  assert.equal(help.target, "placement");
  assert.equal(help.title, "Place Brain Coral Stage 2");
  assert.doesNotMatch(`${help.title} ${help.message} ${help.action}`, /Parrotfish/i);
});

test("Round 4 separates the chosen Fish species from Coral Reef's actual requirement", () => {
  const priorCards = {
    economy: { inHand: false, inPlay: true },
    coralSupport: { inHand: false, inDiscard: true },
    coralBase: { inHand: false, inPlay: false },
    searchedCoral: { inFoundationDeck: false, inPlay: true },
    bankBoost: { inHand: false, inPlay: true },
    utility: { inHand: false, inPlay: true },
    firstFish: { inPalsDeck: false, inPlay: true },
    coralStageOne: { inHand: false, inPlay: true },
  };
  const fish = getSimulatorTutorialHelp(null, {
    ...ACADEMY_STATE,
    round: 4,
    scriptedFinishRoute: academyCurriculumRoute({
      round: 4,
      cards: {
        ...priorCards,
        secondFish: { inPalsDeck: false, inHand: true, ready: true },
      },
    }),
  });

  assert.equal(fish.targetCardId, "fairy-parrotfish");
  assert.match(fish.title, /Complete the Fish count/i);
  assert.match(fish.message, /does not require a particular Fish species/i);
  assert.match(fish.message, /any two non-school Fish/i);
  assert.match(fish.message, /four true Corals.*two non-school Invertebrates/i);
  assert.match(fish.message, /Eat.*On Play.*immediately/i);

  const habitat = getSimulatorTutorialHelp(null, {
    ...ACADEMY_STATE,
    round: 4,
    scriptedFinishRoute: academyCurriculumRoute({
      round: 4,
      cards: {
        ...priorCards,
        secondFish: { inPalsDeck: false, inHand: false, inPlay: true },
        habitat: { inHand: true, ready: true, cost: 0 },
      },
    }),
  });

  assert.equal(habitat.targetCardId, "coral-reef");
  assert.match(habitat.message, /costs 0 RP.*may play it only while/i);
  assert.match(habitat.message, /four true Corals.*two non-school Fish.*two non-school Invertebrates/i);
  assert.match(habitat.message, /10 damage.*end of each of your turns/i);
});

test("Great Barracuda waits for Coral Reef and valid targets", () => {
  const built = {
    economy: { inHand: false, inPlay: true },
    coralSupport: { inHand: false, inDiscard: true },
    coralBase: { inHand: false, inPlay: false },
    searchedCoral: { inFoundationDeck: false, inPlay: true },
    bankBoost: { inHand: false, inPlay: true },
    utility: { inHand: false, inPlay: true },
    firstFish: { inPalsDeck: false, inPlay: true },
    secondFish: { inPalsDeck: false, inPlay: true },
    habitat: { inHand: false, inPlay: true },
    coralStageOne: { inHand: false, inPlay: false },
    coralStageTwo: { inHand: false, inPlay: true },
    predator: { inPalsDeck: false, inHand: true, ready: true, cost: 2 },
  };
  const predator = getSimulatorTutorialHelp(null, {
    ...ACADEMY_STATE,
    round: 4,
    playerVp: 6,
    scriptedFinishRoute: academyCurriculumRoute({ round: 4, activeConditionId: "murky-water", cards: built }),
  });
  assert.equal(predator.targetCardId, "great-barracuda");
  assert.match(predator.message, /right time.*legal Fish and Predator targets.*second Bite.*Playing it earlier.*wasted/i);
});

test("Rounds 5 and 6 teach Creature Schools, School Density, and Filter Feeders", () => {
  const established = {
    economy: { inHand: false, inPlay: true },
    coralSupport: { inHand: false, inDiscard: true },
    coralBase: { inHand: false, inPlay: false },
    searchedCoral: { inFoundationDeck: false, inPlay: true },
    bankBoost: { inHand: false, inPlay: true },
    utility: { inHand: false, inPlay: true },
    firstFish: { inPalsDeck: false, inPlay: true },
    secondFish: { inPalsDeck: false, inPlay: true },
    habitat: { inHand: false, inPlay: true },
    coralStageOne: { inHand: false, inPlay: false },
    coralStageTwo: { inHand: false, inPlay: true },
    predator: { inPalsDeck: false, inHand: false, inPlay: true },
  };

  const school = getSimulatorTutorialHelp(null, {
    ...ACADEMY_STATE,
    round: 5,
    playerVp: 9,
    scriptedFinishRoute: academyCurriculumRoute({
      round: 5,
      activeConditionId: "severe-coral-bleaching",
      cards: {
        ...established,
        creatureSchool: { inFoundationDeck: false, inHand: true, ready: true },
      },
    }),
  });
  assert.equal(school.targetCardId, "white-grunt");
  assert.match(school.message, /Creature Schools.*foundation area.*HP.*attacked.*School Density.*30.*Eco Foundation.*1 RP/i);
  assert.match(school.message, /do not count.*Coral Reef.*two-Fish requirement/i);
  assert.match(school.action, /White Grunt.*Play Card.*foundation area/i);

  const filterFeeder = getSimulatorTutorialHelp(null, {
    ...ACADEMY_STATE,
    round: 6,
    playerVp: 9,
    scriptedFinishRoute: academyCurriculumRoute({
      round: 6,
      activeConditionId: "krill-ball",
      cards: {
        ...established,
        creatureSchool: { inFoundationDeck: false, inHand: false, inPlay: true },
        filterFeeder: { inPalsDeck: false, inHand: true, ready: true },
      },
    }),
  });
  assert.equal(filterFeeder.targetCardId, "whale-shark");
  assert.match(filterFeeder.message, /Whale Shark.*180.*Krill Bloom.*150.*White Grunt.*30.*Coral Reef.*Habitat/i);
  assert.match(filterFeeder.action, /Whale Shark.*Play Card.*Ocean creature.*open water automatically/i);

  const finalRoundMilestone = getSimulatorTutorialHelp(null, {
    ...ACADEMY_STATE,
    round: 6,
    playerVp: 20,
    scriptedFinishRoute: academyCurriculumRoute({
      round: 6,
      activeConditionId: "krill-ball",
      cards: {
        ...established,
        creatureSchool: { inFoundationDeck: false, inHand: false, inPlay: true },
        filterFeeder: { inPalsDeck: false, inHand: false, inPlay: true },
      },
    }),
  });
  assert.equal(finalRoundMilestone.target, "turn-button");
  assert.match(finalRoundMilestone.title, /20 \/ 26 VP.*One Final Round Remains/i);
  assert.match(finalRoundMilestone.message, /Whale Shark.*20 VP milestone.*not the end.*one final round.*Deep Sea Fishing.*Hammerhead.*26 VP/i);
  assert.match(finalRoundMilestone.action, /Next Round.*final round.*Deep Sea Fishing.*Hammerhead.*Apex slot/i);
});

test("Round 7 uses a Support search and finishes the 26 VP curriculum with an Apex", () => {
  const finishedFoundation = {
    economy: { inHand: false, inPlay: true },
    coralSupport: { inHand: false, inDiscard: true },
    coralBase: { inHand: false, inPlay: false },
    searchedCoral: { inFoundationDeck: false, inPlay: true },
    bankBoost: { inHand: false, inPlay: true },
    utility: { inHand: false, inPlay: true },
    firstFish: { inPalsDeck: false, inPlay: true },
    secondFish: { inPalsDeck: false, inPlay: true },
    habitat: { inHand: false, inPlay: true },
    coralStageOne: { inHand: false, inPlay: false },
    coralStageTwo: { inHand: false, inPlay: true },
    predator: { inPalsDeck: false, inHand: false, inPlay: true },
    creatureSchool: { inFoundationDeck: false, inHand: false, inPlay: true },
    filterFeeder: { inPalsDeck: false, inHand: false, inPlay: true },
  };

  const support = getSimulatorTutorialHelp(null, {
    ...ACADEMY_STATE,
    round: 7,
    playerVp: 20,
    scriptedFinishRoute: academyCurriculumRoute({
      round: 7,
      activeConditionId: "bleak-overcast",
      cards: {
        ...finishedFoundation,
        apexSupport: { inPalsDeck: false, inHand: true, ready: true },
      },
    }),
  });
  assert.equal(support.targetCardId, "deep-sea-fishing");
  assert.match(support.message, /zero-cost.*one-shot Support.*searches.*Predator or Apex.*Bleak Overcast.*exactly.*6 RP/i);

  const apex = getSimulatorTutorialHelp(null, {
    ...ACADEMY_STATE,
    round: 7,
    playerVp: 20,
    scriptedFinishRoute: academyCurriculumRoute({
      round: 7,
      activeConditionId: "bleak-overcast",
      cards: {
        ...finishedFoundation,
        apexSupport: { inPalsDeck: false, inDiscard: true },
        apex: { inPalsDeck: false, inHand: true, ready: true },
      },
    }),
  });
  assert.equal(apex.targetCardId, "hammerhead");
  assert.match(apex.message, /Apex.*prerequisites.*end of a plan.*Coral Reef.*Apex slot.*enough RP/i);
  assert.match(apex.action, /26 VP/i);
});

test("a saved lesson that skipped Whale Shark recovers after Hammerhead's attacks", () => {
  const completedExceptWhaleShark = {
    economy: { inHand: false, inPlay: true },
    coralSupport: { inHand: false, inDiscard: true },
    coralBase: { inHand: false, inPlay: false },
    searchedCoral: { inFoundationDeck: false, inPlay: true },
    bankBoost: { inHand: false, inPlay: true },
    utility: { inHand: false, inPlay: true },
    firstFish: { inPalsDeck: false, inPlay: true },
    secondFish: { inPalsDeck: false, inPlay: true },
    habitat: { inHand: false, inPlay: true },
    coralStageOne: { inHand: false, inPlay: false },
    coralStageTwo: { inHand: false, inPlay: true },
    predator: { inPalsDeck: false, inHand: false, inPlay: true },
    creatureSchool: { inFoundationDeck: false, inHand: false, inPlay: true },
    filterFeeder: {
      inPalsDeck: false,
      inHand: true,
      inPlay: false,
      ready: false,
      playError: "Not enough RP - need 9 RP.",
      cost: 9,
      victoryPoints: 11,
    },
    apexSupport: { inPalsDeck: false, inDiscard: true },
    apex: { inPalsDeck: false, inHand: false, inPlay: true },
  };
  const route = academyCurriculumRoute({
    round: 7,
    activeConditionId: "bleak-overcast",
    cards: completedExceptWhaleShark,
  });

  const bank = getSimulatorTutorialHelp(null, {
    ...ACADEMY_STATE,
    round: 7,
    playerVp: 15,
    availableRp: 1,
    scriptedFinishRoute: route,
  });
  assert.equal(bank.target, "turn-button");
  assert.match(bank.title, /Bank RP for Whale Shark/i);
  assert.match(bank.message, /Ravage is complete.*11 VP.*costs 9 RP.*have 1.*Coral Reef.*Krill Bloom/i);
  assert.match(bank.action, /Next Round.*return to Whale Shark/i);
  assert.doesNotMatch(bank.title, /Return to the authored lesson step/i);

  const ready = getSimulatorTutorialHelp(null, {
    ...ACADEMY_STATE,
    round: 8,
    playerVp: 15,
    availableRp: 9,
    scriptedFinishRoute: academyCurriculumRoute({
      round: 8,
      cards: {
        ...completedExceptWhaleShark,
        filterFeeder: {
          inPalsDeck: false,
          inHand: true,
          inPlay: false,
          ready: true,
          playError: "",
          cost: 9,
          victoryPoints: 11,
        },
      },
    }),
  });
  assert.equal(ready.targetCardId, "whale-shark");
  assert.equal(ready.target, "hand");
  assert.match(ready.message, /missing 11 VP.*Coral Reef.*White Grunt.*Krill Bloom/i);
});
