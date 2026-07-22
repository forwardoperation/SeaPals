const MIN_SPEECH_DURATION_MS = 700;
const MAX_SPEECH_DURATION_MS = 3800;
const MS_PER_GRAPHEME = 16;

const PROFESSOR_LEAD_BY_TARGET = Object.freeze({
  hand: "Let's check your hand. ",
  "play-card": "This card is ready. ",
  placement: "Now choose a legal place. ",
  "turn-button": "The turn control is next. ",
  "draw-controls": "Now choose this round's draw. ",
  "confirm-draw": "Your draw choice is ready. ",
  "continue-actions": "The draw is complete. ",
  "close-modal": "Let's clear this panel first. ",
  "player-board": "Look at your ecosystem. ",
  "opponent-board": "Now look across at my ecosystem. ",
  "attack-button": "This attack is ready. ",
  "utility-action-button": "This card action is ready. ",
  "condition-continue": "Let's read the round condition. ",
  "script-discard-cards": "Scavenge begins with its discard cost. ",
  "script-discard-confirm": "Your discard choices are ready. ",
  "script-search-card": "Now choose what Scavenge finds. ",
  "search-card": "Now choose the planned search result. ",
  "faceoff-action": "The faceoff control is ready. ",
  "rp-bank": "Notice your RP bank. ",
  "vp-score": "Notice your VP total. ",
});

export function getProfessorConversationLead(help = {}) {
  if (Object.prototype.hasOwnProperty.call(help ?? {}, "lead")) return String(help.lead ?? "");
  return PROFESSOR_LEAD_BY_TARGET[help.target] ?? "";
}

export function createProfessorSpokenMessage(help = {}) {
  const message = String(help.message ?? "").trim();
  return `${getProfessorConversationLead(help)}${message}`.trim();
}

export function segmentProfessorMessage(message) {
  const text = String(message ?? "");
  if (!text) return [];
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return [...segmenter.segment(text)].map((entry) => entry.segment);
  }
  return Array.from(text);
}

export function getProfessorSpeechDuration(graphemeCount) {
  const count = Math.max(0, Number(graphemeCount) || 0);
  if (!count) return 0;
  return Math.min(MAX_SPEECH_DURATION_MS, Math.max(MIN_SPEECH_DURATION_MS, count * MS_PER_GRAPHEME));
}

export function getProfessorVisibleGraphemeCount({
  graphemeCount,
  elapsedMs,
  durationMs = getProfessorSpeechDuration(graphemeCount),
  reducedMotion = false,
  showAll = false,
} = {}) {
  const count = Math.max(0, Math.floor(Number(graphemeCount) || 0));
  if (!count || reducedMotion || showAll) return count;
  const duration = Math.max(1, Number(durationMs) || 1);
  const progress = Math.min(1, Math.max(0, (Number(elapsedMs) || 0) / duration));
  return Math.min(count, Math.floor(progress * count));
}

export function createProfessorSpeechKey(cueId, message) {
  return `${String(cueId ?? "tutorial-help")}\u0000${String(message ?? "")}`;
}

export function createProfessorAnnouncement({ guideName, help, step, total, message } = {}) {
  if (!help) return "";
  const authoredProgress = String(help.progressLabel ?? "").trim();
  const progress = authoredProgress || (help.id === "tutorial-complete"
    ? `${Number(total) || 0} of ${Number(total) || 0} complete`
    : `Step ${Number(step) || 1} of ${Number(total) || 1}`);
  return [
    String(guideName ?? "Professor"),
    progress,
    String(help.title ?? "Tutorial guidance"),
    String(message ?? help.message ?? ""),
    help.action ? `Next: ${help.action}` : "",
    help.targetLabel ? `Look for ${help.targetLabel}` : "",
  ].filter(Boolean).join(". ");
}
