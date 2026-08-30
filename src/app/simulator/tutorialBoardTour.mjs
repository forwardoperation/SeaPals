const GUIDE_NAME_TOKEN = "{{guideName}}";

export const GUIDED_ACADEMY_BOARD_TOUR_STEPS = Object.freeze([
  Object.freeze({
    id: "score",
    target: "vp-score",
    title: "First, know how to win",
    message: "Now that you can read your first card, let us map the match table. This scoreboard tracks both reefs. Victory Points come from the cards you successfully add to your ecosystem, and the lesson will not end until you reach its full target.",
    targetLabel: "the Victory Point scoreboard",
    pointerPrompt: "This scoreboard shows your progress toward victory.",
  }),
  Object.freeze({
    id: "condition",
    target: "condition-panel",
    title: "Conditions model a changing ocean",
    message: "The ocean never stays exactly the same. Sunlight, temperature, visibility, nutrients, currents, and food availability shift with weather and seasons. The Active Condition models one important environmental change each round by changing an exact game rule. It is a simplified model, but it asks a real ecological question: how does a changing environment alter what an ecosystem can support? Read it before planning your turn.",
    targetLabel: "the Active Condition panel",
    pointerPrompt: "Read how this round's environment changes the game.",
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
    id: "zones",
    target: "zones",
    title: "Discarded and lost are different",
    message: "The Discard pile holds cards that effects may recover or recycle. The Lost zone is more final: cards sent there are normally outside the match. These counters let you check both zones without losing track of the board.",
    targetLabel: "the Discard and Lost zone counters",
    pointerPrompt: "These counters track cards that have left your hand or ecosystem.",
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
    id: "turn-control",
    target: "turn-button",
    title: "Advance only when your plan is finished",
    message: "Begin Round starts the match after setup. After play begins, Next Round ends your actions, resolves the opposing turn, and advances the ocean to its next condition. It sits beside the reef divider so it stays visible without taking space from your hand. Advancing should still be your final decision after checking the Condition, your RP, your hand, both ecosystems, and any unused card actions. Leave it alone for now; next we will cross to the two oceans where cards are placed.",
    targetLabel: "the turn control",
    pointerPrompt: "The turn control advances the match when your plan is complete.",
  }),
  Object.freeze({
    id: "opponent-ecosystem",
    target: "opponent-board",
    coachAnchor: "opponent-board-tab",
    title: "Read the opposing reef",
    message: "The upper ocean belongs to your opponent. I prepared durable Corals and compatible practice targets for this lesson. In a normal match, inspect the opposing reef before choosing an attack or On Play ability; a powerful effect can be wasted when there is no legal target.",
    targetLabel: "the opposing ecosystem",
    pointerPrompt: "Read the opposing reef before committing an attack or effect.",
  }),
  Object.freeze({
    id: "player-ecosystem",
    target: "player-board",
    coachAnchor: "player-board-tab",
    title: "Your ecosystem",
    message: "This lower ocean is your ecosystem. Foundation Corals create the structure of your reef, and their open slots tell you which creatures they can support. Habitats and special reef creatures also appear here as your ecosystem grows. That completes our board tour; next, you will call and toss the coin for the opening turn before we build your first foundation together.",
    targetLabel: "your ecosystem",
    pointerPrompt: "Your cards grow in this ecosystem.",
  }),
]);

export function getGuidedAcademyBoardTourStep(stepIndex, { guideName = "Mr. Easterling" } = {}) {
  if (stepIndex === null || stepIndex === undefined || stepIndex === "") return null;
  const index = Number(stepIndex);
  if (!Number.isSafeInteger(index) || index < 0 || index >= GUIDED_ACADEMY_BOARD_TOUR_STEPS.length) return null;
  const step = GUIDED_ACADEMY_BOARD_TOUR_STEPS[index];
  const finalStep = index === GUIDED_ACADEMY_BOARD_TOUR_STEPS.length - 1;
  return Object.freeze({
    ...step,
    message: step.message.replaceAll(GUIDE_NAME_TOKEN, String(guideName).trim() || "Mr. Easterling"),
    cueId: `academy-board-tour:${step.id}`,
    progressLabel: `Board tour • ${index + 1}/${GUIDED_ACADEMY_BOARD_TOUR_STEPS.length}`,
    lead: "",
    action: finalStep
      ? "Select Call the Coin, choose heads or tails, and then toss it yourself."
      : "Select Next to continue around the board.",
    advanceLabel: finalStep ? "Call the Coin" : "Next",
    index,
    totalSteps: GUIDED_ACADEMY_BOARD_TOUR_STEPS.length,
    finalStep,
  });
}

export function getNextGuidedAcademyBoardTourStep(stepIndex) {
  const nextIndex = Number(stepIndex) + 1;
  return getGuidedAcademyBoardTourStep(nextIndex) ? nextIndex : null;
}
