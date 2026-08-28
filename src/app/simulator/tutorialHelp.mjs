import { getGuidedAcademyLayoutLessonStep } from "./tutorialLayoutLesson.mjs";

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
  "utility-action-button": "the highlighted card action button",
  "condition-continue": "the Continue button beneath the condition lesson",
  "script-search-card": "the highlighted planned attacker",
  "search-card": "the highlighted lesson card in the search results",
  "vp-score": "your Victory Point counter",
  "rp-bank": "your RP bank",
});

const HELP_BY_CHECKPOINT = Object.freeze({
  "tutorial-setup": Object.freeze({
    message: "Every ecosystem needs a foundation. Start with a green-glowing Base Coral or Creature School from your hand.",
    playerThought: "So I am not racing to play the flashiest creature first. I need a home that gives the rest of my ecosystem somewhere legal to grow.",
    encouragement: "Exactly. A patient first placement makes every later choice easier, and there is no hurry while we learn the board together.",
    action: "Choose a ready foundation card, press Play Card, and place it in your ecosystem.",
  }),
  "tutorial-collect-rp": Object.freeze({
    message: "Resource Points, or RP, are the energy you spend to play cards. Your ecosystem collects them at the start of each round.",
    playerThought: "I should compare what I collect with the size of my bank, then decide how much to spend and how much to keep for actions.",
    encouragement: "Well reasoned. RP is a budget, not a command to spend everything immediately. Saving one or two points can keep an important ability available.",
    action: "Press Begin Round 1 and watch your RP bank increase.",
  }),
  "tutorial-draw-card": Object.freeze({
    title: "Choose a deck with a plan",
    message: "The Foundation Deck grows your economy with Corals and Creature Schools, so it is usually the best early-game draw. Choose the Pals Deck when you need creatures, habitats, support effects, or more ways to earn VP.",
    playerThought: "Early on I want the economy to support several future turns. Later I can choose Pals when I know which creature or tactic my board needs.",
    encouragement: "Precisely. Drawing is a decision about your next problem, not merely taking the most exciting card on top.",
    action: "For this early draw, start with the Foundation Deck, then confirm your choice.",
  }),
  "tutorial-build-card": Object.freeze({
    title: "Add to your ecosystem",
    message: "Use RP to add another card to your ecosystem. Cards marked Ready to play are legal and affordable right now.",
    playerThought: "Before I play a card, I should check its cost, its legal home, and whether I still want RP left for an action afterward.",
    encouragement: "That is the habit of a thoughtful Reefkeeper. A legal play is only the beginning; the best play also supports what you hope to do next.",
    action: "Choose a card marked Ready to play, press Play Card, and follow its placement or effect prompt.",
  }),
  "tutorial-attack": Object.freeze({
    message: "Creatures with attacks can challenge compatible creatures in my ecosystem. The simulator only highlights legal targets.",
    playerThought: "I should inspect the whole card. Some creatures attack, while others use actions such as Scavenge to improve my hand or prepare a later move.",
    encouragement: "Ah, now you are reading like a scientist—observe every option before drawing a conclusion. An action that causes no damage can still shape the entire turn.",
    action: "Choose a ready attacker, use its attack, then resolve the dice roll.",
  }),
  "tutorial-end-turn": Object.freeze({
    message: "A careful Reefkeeper checks the board, hand, and remaining RP before passing play.",
    playerThought: "Before I pass, I will check for affordable card actions, legal attacks, useful Support cards, and RP I meant to save.",
    encouragement: "Wonderful. That small pause prevents many missed opportunities. When the board says you are finished—not merely the first idea in your head—then end the turn.",
    action: "When you are satisfied with your choices, press End Turn.",
  }),
  "tutorial-earn-vp": Object.freeze({
    message: "Victory Points measure the ecosystem you have built. Cards in play add VP automatically, including some relationship bonuses.",
    playerThought: "So attacking can disrupt an opponent, but my main race is still to build a healthy ecosystem that produces enough VP.",
    encouragement: "Exactly right. SeaPals rewards relationships and planning as much as combat. Keep asking what each card contributes to the ecosystem as a whole.",
    action: "Watch your VP counter grow until you reach the tutorial goal shown on the scoreboard.",
  }),
});

const CONDITION_HELP_BY_ID = Object.freeze({
  "abundant-sunlight": Object.freeze({
    title: "Begin by reading the water",
    message: "In the ocean, sunlight powers photosynthesis in algae, seagrasses, and the symbiotic algae that help feed corals. How much light reaches a reef changes with depth, water clarity, weather, and season. In SeaPals, Abundant Sunlight simplifies that energy opportunity by raising both players' RP bank caps by 2 this round. The larger cap gives you more storage, but it does not add RP by itself.",
    playerThought: "My bank can hold more this round, but I still collect only the amount shown below. I should plan from what I actually collected, not treat the empty space as though it were already RP.",
    encouragement: "Exactly so. Conditions change the rules around your plan; they do not replace careful counting. Notice the larger cap, then compare it with what you actually collected.",
  }),
  "clear-water": Object.freeze({
    title: "Ask exactly who is affected",
    message: "In the ocean, clear water has fewer suspended particles, so light travels farther and animals can see one another more easily. That can change how predators and prey hunt or hide. In SeaPals, Clear Water simplifies that visibility shift by making Predator and Apex cards cost 1 more RP this round. Corals, other Fish and Invertebrates, and actions already in play keep their normal costs.",
    playerThought: "Then I should not treat this as a tax on every card. Arrow Crab and Porcupine Fish follow their printed costs because neither is a Predator or Apex.",
    encouragement: "Beautifully read. Conditions often look broad at first glance. Check the named card types, players, and duration before changing your plan.",
  }),
  "algae-bloom": Object.freeze({
    title: "A full hand has a limit",
    message: "In the ocean, algae blooms are rapid increases in algae or phytoplankton. Not all blooms are harmful, but dense blooms can block light, and their decay can lower oxygen. In SeaPals, Algae Bloom models that crowded, stressed system with a seven-card hand limit this round. Complete each required draw, search, or recovery first. If your hand then has more than seven cards, choose cards from your entire hand to discard until seven remain.",
    playerThought: "If a draw takes me over seven cards, I can keep the cards that best support my plan and choose the rest to discard.",
    encouragement: "Exactly. The hand limit forces a difficult choice, but it does not make that choice for you. Compare your whole hand before deciding what to discard.",
  }),
  "murky-water": Object.freeze({
    title: "Conditions can create opportunities",
    message: "In the ocean, murky water can contain suspended sediment, plankton, or other particles that reduce visibility; murky does not automatically mean polluted. Different species respond differently. In SeaPals, Murky Water models one possible advantage—predators approaching unseen—by reducing Predator and Apex play costs by 1 RP this round.",
    playerThought: "I should look at my actual hand before deciding whether this condition is good for me. A discount matters only if I can use the affected cards.",
    encouragement: "Precisely. Good strategy begins with evidence from this board, this hand, and this round—not a rule of thumb applied blindly.",
  }),
  "severe-coral-bleaching": Object.freeze({
    title: "Bleaching can weaken reef productivity",
    message: "In the ocean, prolonged heat stress can cause reef-building corals to expel the symbiotic algae that supply much of their food and color. A bleached coral is stressed, not necessarily dead. In SeaPals, Severe Coral Bleaching models that lost productivity: heat-sensitive Corals remain in play and keep their slots, but they generate no RP this round.",
    playerThought: "The affected Coral still provides its slots, but I must count this round's smaller collection before deciding what the reef can afford.",
    encouragement: "Exactly. Environmental stress can change what an ecosystem can support even when its structure is still visible. Our earlier economy gives us enough resilience to establish a Creature School this round.",
  }),
  "krill-ball": Object.freeze({
    title: "A bloom can open a brief opportunity",
    message: "In the ocean, currents and seasonal productivity can concentrate krill into dense swarms, creating a temporary food pulse for whales and other filter feeders. In SeaPals, Krill Bloom models that brief opportunity by lowering each player's next Filter Feeder School Density requirement by 150. The reduction can be used only once per player.",
    playerThought: "Whale Shark normally needs 180 School Density. After the 150-point reduction, White Grunt's 30 is exactly enough; Whale Shark commits all of that capacity, filling the School's bucket until Whale Shark leaves or another School adds capacity.",
    encouragement: "That is the calculation. Conditions can change whether a play is legal, so compare the printed requirement with the active reduction before spending RP.",
  }),
  "bleak-overcast": Object.freeze({
    title: "A smaller bank changes the final budget",
    message: "In the ocean, cloud cover reduces incoming sunlight and can temporarily limit photosynthesis near the surface, although the effect depends on duration and habitat. In SeaPals, Bleak Overcast models a smaller energy window by lowering both players' RP bank caps by 2 this round and discarding RP above the new cap. It changes storage, not card costs.",
    playerThought: "I should check the reduced cap before planning the turn. The reef was built ahead of time, so its remaining 6 RP can still support Hammerhead.",
    encouragement: "Precisely. A resilient plan leaves room for changing conditions. We can use a zero-cost Support to find the Apex, then spend the bank on the card that ends the lesson.",
  }),
});

function requireCheckpointId(checkpoint) {
  const id = String(checkpoint?.id ?? "").trim();
  return id || null;
}

function withTarget(help, target, cue = target) {
  const authoredConversation = HELP_BY_CHECKPOINT[help.id] ?? {};
  return Object.freeze({
    ...authoredConversation,
    ...help,
    cueId: `${help.id}:${cue ?? "status"}`,
    target,
    targetLabel: help.targetLabel ?? TARGET_LABELS[target] ?? "the highlighted control",
  });
}

function describeDrawnCard(card) {
  const name = String(card?.name ?? "This card");
  if (card?.discarded) {
    return `${name} came from the ${card.source ?? "personal"} Deck. This draw put your hand over the limit, so choose which card or cards from your entire hand to discard until you meet it.`;
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

function describeUtilityAction(action) {
  const cardName = String(action?.cardName ?? "This card");
  const actionName = String(action?.actionName ?? "card action");
  const cost = Math.max(0, Number(action?.actionCost ?? 0));
  const detail = String(action?.actionText ?? "").trim();
  return `${cardName}'s ${actionName} is a legal card action right now and costs ${cost} RP.${detail ? ` ${detail}` : ""} It can improve your position, but it is not an attack, so the attack lesson will still be waiting afterward.`;
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
    } else if (uiState.readyUtilityAction) {
      const utility = uiState.readyUtilityAction;
      nextAction = `Press Continue to Actions, then select ${utility.cardName} and use ${utility.actionName} for ${utility.actionCost} RP. This useful card action will not complete the attack lesson, so I will reassess your legal attack options afterward.`;
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
      targetDeck: !drawReady ? (foundationAvailable ? "foundation" : palsAvailable ? "pals" : null) : null,
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
      targetDeck: !drawReady ? (foundationAvailable ? "foundation" : palsAvailable ? "pals" : null) : null,
    }, target, `turn-draw:planned-card:${card.cardId}:${drawReady ? "ready" : "choose"}`);
  }

  if (checkpointId === "tutorial-attack" && uiState.scriptedLesson && uiState.nextPalsCardName === "Arrow Crab") {
    const palsSelected = Number(uiState.drawPalsSelected ?? 0) > 0;
    const scriptedTarget = drawReady && palsSelected ? "confirm-draw" : "draw-controls";
    return withTarget({
      id: checkpointId,
      title: "Draw the prepared Arrow Crab",
      lead: "",
      message: "Welcome back. Our first turn built the economy; this turn will show why a card action, not an attack, can be the useful move. I placed Arrow Crab next in your Pals Deck so we can practice its Scavenge action deliberately.",
      playerThought: "I know the lesson card I need and which personal deck holds it, so this is a planned Pals draw rather than a guess.",
      encouragement: "Exactly. After the draw, we will play Arrow Crab, inspect the whole card, and use Scavenge to search for a legal attacker.",
      action: drawReady
        ? palsSelected
          ? "Press Draw Selected Cards, review Arrow Crab, then continue to the action phase."
          : "Your draw is complete, but switch it to the Pals Deck to follow the prepared lesson."
        : "Choose one card from the Pals Deck, then confirm the draw.",
      targetDeck: scriptedTarget === "draw-controls" ? "pals" : null,
    }, scriptedTarget, `turn-draw:scripted-arrow-crab:${drawReady ? palsSelected ? "ready" : "switch" : "choose"}`);
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
    const recoveryTarget = drawReady && (selectedPreferred || !preferredAvailable) ? "confirm-draw" : "draw-controls";
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
      targetDeck: recoveryTarget === "draw-controls" ? recommendedDeck?.toLowerCase() ?? null : null,
    }, recoveryTarget, `turn-draw:attack:${drawReady ? selectedPreferred ? "ready" : "switch" : "choose"}`);
  }

  let action = authored.action;
  const foundationSelected = Number(uiState.drawFoundationSelected ?? 0) > 0;
  const palsSelected = Number(uiState.drawPalsSelected ?? 0) > 0;
  const guidedTarget = drawReady && (foundationSelected || !foundationAvailable) ? "confirm-draw" : "draw-controls";
  if (drawReady && Number(uiState.drawFoundationSelected ?? 0) > 0) {
    action = "Good early-game choice. Press Draw Selected Cards to reveal the Foundation card and see whether you can play it now.";
  } else if (drawReady && Number(uiState.drawPalsSelected ?? 0) > 0) {
    action = foundationAvailable
      ? "For this guided first draw, remove the Pals choice and add one Foundation card so we can build your economy."
      : "Foundation is empty, so keep the Pals choice and confirm the draw.";
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
    targetDeck: guidedTarget === "draw-controls" ? (foundationAvailable ? "foundation" : palsAvailable ? "pals" : null) : null,
  }, guidedTarget, `turn-draw:${drawReady ? palsSelected && foundationAvailable ? "switch" : "ready" : "choose"}`);
}

