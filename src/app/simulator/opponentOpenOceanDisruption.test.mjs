import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { attackCanTargetCard } from "./combatRules.mjs";
import { parseLegacyAttackText } from "./gameRules.mjs";
import {
  OpponentThreatLevel,
  scoreHardOpponentPermanentPlay,
  scoreHardOpponentSearchCandidate,
  selectBestOpponentCreatureSlot,
  selectProductiveOpponentSearchTargets,
} from "./opponentPlayRules.mjs";

const require = createRequire(import.meta.url);
const { createJiti } = require("jiti");
const filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(filename), "../../..");
const jiti = createJiti(filename, {
  fsCache: false,
  alias: { "@": path.join(projectRoot, "src") },
});
const { cardsById } = jiti(path.join(projectRoot, "src/data/cards/index.js"));
const { getPlayableDeckById } = jiti(path.join(projectRoot, "src/data/decks/prebuiltDecks.js"));

function getOnPlayAttacks(card) {
  return (card?.onPlay ?? []).flatMap((ability) => {
    const legacy = parseLegacyAttackText(typeof ability === "string" ? ability : ability?.text);
    if (legacy) return [legacy];
    const structured = (ability?.effects ?? []).find((effect) => effect.type === "attack" && effect.attackDice);
    return structured ? [structured] : [];
  });
}

function uniqueDeckCards(deckId) {
  return getPlayableDeckById(deckId).cards.map(({ cardId }) => cardsById[cardId]).filter(Boolean);
}

test("Open Ocean has broad legal attack coverage into the Disruption creature package", () => {
  const openOceanCards = uniqueDeckCards("open-ocean-hunt");
  const disruptionCreatures = uniqueDeckCards("disruption").filter((card) => card.kind === "creature");
  const attackersWithTargets = openOceanCards.filter((card) => (
    getOnPlayAttacks(card).some((attack) => disruptionCreatures.some((target) => attackCanTargetCard(target, attack)))
  ));

  assert.ok(attackersWithTargets.length >= 8, `expected broad matchup pressure, found ${attackersWithTargets.map((card) => card.id).join(", ")}`);
  assert.ok(attackersWithTargets.some((card) => card.id === "frigate-tuna"));
  assert.ok(attackersWithTargets.some((card) => card.id === "sailfish"));
  assert.ok(attackersWithTargets.some((card) => card.id === "swordfish"));
});

test("Hard scores the actual Open Ocean attack line above another passive school upgrade", () => {
  const attacker = cardsById["frigate-tuna"];
  const upgrade = cardsById["herring-ball-stage1"];
  const attackerCost = Number(attacker.cost?.rp ?? 0);
  const attackerVp = Number(attacker.victoryPoints ?? 0);
  const attackerBaseScore = 25
    + attackerVp * 7
    + ((attacker.actions?.length ?? 0) + (attacker.onPlay?.length ?? 0)) * 6
    - attackerCost;
  const upgradeCost = Number(upgrade.cost?.rp ?? 0);
  const upgradeIncome = 2;
  const upgradeBaseScore = 120 + upgradeIncome * 8 - upgradeCost;

  const attackScore = scoreHardOpponentPermanentPlay({
    baseScore: attackerBaseScore,
    threatLevel: OpponentThreatLevel.SETUP,
    printedVp: attackerVp,
    cost: attackerCost,
    hasAttack: true,
    hasLegalAttack: true,
  });
  const upgradeScore = scoreHardOpponentPermanentPlay({
    baseScore: upgradeBaseScore,
    threatLevel: OpponentThreatLevel.SETUP,
    income: upgradeIncome,
    cost: upgradeCost,
    isFoundation: true,
    isUpgrade: true,
  });

  assert.ok(attackScore > upgradeScore);
});

test("Hard Darkness Shroud searches for an affordable school attacker instead of Colossal Squid", () => {
  const darknessCards = uniqueDeckCards("darkness-shroud");
  const school = cardsById["herring-ball-base"];
  const predatorAndApexIds = darknessCards
    .filter((card) => ["predator", "apex"].includes(card.category))
    .map((card) => card.id);
  const selected = selectProductiveOpponentSearchTargets(predatorAndApexIds, {
    amount: 1,
    scoreCandidate: (cardId) => {
      const candidate = cardsById[cardId];
      const attack = getOnPlayAttacks(candidate)[0] ?? null;
      const cost = Number(candidate.cost?.rp ?? 0);
      const printedVp = Number(candidate.victoryPoints?.value ?? candidate.victoryPoints ?? 0);
      const needsAbyss = (candidate.specialRules ?? []).some((rule) => /requires?.*abyss|only be played if abyss/i.test(typeof rule === "string" ? rule : rule?.text ?? ""));
      return scoreHardOpponentSearchCandidate({
        baseScore: printedVp * 15 - cost,
        playCost: cost,
        availableRp: 3,
        hasAttack: Boolean(attack),
        hasLegalAttack: Boolean(attack && attackCanTargetCard(school, attack)),
        meetsRequirements: !needsAbyss,
        hasPlacement: candidate.category !== "apex",
      });
    },
  });

  assert.deepEqual(selected, ["chimera"]);
  assert.notDeepEqual(selected, ["colossal-squid"]);
});

test("Hard Darkness Shroud puts Fish in its dedicated slot before flexible attack slots", () => {
  const stageOneSlots = cardsById["bamboo_coral_stage1"].slots;
  const fish = cardsById.bristlemouth;
  const compatible = stageOneSlots.filter((slot) => slot.accepts.includes(fish.class));

  assert.equal(selectBestOpponentCreatureSlot(compatible, fish.class)?.slotClass, "fish");
});
