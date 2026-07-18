export const GUIDED_ACADEMY_BOARD_TOUR_STEPS = Object.freeze([
  Object.freeze({
    id: "score",
    target: "vp-score",
    title: "First, know how to win",
    message: "Welcome to the match table, Reefkeeper. This scoreboard tracks both reefs. Victory Points come from the cards you successfully add to your ecosystem, and the lesson will not end until you reach its full target.",
    targetLabel: "the Victory Point scoreboard",
    pointerPrompt: "This scoreboard shows your progress toward victory.",
  }),
  Object.freeze({
    id: "player-ecosystem",
    target: "player-board",
    title: "Your ecosystem",
    message: "This lower ocean is your ecosystem. Foundation Corals create the structure of your reef, and their open slots tell you which creatures they can support. Habitats and special reef creatures also appear here as your ecosystem grows.",
    targetLabel: "your ecosystem",
    pointerPrompt: "Your cards grow in this ecosystem.",
  }),
  Object.freeze({
    id: "opponent-ecosystem",
    target: "opponent-board",
    title: "Read the opposing reef",
    message: "The upper ocean belongs to your opponent. For this lesson, Professor Current has prepared a legal mid-game reef with durable Corals and compatible practice targets. Check it before choosing attacks or On Play abilities: a powerful effect can be wasted when the opposing reef has no compatible target.",
    targetLabel: "the opposing ecosystem",
    pointerPrompt: "Read the opposing reef before committing an attack or effect.",
  }),
  Object.freeze({
    id: "condition",
    target: "condition-panel",
    title: "Conditions change the round",
    message: "A Condition is revealed at the start of each round. It can change costs, RP limits, card rules, or the choices that are strongest that round. Read it before spending anything; the same hand can call for a different plan under a different Condition.",
    targetLabel: "the Active Condition panel",
    pointerPrompt: "Read the active Condition before planning the turn.",
  }),
  Object.freeze({
    id: "resources",
    target: "rp-bank",
    title: "RP pays for your plan",
    message: "Resource Points, or RP, pay for cards and many card actions. The bank shows what you can spend now, its current cap, and what your reef expects to collect next turn. Early foundations are valuable because they make future turns stronger.",
    targetLabel: "your RP Bank",
    pointerPrompt: "Your RP Bank shows what you can afford now and collect later.",
  }),
  Object.freeze({
    id: "hand",
    target: "hand",
    title: "Your hand holds your options",
    message: "Cards you draw wait in your hand. Select one to read its cost, type, abilities, and legal-play guidance before committing it. We will pause to explain each new card type the first time this lesson asks you to use it.",
    targetLabel: "your hand",
    pointerPrompt: "Select cards here to inspect their rules and costs.",
  }),
  Object.freeze({
    id: "zones",
    target: "zones",
    title: "Discarded and lost are different",
    message: "The Discard pile holds cards that effects may recover or recycle. The Lost zone is more final: cards sent there are normally outside the match. These counters let you check both zones without losing track of the board.",
    targetLabel: "the Discard and Lost zone counters",
    pointerPrompt: "These counters track cards that have left your hand or ecosystem.",
  }),
  Object.freeze({
    id: "events",
    target: "event-feed",
    title: "The event feed explains resolutions",
    message: "Recent events records draws, costs, card effects, attacks, and rules outcomes. If something resolves differently than you expected, this is the first place to look for the simulator's explanation.",
    targetLabel: "the Recent Events feed",
    pointerPrompt: "Use Recent Events to review what the game just resolved.",
  }),
  Object.freeze({
    id: "turn-control",
    target: "turn-button",
    title: "Advance only when your plan is finished",
    message: "This control begins Round 1 after setup and ends your turn once play begins. Before using it, check the Condition, your RP, your hand, both ecosystems, and any unused card actions. Excellent—now you know where every decision lives. We will flip for the opening turn, then build your first foundation together.",
    targetLabel: "the turn control",
    pointerPrompt: "The turn control advances the match when your plan is complete.",
  }),
]);

export function getGuidedAcademyBoardTourStep(stepIndex) {
  if (stepIndex === null || stepIndex === undefined || stepIndex === "") return null;
  const index = Number(stepIndex);
  if (!Number.isSafeInteger(index) || index < 0 || index >= GUIDED_ACADEMY_BOARD_TOUR_STEPS.length) return null;
  const step = GUIDED_ACADEMY_BOARD_TOUR_STEPS[index];
  const finalStep = index === GUIDED_ACADEMY_BOARD_TOUR_STEPS.length - 1;
  return Object.freeze({
    ...step,
    cueId: `academy-board-tour:${step.id}`,
    progressLabel: `Board tour • ${index + 1}/${GUIDED_ACADEMY_BOARD_TOUR_STEPS.length}`,
    lead: "",
    action: finalStep
      ? "Select Flip Coin to make the opening call, then begin the guided setup."
      : "Select Next to continue around the board.",
    advanceLabel: finalStep ? "Flip Coin" : "Next",
    index,
    totalSteps: GUIDED_ACADEMY_BOARD_TOUR_STEPS.length,
    finalStep,
  });
}

export function getNextGuidedAcademyBoardTourStep(stepIndex) {
  const nextIndex = Number(stepIndex) + 1;
  return getGuidedAcademyBoardTourStep(nextIndex) ? nextIndex : null;
}