const FINISH_DUEL_HELP_ID = "tutorial-finish-duel";

function finishDuelContext(uiState) {
  const targetVp = Math.max(1, Number(uiState.victoryTarget) || 10);
  const playerVp = Math.max(0, Number(uiState.playerVp) || 0);
  const opponentVp = Math.max(0, Number(uiState.opponentVp) || 0);
  const remainingVp = Math.max(0, targetVp - playerVp);
  const round = Math.max(0, Number(uiState.round) || 0);
  const turn = Math.max(1, Number(uiState.turn) || 1);
  return {
    targetVp,
    playerVp,
    opponentVp,
    remainingVp,
    progressLabel: `Final goal • ${playerVp}/${targetVp} VP`,
    cuePrefix: `${FINISH_DUEL_HELP_ID}:r${round}:t${turn}:vp${playerVp}-${targetVp}`,
  };
}

function decorateFinishDuelHelp(help, uiState, cue) {
  const context = finishDuelContext(uiState);
  return Object.freeze({
    ...help,
    id: FINISH_DUEL_HELP_ID,
    cueId: `${context.cuePrefix}:${cue}`,
    progressLabel: context.progressLabel,
  });
}

function getFinishDuelDrawHelp(uiState) {
  const context = finishDuelContext(uiState);
  const drawSelected = Math.max(0, Number(uiState.drawSelected) || 0);
  const drawTarget = Math.max(0, Number(uiState.drawTarget) || 0);
  const foundationAvailable = Number(uiState.foundationDeckCount ?? 0) > 0;
  const palsAvailable = Number(uiState.palsDeckCount ?? 0) > 0;
  const palsSelected = Number(uiState.drawPalsSelected ?? 0) > 0;
  const drawReady = drawTarget > 0 && drawSelected === drawTarget;
  const preferredDeck = palsAvailable ? "Pals" : foundationAvailable ? "Foundation" : null;
  const preferredSelected = preferredDeck === "Pals"
    ? palsSelected
    : Number(uiState.drawFoundationSelected ?? 0) > 0;
  const target = drawReady && (preferredSelected || !preferredDeck) ? "confirm-draw" : "draw-controls";
  const action = drawReady
    ? preferredSelected || !preferredDeck
      ? "Press Draw Selected Cards, review what you drew, then continue to your actions."
      : `Your draw is valid, but switch it to the ${preferredDeck} Deck for the guided route toward more VP options.`
    : preferredDeck
      ? `Choose ${drawTarget || 1} card${drawTarget === 1 ? "" : "s"} from the ${preferredDeck} Deck, then confirm the draw.`
      : "Both personal decks are empty, so no draw can be selected.";

  return withTarget({
    id: FINISH_DUEL_HELP_ID,
    title: `Build the next ${context.remainingVp} VP`,
    lead: "",
    message: palsAvailable
      ? `You have completed the lesson steps and reached ${context.playerVp}/${context.targetVp} VP. The Pals Deck is the strongest guided draw now because it contains more creatures, habitats, and effects that can grow or protect your score.`
      : `You have completed the lesson steps and reached ${context.playerVp}/${context.targetVp} VP. The Foundation Deck is the remaining draw source, so use it to expand your economy and legal play spaces.`,
    action,
    targetDeck: target === "draw-controls" ? preferredDeck?.toLowerCase() ?? null : null,
    progressLabel: context.progressLabel,
  }, target, `${context.cuePrefix}:draw:${drawReady ? preferredSelected ? "confirm" : "switch" : preferredDeck?.toLowerCase() ?? "empty"}`);
}

const FINISH_BLOCKING_MODAL_COPY = Object.freeze({
  "support-draw": Object.freeze({
    title: "Finish the replacement draw",
    message: "Dr. Evans is waiting for you to choose how many replacement cards come from each personal deck. This choice must be completed or canceled before the VP plan can continue.",
    action: "Choose the replacement cards and confirm, or press Close to cancel this Support effect and return to the guided plan.",
  }),
  search: Object.freeze({
    title: "Finish choosing the searched card",
    message: "A deck-search effect is still open. Choose one of its legal cards, or cancel the search before returning to the VP plan.",
    action: "Choose a listed card to complete the search, or press Close to cancel it.",
  }),
  recover: Object.freeze({
    title: "Finish the recovery choice",
    message: "Recovery is waiting for a card from the discard pile. Complete or cancel that choice before taking another action.",
    action: "Choose a listed card to recover, or press Close to leave the recovery effect.",
  }),
  "coral-target": Object.freeze({
    title: "Finish choosing a Coral",
    message: "This effect needs a legal Coral target before the main VP plan can resume.",
    action: "Choose a listed Coral to complete the effect, or press Close to cancel it.",
  }),
  restock: Object.freeze({
    title: "Finish the Restocking choice",
    message: "Restocking is waiting for up to three Fish selections. Resolve or cancel it before returning to the planned finish.",
    action: "Select the Fish you want and confirm Restocking, or press Close to cancel it.",
  }),
  discard: Object.freeze({
    title: "Return from the discard pile",
    message: "The discard pile is only an inspection view; it is covering the next guided action.",
    action: "Press Close to return to the practice reef.",
  }),
  lost: Object.freeze({
    title: "Return from the lost zone",
    message: "The lost zone is only an inspection view; it is covering the next guided action.",
    action: "Press Close to return to the practice reef.",
  }),
});

function getFinishBlockingModalHelp(uiState) {
  const modalCopy = FINISH_BLOCKING_MODAL_COPY[uiState.modal];
  if (!modalCopy) return null;
  return decorateFinishDuelHelp(withTarget({
    id: FINISH_DUEL_HELP_ID,
    ...modalCopy,
  }, "close-modal", `blocking-modal:${uiState.modal}`), uiState, `blocking-modal:${uiState.modal}`);
}

function getScriptedFinishDrawHelp(uiState, preferredDeck, reason) {
  const context = finishDuelContext(uiState);
  const drawSelected = Math.max(0, Number(uiState.drawSelected) || 0);
  const drawTarget = Math.max(0, Number(uiState.drawTarget) || 0);
  const foundationSelected = Math.max(0, Number(uiState.drawFoundationSelected) || 0);
  const palsSelected = Math.max(0, Number(uiState.drawPalsSelected) || 0);
  const preferredSelected = preferredDeck === "Foundation" ? foundationSelected : palsSelected;
  const preferredCount = preferredDeck === "Foundation"
    ? Math.max(0, Number(uiState.foundationDeckCount) || 0)
    : Math.max(0, Number(uiState.palsDeckCount) || 0);
  if (!preferredCount) return null;
  const requiredFromPreferred = Math.min(drawTarget, preferredCount);
  const drawReady = drawTarget > 0 && drawSelected === drawTarget;
  const routeSelected = preferredSelected === requiredFromPreferred;
  const target = drawReady && routeSelected ? "confirm-draw" : "draw-controls";
  const preferredDeckKey = preferredDeck.toLowerCase();
  const otherDeckKey = preferredDeck === "Foundation" ? "pals" : "foundation";
  const otherDeckLabel = preferredDeck === "Foundation" ? "Pals" : "Foundation";
  const correctingWrongDeck = drawReady && !routeSelected;
  return decorateFinishDuelHelp(withTarget({
    id: FINISH_DUEL_HELP_ID,
    title: `Choose the ${preferredDeck} Deck for this step`,
    lead: "",
    message: `${reason} This tutorial uses a prepared card order, so choose the ${preferredDeck} Deck to reveal the next lesson card.`,
    action: drawReady
      ? routeSelected
        ? "Press Draw Selected Cards, review the reveal, then continue to the prepared action."
        : `Press minus on the ${otherDeckLabel} Deck, then add that draw to the ${preferredDeck} Deck and confirm it.`
      : `Choose ${drawTarget || 1} card${drawTarget === 1 ? "" : "s"} from the ${preferredDeck} Deck, then confirm the draw.`,
    targetDeck: target === "draw-controls"
      ? correctingWrongDeck ? otherDeckKey : preferredDeckKey
      : null,
    targetDrawAction: target === "draw-controls"
      ? correctingWrongDeck ? "remove" : "add"
      : null,
    progressLabel: context.progressLabel,
  }, target, `scripted-draw:${preferredDeckKey}:${drawReady ? routeSelected ? "confirm" : "switch" : "choose"}`), uiState, `scripted-draw:${preferredDeckKey}:${drawReady ? routeSelected ? "confirm" : "switch" : "choose"}`);
}

function getScriptedCardPlayHelp(uiState, card, {
  title,
  message,
  action,
  placementMessage = null,
} = {}) {
  if (!card) return null;
  if (uiState.playingCardId && uiState.playingCardId !== card.cardId) return null;
  if (card.isPlaying || uiState.playingCardId === card.cardId) {
    return decorateFinishDuelHelp(withTarget({
      id: FINISH_DUEL_HELP_ID,
      title: `Place ${card.cardName}`,
      message: placementMessage ?? `${card.cardName} has left your hand. Its ${card.victoryPoints} VP only counts after a legal placement is complete.`,
      action: "Choose the highlighted legal placement in your ecosystem.",
    }, "placement", `scripted-place:${card.cardId}`), uiState, `scripted-place:${card.cardId}`);
  }

  const selectedCardOpen = Boolean(
    uiState.selectedHandCard && (uiState.modal === "hand" || uiState.handPopoverOpen)
  );
  if (selectedCardOpen && uiState.selectedHandCard === card.cardId) {
    if (card.playError) return null;
    return decorateFinishDuelHelp(withTarget({
      id: FINISH_DUEL_HELP_ID,
      title: title ?? `Play ${card.cardName}`,
      message,
      action: action ?? `Press Play Card, then place ${card.cardName} in a highlighted legal space.`,
      targetCardId: card.cardId,
    }, "play-card", `scripted-play:${card.cardId}`), uiState, `scripted-play:${card.cardId}`);
  }
  if (uiState.handPopoverOpen) {
    return decorateFinishDuelHelp(withTarget({
      id: FINISH_DUEL_HELP_ID,
      title: `Return to ${card.cardName}`,
      message: `These card details are covering ${card.cardName}, the next card in the prepared route.`,
      action: `Press Close, then choose ${card.cardName}.`,
      targetCardId: card.cardId,
    }, "close-modal", `scripted-close-for:${card.cardId}`), uiState, `scripted-close-for:${card.cardId}`);
  }
  if (!card.inHand || card.playError) return null;
  return decorateFinishDuelHelp(withTarget({
    id: FINISH_DUEL_HELP_ID,
    title: title ?? `Choose ${card.cardName}`,
    message,
    action: action ?? `Choose ${card.cardName}, press Play Card, then finish its legal placement.`,
    targetCardId: card.cardId,
    targetLabel: `${card.cardName} in your hand`,
  }, "hand", `scripted-card:${card.cardId}`), uiState, `scripted-card:${card.cardId}`);
}

