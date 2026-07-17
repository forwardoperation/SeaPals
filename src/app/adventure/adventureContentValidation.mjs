import {
  ADVENTURE_CONTENT_SCHEMA_VERSION,
  REQUIRED_DIALOGUE_BEATS,
  REQUIRED_ECOSYSTEM_NPC_ROLES,
} from "./adventureContent.mjs";
import { QUEST_STATUSES, validateRewardGrant } from "./adventureProgression.mjs";

const SETTLEMENT_TYPES = new Set(["island", "floating"]);
const LEARNING_FIELDS = ["concept", "misconception", "decision", "consequence", "debrief", "callback"];
const CONVERSATION_MODES = ["intro", "rematch", "victory"];
const RUNTIME_INTERACTION_TYPES = new Set(["enter", "exit", "trainer"]);
const FACING_DIRECTIONS = new Set(["up", "down", "left", "right"]);

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function objectItems(value) {
  return asArray(value).filter(isObject);
}

function collectIds(items, label, errors) {
  const ids = new Set();
  if (!Array.isArray(items)) {
    errors.push(`${label} must be an array.`);
    return ids;
  }
  for (const [index, item] of items.entries()) {
    if (!isObject(item) || typeof item.id !== "string" || !item.id.trim()) {
      errors.push(`${label}[${index}] must have a non-empty id.`);
      continue;
    }
    if (ids.has(item.id)) errors.push(`${label} contains duplicate id ${item.id}.`);
    ids.add(item.id);
  }
  return ids;
}

function requireReference(value, ids, path, errors, { nullable = false } = {}) {
  if (nullable && value === null) return;
  if (!ids.has(value)) errors.push(`${path} references unknown id ${String(value)}.`);
}

