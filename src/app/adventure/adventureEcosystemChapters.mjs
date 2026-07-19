import {
  SUNPATCH_QUEST_ID,
  SUNPATCH_CORRECT_INTERPRETATION_ID,
  SUNPATCH_CORRECT_RESPONSE_ID,
  SUNPATCH_OBSERVATION_COPY,
  beginSunpatchInvestigation,
  getSunpatchProgress,
  reconcileSunpatchQuest,
  recordSunpatchObservation,
  submitSunpatchInterpretation,
  submitSunpatchResponse,
  turnInSunpatchFieldwork,
} from "./adventureSunpatch.mjs";
import {
  BRACKWATER_QUEST_ID,
  BRACKWATER_INTERPRETATION_CHOICES,
  BRACKWATER_OBSERVATION_COPY,
  BRACKWATER_RESPONSE_CHOICES,
  beginBrackwaterInvestigation,
  getBrackwaterProgress,
  reconcileBrackwaterQuest,
  recordBrackwaterObservation,
  submitBrackwaterInterpretation,
  submitBrackwaterResponse,
  turnInBrackwaterFieldwork,
  recoverBrackwaterQuestFlags,
} from "./adventureBrackwater.mjs";
import {
  CURRENT_QUEST_ID,
  CURRENT_INTERPRETATION_CHOICES,
  CURRENT_OBSERVATION_COPY,
  CURRENT_RESPONSE_CHOICES,
  beginCurrentInvestigation,
  getCurrentProgress,
  reconcileCurrentQuest,
  recordCurrentObservation,
  submitCurrentInterpretation,
  submitCurrentResponse,
  turnInCurrentFieldwork,
  recoverCurrentQuestFlags,
} from "./adventureCurrent.mjs";

const SUNPATCH_INTERPRETATION_CHOICES = Object.freeze([
  Object.freeze({
    id: SUNPATCH_CORRECT_INTERPRETATION_ID,
    label: "Describe stress and lesions, then gather more evidence",
    detail: "Pale living tissue may be bleached; visible tissue loss is a lesion, not a diagnosis.",
  }),
  Object.freeze({
    id: "all-white-coral-is-dead",
    label: "Mark every pale or white coral as dead",
    detail: "Color by itself tells us whether the whole colony is alive.",
  }),
  Object.freeze({
    id: "visible-damage-proves-disease",
    label: "Diagnose coral disease from the photographs",
    detail: "Any visible tissue loss proves which disease caused it.",
  }),
]);

const SUNPATCH_RESPONSE_CHOICES = Object.freeze([
  Object.freeze({
    id: SUNPATCH_CORRECT_RESPONSE_ID,
    label: "Monitor, protect the site, and reduce supported local stress",
    detail: "Report repeat images and trends, use moorings, and address demonstrated sediment or nutrient sources.",
  }),
  Object.freeze({
    id: "replace-every-pale-coral",
    label: "Replace every pale coral immediately",
    detail: "Nursery coral can instantly cure the reef before more evidence is collected.",
  }),
  Object.freeze({
    id: "wait-without-reporting",
    label: "Wait and do not report the change",
    detail: "The reef will recover on its own, so monitoring and local protection are unnecessary.",
  }),
]);

const SUNPATCH_MEASUREMENTS = Object.freeze([
  Object.freeze({ label: "Repeat photo", detail: "Same marked position" }),
  Object.freeze({ label: "Temperature trend", detail: "Compare with the local seasonal baseline" }),
  Object.freeze({ label: "Water clarity", detail: "Record it, but do not diagnose from one reading" }),
]);

const CURRENT_OBSERVATION_PREVIEW_VARIANTS = Object.freeze({
  "source-port-loss-report": "currentReport",
  "surface-drifter-track": "currentDrifter",
  "wildlife-overlap-zone": "currentWildlife",
  "downstream-gear-accumulation": "currentGear",
});

const OBSERVATION_PREVIEW_VARIANT_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

export function getAdventureObservationPreviewVariant(definition, observationId) {
  if (typeof observationId !== "string" || !observationId.trim()) return null;
  const authoredVariant = definition?.observationPreviewVariants?.[observationId];
  if (
    typeof authoredVariant === "string"
    && OBSERVATION_PREVIEW_VARIANT_PATTERN.test(authoredVariant)
  ) {
    return authoredVariant;
  }
  return observationId.split("-")[0] || null;
}

function freezeUi(ui) {
  return Object.freeze({ ...ui });
}

function createChapterAdapter(adapter) {
  return Object.freeze({
    ...adapter,
    ui: freezeUi(adapter.ui),
  });
}