function getAcademyDrawResultLesson(round, cards, drawnCards) {
  const revealedCards = Array.isArray(drawnCards) ? drawnCards : [];
  const primaryCard = revealedCards.find((card) => !card?.discarded) ?? revealedCards[0] ?? null;
  if (!primaryCard || primaryCard.discarded) {
    return {
      message: primaryCard
        ? describeDrawnCard(primaryCard)
        : "No card was revealed. Continue so I can reassess the live board without pretending the planned card reached your hand.",
      action: "Press Continue to Actions. I will adjust the next step to the cards actually available.",
    };
  }

  const lessons = {
    1: {
      cardId: cards.economy?.cardId,
      message: `${cards.economy?.cardName ?? primaryCard.name} came from the Foundation Deck, where Corals and Creature Schools build your economy. Its Photosynthesis income and Predator slot support the later plan. Place it beside your first Coral as a separate foundation, not on top of it.`,
      action: `Press Continue to Actions, then choose ${cards.economy?.cardName ?? primaryCard.name} and place it in the separate highlighted foundation area.`,
    },
    2: {
      cardId: cards.firstFish?.cardId,
      message: `${cards.firstFish?.cardName ?? primaryCard.name} came from the Pals Deck. Coral Reef needs any two regular Fish; this card can fill one of those spots and later teach its Crunch attack. Keep it in hand for now; first use ${cards.coralSupport?.cardName ?? "Coral Gardener"} to find ${cards.searchedCoral?.cardName ?? "Lettuce Coral"} and complete the four-Coral economy.`,
      action: `Press Continue to Actions, then choose ${cards.coralSupport?.cardName ?? "Coral Gardener"}. Keep ${cards.firstFish?.cardName ?? primaryCard.name} in hand for Round 3.`,
    },
    3: {
      cardId: cards.secondFish?.cardId,
      message: `${cards.secondFish?.cardName ?? primaryCard.name} came from the Pals Deck. Coral Reef accepts any two regular Fish; ${cards.firstFish?.cardName ?? "Porcupine Fish"} can fill one spot and this card can fill the other. It can wait in hand until the Habitat turn. First establish ${cards.bankBoost?.cardName ?? "Arrow Crab"} and ${cards.utility?.cardName ?? "Nudibranch"}, use Munch, and attack with ${cards.firstFish?.cardName ?? "Porcupine Fish"}.`,
      action: `Press Continue to Actions, then choose ${cards.bankBoost?.cardName ?? "Arrow Crab"}. Keep ${cards.secondFish?.cardName ?? primaryCard.name} in hand for Round 4.`,
    },
    4: {
      cardId: cards.predator?.cardId,
      message: `${cards.predator?.cardName ?? primaryCard.name} came from the Pals Deck. This Predator is useful now because my reef has legal targets and your ${cards.habitat?.cardName ?? "Coral Reef"} Habitat can grant its second Bite. First play ${cards.secondFish?.cardName ?? "Parrotfish"} and establish ${cards.habitat?.cardName ?? "Coral Reef"}; then play the Predator.`,
      action: `Press Continue to Actions, then play ${cards.secondFish?.cardName ?? "Parrotfish"}. We will establish ${cards.habitat?.cardName ?? "Coral Reef"} before using ${cards.predator?.cardName ?? primaryCard.name}.`,
    },
    5: {
      cardId: cards.creatureSchool?.cardId,
      message: `${cards.creatureSchool?.cardName ?? primaryCard.name} came from the Foundation Deck because it is a Creature School. It belongs in the foundation area and adds 30 School Density of bucket capacity for larger animals. Creatures commit space in that bucket while they remain in play. Its Eco Foundation can still produce 1 RP while Severe Coral Bleaching stops heat-sensitive Corals.`,
      action: `Press Continue to Actions, then play ${cards.creatureSchool?.cardName ?? primaryCard.name} in the highlighted foundation area.`,
    },
    6: {
      cardId: cards.filterFeeder?.cardId,
      message: `${cards.filterFeeder?.cardName ?? primaryCard.name} came from the Pals Deck. This Filter Feeder normally needs 180 School Density, but Krill Bloom lowers the requirement by 150. ${cards.creatureSchool?.cardName ?? "White Grunt"} has 30 open points, and this play will commit all of them. ${cards.habitat?.cardName ?? "Coral Reef"} meets its separate Habitat requirement, so the play is legal now.`,
      action: `Press Continue to Actions, then play ${cards.filterFeeder?.cardName ?? primaryCard.name} in open water.`,
    },
    7: {
      cardId: cards.apexSupport?.cardId,
      message: `${cards.apexSupport?.cardName ?? primaryCard.name} came from the Pals Deck. It is a zero-cost, one-shot Support that searches for a Predator or Apex and then goes to the discard pile. Your ${cards.habitat?.cardName ?? "Coral Reef"} and Apex slot are ready, so use it to find ${cards.apex?.cardName ?? "Hammerhead"} and finish the lesson.`,
      action: `Press Continue to Actions, then play ${cards.apexSupport?.cardName ?? primaryCard.name} and choose ${cards.apex?.cardName ?? "Hammerhead"} from the search results.`,
    },
  };
  const lesson = lessons[round];
  if (lesson?.cardId === primaryCard.cardId) return lesson;
  return {
    message: revealedCards.map(describeDrawnCard).join(" "),
    action: "Press Continue to Actions. I will base the next highlighted move on the card you actually drew.",
  };
}

