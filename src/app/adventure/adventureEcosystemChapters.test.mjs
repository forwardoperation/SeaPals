import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  BRACKWATER_CORRECT_INTERPRETATION_ID,
  BRACKWATER_CORRECT_RESPONSE_ID,
  BRACKWATER_QUEST_ID,
  BRACKWATER_REQUIRED_OBSERVATION_IDS,
} from "./adventureBrackwater.mjs";
import {
  CURRENT_REQUIRED_OBSERVATION_IDS,
  CURRENT_QUEST_ID,
} from "./adventureCurrent.mjs";
import {
  KELPWATCH_CORRECT_INTERPRETATION_ID,
  KELPWATCH_CORRECT_RESPONSE_ID,
  KELPWATCH_QUEST_ID,
  KELPWATCH_REQUIRED_OBSERVATION_IDS,
} from "./adventureKelpwatch.mjs";
import {
  ADVENTURE_ECOSYSTEM_CHAPTERS,
  getAdventureEcosystemConversationMode,
  getAdventureEcosystemChapterByQuestId,
  getAdventureEcosystemChapterByTownId,
  getAdventureObservationPreviewVariant,
  hasMetAdventureEcosystemGuide,
  isAdventureEcosystemChapterQuest,
} from "./adventureEcosystemChapters.mjs";
import { createInitialAdventureSave, setQuestFlag } from "./adventureProgression.mjs";
import { SUNPATCH_QUEST_ID } from "./adventureSunpatch.mjs";

const ADAPTER_KEYS = [
  "begin",
  "fieldNoteId",
  "getProgress",
  "guideMetFlagId",
  "questId",
  "reconcile",
  "recordObservation",
  "submitInterpretation",
  "submitResponse",
  "townId",
  "turnIn",
  "ui",
];

test("the ecosystem registry exposes complete, immutable adapters with unique canonical IDs", () => {
  assert.equal(ADVENTURE_ECOSYSTEM_CHAPTERS.length, 4);
  assert.deepEqual(
    ADVENTURE_ECOSYSTEM_CHAPTERS.map(({ townId }) => townId),
    ["sunpatch-cay", "brackwater-landing", "current-commons", "kelpwatch-island"],
  );
  assert.equal(
    new Set(ADVENTURE_ECOSYSTEM_CHAPTERS.map(({ townId }) => townId)).size,
    ADVENTURE_ECOSYSTEM_CHAPTERS.length,
  );
  assert.equal(
    new Set(ADVENTURE_ECOSYSTEM_CHAPTERS.map(({ questId }) => questId)).size,
    ADVENTURE_ECOSYSTEM_CHAPTERS.length,
  );

  for (const adapter of ADVENTURE_ECOSYSTEM_CHAPTERS) {
    assert.deepEqual(Object.keys(adapter).sort(), ADAPTER_KEYS);
    assert.equal(Object.isFrozen(adapter), true);
    assert.equal(Object.isFrozen(adapter.ui), true);
    for (const method of [
      "getProgress",
      "begin",
      "reconcile",
      "recordObservation",
      "submitInterpretation",
      "submitResponse",
      "turnIn",
    ]) {
      assert.equal(typeof adapter[method], "function", `${adapter.questId}.${method}`);
    }
    for (const uiKey of [
      "guideGateNotice",
      "guideQuestDescription",
      "guideQuestTitle",
      "fieldPartnerIntroCheckpointId",
      "fieldPartnerIntroNotice",
      "fieldPartnerMetFlagId",
    ]) {
      assert.equal(typeof adapter.ui[uiKey], "string", `${adapter.questId}.ui.${uiKey}`);
      assert.ok(adapter.ui[uiKey].length > 0, `${adapter.questId}.ui.${uiKey}`);
    }
  }
});

