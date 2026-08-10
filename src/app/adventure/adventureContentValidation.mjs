import {
  ADVENTURE_STARTER_DECK_IDS,
  ADVENTURE_CONTENT_SCHEMA_VERSION,
  CHAMPIONS_WAKE_ACTION_IDS,
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
  "worldIntroduction",
  "starterPresentation",
  "registration",
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
  "sub-launch",
  "board",
  "dock",
]);
const AQUARIUM_TANK_IDS = new Set([
  "reef-community",
  "reef-apex",
  "oceanic-community",
  "oceanic-apex",
  "deep-community",
  "deep-apex",
]);
const TOURNAMENT_ACTION_TYPES = new Set(["registration", "round", "epilogue"]);
const TOURNAMENT_DIRECTOR_CONVERSATION_MODES = ["registration", "roundReady", "champion", "postgame"];
const TOURNAMENT_OPPONENT_CONVERSATION_MODES = ["roundReady", "defeat", "roundVictory", "postgame"];
const TOURNAMENT_REFLECTION_CONVERSATION_MODES = ["epilogue", "postgame"];
const FACING_DIRECTIONS = new Set(["up", "down", "left", "right"]);
const MOVEMENT_AXES = new Set(["free", "horizontal"]);
const AQUARIUM_ECOSYSTEM_IDS = new Set(["reef", "oceanic", "deep"]);
const CAMERA_FIELDS = new Set(["viewportAspect", "tilesAcross", "playerAnchorX", "playerAnchorY"]);
const PATROL_MODES = new Set(["loop", "ping-pong"]);
const LAYERED_OBJECT_LAYERS = new Set(["ground", "depth", "overhead"]);
const ADVENTURE_SPRITE_PATH = /^\/images\/adventure\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.(?:png|webp)$/;
const SCENE_GEOMETRY_EPSILON = 1e-9;
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

function validateFiniteBounds(value, {
  path,
  width,
  height,
  errors,
  requireInsideScene = true,
}) {
  if (!isObject(value)) {
    errors.push(`${path} must be an object.`);
    return false;
  }

  let finite = true;
  for (const bound of ["left", "top", "right", "bottom"]) {
    if (!Number.isFinite(value[bound])) {
      errors.push(`${path}.${bound} must be finite.`);
      finite = false;
    }
  }
  if (!finite) return false;

  let positiveArea = true;
  if (value.left >= value.right) {
    errors.push(`${path} must have left less than right.`);
    positiveArea = false;
  }
  if (value.top >= value.bottom) {
    errors.push(`${path} must have top less than bottom.`);
    positiveArea = false;
  }
  if (!positiveArea) return false;

  if (
    requireInsideScene
    && width > 0
    && height > 0
    && (
      value.left < -0.5 - SCENE_GEOMETRY_EPSILON
      || value.top < -0.5 - SCENE_GEOMETRY_EPSILON
      || value.right > width - 0.5 + SCENE_GEOMETRY_EPSILON
      || value.bottom > height - 0.5 + SCENE_GEOMETRY_EPSILON
    )
  ) {
    errors.push(`${path} must stay inside the scene bounds.`);
    return false;
  }

  return true;
}

function sameFiniteBounds(left, right) {
  return ["left", "top", "right", "bottom"].every((bound) => (
    Number.isFinite(left?.[bound])
    && Number.isFinite(right?.[bound])
    && Math.abs(left[bound] - right[bound]) <= SCENE_GEOMETRY_EPSILON
  ));
}

function validateSceneWalkableRegions(world, { sceneId, width, height, errors }) {
  if (world.walkableRegions === undefined) return;
  const path = `scenes.${sceneId}.world.walkableRegions`;
  if (!Array.isArray(world.walkableRegions) || world.walkableRegions.length === 0) {
    errors.push(`${path} must be a non-empty array when supplied.`);
    return;
  }

  const regionIds = new Set();
  for (const [index, region] of world.walkableRegions.entries()) {
    const regionPath = `${path}[${index}]`;
    if (!isObject(region)) {
      errors.push(`${regionPath} must be an object.`);
      continue;
    }
    if (typeof region.id !== "string" || !region.id.trim()) {
      errors.push(`${regionPath}.id must be non-empty.`);
    } else if (regionIds.has(region.id)) {
      errors.push(`${path} contains duplicate id ${region.id}.`);
    } else {
      regionIds.add(region.id);
    }
    validateFiniteBounds(region, {
      path: regionPath,
      width,
      height,
      errors,
    });
  }
}