function getAcademyCurriculumHelp(uiState) {
  const route = uiState.scriptedFinishRoute;
  if (Number(route?.plan?.curriculumVersion ?? 0) < 2 || !route?.active || !route.cards) return null;

  const { plan, cards } = route;
  const round = Math.max(0, Number(uiState.round) || 0);
  const targetVp = Math.max(1, Number(plan.victoryTarget) || Number(uiState.victoryTarget) || 15);
  const playerVp = Math.max(0, Number(uiState.playerVp) || 0);
  const progressLabel = `Aquarium reef • ${playerVp}/${targetVp} VP`;
  const help = (details, target, cue) => decorateFinishDuelHelp(withTarget({
    id: FINISH_DUEL_HELP_ID,
    progressLabel,
    ...details,
  }, target, cue), uiState, `academy:${cue}`);
  const play = (card, details = {}) => {
    const result = getScriptedCardPlayHelp(uiState, card, details);
    return result ? Object.freeze({ ...result, progressLabel }) : null;
  };
  const completedAction = (action) => Boolean(
    action && (action.usedThisTurn || ["used", "cooldown"].includes(action.blockType))
  );

  if (playerVp >= targetVp || uiState.gameResult) return null;

  if (uiState.gamePhase === "setup") {
    if (uiState.playingCardId === cards.setup?.cardId) {
      return help({
        title: `Place ${cards.setup.cardName} in Your Reef`,
        message: `We are now focused on Your Reef, where your cards belong. ${cards.setup.cardName} is a Base Coral: a foundation that produces RP and supplies legal creature slots. Its Photosynthesis income is why we begin with a reef rather than a flashy creature.`,
        action: `Select the glowing Place here marker in Your Reef to establish ${cards.setup.cardName}.`,
        targetLabel: "the glowing Place here marker in Your Reef",
        pointerPrompt: `Place ${cards.setup.cardName} on this marker in Your Reef.`,
      }, "placement", "setup-place");
    }
    if (!cards.setup?.inPlay) {
      return play(cards.setup, {
        title: `Welcome—let's begin with ${cards.setup?.cardName ?? "a Base Coral"}`,
        message: `Good to have you here, Reefkeeper. We will build this reef patiently, learn every core card type, and finish with an Apex predator. ${cards.setup?.cardName ?? "This Base Coral"} costs 2 RP and creates the steady economy that makes those later plays possible.`,
        action: `Choose ${cards.setup?.cardName ?? "the highlighted Base Coral"}, press Play Card, then place it in the glowing foundation area.`,
      });
    }
    const layoutLesson = getGuidedAcademyLayoutLessonStep(
      uiState.layoutLessonProgress,
      { foundationName: cards.setup?.cardName ?? "your Base Coral" },
    );
    if (layoutLesson) {
      return withTarget(layoutLesson, layoutLesson.target, layoutLesson.actionId);
    }
    return help({
      title: "Begin the first tide",
      message: "Your first Coral is established. At the start of a round, the Condition changes the rules, your foundations collect RP up to the bank cap, and then you choose which personal deck solves the next part of your plan.",
      action: "Press Begin Round 1 to reveal the Condition and collect RP.",
    }, "turn-button", "setup-begin");
  }

  if (uiState.modal === "turn-draw") {
    const expected = route.expectedDraw;
    const preferredDeck = expected?.deckType === "foundation" ? "Foundation" : "Pals";
    const reasons = {
      1: `${cards.economy?.cardName ?? "Pillar Coral"} is our second foundation. Early Foundation draws improve income and add the spaces future creatures need.`,
      2: `${cards.firstFish?.cardName ?? "Porcupine Fish"} will wait in hand while we use a Support card and establish the remaining Corals.`,
      3: `Coral Reef requires two regular, non-school Fish cards in your ecosystem; it does not require ${cards.secondFish?.cardName ?? "Parrotfish"} specifically. This lesson uses ${cards.firstFish?.cardName ?? "Porcupine Fish"} and ${cards.secondFish?.cardName ?? "Parrotfish"}. Before playing the second Fish, we will practice an Invertebrate action and a Fish attack.`,
      4: `We waited to draw ${cards.predator?.cardName ?? "Great Barracuda"} until I had compatible creatures for it to target and your Coral Reef plan was nearly complete. Now its On Play ability can matter instead of being wasted.`,
      5: `${cards.creatureSchool?.cardName ?? "White Grunt"} comes from the Foundation Deck. Its Creature School supplies 30 School Density, and Severe Coral Bleaching does not stop Eco Foundation from producing 1 RP.`,
      6: `${cards.filterFeeder?.cardName ?? "Whale Shark"} normally needs 180 School Density. Krill Bloom lowers that requirement by 150, so ${cards.creatureSchool?.cardName ?? "White Grunt"}'s 30 meets the remainder and makes this planned 11 VP play legal.`,
      7: `${cards.apexSupport?.cardName ?? "Deep Sea Fishing"} is a Support card that will deliberately find the Apex finisher instead of leaving the last lesson to chance.`,
    };
    return getScriptedFinishDrawHelp(
      { ...uiState, victoryTarget: targetVp },
      preferredDeck,
      reasons[round] ?? "Follow the highlighted authored draw so the aquarium lesson can demonstrate the next mechanic on a known board.",
    );
  }

  if (uiState.modal === "draw-result") {
    const drawn = (uiState.drawnCards ?? []).map((card) => card.name).filter(Boolean).join(" and ") || "the prepared card";
    const lesson = getAcademyDrawResultLesson(round, cards, uiState.drawnCards);
    return help({
      title: `Review ${drawn}`,
      message: lesson.message,
      action: lesson.action,
    }, "continue-actions", `draw-result-${round}-${drawn}`);
  }

  if (uiState.modal === "search" && route.searchTargetCardId) {
    const searched = cardsByIdFallback(cards, route.searchTargetCardId);
    const isApexSearch = route.searchTargetCardId === cards.apex?.cardId;
    return help({
      title: `Search for ${searched?.cardName ?? "the highlighted card"}`,
      message: isApexSearch
        ? `${cards.apexSupport?.cardName ?? "Deep Sea Fishing"} can search a Predator or Apex. We already built the Coral Reef and an Apex slot, so ${searched?.cardName ?? "Hammerhead"} is useful immediately rather than merely impressive in hand.`
        : `${cards.coralSupport?.cardName ?? "Coral Gardener"} searches for a Coral. Choose ${searched?.cardName ?? "Lettuce Coral"}: it becomes our fourth true Coral, improves RP income, and provides another legal home for a creature. Open slots help us build the required community, but empty slots do not count toward Coral Reef's requirement.`,
      action: `Choose the highlighted ${searched?.cardName ?? "lesson card"} to add it to your hand.`,
      targetSearchCardId: route.searchTargetCardId,
    }, "search-card", `search-${route.searchTargetCardId}`);
  }

  if (uiState.attackContext) {
    const sourceId = uiState.activeAttack?.cardId;
    const isApex = sourceId === cards.apex?.cardId;
    const isPredator = sourceId === cards.predator?.cardId;
    return help({
      title: `Resolve ${uiState.activeAttack?.attackName ?? "the attack"}`,
      message: isApex
        ? `${cards.apex?.cardName ?? "The Apex"} is demonstrating an on-play sequence: coral damage followed by two attacks. On-play abilities resolve when the card enters, before you choose another main-phase action.`
        : isPredator
          ? `${cards.predator?.cardName ?? "Great Barracuda"} has a worthwhile target now. Coral Reef grants its second Bite, which is why playing this predator after building the habitat is stronger than leading with it on an empty opposing reef.`
          : `${cards.firstFish?.cardName ?? "Porcupine Fish"}'s Crunch is a paid attack action. Choose the highlighted compatible Invertebrate; the simulator will compare your attack die with its defense die.`,
      action: "Choose a glowing legal creature in my reef, then resolve the faceoff dice.",
    }, "opponent-board", `attack-${sourceId ?? "active"}`);
  }

  // Older saved lessons may have advanced past Round 6 while Whale Shark was
  // incorrectly blocked by its alternative Habitat requirement. Recover that
  // missing 11 VP before allowing the authored Apex finish to dead-end.
  if (round > 6 && !cards.filterFeeder?.inPlay && (cards.filterFeeder?.inHand || cards.filterFeeder?.inPalsDeck)) {
    const delayedFilterFeederHelp = play(cards.filterFeeder, {
      title: `Complete the delayed ${cards.filterFeeder.cardName} lesson`,
      message: `${cards.filterFeeder.cardName} is the missing ${cards.filterFeeder.victoryPoints} VP step. Coral Reef satisfies its Habitat rule, White Grunt supplies 30 School Density, and Krill Bloom's unused reduction supplies the remaining 150.`,
      action: `Choose ${cards.filterFeeder.cardName}, press Play Card, and let it enter open water automatically.`,
    });
    if (delayedFilterFeederHelp) return delayedFilterFeederHelp;

    const availableRp = Math.max(0, Number(uiState.availableRp) || 0);
    const requiredRp = Math.max(0, Number(cards.filterFeeder.cost) || 0);
    if (cards.filterFeeder.inHand && /not enough rp/i.test(cards.filterFeeder.playError ?? "")) {
      return help({
        title: `Bank RP for ${cards.filterFeeder.cardName}`,
        message: `Hammerhead's Ravage is complete, but ${cards.filterFeeder.cardName} is still in your hand, so its ${cards.filterFeeder.victoryPoints} VP have not joined the reef. It costs ${requiredRp} RP and you have ${availableRp}. Coral Reef and the unused Krill Bloom reduction already satisfy its other requirements.`,
        action: `Press End Turn to refill your RP bank. I will return to ${cards.filterFeeder.cardName} before the lesson can finish.`,
      }, "turn-button", "recover-filter-feeder-rp");
    }

    if (cards.filterFeeder.inPalsDeck) {
      return help({
        title: `Return to the ${cards.filterFeeder.cardName} lesson`,
        message: `${cards.filterFeeder.cardName} is still in the Pals Deck, so the reef is missing its planned ${cards.filterFeeder.victoryPoints} VP Filter Feeder step.`,
        action: `Press End Turn, then draw from the Pals Deck next round so we can play ${cards.filterFeeder.cardName}.`,
      }, "turn-button", "recover-filter-feeder-draw");
    }
  }

  if (round === 1) {
    if (!cards.economy?.inPlay) {
      return play(cards.economy, {
        title: `Build the economy with ${cards.economy?.cardName ?? "Pillar Coral"}`,
        message: `This is the early-game habit I want you to keep: strengthen RP income and legal play spaces before chasing VP. ${cards.economy?.cardName ?? "Pillar Coral"} also provides the Predator slot we will use only after the opposing reef offers a meaningful target.`,
        placementMessage: `${cards.economy?.cardName ?? "Pillar Coral"} is a second foundation, not an upgrade to the first one. Put it in the separate glowing open-water marker beside ${cards.setup?.cardName ?? "your first Coral"}, rather than covering that card or its slots.`,
      });
    }
    return help({
      title: "End the turn to grow your RP budget",
      message: "Your opening turn is complete. Both Corals can produce RP next round. Save the RP that remains instead of spending it on a card that does not support the plan.",
      action: "Press End Turn. In Round 2, play a Support card and establish two more Corals.",
    }, "turn-button", "end-round-1");
  }

  if (round === 2) {
    if (!cards.coralSupport?.inDiscard) {
      return play(cards.coralSupport, {
        title: `Use your first Support: ${cards.coralSupport?.cardName ?? "Coral Gardener"}`,
        message: `Support cards are one-shot tactical effects. They do not occupy a reef slot or add VP; after resolving, they go to the discard pile. ${cards.coralSupport?.cardName ?? "Coral Gardener"} searches for the exact Coral our long-term plan needs, and its text prevents another Support this turn.`,
        action: `Choose ${cards.coralSupport?.cardName ?? "Coral Gardener"}, press Play Card, then select the highlighted Coral in the search results.`,
      });
    }
    if (!cards.coralBase?.inPlay) {
      return play(cards.coralBase, {
        title: `Establish ${cards.coralBase?.cardName ?? "Brain Coral"}`,
        message: `This Base Coral is more than income. Its upgrade line eventually creates the Apex slot. We are placing the base early because a Coral must survive a full turn before it can advance to its next stage.`,
      });
    }
    if (!cards.searchedCoral?.inPlay) {
      return play(cards.searchedCoral, {
        title: `Complete the four-Coral base with ${cards.searchedCoral?.cardName ?? "Lettuce Coral"}`,
        message: `This is your fourth true Coral, completing the Coral portion of Coral Reef's requirement. The four Corals also provide RP and legal homes for the two Fish and two Invertebrates we still need. Remember: available slots make those placements possible, but the creatures themselves satisfy the requirement.`,
      });
    }
    return help({
      title: "The reef has room to grow",
      message: `You used a Support card and built four Corals. Keep ${cards.firstFish?.cardName ?? "Porcupine Fish"} in hand until the next RP collection can pay for the creatures, an action, an attack, and a Coral upgrade during the same planned turn.`,
      action: "Press End Turn to collect the larger RP budget for Round 3.",
    }, "turn-button", "end-round-2");
  }

  if (round === 3) {
    if (!cards.bankBoost?.inPlay) {
      return play(cards.bankBoost, {
        title: `Learn a passive with ${cards.bankBoost?.cardName ?? "Arrow Crab"}`,
        message: `This Invertebrate's Eco Boost is passive: it works continuously while the card remains in play and raises your RP bank cap. Passive abilities do not need an action button or an extra payment.`,
      });
    }
    if (!cards.utility?.inPlay) {
      return play(cards.utility, {
        title: `Add ${cards.utility?.cardName ?? "Nudibranch"}`,
        message: `This is your second Invertebrate for Coral Reef. Unlike a passive, its Munch text is an action you choose during the action phase. We will use it once so you can see that card actions and attacks are different systems.`,
      });
    }
    if (!cards.firstFish?.inPlay) {
      return play(cards.firstFish, {
        title: `Add your first Fish: ${cards.firstFish?.cardName ?? "Porcupine Fish"}`,
        message: `Fish occupy Fish slots and can contribute to Habitat requirements. ${cards.firstFish?.cardName ?? "Porcupine Fish"} also has Toxic and Crunch: Toxic matters if another creature eats it, while Crunch is a paid attack action. A Sea Urchin is waiting in my reef, so Crunch will have a legal target when you are ready to attack.`,
      });
    }
    if (!completedAction(route.utilityAction)) {
      if (uiState.inspectedUtilityAction?.cardId === cards.utility?.cardId) {
        return help({
          title: "Use Munch as a card action",
          message: "Munch costs 0 RP and flips a coin. On heads you choose an opposing Coral to reduce its next RP production; on tails the action simply has no effect. Either result teaches that an action can be useful without being an attack.",
          action: "Press Use Munch (0 RP), then follow the coin result.",
          targetActionKey: route.utilityAction?.utilityActionKey,
        }, "utility-action-button", "munch-button");
      }
      return help({
        title: `Inspect ${cards.utility?.cardName ?? "Nudibranch"}'s action`,
        message: "Select the Invertebrate in your ecosystem. Its detail panel separates passive abilities, on-play abilities, actions, and attacks so you can tell when and how each kind of text is used.",
        action: `Select ${cards.utility?.cardName ?? "Nudibranch"}, then press Use Munch.`,
        targetActionKey: route.utilityAction?.actionKey,
      }, "player-board", "munch-card");
    }
    if (!completedAction(route.attackAction)) {
      if (uiState.inspectedAttack?.cardId === cards.firstFish?.cardId) {
        return help({
          title: "Use Crunch as an attack",
          message: "Crunch costs 1 RP, targets an opposing Invertebrate, and starts an attack-versus-defense faceoff. The dice create uncertainty, but choosing a legal target and preserving the action cost are decisions you control.",
          action: "Press Use Crunch, choose Sea Urchin, then resolve the faceoff.",
          targetActionKey: route.attackAction?.actionKey,
        }, "attack-button", "crunch-button");
      }
      return help({
        title: `Attack with ${cards.firstFish?.cardName ?? "Porcupine Fish"}`,
        message: `Now compare the earlier card action with combat. Select ${cards.firstFish?.cardName ?? "Porcupine Fish"}; the simulator will only glow targets that Crunch is allowed to challenge.`,
        action: `Select ${cards.firstFish?.cardName ?? "Porcupine Fish"}, then use Crunch on Sea Urchin.`,
        targetActionKey: route.attackAction?.actionKey,
      }, "player-board", "crunch-card");
    }
    if (!cards.coralStageOne?.inPlay) {
      return play(cards.coralStageOne, {
        title: `Upgrade to ${cards.coralStageOne?.cardName ?? "Brain Coral Stage 1"}`,
        message: "Coral upgrades replace the earlier stage while preserving its position and surviving attached creatures. Brain Coral has now been in play for a full turn, so its first upgrade is legal and increases both income and future slot quality.",
        placementMessage: `Choose the highlighted ${cards.coralBase?.cardName ?? "Brain Coral"} to advance it to Stage 1.`,
      });
    }
    return help({
      title: "A complete action-phase lesson",
      message: "This turn added both creature counts required by the Habitat plan, demonstrated a passive, resolved a non-attack action, made a legal attack, and advanced a Coral. Save the remaining RP for the next part of the plan.",
      action: "Press End Turn. In Round 4, build the Coral Reef Habitat, then play a Predator.",
    }, "turn-button", "end-round-3");
  }

  if (round === 4) {
    if (!cards.secondFish?.inPlay) {
      return play(cards.secondFish, {
        title: `Complete the Fish count with ${cards.secondFish?.cardName ?? "Parrotfish"}`,
        message: `Playing ${cards.secondFish?.cardName ?? "Parrotfish"} gives this reef its second Fish. Coral Reef does not require a particular Fish species: any two non-school Fish count, alongside four true Corals and two non-school Invertebrates. Eat is an On Play ability, so it resolves immediately after legal placement.`,
      });
    }
    if (!cards.habitat?.inPlay) {
      return play(cards.habitat, {
        title: `Create the ${cards.habitat?.cardName ?? "Coral Reef"} Habitat`,
        message: "Habitats sit in their own reef zone and can unlock relationships or other card requirements. Coral Reef costs 0 RP, but you may play it only while you have four true Corals, two non-school Fish, and two non-school Invertebrates. If that composition later breaks, Coral Reef takes 10 damage at the end of each of your turns until the requirement is restored.",
      });
    }
    if (!cards.coralStageTwo?.inPlay) {
      return play(cards.coralStageTwo, {
        title: `Open an Apex slot with ${cards.coralStageTwo?.cardName ?? "Brain Coral Stage 2"}`,
        message: "This expensive upgrade is the structural payoff of the early economy. Stage 2 creates the Apex slot Hammerhead will require in the final round, so the play advances a specific plan instead of spending RP merely because it is available.",
        placementMessage: `Choose the highlighted ${cards.coralStageOne?.cardName ?? "Brain Coral Stage 1"} to advance it to Stage 2.`,
      });
    }
    if (!cards.predator?.inPlay) {
      return play(cards.predator, {
        title: `Play ${cards.predator?.cardName ?? "Great Barracuda"} when its ability matters`,
        message: `This is the right time for the Predator. My reef now has legal Fish and Predator targets, Coral Reef grants Quick Strike a second Bite, and Murky Water lowers the printed cost from 3 RP to 2. Playing it earlier—before the targets and Habitat were ready—would have wasted much of its On Play ability and slowed your economy.`,
        action: `Play ${cards.predator?.cardName ?? "Great Barracuda"} in Pillar Coral's Predator slot, then resolve both legal Bites.`,
      });
    }
    return help({
      title: "The food web is ready for an Apex",
      message: `Your reef is now worth ${playerVp} VP, but more importantly it has an economy, a balanced community, a Habitat, and an Apex slot. Before the finisher, we will learn how Creature Schools support the largest animals in the food web.`,
      action: "Press End Turn. In Round 5, build your first Creature School.",
    }, "turn-button", "end-round-4");
  }

  if (round === 5) {
    if (!cards.creatureSchool?.inPlay) {
      return play(cards.creatureSchool, {
        title: `Establish a Creature School with ${cards.creatureSchool?.cardName ?? "White Grunt"}`,
        message: `Creature Schools are played in the foundation area. They have HP and can be attacked, and each one adds a School Density bucket for larger ocean animals. ${cards.creatureSchool?.cardName ?? "White Grunt"} adds 30 capacity. A creature commits its requirement while it remains in play, and that space opens again when it leaves. Eco Foundation also adds 1 RP on future turns. Although White Grunt represents a school of fish, Creature Schools do not count toward Coral Reef's two-Fish requirement.`,
        action: `Choose ${cards.creatureSchool?.cardName ?? "White Grunt"}, press Play Card, then place it in the highlighted foundation area.`,
        placementMessage: `Place ${cards.creatureSchool?.cardName ?? "White Grunt"} in the highlighted foundation area. Its 30 School Density will make next round's Filter Feeder legal, and its Eco Foundation can collect 1 RP on later turns.`,
      });
    }
    return help({
      title: "School Density is now part of the plan",
      message: `${cards.creatureSchool?.cardName ?? "White Grunt"} shows why foundations are not limited to Corals. Its meter now has 30 open School Density. Playing a qualifying animal fills that capacity like a bucket; adding or upgrading Schools makes the bucket larger.`,
      action: "Press End Turn. In Round 6, Krill Bloom lowers the requirement so you can play a Filter Feeder.",
    }, "turn-button", "end-round-5");
  }

  if (round === 6) {
    if (!cards.filterFeeder?.inPlay) {
      return play(cards.filterFeeder, {
        title: `Use School Density to welcome ${cards.filterFeeder?.cardName ?? "Whale Shark"}`,
        message: `${cards.filterFeeder?.cardName ?? "Whale Shark"} normally requires 180 School Density. Krill Bloom lowers the next Filter Feeder requirement by 150, so ${cards.creatureSchool?.cardName ?? "White Grunt"}'s 30 open points are committed. That fills the current Density bucket. Coral Reef meets the separate Habitat requirement.`,
        action: `Choose ${cards.filterFeeder?.cardName ?? "Whale Shark"} and press Play Card. As an Ocean creature, it enters open water automatically; then review the confirmation.`,
      });
    }
    return help({
      title: `${playerVp} / ${targetVp} VP — One Final Round Remains`,
      message: `${cards.filterFeeder?.cardName ?? "Whale Shark"} is the 20 VP milestone, not the end of the lesson. It demonstrates the full chain: a Creature School supplies School Density, a Habitat satisfies the ecological requirement, and a well-timed Condition makes the play legal. One final round remains: ${cards.apexSupport?.cardName ?? "Deep Sea Fishing"} finds ${cards.apex?.cardName ?? "Hammerhead"}, whose ${Math.max(0, Number(cards.apex?.victoryPoints) || 6)} VP completes the ${targetVp} VP reef.`,
      action: `Press End Turn to begin the final round. Draw and play ${cards.apexSupport?.cardName ?? "Deep Sea Fishing"}, choose ${cards.apex?.cardName ?? "Hammerhead"}, then play it in the Apex slot.`,
    }, "turn-button", "end-round-6");
  }

  if (round >= 7) {
    if (!cards.apexSupport?.inDiscard && !cards.apex?.inHand && !cards.apex?.inPlay) {
      return play(cards.apexSupport, {
        title: `Final Round: Search with ${cards.apexSupport?.cardName ?? "Deep Sea Fishing"}`,
        message: `Your reef is at ${playerVp}/${targetVp} VP, and this is the final round. ${cards.apexSupport?.cardName ?? "Deep Sea Fishing"} is a zero-cost, one-shot Support that searches for a Predator or Apex and then goes to the discard pile. Before searching, check that the result will be playable: Coral Reef satisfies Hammerhead's Habitat requirement, Brain Coral provides the Apex slot, and even Bleak Overcast leaves exactly the 6 RP we need.`,
        action: `Play ${cards.apexSupport?.cardName ?? "Deep Sea Fishing"}, then choose the highlighted Hammerhead.`,
      });
    }
    if (!cards.apex?.inPlay) {
      return play(cards.apex, {
        title: `Finish the lesson with ${cards.apex?.cardName ?? "Hammerhead"}`,
        message: "Apex creatures are powerful finishers with demanding prerequisites, so they belong at the end of a plan rather than the beginning. Hammerhead is good here because the reef already supports it: Coral Reef is active, an Apex slot is open, there is enough RP, and I have legal targets for Ravage.",
        action: `Play ${cards.apex?.cardName ?? "Hammerhead"} in the highlighted Apex slot, then resolve its coral damage and two attacks to reach ${targetVp} of ${targetVp} VP. The Aquarium Lesson Complete dialog will give you a Finish Lesson & Return button.`,
      });
    }
  }

  return help({
    title: "Return to the authored lesson step",
    message: "The prepared card is still available, but another panel or unresolved effect is covering it. Finish the open interaction and I will point to the next exact move.",
    action: "Close the current panel or resolve the highlighted effect to continue.",
  }, "close-modal", `recover-${round}`);
}

