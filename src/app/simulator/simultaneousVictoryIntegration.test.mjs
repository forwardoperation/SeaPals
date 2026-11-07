import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { determineVictoryResult } from "./gameRules.mjs";

const source = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
function sourceBetween(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  assert.ok(start >= 0 && end > start, `Missing simulator block: ${startText}`);
  return source.slice(start, end);
}
function simulatorFunction(name, nextName, context) {
  return new Function(...Object.keys(context), `return (${sourceBetween(`function ${name}(`, `function ${nextName}(`).trim()});`)(...Object.values(context));
}

function board(vp) {
  return {
    corals: [{ cardId: "foundation", vp, slots: [] }],
    habitats: [], habitatInstances: [], reefCreatures: [], reefCreatureInstances: [],
    orphanCreatures: [], orphanCreatureInstances: [], discardPile: [],
  };
}

function harness({ resolveAttack = null } = {}) {
  const calls = { normalActions: 0, completions: 0, attacks: 0, maintenance: 0 };
  const context = {
    playerHabitats: [],
    round: 2,
    getResolvedVictoryResult: (player, opponent) => determineVictoryResult(player, opponent, 10),
    getEcosystemVictoryPoints: (corals) => corals.reduce((sum, coral) => sum + coral.vp, 0),
    buildLiveOpponentTurnCompletionEvents: (options) => {
      calls.completions += 1;
      return [{ route: "complete", ...options }];
    },
    createLiveOpponentNormalActionEvents: (options) => {
      calls.normalActions += 1;
      return [{ route: "continue", ...options }];
    },
    createLiveOpponentAttackStepEvents: (options) => {
      calls.attacks += 1;
      const states = resolveAttack?.(options) ?? options;
      return options.afterAction(states.playerState, states.opponentState, [], { attackOccurred: true });
    },
  };
  context.getProjectedVictoryResult = simulatorFunction("getProjectedVictoryResult", "buildLiveOpponentTurnCompletionEvents", context);
  return {
    calls,
    context,
    route: simulatorFunction("createLiveOpponentTurnCombatEvents", "resolveOpponentDefensiveRoll", context),
  };
}

test("actual opponent turn continues normal actions for simultaneous ties at or above target", () => {
  for (const total of [10, 12]) {
    const { route, calls } = harness();
    const [event] = route({ playerState: board(total), opponentState: board(total) });
    assert.equal(event.route, "continue");
    assert.equal(calls.normalActions, 1);
    assert.equal(calls.completions, 0);
  }
});

test("actual opponent turn stops optional actions when either side is the sole leader", () => {
  for (const [player, opponent] of [[10, 11], [11, 10], [9, 10]]) {
    const { route, calls } = harness();
    assert.equal(route({ playerState: board(player), opponentState: board(opponent) })[0].route, "complete");
    assert.equal(calls.normalActions, 0);
  }
});

test("mandatory On Play resolution uses both updated boards before deciding a tie", () => {
  const { route, calls } = harness({
    resolveAttack: () => ({ playerState: board(10), opponentState: board(10) }),
  });
  const [event] = route({
    playerState: board(8), opponentState: board(12), onPlayAttack: { attack: {} },
  });
  assert.equal(calls.attacks, 1, "mandatory effects still resolve even when a player initially reaches the target");
  assert.equal(event.route, "continue", "the final equal totals resume optional actions");
});

test("mandatory On Play resolution can break a tie in favor of either side", () => {
  for (const [player, opponent] of [[10, 9], [9, 10]]) {
    const { route, calls } = harness({
      resolveAttack: () => ({ playerState: board(player), opponentState: board(opponent) }),
    });
    const [event] = route({
      playerState: board(10), opponentState: board(10), onPlayAttack: { attack: {} },
    });
    assert.equal(event.route, "complete");
    assert.equal(calls.normalActions, 0);
  }
});

test("a resolved win stops before Habitat maintenance while a tie still receives maintenance", () => {
  const { context, calls } = harness();
  Object.assign(context, {
    normalizeProjectedPlayerState: (state) => state,
    normalizeProjectedOpponentState: (state) => state,
    reconcileOpponentInstances: (_previous, state) => state,
    getCardsInPlayForComposition: () => [],
    cardsById: {},
    resolveEndOfTurnHabitatMaintenance: (habitats) => {
      calls.maintenance += 1;
      return { habitats, destroyedHabitats: [], events: [] };
    },
    endFlashingAlarmTurn: () => null,
    resolveStunnedAtControllerTurnBoundary: (foundations) => ({ foundations, recoveredFoundationIds: [] }),
    clearCreatureAbilityStuns: (statuses) => statuses,
    splitTurnActionLines: (summary) => summary ? [summary] : [],
  });
  const complete = simulatorFunction("buildLiveOpponentTurnCompletionEvents", "createLiveLionfishTurnEvents", context);
  assert.equal(complete({ playerState: board(10), opponentState: board(10) }).at(-1).gameResultAfter, null);
  assert.equal(calls.maintenance, 1);
  assert.match(complete({ playerState: board(11), opponentState: board(10) }).at(-1).gameResultAfter, /^Victory:/);
  assert.equal(calls.maintenance, 1, "maintenance cannot erase a completed victory");
  assert.match(complete({ playerState: board(10), opponentState: board(11) }).at(-1).gameResultAfter, /^Defeat:/);
  assert.equal(calls.maintenance, 1);
});

test("opponent follow-up permanent plays do not stop merely because a tied score reached target", () => {
  const gate = sourceBetween("        const currentVp = getEcosystemVictoryPoints(next.corals", "        const densityState = getOpponentSchoolDensityState(next);");
  function canContinue(playerVp, opponentVp) {
    return new Function("playerVp", "getEcosystemVictoryPoints", "getResolvedVictoryResult", `
      const next = {}, playerCorals = [], playerOrphanCreatures = [];
      for (;;) {
        ${gate}
        return true;
      }
      return false;
    `)(playerVp, () => opponentVp, (player, opponent) => determineVictoryResult(player, opponent, 10));
  }
  assert.equal(canContinue(10, 10), true);
  assert.equal(canContinue(12, 12), true);
  assert.equal(canContinue(10, 11), false);
  assert.equal(canContinue(11, 10), false);
});

test("a resolved optional attack breaking the tie stops further attacks and optional utilities", () => {
  const { context, calls } = harness({
    resolveAttack: () => ({ playerState: board(9), opponentState: board(10) }),
  });
  let utilityCalls = 0;
  Object.assign(context, {
    opponentDifficulty: "hard",
    assessCurrentOpponentThreat: () => ({ level: "endgame" }),
    shouldOpponentAttackBeforeUtility: () => true,
    normalizeProjectedPlayerState: (state) => state,
    normalizeProjectedOpponentState: (state) => state,
    getLocallyControlledOrphans: (orphans) => orphans,
    getOpponentNormalAttackLimit: () => 2,
    runOpponentUtilityActions: () => { utilityCalls += 1; throw new Error("Victory must stop optional utility actions"); },
  });
  const normalActions = simulatorFunction("createLiveOpponentNormalActionEvents", "createLiveOpponentTurnCombatEvents", context);
  const [event] = normalActions({
    playerState: board(10), opponentState: { ...board(10), reefCreatures: ["first-attacker", "second-attacker"] },
  });
  assert.equal(calls.attacks, 1);
  assert.equal(event.route, "complete");
  assert.equal(utilityCalls, 0);
});

test("legacy Regenerate continuation resumes a tied game after mandatory effects finish", () => {
  const continuationGate = sourceBetween("    const onPlayContinuationHasPendingRegenerate =", "    const continuationResolution =");
  const { context } = harness();
  function resumes(playerVp, opponentVp, pendingRegenerate = false) {
    return new Function("onPlayContinuationResolution", "getProjectedVictoryResult", `
      const liveCombatResume = false, pending = { resumeNormalActionsAfterOnPlay: true };
      const runOpponentNormalActions = () => ({ resumed: true });
      ${continuationGate}
      return normalActionsAfterOnPlay?.resumed ?? false;
    `)({
      playerState: board(playerVp), opponentState: board(opponentVp),
      events: pendingRegenerate ? [{ type: "choose-regenerate" }] : [],
    }, context.getProjectedVictoryResult);
  }
  assert.equal(resumes(10, 10), true);
  assert.equal(resumes(12, 12), true);
  assert.equal(resumes(10, 9), false);
  assert.equal(resumes(9, 10), false);
  assert.equal(resumes(10, 10, true), false, "a pending mandatory choice must resolve first");
});
