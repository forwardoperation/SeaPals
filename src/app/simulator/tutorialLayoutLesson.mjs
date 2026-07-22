const FOUNDATION_NAME_TOKEN = "{{foundationName}}";

export const GUIDED_ACADEMY_LAYOUT_ACTIONS = Object.freeze({
  ZOOM_IN: "zoom-in",
  ZOOM_OUT: "zoom-out",
  MOVE_FOUNDATION: "move-foundation",
  MOVE_SLOT: "move-slot",
  FIT: "fit",
});

const GUIDED_ACADEMY_LAYOUT_STEPS = Object.freeze([
  Object.freeze({
    actionId: GUIDED_ACADEMY_LAYOUT_ACTIONS.ZOOM_IN,
    target: "player-zoom-in",
    title: "Zoom in to read the reef",
    message: `Now that ${FOUNDATION_NAME_TOKEN} is on the board, use the plus button to enlarge it. Zoom changes only your view; it never changes a card's rules, position, or legal slots.`,
    action: "Press the + button once and watch the card and its slot symbols become easier to inspect.",
    targetLabel: "the + button beside your ecosystem",
    pointerPrompt: "Press + to inspect cards and slot symbols more closely.",
  }),
  Object.freeze({
    actionId: GUIDED_ACADEMY_LAYOUT_ACTIONS.ZOOM_OUT,
    target: "player-zoom-out",
    title: "Zoom out to see relationships",
    message: "The minus button pulls the camera back. Use it when several Corals, creatures, and connecting slot lines make it difficult to understand the reef as a whole.",
    action: "Press the minus button once to widen your view again.",
    targetLabel: "the minus button beside your ecosystem",
    pointerPrompt: "Press minus to see more of the ecosystem at once.",
  }),
  Object.freeze({
    actionId: GUIDED_ACADEMY_LAYOUT_ACTIONS.MOVE_FOUNDATION,
    target: "foundation-drag",
    title: "Move a foundation and its branch",
    message: `Your board layout is flexible. Drag ${FOUNDATION_NAME_TOKEN} by its card body to move that foundation and its connected slot network together. This changes only the visual arrangement; nothing leaves play.`,
    action: `Drag ${FOUNDATION_NAME_TOKEN} a short distance into open water.`,
    targetLabel: FOUNDATION_NAME_TOKEN,
    pointerPrompt: `Drag ${FOUNDATION_NAME_TOKEN} to organize the reef without changing the game state.`,
  }),
  Object.freeze({
    actionId: GUIDED_ACADEMY_LAYOUT_ACTIONS.MOVE_SLOT,
    target: "slot-drag",
    title: "Give each slot enough room",
    message: "A slot can also be dragged around its own foundation. Moving a slot does not change which card class it accepts; it simply keeps future cards and their labels from stacking on top of one another.",
    action: "Drag the highlighted empty slot away from the card until its connector and symbol are easy to read.",
    targetLabel: "the highlighted empty slot",
    pointerPrompt: "Drag this slot into clear water so a future card will not overlap the foundation.",
  }),
  Object.freeze({
    actionId: GUIDED_ACADEMY_LAYOUT_ACTIONS.FIT,
    target: "player-zoom-fit",
    title: "Fit shows the whole reef",
    message: "Fit automatically recenters and scales every card and slot in your ecosystem. Use it whenever dragging or zooming leaves part of the reef offscreen, or when you are unsure where an open slot went.",
    action: "Press Fit to finish with the complete foundation and all of its slots visible.",
    targetLabel: "the Fit button beside your ecosystem",
    pointerPrompt: "Press Fit to recenter every card and slot in view.",
  }),
]);

const GUIDED_FOUNDATION_POSITIONS = Object.freeze([
  Object.freeze({ x: 32, y: 72 }),
  Object.freeze({ x: 68, y: 72 }),
  Object.freeze({ x: 14, y: 24 }),
  Object.freeze({ x: 50, y: 24 }),
  Object.freeze({ x: 86, y: 24 }),
]);

export function createGuidedAcademyLayoutProgress(source = {}) {
  return Object.freeze(Object.fromEntries(
    Object.values(GUIDED_ACADEMY_LAYOUT_ACTIONS).map((actionId) => [actionId, source?.[actionId] === true]),
  ));
}

export function completeGuidedAcademyLayoutAction(progress, actionId) {
  if (!Object.values(GUIDED_ACADEMY_LAYOUT_ACTIONS).includes(actionId)) {
    throw new RangeError(`Unknown guided Academy layout action: ${actionId}`);
  }
  const current = createGuidedAcademyLayoutProgress(progress);
  if (current[actionId]) return current;
  return Object.freeze({ ...current, [actionId]: true });
}

export function getGuidedAcademyLayoutLessonStep(
  progress,
  { foundationName = "your Base Coral" } = {},
) {
  const current = createGuidedAcademyLayoutProgress(progress);
  const index = GUIDED_ACADEMY_LAYOUT_STEPS.findIndex((step) => !current[step.actionId]);
  if (index < 0) return null;
  const normalizedFoundationName = String(foundationName).trim() || "your Base Coral";
  const step = GUIDED_ACADEMY_LAYOUT_STEPS[index];
  const replaceFoundationName = (value) => String(value).replaceAll(
    FOUNDATION_NAME_TOKEN,
    normalizedFoundationName,
  );
  return Object.freeze({
    ...step,
    id: `academy-layout-${step.actionId}`,
    progressLabel: `Board controls • ${index + 1}/${GUIDED_ACADEMY_LAYOUT_STEPS.length}`,
    lead: "",
    message: replaceFoundationName(step.message),
    action: replaceFoundationName(step.action),
    targetLabel: replaceFoundationName(step.targetLabel),
    pointerPrompt: replaceFoundationName(step.pointerPrompt),
    index,
    totalSteps: GUIDED_ACADEMY_LAYOUT_STEPS.length,
  });
}

export function getGuidedAcademyFoundationPlacementTarget(existingFoundationCount) {
  const index = Number(existingFoundationCount);
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new RangeError("Existing foundation count must be a non-negative safe integer.");
  }
  const planned = GUIDED_FOUNDATION_POSITIONS[index];
  if (planned) return planned;
  const overflowIndex = index - GUIDED_FOUNDATION_POSITIONS.length;
  return Object.freeze({
    x: 20 + (overflowIndex % 4) * 20,
    y: 122 + Math.floor(overflowIndex / 4) * 34,
  });
}
