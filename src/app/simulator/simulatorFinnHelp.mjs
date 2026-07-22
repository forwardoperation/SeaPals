function normalizeText(value) {
  return String(value ?? "").trim();
}

function isNextStepQuestion(question) {
  return /\b(?:what (?:should|do) i do(?: now)?|what(?:'s| is) next|where (?:do i|should i) click|how do i continue|help me continue)\b/i.test(question);
}

function isPlayBlockQuestion(question) {
  return /\b(?:why (?:can(?:not|'t)|won't) i play|why is (?:this|the) card unavailable|card (?:is|says) unavailable)\b/i.test(question);
}

function isConditionQuestion(question, conditionName) {
  if (/\b(?:this|current|active) condition\b/i.test(question)) return true;
  return Boolean(conditionName && question.toLowerCase().includes(conditionName.toLowerCase()));
}

function isBoardLayoutQuestion(question) {
  return /\b(?:pan|zoom|zooming|fit button|fit the|move (?:a |the )?(?:card|coral|slot)|drag (?:a |the )?(?:card|coral|slot|board)|find (?:my |the )?slots?|where (?:are|is) (?:my |the )?slots?)\b/i.test(question);
}

function isDeckChoiceQuestion(question) {
  return /\b(?:which|what) deck (?:should|do) i draw|foundation (?:deck )?or pals|draw from (?:the )?(?:foundation|pals)\b/i.test(question);
}

function phaseHelp(context) {
  const phase = normalizeText(context.gamePhase).toLowerCase();
  if (phase === "setup") {
    return "Choose a legal Base Coral or Creature School from your opening hand, play it into the foundation area, then begin Round 1.";
  }
  if (phase === "draw") {
    return "Choose the required number of cards from your Foundation and Pals decks, confirm the draw, review the cards, and continue to actions.";
  }
  if (phase === "main") {
    return "During your action phase, you may play affordable legal cards, use available card actions, and make legal attacks in any order. Check your RP before ending the turn.";
  }
  if (phase === "opponent") {
    return "The opposing reef is taking its turn. Watch the Recent Events feed for draws, plays, attacks, and rules outcomes; your controls return when that turn finishes.";
  }
  return "Finish the open decision or animation. The simulator will restore the next available control when it resolves.";
}

export function expandSimulatorFinnQuestion(rawQuestion, context = {}) {
  const question = normalizeText(rawQuestion);
  const selectedCardName = normalizeText(context.selectedCardName);
  if (!selectedCardName) return question;
  return question.replace(/\bthis card\b/gi, selectedCardName);
}

export function resolveSimulatorFinnQuestion(rawQuestion, context = {}) {
  const displayQuestion = normalizeText(rawQuestion);
  const delegatedQuestion = expandSimulatorFinnQuestion(displayQuestion, context);
  const tutorialAction = normalizeText(context.tutorialAction);
  const tutorialTargetLabel = normalizeText(context.tutorialTargetLabel);
  const tutorialGuideName = normalizeText(context.tutorialGuideName) || "Mr. Easterling";
  const selectedCardName = normalizeText(context.selectedCardName);
  const selectedCardPlayError = normalizeText(context.selectedCardPlayError);
  const activeConditionName = normalizeText(context.activeConditionName);
  const activeConditionText = normalizeText(context.activeConditionText);

  if (isNextStepQuestion(displayQuestion)) {
    if (tutorialAction) {
      return Object.freeze({
        delegatedQuestion,
        answer: Object.freeze({
          title: `Follow ${tutorialGuideName}'s highlighted step`,
          text: `${tutorialAction}${tutorialTargetLabel ? ` Look for ${tutorialTargetLabel}.` : ""} I’ll stay available if you want the rule behind that step explained.`,
        }),
      });
    }
    return Object.freeze({
      delegatedQuestion,
      answer: Object.freeze({ title: "Your next match step", text: phaseHelp(context) }),
    });
  }

  if (isPlayBlockQuestion(displayQuestion)) {
    if (!selectedCardName) {
      return Object.freeze({
        delegatedQuestion,
        answer: Object.freeze({
          title: "Select the card first",
          text: "Open a card from your hand, then ask again. I can use the simulator’s exact availability message to explain what is missing.",
        }),
      });
    }
    return Object.freeze({
      delegatedQuestion,
      answer: Object.freeze({
        title: selectedCardPlayError ? `Why ${selectedCardName} is unavailable` : `${selectedCardName} is currently playable`,
        text: selectedCardPlayError
          ? selectedCardPlayError
          : `${selectedCardName} is legal and affordable in the current state. Press Play Card and follow the highlighted placement or effect prompt.`,
      }),
    });
  }

  if (isConditionQuestion(displayQuestion, activeConditionName) && activeConditionName) {
    return Object.freeze({
      delegatedQuestion,
      answer: Object.freeze({
        title: activeConditionName,
        text: activeConditionText || "Select the Active Condition panel to read its full rule text.",
      }),
    });
  }

  if (isBoardLayoutQuestion(displayQuestion)) {
    return Object.freeze({
      delegatedQuestion,
      answer: Object.freeze({
        title: "Moving around your ecosystem",
        text: "Drag empty water to pan the board. Use + and − to change the view, and Fit to bring every card and slot back on screen. Drag a Coral to move that foundation with its connected slots, or drag an empty slot to rearrange just that slot. These movements change only the layout, not which cards or slots are legal.",
      }),
    });
  }

  if (isDeckChoiceQuestion(displayQuestion)) {
    return Object.freeze({
      delegatedQuestion,
      answer: Object.freeze({
        title: "Choose the deck that answers your next need",
        text: "The Foundation Deck contains Corals and Creature Schools that grow RP income and legal play spaces, so it is usually strongest early. The Pals Deck contains creatures, Habitats, and Support cards; choose it once your foundation can support the tactic or card type you need.",
      }),
    });
  }

  return Object.freeze({ delegatedQuestion, answer: null });
}
