import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import { createJiti } from "jiti";
import { drawWithHandLimit } from "./gameRules.mjs";

const jiti = createJiti(import.meta.url, { fsCache: false });
const { cardsById } = jiti("../../data/cards/index.js");
const types = jiti("../../data/cards/types.js");
const source = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
const functionNames = [
  "getPlayError", "playCardFromHand", "completeOceanJakeRecovery",
  "cancelSupportSearch", "returnFromSupportFlowToBoard", "applyCurrentHandLimit",
  "applyExplicitSupportLock", "inspectSearchResult", "closeCardInspector",
];
const functionSources = functionNames.map((name) => {
  const start = source.indexOf(`  function ${name}(`);
  const end = source.indexOf("\n  }", start) + 4;
  assert.ok(start >= 0 && end > start, `Missing ${name}`);
  return source.slice(start, end);
});
const plain = (value) => JSON.parse(JSON.stringify(value));

function runtime(overrides = {}) {
  const state = {
    ...types, cardsById, drawWithHandLimit,
    gameResult: null, gamePhase: "main", isSetup: false, round: 3, rp: 5,
    boardStatSequenceRef: { current: null }, compactTurnSequenceRef: { current: null },
    attackContext: null, playingCardId: null, activeCondition: null,
    hand: ["ocean-jake", "recovery"], lostZone: ["whale-shark", "whale-shark", "lionfish"],
    discardPile: [], cardsBlockedFromPlayThisTurn: [], playerHabitats: [],
    playerCorals: [], playerReefCreatures: [], playerOrphanCreatures: [],
    supportBlockedUntilRound: 0, aideBlockedUntilRound: 0, supportLockSourceId: null,
    tutorialUsesScriptedScenario: false, scriptedFinishRoute: null, tutorialHelp: null,
    tutorialGuide: { name: "Guide" }, previewExperience: true,
    modal: null, searchContext: null, inspectedCard: null, selectedHandCard: "ocean-jake",
    playError: "", log: [], eventOverlay: null,
    inspectorReturnFocusRef: { current: null },
    getConditionPlayRestriction: () => "", getHabitatRequirementError: () => "",
    getCompositionRequirementError: () => "", cardUsesOpponentReef: () => false,
    isFoundationCard: () => false,
    getPlayerSchoolDensityRequirement: () => ({ effectiveRequirement: 0 }),
    getPlayerSchoolDensityAvailableForPlay: () => 0,
    getPlayerCardPlayCost: (card) => card.cost?.rp ?? 0,
    getPlayerRpSpendPresentation: () => ({}),
    getEmbeddedLessonBlock: () => "", getAcademyCardPlayBlock: () => "",
    trackSimulatorAnalytics: () => {}, emitTutorialEvent: () => {},
    SIMULATOR_TUTORIAL_ACTION_TYPES: { SUPPORT_PLAYED: "support-played" },
    supportExplicitlyLocksFurtherSupports: () => false,
    removeOneCard: (cards, id) => {
      const next = [...cards];
      const index = next.indexOf(id);
      if (index >= 0) next.splice(index, 1);
      return next;
    },
    ...overrides,
  };
  const context = vm.createContext(state);
  for (const [setter, key] of Object.entries({
    setHand: "hand", setLostZone: "lostZone", setDiscardPile: "discardPile",
    setCardsBlockedFromPlayThisTurn: "cardsBlockedFromPlayThisTurn", setRp: "rp",
    setSupportLockSourceId: "supportLockSourceId", setSearchContext: "searchContext",
    setModal: "modal", setSelectedHandCard: "selectedHandCard", setPlayError: "playError",
    setEventOverlay: "eventOverlay", setTurnDrawSelection: "turnDrawSelection",
    setInspectedCard: "inspectedCard",
  })) {
    context[setter] = (value) => { context[key] = typeof value === "function" ? value(context[key]) : value; };
  }
  context.pushLog = (message) => context.log.push(message);
  for (const code of functionSources) vm.runInContext(code, context);
  return context;
}

