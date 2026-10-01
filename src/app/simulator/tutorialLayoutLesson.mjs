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
  Object.freeze({ x: 50, y: 24 }),
  Object.freeze({ x: 32, y: 72 }),
  Object.freeze({ x: 68, y: 72 }),
  Object.freeze({ x: 14, y: 24 }),
  Object.freeze({ x: 86, y: 24 }),
]);

const COLLISION_AWARE_FOUNDATION_POSITIONS = Object.freeze([
  Object.freeze({ x: 50, y: 24 }),
  Object.freeze({ x: 18, y: 72 }),
  Object.freeze({ x: 82, y: 72 }),
  Object.freeze({ x: 16, y: 20 }),
  Object.freeze({ x: 84, y: 20 }),
  Object.freeze({ x: 50, y: 12 }),
  Object.freeze({ x: 16, y: 84 }),
  Object.freeze({ x: 84, y: 84 }),
]);

const FOUNDATION_CLEARANCE = Object.freeze({ x: 30, y: 38 });
const PREPARED_FOUNDATION_COLUMN_GAP = 140;
const PREPARED_FOUNDATION_ROW_GAP = 240;
export const TUTORIAL_OPEN_WATER_FOOTPRINT = Object.freeze({ minX: -90, maxX: 90, minY: -110, maxY: 110 });

/** World-pixel bounds around a 240x280 Foundation anchor. Reserve full cards
 * even for empty slots, so a later creature does not undo the safe placement.
 */
export function getTutorialFoundationFootprint(slots = [], anchorPositions = []) {
  const bounds = { minX: -120, maxX: 120, minY: -200, maxY: 140 };
  slots.forEach((slot, index) => {
    const position = slot.position ?? anchorPositions[index];
    const left = Number.parseFloat(position?.left);
    const top = Number.parseFloat(position?.top);
    if (!Number.isFinite(left) || !Number.isFinite(top)) return;
    const x = (left - 50) / 100 * 240;
    const y = (top - 50) / 100 * 280;
    bounds.minX = Math.min(bounds.minX, x - 90);
    bounds.maxX = Math.max(bounds.maxX, x + 90);
    bounds.minY = Math.min(bounds.minY, y - 110);
    bounds.maxY = Math.max(bounds.maxY, y + 110);
  });
  return bounds;
}

function getMeasuredFoundationPlacement(existingFoundations, layout) {
  const width = Number(layout?.boardWidth);
  const height = Number(layout?.boardHeight);
  if (!(width > 0 && height > 0) || !layout.incomingFootprint) return null;
  const incoming = layout.incomingFootprint;
  const occupied = existingFoundations.flatMap((foundation, index) => {
    const x = Number(foundation.x) / 100 * width;
    const y = Number(foundation.y) / 100 * height;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
    const footprint = layout.existingFootprints?.[index] ?? getTutorialFoundationFootprint();
    return [{ minX: x + footprint.minX, maxX: x + footprint.maxX, minY: y + footprint.minY, maxY: y + footprint.maxY }];
  });
  if (!occupied.length) return COLLISION_AWARE_FOUNDATION_POSITIONS[0];
  const gap = 24;
  const candidates = COLLISION_AWARE_FOUNDATION_POSITIONS.map(({ x, y }) => ({ x: x / 100 * width, y: y / 100 * height }));
  const wholeReef = occupied.reduce((bounds, current) => ({
    minX: Math.min(bounds.minX, current.minX), maxX: Math.max(bounds.maxX, current.maxX),
    minY: Math.min(bounds.minY, current.minY), maxY: Math.max(bounds.maxY, current.maxY),
  }));
  // Also consider open water outside the original viewport. Fit can show it;
  // choosing a least-bad overlapping point on a crowded board cannot.
  for (const bounds of [...occupied, wholeReef]) {
    const x = (bounds.minX + bounds.maxX - incoming.minX - incoming.maxX) / 2;
    const y = (bounds.minY + bounds.maxY - incoming.minY - incoming.maxY) / 2;
    candidates.push(
      { x: bounds.maxX + gap - incoming.minX, y },
      { x: bounds.minX - gap - incoming.maxX, y },
      { x, y: bounds.maxY + gap - incoming.minY },
      { x, y: bounds.minY - gap - incoming.maxY },
    );
  }
  const placedBounds = ({ x, y }) => ({ minX: x + incoming.minX, maxX: x + incoming.maxX, minY: y + incoming.minY, maxY: y + incoming.maxY });
  const isClear = (candidate) => {
    const next = placedBounds(candidate);
    return occupied.every((bounds) => next.maxX + gap <= bounds.minX || next.minX >= bounds.maxX + gap || next.maxY + gap <= bounds.minY || next.minY >= bounds.maxY + gap);
  };
  const fitScore = (candidate) => {
    const next = placedBounds(candidate);
    return Math.max(
      (Math.max(wholeReef.maxX, next.maxX) - Math.min(wholeReef.minX, next.minX)) / width,
      (Math.max(wholeReef.maxY, next.maxY) - Math.min(wholeReef.minY, next.minY)) / height,
    );
  };
  const target = candidates.filter(isClear).reduce((best, candidate) => !best || fitScore(candidate) < fitScore(best) ? candidate : best, null);
  return Object.freeze({ x: target.x / width * 100, y: target.y / height * 100 });
}

