import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { attackCanTargetCard } from "./combatRules.mjs";
import {
  getInvasiveCreatureTargets,
  getInvasiveOrphanTargets,
} from "./specialCardRules.mjs";

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

function sourceBetween(startMarker, endMarker) {
  const start = simulatorSource.indexOf(startMarker);
  const end = simulatorSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return simulatorSource.slice(start, end);
}

function loadPlayerAttackTargetEnumerator() {
  const functionSource = sourceBetween(
    "function getPlayerAttackTargets(",
    "function createPlayerAttackContext(",
  );
  const factory = new Function(
    "cardCanTargetHiddenByAbyss",
    "getSlotTargetInstanceId",
    "getHostedTargetSlotId",
    "cardsById",
    "cardMatchesAttackTarget",
    "cardIsHiddenByAbyss",
    "isCreatureSchool",
    "getInvasiveCreatureTargets",
    "getInvasiveOrphanTargets",
    `"use strict"; ${functionSource}; return getPlayerAttackTargets;`,
  );
  return factory(
    () => false,
    (slot) => slot.cardInstanceId ?? `slot:${slot.id}`,
    (slotId, hostedIndex) => `${slotId}:hosted:${hostedIndex}`,
    cardsById,
    attackCanTargetCard,
    () => false,
    () => false,
    getInvasiveCreatureTargets,
    getInvasiveOrphanTargets,
  );
}

function frogfishSneakAttack() {
  const attack = cardsById.frogfish.onPlay
    .flatMap((ability) => ability.effects ?? [])
    .find((effect) => effect.type === "attack");
  assert.ok(attack, "Frogfish should retain its authored Sneak Attack effect");
  return attack;
}

const emptyOpponentEcosystem = {
  corals: [],
  habitats: [],
  reefCreatureInstances: [],
  orphanCreatures: [],
};

test("Frogfish can target an opponent-owned slotted Lionfish on the player's ecosystem", () => {
  const targetEnumeration = sourceBetween(
    "function getPlayerAttackTargets(",
    "function createPlayerAttackContext(",
  );
  assert.doesNotMatch(
    targetEnumeration,
    /ocean-jake|lostZone/,
    "unrelated support availability checks must not run while attack targets are enumerated",
  );

  const getPlayerAttackTargets = loadPlayerAttackTargetEnumerator();
  const targets = getPlayerAttackTargets(
    cardsById.frogfish,
    frogfishSneakAttack(),
    emptyOpponentEcosystem,
    [{
      id: "player-coral-a",
      slots: [{
        id: "player-slot-a",
        cardId: "lionfish",
        cardInstanceId: "opponent-lionfish-slotted",
        controller: "opponent",
        invasiveOwner: "opponent",
        hostedCardIds: [],
      }],
    }],
    [],
  );

  assert.deepEqual(targets, [{
    coralId: "__own_invader__",
    hostCoralId: "player-coral-a",
    slotId: "player-slot-a",
    instanceId: "opponent-lionfish-slotted",
  }]);
});

test("Frogfish can target an opponent-owned floating Lionfish orphan on the player's ecosystem", () => {
  const getPlayerAttackTargets = loadPlayerAttackTargetEnumerator();
  const targets = getPlayerAttackTargets(
    cardsById.frogfish,
    frogfishSneakAttack(),
    emptyOpponentEcosystem,
    [],
    [{
      cardId: "lionfish",
      instanceId: "opponent-lionfish-orphan",
      controller: "opponent",
      invasiveOwner: "opponent",
      hostedCardIds: [],
    }],
  );

  assert.deepEqual(targets, [{
    coralId: "__own_invader_orphan__",
    slotId: "orphan-opponent-lionfish-orphan",
    instanceId: "opponent-lionfish-orphan",
    ownOrphanIndex: 0,
  }]);
});

test("both player-board Lionfish forms expose the generated target and resolve that exact selection", () => {
  assert.match(
    simulatorSource,
    /target\.coralId === "__own_invader_orphan__" && target\.instanceId === entry\.instanceId/,
  );
  assert.match(
    simulatorSource,
    /isInvaderTarget[\s\S]*?resolvePlayerAttack\("__own_invader_orphan__", `orphan-\$\{entry\.instanceId\}`\)/,
  );
  assert.match(
    simulatorSource,
    /target\.coralId === "__own_invader__" && target\.hostCoralId === coral\.id && target\.slotId === slot\.id/,
  );
  assert.match(
    simulatorSource,
    /isInvaderTarget[\s\S]*?resolvePlayerAttack\("__own_invader__", slot\.id\)/,
  );

  const resolver = sourceBetween(
    "function resolvePlayerAttack(",
    "function applyPlayerOnPlayDeckDiscard(",
  );
  assert.match(
    resolver,
    /targetCoralId === "__own_invader__" \|\| targetCoralId === "__own_invader_orphan__"/,
  );
  assert.match(resolver, /removeInvasiveCreature\(playerCorals,[\s\S]*?controller: "opponent"/);
  assert.match(resolver, /removeInvasiveOrphan\(playerOrphanCreatures,[\s\S]*?controller: "opponent"/);
});
