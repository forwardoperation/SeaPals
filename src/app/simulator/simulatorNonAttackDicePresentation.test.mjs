import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  EFFECT_ROLL_READY_TYPE,
  EffectRollKind,
  createEffectRollReadyEvent,
  resolveEffectRollEvent,
} from "./effectRollPresentation.mjs";
import { createCombatRollPacket } from "./combatRollPresentation.mjs";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(filename), "../../..");
const jiti = createJiti(filename, {
  fsCache: false,
  alias: { "@": path.join(projectRoot, "src") },
});
const { cardsById } = jiti(path.join(projectRoot, "src/data/cards/index.js"));

const simulatorUrl = new URL("./Simulator.jsx", import.meta.url);
const simulatorSource = await readFile(simulatorUrl, "utf8");
const boardCombatSource = await readFile(new URL("./BoardCombatPresentation.jsx", import.meta.url), "utf8");
const simulatorDirectory = new URL("./", import.meta.url);
const presentationFiles = (await readdir(simulatorDirectory))
  .filter((name) => /\.(?:css|jsx|mjs|js)$/.test(name) && !name.endsWith(".test.mjs"));
const presentationSource = (
  await Promise.all(
    presentationFiles.map(async (name) => readFile(new URL(name, simulatorDirectory), "utf8")),
  )
).join("\n");