function cardsByIdFallback(cards, cardId) {
  return Object.values(cards ?? {}).find((card) => card?.cardId === cardId) ?? null;
}

function getLegacyScriptedFinishDuelHelp(uiState) {
  const route = uiState.scriptedFinishRoute;
  if (!route?.active || !route.plan || !route.cards) return null;
  const { plan, cards } = route;
  const round = Math.max(0, Number(uiState.round) || 0);

  if (uiState.modal === "turn-draw") {
    if (!cards.economy.inPlay) {
      return getScriptedFinishDrawHelp(
        uiState,
        "Foundation",
        `${cards.economy.cardName} is the economy card that makes every later RP total work.`,
      );
    }
    if (!cards.utility.inPlay) {
      return getScriptedFinishDrawHelp(
        uiState,
        "Pals",
        `${cards.utility.cardName} is prepared on top so we can learn its Scavenge action.`,
      );
    }
    return getScriptedFinishDrawHelp(
      uiState,
      "Foundation",
      round === 3
        ? `Keep ${cards.finishSearch.cardName} inside the Pals Deck so ${cards.utility.cardName} can search for it deliberately this round.`
        : `${cards.finishSearch.cardName} and ${cards.heldFinish.cardName} are already reserved for the finish, so draw from the Foundation Deck without disturbing that pair.`,
    );
  }

  if (uiState.modal === "draw-result") {
    const nextAction = !cards.economy.inPlay
      ? `play ${cards.economy.cardName}`
      : !cards.utility.inPlay
        ? `play ${cards.utility.cardName}`
        : round === 3 && !cards.finishSearch.inHand && !cards.finishSearch.inPlay
          ? `use ${cards.utility.cardName}'s Scavenge to find ${cards.finishSearch.cardName}`
          : `continue to the final build with ${cards.finishSearch.cardName}`;
    return decorateFinishDuelHelp(withTarget({
      id: FINISH_DUEL_HELP_ID,
      title: "Review the prepared draw",
      message: "Read the revealed card, then return to the reef. The draw is information; the planned action still comes next.",
      action: `Press Continue to Actions, then ${nextAction}.`,
    }, "continue-actions", `scripted-draw-result:${round}:${nextAction}`), uiState, `scripted-draw-result:${round}:${nextAction}`);
  }

  if (uiState.attackContext) {
    const isFinishAttack = uiState.activeAttack?.cardId === plan.finishSearchCardId;
    const targetName = isFinishAttack ? "Frogfish" : "Sea Urchin";
    return decorateFinishDuelHelp(withTarget({
      id: FINISH_DUEL_HELP_ID,
      title: `Finish ${uiState.activeAttack?.attackName ?? "the attack"}`,
      message: isFinishAttack
        ? `${cards.finishSearch.cardName}'s on-play attack is part of the final lesson. I kept Frogfish available as its compatible target.`
        : `${cards.attack.cardName} is attacking the Sea Urchin prepared for the Crunch lesson.`,
      action: `Choose the glowing ${targetName}, then resolve the faceoff.`,
    }, "opponent-board", `scripted-attack-target:${uiState.activeAttack?.cardId ?? "card"}`), uiState, `scripted-attack-target:${uiState.activeAttack?.cardId ?? "card"}`);
  }

  if (!cards.economy.inPlay) {
    return getScriptedCardPlayHelp(uiState, cards.economy, {
      title: `Build the economy with ${cards.economy.cardName}`,
      message: `${cards.economy.cardName} is legal for ${cards.economy.cost} RP and adds the income and Predator slot required by the prepared finish.`,
    });
  }

  if (round <= 1 && !cards.utility.inPlay) {
    return decorateFinishDuelHelp(withTarget({
      id: FINISH_DUEL_HELP_ID,
      title: "Let the economy collect once",
      message: `${cards.economy.cardName} is in place. End this turn so both foundations can collect before the Scavenge lesson.`,
      action: `Press End Turn. In Round 2, draw one card from the Pals Deck to reveal ${cards.utility.cardName}.`,
    }, "turn-button", "scripted-end-round-one"), uiState, "scripted-end-round-one");
  }

  if (!cards.utility.inPlay) {
    return getScriptedCardPlayHelp(uiState, cards.utility, {
      title: `Play ${cards.utility.cardName}`,
      message: `${cards.utility.cardName} costs ${cards.utility.cost} RP. Its Scavenge action will turn two expendable cards into the exact attacker this board needs.`,
    });
  }

  if (!cards.attack.inPlay) {
    if (cards.attack.inHand || cards.attack.isPlaying) {
      return getScriptedCardPlayHelp(uiState, cards.attack, {
        title: `Play ${cards.attack.cardName}`,
        message: `${cards.attack.cardName} costs ${cards.attack.cost} RP, and its Crunch action needs ${Math.max(0, Number(route.attackAction?.attackCost ?? 0))} more RP. The prepared Sea Urchin is a legal target.`,
        action: `Press Play Card, place ${cards.attack.cardName}, then use Crunch on Sea Urchin.`,
      });
    }
    if (route.utilityAction?.ready) {
      if (uiState.inspectedUtilityAction?.ready && uiState.inspectedUtilityAction.cardId === plan.utilityCardId) {
        return decorateFinishDuelHelp(withTarget({
          id: FINISH_DUEL_HELP_ID,
          title: "Use Scavenge for a planned attacker",
          message: `${cards.utility.cardName}'s Scavenge is ready for ${route.utilityAction.actionCost} RP. The next prompts will highlight two safe discards and ${cards.attack.cardName}.`,
          action: `Press Use Scavenge (${route.utilityAction.actionCost} RP), then follow the highlighted discard and search choices.`,
          targetActionKey: route.utilityAction.utilityActionKey,
          targetLabel: `Scavenge on ${cards.utility.cardName}`,
        }, "utility-action-button", "scripted-first-scavenge-button"), uiState, "scripted-first-scavenge-button");
      }
      if (uiState.inspectedCardOpen || uiState.handPopoverOpen || uiState.modal === "hand") {
        return decorateFinishDuelHelp(withTarget({
          id: FINISH_DUEL_HELP_ID,
          title: `Return to ${cards.utility.cardName}`,
          message: `${cards.utility.cardName} is already in play and ready to Scavenge. Another card is not required first.`,
          action: `Close this view, select ${cards.utility.cardName}, then use Scavenge.`,
        }, "close-modal", "scripted-first-scavenge-close"), uiState, "scripted-first-scavenge-close");
      }
      return decorateFinishDuelHelp(withTarget({
        id: FINISH_DUEL_HELP_ID,
        title: `Use ${cards.utility.cardName}'s Scavenge`,
        message: `Scavenge costs ${route.utilityAction.actionCost} RP and searches either personal deck after two safe discards. We will use it to choose ${cards.attack.cardName}, not rely on a random draw.`,
        action: `Select ${cards.utility.cardName}, then press Use Scavenge (${route.utilityAction.actionCost} RP).`,
        targetActionKey: route.utilityAction.actionKey,
        targetLabel: `${cards.utility.cardName} in your ecosystem`,
      }, "player-board", "scripted-first-scavenge"), uiState, "scripted-first-scavenge");
    }
    return null;
  }

  if (route.attackAction?.ready && route.attackTargetInPlay) {
    if (uiState.inspectedAttack?.ready && uiState.inspectedAttack.cardId === plan.attackCardId) {
      return decorateFinishDuelHelp(withTarget({
        id: FINISH_DUEL_HELP_ID,
        title: "Use Crunch on Sea Urchin",
        message: `${cards.attack.cardName}'s Crunch is ready and Sea Urchin is the compatible target prepared for this lesson.`,
        action: "Press Use Crunch, choose Sea Urchin, then resolve the faceoff.",
        targetActionKey: route.attackAction.actionKey,
        targetLabel: `Crunch on ${cards.attack.cardName}`,
      }, "attack-button", "scripted-crunch-button"), uiState, "scripted-crunch-button");
    }
    return decorateFinishDuelHelp(withTarget({
      id: FINISH_DUEL_HELP_ID,
      title: `Attack with ${cards.attack.cardName}`,
      message: `${cards.attack.cardName} is in place with enough RP for Crunch. Complete the attack before banking for the final cards.`,
      action: `Select ${cards.attack.cardName}, then use Crunch on Sea Urchin.`,
      targetActionKey: route.attackAction.actionKey,
      targetLabel: `${cards.attack.cardName} in your ecosystem`,
    }, "player-board", "scripted-crunch"), uiState, "scripted-crunch");
  }

  if (round <= 2) {
    return decorateFinishDuelHelp(withTarget({
      id: FINISH_DUEL_HELP_ID,
      title: "Bank the next collection for the finish",
      message: `The attack lesson is complete at ${Math.max(0, Number(uiState.playerVp) || 0)} VP. End the turn so Round 3 can use Scavenge once more without sacrificing ${cards.heldFinish.cardName}.`,
      action: "Press End Turn. In Round 3, draw one card from the Foundation Deck before using Scavenge again.",
    }, "turn-button", "scripted-end-round-two"), uiState, "scripted-end-round-two");
  }

  if (round === 3 && !cards.finishSearch.inHand && !cards.finishSearch.inPlay) {
    if (route.utilityAction?.ready) {
      if (uiState.inspectedUtilityAction?.ready && uiState.inspectedUtilityAction.cardId === plan.utilityCardId) {
        return decorateFinishDuelHelp(withTarget({
          id: FINISH_DUEL_HELP_ID,
          title: `Scavenge for ${cards.finishSearch.cardName}`,
          message: `This second Scavenge spends ${route.utilityAction.actionCost} RP now so the final Predator is guaranteed in hand. The discard prompt will protect ${cards.heldFinish.cardName}.`,
          action: `Press Use Scavenge (${route.utilityAction.actionCost} RP), choose the highlighted safe discards, then select ${cards.finishSearch.cardName}.`,
          targetActionKey: route.utilityAction.utilityActionKey,
          targetLabel: `Scavenge on ${cards.utility.cardName}`,
        }, "utility-action-button", "scripted-second-scavenge-button"), uiState, "scripted-second-scavenge-button");
      }
      if (uiState.inspectedCardOpen || uiState.handPopoverOpen || uiState.modal === "hand") {
        return decorateFinishDuelHelp(withTarget({
          id: FINISH_DUEL_HELP_ID,
          title: `Return to ${cards.utility.cardName}`,
          message: `The Round 3 action is already on the board: ${cards.utility.cardName} can Scavenge for ${cards.finishSearch.cardName}.`,
          action: `Close this view, select ${cards.utility.cardName}, and use Scavenge.`,
        }, "close-modal", "scripted-second-scavenge-close"), uiState, "scripted-second-scavenge-close");
      }
      return decorateFinishDuelHelp(withTarget({
        id: FINISH_DUEL_HELP_ID,
        title: `Search for ${cards.finishSearch.cardName}`,
        message: `You have ${Math.max(0, Number(uiState.availableRp) || 0)} RP. Spend ${route.utilityAction.actionCost} on a second Scavenge, preserve ${cards.heldFinish.cardName}, and bank what remains for Murky Water.`,
        action: `Select ${cards.utility.cardName}, press Use Scavenge (${route.utilityAction.actionCost} RP), then follow the highlighted choices.`,
        targetActionKey: route.utilityAction.actionKey,
        targetLabel: `${cards.utility.cardName} in your ecosystem`,
      }, "player-board", "scripted-second-scavenge"), uiState, "scripted-second-scavenge");
    }
    return null;
  }

  if (round === 3 && cards.finishSearch.inHand) {
    return decorateFinishDuelHelp(withTarget({
      id: FINISH_DUEL_HELP_ID,
      title: "Protect the two-card finish",
      message: `${cards.finishSearch.cardName} and ${cards.heldFinish.cardName} are now together in your hand. Keep the remaining ${Math.max(0, Number(uiState.availableRp) || 0)} RP; Murky Water will discount the Predator next round.`,
      action: `Press End Turn. In Round ${plan.finishRound}, draw one card from the Foundation Deck, then play ${cards.finishSearch.cardName} before ${cards.heldFinish.cardName}.`,
    }, "turn-button", "scripted-bank-finish"), uiState, "scripted-bank-finish");
  }

  if (round === Number(plan.finishRound) && route.activeConditionId === "murky-water") {
    if (!cards.finishSearch.inPlay) {
      return getScriptedCardPlayHelp(uiState, cards.finishSearch, {
        title: `Use Murky Water: play ${cards.finishSearch.cardName}`,
        message: `Murky Water reduces this Predator from ${cards.finishSearch.printedCost} RP to ${cards.finishSearch.cost} RP. Its ${cards.finishSearch.victoryPoints} VP and on-play attack come first, leaving exactly enough RP for ${cards.heldFinish.cardName}.`,
        action: `Press Play Card, place ${cards.finishSearch.cardName} in the open Predator slot, then resolve its attack against Frogfish.`,
        placementMessage: `Place ${cards.finishSearch.cardName} in the highlighted Predator slot on ${cards.economy.cardName}. Its On Play attack resolves immediately afterward.`,
      });
    }
    if (!cards.heldFinish.inPlay) {
      return getScriptedCardPlayHelp(uiState, cards.heldFinish, {
        title: `Finish with ${cards.heldFinish.cardName}`,
        message: `${cards.finishSearch.cardName} has raised the reef to ${Math.max(0, Number(uiState.playerVp) || 0)} VP. ${cards.heldFinish.cardName} costs the remaining ${cards.heldFinish.cost} RP and contributes the final ${cards.heldFinish.victoryPoints} VP.`,
        action: `Press Play Card and place ${cards.heldFinish.cardName} in the open Invertebrate slot to reach ${plan.victoryTarget} VP.`,
        placementMessage: `Place ${cards.heldFinish.cardName} in the highlighted Invertebrate slot. This final legal placement completes the ${plan.victoryTarget} VP reef.`,
      });
    }
  }

  return null;
}