function validateSceneLayeredObjects(world, {
  sceneId,
  width,
  height,
  interactionIds,
  errors,
}) {
  if (world.layeredObjects === undefined) return;
  const path = `scenes.${sceneId}.world.layeredObjects`;
  if (!Array.isArray(world.layeredObjects)) {
    errors.push(`${path} must be an array when supplied.`);
    return;
  }

  const worldColliders = new Map(objectItems(world.collisionRects).map((rectangle) => [
    rectangle.id,
    rectangle,
  ]));
  const objectIds = new Set();
  const renderIds = new Set();
  const colliderIds = new Set();
  const linkedInteractionIds = new Set();

  for (const [index, object] of world.layeredObjects.entries()) {
    const objectPath = `${path}[${index}]`;
    if (!isObject(object)) {
      errors.push(`${objectPath} must be an object.`);
      continue;
    }

    const validId = typeof object.id === "string" && Boolean(object.id.trim());
    if (!validId) {
      errors.push(`${objectPath}.id must be non-empty.`);
    } else if (objectIds.has(object.id)) {
      errors.push(`${path} contains duplicate id ${object.id}.`);
    } else {
      objectIds.add(object.id);
    }

    if (typeof object.renderId !== "string" || !object.renderId.trim()) {
      errors.push(`${objectPath}.renderId must be non-empty.`);
    } else {
      if (renderIds.has(object.renderId)) {
        errors.push(`${path} contains duplicate renderId ${object.renderId}.`);
      }
      renderIds.add(object.renderId);
      if (validId && object.renderId !== `object:${object.id}`) {
        errors.push(`${objectPath}.renderId must equal object:${object.id}.`);
      }
    }
    if (object.kind !== "object") {
      errors.push(`${objectPath}.kind must equal object.`);
    }
    if (typeof object.archetype !== "string" || !object.archetype.trim()) {
      errors.push(`${objectPath}.archetype must be non-empty.`);
    }

    if (!isObject(object.at) || !Number.isFinite(object.at.x) || !Number.isFinite(object.at.y)) {
      errors.push(`${objectPath}.at requires finite x and y coordinates.`);
    } else if (
      width > 0
      && height > 0
      && (
        object.at.x < -0.5
        || object.at.y < -0.5
        || object.at.x > width - 0.5
        || object.at.y > height - 0.5
      )
    ) {
      errors.push(`${objectPath}.at must stay inside the scene bounds.`);
    }

    if (!isObject(object.sprite)) {
      errors.push(`${objectPath}.sprite must be an object.`);
    } else {
      const { sprite } = object;
      if (typeof sprite.src !== "string" || !ADVENTURE_SPRITE_PATH.test(sprite.src)) {
        errors.push(`${objectPath}.sprite.src must reference a PNG or WebP in /images/adventure/.`);
      }
      for (const dimension of ["width", "height"]) {
        if (!Number.isFinite(sprite[dimension]) || sprite[dimension] <= 0) {
          errors.push(`${objectPath}.sprite.${dimension} must be a positive finite number.`);
        }
      }
      for (const anchor of ["anchorX", "anchorY"]) {
        if (!Number.isFinite(sprite[anchor]) || sprite[anchor] < 0 || sprite[anchor] > 1) {
          errors.push(`${objectPath}.sprite.${anchor} must stay between 0 and 1.`);
        }
      }
    }

    if (!Number.isFinite(object.scale) || object.scale <= 0) {
      errors.push(`${objectPath}.scale must be a positive finite number.`);
    }
    if (!LAYERED_OBJECT_LAYERS.has(object.layer)) {
      errors.push(`${objectPath}.layer must be ground, depth, or overhead.`);
    }
    if (!Number.isFinite(object.depthY)) {
      errors.push(`${objectPath}.depthY must be finite.`);
    }
    if (!Number.isInteger(object.depthBias)) {
      errors.push(`${objectPath}.depthBias must be an integer.`);
    }
    validateFiniteBounds(object.visualBounds, {
      path: `${objectPath}.visualBounds`,
      width,
      height,
      errors,
      // Tall sprites and edge foliage may intentionally extend beyond the
      // navigable world. Their base colliders may not.
      requireInsideScene: false,
    });

    if (!Array.isArray(object.collisionRects)) {
      errors.push(`${objectPath}.collisionRects must be an array.`);
    } else {
      for (const [colliderIndex, collider] of object.collisionRects.entries()) {
        const colliderPath = `${objectPath}.collisionRects[${colliderIndex}]`;
        if (!isObject(collider)) {
          errors.push(`${colliderPath} must be an object.`);
          continue;
        }
        if (typeof collider.id !== "string" || !collider.id.trim()) {
          errors.push(`${colliderPath}.id must be non-empty.`);
        } else {
          if (colliderIds.has(collider.id)) {
            errors.push(`${path} contains duplicate collider id ${collider.id}.`);
          }
          colliderIds.add(collider.id);
          if (validId && !collider.id.startsWith(`${object.id}:`)) {
            errors.push(`${colliderPath}.id must begin with ${object.id}:.`);
          }
          const worldCollider = worldColliders.get(collider.id);
          if (!worldCollider) {
            errors.push(`${colliderPath} must also appear in world.collisionRects.`);
          } else if (!sameFiniteBounds(collider, worldCollider)) {
            errors.push(`${colliderPath} must match its world.collisionRects geometry.`);
          }
        }
        validateFiniteBounds(collider, {
          path: colliderPath,
          width,
          height,
          errors,
        });
      }
    }

    if (object.interactionId !== null) {
      if (typeof object.interactionId !== "string" || !object.interactionId.trim()) {
        errors.push(`${objectPath}.interactionId must be null or a non-empty string.`);
      } else {
        if (!interactionIds.has(object.interactionId)) {
          errors.push(`${objectPath}.interactionId references unknown scene interaction ${object.interactionId}.`);
        }
        if (linkedInteractionIds.has(object.interactionId)) {
          errors.push(`${path} links interaction ${object.interactionId} more than once.`);
        }
        linkedInteractionIds.add(object.interactionId);
      }
    }
  }
}