test("Ocean Jake opens Lost Zone recovery, allows inspection, and recovers exactly one copy", () => {
  const r = runtime();
  assert.equal(r.getPlayError(cardsById["ocean-jake"]), "");
  r.playCardFromHand("ocean-jake");
  assert.equal(r.modal, "lost-recover");
  assert.deepEqual(plain(r.searchContext.candidates), ["whale-shark", "lionfish"]);
  assert.deepEqual(plain(r.hand), ["ocean-jake", "recovery"], "Opening the picker spends nothing");

  r.inspectSearchResult("whale-shark");
  assert.equal(r.inspectedCard.cardId, "whale-shark");
  r.closeCardInspector();
  assert.equal(r.modal, "lost-recover");
  assert.equal(r.searchContext.mode, "ocean-jake");

  r.completeOceanJakeRecovery("whale-shark");
  assert.deepEqual(plain(r.hand), ["recovery", "whale-shark"]);
  assert.deepEqual(plain(r.lostZone), ["ocean-jake", "whale-shark", "lionfish"]);
  assert.deepEqual(plain(r.discardPile), []);
  assert.equal(r.rp, 5);
  assert.equal(r.supportLockSourceId, null);
  assert.deepEqual(plain(r.cardsBlockedFromPlayThisTurn), ["whale-shark"]);
  assert.match(r.getPlayError(cardsById["whale-shark"]), /cannot be played until your next turn/);
  assert.equal(r.modal, null);
  assert.equal(r.searchContext, null);
  assert.equal(r.eventOverlay.success, true);
});

test("Ocean Jake gives an empty Lost Zone reason without opening or spending anything", () => {
  const r = runtime({ lostZone: [] });
  r.playCardFromHand("ocean-jake");
  assert.match(r.playError, /Ocean Jake needs a card in your Lost Zone/);
  assert.equal(r.modal, null);
  assert.equal(r.searchContext, null);
  assert.deepEqual(plain(r.hand), ["ocean-jake", "recovery"]);
  assert.equal(r.supportLockSourceId, null);
  assert.equal(r.rp, 5);
});

for (const previewExperience of [true, false]) {
  test(`canceling Ocean Jake spends nothing in ${previewExperience ? "V2" : "legacy"} layout`, () => {
    const r = runtime({ previewExperience });
    r.playCardFromHand("ocean-jake");
    assert.equal(r.modal, "lost-recover");
    r.cancelSupportSearch();
    assert.equal(r.modal, previewExperience ? null : "hand");
    assert.equal(r.searchContext, null);
    assert.deepEqual(plain(r.hand), ["ocean-jake", "recovery"]);
    assert.deepEqual(plain(r.lostZone), ["whale-shark", "whale-shark", "lionfish"]);
    assert.equal(r.rp, 5);
    assert.equal(r.supportLockSourceId, null);
  });
}

test("Ocean Jake still respects turn timing, Support restrictions, and RP costs", () => {
  for (const [overrides, reason] of [
    [{ gamePhase: "draw" }, /action phase/],
    [{ supportBlockedUntilRound: 3 }, /Echo Disruption/],
    [{ supportLockSourceId: "dr-evans" }, /cannot play another Support/],
    [{ rp: 0, getPlayerCardPlayCost: () => 1 }, /Not enough RP/],
  ]) {
    const r = runtime(overrides);
    r.playCardFromHand("ocean-jake");
    assert.match(r.playError, reason);
    assert.equal(r.modal, null);
    assert.deepEqual(plain(r.hand), ["ocean-jake", "recovery"]);
  }
});

test("Ocean Jake ignores invalid recovery targets and stale repeat confirmations", () => {
  const r = runtime();
  r.playCardFromHand("ocean-jake");
  r.completeOceanJakeRecovery("nurse-shark");
  assert.deepEqual(plain(r.hand), ["ocean-jake", "recovery"]);
  assert.equal(r.modal, "lost-recover");
  r.completeOceanJakeRecovery("lionfish");
  const recoveredState = plain({ hand: r.hand, lostZone: r.lostZone, log: r.log });
  r.completeOceanJakeRecovery("whale-shark");
  assert.deepEqual(plain({ hand: r.hand, lostZone: r.lostZone, log: r.log }), recoveredState);
});