/** Uses the same world-space clearance as Foundations, with an ordinary
 * creature's footprint. Existing cards can include Schools, Corals, Habitats,
 * and already positioned creatures without changing any of their positions.
 */
export function getGuidedAcademyOpenWaterPlacementTarget(existingCards, layout) {
  return getMeasuredFoundationPlacement(existingCards, {
    ...layout,
    incomingFootprint: layout?.incomingFootprint ?? TUTORIAL_OPEN_WATER_FOOTPRINT,
  }) ?? { x: 72, y: 38 };
}

/**
 * Spreads a prepared lesson reef into roomy, centered rows. Four-foundation
 * lessons use two columns; larger reefs use three so their cards remain
 * readable without letting neighboring cards and slot markers collide. Rows
 * and columns may sit outside 0–100 board space; Fit measures the complete
 * authored reef and brings it onscreen.
 */
export function getPreparedTutorialFoundationPlacement(index, total) {
  const normalizedIndex = Number(index);
  const normalizedTotal = Number(total);
  if (
    !Number.isSafeInteger(normalizedIndex)
    || !Number.isSafeInteger(normalizedTotal)
    || normalizedIndex < 0
    || normalizedTotal < 1
    || normalizedIndex >= normalizedTotal
  ) {
    throw new RangeError("Prepared foundation placement requires a valid index and positive total.");
  }

  const columnCount = normalizedTotal <= 4
    ? Math.min(2, normalizedTotal)
    : Math.min(3, normalizedTotal);
  const rowCount = Math.ceil(normalizedTotal / columnCount);
  const row = Math.floor(normalizedIndex / columnCount);
  const rowStartIndex = row * columnCount;
  const itemsInRow = Math.min(columnCount, normalizedTotal - rowStartIndex);
  const column = normalizedIndex - rowStartIndex;
  return Object.freeze({
    x: 50 + (column - (itemsInRow - 1) / 2) * PREPARED_FOUNDATION_COLUMN_GAP,
    y: 50 + (row - (rowCount - 1) / 2) * PREPARED_FOUNDATION_ROW_GAP,
  });
}

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

export function getGuidedAcademyFoundationPlacementTarget(existingFoundations, layout = null) {
  if (Array.isArray(existingFoundations)) {
    const measuredTarget = layout && getMeasuredFoundationPlacement(existingFoundations, layout);
    if (measuredTarget) return measuredTarget;
    const occupied = existingFoundations
      .map(({ x, y }) => ({ x: Number(x), y: Number(y) }))
      .filter(({ x, y }) => Number.isFinite(x) && Number.isFinite(y));
    const isClear = (candidate) => occupied.every((foundation) => (
      Math.abs(candidate.x - foundation.x) >= FOUNDATION_CLEARANCE.x
      || Math.abs(candidate.y - foundation.y) >= FOUNDATION_CLEARANCE.y
    ));
    const clearTarget = COLLISION_AWARE_FOUNDATION_POSITIONS.find(isClear);
    if (clearTarget) return clearTarget;

    const separationScore = (candidate) => occupied.reduce((minimum, foundation) => {
      const horizontal = Math.abs(candidate.x - foundation.x) / FOUNDATION_CLEARANCE.x;
      const vertical = Math.abs(candidate.y - foundation.y) / FOUNDATION_CLEARANCE.y;
      return Math.min(minimum, Math.hypot(horizontal, vertical));
    }, Infinity);
    return COLLISION_AWARE_FOUNDATION_POSITIONS.reduce((best, candidate) => (
      separationScore(candidate) > separationScore(best) ? candidate : best
    ));
  }

  const index = Number(existingFoundations);
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
