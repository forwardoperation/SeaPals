import assert from "node:assert/strict";
import test from "node:test";
import { getOpponentOwnedBoardCardIds, projectOpponentPermanentVp, selectOpponentFoundationEffectTarget } from "./opponentBoardEvaluation.mjs";
import { preferOpponentPlaysWithResolvableOnPlayAttacks, scoreOpponentPermanentPlay } from "./opponentPlayRules.mjs";
import { selectOpponentChoice } from "./opponentDifficultyRules.mjs";

const cardsById = {
  base: { id: "base", victoryPoints: 4 },
  upgrade: { id: "upgrade", victoryPoints: 5 },
  fish: { id: "fish", victoryPoints: 3 },
  apex: { id: "apex", victoryPoints: 5 },
  engine: { id: "engine", victoryPoints: 1, bonusVictoryPoints: { type: "perCardOnReef", targetCardId: "fish", amount: 2 } },
};

test("upgrade projection counts only gained VP and cannot manufacture a win", () => {
  const boardCardIds = ["base", "fish", "fish"];
  const result = projectOpponentPermanentVp({ boardCardIds, cardId: "upgrade", replacedCardId: "base", cardsById, victoryTarget: 13 });
  assert.deepEqual(result, { currentVp: 10, projectedVp: 11, vpGain: 1, reachesVictory: false });
  assert.deepEqual(boardCardIds, ["base", "fish", "fish"], "evaluation must not mutate the actual board");
});

test("an Apex's sacrificed fish are removed one copy at a time before testing victory", () => {
  const result = projectOpponentPermanentVp({ boardCardIds: ["fish", "fish", "fish"], cardId: "apex", sacrificedCardIds: ["fish", "fish"], cardsById, victoryTarget: 10 });
  assert.equal(result.projectedVp, 8);
  assert.equal(result.vpGain, -1);
  assert.equal(result.reachesVictory, false);
});

test("VP synergy is recomputed for both new plays and removed creatures", () => {
  assert.equal(projectOpponentPermanentVp({ boardCardIds: ["engine", "fish"], cardId: "fish", cardsById }).vpGain, 5);
  assert.equal(projectOpponentPermanentVp({ boardCardIds: ["engine", "fish", "fish"], cardId: "apex", sacrificedCardIds: ["fish", "fish"], cardsById }).vpGain, -5);
});

test("all difficulties take a real win over a falsely winning upgrade or an attack", () => {
  for (const difficulty of ["easy", "medium", "hard"]) {
    const metrics = (cardId) => ({
      difficulty, cost: 2, incomeGain: cardId === "upgrade" ? 1 : 0,
      ...projectOpponentPermanentVp({ boardCardIds: ["base", "fish", "fish"], cardId, replacedCardId: cardId === "upgrade" ? "base" : null, cardsById, victoryTarget: 13 }),
    });
    const pool = preferOpponentPlaysWithResolvableOnPlayAttacks(["upgrade", "fish"], { reachesVictory: (id) => metrics(id).reachesVictory });
    const choice = selectOpponentChoice(pool, difficulty, { mediumScore: (id) => scoreOpponentPermanentPlay(metrics(id)) });
    assert.equal(choice, "fish", difficulty);
  }
});

test("board evaluation counts remote invaders and hosted cards under their controller", () => {
  const state = {
    corals: [{ cardId: "base", slots: [{ cardId: "enemy", invasiveOwner: "player" }, { cardId: "host", hostedCardIds: ["fish"] }] }],
    habitats: ["habitat"], reefCreatures: ["ocean-fish"], orphanCreatures: [{ cardId: "orphan" }],
  };
  assert.deepEqual(getOpponentOwnedBoardCardIds(state,
    [{ cardId: "enemy-coral", slots: [{ cardId: "invader", invasiveOwner: "opponent" }, { cardId: "enemy-fish" }] }],
    [{ cardId: "remote-orphan", invasiveOwner: "opponent" }]),
  ["habitat", "ocean-fish", "base", "host", "fish", "orphan", "invader", "remote-orphan"]);
});

const foundations = [
  { id: "healthy", cardId: "base", health: 80, maxHealth: 80, rp: 1 },
  { id: "engine", cardId: "upgrade", health: 20, maxHealth: 100, rp: 4 },
];
const targetOptions = { cardsById, getIncome: (foundation) => foundation.rp, isStunned: (foundation) => foundation.stunned };

test("foundation damage finishes a vulnerable engine instead of hitting the first healthy coral", () => {
  assert.equal(selectOpponentFoundationEffectTarget(foundations, { ...targetOptions, effect: "damage", amount: 20 }).id, "engine");
});

test("stuns suppress productive engines and skip corals already stunned", () => {
  assert.equal(selectOpponentFoundationEffectTarget(foundations, { ...targetOptions, effect: "stun" }).id, "engine");
  assert.equal(selectOpponentFoundationEffectTarget(foundations.map((f) => ({ ...f, stunned: true })), { ...targetOptions, effect: "stun" }), null);
});

test("income denial avoids wasting another penalty on an exhausted coral", () => {
  const penalized = foundations.map((f) => ({ ...f, rpPenaltyNextTurn: f.id === "engine" ? 4 : 0 }));
  assert.equal(selectOpponentFoundationEffectTarget(penalized, { ...targetOptions, effect: "income", amount: 2 }).id, "healthy");
});
