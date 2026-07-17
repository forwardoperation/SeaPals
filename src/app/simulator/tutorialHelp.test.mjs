import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SIMULATOR_TUTORIAL_CHECKPOINTS } from "./tutorialContract.mjs";
import {
  SIMULATOR_TUTORIAL_HELP_CHECKPOINT_IDS,
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
    assert.ok(help.action.length > 10);
    assert.ok(help.target);
    assert.ok(help.targetLabel);
  });
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
  assert.equal(foundationReady.title, "Begin Round 1");
  assert.equal(foundationReady.target, "turn-button");
  assert.match(foundationReady.action, /close your hand.*Begin Round 1/i);
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

test("draw-result cue reports cards discarded by the hand limit", () => {
  const help = getSimulatorTutorialHelp(CHECKPOINTS["tutorial-build-card"], {
    modal: "draw-result",
    drawnCards: [{
      cardId: "brain-coral",
      name: "Brain Coral",
      source: "Foundation",
      discarded: true,
    }],
  });
  assert.match(help.message, /hand limit.*discard pile/i);
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

test("completed help keeps the practice goal visible without inventing another checkpoint", () => {
  assert.equal(getSimulatorTutorialHelp(null), null);
  const help = getSimulatorTutorialHelp(null, { complete: true });
  assert.equal(help.id, "tutorial-complete");
  assert.equal(help.target, "vp-score");
});
