import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import { createJiti } from "jiti";
import { calculateRpBankCap, getCardRpBankCapModifier } from "./gameRules.mjs";
import { collectReefAbilityCreatures, creatureAbilityCard, stunCreatureAbilities } from "./reefAbilityRules.mjs";
import { coralIsStunned } from "./specialCardRules.mjs";
import { createSchoolDensityBucketState } from "./schoolDensityRules.mjs";
import { createSimulatorAnalyticsSnapshot, getSimulatorAnalyticsSnapshotDelta } from "./simulatorAnalyticsSnapshot.mjs";

const jiti = createJiti(import.meta.url, { fsCache: false });
const { cardsById } = jiti("../../data/cards/index.js");
const require = createRequire(import.meta.url);
const babel = require("next/dist/compiled/babel/bundle");
const source = readFileSync(new URL("./Simulator.jsx", import.meta.url), "utf8");
const ast = babel.parser().parse(source, { sourceType: "module", plugins: ["jsx"] });
const needed = new Set([
  "getEcosystemRpCap", "getSlotCardIds", "getLionfishSlotInstanceId",
  "projectNormalizedPlayerState", "projectNormalizedOpponentState",
  "normalizeProjectedPlayerState", "normalizeProjectedOpponentState", "setOpponent", "commitEventState",
  "getEcosystemCreatureCardIds", "observeSimulatorAnalyticsBoard",
]);
const functions = [];
babel.traverse().default(ast, { FunctionDeclaration(path) {
  if (needed.has(path.node.id?.name)) functions.push(source.slice(path.node.start, path.node.end));
} });
assert.equal(functions.length, needed.size);

const oyster = (instanceId) => ({ cardId: "oysters", instanceId });
const foundation = (...instanceIds) => ({
  id: "coral", cardId: "brain-coral-base", health: 60, maxHealth: 60,
  slots: instanceIds.map((instanceId) => ({
    id: `slot-${instanceId}`, cardId: "oysters", cardInstanceId: instanceId, hostedCardIds: [],
  })),
});
const state = (overrides = {}) => ({
  corals: [], habitats: [], reefCreatureInstances: [], reefCreatures: [],
  orphanCreatureInstances: [], orphanCreatures: [], creatureStatuses: {}, rp: 20,
  ...overrides,
});

function runtime(overrides = {}) {
  const context = vm.createContext({
    cardsById, calculateRpBankCap, getCardRpBankCapModifier, collectReefAbilityCreatures, creatureAbilityCard, coralIsStunned,
    createSchoolDensityBucketState, createSimulatorAnalyticsSnapshot, getSimulatorAnalyticsSnapshotDelta,
    playerCorals: [], playerHabitats: [], playerReefCreatureInstances: [], playerOrphanCreatures: [], playerOrphanCreatureInstances: [],
    creatureStatuses: {}, opponent: state(), activeCondition: null, rp: 20,
    // Foundation health is independent of Eco Boost; preserve the supplied board
    // so these tests execute the actual cap and state-normalization functions.
    reconcileFoundationHealthToFixedPoint: (corals, _reef, orphans) => ({
      corals, orphans, changed: false, destroyed: [],
    }),
    ...overrides,
  });
  for (const code of functions) vm.runInContext(code, context);
  return context;
}

test("Oysters raises its owner's cap by 2, plus 2 for a Coral Reef on either side", () => {
  const r = runtime();
  const corals = [foundation("oyster")];
  assert.equal(r.getEcosystemRpCap(corals), 10);
  assert.equal(r.getEcosystemRpCap(corals, ["coral-reef"]), 12);
  assert.equal(r.getEcosystemRpCap(corals, [], null, null, ["coral-reef"]), 12);
  assert.equal(r.getEcosystemRpCap(corals, ["open-ocean"], null, null, ["abyss"]), 10);
  assert.equal(r.getEcosystemRpCap(corals, ["coral-reef", "coral-reef"], null, null, ["coral-reef"]), 12,
    "the habitat condition is met once, regardless of duplicate reefs");
});

test("each active Oyster contributes independently and only the stunned slotted copy loses Eco Boost", () => {
  const r = runtime();
  const corals = [foundation("one", "two")];
  const oneStunned = stunCreatureAbilities({}, "one", "yellow-lipped-sea-krait");
  const bothStunned = stunCreatureAbilities(oneStunned, "two", "yellow-lipped-sea-krait");
  assert.equal(r.getEcosystemRpCap(corals), 12);
  assert.equal(r.getEcosystemRpCap(corals, [], null, null, ["coral-reef"]), 16);
  assert.equal(r.getEcosystemRpCap(corals, [], null, { creatureStatuses: oneStunned }, ["coral-reef"]), 12);
  assert.equal(r.getEcosystemRpCap(corals, [], null, { creatureStatuses: bothStunned }, ["coral-reef"]), 8);
  assert.equal(r.getEcosystemRpCap([foundation("two")], [], null, null, ["coral-reef"]), 12);
  assert.equal(r.getEcosystemRpCap([], [], null, null, ["coral-reef"]), 8,
    "removing the last Oyster removes both parts of its continuous bonus");
});