function getScriptedFinishDuelHelp(uiState) {
  return getAcademyCurriculumHelp(uiState) ?? getLegacyScriptedFinishDuelHelp(uiState);
}

function getFinishDuelHelp(uiState) {
  if (uiState.victoryPending !== true) return null;
  const context = finishDuelContext(uiState);
  if (context.playerVp >= context.targetVp) return null;

  if (uiState.gamePhase === "setup") {
    if (uiState.playingCardId) {
      const foundationName = uiState.playingCardName ?? "your starting foundation";
      return decorateFinishDuelHelp(withTarget({
        id: FINISH_DUEL_HELP_ID,
        title: `Place ${foundationName} in Your Reef`,
        message: `We are now focused on Your Reef. This practice board needs its first legal foundation before we can continue toward the ${context.targetVp} VP goal.`,
        action: `Select a glowing Place here marker in Your Reef to establish ${foundationName}.`,
        targetLabel: "a glowing Place here marker in Your Reef",
      }, "placement", "setup:placement"), uiState, `setup:placement:${uiState.playingCardId}`);
    }
    if (!uiState.hasCoralInPlay) {
      const setupCardId = String(uiState.scriptedSetupCardId ?? "").trim();
      const setupCardName = String(uiState.scriptedSetupCardName ?? "a Base Coral or Creature School");
      const selected = Boolean(
        uiState.selectedHandCard
        && (!setupCardId || uiState.selectedHandCard === setupCardId)
        && (uiState.modal === "hand" || uiState.handPopoverOpen)
      );
      return decorateFinishDuelHelp(withTarget({
        id: FINISH_DUEL_HELP_ID,
        title: `Rebuild with ${setupCardName}`,
        message: "Your saved lesson evidence is safe. This fresh practice board only needs a foundation before I can guide you through the rest of the duel.",
        action: selected
          ? `Press Play Card, then place ${setupCardName} in the highlighted area.`
          : `Choose the glowing ${setupCardName} in your hand, then press Play Card.`,
        targetCardId: setupCardId || null,
        targetLabel: setupCardId ? `${setupCardName} in your hand` : null,
      }, selected ? "play-card" : "hand", selected ? "setup:play" : "setup:hand"), uiState, selected ? "setup:play" : "setup:hand");
    }
    return decorateFinishDuelHelp(withTarget({
      id: FINISH_DUEL_HELP_ID,
      title: "Begin the practice round",
      message: "Your new foundation is ready. Begin the round to collect RP and resume the guided race to the VP target.",
      action: uiState.modal === "hand" || uiState.handPopoverOpen
        ? "Close your hand, then press Begin Round 1."
        : "Press Begin Round 1 to collect RP and draw.",
    }, "turn-button", "setup:begin"), uiState, "setup:begin");
  }

  const blockingModalHelp = getFinishBlockingModalHelp(uiState);
  if (blockingModalHelp) return blockingModalHelp;

  const scriptedFinishHelp = getScriptedFinishDuelHelp(uiState);
  if (scriptedFinishHelp) return scriptedFinishHelp;

  if (uiState.modal === "turn-draw") return getFinishDuelDrawHelp(uiState);
  if (uiState.modal === "draw-result") {
    const resultHelp = getDrawResultHelp(FINISH_DUEL_HELP_ID, uiState);
    return decorateFinishDuelHelp(resultHelp, uiState, `draw-result:${(uiState.drawnCards ?? []).map((card) => card.cardId).join(",") || "empty"}`);
  }
  if (uiState.playingCardId) {
    const cardName = uiState.playingCardName ?? "the selected card";
    return decorateFinishDuelHelp(withTarget({
      id: FINISH_DUEL_HELP_ID,
      title: `Place ${cardName}`,
      message: `${cardName} has left your hand, but its VP will not count until you finish a legal placement.`,
      action: "Choose one of the glowing legal placement areas in your ecosystem.",
    }, "placement", `placement:${uiState.playingCardId}`), uiState, `placement:${uiState.playingCardId}`);
  }

  const vpBuild = uiState.recommendedVpBuildCard ?? null;
  const fallbackBuild = uiState.recommendedBuildCard ?? null;
  const selectedCardOpen = Boolean(
    uiState.selectedHandCard && (uiState.modal === "hand" || uiState.handPopoverOpen)
  );
  if (selectedCardOpen) {
    const selectedName = uiState.selectedCardName ?? "This card";
    const selectedIsVpBuild = vpBuild?.cardId === uiState.selectedHandCard;
    const selectedIsFallbackBuild = !vpBuild && fallbackBuild?.cardId === uiState.selectedHandCard;
    if (uiState.selectedCardPlayError) {
      const recommendation = vpBuild ?? fallbackBuild;
      return decorateFinishDuelHelp(withTarget({
        id: FINISH_DUEL_HELP_ID,
        title: `${selectedName} is not playable yet`,
        message: `${uiState.selectedCardPlayError} ${recommendation ? `${recommendation.cardName} is legal right now.` : "We need another collection or draw before building again."}`,
        action: uiState.handPopoverOpen
          ? recommendation
            ? `Close these details, then choose ${recommendation.cardName}.`
            : "Close these details, check any remaining actions, then end the turn."
          : recommendation
            ? `Choose the glowing ${recommendation.cardName} instead.`
            : "Close your hand, check any remaining actions, then end the turn.",
        targetCardId: !uiState.handPopoverOpen ? recommendation?.cardId ?? null : null,
        targetLabel: !uiState.handPopoverOpen && recommendation ? `${recommendation.cardName} in your hand` : null,
      }, uiState.handPopoverOpen ? "close-modal" : recommendation ? "hand" : "close-modal", `selected-blocked:${uiState.selectedHandCard}:${recommendation?.cardId ?? "none"}`), uiState, `selected-blocked:${uiState.selectedHandCard}:${recommendation?.cardId ?? "none"}`);
    }
    if (selectedIsVpBuild || selectedIsFallbackBuild || (!vpBuild && !fallbackBuild)) {
      const cardVp = Math.max(0, Number(uiState.selectedCardVictoryPoints) || 0);
      return decorateFinishDuelHelp(withTarget({
        id: FINISH_DUEL_HELP_ID,
        title: cardVp > 0 ? `Play ${selectedName} for ${cardVp} VP` : `Play ${selectedName}`,
        message: cardVp > 0
          ? `${selectedName} is legal now and moves your ecosystem from ${context.playerVp} VP toward the ${context.targetVp} VP goal.`
          : `${selectedName} is legal now and can strengthen the ecosystem supporting your remaining ${context.remainingVp} VP.`,
        action: "Press Play Card, then follow the highlighted placement or effect prompt.",
      }, "play-card", `selected:${uiState.selectedHandCard}`), uiState, `selected:${uiState.selectedHandCard}`);
    }
    const recommendation = vpBuild ?? fallbackBuild;
    return decorateFinishDuelHelp(withTarget({
      id: FINISH_DUEL_HELP_ID,
      title: `Choose ${recommendation.cardName}`,
      message: `${recommendation.cardName} is the stronger guided build because it is legal now${Number(recommendation.victoryPoints ?? 0) > 0 ? ` and adds ${Number(recommendation.victoryPoints)} VP` : " and improves your ecosystem"}.`,
      action: uiState.handPopoverOpen
        ? `Close these details, then choose ${recommendation.cardName}.`
        : `Choose the glowing ${recommendation.cardName}, then press Play Card.`,
      targetCardId: uiState.handPopoverOpen ? null : recommendation.cardId,
      targetLabel: uiState.handPopoverOpen ? null : `${recommendation.cardName} in your hand`,
    }, uiState.handPopoverOpen ? "close-modal" : "hand", `switch:${uiState.selectedHandCard}:${recommendation.cardId}`), uiState, `switch:${uiState.selectedHandCard}:${recommendation.cardId}`);
  }

  if (uiState.attackContext) {
    return decorateFinishDuelHelp(withTarget({
      id: FINISH_DUEL_HELP_ID,
      title: uiState.activeAttack ? `${uiState.activeAttack.cardName} is attacking` : "Choose a legal target",
      message: `The attack is already active. Finish it before choosing the next build toward ${context.targetVp} VP.`,
      action: "Choose one of the glowing legal targets in my ecosystem.",
    }, "opponent-board", `active-attack:${uiState.activeAttack?.cardId ?? "card"}`), uiState, `active-attack:${uiState.activeAttack?.cardId ?? "card"}`);
  }

  if (vpBuild) {
    return decorateFinishDuelHelp(withTarget({
      id: FINISH_DUEL_HELP_ID,
      title: `Add ${vpBuild.victoryPoints} VP with ${vpBuild.cardName}`,
      message: `You are at ${context.playerVp}/${context.targetVp} VP. ${vpBuild.cardName} is legal and affordable now, so it is the clearest next step toward the remaining ${context.remainingVp} VP.`,
      action: `Choose ${vpBuild.cardName}, press Play Card, and finish its legal placement.`,
      targetCardId: vpBuild.cardId,
      targetLabel: `${vpBuild.cardName} in your hand`,
    }, "hand", `vp-build:${vpBuild.cardId}`), uiState, `vp-build:${vpBuild.cardId}`);
  }

  if (uiState.inspectedUtilityAction?.ready) {
    const utility = uiState.inspectedUtilityAction;
    return decorateFinishDuelHelp(withTarget({
      id: FINISH_DUEL_HELP_ID,
      title: `Use ${utility.actionName}`,
      message: `${describeUtilityAction(utility)} With no immediate VP build available, use it to improve the choices behind your final ${context.remainingVp} VP.`,
      action: `Press Use ${utility.actionName} (${utility.actionCost} RP) and follow its prompts.`,
      targetActionKey: utility.utilityActionKey,
      targetLabel: `${utility.actionName} on ${utility.cardName}`,
    }, "utility-action-button", `utility-button:${utility.utilityActionKey}`), uiState, `utility-button:${utility.utilityActionKey}`);
  }

  if (uiState.inspectedAttack?.ready) {
    const attack = uiState.inspectedAttack;
    return decorateFinishDuelHelp(withTarget({
      id: FINISH_DUEL_HELP_ID,
      title: `Use ${attack.attackName}`,
      message: `${attack.cardName} can attack now. It will not directly add VP, but disrupting my reef can protect your race to ${context.targetVp}.`,
      action: `Press Use ${attack.attackName}, then choose a glowing legal target.`,
      targetActionKey: attack.actionKey,
      targetLabel: `${attack.attackName} on ${attack.cardName}`,
    }, "attack-button", `attack-button:${attack.actionKey ?? attack.cardId}`), uiState, `attack-button:${attack.actionKey ?? attack.cardId}`);
  }

  if (uiState.inspectedCardOpen) {
    const next = uiState.readyUtilityAction ?? uiState.readyAttack ?? fallbackBuild;
    return decorateFinishDuelHelp(withTarget({
      id: FINISH_DUEL_HELP_ID,
      title: "Return to the next useful move",
      message: `These card details are covering the next guided action in the race to ${context.targetVp} VP.`,
      action: next
        ? `Close these details, then ${next.actionName ? `use ${next.actionName} on ${next.cardName}` : next.attackName ? `use ${next.attackName} on ${next.cardName}` : `choose ${next.cardName}`}.`
        : "Close these details, then end the turn to collect RP and draw again.",
    }, "close-modal", `close-inspector:${next?.utilityActionKey ?? next?.actionKey ?? next?.cardId ?? "end"}`), uiState, `close-inspector:${next?.utilityActionKey ?? next?.actionKey ?? next?.cardId ?? "end"}`);
  }

  if (uiState.readyUtilityAction) {
    const utility = uiState.readyUtilityAction;
    return decorateFinishDuelHelp(withTarget({
      id: FINISH_DUEL_HELP_ID,
      title: `Use ${utility.cardName}'s ${utility.actionName}`,
      message: `${describeUtilityAction(utility)} There is no immediate VP build in hand, so this action can improve the plan behind your remaining ${context.remainingVp} VP.`,
      action: `Select ${utility.cardName}, then use ${utility.actionName} (${utility.actionCost} RP).`,
      targetActionKey: utility.actionKey,
      targetLabel: `${utility.cardName} in your ecosystem`,
    }, "player-board", `utility:${utility.utilityActionKey}`), uiState, `utility:${utility.utilityActionKey}`);
  }

  if (uiState.readyAttack) {
    const attack = uiState.readyAttack;
    return decorateFinishDuelHelp(withTarget({
      id: FINISH_DUEL_HELP_ID,
      title: `Attack with ${attack.cardName}`,
      message: `${attack.attackName} is legal now. It does not directly add VP, but removing one of my cards can slow the opposing score while you prepare your next build.`,
      action: `Select ${attack.cardName}, then use ${attack.attackName}.`,
      targetActionKey: attack.actionKey,
      targetLabel: `${attack.cardName} in your ecosystem`,
    }, "player-board", `attack:${attack.actionKey ?? attack.cardId}`), uiState, `attack:${attack.actionKey ?? attack.cardId}`);
  }

  if (fallbackBuild) {
    return decorateFinishDuelHelp(withTarget({
      id: FINISH_DUEL_HELP_ID,
      title: `Strengthen the reef with ${fallbackBuild.cardName}`,
      message: `${fallbackBuild.cardName} is legal now. It may not add printed VP immediately, but it can expand the economy or relationships needed for the final ${context.remainingVp} VP.`,
      action: `Choose ${fallbackBuild.cardName}, press Play Card, and follow its placement prompt.`,
      targetCardId: fallbackBuild.cardId,
      targetLabel: `${fallbackBuild.cardName} in your hand`,
    }, "hand", `build:${fallbackBuild.cardId}`), uiState, `build:${fallbackBuild.cardId}`);
  }

  return decorateFinishDuelHelp(withTarget({
    id: FINISH_DUEL_HELP_ID,
    title: `Prepare the final ${context.remainingVp} VP`,
    message: `You are at ${context.playerVp}/${context.targetVp} VP, and I am at ${context.opponentVp}. No legal build or useful card action is ready, so another collection and draw will create the next decision.`,
    action: "End the turn. On the next round, collect RP and draw toward another legal ecosystem card.",
  }, "turn-button", "end-turn"), uiState, "end-turn");
}