function sourceSection(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `Missing source marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, `Missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

function firstEffect(cardId, abilityId, effectType) {
  const card = cardsById[cardId];
  assert.ok(card, `Missing card ${cardId}`);
  const ability = [...(card.onPlay ?? []), ...(card.actions ?? [])]
    .find((candidate) => candidate?.id === abilityId);
  assert.ok(ability, `Missing ${abilityId} on ${cardId}`);
  const effect = (ability.effects ?? [ability.effect]).find((candidate) => candidate?.type === effectType);
  assert.ok(effect, `Missing ${effectType} effect on ${cardId}.${abilityId}`);
  return effect;
}

test("effect-roll packets preserve a stopped die without owning or rerunning RNG", () => {
  const originalRandom = Math.random;
  let randomCalls = 0;
  Math.random = () => {
    randomCalls += 1;
    throw new Error("effect-roll helpers must consume only the stopped board value");
  };
  try {
    const event = createEffectRollReadyEvent({
      rollCheckpointId: "parrotfish-chomp-1",
      kind: EffectRollKind.FOUNDATION_DAMAGE,
      dice: "d4",
      sourceCardId: "spectacled-parrotfish",
      sourceCardName: "Parrotfish",
      actionName: "Chomp",
      multiplier: 10,
      targetCoralId: "opponent-coral-1",
    });
    assert.equal(event.type, EFFECT_ROLL_READY_TYPE);
    assert.equal(event.dice, "D4");
    assert.equal(event.effectRollKind, EffectRollKind.FOUNDATION_DAMAGE);
    assert.equal(event.targetCoralId, "opponent-coral-1");
    assert.equal(Object.isFrozen(event), true);

    assert.deepEqual(resolveEffectRollEvent(event, 3), {
      roll: 3,
      amount: 30,
      success: true,
      reward: 0,
    });
    assert.equal(randomCalls, 0);
  } finally {
    Math.random = originalRandom;
  }
});

test("one visible single-die packet owns the only gameplay random sample", () => {
  let randomCalls = 0;
  const packet = createCombatRollPacket("D4", null, () => {
    randomCalls += 1;
    return 0.375;
  });
  assert.equal(randomCalls, 1, "the visible packet should be seeded with one random sample");
  assert.equal(packet.attackRolls.length, 1);
  assert.deepEqual(packet.defenseRolls, []);

  const event = createEffectRollReadyEvent({
    rollCheckpointId: "single-visible-value",
    kind: EffectRollKind.FOUNDATION_DAMAGE,
    dice: "D4",
    multiplier: 10,
  });
  assert.equal(resolveEffectRollEvent(event, packet.attack).roll, packet.attack);
  assert.equal(randomCalls, 1, "resolving the stopped packet must not sample again");
});

test("resource checks and healing resolve from the same generic stopped-value packet", () => {
  const heal = createEffectRollReadyEvent({
    rollCheckpointId: "turtle-heal-1",
    kind: EffectRollKind.FOUNDATION_HEAL,
    dice: "D6",
    multiplier: 10,
    targetCoralId: "player-coral-1",
  });
  assert.deepEqual(resolveEffectRollEvent(heal, 5), {
    roll: 5,
    amount: 50,
    success: true,
    reward: 0,
  });

  const pearlHunting = createEffectRollReadyEvent({
    rollCheckpointId: "pearl-hunting-1",
    kind: EffectRollKind.RESOURCE_CHECK,
    dice: "D4",
    successValues: [4],
    reward: 4,
  });
  assert.deepEqual(resolveEffectRollEvent(pearlHunting, 2), {
    roll: 2,
    amount: 2,
    success: false,
    reward: 0,
  });
  assert.deepEqual(resolveEffectRollEvent(pearlHunting, 4), {
    roll: 4,
    amount: 4,
    success: true,
    reward: 4,
  });
});

test("invalid or stale effect-roll packets cannot be committed", () => {
  assert.equal(createEffectRollReadyEvent(), null);
  assert.equal(createEffectRollReadyEvent({
    rollCheckpointId: "bad-kind",
    kind: "attack",
    dice: "D6",
  }), null);
  assert.equal(createEffectRollReadyEvent({
    rollCheckpointId: "bad-die",
    kind: EffectRollKind.FOUNDATION_DAMAGE,
    dice: "coin",
  }), null);
  assert.equal(resolveEffectRollEvent({ type: "faceoff-ready" }, 4), null);
  assert.equal(resolveEffectRollEvent({ type: EFFECT_ROLL_READY_TYPE }, Number.NaN), null);
});

test("the playable catalog's non-attack dice effects remain in the generic presentation scope", () => {
  const rolledDamageCases = [
    ["spectacled-parrotfish", "chomp", "D4", 10],
    ["hammerhead", "ravage", "D4", 10],
    ["bull-shark", "tear-apart", "D4", 10],
  ];

  for (const [cardId, abilityId, dice, multiplier] of rolledDamageCases) {
    const effect = firstEffect(cardId, abilityId, "damage");
    assert.equal(effect.amount?.type, "dice");
    assert.equal(effect.amount?.dice, dice);
    assert.equal(effect.amount?.multiplier, multiplier);
  }

  const heal = firstEffect("green-sea-turtle", "coral-heal", "heal");
  assert.deepEqual(
    { type: heal.amount?.type, dice: heal.amount?.dice, multiplier: heal.amount?.multiplier },
    { type: "dice", dice: "D6", multiplier: 10 },
  );

  const pearlHunting = firstEffect("giant-clam", "pearl-hunting", "rollDiceForResource");
  assert.equal(pearlHunting.dice, "D4");
  assert.deepEqual(pearlHunting.successValues, [4]);
});

test("rolled On Play values stay unresolved until after a legal target is chosen", () => {
  const damageDiscovery = sourceSection(
    simulatorSource,
    "function getOnPlayCoralDamage(",
    "function getOnPlayFoundationDamage(",
  );
  const healDiscovery = sourceSection(
    simulatorSource,
    "function getOnPlayCoralHeal(",
    "function getOnPlayDrawCount(",
  );

  assert.doesNotMatch(
    damageDiscovery,
    /resolveConditionalDiceDamage|rollDie\s*\(/,
    "Reading an On Play ability during placement must not consume its gameplay roll",
  );
  assert.match(damageDiscovery, /(?:dice\s*[:=]|result\.dice\s*=)\s*effect\.amount\.dice/);
  assert.match(damageDiscovery, /(?:multiplier\s*[:=]|result\.multiplier\s*=)[\s\S]{0,100}?effect\.amount\.multiplier/);
  assert.doesNotMatch(
    healDiscovery,
    /rollDie\s*\(/,
    "Finding heal targets must not roll Green Sea Turtle's D6",
  );
  assert.match(healDiscovery, /(?:const\s+dice\s*=|dice\s*:)[\s\S]{0,100}?effect\.amount\.dice/);

  const targetPicker = sourceSection(
    simulatorSource,
    ') : eventOverlay.type === "choose-impact-target" ? (',
    ') : eventOverlay.type === "choose-territorial-target" ? (',
  );
  assert.doesNotMatch(
    targetPicker,
    /damageOpponentFoundation\(coral\.id,\s*eventOverlay\.amount/,
    "A rolled effect must not apply a value that was sampled before target selection",
  );
  assert.match(
    targetPicker,
    /(?:begin|prepare|queue|start)[A-Za-z0-9_$]*(?:Effect|Ability|NonAttack)[A-Za-z0-9_$]*Roll\s*\(/i,
    "Choosing a legal Coral should enter the board dice presentation",
  );
});

test("fixed Parrotfish damage keeps its deterministic fallback and skips the die overlay", () => {
  const parrotfish = cardsById["spectacled-parrotfish"];
  const chomp = parrotfish.onPlay.find((ability) => ability.id === "chomp");
  const damage = chomp.effects.find((effect) => effect.type === "damage");
  const modifier = chomp.conditionalModifiers.find(
    (candidate) => candidate.modifier?.type === "useDiceDamage",
  );

  assert.equal(damage.amount.fallbackAmount, 10);
  assert.equal(modifier.condition.cardId, "coral-reef");

  const damageDiscovery = sourceSection(
    simulatorSource,
    "function getOnPlayCoralDamage(",
    "function getOnPlayFoundationDamage(",
  );
  assert.match(damageDiscovery, /allowConditionalDice[\s\S]*?result\.dice\s*=\s*effect\.amount\.dice/);
  assert.match(
    damageDiscovery,
    /else if \(effect\.amount\?\.type === "dice"\)[\s\S]*?fallbackAmount/,
    "Chomp should fall back to fixed damage without opening the die overlay when Coral Reef is absent",
  );
});

test("the V2 board presents one transparent die and a single tap-to-roll control", () => {
  assert.match(
    simulatorSource,
    /(?:effect|ability|nonAttack)RollActive|(?:effect|ability|non-attack)-roll-ready/i,
    "V2 needs a distinct non-combat dice checkpoint instead of resolving in an old result page",
  );
  assert.match(presentationSource, /data-(?:effect|ability|non-attack)-roll-layer/i);
  assert.match(presentationSource, /data-stop-(?:effect|ability|non-attack)-roll/i);
  assert.match(presentationSource, /Tap to roll/i);
  assert.match(
    presentationSource,
    /role="dialog"[\s\S]{0,180}?aria-modal="true"/,
    "The mandatory tap surface should own focus while preserving visible board context",
  );
  assert.match(
    boardCombatSource,
    /data-effect-roll-layer[\s\S]{0,10000}?data-die-outline|data-die-outline[\s\S]{0,10000}?data-effect-roll-layer/,
    "The effect roll should reuse the transparent polyhedral die language",
  );
  assert.match(
    simulatorSource,
    /<BoardCombatDice[\s\S]{0,900}?active=\{boardEffectRollActive\}[\s\S]{0,900}?mode="effect"[\s\S]{0,900}?defenseExpression=\{null\}/,
    "A non-attack effect should render one die rather than an opposed roll",
  );
});

test("a stopped non-attack roll commits the visible packet exactly once", () => {
  assert.match(
    simulatorSource,
    /(?:effect|ability|nonAttack)Roll(?:Commit|Resolved|Resolving)[A-Za-z0-9_$]*Ref/i,
    "A ref-backed guard must close the pointer/click and timer double-commit race",
  );
  assert.match(
    simulatorSource,
    /if\s*\([^)]*(?:effect|ability|nonAttack)Roll[^)]*(?:Commit|Resolved|Resolving)[^)]*\.current[^)]*\)\s*return/i,
  );
  assert.match(
    simulatorSource,
    /(?:effect|ability|nonAttack)Roll(?:Commit|Resolved|Resolving)[A-Za-z0-9_$]*Ref\.current\s*=\s*true[\s\S]{0,500}?(?:stoppedPacket|stoppedRoll)\s*=/i,
    "The one-shot guard must be raised before the visible value is captured and scheduled",
  );

  const resourceAction = sourceSection(
    simulatorSource,
    'if (effect.type === "rollDiceForResource")',
    "function completeCreatureDrawAction(",
  );
  assert.doesNotMatch(
    resourceAction,
    /rollDie\s*\(/,
    "Pearl Hunting must defer its gameplay roll to the board tap",
  );
  assert.match(resourceAction, /(?:begin|prepare|queue|start)[A-Za-z0-9_$]*(?:Effect|Ability|NonAttack)[A-Za-z0-9_$]*Roll\s*\(/i);
  assert.match(
    simulatorSource,
    /(?:stoppedPacket|stoppedRoll)[\s\S]{0,800}?(?:damageOpponentFoundation|completeCreatureDiceResourceAction|resolve[A-Za-z0-9_$]*(?:Effect|Ability)Roll)/i,
    "The consequence must be calculated from the stopped on-screen value",
  );
});

test("restart and resume clear a pending effect roll without allowing a stale commit", () => {
  const restore = sourceSection(
    simulatorSource,
    "function restoreSimulatorResumeCheckpoint(",
    "function restartGame(",
  );
  const restart = sourceSection(
    simulatorSource,
    "function restartGame(",
    "function restartStoryGame(",
  );

  for (const [label, section] of [["resume", restore], ["restart", restart]]) {
    assert.match(
      section,
      /(?:effect|ability|nonAttack)Roll(?:Commit|Resolved|Resolving)[A-Za-z0-9_$]*Ref\.current\s*=\s*false/i,
      `${label} must clear the non-attack one-shot guard`,
    );
    assert.match(
      section,
      /(?:clearTimeout\([^)]*(?:effect|ability|nonAttack)Roll|cancel[A-Za-z0-9_$]*(?:Effect|Ability|NonAttack)[A-Za-z0-9_$]*Roll)/i,
      `${label} must invalidate any delayed non-attack resolution`,
    );
  }
});

test("reduced motion keeps one deterministic preview but skips continuous cycling", () => {
  assert.match(
    simulatorSource,
    /(?:effect|ability|nonAttack)[A-Za-z0-9_$]*Roll[\s\S]{0,1800}?updatePreview\(\)[\s\S]{0,600}?(?:accessibilityReducedMotion|systemReducedMotion)[\s\S]{0,120}?return undefined[\s\S]{0,300}?(?:setInterval|requestAnimationFrame)/i,
    "Reduced motion still needs a tappable value without a continuous dice animation",
  );
  assert.match(
    presentationSource,
    /(?:effect|ability|non-attack)-roll[\s\S]{0,800}?reducedMotion|reducedMotion[\s\S]{0,800}?(?:effect|ability|non-attack)-roll/i,
  );
});

test("opposed attack and defense rolls remain on the existing combat path", () => {
  const faceoffEffect = sourceSection(
    simulatorSource,
    "if (!faceoffRolling",
    "useEffect(() => {\n    const boardFaceoffReady",
  );
  assert.match(faceoffEffect, /eventOverlay\.defenseDice/);
  assert.match(faceoffEffect, /createCombatRollPacket\(eventOverlay\.attackDice,\s*defenseExpression\)/);

  assert.match(presentationSource, /purpose=\{isEffectRoll \? "effect" : "attack"\}/);
  assert.match(presentationSource, /purpose="defense"/);
  assert.match(presentationSource, /attackRolls\s*:[\s\S]{0,260}?defenseRolls\s*:/);
  assert.match(
    simulatorSource,
    /type:\s*"opponent-roll-ready"[\s\S]{0,800}?attackerOwner:\s*"opponent"[\s\S]{0,200}?defenderOwner:\s*"player"/,
  );
});