test("open-water Oyster stuns suppress only the selected physical copy", () => {
  const r = runtime();
  const reefCreatureInstances = [oyster("one"), oyster("two")];
  const statuses = stunCreatureAbilities({}, "one", "yellow-lipped-sea-krait");
  const board = { reefCreatureInstances, creatureStatuses: statuses };
  assert.equal(r.getEcosystemRpCap([], ["oysters", "oysters"], null, board, ["coral-reef"]), 12);
  assert.equal(r.getEcosystemRpCap([], ["oysters", "oysters"], null, board), 10);
  assert.equal(r.getEcosystemRpCap([], ["oysters"], null, {
    reefCreatureInstances: [oyster("one")], creatureStatuses: statuses,
  }, ["coral-reef"]), 8);
});

for (const owner of ["player", "opponent"]) {
  test(`${owner} normalization uses the actual opposing Reef and explicit projected habitat changes`, () => {
    const r = runtime({ playerHabitats: ["coral-reef"], opponent: state({ habitats: ["coral-reef"] }) });
    const normalize = owner === "player" ? r.projectNormalizedPlayerState : r.projectNormalizedOpponentState;
    const board = state({ corals: [foundation("one")] });
    assert.equal(normalize(board).state.rp, 12, "current opposing habitat supports the extra bonus");
    assert.equal(normalize(board, state()).state.rp, 10, "a projected Reef removal overrides the current board");
    assert.equal(normalize(board, state({ habitatInstances: [{ cardId: "coral-reef", instanceId: "new-reef" }] })).state.rp, 12,
      "projected habitat instances support the bonus before the React state is committed");
    assert.equal(normalize(state({ ...board, habitats: ["coral-reef"] }), state()).state.rp, 12);
    assert.equal(normalize(state({ ...board, rp: 9 }), state({ habitats: ["coral-reef"] })).state.rp, 9,
      "raising the cap never creates RP");
    assert.equal(normalize(state({ ...board, creatureStatuses: stunCreatureAbilities({}, "one", "yellow-lipped-sea-krait") }), state({ habitats: ["coral-reef"] })).state.rp, 8);
    assert.equal(normalize(state(), state({ habitats: ["coral-reef"] })).state.rp, 8);
  });
}

test("opponent normalization uses current Oyster instances after removal rather than a stale printed-ID list", () => {
  const r = runtime({ playerHabitats: ["coral-reef"] });
  const removed = state({ reefCreatures: ["oysters"], reefCreatureInstances: [] });
  assert.equal(r.projectNormalizedOpponentState(removed).state.rp, 8);
  assert.equal(r.projectNormalizedOpponentState({ ...removed, reefCreatureInstances: [oyster("present")] }).state.rp, 12);
});

test("committing a queued pair of states applies the opposing Reef change before clamping either RP bank", () => {
  for (const owner of ["player", "opponent"]) {
    for (const addsReef of [true, false]) {
      let playerRp;
      let committedOpponent;
      const oldHabitats = addsReef ? [] : ["coral-reef"];
      const nextHabitats = addsReef ? ["coral-reef"] : [];
      const r = runtime({
        opponent: state({ habitats: owner === "player" ? oldHabitats : [], corals: owner === "opponent" ? [foundation("one")] : [], rp: 12 }),
        playerHabitats: owner === "opponent" ? oldHabitats : [],
        embeddedLesson: null, trackCommittedSimulatorEvent: () => {},
        reconcileOpponentInstances: (_current, next) => next,
        setPlayerCorals: () => {}, setRp: (value) => { playerRp = value; },
      });
      // React state commits do not immediately replace the render's captured
      // opponent/playerHabitats, so keep those old values throughout the event.
      r.setOpponentState = (update) => { committedOpponent = update(r.opponent); };
      r.commitEventState({
        playerStateAfter: { corals: owner === "player" ? [foundation("one")] : [], habitats: owner === "opponent" ? nextHabitats : [], rp: 12 },
        opponentStateAfter: state({ corals: owner === "opponent" ? [foundation("one")] : [], habitats: owner === "player" ? nextHabitats : [], rp: 12 }),
      });
      assert.equal(owner === "player" ? playerRp : committedOpponent.rp, addsReef ? 12 : 10,
        `${owner}: ${addsReef ? "adding" : "removing"} the opposing Reef must use the queued board`);
    }
  }
});

test("Eco Boost analytics includes the opposing Coral Reef and returns to the base bonus after removal", () => {
  for (const owner of ["player", "opponent"]) {
    const r = runtime({
      opponent: state({ habitats: ["coral-reef"] }), playerHabitats: ["coral-reef"],
      simulatorAnalyticsRef: { current: { tracking: { snapshots: {}, completed: false } } },
      trackSimulatorAnalytics: () => {},
    });
    r.observeSimulatorAnalyticsBoard(owner, [foundation("one")], [], [], [], 2);
    assert.equal(r.simulatorAnalyticsRef.current.tracking.snapshots[owner].ecoBoost, 4, owner);
    r.opponent = state();
    r.playerHabitats = [];
    r.observeSimulatorAnalyticsBoard(owner, [foundation("one")], [], [], [], 2);
    assert.equal(r.simulatorAnalyticsRef.current.tracking.snapshots[owner].ecoBoost, 2, owner);
  }
});