export function getSimulatorTutorialHelp(checkpoint, uiState = {}) {
  const checkpointId = requireCheckpointId(checkpoint);
  const academyHelp = getAcademyCurriculumHelp(uiState);
  if (academyHelp) return academyHelp;
  if (!checkpointId) return getFinishDuelHelp(uiState);

  const authored = HELP_BY_CHECKPOINT[checkpointId] ?? {
    message: checkpoint.instruction,
    action: "Use the highlighted game control to continue.",
  };

  // A restored tutorial checkpoint can be ahead of a newly-created duel board.
  // Coach the executable setup prerequisite without changing saved evidence.
  if (uiState.gamePhase === "setup") {
    if (uiState.playingCardId) {
      const foundationName = uiState.playingCardName ?? "your starting foundation";
      return withTarget({
        id: checkpointId,
        title: `Place ${foundationName} in Your Reef`,
        message: "We are now focused on Your Reef, where your cards belong. This fresh practice board still needs a Base Coral or Creature School before later tutorial steps are possible.",
        action: `Select a glowing Place here marker in Your Reef to establish ${foundationName}.`,
        targetLabel: "a glowing Place here marker in Your Reef",
        pointerPrompt: `Place ${foundationName} on this marker in Your Reef.`,
      }, "placement", "setup:placement");
    }
    if (!uiState.hasCoralInPlay) {
      const scriptedSetupCardId = String(uiState.scriptedSetupCardId ?? "").trim();
      if (scriptedSetupCardId) {
        const scriptedSetupCardName = String(uiState.scriptedSetupCardName ?? "Mustard Hill Coral");
        const selectedScriptedCard = uiState.selectedHandCard === scriptedSetupCardId
          && (uiState.modal === "hand" || uiState.handPopoverOpen);
        return withTarget({
          id: checkpointId,
          title: `Begin with ${scriptedSetupCardName}`,
          lead: "",
          message: `Welcome to our practice reef. I placed ${scriptedSetupCardName} in your opening hand because its steady Photosynthesis income will fund the card-action and attack lessons ahead. The other foundations can wait for a free-practice duel.`,
          playerThought: "This setup choice is part of the experiment: a known foundation gives the later turns a reliable RP budget, so I can focus on learning each action.",
          encouragement: "Precisely. Once the lesson is complete, I hope you will test every opening you like. For now, a controlled starting point lets us see why each result occurs.",
          action: selectedScriptedCard
            ? `Press Play Card, then place ${scriptedSetupCardName} in the highlighted area.`
            : `Choose the glowing ${scriptedSetupCardName} in your hand, then press Play Card.`,
          targetCardId: scriptedSetupCardId,
          targetLabel: `${scriptedSetupCardName} in your hand`,
        }, selectedScriptedCard ? "play-card" : "hand", selectedScriptedCard ? "scripted-setup:play" : "scripted-setup:hand");
      }
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
      message: "Your starting foundation is in place. Begin Round 1 to collect RP and continue the lesson.",
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
  let playerThought = authored.playerThought;
  let encouragement = authored.encouragement;
  let lead = authored.lead;

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
      const isScriptedEconomyCard = uiState.scriptedLesson && card.cardId === uiState.scriptedBuildCardId;
      title = isScriptedEconomyCard ? `Grow the economy with ${card.cardName}` : `Play ${card.cardName}`;
      message = isScriptedEconomyCard
        ? `There is our prepared Foundation draw: ${card.cardName}. It costs ${card.cost} RP now, then becomes another source of RP on later turns. Building it completes the economy half of our plan before we ask Arrow Crab to turn cards into a specific attacker.`
        : `${card.cardName} is a legal ${card.kindLabel ?? "ecosystem card"} in your hand. It costs ${card.cost} RP${Number(card.victoryPoints ?? 0) > 0 ? ` and adds ${Number(card.victoryPoints)} VP in play` : ""}.`;
      action = `Choose ${card.cardName}, press Play Card, and follow its placement or effect prompt.`;
      target = "hand";
      targetCardId = card.cardId;
      targetLabel = `${card.cardName} in your hand`;
      cue = `recommend:${card.cardId}`;
      if (isScriptedEconomyCard) {
        playerThought = "Spending my first collection on another foundation means I have fewer options this turn, but a larger and more reliable budget on every turn that follows.";
        encouragement = "Well said. Economy cards often feel quiet when played; their value appears in the choices they make affordable later. We are building tomorrow's turn now.";
      }
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
    const scriptedAttackRequiredRp = Math.max(0, Number(uiState.scriptedAttackCardCost ?? 0))
      + Math.max(0, Number(uiState.scriptedAttackActionCost ?? 0));
    const scriptedWaitingForAttackRp = Boolean(
      uiState.scriptedLesson
      && uiState.scriptedAttackCardInHand
      && Number(uiState.availableRp ?? 0) < scriptedAttackRequiredRp,
    );
    const isLookingAtHand = uiState.modal === "hand" || uiState.handPopoverOpen;
    const selectedAttackSetup = Boolean(isLookingAtHand
      && uiState.selectedHandCard
      && uiState.attackSetupCard
      && uiState.attackSetupCard.cardId === uiState.selectedHandCard);
    const selectedBuildFallback = Boolean(isLookingAtHand
      && uiState.selectedHandCard
      && !uiState.readyAttack
      && !uiState.attackSetupCard
      && uiState.recommendedBuildCard
      && uiState.recommendedBuildCard.cardId === uiState.selectedHandCard);
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
    } else if (uiState.inspectedUtilityAction?.ready && !uiState.inspectedAttack?.ready) {
      const utility = uiState.inspectedUtilityAction;
      if (uiState.readyAttack) {
        const attack = uiState.readyAttack;
        title = `${utility.actionName} is usable, but an attack is ready`;
        message = `${describeUtilityAction(utility)} ${attack.cardName}'s ${attack.attackName} can complete this lesson now.`;
        target = "close-modal";
        action = `Close these details, select ${attack.cardName}, and use ${attack.attackName}. You can return to ${utility.actionName} on another turn.`;
        cue = `utility-defer:${utility.utilityActionKey}:${attack.actionKey ?? attack.cardId}`;
      } else {
        title = `Use ${utility.actionName}`;
        message = describeUtilityAction(utility);
        target = "utility-action-button";
        targetActionKey = utility.utilityActionKey;
        targetLabel = `${utility.actionName} on ${utility.cardName}`;
        action = `Press Use ${utility.actionName} (${utility.actionCost} RP), follow its prompts, and I will reassess your attack options afterward.`;
        cue = `utility-button:${utility.utilityActionKey}`;
      }
    } else if (uiState.inspectedPlayerCard && !uiState.inspectedAttack?.ready) {
      const inspectedName = uiState.inspectedCardName ?? "This card";
      const next = uiState.readyAttack;
      title = `${inspectedName} cannot attack right now`;
      message = uiState.inspectedAttack?.blockReason
        ?? `${inspectedName} does not have an attack it can use right now.`;
      target = "close-modal";
      action = next
        ? `Close these details, select ${next.cardName}, and use ${next.attackName}.`
        : uiState.attackSetupCard
          ? `Close these details, then play ${uiState.attackSetupCard.cardName} from your hand.`
          : uiState.readyUtilityAction
            ? `Close these details, select ${uiState.readyUtilityAction.cardName}, and use ${uiState.readyUtilityAction.actionName}.`
            : "Close these details, check your hand, then end the turn if no legal attack becomes available.";
      cue = `inspected-blocked:${uiState.inspectedAttack?.actionKey ?? uiState.inspectedCardName ?? "card"}`;
    } else if (uiState.inspectedCardOpen && !uiState.inspectedPlayerCard) {
      const next = uiState.readyAttack;
      title = "Return to your ecosystem";
      message = "You are reviewing one of my cards, but the next guided action is on your side of the board.";
      target = "close-modal";
      action = next
        ? `Close these details, select ${next.cardName}, and use ${next.attackName}.`
        : uiState.readyUtilityAction
          ? `Close these details, select ${uiState.readyUtilityAction.cardName}, and use ${uiState.readyUtilityAction.actionName}.`
          : "Close these details, then follow the highlighted card or turn control.";
      cue = `opponent-inspector:${uiState.inspectedCardName ?? "card"}`;
    } else if (scriptedWaitingForAttackRp && isLookingAtHand) {
      title = "Save Porcupine Fish for the next tide";
      message = `Porcupine Fish is the attacker we searched for, but playing it and using Crunch requires ${scriptedAttackRequiredRp} RP together. You currently have ${Math.max(0, Number(uiState.availableRp ?? 0))} RP, so forcing the play now would leave the lesson unfinished.`;
      target = "close-modal";
      action = "Close your hand, then end the turn. The next collection will fund both Porcupine Fish and Crunch.";
      playerThought = "Searching found the right answer, but timing still matters. I should keep Porcupine Fish in hand until I can pay for both the creature and its attack.";
      encouragement = "Exactly. A plan includes the card, its action, and the RP for both. Waiting one tide here is preparation, not lost momentum.";
      cue = `scripted:bank-for-porcupine:close:${Math.max(0, Number(uiState.availableRp ?? 0))}`;
    } else if (uiState.handPopoverOpen) {
      const next = uiState.readyAttack;
      title = next ? `${next.cardName} is already ready` : "Return to the guided action";
      message = next
        ? `You do not need another card before attacking. ${next.cardName}'s ${next.attackName} has ${next.targetCount} legal ${next.targetCount === 1 ? "target" : "targets"}.`
        : "These card details are covering the next highlighted action.";
      target = "close-modal";
      action = next
        ? `Close these card details, select ${next.cardName} in your ecosystem, and use ${next.attackName}.`
        : uiState.attackSetupCard
          ? `Close these details, then choose ${uiState.attackSetupCard.cardName} from your hand.`
          : uiState.readyUtilityAction
            ? `Close these details, select ${uiState.readyUtilityAction.cardName}, and use ${uiState.readyUtilityAction.actionName}.`
            : uiState.recommendedBuildCard
              ? `Close these details, then choose ${uiState.recommendedBuildCard.cardName}.`
              : "Close these details, then end the turn and draw toward another legal attack.";
      cue = `close-hand:${next?.actionKey ?? uiState.attackSetupCard?.cardId ?? uiState.readyUtilityAction?.utilityActionKey ?? uiState.recommendedBuildCard?.cardId ?? "end"}`;
    } else if (uiState.modal === "hand" && uiState.readyAttack) {
      const attack = uiState.readyAttack;
      title = `${attack.cardName} is already ready`;
      message = `${attack.cardName}'s ${attack.attackName} already has ${attack.targetCount} legal ${attack.targetCount === 1 ? "target" : "targets"}; another card is not required first.`;
      target = "close-modal";
      action = `Close your hand, select ${attack.cardName}, and use ${attack.attackName}.`;
      cue = `close-hand:ready:${attack.actionKey ?? attack.cardId}`;
    } else if (uiState.modal === "hand" && uiState.readyUtilityAction && !uiState.attackSetupCard) {
      const utility = uiState.readyUtilityAction;
      title = `${utility.actionName} is already available`;
      message = `${describeUtilityAction(utility)} You do not need to play another card before using it.`;
      target = "close-modal";
      action = `Close your hand, select ${utility.cardName}, and use ${utility.actionName}.`;
      cue = `close-hand:utility:${utility.utilityActionKey}`;
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
    } else if (scriptedWaitingForAttackRp) {
      title = "Bank RP for Porcupine Fish";
      lead = "";
      message = `Splendid work—Scavenge found the exact attacker we wanted. Porcupine Fish costs ${Math.max(0, Number(uiState.scriptedAttackCardCost ?? 0))} RP to play, and Crunch needs another ${Math.max(0, Number(uiState.scriptedAttackActionCost ?? 0))} RP. You have ${Math.max(0, Number(uiState.availableRp ?? 0))} RP left, so we will keep the card safe in hand and fund the complete move next round.`;
      target = "turn-button";
      action = "End your turn. After the next condition and collection, make the required draw, then play Porcupine Fish and use Crunch on Sea Urchin.";
      playerThought = "I found the correct attacker, but I need enough RP for the entire sequence. Ending now preserves Porcupine Fish and turns next round into a prepared attack.";
      encouragement = "Precisely! Good strategy is not only choosing the right card; it is arranging the resources and timing that let the card do its job.";
      cue = `scripted:bank-for-porcupine:${Math.max(0, Number(uiState.availableRp ?? 0))}`;
    } else if (uiState.readyUtilityAction) {
      const utility = uiState.readyUtilityAction;
      title = `Use ${utility.cardName}'s ${utility.actionName}`;
      message = describeUtilityAction(utility);
      target = "player-board";
      targetActionKey = utility.actionKey;
      targetLabel = `${utility.cardName} in your ecosystem`;
      action = `Select ${utility.cardName}, press Use ${utility.actionName} (${utility.actionCost} RP), and follow its prompts. I will reassess the attack lesson afterward.`;
      cue = `utility:${utility.utilityActionKey}`;
    } else if (
      uiState.scriptedLesson
      && Number(uiState.round ?? 0) === 1
      && uiState.nextPalsCardName === "Arrow Crab"
    ) {
      title = "Let the first reef settle";
      lead = "";
      message = "That is a fine first turn: you established a foundation and grew the economy that will pay for our next lesson. I arranged Arrow Crab as the next card in your Pals Deck, so there is no need to spend RP on an unrelated play now.";
      target = "turn-button";
      action = "End your turn. At the start of Round 2, draw one card from the Pals Deck to reveal Arrow Crab.";
      playerThought = "My first turn already achieved its purpose: two foundations will collect enough RP to support a more interesting card action next round.";
      encouragement = "Exactly. There is a quiet skill in recognizing when a turn has done its job. We will let this reef collect, then use that economy with intention.";
      cue = "scripted:end-round-one";
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
    ...(lead !== undefined ? { lead } : {}),
    message,
    action,
    targetCardId,
    targetActionKey,
    targetLabel,
    playerThought,
    encouragement,
  }, target, cue);
}