function validateInteractionPatrol(interaction, { path, width, height, errors }) {
  if (interaction.patrol === undefined) return;

  if (interaction.type !== "npc" && interaction.type !== "trainer") {
    errors.push(`${path}.patrol may only be supplied for npc or trainer interactions.`);
  }
  if (!isObject(interaction.patrol)) {
    errors.push(`${path}.patrol must be an object.`);
    return;
  }

  const patrolPath = `${path}.patrol`;
  const { patrol } = interaction;
  if (!PATROL_MODES.has(patrol.mode)) {
    errors.push(`${patrolPath}.mode must be loop or ping-pong.`);
  }
  if (!Number.isFinite(patrol.speed) || patrol.speed <= 0) {
    errors.push(`${patrolPath}.speed must be a positive finite number.`);
  }
  if (!Number.isFinite(patrol.pauseMs) || patrol.pauseMs < 0) {
    errors.push(`${patrolPath}.pauseMs must be a nonnegative finite number.`);
  }
  if (
    patrol.playerPauseDistance !== undefined
    && (!Number.isFinite(patrol.playerPauseDistance) || patrol.playerPauseDistance < 0)
  ) {
    errors.push(`${patrolPath}.playerPauseDistance must be a nonnegative finite number when supplied.`);
  }
  if (!Array.isArray(patrol.waypoints) || patrol.waypoints.length < 2) {
    errors.push(`${patrolPath}.waypoints must be an array with at least two entries.`);
    return;
  }

  for (const [waypointIndex, waypoint] of patrol.waypoints.entries()) {
    const waypointPath = `${patrolPath}.waypoints[${waypointIndex}]`;
    if (!isObject(waypoint) || !Number.isFinite(waypoint.x) || !Number.isFinite(waypoint.y)) {
      errors.push(`${waypointPath} requires finite x and y coordinates.`);
      continue;
    }
    if (
      width > 0
      && height > 0
      && (waypoint.x < 0 || waypoint.y < 0 || waypoint.x > width - 1 || waypoint.y > height - 1)
    ) {
      errors.push(`${waypointPath} must stay inside the scene bounds.`);
    }
  }

  const firstWaypoint = patrol.waypoints[0];
  if (
    isObject(firstWaypoint)
    && Number.isFinite(firstWaypoint.x)
    && Number.isFinite(firstWaypoint.y)
    && Number.isFinite(interaction.at?.x)
    && Number.isFinite(interaction.at?.y)
    && (firstWaypoint.x !== interaction.at.x || firstWaypoint.y !== interaction.at.y)
  ) {
    errors.push(`${patrolPath}.waypoints[0] must match the interaction at position.`);
  }
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

    if (town.chapterType === "tournament") {
      const requiredRoles = ["tournament-director", "town-challenger", "reflection-character", "spectator"];
      for (const roleId of requiredRoles) {
        if (!asArray(town.plannedNpcRoleIds).includes(roleId)) {
          errors.push(`towns.${town.id} is missing required tournament NPC role ${roleId}.`);
        }
      }
      if (Number(town.encounterPlan?.tournament) !== 3) {
        errors.push(`towns.${town.id}.encounterPlan must include exactly three tournament rounds.`);
      }

      const listedEncounters = asArray(town.encounterIds)
        .map((encounterId) => encountersById.get(encounterId))
        .filter(Boolean);
      if (
        listedEncounters.length !== 3
        || listedEncounters.some((encounter) => encounter.role !== "tournament" || encounter.victoryTarget !== 30)
      ) {
        errors.push(`towns.${town.id}.encounterIds must resolve to exactly three 30 VP tournament rounds.`);
      }

      listedEncounters.forEach((encounter, index) => {
        const expectedRoundIndex = index + 1;
        if (encounter.roundIndex !== expectedRoundIndex) {
          errors.push(`encounters.${encounter.id}.roundIndex must be ${expectedRoundIndex} in the authored bracket order.`);
        }
        const prerequisites = asArray(encounter.prerequisites);
        if (index === 0) {
          const requiresActiveQuest = prerequisites.some((prerequisite) => (
            isObject(prerequisite)
            && prerequisite.type === "questStatus"
            && prerequisite.questId === encounter.questId
            && prerequisite.status === "active"
          ));
          if (!requiresActiveQuest) {
            errors.push(`encounters.${encounter.id} quarterfinal must require its tournament quest to be active.`);
          }
        } else {
          const previousEncounter = listedEncounters[index - 1];
          const requiresPreviousRound = prerequisites.some((prerequisite) => (
            isObject(prerequisite)
            && prerequisite.type === "encounterComplete"
            && prerequisite.encounterId === previousEncounter?.id
          ));
          if (!requiresPreviousRound) {
            errors.push(`encounters.${encounter.id} must require completion of ${previousEncounter?.id}.`);
          }
        }
      });

      if (scenesById.get(town.startSceneId)?.status === "prototype") {
        const runtimeNpcs = npcs.filter((npc) => npc.townId === town.id);
        if (runtimeNpcs.length !== 6) {
          errors.push(`towns.${town.id} prototype tournament chapter must author its director, three opponents, reflection guide, and spectator.`);
        }
        for (const roleId of requiredRoles) {
          if (!runtimeNpcs.some((npc) => npc.roleId === roleId)) {
            errors.push(`towns.${town.id} prototype tournament chapter has no NPC for role ${roleId}.`);
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
  const runtimeTournamentActions = [];
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
      && (typeof scene.world.artPath !== "string" || !/^\/images\/adventure\/[a-z0-9-]+\.(?:png|webp)$/.test(scene.world.artPath))
    ) {
      errors.push(`scenes.${scene.id}.world.artPath must reference a PNG or WebP in /images/adventure/.`);
    }
    if (!Number.isFinite(scene.world.spawn?.x) || !Number.isFinite(scene.world.spawn?.y)) {
      errors.push(`scenes.${scene.id}.world.spawn requires finite x and y coordinates.`);
    }
    const movement = scene.world.movement;
    if (movement !== undefined) {
      if (!isObject(movement)) {
        errors.push(`scenes.${scene.id}.world.movement must be an object when supplied.`);
      } else {
        if (movement.axis !== undefined && !MOVEMENT_AXES.has(movement.axis)) {
          errors.push(`scenes.${scene.id}.world.movement.axis must be free or horizontal.`);
        }
        if (movement.idleFacing !== undefined && !FACING_DIRECTIONS.has(movement.idleFacing)) {
          errors.push(`scenes.${scene.id}.world.movement.idleFacing must be up, down, left, or right.`);
        }
      }
    }
    const camera = scene.world.camera;
    if (camera !== undefined) {
      if (!isObject(camera)) {
        errors.push(`scenes.${scene.id}.world.camera must be an object when supplied.`);
      } else {
        for (const field of Object.keys(camera)) {
          if (!CAMERA_FIELDS.has(field)) {
            errors.push(`scenes.${scene.id}.world.camera contains unknown field ${field}.`);
          }
        }
        for (const field of ["viewportAspect", "tilesAcross"]) {
          if (camera[field] !== undefined && (!Number.isFinite(camera[field]) || camera[field] <= 0)) {
            errors.push(`scenes.${scene.id}.world.camera.${field} must be a positive finite number.`);
          }
        }
        for (const field of ["playerAnchorX", "playerAnchorY"]) {
          if (
            camera[field] !== undefined
            && (!Number.isFinite(camera[field]) || camera[field] < 0 || camera[field] > 1)
          ) {
            errors.push(`scenes.${scene.id}.world.camera.${field} must be between zero and one.`);
          }
        }
      }
    }
    const aquariumGallery = scene.world.aquariumGallery;
    if (aquariumGallery !== undefined) {
      const galleryPath = `scenes.${scene.id}.world.aquariumGallery`;
      if (!isObject(aquariumGallery)) {
        errors.push(`${galleryPath} must be an object when supplied.`);
      } else {
        if (!AQUARIUM_ECOSYSTEM_IDS.has(aquariumGallery.ecosystemId)) {
          errors.push(`${galleryPath}.ecosystemId must be reef, oceanic, or deep.`);
        }
        if (scene.world.worldKind !== "interior") {
          errors.push(`${galleryPath} may only be supplied for an interior scene.`);
        }
        if (width !== 32 || rows.length !== 9) {
          errors.push(`${galleryPath} scenes must use a 32-by-9 map.`);
        }
        if (movement?.axis !== "horizontal" || movement?.idleFacing !== "up") {
          errors.push(`${galleryPath} scenes must use horizontal movement with an up idle facing.`);
        }
        if (
          camera?.tilesAcross !== 16
          || camera?.playerAnchorX !== 0.5
          || camera?.playerAnchorY !== 0.5
        ) {
          errors.push(`${galleryPath} scenes must use the authored 16-tile centered camera.`);
        }
        const tankSlots = asArray(aquariumGallery.tankSlots);
        if (!Array.isArray(aquariumGallery.tankSlots) || tankSlots.length !== 2) {
          errors.push(`${galleryPath}.tankSlots must contain exactly two slots.`);
        }
        const seenTankIds = new Set();
        for (const [slotIndex, slot] of tankSlots.entries()) {
          const slotPath = `${galleryPath}.tankSlots[${slotIndex}]`;
          if (!isObject(slot)) {
            errors.push(`${slotPath} must be an object.`);
            continue;
          }
          if (!AQUARIUM_TANK_IDS.has(slot.tankId)) {
            errors.push(`${slotPath}.tankId must identify a supported aquarium tank.`);
          } else if (seenTankIds.has(slot.tankId)) {
            errors.push(`${galleryPath}.tankSlots contains duplicate tankId ${slot.tankId}.`);
          }
          seenTankIds.add(slot.tankId);
          const expectedTankId = `${aquariumGallery.ecosystemId}-${slotIndex === 0 ? "community" : "apex"}`;
          if (slot.tankId !== expectedTankId) {
            errors.push(`${slotPath}.tankId must equal ${expectedTankId}.`);
          }
          const bounds = slot.bounds;
          if (
            !isObject(bounds)
            || [bounds.left, bounds.top, bounds.right, bounds.bottom]
              .some((value) => !Number.isFinite(value))
          ) {
            errors.push(`${slotPath}.bounds requires finite left, top, right, and bottom values.`);
            continue;
          }
          const expectedBounds = slotIndex === 0
            ? { left: 0, top: 0, right: 16, bottom: 9 }
            : { left: 16, top: 0, right: 32, bottom: 9 };
          if (Object.entries(expectedBounds).some(([field, value]) => bounds[field] !== value)) {
            errors.push(`${slotPath}.bounds must span its complete gallery half.`);
          }
        }
      }
    }
    if (scene.world.worldKind === "route") {
      if (!scene.routeId) errors.push(`scenes.${scene.id} route world requires routeId.`);
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

    const sceneInteractionIds = new Set(objectItems(scene.world.interactions)
      .filter((interaction) => typeof interaction.id === "string" && interaction.id.trim())
      .map((interaction) => interaction.id));
    validateSceneWalkableRegions(scene.world, {
      sceneId: scene.id,
      width,
      height: rows.length,
      errors,
    });
    validateSceneLayeredObjects(scene.world, {
      sceneId: scene.id,
      width,
      height: rows.length,
      interactionIds: sceneInteractionIds,
      errors,
    });

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
      if (!Number.isFinite(interaction.at?.x) || !Number.isFinite(interaction.at?.y)) {
        errors.push(`${path}.at requires finite x and y coordinates.`);
      }
      validateInteractionPatrol(interaction, {
        path,
        width,
        height: rows.length,
        errors,
      });

      if (interaction.tournamentAction !== undefined) {
        runtimeTournamentActions.push({ sceneId: scene.id, interaction });
        if (!TOURNAMENT_ACTION_TYPES.has(interaction.tournamentAction)) {
          errors.push(`${path}.tournamentAction must be registration, round, or epilogue.`);
        }
        requireReference(interaction.questId, questIds, `${path}.questId`, errors);
        if (townsById.get(scene.townId)?.chapterType !== "tournament") {
          errors.push(`${path}.tournamentAction may only be authored in a tournament town.`);
        }

        if (interaction.tournamentAction === "registration") {
          if (interaction.type !== "npc") {
            errors.push(`${path} registration must use an NPC interaction.`);
          }
          if (npcsById.get(interaction.npcId)?.roleId !== "tournament-director") {
            errors.push(`${path} registration must resolve to the tournament director.`);
          }
          const requiredTideMarkIds = asArray(interaction.requiredTideMarkIds);
          if (
            requiredTideMarkIds.length !== 5
            || requiredTideMarkIds.some((tideMarkId) => !tideMarkIds.has(tideMarkId))
          ) {
            errors.push(`${path}.requiredTideMarkIds must contain the five earned ecosystem Tide Marks.`);
          }
        } else if (interaction.tournamentAction === "round") {
          const encounter = encountersById.get(interaction.encounterId);
          if (interaction.type !== "trainer" || encounter?.role !== "tournament") {
            errors.push(`${path} round must resolve to a tournament trainer encounter.`);
          }
          if (interaction.roundIndex !== encounter?.roundIndex) {
            errors.push(`${path}.roundIndex must match its tournament encounter.`);
          }
        } else if (interaction.tournamentAction === "epilogue") {
          if (interaction.type !== "npc" || npcsById.get(interaction.npcId)?.roleId !== "reflection-character") {
            errors.push(`${path} epilogue must resolve to the tournament reflection character.`);
          }
        }
      } else if (
        interaction.type === "trainer"
        && encountersById.get(interaction.encounterId)?.role === "tournament"
      ) {
        errors.push(`${path} tournament trainer must declare tournamentAction round.`);
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
      } else if (interaction.type === "sub-launch") {
        requireReference(interaction.questId, questIds, `${path}.questId`, errors);
        requireReference(interaction.targetScene, sceneIds, `${path}.targetScene`, errors);
        if (!Number.isInteger(interaction.spawn?.x) || !Number.isInteger(interaction.spawn?.y)) {
          errors.push(`${path}.spawn requires integer x and y coordinates.`);
        }
        if (!FACING_DIRECTIONS.has(interaction.facing)) {
          errors.push(`${path}.facing must be up, down, left, or right.`);
        }
        const targetScene = scenesById.get(interaction.targetScene);
        if (targetScene && targetScene.townId !== scene.townId) {
          errors.push(`${path}.targetScene must belong to the same town.`);
        }
        if (targetScene && targetScene.world?.worldKind !== "vehicle") {
          errors.push(`${path}.targetScene must be a vehicle scene.`);
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
        if (!Number.isFinite(interaction.spawn?.x) || !Number.isFinite(interaction.spawn?.y)) {
          errors.push(`${path}.spawn requires finite x and y coordinates.`);
        }
        if (interaction.facing !== undefined && !FACING_DIRECTIONS.has(interaction.facing)) {
          errors.push(`${path}.facing must be up, down, left, or right when supplied.`);
        }
        if (
          interaction.approachDirection !== undefined
          && !FACING_DIRECTIONS.has(interaction.approachDirection)
        ) {
          errors.push(`${path}.approachDirection must be up, down, left, or right when supplied.`);
        }
      }
    }
    if (!Array.isArray(scene.world.interactions)) {
      errors.push(`scenes.${scene.id}.world.interactions must be an array.`);
    }
  }

  if (scenesById.get("champions-wake-town")?.status === "prototype") {
    const authoredTournamentActionIds = runtimeTournamentActions.map(({ interaction }) => interaction.id);
    const expectedTournamentActionIds = [
      CHAMPIONS_WAKE_ACTION_IDS.registration,
      ...CHAMPIONS_WAKE_ACTION_IDS.rounds,
      CHAMPIONS_WAKE_ACTION_IDS.epilogue,
    ];
    if (
      authoredTournamentActionIds.length !== expectedTournamentActionIds.length
      || expectedTournamentActionIds.some((interactionId) => !authoredTournamentActionIds.includes(interactionId))
    ) {
      errors.push(`Champion's Wake runtime actions must exactly include ${expectedTournamentActionIds.join(", ")}.`);
    }

    const registrationActions = runtimeTournamentActions.filter(({ interaction }) => interaction.tournamentAction === "registration");
    const roundActions = runtimeTournamentActions
      .filter(({ interaction }) => interaction.tournamentAction === "round")
      .sort((left, right) => left.interaction.roundIndex - right.interaction.roundIndex);
    const epilogueActions = runtimeTournamentActions.filter(({ interaction }) => interaction.tournamentAction === "epilogue");
    if (registrationActions.length !== 1 || registrationActions[0]?.sceneId !== "champions-wake-registration-hall") {
      errors.push("Champion's Wake must expose one validated registration action in the Registration Hall.");
    }
    if (
      roundActions.length !== 3
      || roundActions.some(({ sceneId, interaction }, index) => (
        sceneId !== "champions-wake-arena"
        || interaction.roundIndex !== index + 1
        || interaction.id !== CHAMPIONS_WAKE_ACTION_IDS.rounds[index]
      ))
    ) {
      errors.push("Champion's Wake must expose its three ordered tournament round actions in the Arena.");
    }
    if (epilogueActions.length !== 1 || epilogueActions[0]?.sceneId !== "champions-wake-reflection-pavilion") {
      errors.push("Champion's Wake must expose one validated epilogue action in the Reflection Pavilion.");
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
    if (conversation.townId === "champions-wake") {
      let tournamentModes = [];
      if (npc?.roleId === "tournament-director") tournamentModes = TOURNAMENT_DIRECTOR_CONVERSATION_MODES;
      else if (npc?.encounterId) tournamentModes = TOURNAMENT_OPPONENT_CONVERSATION_MODES;
      else if (npc?.roleId === "reflection-character") tournamentModes = TOURNAMENT_REFLECTION_CONVERSATION_MODES;
      else if (npc?.roleId === "spectator") tournamentModes = ["champion", "postgame"];

      for (const mode of tournamentModes) {
        const lines = conversation.lines?.[mode];
        if (!Array.isArray(lines) || !lines.length || lines.some((line) => typeof line !== "string" || !line.trim())) {
          errors.push(`conversations.${conversation.id}.lines.${mode} must contain authored tournament story copy.`);
        }
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