test("chapters resolve by town or quest without exposing mutable registry state", () => {
  const sunpatchByTown = getAdventureEcosystemChapterByTownId("sunpatch-cay");
  const sunpatchByQuest = getAdventureEcosystemChapterByQuestId(SUNPATCH_QUEST_ID);
  assert.equal(sunpatchByTown, sunpatchByQuest);
  assert.equal(sunpatchByTown.fieldNoteId, "field-note-coral-observations");
  assert.equal(sunpatchByTown.guideMetFlagId, "met-sunpatch-tavi");

  const brackwater = getAdventureEcosystemChapterByQuestId(BRACKWATER_QUEST_ID);
  assert.equal(brackwater, getAdventureEcosystemChapterByTownId("brackwater-landing"));
  assert.equal(brackwater.fieldNoteId, "field-note-estuary-conditions");
  assert.equal(brackwater.guideMetFlagId, "met-brackwater-guide");

  const current = getAdventureEcosystemChapterByQuestId(CURRENT_QUEST_ID);
  assert.equal(current, getAdventureEcosystemChapterByTownId("current-commons"));
  assert.equal(current.fieldNoteId, "field-note-current-connections");
  assert.equal(current.guideMetFlagId, "met-current-guide");

  const kelpwatch = getAdventureEcosystemChapterByQuestId(KELPWATCH_QUEST_ID);
  assert.equal(kelpwatch, getAdventureEcosystemChapterByTownId("kelpwatch-island"));
  assert.equal(kelpwatch.fieldNoteId, "field-note-kelp-food-web");
  assert.equal(kelpwatch.guideMetFlagId, "met-kelpwatch-guide");

  assert.equal(getAdventureEcosystemChapterByTownId("shellshore-village"), null);
  assert.equal(getAdventureEcosystemChapterByQuestId("quest-shellshore-first-voyage"), null);
  assert.equal(isAdventureEcosystemChapterQuest(BRACKWATER_QUEST_ID), true);
  assert.equal(isAdventureEcosystemChapterQuest(CURRENT_QUEST_ID), true);
  assert.equal(isAdventureEcosystemChapterQuest(KELPWATCH_QUEST_ID), true);
  assert.equal(isAdventureEcosystemChapterQuest("quest-shellshore-first-voyage"), false);
});

test("every Kelpwatch observation has a distinct authored preview and its adapter survives storage", () => {
  const adapter = getAdventureEcosystemChapterByQuestId(KELPWATCH_QUEST_ID);
  const variants = KELPWATCH_REQUIRED_OBSERVATION_IDS.map((observationId) => (
    getAdventureObservationPreviewVariant(adapter.ui, observationId)
  ));
  assert.equal(new Set(variants).size, KELPWATCH_REQUIRED_OBSERVATION_IDS.length);
  assert.equal(Object.isFrozen(adapter.ui.observationPreviewVariants), true);
  const styles = readFileSync(new URL("./adventure.module.css", import.meta.url), "utf8");
  for (const variant of variants) {
    assert.match(styles, new RegExp(`\\.observation${variant}\\b`));
  }

  let result = adapter.begin(createInitialAdventureSave("kelpwatch-adapter-json"));
  for (const observationId of KELPWATCH_REQUIRED_OBSERVATION_IDS) {
    result = adapter.recordObservation(
      JSON.parse(JSON.stringify(result.save)),
      observationId,
    );
  }
  result = adapter.submitInterpretation(
    JSON.parse(JSON.stringify(result.save)),
    KELPWATCH_CORRECT_INTERPRETATION_ID,
  );
  assert.equal(result.correct, true);
  result = adapter.submitResponse(
    JSON.parse(JSON.stringify(result.save)),
    KELPWATCH_CORRECT_RESPONSE_ID,
  );
  assert.equal(result.correct, true);
  assert.deepEqual(JSON.parse(JSON.stringify(result.save)), result.save);
});