export function getSimulatorTutorialConditionHelp(condition, round = 1) {
  const conditionId = String(condition?.id ?? "").trim();
  if (!conditionId) return null;
  const authored = CONDITION_HELP_BY_ID[conditionId];
  const conditionName = String(condition?.name ?? "Round condition");
  const conditionText = String(condition?.text ?? "").trim();
  return withTarget({
    id: "tutorial-condition",
    title: authored?.title ?? `Read ${conditionName} carefully`,
    message: authored?.message
      ?? `The ocean changes through weather, seasons, currents, living processes, and human activity. ${conditionName} is a simplified model of one circumstance this round. Its game rule says: ${conditionText || "compare its effect with your hand, board, and available RP before choosing a move."}`,
    playerThought: authored?.playerThought
      ?? "I should identify exactly what changes, who it affects, and how long it lasts before I alter my plan.",
    encouragement: authored?.encouragement
      ?? "That is the right habit. Conditions are evidence about the current round, so let the exact wording guide your next decision.",
    action: "Review the condition and your RP collection, then continue to this round's draw.",
  }, "condition-continue", `condition:r${Number(round) || 1}:${conditionId}`);
}

export function hasSimulatorTutorialHelp(checkpointId) {
  return Object.hasOwn(HELP_BY_CHECKPOINT, checkpointId);
}

export const SIMULATOR_TUTORIAL_HELP_CHECKPOINT_IDS = Object.freeze(Object.keys(HELP_BY_CHECKPOINT));
