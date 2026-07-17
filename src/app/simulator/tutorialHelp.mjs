const TARGET_LABELS = Object.freeze({
  hand: "a glowing card in your hand",
  placement: "the highlighted placement area",
  "turn-button": "the Begin Round or End Turn button",
  "draw-controls": "the two personal deck controls",
  "confirm-draw": "the Draw Selected Cards button",
  "continue-actions": "the Continue to Actions button",
  "close-modal": "the Close button",
  "play-card": "the Play Card button",
  "player-board": "a glowing creature in your ecosystem",
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
    action: "Choose a card marked Ready to play, press Play Card, and follow its placement or effect prompt.",
  }),
  "tutorial-attack": Object.freeze({
    message: "Creatures with attacks can challenge compatible creatures in my ecosystem. The simulator only highlights legal targets.",
    action: "Choose a ready attacker, use its attack, then resolve the dice roll.",
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

function withTarget(help, target, cue = target) {
  return Object.freeze({
    ...help,
    cueId: `${help.id}:${cue ?? "status"}`,
    target,
    targetLabel: help.targetLabel ?? TARGET_LABELS[target] ?? "the highlighted control",
  });
}

function describeDrawnCard(card) {
  const name = String(card?.name ?? "This card");
  if (card?.discarded) {
    return `${name} came from the ${card.source ?? "personal"} Deck, but the hand limit sent it to your discard pile.`;
  }

  const hasCost = card?.cost != null && Number.isFinite(Number(card.cost));
  const typeAndCost = card?.kindLabel
    ? `a ${card.kindLabel}${hasCost ? ` and costs ${Number(card.cost)} RP to play` : ""}`
    : hasCost
      ? `a card that costs ${Number(card.cost)} RP to play`
      : "";
  const vp = Number(card?.victoryPoints ?? 0) > 0 ? ` It is worth ${Number(card.victoryPoints)} VP in play.` : "";
  const legality = card?.playError
    ? ` It is not playable yet: ${card.playError}`
    : " It is playable now.";
  const attack = card?.attack
    ? Number(card.attack.targetCount ?? 0) > 0
      ? ` Its ${card.attack.name} attack costs ${Number(card.attack.cost ?? 0)} RP and currently has ${Number(card.attack.targetCount)} legal ${Number(card.attack.targetCount) === 1 ? "target" : "targets"}.`
      : ` Its ${card.attack.name} attack costs ${Number(card.attack.cost ?? 0)} RP, but it has no legal target on my board right now.`
    : "";
  return `${name} came from the ${card?.source ?? "personal"} Deck${typeAndCost ? `. It is ${typeAndCost}` : ""}.${vp}${legality}${attack}`;
}

function getAttackRecovery(uiState) {
  const type = uiState.attackBlock?.blockType ?? "missing";
  if (type === "rp") {
    return {
      preferredDeck: "Foundation",
      action: "End the turn to collect RP again. Favor the Foundation Deck next round to strengthen your economy before trying the attack again.",
    };
  }
  if (type === "used" || type === "cooldown") {
    return {
      preferredDeck: "Foundation",
      action: "End the turn so this creature can become available again. Use the next draw to strengthen your economy; you do not need to replace the attacker.",
    };
  }
  if (type === "targets") {
    return {
      preferredDeck: "Pals",
      action: "End the turn after any useful builds. A Pals draw can find a creature whose attack matches the cards on my board.",
    };
  }
  return {
    preferredDeck: "Pals",
    action: "End the turn after any useful builds, then choose the Pals Deck next round to look for a legal attacker.",
  };
}

function getDrawResultHelp(checkpointId, uiState) {
  const drawnCards = Array.isArray(uiState.drawnCards) ? uiState.drawnCards : [];
  const names = drawnCards.map((card) => card?.name).filter(Boolean);
  const title = names.length === 1
    ? `You drew ${names[0]}`
    : names.length > 1
      ? `You drew ${names.length} cards`
      : "Review what you drew";
  const message = drawnCards.length
    ? drawnCards.map(describeDrawnCard).join(" ")
    : "Review the revealed card before returning to your action phase.";

  let nextAction = "Press Continue to Actions. I will point to the next legal move after the cards are out of the way.";
  if (checkpointId === "tutorial-attack") {
    const recovery = getAttackRecovery(uiState);
    if (uiState.readyAttack) {
      nextAction = `Press Continue to Actions, then select ${uiState.readyAttack.cardName} and use ${uiState.readyAttack.attackName}.`;
    } else if (uiState.attackSetupCard) {
      nextAction = `Press Continue to Actions, then play ${uiState.attackSetupCard.cardName}; it can attack a legal target with ${uiState.attackSetupCard.attackName}.`;
    } else if (uiState.recommendedBuildCard) {
      nextAction = `Press Continue to Actions. You cannot make a legal attack yet, so play ${uiState.recommendedBuildCard.cardName} if it helps your plan. ${recovery.action}`;
    } else {
      nextAction = `Press Continue to Actions. No legal attack is available yet. ${recovery.action}`;
    }
  } else if (checkpointId === "tutorial-build-card" && uiState.recommendedBuildCard) {
    nextAction = `Press Continue to Actions, then play ${uiState.recommendedBuildCard.cardName} for ${uiState.recommendedBuildCard.cost} RP.`;
  }

  return withTarget({
    id: checkpointId,
    title,
    message,
    action: nextAction,
  }, "continue-actions", `draw-result:r${uiState.round ?? "?"}:${drawnCards.map((card) => `${card.cardId}:${card.discarded ? "discard" : "hand"}`).join(",") || "empty"}`);
}

function getTurnDrawHelp(checkpointId, uiState, authored, checkpoint) {
  const drawReady = Number(uiState.drawSelected ?? 0) === Number(uiState.drawTarget ?? -1)
    && Number(uiState.drawTarget ?? 0) > 0;
  const target = drawReady ? "confirm-draw" : "draw-controls";
  const foundationAvailable = Number(uiState.foundationDeckCount ?? 0) > 0;
  const palsAvailable = Number(uiState.palsDeckCount ?? 0) > 0;

  if (checkpointId === "tutorial-attack" && uiState.plannedAttack) {
    const attack = uiState.plannedAttack;
    return withTarget({
      id: checkpointId,
      title: `Draw, then attack with ${attack.cardName}`,
      message: `${attack.cardName} will be ready in your action phase. ${attack.attackName} costs ${attack.attackCost} RP and has ${attack.targetCount} legal ${attack.targetCount === 1 ? "target" : "targets"} on my board.`,
      action: drawReady
        ? `Press Draw Selected Cards. After reviewing the result, select ${attack.cardName} and use ${attack.attackName}.`
        : `Complete the required draw first${foundationAvailable ? "; Foundation is a strong choice while your attacker is already in place" : ""}.`,
    }, target, `turn-draw:planned:${attack.actionKey ?? attack.cardId}:${drawReady ? "ready" : "choose"}`);
  }

  if (checkpointId === "tutorial-attack" && uiState.plannedAttackSetupCard) {
    const card = uiState.plannedAttackSetupCard;
    return withTarget({
      id: checkpointId,
      title: `Draw, then play ${card.cardName}`,
      message: `${card.cardName} can be played for ${card.cost} RP in your action phase. You will retain enough RP for ${card.attackName}, which has ${card.targetCount} legal ${card.targetCount === 1 ? "target" : "targets"}.`,
      action: drawReady
        ? `Press Draw Selected Cards. After reviewing the result, play ${card.cardName} and follow its placement or effect prompt.`
        : `Complete the required draw first${foundationAvailable ? "; Foundation can strengthen the economy behind this planned play" : ""}.`,
    }, target, `turn-draw:planned-card:${card.cardId}:${drawReady ? "ready" : "choose"}`);
  }

  if (checkpointId === "tutorial-attack" && !uiState.readyAttack && !uiState.attackSetupCard) {
    const recovery = getAttackRecovery(uiState);
    const preferredAvailable = recovery.preferredDeck === "Foundation" ? foundationAvailable : palsAvailable;
    const recommendedDeck = preferredAvailable
      ? recovery.preferredDeck
      : palsAvailable ? "Pals" : foundationAvailable ? "Foundation" : null;
    const selectedPreferred = recovery.preferredDeck === "Foundation"
      ? Number(uiState.drawFoundationSelected ?? 0) > 0
      : Number(uiState.drawPalsSelected ?? 0) > 0;
    const action = drawReady
      ? selectedPreferred || !preferredAvailable
        ? `Press Draw Selected Cards. After the draw, I will check the actual card and your board for a legal path to an attack.`
        : `Your selection is valid, but the ${recovery.preferredDeck} Deck better addresses the current blocker. Switch if you want the guided route, or confirm your plan.`
      : recommendedDeck
        ? `Choose at least one card from the ${recommendedDeck} Deck${recommendedDeck === "Pals" ? " to look for a creature that can attack my current board" : " to strengthen the economy supporting your existing attacker"}.`
        : "Both personal decks are empty, so no draw can be completed.";
    return withTarget({
      id: checkpointId,
      title: "Draw toward a legal attack",
      message: recovery.preferredDeck === "Foundation"
        ? "You cannot attack during the draw step. Your current blocker calls for more economy or another round, so Foundation is the more useful draw; I will still evaluate the revealed card before your next action."
        : "You cannot attack during the draw step. The Pals Deck holds creatures and tactical cards; after the cards are revealed, I will compare them with your RP, open spaces, and my legal targets.",
      action,
    }, target, `turn-draw:attack:${drawReady ? "ready" : "choose"}`);
  }

  let action = authored.action;
  if (drawReady && Number(uiState.drawFoundationSelected ?? 0) > 0) {
    action = "Good early-game choice. Press Draw Selected Cards to reveal the Foundation card and see whether you can play it now.";
  } else if (drawReady && Number(uiState.drawPalsSelected ?? 0) > 0) {
    action = "A Pals card can add useful options, but Foundation is usually stronger early. Keep it if that is your plan, or switch before confirming.";
  } else if (checkpointId !== "tutorial-draw-card") {
    action = "Finish choosing this round's required draw. I will evaluate the revealed card before suggesting your next action.";
  }

  return withTarget({
    id: checkpointId,
    title: checkpointId === "tutorial-draw-card" ? authored.title : "Choose this round's draw",
    message: checkpointId === "tutorial-draw-card"
      ? authored.message
      : "Foundation cards build RP income and play spaces. Pals cards provide creatures, habitats, Support effects, and more ways to earn VP.",
    action,
  }, target, `turn-draw:${drawReady ? "ready" : "choose"}`);
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
    }, "vp-score", "finish-duel");
  }

  const authored = HELP_BY_CHECKPOINT[checkpointId] ?? {
    message: checkpoint.instruction,
    action: "Use the highlighted game control to continue.",
  };

  // A restored tutorial checkpoint can be ahead of a newly-created duel board.
  // Coach the executable setup prerequisite without changing saved evidence.
  if (uiState.gamePhase === "setup") {
    if (uiState.playingCardId) {
      return withTarget({
        id: checkpointId,
        title: "Place your starting foundation",
        message: "This fresh practice board still needs a Base Coral or Creature School before later tutorial steps are possible.",
        action: "Place the selected foundation in the highlighted area.",
      }, "placement", "setup:placement");
    }
    if (!uiState.hasCoralInPlay) {
      const selected = Boolean(
        uiState.selectedHandCard
        && uiState.selectedCardIsSetupFoundation !== false
        && (uiState.modal === "hand" || uiState.handPopoverOpen)
      );
      return withTarget({
        id: checkpointId,
        title: "Start with a foundation",
        message: "This duel board is new, so first establish a Base Coral or Creature School. Your saved tutorial progress will remain intact.",
        action: selected
          ? "Press Play Card, then place the selected foundation in the highlighted area."
          : "Open your hand and choose a green-glowing Base Coral or Creature School.",
      }, selected ? "play-card" : "hand", selected ? "setup:play" : "setup:hand");
    }
    return withTarget({
      id: checkpointId,
      title: "Begin Round 1",
      message: "Your starting foundation is in place. Begin the first round to collect RP and reach your next executable tutorial action.",
      action: uiState.modal === "hand" || uiState.handPopoverOpen
        ? "Close your hand, then press Begin Round 1."
        : "Press Begin Round 1 to collect RP and draw.",
    }, "turn-button", "setup:begin-round");
  }

  // Modal prerequisites always take precedence over a checkpoint action hidden
  // behind the modal.
  if (uiState.modal === "turn-draw") {
    return getTurnDrawHelp(checkpointId, uiState, authored, checkpoint);
  }
  if (uiState.modal === "draw-result") {
    return getDrawResultHelp(checkpointId, uiState);
  }
  if (uiState.playingCardId) {
    const cardName = uiState.playingCardName ?? "the selected card";
    return withTarget({
      id: checkpointId,
      title: `Place ${cardName}`,
      message: `${cardName} has left your hand, but it is not built until you finish a legal placement.`,
      action: "Choose one of the glowing legal placement areas in your ecosystem.",
    }, "placement", `placement:${uiState.playingCardId}`);
  }

  let title = authored.title ?? checkpoint.title;
  let message = authored.message;
  let target = null;
  let action = authored.action;
  let cue = "default";
  let targetCardId = null;
  let targetActionKey = null;
  let targetLabel = null;

  if (checkpointId === "tutorial-setup") {
    target = "hand";
    cue = "hand";
  } else if (checkpointId === "tutorial-collect-rp") {
    target = "rp-bank";
    cue = "collected";
  } else if (checkpointId === "tutorial-draw-card") {
    target = "draw-controls";
    cue = "choose-draw";
  } else if (checkpointId === "tutorial-build-card") {
    if ((uiState.modal === "hand" || uiState.handPopoverOpen) && uiState.selectedHandCard) {
      cue = `selected:${uiState.selectedHandCard}`;
      if (uiState.selectedCardPlayError) {
        const cardName = uiState.selectedCardName ?? "This card";
        const recommendation = uiState.recommendedBuildCard;
        title = `${cardName} is not playable yet`;
        message = uiState.selectedCardPlayError;
        if (uiState.handPopoverOpen) {
          target = "close-modal";
          action = recommendation
            ? `Close these card details, then choose ${recommendation.cardName}, which is legal right now.`
            : "Close these card details, check any other actions, then end the turn to collect RP and draw again.";
        } else if (recommendation && recommendation.cardId !== uiState.selectedHandCard) {
          target = "hand";
          targetCardId = recommendation.cardId;
          targetLabel = `${recommendation.cardName} in your hand`;
          action = `Choose the glowing ${recommendation.cardName} instead; it is legal right now.`;
        } else {
          target = "close-modal";
          action = "Close your hand, check any other actions, then end the turn to collect RP and draw again.";
        }
        cue = `selected-blocked:${uiState.selectedHandCard}:${recommendation?.cardId ?? "none"}`;
      } else if (uiState.selectedCardIsSupport) {
        target = "play-card";
        const supportName = String(uiState.selectedCardName ?? "This Support card");
        const supportCost = Math.max(0, Number(uiState.selectedCardCost ?? 0));
        const supportLimit = uiState.selectedSupportLocksFurtherSupports
          ? " Its text also makes it your last Support card this turn."
          : "";
        title = "A useful detour, not a build";
        message = `Support cards resolve a one-time effect and then go to the discard pile. ${supportName} costs ${supportCost} RP and does not stay in your ecosystem, so playing it will not complete this build step.${supportLimit}`;
        action = uiState.recommendedBuildCard
          ? `Play ${supportName} if you want its effect. To advance this build step afterward, choose ${uiState.recommendedBuildCard.cardName}.`
          : `Play ${supportName} if you want its effect, but you will still need to build an ecosystem card on a later turn.`;
      } else {
        target = "play-card";
        title = `Play ${uiState.selectedCardName ?? "this card"}`;
        message = `${uiState.selectedCardName ?? "This card"} is a legal ecosystem card and costs ${Math.max(0, Number(uiState.selectedCardCost ?? 0))} RP.`;
        action = "Press Play Card, then follow the highlighted placement or effect prompt.";
      }
    } else if (uiState.recommendedBuildCard) {
      const card = uiState.recommendedBuildCard;
      title = `Play ${card.cardName}`;
      message = `${card.cardName} is a legal ${card.kindLabel ?? "ecosystem card"} in your hand. It costs ${card.cost} RP${Number(card.victoryPoints ?? 0) > 0 ? ` and adds ${Number(card.victoryPoints)} VP in play` : ""}.`;
      action = `Choose ${card.cardName}, press Play Card, and follow its placement or effect prompt.`;
      target = "hand";
      targetCardId = card.cardId;
      targetLabel = `${card.cardName} in your hand`;
      cue = `recommend:${card.cardId}`;
    } else {
      title = "Build on a later turn";
      message = uiState.buildBlockReason
        ? `No ecosystem card in your hand is legal right now. ${uiState.buildBlockReason}`
        : "No ecosystem card in your hand is legal right now. More RP or a different draw can create a build option.";
      action = "Check any remaining actions, then end the turn to collect RP and draw again.";
      target = "turn-button";
      cue = "blocked";
    }
  } else if (checkpointId === "tutorial-attack") {
    const recovery = getAttackRecovery(uiState);
    const isLookingAtHand = uiState.modal === "hand" || uiState.handPopoverOpen;
    const selectedAttackSetup = isLookingAtHand
      && uiState.attackSetupCard?.cardId === uiState.selectedHandCard;
    const selectedBuildFallback = isLookingAtHand
      && !uiState.readyAttack
      && !uiState.attackSetupCard
      && uiState.recommendedBuildCard?.cardId === uiState.selectedHandCard;
    if (uiState.attackContext && uiState.inspectedCardOpen) {
      title = "Return to the active attack";
      message = "These card details are covering the legal targets for the attack already in progress.";
      target = "close-modal";
      action = "Close these details, then choose one of the glowing legal targets on my board.";
      cue = `active-attack:close:${uiState.activeAttack?.cardId ?? "card"}`;
    } else if (uiState.attackContext) {
      const active = uiState.activeAttack;
      title = active ? `${active.cardName} is attacking` : "Choose a legal target";
      message = active
        ? `${active.attackName} is active. Only compatible creatures on my board are glowing.`
        : "Your attack is active. Only compatible creatures on my board are glowing.";
      target = "opponent-board";
      action = "Choose one of the glowing legal targets in my ecosystem.";
      cue = `target:${active?.cardId ?? "active"}`;
    } else if (selectedAttackSetup) {
      const card = uiState.attackSetupCard;
      title = `Play ${card.cardName}`;
      message = `${card.cardName} costs ${card.cost} RP to play. You will retain enough RP for ${card.attackName}, and that attack has ${card.targetCount} legal ${card.targetCount === 1 ? "target" : "targets"}.`;
      target = "play-card";
      action = `Press Play Card, follow its placement or effect prompt, then select ${card.cardName} and use ${card.attackName}.`;
      cue = `setup-attack:play:${card.cardId}`;
    } else if (selectedBuildFallback) {
      const card = uiState.recommendedBuildCard;
      title = `Play ${card.cardName} for this turn`;
      message = `${uiState.attackBlockReason ?? "No legal attack is available yet."} ${card.cardName} is legal to play for ${card.cost} RP, even though it will not create a legal attack right now.`;
      target = "play-card";
      action = `Press Play Card and follow its placement or effect prompt. ${recovery.action}`;
      cue = `attack-blocked:play:${card.cardId}`;
    } else if (uiState.inspectedPlayerCard && !uiState.inspectedAttack?.ready) {
      const inspectedName = uiState.inspectedCardName ?? "This card";
      const next = uiState.readyAttack;
      title = `${inspectedName} cannot attack right now`;
      message = uiState.inspectedAttack?.blockReason
        ?? `${inspectedName} does not have a supported basic attack action.`;
      target = "close-modal";
      action = next
        ? `Close these details, select ${next.cardName}, and use ${next.attackName}.`
        : uiState.attackSetupCard
          ? `Close these details, then play ${uiState.attackSetupCard.cardName} from your hand.`
          : "Close these details, check your hand, then end the turn if no legal attack becomes available.";
      cue = `inspected-blocked:${uiState.inspectedAttack?.actionKey ?? uiState.inspectedCardName ?? "card"}`;
    } else if (uiState.inspectedCardOpen && !uiState.inspectedPlayerCard) {
      const next = uiState.readyAttack;
      title = "Return to your ecosystem";
      message = "You are reviewing one of Professor Current's cards, but the next guided action starts from your side of the board.";
      target = "close-modal";
      action = next
        ? `Close these details, select ${next.cardName}, and use ${next.attackName}.`
        : "Close these details, then follow the highlighted card or turn control.";
      cue = `opponent-inspector:${uiState.inspectedCardName ?? "card"}`;
    } else if (uiState.handPopoverOpen) {
      const next = uiState.readyAttack;
      title = next ? `${next.cardName} is already ready` : "Return to the guided action";
      message = next
        ? `You do not need another card before attacking. ${next.cardName}'s ${next.attackName} has ${next.targetCount} legal ${next.targetCount === 1 ? "target" : "targets"}.`
        : "These card details are covering the action Professor Current needs you to take next.";
      target = "close-modal";
      action = next
        ? `Close these card details, select ${next.cardName} in your ecosystem, and use ${next.attackName}.`
        : uiState.attackSetupCard
          ? `Close these details, then choose ${uiState.attackSetupCard.cardName} from your hand.`
          : uiState.recommendedBuildCard
            ? `Close these details, then choose ${uiState.recommendedBuildCard.cardName}.`
            : "Close these details, then end the turn and draw toward another legal attack.";
      cue = `close-hand:${next?.actionKey ?? uiState.attackSetupCard?.cardId ?? uiState.recommendedBuildCard?.cardId ?? "end"}`;
    } else if (uiState.modal === "hand" && uiState.readyAttack) {
      const attack = uiState.readyAttack;
      title = `${attack.cardName} is already ready`;
      message = `${attack.cardName}'s ${attack.attackName} already has ${attack.targetCount} legal ${attack.targetCount === 1 ? "target" : "targets"}; another card is not required first.`;
      target = "close-modal";
      action = `Close your hand, select ${attack.cardName}, and use ${attack.attackName}.`;
      cue = `close-hand:ready:${attack.actionKey ?? attack.cardId}`;
    } else if (uiState.modal === "hand" && !uiState.attackSetupCard && !uiState.recommendedBuildCard) {
      title = "No legal attack is hiding in your hand";
      message = uiState.attackBlockReason ?? "No card in your hand can create a legal attack this turn.";
      target = "close-modal";
      action = `Close your hand. ${recovery.action}`;
      cue = "close-hand:end-turn";
    } else if (uiState.inspectedAttack?.ready) {
      const attack = uiState.inspectedAttack;
      title = `Use ${attack.attackName}`;
      message = `${attack.cardName} can use ${attack.attackName} for ${attack.attackCost} RP against ${attack.targetCount} legal ${attack.targetCount === 1 ? "target" : "targets"}.`;
      target = "attack-button";
      action = `Press Use ${attack.attackName}, then choose a glowing target on my board.`;
      targetActionKey = attack.actionKey;
      cue = `attack-button:${attack.actionKey ?? attack.cardId}`;
    } else if (uiState.readyAttack) {
      const attack = uiState.readyAttack;
      title = `Attack with ${attack.cardName}`;
      message = `${attack.cardName} is ready: ${attack.attackName} costs ${attack.attackCost} RP and has ${attack.targetCount} legal ${attack.targetCount === 1 ? "target" : "targets"} on my board.`;
      target = "player-board";
      action = `Select ${attack.cardName}, then use ${attack.attackName}.`;
      targetActionKey = attack.actionKey;
      targetLabel = `${attack.cardName} in your ecosystem`;
      cue = `ready:${attack.actionKey ?? attack.cardId}`;
    } else if (uiState.attackSetupCard) {
      const card = uiState.attackSetupCard;
      title = `Play ${card.cardName} to prepare an attack`;
      message = `${card.cardName} is playable for ${card.cost} RP. After it enters your ecosystem, you will still have enough RP to use ${card.attackName}, which has ${card.targetCount} legal ${card.targetCount === 1 ? "target" : "targets"}.`;
      target = "hand";
      targetCardId = card.cardId;
      targetLabel = `${card.cardName} in your hand`;
      action = `Choose ${card.cardName}, press Play Card, follow its placement or effect prompt, then select it and use ${card.attackName}.`;
      cue = `setup-attack:${card.cardId}`;
    } else if (uiState.recommendedBuildCard) {
      const card = uiState.recommendedBuildCard;
      title = "No legal attack yet";
      message = uiState.attackBlockReason
        ? `${uiState.attackBlockReason} You can still improve your ecosystem with ${card.cardName}.`
        : `None of your creatures can legally attack my current board. ${card.cardName} is a legal build for this turn.`;
      target = "hand";
      targetCardId = card.cardId;
      targetLabel = `${card.cardName} in your hand`;
      action = `Play ${card.cardName} if it helps your plan. ${recovery.action}`;
      cue = `attack-blocked:build:${card.cardId}`;
    } else {
      title = "No legal attack yet";
      message = uiState.attackBlockReason
        ?? "You have no creature that can afford an attack against a compatible target on my board right now.";
      target = "turn-button";
      action = recovery.action;
      cue = "attack-blocked:end-turn";
    }
  } else if (checkpointId === "tutorial-end-turn") {
    target = "turn-button";
    cue = "end-turn";
  } else if (checkpointId === "tutorial-earn-vp") {
    target = "vp-score";
    cue = "vp";
  }

  return withTarget({
    id: checkpointId,
    title,
    message,
    action,
    targetCardId,
    targetActionKey,
    targetLabel,
  }, target, cue);
}

export function hasSimulatorTutorialHelp(checkpointId) {
  return Object.hasOwn(HELP_BY_CHECKPOINT, checkpointId);
}

export const SIMULATOR_TUTORIAL_HELP_CHECKPOINT_IDS = Object.freeze(Object.keys(HELP_BY_CHECKPOINT));