export function validateAdventureContent(content) {
  const errors = [];
  if (!isObject(content)) return { valid: false, errors: ["content must be an object."] };
  if (content.schemaVersion !== ADVENTURE_CONTENT_SCHEMA_VERSION) {
    errors.push(`content.schemaVersion must equal ${ADVENTURE_CONTENT_SCHEMA_VERSION}.`);
  }

  const roleIds = collectIds(content.npcRoleDefinitions, "npcRoleDefinitions", errors);
  const npcIds = collectIds(content.npcs, "npcs", errors);
  const townIds = collectIds(content.towns, "towns", errors);
  const sceneIds = collectIds(content.scenes, "scenes", errors);
  const dockIds = collectIds(content.docks, "docks", errors);
  const conversationIds = collectIds(content.conversations, "conversations", errors);
  const dialogueIds = collectIds(content.dialogues, "dialogues", errors);
  const questIds = collectIds(content.quests, "quests", errors);
  const encounterIds = collectIds(content.encounters, "encounters", errors);
  const rewardIds = collectIds(content.rewards, "rewards", errors);
  const packPoolIds = collectIds(content.packPools, "packPools", errors);
  const routeIds = collectIds(content.routes, "routes", errors);
  const unlockRuleIds = collectIds(content.unlockRules, "unlockRules", errors);
  const towns = objectItems(content.towns);
  const npcs = objectItems(content.npcs);
  const scenes = objectItems(content.scenes);
  const docks = objectItems(content.docks);
  const conversations = objectItems(content.conversations);
  const dialogues = objectItems(content.dialogues);
  const quests = objectItems(content.quests);
  const encounters = objectItems(content.encounters);
  const rewards = objectItems(content.rewards);
  const packPools = objectItems(content.packPools);
  const routes = objectItems(content.routes);
  const unlockRules = objectItems(content.unlockRules);
  const scenesById = new Map(scenes.map((scene) => [scene.id, scene]));
  const docksById = new Map(docks.map((dock) => [dock.id, dock]));
  const npcsById = new Map(npcs.map((npc) => [npc.id, npc]));
  const conversationsById = new Map(conversations.map((conversation) => [conversation.id, conversation]));
  const questsById = new Map(quests.map((quest) => [quest.id, quest]));
  const encountersById = new Map(encounters.map((encounter) => [encounter.id, encounter]));
  const routesById = new Map(routes.map((route) => [route.id, route]));
  const unlockRulesById = new Map(unlockRules.map((rule) => [rule.id, rule]));
  const townsById = new Map(towns.map((town) => [town.id, town]));
  const tideMarkIds = new Set(rewards.flatMap(
    (reward) => (Array.isArray(reward?.tideMarkIds) ? reward.tideMarkIds : []),
  ));

  for (const town of towns) {
    if (!SETTLEMENT_TYPES.has(town.settlementType)) {
      errors.push(`towns.${town.id}.settlementType must be island or floating.`);
    }
    requireReference(town.dockId, dockIds, `towns.${town.id}.dockId`, errors);
    requireReference(town.startSceneId, sceneIds, `towns.${town.id}.startSceneId`, errors);
    requireReference(town.unlockRuleId, unlockRuleIds, `towns.${town.id}.unlockRuleId`, errors);
    requireReference(town.arrivalRouteId, routeIds, `towns.${town.id}.arrivalRouteId`, errors, { nullable: true });
    requireReference(town.packPoolId, packPoolIds, `towns.${town.id}.packPoolId`, errors, { nullable: true });
    if (scenesById.has(town.startSceneId) && scenesById.get(town.startSceneId).townId !== town.id) {
      errors.push(`towns.${town.id}.startSceneId must belong to the same town.`);
    }
    if (unlockRulesById.has(town.unlockRuleId) && unlockRulesById.get(town.unlockRuleId).townId !== town.id) {
      errors.push(`towns.${town.id}.unlockRuleId must belong to the same town.`);
    }
    if (town.arrivalRouteId && routesById.has(town.arrivalRouteId) && routesById.get(town.arrivalRouteId).toTownId !== town.id) {
      errors.push(`towns.${town.id}.arrivalRouteId must arrive at the town.`);
    }
    if (docksById.has(town.dockId) && docksById.get(town.dockId).townId !== town.id) {
      errors.push(`towns.${town.id}.dockId must belong to the same town.`);
    }
    for (const questId of asArray(town.questIds)) {
      requireReference(questId, questIds, `towns.${town.id}.questIds`, errors);
      if (questsById.has(questId) && questsById.get(questId).townId !== town.id) {
        errors.push(`towns.${town.id}.questIds contains a quest owned by another town.`);
      }
    }
    for (const encounterId of asArray(town.encounterIds)) {
      requireReference(encounterId, encounterIds, `towns.${town.id}.encounterIds`, errors);
      if (encountersById.has(encounterId) && encountersById.get(encounterId).townId !== town.id) {
        errors.push(`towns.${town.id}.encounterIds contains an encounter owned by another town.`);
      }
    }
    for (const roleId of asArray(town.plannedNpcRoleIds)) requireReference(roleId, roleIds, `towns.${town.id}.plannedNpcRoleIds`, errors);

    if (town.chapterType === "ecosystem") {
      for (const roleId of REQUIRED_ECOSYSTEM_NPC_ROLES) {
        if (!asArray(town.plannedNpcRoleIds).includes(roleId)) errors.push(`towns.${town.id} is missing required NPC role ${roleId}.`);
      }
      if (Number(town.encounterPlan?.resident) < 2 || Number(town.encounterPlan?.qualifier) < 1) {
        errors.push(`towns.${town.id}.encounterPlan must include two resident duels and one qualifier.`);
      }
      const listedEncounters = asArray(town.encounterIds)
        .map((encounterId) => encountersById.get(encounterId))
        .filter(Boolean);
      const residentCount = listedEncounters.filter((encounter) => encounter.role === "resident").length;
      const qualifierCount = listedEncounters.filter((encounter) => encounter.role === "qualifier").length;
      if (residentCount !== 2 || qualifierCount !== 1) {
        errors.push(`towns.${town.id}.encounterIds must resolve to exactly two resident duels and one qualifier.`);
      }
    }
  }

  for (const dock of docks) {
    requireReference(dock.townId, townIds, `docks.${dock.id}.townId`, errors);
    requireReference(dock.sceneId, sceneIds, `docks.${dock.id}.sceneId`, errors);
    const scene = scenesById.get(dock.sceneId);
    if (scene && scene.townId !== dock.townId) {
      errors.push(`docks.${dock.id}.sceneId must belong to the dock town.`);
    }
    if (dock.status === "prototype") {
      if (!scene?.world) errors.push(`docks.${dock.id} prototype dock requires a runtime scene.`);
      if (!Number.isFinite(dock.position?.x) || !Number.isFinite(dock.position?.y)) {
        errors.push(`docks.${dock.id}.position requires finite x and y coordinates.`);
      }
      if (!FACING_DIRECTIONS.has(dock.facing)) {
        errors.push(`docks.${dock.id}.facing must be up, down, left, or right.`);
      }
    }
  }

  const runtimeInteractionIds = new Set();
  for (const scene of scenes) {
    requireReference(scene.townId, townIds, `scenes.${scene.id}.townId`, errors);
    if (scene.status !== "prototype") continue;
    if (!isObject(scene.world)) {
      errors.push(`scenes.${scene.id}.world is required for prototype scenes.`);
      continue;
    }

    const rows = asArray(scene.world.tiles);
    const width = typeof rows[0] === "string" ? rows[0].length : 0;
    if (!width || rows.some((row) => typeof row !== "string" || row.length !== width)) {
      errors.push(`scenes.${scene.id}.world.tiles must be a non-empty rectangular string map.`);
    }
    for (const field of ["name", "worldKind", "theme"]) {
      if (typeof scene.world[field] !== "string" || !scene.world[field].trim()) {
        errors.push(`scenes.${scene.id}.world.${field} is required.`);
      }
    }
    if (!Number.isInteger(scene.world.spawn?.x) || !Number.isInteger(scene.world.spawn?.y)) {
      errors.push(`scenes.${scene.id}.world.spawn requires integer x and y coordinates.`);
    }

    for (const [index, interaction] of objectItems(scene.world.interactions).entries()) {
      const path = `scenes.${scene.id}.world.interactions[${index}]`;
      if (typeof interaction.id !== "string" || !interaction.id.trim()) {
        errors.push(`${path}.id is required.`);
      } else if (runtimeInteractionIds.has(interaction.id)) {
        errors.push(`runtime scene interactions contain duplicate id ${interaction.id}.`);
      } else {
        runtimeInteractionIds.add(interaction.id);
      }
      if (!RUNTIME_INTERACTION_TYPES.has(interaction.type)) {
        errors.push(`${path}.type must be enter, exit, or trainer.`);
      }
      if (!Number.isInteger(interaction.at?.x) || !Number.isInteger(interaction.at?.y)) {
        errors.push(`${path}.at requires integer x and y coordinates.`);
      }

      if (interaction.type === "trainer") {
        requireReference(interaction.trainerId, npcIds, `${path}.trainerId`, errors);
        requireReference(interaction.npcId, npcIds, `${path}.npcId`, errors);
        requireReference(interaction.conversationId, conversationIds, `${path}.conversationId`, errors);
        requireReference(interaction.encounterId, encounterIds, `${path}.encounterId`, errors);
        if (interaction.trainerId !== interaction.npcId) {
          errors.push(`${path}.trainerId must match npcId while the prototype trainer API is supported.`);
        }
        const npc = npcsById.get(interaction.npcId);
        if (npc && npc.sceneId !== scene.id) errors.push(`${path}.npcId must belong to the interaction scene.`);
        if (npc && npc.conversationId !== interaction.conversationId) errors.push(`${path}.conversationId must match the NPC conversation.`);
        if (npc && npc.encounterId !== interaction.encounterId) errors.push(`${path}.encounterId must match the NPC encounter.`);
      } else if (interaction.type === "enter" || interaction.type === "exit") {
        requireReference(interaction.targetScene, sceneIds, `${path}.targetScene`, errors);
        if (!Number.isInteger(interaction.spawn?.x) || !Number.isInteger(interaction.spawn?.y)) {
          errors.push(`${path}.spawn requires integer x and y coordinates.`);
        }
      }
    }
    if (!Array.isArray(scene.world.interactions)) {
      errors.push(`scenes.${scene.id}.world.interactions must be an array.`);
    }
  }

  for (const npc of npcs) {
    requireReference(npc.townId, townIds, `npcs.${npc.id}.townId`, errors);
    requireReference(npc.sceneId, sceneIds, `npcs.${npc.id}.sceneId`, errors);
    requireReference(npc.roleId, roleIds, `npcs.${npc.id}.roleId`, errors);
    requireReference(npc.conversationId, conversationIds, `npcs.${npc.id}.conversationId`, errors);
    requireReference(npc.encounterId, encounterIds, `npcs.${npc.id}.encounterId`, errors);
    for (const field of ["name", "title", "color", "crest"]) {
      if (typeof npc[field] !== "string" || !npc[field].trim()) errors.push(`npcs.${npc.id}.${field} is required.`);
    }
    const scene = scenesById.get(npc.sceneId);
    const conversation = conversationsById.get(npc.conversationId);
    const encounter = encountersById.get(npc.encounterId);
    if (scene && scene.townId !== npc.townId) errors.push(`npcs.${npc.id}.sceneId must belong to the NPC town.`);
    if (conversation && (conversation.townId !== npc.townId || conversation.npcId !== npc.id)) {
      errors.push(`npcs.${npc.id}.conversationId must resolve to a conversation for the same NPC and town.`);
    }
    if (encounter && (encounter.townId !== npc.townId || encounter.opponentId !== npc.id)) {
      errors.push(`npcs.${npc.id}.encounterId must resolve to an encounter for the same NPC and town.`);
    }
  }

  for (const conversation of conversations) {
    requireReference(conversation.townId, townIds, `conversations.${conversation.id}.townId`, errors);
    requireReference(conversation.npcId, npcIds, `conversations.${conversation.id}.npcId`, errors);
    const npc = npcsById.get(conversation.npcId);
    if (npc && (npc.townId !== conversation.townId || npc.conversationId !== conversation.id)) {
      errors.push(`conversations.${conversation.id} must belong to its NPC and town.`);
    }
    for (const mode of CONVERSATION_MODES) {
      const lines = conversation.lines?.[mode];
      if (!Array.isArray(lines) || !lines.length || lines.some((line) => typeof line !== "string" || !line.trim())) {
        errors.push(`conversations.${conversation.id}.lines.${mode} must contain at least one non-empty line.`);
      }
    }
  }

  for (const quest of quests) {
    requireReference(quest.townId, townIds, `quests.${quest.id}.townId`, errors);
    requireReference(quest.dialogueId, dialogueIds, `quests.${quest.id}.dialogueId`, errors);
    requireReference(quest.rewardId, rewardIds, `quests.${quest.id}.rewardId`, errors);
    if (
      !Array.isArray(quest.stateSequence)
      || quest.stateSequence.length !== QUEST_STATUSES.length
      || quest.stateSequence.some((status, index) => status !== QUEST_STATUSES[index])
    ) {
      errors.push(`quests.${quest.id}.stateSequence must exactly match ${QUEST_STATUSES.join(" -> ")}.`);
    }
    if (!isObject(quest.learning)) {
      errors.push(`quests.${quest.id}.learning must be an object.`);
      continue;
    }
    for (const field of LEARNING_FIELDS) {
      if (typeof quest.learning[field] !== "string" || !quest.learning[field].trim()) {
        errors.push(`quests.${quest.id}.learning.${field} is required.`);
      }
    }
    if (!Array.isArray(quest.learning.evidence) || quest.learning.evidence.length < 2) {
      errors.push(`quests.${quest.id}.learning.evidence must contain at least two observations.`);
    }
  }

  for (const dialogue of dialogues) {
    requireReference(dialogue.townId, townIds, `dialogues.${dialogue.id}.townId`, errors);
    requireReference(dialogue.questId, questIds, `dialogues.${dialogue.id}.questId`, errors);
    const beats = objectItems(dialogue.beats);
    const beatIds = beats.map((beat) => beat.id);
    if (
      beatIds.length !== REQUIRED_DIALOGUE_BEATS.length
      || beatIds.some((beatId, index) => beatId !== REQUIRED_DIALOGUE_BEATS[index])
    ) {
      errors.push(`dialogues.${dialogue.id}.beats must exactly follow ${REQUIRED_DIALOGUE_BEATS.join(" -> ")}.`);
    }
    for (const beat of beats) {
      requireReference(beat.speakerRoleId, roleIds, `dialogues.${dialogue.id}.beats.${beat.id}.speakerRoleId`, errors);
    }
  }

  for (const encounter of encounters) {
    requireReference(encounter.townId, townIds, `encounters.${encounter.id}.townId`, errors);
    requireReference(encounter.questId, questIds, `encounters.${encounter.id}.questId`, errors);
    requireReference(encounter.rewardId, rewardIds, `encounters.${encounter.id}.rewardId`, errors, { nullable: true });
    if (![10, 30].includes(encounter.victoryTarget)) errors.push(`encounters.${encounter.id}.victoryTarget must be 10 or 30.`);
    if (encounter.role === "tournament" && encounter.victoryTarget !== 30) {
      errors.push(`encounters.${encounter.id} tournament matches must use 30 VP.`);
    }
    if (typeof encounter.opponentDeckId !== "string" || !encounter.opponentDeckId) {
      errors.push(`encounters.${encounter.id}.opponentDeckId is required.`);
    }
    const prerequisites = asArray(encounter.prerequisites);
    for (const [index, prerequisite] of prerequisites.entries()) {
      if (!isObject(prerequisite) || prerequisite.type !== "questStatus") {
        errors.push(`encounters.${encounter.id}.prerequisites[${index}] must be a questStatus prerequisite.`);
        continue;
      }
      requireReference(prerequisite.questId, questIds, `encounters.${encounter.id}.prerequisites[${index}].questId`, errors);
      if (!QUEST_STATUSES.includes(prerequisite.status)) {
        errors.push(`encounters.${encounter.id}.prerequisites[${index}].status must be a known quest status.`);
      }
    }
    if (encounter.role === "qualifier") {
      const completesLearningQuest = prerequisites.some((prerequisite) => (
        isObject(prerequisite)
        && prerequisite.type === "questStatus"
        && prerequisite.questId === encounter.questId
        && prerequisite.status === "complete"
      ));
      if (!completesLearningQuest) {
        errors.push(`encounters.${encounter.id} qualifier must require its learning quest to be complete.`);
      }
    }
  }

  const rewardGrantIds = new Set();
  for (const reward of rewards) {
    const grantResult = validateRewardGrant(reward);
    if (!grantResult.valid) {
      for (const error of grantResult.errors) errors.push(`rewards.${reward.id} is invalid: ${error}`);
      continue;
    }

    const grant = grantResult.value;
    if (rewardGrantIds.has(grant.grantId)) errors.push(`rewards contains duplicate grantId ${grant.grantId}.`);
    else rewardGrantIds.add(grant.grantId);
    for (const routeId of grant.routeIds) requireReference(routeId, routeIds, `rewards.${reward.id}.routeIds`, errors);
    for (const packPoolId of Object.keys(grant.packs)) requireReference(packPoolId, packPoolIds, `rewards.${reward.id}.packs`, errors);
  }

  for (const pool of packPools) {
    if (pool.purchaseMode !== "earned-only") errors.push(`packPools.${pool.id}.purchaseMode must be earned-only.`);
    if (!pool.progressionGuarantee) errors.push(`packPools.${pool.id}.progressionGuarantee is required.`);
    if (!Array.isArray(pool.cardIds)) errors.push(`packPools.${pool.id}.cardIds must be an array.`);
  }

  for (const route of routes) {
    requireReference(route.fromTownId, townIds, `routes.${route.id}.fromTownId`, errors);
    requireReference(route.toTownId, townIds, `routes.${route.id}.toTownId`, errors);
    if (route.fromTownId === route.toTownId) errors.push(`routes.${route.id} must connect different towns.`);
  }

  for (const rule of unlockRules) {
    requireReference(rule.townId, townIds, `unlockRules.${rule.id}.townId`, errors);
    const requiredQuestIds = asArray(rule.questIds);
    for (const questId of requiredQuestIds) requireReference(questId, questIds, `unlockRules.${rule.id}.questIds`, errors);
    for (const routeId of asArray(rule.routeIds)) {
      requireReference(routeId, routeIds, `unlockRules.${rule.id}.routeIds`, errors);
      const route = routesById.get(routeId);
      const previousTown = route ? townsById.get(route.fromTownId) : null;
      if (route && route.toTownId !== rule.townId) {
        errors.push(`unlockRules.${rule.id}.routeIds must arrive at the rule's town.`);
      }
      for (const previousQuestId of asArray(previousTown?.questIds)) {
        if (!requiredQuestIds.includes(previousQuestId)) {
          errors.push(`unlockRules.${rule.id} must require completed quest ${previousQuestId} from the prior town.`);
        }
      }
    }
    for (const tideMarkId of asArray(rule.tideMarkIds)) requireReference(tideMarkId, tideMarkIds, `unlockRules.${rule.id}.tideMarkIds`, errors);
  }

  return { valid: errors.length === 0, errors };
}

export function assertValidAdventureContent(content) {
  const result = validateAdventureContent(content);
  if (!result.valid) throw new TypeError(`Invalid adventure content:\n${result.errors.join("\n")}`);
  return content;
}
