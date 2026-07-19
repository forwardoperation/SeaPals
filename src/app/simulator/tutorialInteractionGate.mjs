function academyRouteIsActive(route) {
  return Boolean(
    route?.active
    && Number(route?.plan?.curriculumVersion ?? 0) >= 2,
  );
}

function requiredCardName(route, cardId) {
  return Object.values(route?.cards ?? {}).find((card) => card?.cardId === cardId)?.cardName
    ?? cardId
    ?? "the highlighted card";
}

function tutorialGuideName(guideName) {
  return String(guideName ?? "Mr. Easterling").trim() || "Mr. Easterling";
}

function academyPlacementRequirement(route, cardId) {
  if (!academyRouteIsActive(route)) return null;
  return route?.plan?.placementPlan?.[String(cardId ?? "").trim()] ?? null;
}

/**
 * The Academy teaches deliberate placement as part of deck sequencing. A
 * rules-legal but strategically wrong slot can reserve the only Predator or
 * Apex space and make a later authored lesson impossible.
 */
export function isAcademyPlacementAllowed({
  route,
  cardId,
  foundationCardId,
  slotClass,
} = {}) {
  const requirement = academyPlacementRequirement(route, cardId);
  if (!requirement) return true;
  return (
    String(foundationCardId ?? "").trim() === requirement.foundationCardId
    && String(slotClass ?? "").trim() === requirement.slotClass
  );
}

export function getAcademyPlacementBlock(details = {}) {
  if (isAcademyPlacementAllowed(details)) return "";
  const requirement = academyPlacementRequirement(details.route, details.cardId);
  const foundationName = details.route?.cards
    ? Object.values(details.route.cards).find((card) => (
        card?.cardId === requirement?.foundationCardId
      ))?.cardName
    : null;
  const cardName = requiredCardName(details.route, details.cardId);
  const slotName = String(requirement?.slotClass ?? "prepared").replace(/-/g, " ");
  return `Place ${cardName} in ${foundationName ?? requirement?.foundationCardId ?? "the highlighted foundation"}'s ${slotName} slot. That keeps the later Predator and Apex spaces available for the lesson.`;
}

/**
 * The Academy is an authored lesson rather than a free-practice match. These
 * guards keep an accidental extra click from spending RP or skipping a card
 * type before the current tutorial guide has taught it.
 */
export function getAcademyCardPlayBlock({ route, help, cardId, guideName } = {}) {
  if (!academyRouteIsActive(route)) return "";
  const requiredCardId = String(help?.targetCardId ?? "").trim();
  if (requiredCardId && requiredCardId === String(cardId ?? "").trim()) return "";
  if (requiredCardId) {
    return `${tutorialGuideName(guideName)} has prepared ${requiredCardName(route, requiredCardId)} for this step. Follow the highlighted card so the lesson stays on course.`;
  }
  return `${tutorialGuideName(guideName)} has prepared a board action or the end of the turn next. Complete the highlighted lesson step before playing another card.`;
}

export function getAcademyActionBlock({ route, help, actionKey, target, guideName } = {}) {
  if (!academyRouteIsActive(route)) return "";
  const requiredActionKey = String(help?.targetActionKey ?? "").trim();
  if (
    requiredActionKey
    && requiredActionKey === String(actionKey ?? "").trim()
    && help?.target === target
  ) return "";
  return `${tutorialGuideName(guideName)} has prepared a different action for this lesson step. Follow the highlighted card and action button first.`;
}

export function getAcademyEndTurnBlock({ route, help, guideName } = {}) {
  if (!academyRouteIsActive(route) || help?.target === "turn-button") return "";
  return `Finish ${tutorialGuideName(guideName)}'s highlighted lesson step before ending the turn.`;
}
