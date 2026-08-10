import test from "node:test";
import assert from "node:assert/strict";
import {
  OpponentThreatLevel,
  canOpponentSpendSupportWithoutBreakingHardPlan,
  filterOpponentAttackersWithLegalTargets,
  getHardOpponentSupportRpReserve,
  getOpponentNormalAttackLimit,
  getOpponentThreatProfile,
  getPreferredOpponentPermanentPlayPool,
  preferOpponentPlaysWithResolvableOnPlayAttacks,
  scoreHardOpponentPermanentPlay,
  selectHardOpponentAttackPlan,
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

test("Hard AI values an immediate attack during setup instead of goldfishing an upgrade", () => {
  const openOceanAttacker = scoreHardOpponentPermanentPlay({
    baseScore: 43,
    threatLevel: OpponentThreatLevel.SETUP,
    printedVp: 2,
    cost: 2,
    hasAttack: true,
    hasLegalAttack: true,
  });
  const schoolUpgrade = scoreHardOpponentPermanentPlay({
    baseScore: 133,
    threatLevel: OpponentThreatLevel.SETUP,
    income: 2,
    cost: 3,
    isFoundation: true,
    isUpgrade: true,
  });

  assert.ok(openOceanAttacker > schoolUpgrade);
});

test("Hard AI protects combat RP before utility at every threat level", () => {
  assert.equal(
    shouldOpponentAttackBeforeUtility("hard", OpponentThreatLevel.CRITICAL),
    true,
  );
  assert.equal(
    shouldOpponentAttackBeforeUtility("hard", OpponentThreatLevel.PRESSURE),
    true,
  );
  assert.equal(
    shouldOpponentAttackBeforeUtility("hard", OpponentThreatLevel.SETUP),
    true,
  );
  assert.equal(
    shouldOpponentAttackBeforeUtility("medium", OpponentThreatLevel.CRITICAL),
    false,
  );
  assert.equal(getOpponentNormalAttackLimit("hard"), Infinity);
  assert.equal(getOpponentNormalAttackLimit("medium"), 1);
});

test("Hard support sequencing preserves an affordable Open Ocean attack during setup and pressure", () => {
  for (const threatLevel of [OpponentThreatLevel.SETUP, OpponentThreatLevel.PRESSURE]) {
    const reserve = getHardOpponentSupportRpReserve({
      difficulty: "hard",
      availableRp: 5,
      permanentPlays: [
        { id: "herring-ball-upgrade", cost: 2, hasLegalAttack: false, threatLevel },
        { id: "frigate-tuna", cost: 4, hasLegalAttack: true, threatLevel },
      ],
    });
    assert.equal(reserve, 4, `${threatLevel} should preserve the combat line`);
  }
  assert.equal(getHardOpponentSupportRpReserve({
    difficulty: "medium",
    availableRp: 5,
    permanentPlays: [{ cost: 4, hasLegalAttack: true }],
  }), 0);
});

test("Hard reserves a board-building permanent when no combat card is currently affordable", () => {
  assert.equal(getHardOpponentSupportRpReserve({
    difficulty: "hard",
    availableRp: 3,
    permanentPlays: [
      { id: "sailfish", cost: 4, hasLegalAttack: true },
      { id: "sardine-ball", cost: 2, hasLegalAttack: false },
    ],
  }), 2);
});

test("a free board attack does not erase Hard's reserve for an affordable attack play", () => {
  assert.equal(getHardOpponentSupportRpReserve({
    difficulty: "hard",
    availableRp: 5,
    existingBoardAttacks: [{ id: "free-board-attack", cost: 0 }],
    permanentPlays: [
      { id: "sailfish", cost: 4, hasLegalAttack: true },
    ],
  }), 4);
});

test("Hard cumulatively reserves every legal deployed attack before paid support", () => {
  assert.equal(getHardOpponentSupportRpReserve({
    difficulty: "hard",
    availableRp: 4,
    existingBoardAttacks: [
      { id: "attacker-a", cost: 2 },
      { id: "attacker-b", cost: 2 },
    ],
  }), 4);
});

test("Hard adds one strategic hand combat line without summing mutually exclusive alternatives", () => {
  assert.equal(getHardOpponentSupportRpReserve({
    difficulty: "hard",
    availableRp: 8,
    existingBoardAttacks: [
      { id: "attacker-a", cost: 2 },
      { id: "attacker-b", cost: 2 },
    ],
    permanentPlays: [
      { id: "cheap-attacker", cost: 2, hasLegalAttack: true, priority: 20 },
      { id: "strong-attacker", cost: 4, hasLegalAttack: true, priority: 80 },
    ],
  }), 8);
  assert.equal(getHardOpponentSupportRpReserve({
    difficulty: "hard",
    availableRp: 7,
    existingBoardAttacks: [
      { id: "attacker-a", cost: 2 },
      { id: "attacker-b", cost: 2 },
    ],
    permanentPlays: [
      { id: "cheap-attacker", cost: 3, hasLegalAttack: true, priority: 20 },
      { id: "unaffordable-strong-attacker", cost: 4, hasLegalAttack: true, priority: 80 },
    ],
  }), 7);
});

test("Hard support-to-attack sequencing keeps both deployed attacks available", () => {
  const attackCosts = [2, 2];
  let rp = 4;
  const reservedRp = getHardOpponentSupportRpReserve({
    difficulty: "hard",
    availableRp: rp,
    existingBoardAttacks: attackCosts.map((cost, index) => ({ id: `attacker-${index}`, cost })),
  });
  const canSpendSupport = canOpponentSpendSupportWithoutBreakingHardPlan({
    difficulty: "hard",
    availableRp: rp,
    supportCost: 2,
    reservedRp,
  });
  if (canSpendSupport) rp -= 2;

  let attacksResolved = 0;
  for (const attackCost of attackCosts) {
    if (attackCost > rp) break;
    rp -= attackCost;
    attacksResolved += 1;
  }

  assert.equal(canSpendSupport, false);
  assert.equal(attacksResolved, 2);
  assert.equal(rp, 0);
});

test("Hard evaluates attacker and target together instead of choosing the largest die first", () => {
  const broadSmallAttacker = { id: "school-hunter", die: 6 };
  const narrowLargeAttacker = { id: "invertebrate-hunter", die: 12 };
  const engineSchool = { id: "herring-ball", value: 160 };
  const disposableInvertebrate = { id: "blue-sea-dragon", value: 10 };
  const targets = {
    "school-hunter": [engineSchool, disposableInvertebrate],
    "invertebrate-hunter": [disposableInvertebrate],
  };

  const plan = selectHardOpponentAttackPlan(
    [narrowLargeAttacker, broadSmallAttacker],
    (attacker) => targets[attacker.id],
    {
      scorePair: (attacker, target) => attacker.die + target.value,
    },
  );

  assert.equal(plan.attacker, broadSmallAttacker);
  assert.equal(plan.target, engineSchool);
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
