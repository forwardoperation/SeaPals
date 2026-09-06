import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = simulatorSource.indexOf(startMarker);
  const end = simulatorSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return simulatorSource.slice(start, end);
}

function occurrenceCount(source, pattern) {
  return source.match(pattern)?.length ?? 0;
}

test("Lionfish Invader resolves exactly once before player turn collection and propagates both boards", () => {
  const startRound = sourceBetween("  function startRound(", "  function beginOpeningOpponentTurn");
  const invaderHook = startRound.indexOf("createLiveLionfishTurnEvents({");
  const collection = startRound.indexOf("getEcosystemStartTurnRp(");
  const parasite = startRound.indexOf("resolveParasiteCollection({");

  assert.ok(invaderHook >= 0 && invaderHook < collection && collection < parasite);
  assert.match(startRound, /hostController: "player"/);
  assert.equal(occurrenceCount(startRound, /resolveHostTurnLionfishInvaders\(\{/g), 1);
  assert.equal(occurrenceCount(startRound, /beginFlashingAlarmTurn\(playerAtBoundary\.flashingAlarmAttackBonus\)/g), 1);
  assert.match(startRound, /setPlayerCorals\(playerCoralsAtTurnStart\.map/);
  assert.match(startRound, /setPlayerReefCreatureInstances\(playerReefInstancesAtTurnStart\)/);
  assert.match(startRound, /setPlayerOrphanCreatureInstances\(playerOrphansAtTurnStart\)/);
  assert.match(startRound, /setDiscardPile\(playerAtTurnStart\.discardPile\)/);
  assert.match(startRound, /setLostZone\(playerAtTurnStart\.lostZone\)/);
  assert.match(startRound, /setOpponent\(opponentHandLimitResult\.state\)/);
  assert.match(startRound, /previewExperience && playerTriggerableInvaders\.length[\s\S]*createLiveLionfishTurnEvents\(\{/);
  assert.match(startRound, /startRoundRef\.current\?\.\(nextRound,[\s\S]*skipLionfish: true/);
  assert.match(startRound, /presentQueuedEvent\(firstLionfishEvent, remainingLionfishEvents/);
  assert.doesNotMatch(startRound, /insertOpponentRollCheckpoints\(lionfishResolution\.events/);
});

test("Lionfish Invader resolves exactly once before opponent Parasite and automated actions", () => {
  const opponentTurn = sourceBetween("  function resolveOpponentTurn({", "  function flipForOpeningTurn");
  const invaderHook = opponentTurn.indexOf("createLiveLionfishTurnEvents({");
  const parasite = opponentTurn.indexOf("resolveParasiteCollection({");
  const automatedTurn = opponentTurn.indexOf("runOpponentTurn(opponentForTurn");

  assert.ok(invaderHook >= 0 && invaderHook < parasite && parasite < automatedTurn);
  assert.match(opponentTurn, /hostController: "opponent"/);
  assert.equal(occurrenceCount(opponentTurn, /resolveHostTurnLionfishInvaders\(\{/g), 1);
  assert.equal(occurrenceCount(opponentTurn, /beginFlashingAlarmTurn\(opponent\.flashingAlarmAttackBonus\)/g), 1);
  assert.match(opponentTurn, /playerStateAfter: stagedPlayerState/);
  assert.match(opponentTurn, /opponentStateAfter: opponentAtTurnStart/);
  assert.match(opponentTurn, /runOpponentTurn\(opponentForTurn, \{ startTurnAlreadyBegun: true \}\)/);
  assert.match(opponentTurn, /previewExperience && opponentTriggerableInvaders\.length[\s\S]*createLiveLionfishTurnEvents\(\{/);
  assert.match(opponentTurn, /resolveOpponentTurnRef\.current\?\.\(\{[\s\S]*skipLionfish: true/);
  assert.doesNotMatch(opponentTurn, /insertOpponentRollCheckpoints\(lionfishTurnEvents/);

  const automatedPipeline = sourceBetween("  function runOpponentTurn(", "  function applyOpponentFoundationDamage");
  assert.match(automatedPipeline, /startTurnAlreadyBegun[\s\S]*\? current\.flashingAlarmAttackBonus[\s\S]*: beginFlashingAlarmTurn/);
});

test("Invader controller branches, source exclusion, fizzle, and owner-zone routing stay explicit", () => {
  const resolver = sourceBetween("function resolveHostTurnLionfishInvaders({", "function createDeck(");

  assert.match(resolver, /collectTriggerableHostTurnLionfishInvaders\(/);
  assert.match(resolver, /const coinResult = forcedPlan\?\.coinResult \?\? resolveLionfishInvaderCoin\(random\)/);
  assert.match(resolver, /getLionfishInvaderTargetController\(\{/);
  assert.match(resolver, /selectLionfishInvaderTarget\(candidates, \{[\s\S]*sourceInstanceId: invader\.instanceId/);
  assert.match(resolver, /targetController === invader\.controller \? -1 : 1/);
  assert.match(resolver, /no other legal Fish[\s\S]*mandatory attack fizzled/);
  assert.match(resolver, /stoppedPrimaryRolls \?\? resolveOpposedRoll\("D4-1", defenseDice, random\)/);
  assert.match(resolver, /const attackerWins = attackTotal > defenseTotal/);
  assert.match(resolver, /routeLionfishDestroyedCard\(states, target\.controller, target\.cardId\)/);
  assert.match(resolver, /routeLionfishDestroyedCard\(states, invader\.controller, invader\.cardId\)/);
  const poisonHealCommit = resolver.indexOf("const invaderPoisonHealActive");
  const schoolResolution = resolver.indexOf('target.location === "foundation"');
  const ordinaryResolution = resolver.indexOf('stoppedPrimaryRolls ?? resolveOpposedRoll("D4-1", defenseDice, random)');
  assert.ok(poisonHealCommit >= 0 && poisonHealCommit < schoolResolution && schoolResolution < ordinaryResolution);
  assert.match(resolver, /poisonImmunityNextPredatorAttack: false/);
  assert.match(resolver, /poisonHealActive: invaderPoisonHealActive/);
  assert.match(resolver, /getCloakDefenseBonus\(target\.card\)/);
  assert.match(resolver, /getDarknessShroudDefenseBonus\(/);
  assert.match(resolver, /processedInvaderInstanceIds\.push\(invader\.instanceId\)/);
  assert.match(resolver, /forcedPlans\.find\(\(candidatePlan\)/);
});

test("Creature Schools take one D4-1 roll as tenfold HP damage before ordinary defense", () => {
  const resolver = sourceBetween("function resolveHostTurnLionfishInvaders({", "function createDeck(");
  const schoolBranch = resolver.indexOf('target.location === "foundation" && isCreatureSchool(target.card)');
  const opposedBranch = resolver.indexOf('resolveOpposedRoll("D4-1", defenseDice, random)');

  assert.ok(schoolBranch >= 0 && schoolBranch < opposedBranch);
  assert.match(resolver, /Number\.isFinite\(combatRollPacket\?\.attack\)[\s\S]*\{ total: Number\(combatRollPacket\.attack\) \}[\s\S]*: rollDie\("D4-1", random\)/);
  assert.match(resolver, /const damage = attackRoll\.total \* 10/);
  assert.match(resolver, /const damageResult = applyDamage\(school\.health \?\? school\.maxHealth, damage\)/);
  assert.match(resolver, /health: damageResult\.remainingHealth/);
  assert.match(resolver, /if \(damageResult\.destroyed\)[\s\S]*removeLionfishBoardEntry\(states, target\)/);

  const targets = sourceBetween("function getLionfishOwnedFishTargets(", "function emptyLionfishOccupiedSlot");
  assert.match(targets, /isCreatureSchool\(foundationCard\)/);
  assert.match(targets, /location: "foundation"/);
});

test("preview Lionfish combat resolves one invader at a time from the board dice stopped by the player", () => {
  const liveResolver = sourceBetween(
    "  function createLiveLionfishTurnEvents({",
    "  function createLiveOpponentAttackStepEvents({",
  );

  assert.match(liveResolver, /maxInvaders: 1/);
  assert.match(liveResolver, /excludedInvaderInstanceIds: processedInvaderInstanceIds/);
  assert.match(liveResolver, /type: "opponent-roll-ready"/);
  assert.match(liveResolver, /attackDice: plannedEvent\.attackDice/);
  assert.match(liveResolver, /defenseDice: plannedEvent\.defenseDice \?\? null/);
  assert.match(liveResolver, /mode: "resolve-live-lionfish-step"/);
  assert.match(liveResolver, /resolve: \(stoppedPacket\) => \{[\s\S]*combatRollPackets: \[stoppedPacket\]/);
  assert.match(liveResolver, /forcedPlans: \[plan\]/);
  assert.match(liveResolver, /\.\.\.createLiveLionfishTurnEvents\(\{/);
  assert.match(liveResolver, /type: "live-lionfish-continuation"/);
});

test("preview Lionfish uses a live ecosystem-owned coin before any attack dice", () => {
  const liveResolver = sourceBetween(
    "  function createLiveLionfishTurnEvents({",
    "  function createLiveOpponentAttackStepEvents({",
  );
  const coinCheckpoint = liveResolver.indexOf('type: "live-lionfish-coin"');
  const plannedResolution = liveResolver.indexOf("const plannedResolution = resolveHostTurnLionfishInvaders({");
  const diceCheckpoint = liveResolver.indexOf('type: "opponent-roll-ready"');

  assert.ok(coinCheckpoint >= 0 && coinCheckpoint < plannedResolution && plannedResolution < diceCheckpoint);
  assert.match(liveResolver, /sourceCardName: cardsById\.lionfish\?\.name \?\? "Lionfish"/);
  assert.match(liveResolver, /actionName: "Invader"/);
  assert.match(liveResolver, /hostController,[\s\S]*invaderPhysicalController: hostController/);
  assert.match(liveResolver, /resolveCoin: \(coinResult\) => createLiveLionfishTurnEvents\(\{[\s\S]*forcedCoinResult: coinResult/);
  assert.match(liveResolver, /forcedPlans: \[\{[\s\S]*invaderInstanceId: nextInvader\.instanceId,[\s\S]*coinResult: forcedCoinResult/);
  assert.doesNotMatch(
    liveResolver.slice(0, plannedResolution),
    /resolveLionfishInvaderCoin|forcedResult/,
    "the tap or AI timer, not event planning, must sample the Lionfish coin",
  );

  const presenter = sourceBetween(
    "  function beginLiveLionfishCoinPresentation(",
    "  function beginDeferredOpponentToxicCoinPresentation(",
  );
  assert.match(presenter, /owner: hostController/);
  assert.match(presenter, /const automatic = hostController === "opponent"/);
  assert.match(presenter, /automatic,/);
  assert.match(presenter, /sourceCardName,[\s\S]*actionName,/);
  assert.match(presenter, /neutral: true/);
  assert.doesNotMatch(presenter, /forcedResult/);

  const continuation = sourceBetween("  function continueCardCoinFlip()", "  function cancelOpeningCoinFlip()");
  assert.match(continuation, /continuation\?\.type === "resolve-live-lionfish-coin"/);
  assert.match(continuation, /continuation\.resolve\(outcome\.result\)/);
  assert.match(continuation, /const existingTail = \[\.\.\.pendingEventsRef\.current\]/);
  assert.match(continuation, /\[\.\.\.lionfishEvents, \.\.\.existingTail\]/);
  assert.match(continuation, /presentQueuedEvent\(nextEvent \?\? null, remainingEvents, \{ delayForOpponent: false \}\)/);
  assert.doesNotMatch(
    continuation,
    /setPendingEvents\(queuedEvents\)[\s\S]*?window\.setTimeout\([\s\S]*?presentQueuedEvent\(nextEvent/,
    "the completed Lionfish coin must promote its result without an async shared-queue gap",
  );
});

test("Lionfish no-target preflight excludes the source and runs before coin RNG", () => {
  const collector = sourceBetween(
    "function collectTriggerableHostTurnLionfishInvaders(",
    "function emptyLionfishOccupiedSlot(",
  );
  assert.match(collector, /getLionfishOwnedFishTargets\(states, "player"\)/);
  assert.match(collector, /getLionfishOwnedFishTargets\(states, "opponent"\)/);
  assert.match(collector, /hasAnyLionfishInvaderTarget\(\{ invader, targets: allLegalFishTargets \}\)/);

  const resolver = sourceBetween("function resolveHostTurnLionfishInvaders({", "function createDeck(");
  const preflight = resolver.indexOf("hasAnyLionfishInvaderTarget({ invader, targets: allLegalFishTargets })");
  const trigger = resolver.indexOf("triggeredCount += 1");
  const coin = resolver.indexOf("resolveLionfishInvaderCoin(random)");
  assert.ok(preflight >= 0 && preflight < trigger && trigger < coin);
});