test("every Current observation resolves to a distinct authored non-coral preview", () => {
  const current = getAdventureEcosystemChapterByQuestId(CURRENT_QUEST_ID);
  const variants = CURRENT_REQUIRED_OBSERVATION_IDS.map((observationId) => (
    getAdventureObservationPreviewVariant(current.ui, observationId)
  ));

  assert.deepEqual(variants, [
    "currentReport",
    "currentDrifter",
    "currentWildlife",
    "currentGear",
  ]);
  assert.equal(new Set(variants).size, CURRENT_REQUIRED_OBSERVATION_IDS.length);
  assert.equal(Object.isFrozen(current.ui.observationPreviewVariants), true);
  const styles = readFileSync(new URL("./adventure.module.css", import.meta.url), "utf8");
  for (const variant of variants) {
    assert.match(styles, new RegExp(`\\.observation${variant}\\b`));
  }
  assert.equal(getAdventureObservationPreviewVariant(current.ui, null), null);
  assert.equal(
    getAdventureObservationPreviewVariant({}, "bleached-reference-colony"),
    "bleached",
  );
});

test("adapter methods operate on canonical saves across JSON storage boundaries", () => {
  const adapter = getAdventureEcosystemChapterByTownId("brackwater-landing");
  const stored = JSON.stringify(createInitialAdventureSave("chapter-json"));
  let result = adapter.begin(JSON.parse(stored));
  assert.equal(result.progress.status, "active");

  result = adapter.recordObservation(
    JSON.parse(JSON.stringify(result.save)),
    BRACKWATER_REQUIRED_OBSERVATION_IDS[0],
  );
  assert.deepEqual(result.progress.observedObservationIds, [
    BRACKWATER_REQUIRED_OBSERVATION_IDS[0],
  ]);

  for (const observationId of BRACKWATER_REQUIRED_OBSERVATION_IDS.slice(1)) {
    result = adapter.recordObservation(
      JSON.parse(JSON.stringify(result.save)),
      observationId,
    );
  }

  result = adapter.submitInterpretation(
    JSON.parse(JSON.stringify(result.save)),
    BRACKWATER_CORRECT_INTERPRETATION_ID,
  );
  assert.equal(result.correct, true);
  result = adapter.submitResponse(
    JSON.parse(JSON.stringify(result.save)),
    BRACKWATER_CORRECT_RESPONSE_ID,
  );
  assert.equal(result.correct, true);

  const reconciled = adapter.reconcile(JSON.parse(JSON.stringify(result.save)));
  assert.equal(reconciled.progress.status, "active");
  assert.deepEqual(JSON.parse(JSON.stringify(reconciled.save)), reconciled.save);
});

test("guide gating and field-partner dialogue advance through authored first meetings", () => {
  const chapter = getAdventureEcosystemChapterByTownId("brackwater-landing");
  let save = chapter.begin(createInitialAdventureSave("chapter-dialogue")).save;
  const activeProgress = chapter.getProgress(save);

  assert.equal(hasMetAdventureEcosystemGuide(chapter, save), false);
  assert.equal(
    getAdventureEcosystemConversationMode(chapter, "local-guide", save, activeProgress),
    "intro",
  );
  assert.equal(
    getAdventureEcosystemConversationMode(chapter, "field-partner", save, activeProgress),
    "intro",
  );

  save = setQuestFlag(save, chapter.questId, chapter.guideMetFlagId, true);
  assert.equal(hasMetAdventureEcosystemGuide(chapter, save), true);
  assert.equal(
    getAdventureEcosystemConversationMode(chapter, "local-guide", save, activeProgress),
    "guidance",
  );
  assert.equal(
    getAdventureEcosystemConversationMode(chapter, "field-partner", save, activeProgress),
    "intro",
  );

  save = setQuestFlag(save, chapter.questId, chapter.ui.fieldPartnerMetFlagId, true);
  assert.equal(
    getAdventureEcosystemConversationMode(chapter, "field-partner", save, activeProgress),
    "guidance",
  );
  assert.equal(
    getAdventureEcosystemConversationMode(
      chapter,
      "field-partner",
      save,
      { ...activeProgress, readyToTurnIn: true },
    ),
    "debrief",
  );
  assert.equal(
    getAdventureEcosystemConversationMode(
      chapter,
      "field-partner",
      save,
      { ...activeProgress, readyToTurnIn: false, complete: true },
    ),
    "return",
  );
  assert.equal(
    getAdventureEcosystemConversationMode(
      chapter,
      "local-guide",
      save,
      { ...activeProgress, complete: true },
    ),
    "return",
  );
});