const SUNPATCH_CHAPTER = createChapterAdapter({
  townId: "sunpatch-cay",
  questId: SUNPATCH_QUEST_ID,
  fieldNoteId: "field-note-coral-observations",
  guideMetFlagId: "met-sunpatch-tavi",
  getProgress: getSunpatchProgress,
  begin: beginSunpatchInvestigation,
  reconcile: reconcileSunpatchQuest,
  recordObservation: recordSunpatchObservation,
  submitInterpretation: submitSunpatchInterpretation,
  submitResponse: submitSunpatchResponse,
  turnIn: turnInSunpatchFieldwork,
  ui: {
    chapterName: "Sunpatch Cay",
    guideName: "Tavi",
    guideQuestTitle: "Meet Tavi at Sunpatch Cay",
    guideQuestDescription: "Talk with Tavi before using the shoreline stations or the field-station consoles. He will explain what changed and how to compare the reef evidence.",
    guideGateNotice: "Meet Tavi in town before using the shoreline stations or field-station consoles.",
    recordLabel: "Voyage record",
    challengerLabel: "Sunpatch challengers",
    surveyEyebrow: "Sunpatch reef survey",
    observationNoun: "reef observations",
    observationCopy: SUNPATCH_OBSERVATION_COPY,
    measurementItems: SUNPATCH_MEASUREMENTS,
    interpretationChoices: SUNPATCH_INTERPRETATION_CHOICES,
    responseChoices: SUNPATCH_RESPONSE_CHOICES,
    interpretationTitle: "Interpret the reef evidence",
    responseTitle: "Choose a reef response",
    interpretationPrompt: "Compare all four monitoring stations. Choose the statement that separates observation from diagnosis.",
    responsePrompt: "Choose a response supported by the evidence and honest about what local action can and cannot change.",
    questTitle: "Read the Sunpatch reef",
    questDescription: "Visit the four shoreline stations, meet both residents, interpret the evidence, and choose a supported local response.",
    fieldReportTitle: "Present your reef field report",
    fieldReportDescription: "Return to Dr. Mira in the field station. She will review your observations, decisions, and resident perspectives without turning them into an unsupported diagnosis.",
    qualifierTitle: "Qualify at Tide Hall",
    qualifierDescription: "Your field report is complete. Visit Nia in Tide Hall for the 10 VP qualification duel.",
    tideMarkId: "tide-mark-sunpatch",
    tideMarkTitle: "Sunpatch Tide Mark earned",
    tideMarkDescription: "The mooring team is tracking fewer anchor crossings while the reef remains under observation. Recovery is gradual, not guaranteed.",
    activityLabel: "reef survey",
    guideStartCheckpointId: "sunpatch-guide-met",
    guideStartNotice: "The Sunpatch reef survey is active. Visit all four shoreline monitoring stations.",
    fieldPartnerMetFlagId: "met-sunpatch-mira",
    fieldPartnerIntroCheckpointId: "sunpatch-field-partner-met",
    fieldPartnerIntroNotice: "Dr. Mira has explained how the reef evidence and field-station consoles fit together.",
    fieldworkCheckpointPrefix: "sunpatch-fieldwork",
    turnInCheckpointId: "sunpatch-fieldwork-complete",
    turnInNotice: "Your Reading a Reef Field Note is complete. Nia's Tide Hall qualifier is now open.",
    interpretationGateNotice: "Record all four shoreline observations before interpreting the reef evidence.",
    responseGateNotice: "Interpret the four reef observations before choosing a response.",
  },
});

