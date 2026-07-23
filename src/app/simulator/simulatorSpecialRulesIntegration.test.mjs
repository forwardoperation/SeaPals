import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { attackCanTargetCard } from "./combatRules.mjs";
import { parseLegacyAttackText, parseLegacyUtilityText } from "./gameRules.mjs";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(filename), "../../..");
const jiti = createJiti(filename, {
  fsCache: false,
  alias: { "@": path.join(projectRoot, "src") },
});
const { cardsById } = jiti(path.join(projectRoot, "src/data/cards/index.js"));

const simulatorSource = await readFile(new URL("./Simulator.jsx", import.meta.url), "utf8");
const fishCardSource = await readFile(new URL("../../data/cards/creatures/fish.js", import.meta.url), "utf8");
const supportCardSource = await readFile(new URL("../../data/cards/support.js", import.meta.url), "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = simulatorSource.indexOf(startMarker);
  const end = simulatorSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return simulatorSource.slice(start, end);
}

function getLegacyOnPlayAttack(cardId) {
  const card = cardsById[cardId];
  const attack = (card?.onPlay ?? [])
    .map((ability) => parseLegacyAttackText(ability))
    .find(Boolean);
  assert.ok(attack, `${cardId} should have a parsed On Play attack`);
  return attack;
}

test("Goblin Shark can target schools and eligible creature families in every ecosystem", () => {
  const terrorStrike = getLegacyOnPlayAttack("goblin-shark");
  assert.equal(terrorStrike.targetZone, null);
  assert.deepEqual(terrorStrike.target.categories, ["predator", "fish", "invertebrate"]);

  for (const targetId of [
    "sardine-ball-base",
    "white-grunt",
    "flying-fish",
    "wahoo",
    "market-squid",
    "bristlemouth",
    "chimera",
    "deep-cucumber",
  ]) {
    assert.equal(
      attackCanTargetCard(cardsById[targetId], terrorStrike),
      true,
      `Terror Strike should target ${targetId}`,
    );
  }

  for (const targetId of ["bluefin-tuna", "basking-shark", "elkhorn-coral-base", "open-ocean"]) {
    assert.equal(
      attackCanTargetCard(cardsById[targetId], terrorStrike),
      false,
      `Terror Strike should not target ${targetId}`,
    );
  }
});

test("Black Swallower targets its printed families across ecosystems", () => {
  const eyesBiggerThanStomach = getLegacyOnPlayAttack("black-swallower");
  assert.equal(eyesBiggerThanStomach.targetZone, null);
  assert.deepEqual(eyesBiggerThanStomach.target.categories, [
    "apex",
    "predator",
    "filter-feeder",
  ]);

  for (const targetId of ["yellowfin-tuna", "bluefin-tuna", "blue-whale"]) {
    assert.equal(
      attackCanTargetCard(cardsById[targetId], eyesBiggerThanStomach),
      true,
      `Eyes Bigger Than Stomach should target ${targetId}`,
    );
  }

  for (const targetId of ["flying-fish", "sardine-ball-base", "market-squid"]) {
    assert.equal(
      attackCanTargetCard(cardsById[targetId], eyesBiggerThanStomach),
      false,
      `Eyes Bigger Than Stomach should not target ${targetId}`,
    );
  }
});

test("other Deep Predators retain their printed target families across ecosystems", () => {
  const oceanicTargets = {
    school: cardsById["sardine-ball-base"],
    fish: cardsById["flying-fish"],
    predator: cardsById.wahoo,
    invertebrate: cardsById["market-squid"],
  };
  const cases = [
    { cardId: "chimera", accepted: ["school", "fish", "predator"] },
    { cardId: "gulper-eel", accepted: ["school", "fish", "predator"] },
    { cardId: "frilled-shark", accepted: ["school", "fish", "predator"] },
    { cardId: "deep-sea-skate", accepted: ["invertebrate"] },
  ];

  for (const { cardId, accepted } of cases) {
    const attack = getLegacyOnPlayAttack(cardId);
    assert.equal(attack.targetZone, null, `${cardId} should use its family icons across ecosystems`);
    for (const [family, targetCard] of Object.entries(oceanicTargets)) {
      assert.equal(
        attackCanTargetCard(targetCard, attack),
        accepted.includes(family),
        `${cardId} ${accepted.includes(family) ? "should" : "should not"} target ${family}`,
      );
    }
    assert.equal(attackCanTargetCard(cardsById["bluefin-tuna"], attack), false);
    assert.equal(attackCanTargetCard(cardsById["basking-shark"], attack), false);
  }
});

