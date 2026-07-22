const NO_SECONDARY_MODES = new Set([
  "worldIntroduction",
  "victory",
  "roundVictory",
  "exhibitionVictory",
  "onboardingGate",
  "locked",
]);

function primaryOnlyClosesConversation(trainer, mode) {
  if (trainer.id === "academy-mentor" || trainer.encounterId) return false;
  if (trainer.roleId === "tournament-director") return false;
  if (trainer.roleId === "local-guide" && mode === "intro") return false;
  if (trainer.roleId === "field-partner" && ["intro", "debrief"].includes(mode)) return false;
  return true;
}

/**
 * Returns a real alternative to the primary conversation action, or null when
 * a second button would merely close the same dialogue under different copy.
 */
export function getAdventureConversationSecondaryAction({
  trainer,
  mode,
  canOfferSunpatchExhibition = false,
}) {
  if (!trainer || typeof trainer !== "object") return null;
  if (canOfferSunpatchExhibition) {
    return Object.freeze({ kind: "exhibition", label: "Play optional 30 VP exhibition" });
  }
  if (NO_SECONDARY_MODES.has(mode) || primaryOnlyClosesConversation(trainer, mode)) {
    return null;
  }
  if (mode === "practiceLoss" || mode === "practiceExit") {
    return Object.freeze({ kind: "close", label: "Take a break" });
  }
  if (mode === "defeat") {
    return Object.freeze({ kind: "close", label: "Return to the Arena" });
  }
  return Object.freeze({ kind: "close", label: "Not yet" });
}