const BRACKWATER_CHAPTER = createChapterAdapter({
  townId: "brackwater-landing",
  questId: BRACKWATER_QUEST_ID,
  fieldNoteId: "field-note-estuary-conditions",
  guideMetFlagId: "met-brackwater-guide",
  getProgress: getBrackwaterProgress,
  begin: beginBrackwaterInvestigation,
  reconcile: reconcileBrackwaterQuest,
  recordObservation: recordBrackwaterObservation,
  submitInterpretation: submitBrackwaterInterpretation,
  submitResponse: submitBrackwaterResponse,
  turnIn: turnInBrackwaterFieldwork,
  ui: {
    chapterName: "Brackwater Landing",
    guideName: "Rhea",
    guideQuestTitle: "Meet Rhea at Brackwater Landing",
    guideQuestDescription: "Talk with Rhea before using the water-monitoring stations or Water Lab consoles. She will introduce the estuary question and the town's evidence plan.",
    guideGateNotice: "Meet Rhea on the central boardwalk before using the water-monitoring stations or Water Lab consoles.",
    recordLabel: "Estuary record",
    challengerLabel: "Brackwater challengers",
    surveyEyebrow: "Brackwater water survey",
    observationNoun: "water observations",
    observationCopy: BRACKWATER_OBSERVATION_COPY,
    measurementItems: Object.freeze([]),
    interpretationChoices: BRACKWATER_INTERPRETATION_CHOICES,
    responseChoices: BRACKWATER_RESPONSE_CHOICES,
    interpretationTitle: "Interpret the estuary evidence",
    responseTitle: "Choose a runoff response",
    interpretationPrompt: "Compare salinity, turbidity, and dissolved oxygen across all four sites, including tide and recent rainfall, before deciding which pattern needs investigation.",
    responsePrompt: "Choose a response tied to the repeated measurements while protecting naturally muddy mangrove nursery habitat.",
    questTitle: "Trace Brackwater's water clues",
    questDescription: "Compare four monitoring stations, hear both resident perspectives, interpret the repeated pattern, and choose a supported response.",
    fieldReportTitle: "Present your estuary field report",
    fieldReportDescription: "Return to Dr. Sola in the Water Lab. She will review how the sites, tides, rainfall, and repeated measurements support your conclusion.",
    qualifierTitle: "Qualify at Brackwater Tide Hall",
    qualifierDescription: "Your field report is complete. Visit Amina in Tide Hall for the 10 VP qualification duel.",
    tideMarkId: "tide-mark-brackwater",
    tideMarkTitle: "Brackwater Tide Mark earned",
    tideMarkDescription: "The town is tracing the supported runoff pathway while continuing to monitor normal estuary variation across tides and rain events.",
    activityLabel: "estuary survey",
    guideStartCheckpointId: "brackwater-guide-met",
    guideStartNotice: "The Brackwater estuary survey is active. Compare all four water-monitoring stations.",
    fieldPartnerMetFlagId: "met-brackwater-scientist",
    fieldPartnerIntroCheckpointId: "brackwater-field-partner-met",
    fieldPartnerIntroNotice: "Dr. Sola has explained how the water measurements and Water Lab consoles fit together.",
    fieldworkCheckpointPrefix: "brackwater-fieldwork",
    turnInCheckpointId: "brackwater-fieldwork-complete",
    turnInNotice: "Your Changing Estuary Water Field Note is complete. The Tide Hall qualifier is now open.",
    interpretationGateNotice: "Record all four water observations before interpreting the estuary evidence.",
    responseGateNotice: "Interpret the four estuary observations before choosing a response.",
  },
});

const CURRENT_CHAPTER = createChapterAdapter({
  townId: "current-commons",
  questId: CURRENT_QUEST_ID,
  fieldNoteId: "field-note-current-connections",
  guideMetFlagId: "met-current-guide",
  getProgress: getCurrentProgress,
  begin: beginCurrentInvestigation,
  reconcile: reconcileCurrentQuest,
  recordObservation: recordCurrentObservation,
  submitInterpretation: submitCurrentInterpretation,
  submitResponse: submitCurrentResponse,
  turnIn: turnInCurrentFieldwork,
  ui: {
    chapterName: "Current Commons",
    guideName: "Suri",
    guideQuestTitle: "Meet Suri at Current Commons",
    guideQuestDescription: "Talk with Suri before using the flotilla stations or Navigation Lab consoles. She will introduce the lost-gear question and the town's safe evidence plan.",
    guideGateNotice: "Meet Suri in the central plaza before using the observation stations or Navigation Lab consoles.",
    recordLabel: "Flotilla record",
    challengerLabel: "Current Commons challengers",
    surveyEyebrow: "Current Commons drift survey",
    observationNoun: "current and gear observations",
    observationCopy: CURRENT_OBSERVATION_COPY,
    observationPreviewVariants: CURRENT_OBSERVATION_PREVIEW_VARIANTS,
    measurementItems: Object.freeze([]),
    interpretationChoices: CURRENT_INTERPRETATION_CHOICES,
    responseChoices: CURRENT_RESPONSE_CHOICES,
    interpretationTitle: "Connect the current evidence",
    responseTitle: "Choose a safe ghost-gear response",
    interpretationPrompt: "Compare the dated loss report, short-term drifter path, wildlife overlap, and repeated accumulation. Choose the conclusion the combined evidence supports without claiming certainty or ownership.",
    responsePrompt: "Choose a response that protects people and wildlife now while also reducing the chance and duration of another gear loss.",
    questTitle: "Trace Current Commons' ghost gear",
    questDescription: "Record four current-and-gear observations, hear both resident perspectives, identify the supported risk corridor, and plan safe response plus prevention.",
    fieldReportTitle: "Present your current-and-gear report",
    fieldReportDescription: "Return to Dr. Amara Nwosu in the Navigation Lab. She will review what the current evidence supports, where uncertainty remains, and why trained responders handle removal.",
    qualifierTitle: "Qualify at Current Commons Tide Hall",
    qualifierDescription: "Your field report is complete. Visit Orla in Tide Hall for the 10 VP qualification duel.",
    tideMarkId: "tide-mark-current",
    tideMarkTitle: "Current Commons Tide Mark earned",
    tideMarkDescription: "Authorized responders are using the reported corridor while the flotilla strengthens gear checks, storm planning, and prompt loss reporting.",
    activityLabel: "current-and-gear survey",
    guideStartCheckpointId: "current-guide-met",
    guideStartNotice: "The Current Commons survey is active. Compare all four current-and-gear observation stations.",
    fieldPartnerMetFlagId: "met-current-analyst",
    fieldPartnerIntroCheckpointId: "current-field-partner-met",
    fieldPartnerIntroNotice: "Dr. Amara has explained how the four observations and Navigation Lab decisions fit together.",
    fieldworkCheckpointPrefix: "current-fieldwork",
    turnInCheckpointId: "current-fieldwork-complete",
    turnInNotice: "Your Connected by Currents Field Note is complete. The Tide Hall qualifier is now open.",
    interpretationGateNotice: "Record all four current-and-gear observations before interpreting the likely drift corridor.",
    responseGateNotice: "Reach an evidence-supported interpretation before choosing a response.",
  },
});

