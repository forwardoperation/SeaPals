import {
  ADVENTURE_STARTER_DECK_IDS,
  ADVENTURE_CONTENT_SCHEMA_VERSION,
  REQUIRED_DIALOGUE_BEATS,
  REQUIRED_ECOSYSTEM_NPC_ROLES,
  REQUIRED_TUTORIAL_ACTION_TYPES,
  REQUIRED_TUTORIAL_CHECKPOINT_IDS,
} from "./adventureContent.mjs";
import { QUEST_STATUSES, validateRewardGrant } from "./adventureProgression.mjs";

const SETTLEMENT_TYPES = new Set(["island", "floating"]);
const LEARNING_FIELDS = ["concept", "misconception", "decision", "consequence", "debrief", "callback"];
const CONVERSATION_MODES = ["intro", "rematch", "victory"];
const NON_DUEL_CONVERSATION_MODES = ["intro", "guidance", "return"];
const MENTOR_CONVERSATION_MODES = [
  "starterPresentation",
  "starterConfirmed",
  "tutorialIntro",
  "practiceLoss",
  "practiceExit",
  "practiceRetry",
  "boatSafety",
];
const STARTER_METRICS = ["offense", "defense", "economy", "consistency", "tempo"];
const RUNTIME_INTERACTION_TYPES = new Set([
  "enter",
  "exit",
  "trainer",
  "npc",
  "observation",
  "interpretation",
  "response",
  "board",
  "dock",
]);
const FACING_DIRECTIONS = new Set(["up", "down", "left", "right"]);
const PACK_POOL_STATUSES = new Set(["planned", "playable"]);
const PLAYABLE_PACK_GUARANTEE = "at-least-one-unowned-card-when-eligible";

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
  const starterDeckIds = collectIds(content.starterDecks, "starterDecks", errors);
  const tutorialIds = collectIds(content.tutorials, "tutorials", errors);
  const fieldNoteIds = collectIds(content.fieldNotes, "fieldNotes", errors);
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
  const starterDecks = objectItems(content.starterDecks);
  const tutorials = objectItems(content.tutorials);
  const fieldNotes = objectItems(content.fieldNotes);
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
  const starterDecksById = new Map(starterDecks.map((starterDeck) => [starterDeck.id, starterDeck]));
  const tutorialsById = new Map(tutorials.map((tutorial) => [tutorial.id, tutorial]));
  const fieldNotesById = new Map(fieldNotes.map((fieldNote) => [fieldNote.id, fieldNote]));
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

    if (town.chapterType === "starter") {
      requireReference(town.academySceneId, sceneIds, `towns.${town.id}.academySceneId`, errors);
      requireReference(town.mentorNpcId, npcIds, `towns.${town.id}.mentorNpcId`, errors);
      requireReference(town.tutorialId, tutorialIds, `towns.${town.id}.tutorialId`, errors);
      for (const starterDeckId of asArray(town.starterDeckIds)) {
        requireReference(starterDeckId, starterDeckIds, `towns.${town.id}.starterDeckIds`, errors);
      }
      if (
        asArray(town.starterDeckIds).length !== ADVENTURE_STARTER_DECK_IDS.length
        || ADVENTURE_STARTER_DECK_IDS.some((starterDeckId) => !asArray(town.starterDeckIds).includes(starterDeckId))
      ) {
        errors.push(`towns.${town.id}.starterDeckIds must include all three canonical starter decks.`);
      }
      if (scenesById.has(town.academySceneId) && scenesById.get(town.academySceneId).townId !== town.id) {
        errors.push(`towns.${town.id}.academySceneId must belong to the starter town.`);
      }
      if (npcsById.has(town.mentorNpcId) && npcsById.get(town.mentorNpcId).townId !== town.id) {
        errors.push(`towns.${town.id}.mentorNpcId must belong to the starter town.`);
      }
      if (tutorialsById.has(town.tutorialId) && tutorialsById.get(town.tutorialId).townId !== town.id) {
        errors.push(`towns.${town.id}.tutorialId must belong to the starter town.`);
      }
      if (Number(town.encounterPlan?.practice) !== 1) {
        errors.push(`towns.${town.id}.encounterPlan must include exactly one mentor practice duel.`);
      }
    }

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
      if (scenesById.get(town.startSceneId)?.status === "prototype") {
        const runtimeNpcs = npcs.filter((npc) => npc.townId === town.id);
        if (runtimeNpcs.length < 4 || runtimeNpcs.length > 6) {
          errors.push(`towns.${town.id} prototype ecosystem chapter must author four to six NPCs.`);
        }
        for (const roleId of REQUIRED_ECOSYSTEM_NPC_ROLES) {
          if (!runtimeNpcs.some((npc) => npc.roleId === roleId)) {
            errors.push(`towns.${town.id} prototype ecosystem chapter has no NPC for role ${roleId}.`);
          }
        }
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
    if (scene.routeId !== undefined) {
      requireReference(scene.routeId, routeIds, `scenes.${scene.id}.routeId`, errors);
    }
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
    if (
      scene.world.artPath !== undefined
      && (typeof scene.world.artPath !== "string" || !/^\/images\/adventure\/[a-z0-9-]+\.png$/.test(scene.world.artPath))
    ) {
      errors.push(`scenes.${scene.id}.world.artPath must reference a PNG in /images/adventure/.`);
    }
    if (!Number.isInteger(scene.world.spawn?.x) || !Number.isInteger(scene.world.spawn?.y)) {
      errors.push(`scenes.${scene.id}.world.spawn requires integer x and y coordinates.`);
    }
    if (scene.world.worldKind === "route") {
      if (!scene.routeId) errors.push(`scenes.${scene.id} route world requires routeId.`);
      const movement = scene.world.movement;
      if (!isObject(movement) || movement.mode !== "boat") {
        errors.push(`scenes.${scene.id}.world.movement must declare boat mode.`);
      } else {
        for (const field of ["speed", "radius", "maxStepDistance"]) {
          if (!Number.isFinite(movement[field]) || movement[field] <= 0) {
            errors.push(`scenes.${scene.id}.world.movement.${field} must be a positive finite number.`);
          }
        }
      }
    }

    if (scene.world.collisionRects !== undefined && !Array.isArray(scene.world.collisionRects)) {
      errors.push(`scenes.${scene.id}.world.collisionRects must be an array when supplied.`);
    } else {
      const collisionRectIds = new Set();
      for (const [index, collisionRect] of asArray(scene.world.collisionRects).entries()) {
        const path = `scenes.${scene.id}.world.collisionRects[${index}]`;
        if (!isObject(collisionRect)) {
          errors.push(`${path} must be an object.`);
          continue;
        }
        if (typeof collisionRect.id !== "string" || !collisionRect.id.trim()) {
          errors.push(`${path}.id must be non-empty.`);
        } else if (collisionRectIds.has(collisionRect.id)) {
          errors.push(`scenes.${scene.id}.world.collisionRects contains duplicate id ${collisionRect.id}.`);
        } else {
          collisionRectIds.add(collisionRect.id);
        }

        const bounds = ["left", "top", "right", "bottom"];
        for (const bound of bounds) {
          if (!Number.isFinite(collisionRect[bound])) {
            errors.push(`${path}.${bound} must be finite.`);
          }
        }
        if (
          Number.isFinite(collisionRect.left)
          && Number.isFinite(collisionRect.right)
          && collisionRect.left >= collisionRect.right
        ) {
          errors.push(`${path} must have left less than right.`);
        }
        if (
          Number.isFinite(collisionRect.top)
          && Number.isFinite(collisionRect.bottom)
          && collisionRect.top >= collisionRect.bottom
        ) {
          errors.push(`${path} must have top less than bottom.`);
        }
        if (
          Number.isFinite(collisionRect.left)
          && Number.isFinite(collisionRect.top)
          && Number.isFinite(collisionRect.right)
          && Number.isFinite(collisionRect.bottom)
          && (
            collisionRect.left < -0.5
            || collisionRect.top < -0.5
            || collisionRect.right > width - 0.5
            || collisionRect.bottom > rows.length - 0.5
          )
        ) {
          errors.push(`${path} must stay inside the scene bounds.`);
        }
      }
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
        errors.push(`${path}.type is not a supported runtime interaction type.`);
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
      } else if (interaction.type === "npc") {
        requireReference(interaction.npcId, npcIds, `${path}.npcId`, errors);
        requireReference(interaction.conversationId, conversationIds, `${path}.conversationId`, errors);
        const npc = npcsById.get(interaction.npcId);
        if (npc && npc.sceneId !== scene.id) errors.push(`${path}.npcId must belong to the interaction scene.`);
        if (npc && npc.conversationId !== interaction.conversationId) errors.push(`${path}.conversationId must match the NPC conversation.`);
        if (npc?.encounterId) errors.push(`${path}.npcId must resolve to a non-dueling NPC.`);
      } else if (interaction.type === "observation") {
        requireReference(interaction.questId, questIds, `${path}.questId`, errors);
        if (typeof interaction.observationId !== "string" || !interaction.observationId.trim()) {
          errors.push(`${path}.observationId is required.`);
        }
      } else if (interaction.type === "interpretation" || interaction.type === "response") {
        requireReference(interaction.questId, questIds, `${path}.questId`, errors);
        if (typeof interaction.choiceSetId !== "string" || !interaction.choiceSetId.trim()) {
          errors.push(`${path}.choiceSetId is required.`);
        }
      } else if (interaction.type === "board" || interaction.type === "dock") {
        requireReference(interaction.routeId, routeIds, `${path}.routeId`, errors);
        requireReference(interaction.dockId, dockIds, `${path}.dockId`, errors);
        requireReference(interaction.targetScene, sceneIds, `${path}.targetScene`, errors);
        if (!Number.isInteger(interaction.spawn?.x) || !Number.isInteger(interaction.spawn?.y)) {
          errors.push(`${path}.spawn requires integer x and y coordinates.`);
        }
        if (!FACING_DIRECTIONS.has(interaction.facing)) {
          errors.push(`${path}.facing must be up, down, left, or right.`);
        }
        if (interaction.type === "dock" && !["from", "to"].includes(interaction.endpoint)) {
          errors.push(`${path}.endpoint must be from or to.`);
        }
      } else if (interaction.type === "enter" || interaction.type === "exit") {
        requireReference(interaction.targetScene, sceneIds, `${path}.targetScene`, errors);
        if (!Number.isInteger(interaction.spawn?.x) || !Number.isInteger(interaction.spawn?.y)) {
          errors.push(`${path}.spawn requires integer x and y coordinates.`);
        }
        if (interaction.facing !== undefined && !FACING_DIRECTIONS.has(interaction.facing)) {
          errors.push(`${path}.facing must be up, down, left, or right when supplied.`);
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
    requireReference(npc.encounterId, encounterIds, `npcs.${npc.id}.encounterId`, errors, { nullable: true });
    if (npc.exhibitionEncounterId !== undefined) {
      requireReference(npc.exhibitionEncounterId, encounterIds, `npcs.${npc.id}.exhibitionEncounterId`, errors);
    }
    for (const field of ["name", "title", "color"]) {
      if (typeof npc[field] !== "string" || !npc[field].trim()) errors.push(`npcs.${npc.id}.${field} is required.`);
    }
    if (npc.encounterId && (typeof npc.crest !== "string" || !npc.crest.trim())) {
      errors.push(`npcs.${npc.id}.crest is required for a dueling NPC.`);
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
    const exhibition = encountersById.get(npc.exhibitionEncounterId);
    if (exhibition && (
      exhibition.townId !== npc.townId
      || exhibition.opponentId !== npc.id
      || exhibition.role !== "exhibition"
    )) {
      errors.push(`npcs.${npc.id}.exhibitionEncounterId must resolve to an exhibition for the same NPC and town.`);
    }
  }

  for (const conversation of conversations) {
    requireReference(conversation.townId, townIds, `conversations.${conversation.id}.townId`, errors);
    requireReference(conversation.npcId, npcIds, `conversations.${conversation.id}.npcId`, errors);
    const npc = npcsById.get(conversation.npcId);
    if (npc && (npc.townId !== conversation.townId || npc.conversationId !== conversation.id)) {
      errors.push(`conversations.${conversation.id} must belong to its NPC and town.`);
    }
    const requiredModes = npc?.encounterId ? CONVERSATION_MODES : NON_DUEL_CONVERSATION_MODES;
    for (const mode of requiredModes) {
      const lines = conversation.lines?.[mode];
      if (!Array.isArray(lines) || !lines.length || lines.some((line) => typeof line !== "string" || !line.trim())) {
        errors.push(`conversations.${conversation.id}.lines.${mode} must contain at least one non-empty line.`);
      }
    }
    if (conversation.townId === "sunpatch-cay" && npc?.encounterId) {
      const returnLines = conversation.lines?.return;
      if (!Array.isArray(returnLines) || !returnLines.length || returnLines.some((line) => typeof line !== "string" || !line.trim())) {
        errors.push(`conversations.${conversation.id}.lines.return must contain at least one non-empty line.`);
      }
    }
    if (npc?.exhibitionEncounterId) {
      const exhibitionLines = conversation.lines?.exhibition;
      if (!Array.isArray(exhibitionLines) || !exhibitionLines.length || exhibitionLines.some((line) => typeof line !== "string" || !line.trim())) {
        errors.push(`conversations.${conversation.id}.lines.exhibition must contain at least one non-empty line.`);
      }
    }
    if (npc?.roleId === "mentor") {
      for (const mode of MENTOR_CONVERSATION_MODES) {
        const lines = conversation.lines?.[mode];
        if (!Array.isArray(lines) || !lines.length || lines.some((line) => typeof line !== "string" || !line.trim())) {
          errors.push(`conversations.${conversation.id}.lines.${mode} must contain at least one non-empty line.`);
        }
      }
    }
  }

  if (
    starterDecks.length !== ADVENTURE_STARTER_DECK_IDS.length
    || ADVENTURE_STARTER_DECK_IDS.some((starterDeckId) => !starterDecksById.has(starterDeckId))
  ) {
    errors.push("starterDecks must contain exactly Coral Garden, Murky Water, and Blue Water.");
  }
  const claimedStarterDeckIds = new Set();
  for (const starterDeck of starterDecks) {
    for (const field of ["deckId", "name", "habitat", "color", "tagline", "summary", "playStyle", "difficulty", "watchFor"]) {
      if (typeof starterDeck[field] !== "string" || !starterDeck[field].trim()) {
        errors.push(`starterDecks.${starterDeck.id}.${field} is required.`);
      }
    }
    if (starterDeck.deckId !== starterDeck.id) {
      errors.push(`starterDecks.${starterDeck.id}.deckId must match its canonical starter id.`);
    }
    if (claimedStarterDeckIds.has(starterDeck.deckId)) {
      errors.push(`starterDecks contains duplicate deckId ${starterDeck.deckId}.`);
    }
    claimedStarterDeckIds.add(starterDeck.deckId);
    if (
      !Array.isArray(starterDeck.strengths)
      || starterDeck.strengths.length < 2
      || starterDeck.strengths.some((strength) => typeof strength !== "string" || !strength.trim())
    ) {
      errors.push(`starterDecks.${starterDeck.id}.strengths must contain at least two non-empty strengths.`);
    }
    if (!isObject(starterDeck.metrics)) {
      errors.push(`starterDecks.${starterDeck.id}.metrics must be an object.`);
    } else {
      for (const metric of STARTER_METRICS) {
        if (!Number.isInteger(starterDeck.metrics[metric]) || starterDeck.metrics[metric] < 1 || starterDeck.metrics[metric] > 5) {
          errors.push(`starterDecks.${starterDeck.id}.metrics.${metric} must be an integer from 1 to 5.`);
        }
      }
    }
  }

  for (const tutorial of tutorials) {
    requireReference(tutorial.townId, townIds, `tutorials.${tutorial.id}.townId`, errors);
    requireReference(tutorial.sceneId, sceneIds, `tutorials.${tutorial.id}.sceneId`, errors);
    requireReference(tutorial.questId, questIds, `tutorials.${tutorial.id}.questId`, errors);
    requireReference(tutorial.mentorNpcId, npcIds, `tutorials.${tutorial.id}.mentorNpcId`, errors);
    requireReference(tutorial.practiceEncounterId, encounterIds, `tutorials.${tutorial.id}.practiceEncounterId`, errors);
    requireReference(tutorial.completionRewardId, rewardIds, `tutorials.${tutorial.id}.completionRewardId`, errors);
    requireReference(tutorial.fieldNoteId, fieldNoteIds, `tutorials.${tutorial.id}.fieldNoteId`, errors);
    for (const starterDeckId of asArray(tutorial.starterDeckIds)) {
      requireReference(starterDeckId, starterDeckIds, `tutorials.${tutorial.id}.starterDeckIds`, errors);
    }
    if (
      asArray(tutorial.starterDeckIds).length !== ADVENTURE_STARTER_DECK_IDS.length
      || ADVENTURE_STARTER_DECK_IDS.some((starterDeckId) => !asArray(tutorial.starterDeckIds).includes(starterDeckId))
    ) {
      errors.push(`tutorials.${tutorial.id}.starterDeckIds must include all three canonical starter decks.`);
    }
    if (tutorial.victoryTarget !== 26) errors.push(`tutorials.${tutorial.id}.victoryTarget must be 26.`);
    if (tutorial.ordered !== true || tutorial.allowRetry !== true || tutorial.allowExit !== true) {
      errors.push(`tutorials.${tutorial.id} must be ordered and allow retry and exit.`);
    }
    if (tutorial.resumePolicy !== "last-completed-checkpoint") {
      errors.push(`tutorials.${tutorial.id}.resumePolicy must be last-completed-checkpoint.`);
    }

    const checkpointIds = new Set();
    const checkpoints = objectItems(tutorial.checkpoints);
    const actionTypes = checkpoints.map((checkpoint) => checkpoint.actionType);
    const authoredCheckpointIds = checkpoints.map((checkpoint) => checkpoint.id);
    if (
      actionTypes.length !== REQUIRED_TUTORIAL_ACTION_TYPES.length
      || actionTypes.some((actionType, index) => actionType !== REQUIRED_TUTORIAL_ACTION_TYPES[index])
    ) {
      errors.push(`tutorials.${tutorial.id}.checkpoints must exactly follow ${REQUIRED_TUTORIAL_ACTION_TYPES.join(" -> ")}.`);
    }
    if (
      authoredCheckpointIds.length !== REQUIRED_TUTORIAL_CHECKPOINT_IDS.length
      || authoredCheckpointIds.some((checkpointId, index) => checkpointId !== REQUIRED_TUTORIAL_CHECKPOINT_IDS[index])
    ) {
      errors.push(`tutorials.${tutorial.id}.checkpoint ids must exactly follow ${REQUIRED_TUTORIAL_CHECKPOINT_IDS.join(" -> ")}.`);
    }
    for (const [index, checkpoint] of checkpoints.entries()) {
      if (typeof checkpoint.id !== "string" || !checkpoint.id.trim()) {
        errors.push(`tutorials.${tutorial.id}.checkpoints[${index}].id is required.`);
      } else if (checkpointIds.has(checkpoint.id)) {
        errors.push(`tutorials.${tutorial.id}.checkpoints contains duplicate id ${checkpoint.id}.`);
      } else {
        checkpointIds.add(checkpoint.id);
      }
      if (typeof checkpoint.instruction !== "string" || !checkpoint.instruction.trim()) {
        errors.push(`tutorials.${tutorial.id}.checkpoints[${index}].instruction is required.`);
      }
    }
    if (!Array.isArray(tutorial.checkpoints)) {
      errors.push(`tutorials.${tutorial.id}.checkpoints must be an array.`);
    }

    const scene = scenesById.get(tutorial.sceneId);
    const mentor = npcsById.get(tutorial.mentorNpcId);
    const encounter = encountersById.get(tutorial.practiceEncounterId);
    const fieldNote = fieldNotesById.get(tutorial.fieldNoteId);
    if (scene && scene.townId !== tutorial.townId) errors.push(`tutorials.${tutorial.id}.sceneId must belong to the tutorial town.`);
    if (mentor && (mentor.townId !== tutorial.townId || mentor.sceneId !== tutorial.sceneId || mentor.roleId !== "mentor")) {
      errors.push(`tutorials.${tutorial.id}.mentorNpcId must resolve to the mentor in the tutorial scene.`);
    }
    if (encounter && (
      encounter.townId !== tutorial.townId
      || encounter.questId !== tutorial.questId
      || encounter.opponentId !== tutorial.mentorNpcId
      || encounter.role !== "practice"
      || encounter.victoryTarget !== tutorial.victoryTarget
      || encounter.rewardId !== tutorial.completionRewardId
      || encounter.tutorialId !== tutorial.id
    )) {
      errors.push(`tutorials.${tutorial.id}.practiceEncounterId must resolve to its 26 VP mentor practice encounter and reward.`);
    }
    if (fieldNote && fieldNote.status !== "prototype") {
      errors.push(`tutorials.${tutorial.id}.fieldNoteId must resolve to playable Field Note content.`);
    }
  }

  for (const fieldNote of fieldNotes) {
    for (const field of ["title", "habitatId", "status"]) {
      if (typeof fieldNote[field] !== "string" || !fieldNote[field].trim()) {
        errors.push(`fieldNotes.${fieldNote.id}.${field} is required.`);
      }
    }
    if (!["planned", "prototype"].includes(fieldNote.status)) {
      errors.push(`fieldNotes.${fieldNote.id}.status must be planned or prototype.`);
    }
    if (fieldNote.status === "prototype") {
      if (typeof fieldNote.summary !== "string" || !fieldNote.summary.trim()) {
        errors.push(`fieldNotes.${fieldNote.id}.summary is required for playable Field Notes.`);
      }
      if (
        !Array.isArray(fieldNote.observations)
        || fieldNote.observations.length < 2
        || fieldNote.observations.some((observation) => typeof observation !== "string" || !observation.trim())
      ) {
        errors.push(`fieldNotes.${fieldNote.id}.observations must contain at least two observations.`);
      }
      const checklist = fieldNote.checklist ?? fieldNote.safetyChecklist;
      if (
        !Array.isArray(checklist)
        || checklist.length < 3
        || checklist.some((step) => typeof step !== "string" || !step.trim())
      ) {
        errors.push(`fieldNotes.${fieldNote.id} must contain a checklist with at least three steps.`);
      }
      if (fieldNote.checklist !== undefined && (
        typeof fieldNote.checklistTitle !== "string" || !fieldNote.checklistTitle.trim()
      )) {
        errors.push(`fieldNotes.${fieldNote.id}.checklistTitle is required with a generic checklist.`);
      }
      if (
        !Array.isArray(fieldNote.glossary)
        || !fieldNote.glossary.length
        || fieldNote.glossary.some((entry) => !isObject(entry) || typeof entry.term !== "string" || !entry.term.trim() || typeof entry.definition !== "string" || !entry.definition.trim())
      ) {
        errors.push(`fieldNotes.${fieldNote.id}.glossary must contain defined terms.`);
      }
      if ([
        "coral-reef",
        "estuary-mangrove",
        "open-ocean",
        "kelp-forest",
        "deep-ocean-trench",
      ].includes(fieldNote.habitatId) && (
        !Array.isArray(fieldNote.sourceUrls)
        || fieldNote.sourceUrls.length < 3
        || fieldNote.sourceUrls.some((sourceUrl) => typeof sourceUrl !== "string" || !/^https:\/\//.test(sourceUrl))
      )) {
        errors.push(`fieldNotes.${fieldNote.id}.sourceUrls must contain at least three HTTPS science sources.`);
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
      if (beat.speakerNpcId !== undefined) {
        requireReference(beat.speakerNpcId, npcIds, `dialogues.${dialogue.id}.beats.${beat.id}.speakerNpcId`, errors);
        const speaker = npcsById.get(beat.speakerNpcId);
        if (speaker && (speaker.townId !== dialogue.townId || speaker.roleId !== beat.speakerRoleId)) {
          errors.push(`dialogues.${dialogue.id}.beats.${beat.id}.speakerNpcId must match the beat town and role.`);
        }
        if (!Array.isArray(beat.lines) || !beat.lines.length || beat.lines.some((line) => typeof line !== "string" || !line.trim())) {
          errors.push(`dialogues.${dialogue.id}.beats.${beat.id}.lines must contain progressive dialogue copy.`);
        }
      }
    }
  }

  for (const encounter of encounters) {
    requireReference(encounter.townId, townIds, `encounters.${encounter.id}.townId`, errors);
    requireReference(encounter.questId, questIds, `encounters.${encounter.id}.questId`, errors);
    requireReference(encounter.rewardId, rewardIds, `encounters.${encounter.id}.rewardId`, errors, { nullable: true });
    if (encounter.tutorialId !== undefined) {
      requireReference(encounter.tutorialId, tutorialIds, `encounters.${encounter.id}.tutorialId`, errors);
      const tutorial = tutorialsById.get(encounter.tutorialId);
      if (tutorial && tutorial.practiceEncounterId !== encounter.id) {
        errors.push(`encounters.${encounter.id}.tutorialId must reference a tutorial that uses this practice encounter.`);
      }
    }
    const allowedVictoryTargets = encounter.tutorialId !== undefined ? [26] : [10, 30];
    if (!allowedVictoryTargets.includes(encounter.victoryTarget)) {
      errors.push(`encounters.${encounter.id}.victoryTarget must be ${encounter.tutorialId !== undefined ? "26 for an Academy tutorial" : "10 or 30"}.`);
    }
    if (encounter.role === "tournament" && encounter.victoryTarget !== 30) {
      errors.push(`encounters.${encounter.id} tournament matches must use 30 VP.`);
    }
    if (typeof encounter.opponentDeckId !== "string" || !encounter.opponentDeckId) {
      errors.push(`encounters.${encounter.id}.opponentDeckId is required.`);
    }
    const encounterTown = townsById.get(encounter.townId);
    const encounterTownIsPrototype = scenesById.get(encounterTown?.startSceneId)?.status === "prototype";
    if (encounterTownIsPrototype) {
      requireReference(encounter.opponentId, npcIds, `encounters.${encounter.id}.opponentId`, errors);
      const opponent = npcsById.get(encounter.opponentId);
      if (opponent && opponent.townId !== encounter.townId) {
        errors.push(`encounters.${encounter.id}.opponentId must belong to the encounter town.`);
      }
    }
    const prerequisites = asArray(encounter.prerequisites);
    for (const [index, prerequisite] of prerequisites.entries()) {
      if (!isObject(prerequisite)) {
        errors.push(`encounters.${encounter.id}.prerequisites[${index}] must be an object.`);
        continue;
      }
      if (prerequisite.type === "questStatus") {
        requireReference(prerequisite.questId, questIds, `encounters.${encounter.id}.prerequisites[${index}].questId`, errors);
        if (!QUEST_STATUSES.includes(prerequisite.status)) {
          errors.push(`encounters.${encounter.id}.prerequisites[${index}].status must be a known quest status.`);
        }
      } else if (prerequisite.type === "encounterComplete") {
        requireReference(prerequisite.encounterId, encounterIds, `encounters.${encounter.id}.prerequisites[${index}].encounterId`, errors);
        if (prerequisite.encounterId === encounter.id) {
          errors.push(`encounters.${encounter.id}.prerequisites[${index}] cannot require itself.`);
        }
      } else {
        errors.push(`encounters.${encounter.id}.prerequisites[${index}].type is unsupported.`);
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
    if (encounter.role === "exhibition") {
      if (encounter.victoryTarget !== 30) {
        errors.push(`encounters.${encounter.id} exhibition must use 30 VP.`);
      }
      const requiresQualifier = prerequisites.some((prerequisite) => (
        isObject(prerequisite)
        && prerequisite.type === "encounterComplete"
        && encountersById.get(prerequisite.encounterId)?.role === "qualifier"
        && encountersById.get(prerequisite.encounterId)?.townId === encounter.townId
      ));
      if (!requiresQualifier) {
        errors.push(`encounters.${encounter.id} exhibition must require the town qualifier.`);
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
    for (const fieldNoteId of grant.fieldNoteIds) requireReference(fieldNoteId, fieldNoteIds, `rewards.${reward.id}.fieldNoteIds`, errors);
  }

  for (const pool of packPools) {
    const path = `packPools.${pool.id}`;
    if (typeof pool.name !== "string" || !pool.name.trim()) {
      errors.push(`${path}.name must be non-empty.`);
    }
    if (!Number.isSafeInteger(pool.version) || pool.version <= 0) {
      errors.push(`${path}.version must be a positive safe integer.`);
    }
    if (!PACK_POOL_STATUSES.has(pool.status)) {
      errors.push(`${path}.status must be planned or playable.`);
    }
    if (pool.purchaseMode !== "earned-only") errors.push(`packPools.${pool.id}.purchaseMode must be earned-only.`);
    if (!Number.isSafeInteger(pool.cardsPerPack) || pool.cardsPerPack <= 0) {
      errors.push(`${path}.cardsPerPack must be a positive safe integer.`);
    }
    if (pool.progressionGuarantee !== PLAYABLE_PACK_GUARANTEE) {
      errors.push(`${path}.progressionGuarantee must be ${PLAYABLE_PACK_GUARANTEE}.`);
    }
    if (!Array.isArray(pool.cardIds)) {
      errors.push(`${path}.cardIds must be an array.`);
      continue;
    }

    const cardIds = new Set();
    for (const [index, cardId] of pool.cardIds.entries()) {
      if (typeof cardId !== "string" || !cardId.trim()) {
        errors.push(`${path}.cardIds[${index}] must be a non-empty card id.`);
      } else if (cardIds.has(cardId)) {
        errors.push(`${path}.cardIds contains duplicate card id ${cardId}.`);
      } else {
        cardIds.add(cardId);
      }
    }
    if (pool.status === "playable" && cardIds.size < pool.cardsPerPack) {
      errors.push(`${path} must contain at least cardsPerPack unique cards when playable.`);
    }
  }

  for (const route of routes) {
    requireReference(route.fromTownId, townIds, `routes.${route.id}.fromTownId`, errors);
    requireReference(route.toTownId, townIds, `routes.${route.id}.toTownId`, errors);
    if (route.fromTownId === route.toTownId) errors.push(`routes.${route.id} must connect different towns.`);
    if (route.sceneId !== undefined) {
      requireReference(route.sceneId, sceneIds, `routes.${route.id}.sceneId`, errors);
      requireReference(route.fromDockId, dockIds, `routes.${route.id}.fromDockId`, errors);
      requireReference(route.toDockId, dockIds, `routes.${route.id}.toDockId`, errors);
      const scene = scenesById.get(route.sceneId);
      const fromDock = docksById.get(route.fromDockId);
      const toDock = docksById.get(route.toDockId);
      if (scene && (
        scene.routeId !== route.id
        || scene.status !== "prototype"
        || scene.world?.worldKind !== "route"
      )) {
        errors.push(`routes.${route.id}.sceneId must resolve to its prototype route world.`);
      }
      if (fromDock && fromDock.townId !== route.fromTownId) {
        errors.push(`routes.${route.id}.fromDockId must belong to fromTownId.`);
      }
      if (toDock && toDock.townId !== route.toTownId) {
        errors.push(`routes.${route.id}.toDockId must belong to toTownId.`);
      }
      for (const endpoint of ["fromSpawn", "toSpawn"]) {
        const spawn = route[endpoint];
        if (!Number.isInteger(spawn?.x) || !Number.isInteger(spawn?.y)) {
          errors.push(`routes.${route.id}.${endpoint} requires integer x and y coordinates.`);
        }
        if (!FACING_DIRECTIONS.has(spawn?.facing)) {
          errors.push(`routes.${route.id}.${endpoint}.facing must be up, down, left, or right.`);
        }
      }
      const dockInteractions = objectItems(scene?.world?.interactions).filter(
        (interaction) => interaction.type === "dock" && interaction.routeId === route.id,
      );
      if (!dockInteractions.some((interaction) => interaction.endpoint === "from" && interaction.dockId === route.fromDockId)) {
        errors.push(`routes.${route.id} route world requires its from dock interaction.`);
      }
      if (!dockInteractions.some((interaction) => interaction.endpoint === "to" && interaction.dockId === route.toDockId)) {
        errors.push(`routes.${route.id} route world requires its to dock interaction.`);
      }
    }
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
