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
  const invaderHook = startRound.indexOf("resolveHostTurnLionfishInvaders({");
  const collection = startRound.indexOf("getEcosystemStartTurnRp(");
  const parasite = startRound.indexOf("resolveParasiteCollection({");

  assert.ok(invaderHook >= 0 && invaderHook < collection && collection < parasite);
  assert.match(startRound, /hostController: "player"/);
  assert.equal(occurrenceCount(startRound, /resolveHostTurnLionfishInvaders\(\{/g), 1);
  assert.equal(occurrenceCount(startRound, /beginFlashingAlarmTurn\(flashingAlarmAttackBonus\)/g), 1);
  assert.match(startRound, /setPlayerCorals\(playerCoralsAtTurnStart\.map/);
  assert.match(startRound, /setPlayerReefCreatureInstances\(playerReefInstancesAtTurnStart\)/);
  assert.match(startRound, /setPlayerOrphanCreatureInstances\(playerOrphansAtTurnStart\)/);
  assert.match(startRound, /setDiscardPile\(playerAtTurnStart\.discardPile\)/);
  assert.match(startRound, /setLostZone\(playerAtTurnStart\.lostZone\)/);
  assert.match(startRound, /setOpponent\(opponentHandLimitResult\.state\)/);
  assert.match(startRound, /\.\.\.lionfishResolution\.events/);
});

test("Lionfish Invader resolves exactly once before opponent Parasite and automated actions", () => {
  const opponentTurn = sourceBetween("  function resolveOpponentTurn()", "  function flipForOpeningTurn");
  const invaderHook = opponentTurn.indexOf("resolveHostTurnLionfishInvaders({");
  const parasite = opponentTurn.indexOf("resolveParasiteCollection({");
  const automatedTurn = opponentTurn.indexOf("runOpponentTurn(opponentForTurn");

  assert.ok(invaderHook >= 0 && invaderHook < parasite && parasite < automatedTurn);
  assert.match(opponentTurn, /hostController: "opponent"/);
  assert.equal(occurrenceCount(opponentTurn, /resolveHostTurnLionfishInvaders\(\{/g), 1);
  assert.equal(occurrenceCount(opponentTurn, /beginFlashingAlarmTurn\(opponent\.flashingAlarmAttackBonus\)/g), 1);
  assert.match(opponentTurn, /playerStateAfter: stagedPlayerState/);
  assert.match(opponentTurn, /opponentStateAfter: opponentAtTurnStart/);
  assert.match(opponentTurn, /runOpponentTurn\(opponentForTurn, \{ startTurnAlreadyBegun: true \}\)/);

  const automatedPipeline = sourceBetween("  function runOpponentTurn(", "  function applyOpponentFoundationDamage");
  assert.match(automatedPipeline, /startTurnAlreadyBegun[\s\S]*\? current\.flashingAlarmAttackBonus[\s\S]*: beginFlashingAlarmTurn/);
});

test("Invader controller branches, source exclusion, fizzle, and owner-zone routing stay explicit", () => {
  const resolver = sourceBetween("function resolveHostTurnLionfishInvaders({", "function createDeck(");

  assert.match(resolver, /collectHostTurnLionfishInvaders\(\{/);
  assert.match(resolver, /const coinResult = resolveLionfishInvaderCoin\(random\)/);
  assert.match(resolver, /getLionfishInvaderTargetController\(\{/);
  assert.match(resolver, /selectLionfishInvaderTarget\(candidates, \{[\s\S]*sourceInstanceId: invader\.instanceId/);
  assert.match(resolver, /targetController === invader\.controller \? -1 : 1/);
  assert.match(resolver, /no other legal Fish[\s\S]*mandatory attack fizzled/);
  assert.match(resolver, /resolveOpposedRoll\("D4-1", defenseDice, random\)/);
  assert.match(resolver, /const attackerWins = attackTotal > defenseTotal/);
  assert.match(resolver, /routeLionfishDestroyedCard\(states, target\.controller, target\.cardId\)/);
  assert.match(resolver, /routeLionfishDestroyedCard\(states, invader\.controller, invader\.cardId\)/);
  const poisonHealCommit = resolver.indexOf("const invaderPoisonHealActive");
  const schoolResolution = resolver.indexOf('target.location === "foundation"');
  const ordinaryResolution = resolver.indexOf('resolveOpposedRoll("D4-1", defenseDice, random)');
  assert.ok(poisonHealCommit >= 0 && poisonHealCommit < schoolResolution && schoolResolution < ordinaryResolution);
  assert.match(resolver, /poisonImmunityNextPredatorAttack: false/);
  assert.match(resolver, /poisonHealActive: invaderPoisonHealActive/);
  assert.match(resolver, /getCloakDefenseBonus\(target\.card\)/);
  assert.match(resolver, /getDarknessShroudDefenseBonus\(/);
});

test("Creature Schools take one D4-1 roll as tenfold HP damage before ordinary defense", () => {
  const resolver = sourceBetween("function resolveHostTurnLionfishInvaders({", "function createDeck(");
  const schoolBranch = resolver.indexOf('target.location === "foundation" && isCreatureSchool(target.card)');
  const opposedBranch = resolver.indexOf('resolveOpposedRoll("D4-1", defenseDice, random)');

  assert.ok(schoolBranch >= 0 && schoolBranch < opposedBranch);
  assert.match(resolver, /const attackRoll = rollDie\("D4-1", random\)/);
  assert.match(resolver, /const damage = attackRoll\.total \* 10/);
  assert.match(resolver, /const damageResult = applyDamage\(school\.health \?\? school\.maxHealth, damage\)/);
  assert.match(resolver, /health: damageResult\.remainingHealth/);
  assert.match(resolver, /if \(damageResult\.destroyed\)[\s\S]*removeLionfishBoardEntry\(states, target\)/);

  const targets = sourceBetween("function getLionfishOwnedFishTargets(", "function emptyLionfishOccupiedSlot");
  assert.match(targets, /isCreatureSchool\(foundationCard\)/);
  assert.match(targets, /location: "foundation"/);
});
