import test from "node:test";
import assert from "node:assert/strict";
import {
  OpponentThreatLevel,
  filterOpponentAttackersWithLegalTargets,
  getOpponentNormalAttackLimit,
  getOpponentThreatProfile,
  getPreferredOpponentPermanentPlayPool,
  preferOpponentPlaysWithResolvableOnPlayAttacks,
  scoreHardOpponentPermanentPlay,
  shouldOpponentAttackBeforeUtility,
} from "./opponentPlayRules.mjs";

test("opponent play pool excludes mandatory On Play attacks without a legal target", () => {
  const result = preferOpponentPlaysWithResolvableOnPlayAttacks(
    ["black-swallower", "brain-coral", "goblin-shark"],
    {
      hasOnPlayAttack: (id) => ["black-swallower", "goblin-shark"].includes(id),
      hasLegalTarget: (id) => id === "goblin-shark",
    },
  );

  assert.deepEqual(result, ["brain-coral", "goblin-shark"]);
});

test("opponent play pool retains a targeted attacker and a VP-winning attacker", () => {
  const result = getPreferredOpponentPermanentPlayPool(
    ["targeted-attacker", "winning-attacker", "fizzling-attacker"],
    {
      isMandatoryOnPlayAttack: () => true,
      hasLegalOnPlayTarget: (id) => id === "targeted-attacker",
      isVpWinningPlay: (id) => id === "winning-attacker",
    },
  );

  assert.deepEqual(result, ["targeted-attacker", "winning-attacker"]);
});

test("opponent play pool falls back to all legal plays when every attack would fizzle", () => {
  const playableCardIds = ["black-swallower", "goblin-shark"];
  const result = getPreferredOpponentPermanentPlayPool(playableCardIds, {
    isMandatoryOnPlayAttack: () => true,
    hasLegalOnPlayTarget: () => false,
  });

  assert.deepEqual(result, playableCardIds);
  assert.notEqual(result, playableCardIds);
});

test("opponent play pool preserves non-attacking plays and handles an empty pool", () => {
  assert.deepEqual(
    getPreferredOpponentPermanentPlayPool(["coral-reef", "open-ocean"]),
    ["coral-reef", "open-ocean"],
  );
  assert.deepEqual(getPreferredOpponentPermanentPlayPool(), []);
});

test("a runaway visible engine creates critical urgency before it reaches match point", () => {
  const threat = getOpponentThreatProfile({
    playerVp: 18,
    opponentVp: 3,
    victoryTarget: 30,
    playerIncome: 15,
    opponentIncome: 4,
    playerSchoolDensity: 420,
    opponentSchoolDensity: 0,
    playerBoardCards: 12,
    opponentBoardCards: 5,
    round: 9,
  });

  assert.equal(threat.level, OpponentThreatLevel.CRITICAL);
  assert.ok(threat.score >= 68);
  assert.equal(threat.victoryDistance, 12);
});

test("an even early board remains in setup mode", () => {
  const threat = getOpponentThreatProfile({
    playerVp: 2,
    opponentVp: 2,
    victoryTarget: 30,
    playerIncome: 3,
    opponentIncome: 3,
    playerSchoolDensity: 70,
    opponentSchoolDensity: 70,
    playerBoardCards: 2,
    opponentBoardCards: 2,
    round: 2,
  });

  assert.equal(threat.level, OpponentThreatLevel.SETUP);
});

test("critical Hard AI values a legal attack over another slow coral upgrade", () => {
  const attackScore = scoreHardOpponentPermanentPlay({
    baseScore: 55,
    threatLevel: OpponentThreatLevel.CRITICAL,
    printedVp: 4,
    cost: 4,
    hasAttack: true,
    hasLegalAttack: true,
  });
  const upgradeScore = scoreHardOpponentPermanentPlay({
    baseScore: 120,
    threatLevel: OpponentThreatLevel.CRITICAL,
    printedVp: 0,
    income: 2,
    cost: 2,
    isFoundation: true,
    isUpgrade: true,
  });

  assert.ok(attackScore > upgradeScore);
});

test("only critical Hard AI attacks before utility and may use every legal attacker", () => {
  assert.equal(
    shouldOpponentAttackBeforeUtility("hard", OpponentThreatLevel.CRITICAL),
    true,
  );
  assert.equal(
    shouldOpponentAttackBeforeUtility("hard", OpponentThreatLevel.PRESSURE),
    false,
  );
  assert.equal(
    shouldOpponentAttackBeforeUtility("medium", OpponentThreatLevel.CRITICAL),
    false,
  );
  assert.equal(getOpponentNormalAttackLimit("hard"), Infinity);
  assert.equal(getOpponentNormalAttackLimit("medium"), 1);
});

test("normal attack selection drops a stronger attacker with no target instead of ending the turn", () => {
  const attackers = [
    { id: "invertebrate-only", score: 50 },
    { id: "fish-hunter", score: 30 },
  ];
  const legalTargets = {
    "invertebrate-only": [],
    "fish-hunter": ["flying-fish"],
  };

  assert.deepEqual(
    filterOpponentAttackersWithLegalTargets(
      attackers,
      (attacker) => legalTargets[attacker.id],
    ),
    [attackers[1]],
  );
  assert.deepEqual(
    filterOpponentAttackersWithLegalTargets(
      [attackers[0]],
      (attacker) => legalTargets[attacker.id],
      { preserveMandatoryAttack: true },
    ),
    [attackers[0]],
  );
});
