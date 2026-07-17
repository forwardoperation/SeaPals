const TARGET_LABELS = Object.freeze({
  hand: "a glowing card in your hand",
  placement: "the highlighted placement area",
  "turn-button": "the Begin Round or End Turn button",
  "draw-controls": "the two personal deck controls",
  "confirm-draw": "the Draw Selected Cards button",
  "continue-actions": "the Continue to Actions button",
  "play-card": "the Play Card button",
  "player-board": "a creature in your ecosystem",
  "opponent-board": "a highlighted creature in my ecosystem",
  "attack-button": "the creature's attack button",
  "vp-score": "your Victory Point counter",
  "rp-bank": "your RP bank",
});

const HELP_BY_CHECKPOINT = Object.freeze({
  "tutorial-setup": Object.freeze({
    message: "Every ecosystem needs a foundation. Start with a green-glowing Base Coral or Creature School from your hand.",
    action: "Choose a ready foundation card, press Play Card, and place it in your ecosystem.",
  }),
  "tutorial-collect-rp": Object.freeze({
    message: "Resource Points, or RP, are the energy you spend to play cards. Your ecosystem collects them at the start of each round.",
    action: "Press Begin Round 1 and watch your RP bank increase.",
  }),
  "tutorial-draw-card": Object.freeze({
    title: "Choose a deck with a plan",
    message: "The Foundation Deck grows your economy with Corals and Creature Schools, so it is usually the best early-game draw. Choose the Pals Deck when you need creatures, habitats, support effects, or more ways to earn VP.",
    action: "For this early draw, start with the Foundation Deck, then confirm your choice.",
  }),
  "tutorial-build-card": Object.freeze({
    title: "Add to your ecosystem",
    message: "Use RP to add another card to your ecosystem. Cards marked Ready to play are legal and affordable right now.",
    action: "Choose a card marked Ready to play, press Play Card, and place it in a legal spot.",
  }),
  "tutorial-attack": Object.freeze({
    message: "Creatures with attacks can challenge compatible creatures in my ecosystem. The simulator will only highlight legal targets.",
    action: "Choose one of your creatures, start its attack, then resolve the dice roll.",
  }),
  "tutorial-end-turn": Object.freeze({
    message: "A careful Reefkeeper checks the board, hand, and remaining RP before passing play.",
    action: "When you are satisfied with your choices, press End Turn.",
  }),
  "tutorial-earn-vp": Object.freeze({
    message: "Victory Points measure the ecosystem you have built. Cards in play add VP automatically, including some relationship bonuses.",
    action: "Watch your VP counter grow. Reach 10 VP before I do to win our practice duel.",
  }),
});

function requireCheckpointId(checkpoint) {
  const id = String(checkpoint?.id ?? "").trim();
  return id || null;
}

function withTarget(help, target) {
  return Object.freeze({
    ...help,
    target,
    targetLabel: TARGET_LABELS[target] ?? "the highlighted control",
  });
}

export function getSimulatorTutorialHelp(checkpoint, uiState = {}) {
  const checkpointId = requireCheckpointId(checkpoint);
  if (!checkpointId) {
    if (uiState.complete !== true) return null;
    return withTarget({
      id: "tutorial-complete",
      title: "Finish the friendly duel",
      message: "Excellent work! You have practiced every part of a turn. I will stay nearby while you finish the match.",
      action: "Keep building your ecosystem until your VP counter reaches the practice target.",
    }, "vp-score");
  }

  const authored = HELP_BY_CHECKPOINT[checkpointId] ?? {
    message: checkpoint.instruction,
    action: "Use the highlighted game control to continue.",
  };

  if (
    uiState.gamePhase === "setup"
    && uiState.hasCoralInPlay
    && uiState.hasAffordableSetupFoundation === false
    && !uiState.playingCardId
  ) {
    const isLookingAtHand = uiState.modal === "hand" || uiState.handPopoverOpen;
    return withTarget({
      id: checkpointId,
      title: "Begin Round 1",
      message: "Your starting foundation is in place. Setup is finished, and your RP will refill when the first round begins.",
      action: isLookingAtHand
        ? "Close your hand, then press Begin Round 1 to collect RP and draw."
        : "Press Begin Round 1 to collect RP and draw.",
    }, "turn-button");
  }

  let title = authored.title ?? checkpoint.title;
  let message = authored.message;
  let target = null;
  let action = authored.action;

  if (checkpointId === "tutorial-setup") {
    if (uiState.playingCardId) {
      target = "placement";
      action = "Place the card in the highlighted open area of your ecosystem.";
    } else if (uiState.hasCoralInPlay) {
      target = "turn-button";
      action = "Your foundation is ready. Press Begin Round 1.";
    } else if (uiState.modal === "hand" && uiState.selectedHandCard) {
      target = "play-card";
      action = "This card is selected. Press Play Card to start placing it.";
    } else {
      target = "hand";
    }
  } else if (checkpointId === "tutorial-collect-rp") {
    target = uiState.gamePhase === "setup" ? "turn-button" : "rp-bank";
  } else if (checkpointId === "tutorial-draw-card") {
    const drawReady = Number(uiState.drawSelected ?? 0) === Number(uiState.drawTarget ?? -1)
      && Number(uiState.drawTarget ?? 0) > 0;
    target = drawReady ? "confirm-draw" : "draw-controls";
    if (drawReady && Number(uiState.drawFoundationSelected ?? 0) > 0) {
      action = "Good early-game choice. Press Draw Selected Cards to add the Foundation card to your hand.";
    } else if (drawReady && Number(uiState.drawPalsSelected ?? 0) > 0) {
      action = "A Pals card can add useful options, but Foundation is usually stronger this early. Keep it if that is your plan, or switch before confirming.";
    }
  } else if (checkpointId === "tutorial-build-card") {
    if (uiState.modal === "draw-result") {
      title = "Choose future draws with a plan";
      message = "Foundation cards establish RP income and places for other cards, so favor that deck early. Shift toward the Pals Deck when your economy is ready and you need creatures, habitats, support effects, or VP.";
      target = "continue-actions";
      action = "Review the cards you drew, then press Continue to Actions.";
    } else if (uiState.playingCardId) {
      target = "placement";
      action = "Finish building by choosing the highlighted legal placement.";
    } else if ((uiState.modal === "hand" || uiState.handPopoverOpen) && uiState.selectedHandCard) {
      target = "play-card";
      action = "Press Play Card, then choose a highlighted legal placement.";
    } else {
      target = "hand";
    }
  } else if (checkpointId === "tutorial-attack") {
    if (uiState.attackContext) {
      target = "opponent-board";
      action = "Choose one of the glowing legal targets in my ecosystem.";
    } else if (uiState.inspectedPlayerCardHasAttack) {
      target = "attack-button";
      action = "Use this creature's attack, then follow the dice prompt.";
    } else {
      target = "player-board";
    }
  } else if (checkpointId === "tutorial-end-turn") {
    target = "turn-button";
  } else if (checkpointId === "tutorial-earn-vp") {
    target = "vp-score";
  }

  return withTarget({
    id: checkpointId,
    title,
    message,
    action,
  }, target);
}

export function hasSimulatorTutorialHelp(checkpointId) {
  return Object.hasOwn(HELP_BY_CHECKPOINT, checkpointId);
}

export const SIMULATOR_TUTORIAL_HELP_CHECKPOINT_IDS = Object.freeze(Object.keys(HELP_BY_CHECKPOINT));