/**
 * Runtime-only adapters for ecosystem chapters. Functions stay outside the
 * serialized save contract; only their canonical IDs and resulting save data
 * cross a storage boundary.
 */
export const ADVENTURE_ECOSYSTEM_CHAPTERS = Object.freeze([
  SUNPATCH_CHAPTER,
  BRACKWATER_CHAPTER,
  CURRENT_CHAPTER,
]);

const CHAPTER_FLAG_RECOVERERS = Object.freeze([
  Object.freeze({ questId: BRACKWATER_QUEST_ID, recover: recoverBrackwaterQuestFlags }),
  Object.freeze({ questId: CURRENT_QUEST_ID, recover: recoverCurrentQuestFlags }),
]);

const CHAPTER_BY_TOWN_ID = new Map(
  ADVENTURE_ECOSYSTEM_CHAPTERS.map((chapter) => [chapter.townId, chapter]),
);
const CHAPTER_BY_QUEST_ID = new Map(
  ADVENTURE_ECOSYSTEM_CHAPTERS.map((chapter) => [chapter.questId, chapter]),
);

export function getAdventureEcosystemChapterByTownId(townId) {
  return CHAPTER_BY_TOWN_ID.get(townId) ?? null;
}

export function getAdventureEcosystemChapterByQuestId(questId) {
  return CHAPTER_BY_QUEST_ID.get(questId) ?? null;
}

export function isAdventureEcosystemChapterQuest(questId) {
  return CHAPTER_BY_QUEST_ID.has(questId);
}

/**
 * Repairs chapter-specific persisted flag types at the storage boundary while
 * preserving unrelated and forward-compatible quest flags.
 */
export function recoverAdventureEcosystemChapterFlags(saveValue) {
  let save = saveValue;
  const repairs = [];
  for (const { questId, recover } of CHAPTER_FLAG_RECOVERERS) {
    const result = recover(save);
    save = result.save;
    if (!result.applied) continue;
    repairs.push(Object.freeze({
      questId,
      discardedFlagIds: result.discardedFlagIds,
    }));
  }
  return {
    save,
    applied: repairs.length > 0,
    repairs: Object.freeze(repairs),
  };
}

function getChapterQuestFlags(chapter, saveValue) {
  if (!chapter || !saveValue) return {};
  return saveValue.progression?.quests?.[chapter.questId]?.flags ?? {};
}

/** Keeps fieldwork UI behind the local guide's chapter briefing. */
export function hasMetAdventureEcosystemGuide(chapter, saveValue) {
  if (!chapter) return false;
  return getChapterQuestFlags(chapter, saveValue)[chapter.guideMetFlagId] === true;
}

/** Selects authored non-duel dialogue without leaking runtime functions into saves. */
export function getAdventureEcosystemConversationMode(
  chapter,
  roleId,
  saveValue,
  progressValue = null,
) {
  if (!chapter) return "guidance";
  const flags = getChapterQuestFlags(chapter, saveValue);
  const progress = progressValue ?? chapter.getProgress(saveValue);

  if (roleId === "local-guide") {
    if (flags[chapter.guideMetFlagId] !== true) return "intro";
    return progress.complete ? "return" : "guidance";
  }

  if (roleId === "field-partner") {
    if (flags[chapter.ui.fieldPartnerMetFlagId] !== true) return "intro";
    if (progress.readyToTurnIn) return "debrief";
    return progress.complete ? "return" : "guidance";
  }

  return progress.complete ? "return" : "guidance";
}