test("both controllers enumerate Creature Schools as attack targets", () => {
  const playerTargets = sourceBetween(
    "function getPlayerAttackTargets",
    "function createPlayerAttackContext",
  );
  assert.match(
    playerTargets,
    /isCreatureSchool\(targetCard\) && cardMatchesAttackTarget\(targetCard, attack\)/,
  );

  const opponentTargets = sourceBetween(
    "function runOpponentAttackStep",
    "function runOpponentAttack(",
  );
  assert.match(
    opponentTargets,
    /isCreatureSchool\(card\) && cardMatchesAttackTarget\(card, candidateAttacker\.attack\)/,
  );
});

test("Nerve Agent chooses a legal Coral before committing and flipping", () => {
  const nerveAgent = cardsById["man-o-war"].actions.find((action) => /Nerve Agent:/i.test(action));
  const effect = parseLegacyUtilityText(nerveAgent);
  assert.deepEqual(effect, {
    type: "flipCoin",
    successResult: "heads",
    onSuccess: { type: "stunCoral" },
  });

  const beginAction = sourceBetween(
    "function beginCreatureUtilityAction",
    "function completeCreatureDrawAction",
  );
  const coinBranchStart = beginAction.indexOf("if (effect.type === EffectType.FLIP_COIN)");
  const coinBranchEnd = beginAction.indexOf('if (effect.type === "rollDiceForResource")', coinBranchStart);
  assert.ok(coinBranchStart >= 0 && coinBranchEnd > coinBranchStart, "missing targeted coin-action branch");
  const coinBranch = beginAction.slice(coinBranchStart, coinBranchEnd);
  assert.match(coinBranch, /costCommitted: false, candidates: opponentCoralCards\.map/);
  assert.match(coinBranch, /type: "choose-coin-coral-target"/);
  assert.doesNotMatch(coinBranch, /Math\.random|resolveTargetedCoinFlip/, "the coin must wait until after target selection");

  const completeAction = sourceBetween(
    "function completeCoinCoralEffect",
    "function completeSymbiosis",
  );
  const targetValidation = completeAction.indexOf("pendingCreatureAction?.candidates?.includes(coralId)");
  const coinFlip = completeAction.indexOf("resolveTargetedCoinFlip({");
  const costCommit = completeAction.indexOf("commitCostAndActionUse");
  assert.ok(targetValidation >= 0 && coinFlip > targetValidation, "the selected Coral must be validated before the flip");
  assert.ok(costCommit > coinFlip, "RP and once-per-turn use must be committed only after a target is selected");
  assert.match(completeAction, /coinResolution && !coinResolution\.success[\s\S]*commitCostAndActionUse\(\)/);
  assert.match(completeAction, /effect\.type === EffectType\.STUN_CORAL[\s\S]*createStunnedStatus\(sourceCard\.id\)/);

  assert.equal(
    simulatorSource.match(/resolveTargetedCoinFlip\(\{/g)?.length,
    2,
    "player and opponent targeted coin actions should share one resolver",
  );
});

test("Momentum may find another Creature School with the same name", () => {
  const herringMomentum = cardsById["herring-ball-stage1"].onPlay.join(" ");
  assert.match(herringMomentum, /Momentum: Search your deck for a Creature School card\./i);
  assert.doesNotMatch(herringMomentum, /different(?:ly)? name/i);

  const playerMomentum = sourceBetween("function upgradeCoral", "function cancelCardPlay");
  assert.match(
    playerMomentum,
    /filter\(\(cardId\) => isCreatureSchool\(cardsById\[cardId\]\)\)/,
  );
  assert.doesNotMatch(
    playerMomentum,
    /cardsById\[cardId\]\?\.name\s*!==\s*nextCard\.name|differently named/i,
  );
  assert.match(playerMomentum, /Choose a Creature School from your decks to add to your hand/);

  const opponentMomentum = sourceBetween(
    "function runOpponentTurn",
    "function applyOpponentFoundationDamage",
  );
  assert.match(
    opponentMomentum,
    /find\(\(cardId\) => isCreatureSchool\(cardsById\[cardId\]\)\)/,
  );
  assert.doesNotMatch(
    opponentMomentum,
    /cardsById\[cardId\]\?\.name\s*!==\s*card\.name|differently named/i,
  );
});

test("Stunned is enforced by live income, action, destruction, and turn-boundary paths", () => {
  const income = sourceBetween("function getEcosystemStartTurnRp", "function getParasiteRequestedRp");
  assert.match(income, /coralIsStunned\(coral\)/);

  const destruction = sourceBetween(
    "function resolveFoundationDestructionTriggers",
    "function getSchoolDensity",
  );
  assert.match(destruction, /!coralCanUseOwnAbilities\(foundation\)/);

  const playerAction = sourceBetween(
    "function beginCreatureUtilityAction",
    "function completeCreatureDrawAction",
  );
  assert.match(playerAction, /if \(inspectedFoundationIsStunned\)/);

  const opponentTurn = sourceBetween("function resolveOpponentTurn", "function flipForOpeningTurn");
  assert.match(opponentTurn, /resolveStunnedAtControllerTurnBoundary\([\s\S]*turnComplete: !hasPendingRegenerate/);

  const regenerateChoice = sourceBetween(
    "function resolvePlayerRegenerateChoice",
    "function endTurn",
  );
  assert.match(regenerateChoice, /resolveStunnedAtControllerTurnBoundary\([\s\S]*turnComplete: !remainingRegenerate/);
});

test("Ensnare resolves inside each real player and opponent attack step", () => {
  const playerAttack = sourceBetween(
    "function resolvePlayerAttack",
    "function applyPlayerOnPlayDeckDiscard",
  );
  assert.match(playerAttack, /if \(rollNow && attack\?\.ensnare\)/);
  assert.match(playerAttack, /resolveEnsnareForAttack\(attack, Math\.random\)/);

  const opponentSequence = sourceBetween(
    "function runOpponentAttack(opponentState",
    "function buildOpponentAttackEventSequence",
  );
  assert.match(opponentSequence, /if \(onPlayAttack\?\.attack\?\.ensnare\)/);
  assert.match(opponentSequence, /resolveEnsnareForAttack\(onPlayAttack\.attack, Math\.random\)/);
});

test("an On Play attack targets the reconciled reef after its foundation damage", () => {
  const impact = sourceBetween(
    "function damageOpponentFoundation",
    "function attackWithCreature",
  );
  assert.match(impact, /let opponentStateAfterDamage = opponent/);
  assert.match(impact, /beginOnPlayAttack\([\s\S]*opponentStateAfterDamage\)/);

  const onPlayAttack = sourceBetween(
    "function beginOnPlayAttack",
    "function resolvePlayerAttack",
  );
  assert.match(onPlayAttack, /opponentState = opponent/);
  assert.match(onPlayAttack, /getPlayerAttackTargets\(card, attack, opponentState\)/);
});

test("Loggerhead resolves its printed coral damage before its invertebrate attack", () => {
  const loggerhead = cardsById["loggerhead-sea-turtle"];
  assert.ok(loggerhead, "Loggerhead should be present in the canonical card catalog");

  const ram = loggerhead.onPlay.find((ability) => ability?.id === "ram");
  const attack = ram?.effects?.find((effect) => effect.type === "attack");
  const coralDamage = ram?.effects?.find((effect) => effect.type === "damage");

  assert.equal(attack?.attackDice, "D4");
  assert.deepEqual(attack?.target?.categories, ["invertebrate"]);
  assert.equal(coralDamage?.target?.kind, "coral");
  assert.deepEqual(coralDamage?.amount, { type: "fixed", value: 20 });
  assert.equal(attackCanTargetCard(cardsById["market-squid"], attack), true);
  assert.equal(attackCanTargetCard(cardsById["flying-fish"], attack), false);

  const damageParser = sourceBetween(
    "function getOnPlayCoralDamage",
    "function getOnPlayFoundationDamage",
  );
  assert.match(damageParser, /Number\(effect\.amount\?\.value \?\? 0\)/);

  const openWaterPlacement = sourceBetween(
    "function completePlayerOceanicPlay",
    "function playCardFromHand",
  );
  assert.match(openWaterPlacement, /followupOnPlayAttack: hasOnPlayAttack/);
});

test("mandatory On Play attacks cannot be canceled before they resolve", () => {
  const onPlayAttack = sourceBetween(
    "function beginOnPlayAttack",
    "function resolvePlayerAttack",
  );
  assert.match(onPlayAttack, /mandatory On Play sequence must finish/);
  assert.match(simulatorSource, /!attackContext\.costCommitted && !attackContext\.onPlay \? <button[\s\S]*?>Cancel<\/button>/);
  assert.match(simulatorSource, /!faceoffRolling && !attackContext\?\.costCommitted && !attackContext\?\.onPlay \? <button[\s\S]*?>Cancel Faceoff<\/button>/);
});

test("opponent On Play attacks resolve before same-turn normal actions", () => {
  const silkyShark = cardsById["silky-shark"];
  assert.match(silkyShark.onPlay.join(" "), /Bite: Perform a D6 attack/i);
  assert.match(silkyShark.actions.join(" "), /Smooth Operator: Look at the top 5 cards/i);

  const normalActions = sourceBetween(
    "function runOpponentNormalActions",
    "function resolvePlayerRegenerateChoice",
  );
  assert.match(normalActions, /runOpponentNormalAttackActions\(opponentState, currentPlayerState\)/);
  assert.match(normalActions, /runOpponentUtilityActions\(attacks\.opponentState, attacks\.playerState\)/);
  assert.match(normalActions, /runOpponentNormalAttackActions\(utilities\.state, utilities\.playerState\)/);
  assert.match(normalActions, /events: \[\.\.\.buildOpponentUtilityEvents\(utilities\), \.\.\.attacks\.events\]/);

  const opponentTurn = sourceBetween("function resolveOpponentTurn", "function flipForOpeningTurn");
  const mandatoryResolution = opponentTurn.indexOf("buildOpponentAttackEventSequence(preservedOnPlayAttack");
  const normalResolution = opponentTurn.indexOf("runOpponentNormalActions(opponentStateAfterOnPlayAttack");
  assert.ok(mandatoryResolution >= 0, "the mandatory On Play attack should be resolved");
  assert.ok(normalResolution > mandatoryResolution, "normal actions should run only after the On Play attack");
  assert.match(opponentTurn, /events: \[\.\.\.opponentOnPlayAttackResolution\.events, \.\.\.\(opponentNormalActions\?\.events \?\? \[\]\)\]/);
});

test("a legitimate no-target On Play attack is explained without a separate blocking event", () => {
  const attackEvents = sourceBetween(
    "function buildOpponentAttackEventSequence",
    "function preserveOpponentNormalActionsAfterOnPlay",
  );
  assert.match(attackEvents, /if \(!step\.noLegalTarget \|\| step\.resolutionUnsupported\)/);

  const opponentTurn = sourceBetween("function resolveOpponentTurn", "function flipForOpeningTurn");
  assert.match(opponentTurn, /const noTargetOnPlaySummary = playIndex === 0 && opponentOnPlayAttack\?\.noLegalTarget/);
  assert.match(opponentTurn, /const message = `\$\{play\.playSummary\}\$\{noTargetOnPlaySummary\}/);
});

test("a Regenerate choice resumes deferred normal actions without replaying On Play", () => {
  const preserve = sourceBetween(
    "function preserveOpponentNormalActionsAfterOnPlay",
    "function buildOpponentUtilityEvents",
  );
  assert.match(preserve, /resumeNormalActionsAfterOnPlay: true/);

  const regenerateChoice = sourceBetween(
    "function resolvePlayerRegenerateChoice",
    "function endTurn",
  );
  assert.match(regenerateChoice, /pending\.resumeNormalActionsAfterOnPlay[\s\S]*preserveOpponentNormalActionsAfterOnPlay\(continuationResult\)/);
  assert.match(regenerateChoice, /pending\.resumeNormalActionsAfterOnPlay[\s\S]*runOpponentNormalActions\(onPlayContinuationResolution\.opponentState, onPlayContinuationResolution\.playerState\)/);
  assert.doesNotMatch(regenerateChoice, /runOpponentAttack\([\s\S]*?opponentResult\.onPlayAttack/);
});

test("Cookie Cutter uses the shared board-supply fallback for both controllers", () => {
  const playerRound = sourceBetween("function startRound", "function beginOpeningOpponentTurn");
  assert.match(playerRound, /resolveParasiteCollection\(/);
  assert.match(playerRound, /recipientRp: rp/);
  assert.match(playerRound, /const rpBeforeCollection = parasiteTransfer\.recipientAfter/);

  const opponentTurn = sourceBetween("function resolveOpponentTurn", "function flipForOpeningTurn");
  assert.match(opponentTurn, /resolveParasiteCollection\(/);
  assert.match(opponentTurn, /recipientRp: opponent\.rp/);
  assert.match(opponentTurn, /opponentParasiteTransfer\.recipientAfter/);
});

test("authored Lionfish and Spearfishing data identify the specialized removal route", () => {
  const lionfishStart = fishCardSource.indexOf('id: "lionfish"');
  const lionfishEnd = fishCardSource.indexOf('id: "flounder"', lionfishStart);
  const lionfish = fishCardSource.slice(lionfishStart, lionfishEnd);
  assert.match(lionfish, /discard it with Spearfishing or destroy it with a successful attack/);
  assert.match(lionfish, /destroyedDestination: "lost-zone"/);
  assert.match(lionfish, /specializedSupportCardIds: \["spearfishing"\]/);

  assert.equal(cardsById.lionfish.destroyedDestination, "lost-zone");
  assert.match(cardsById.lionfish.specialRules.join(" "), /If destroyed, place this card in your Lost Zone\./);
  assert.equal(cardsById.flounder.destroyedDestination, "discard", "ordinary Fish still discard when destroyed");

  const spearfishingStart = supportCardSource.indexOf('id: "spearfishing"');
  const spearfishingEnd = supportCardSource.indexOf("\n  {", spearfishingStart + 1);
  const spearfishing = supportCardSource.slice(spearfishingStart, spearfishingEnd);
  assert.match(spearfishing, /from: Zone\.YOUR_REEF/);
  assert.match(spearfishing, /to: Zone\.DISCARD/);
  assert.match(spearfishing, /includesOpponentOwnedInvasiveCardIds: \["lionfish"\]/);
});
