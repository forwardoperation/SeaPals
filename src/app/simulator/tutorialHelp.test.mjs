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
    assert.ok(help.message.length > 20);
    assert.ok(help.action.length > 10);
    assert.ok(help.target);
    assert.ok(help.targetLabel);
  });
});

test("setup help follows the player from hand through placement to round start", () => {
  const checkpoint = CHECKPOINTS["tutorial-setup"];
  assert.equal(getSimulatorTutorialHelp(checkpoint).target, "hand");
  assert.equal(getSimulatorTutorialHelp(checkpoint, { modal: "hand", selectedHandCard: "coral" }).target, "play-card");
  assert.equal(getSimulatorTutorialHelp(checkpoint, { playingCardId: "coral" }).target, "placement");
  assert.equal(getSimulatorTutorialHelp(checkpoint, { hasCoralInPlay: true }).target, "turn-button");
});

test("live setup state overrides a resumed later checkpoint once the foundation is ready", () => {
  const checkpoint = CHECKPOINTS["tutorial-build-card"];
  const help = getSimulatorTutorialHelp(checkpoint, {
    gamePhase: "setup",
    hasCoralInPlay: true,
    hasAffordableSetupFoundation: false,
    handPopoverOpen: true,
  });

  assert.equal(help.id, checkpoint.id);
  assert.equal(help.title, "Begin Round 1");
  assert.equal(help.target, "turn-button");
  assert.match(help.message, /starting foundation is in place/i);
  assert.match(help.action, /close your hand.*Begin Round 1/i);

  const affordableHelp = getSimulatorTutorialHelp(checkpoint, {
    gamePhase: "setup",
    hasCoralInPlay: true,
    hasAffordableSetupFoundation: true,
  });
  assert.equal(affordableHelp.title, "Add to your ecosystem");
  assert.equal(affordableHelp.target, "hand");
});

test("draw and build help adapt to their live modal state", () => {
  const draw = CHECKPOINTS["tutorial-draw-card"];
  const drawChoice = getSimulatorTutorialHelp(draw, { drawSelected: 0, drawTarget: 1 });
  assert.equal(drawChoice.title, "Choose a deck with a plan");
  assert.equal(drawChoice.target, "draw-controls");
  assert.match(drawChoice.message, /Foundation Deck.*economy.*best early-game draw/i);
  assert.match(drawChoice.message, /Pals Deck.*creatures.*habitats.*support.*VP/i);

  const foundationChoice = getSimulatorTutorialHelp(draw, {
    drawSelected: 1,
    drawFoundationSelected: 1,
    drawPalsSelected: 0,
    drawTarget: 1,
  });
  assert.equal(foundationChoice.target, "confirm-draw");
  assert.match(foundationChoice.action, /Good early-game choice/i);

  const palsChoice = getSimulatorTutorialHelp(draw, {
    drawSelected: 1,
    drawFoundationSelected: 0,
    drawPalsSelected: 1,
    drawTarget: 1,
  });
  assert.match(palsChoice.action, /Foundation is usually stronger this early/i);

  const build = CHECKPOINTS["tutorial-build-card"];
  assert.equal(getSimulatorTutorialHelp(build).title, "Add to your ecosystem");
  const drawResult = getSimulatorTutorialHelp(build, { modal: "draw-result" });
  assert.equal(drawResult.title, "Choose future draws with a plan");
  assert.equal(drawResult.target, "continue-actions");
  assert.match(drawResult.message, /Foundation cards establish RP income.*favor that deck early/i);
  assert.match(drawResult.message, /Pals Deck.*economy is ready/i);
  assert.equal(getSimulatorTutorialHelp(build, { modal: "hand", selectedHandCard: "fish" }).target, "play-card");

  const supportHelp = getSimulatorTutorialHelp(build, {
    modal: "hand",
    selectedHandCard: "coral-gardener",
    selectedCardIsSupport: true,
    selectedCardName: "Coral Gardener",
    selectedCardCost: 0,
    selectedSupportLocksFurtherSupports: true,
  });
  assert.equal(supportHelp.title, "Use a one-time Support");
  assert.equal(supportHelp.target, "play-card");
  assert.match(supportHelp.message, /tactical actions.*resolves its effect immediately/i);
  assert.match(supportHelp.message, /discard pile.*costs 0 RP/i);
  assert.match(supportHelp.message, /last Support card this turn/i);
  assert.match(supportHelp.action, /No ecosystem placement is needed/i);

  assert.equal(getSimulatorTutorialHelp(build, { playingCardId: "fish" }).target, "placement");
});

test("attack help follows inspection and target selection", () => {
  const checkpoint = CHECKPOINTS["tutorial-attack"];
  assert.equal(getSimulatorTutorialHelp(checkpoint).target, "player-board");
  assert.equal(getSimulatorTutorialHelp(checkpoint, { inspectedPlayerCardHasAttack: true }).target, "attack-button");
  assert.equal(getSimulatorTutorialHelp(checkpoint, { attackContext: true }).target, "opponent-board");
});

test("completed help keeps the practice goal visible without inventing another checkpoint", () => {
  assert.equal(getSimulatorTutorialHelp(null), null);
  const help = getSimulatorTutorialHelp(null, { complete: true });
  assert.equal(help.id, "tutorial-complete");
  assert.equal(help.target, "vp-score");
});
