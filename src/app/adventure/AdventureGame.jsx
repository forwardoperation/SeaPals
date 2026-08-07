"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cardsById } from "@/data/cards";
import { prebuiltDecks } from "@/data/tournaments/prebuiltDecks";
import { ADVENTURE_MARKETING_CONSENT_VERSION } from "@/lib/adventureAccount.mjs";
import { isStoryDuelVpTargetVictory } from "@/app/simulator/storyModeContract.mjs";
import {
  getProfessorSpeechDuration,
  getProfessorVisibleGraphemeCount,
  segmentProfessorMessage,
} from "@/app/simulator/tutorialDialogue.mjs";
import {
  SCENES,
  START_STATE,
  canOccupyContinuousPosition,
  getContinuousInteraction,
  getDoorwayTransition,
  movePlayerContinuous,
} from "./adventureWorld.mjs";
import { getAdventureCameraLayout } from "./adventureCamera.mjs";
import {
  createLayeredActorRenderable,
  getLayeredSceneObjectStyle,
  getLayeredSceneZIndex,
} from "./adventureLayeredScene.mjs";
import AdventureHandNetModal, {
  ELVERSON_HAND_NET_TIDEPOOL_PATH,
} from "./AdventureHandNetModal";
import {
  ELVERSON_AQUARIUM_SCENE_ID,
  ELVERSON_REEF_CREATURE_ATLAS_PATH,
  getElversonAquariumExhibitModel,
} from "./adventureAquariumExhibits.mjs";
import {
  ELVERSON_HAND_NET_ITEM_ID,
  ELVERSON_REEF_CATCHES,
  beginElversonHandNetTutorial,
  deliverElversonHandNetCatches,
  getElversonHandNetConversationMode,
  getElversonHandNetInteraction,
  getElversonHandNetItemDefinition,
  getElversonHandNetProgress,
  reconcileElversonAquariumRewards,
  recordElversonHandNetCatch,
  recordElversonHandNetTutorialCatch,
} from "./adventureFishing.mjs";
import {
  BOAT_MOTION_DEFAULTS,
  createBoatMotionState,
  getBoatFacingFromHeading,
  getContinuousBoatHeading,
  stepBoatMotion,
} from "./adventureBoatMotion.mjs";
import {
  ADVENTURE_ACTOR_DEFAULTS,
  advanceAdventureActorStates,
  createAdventureActorStates,
  focusAdventureActor,
  getAdventureActorBlockers,
  getAdventureFacingToward,
  getAdventureActorPositionOverrides,
} from "./adventureActors.mjs";
import { resolveAdventureMovementInput } from "./adventureMovementInput.mjs";
import { getAdventureConversationSecondaryAction } from "./adventureConversationActions.mjs";
import {
  advanceAdventureSceneTransition,
  createAdventureSceneTransition,
  getAdventureDoorStepVector,
  getAdventureSceneTransitionDurationMs,
} from "./adventureSceneTransition.mjs";
import {
  createAdventureSceneAssetPreloader,
  getAdventureInteriorDestinationSceneIds,
} from "./adventureSceneAssets.mjs";
import {
  getAdventureCameraRenderBounds,
  isAdventureActorInRenderBounds,
  isAdventureLayeredObjectInRenderBounds,
} from "./adventureRenderCulling.mjs";
import {
  ADVENTURE_ACTOR_ANIMATION_MODES,
  getAdventureActorAnimationMode,
  getAdventureWalkCycleDurationMs,
  getAdventureWalkFrameRegistration,
  isAdventurePlayerWalking,
} from "./adventureWalkAnimation.mjs";
import {
  ADVENTURE_CONTENT,
  getAdventureFieldNote,
  getAdventureStarterDeck,
  resolveAdventureNpc,
  resolveAdventureTutorial,
} from "./adventureContent.mjs";
import {
  buildUnlockedAdventureFieldNotes,
  getAdventureFieldNoteEyebrow,
} from "./adventureFieldNotes.mjs";
import {
  commitStarterSelection,
  getOnboardingProgress,
  recordBoatSafetyReview,
  recordPracticeDuelResult,
  recordTutorialCheckpoint,
  recordWorldIntroduction,
  recoverOnboardingResume,
} from "./adventureOnboarding.mjs";
import {
  ELVERSON_PROLOGUE_AQUARIUM_SCENE_ID,
  ELVERSON_PROLOGUE_BEATS,
  ELVERSON_PROLOGUE_BEDROOM_SCENE_ID,
  ELVERSON_PROLOGUE_BEST_FRIEND_ID,
  ELVERSON_PROLOGUE_HOME_SCENE_ID,
  ELVERSON_RIVAL_DEPARTURE_CONVERSATION,
  getElversonPrologueProgress,
  recordElversonPrologueBeat,
  recoverElversonPrologueResume,
} from "./adventureElversonPrologue.mjs";
import {
  ELVERSON_BEST_FRIEND_ARRIVAL_INTERACTION_ID,
  ELVERSON_BEST_FRIEND_ARRIVAL_PATH,
  ELVERSON_BEST_FRIEND_ARRIVAL_POSITION,
  ELVERSON_BEST_FRIEND_DOCK_WALK,
  ELVERSON_BEST_FRIEND_MEETING_POSITION,
  ELVERSON_DOCK_SPEECH_INTERACTION_ID,
  ELVERSON_DOCK_SPEECH_PLAYER_POSITION,
  ELVERSON_DOCK_SPEECH_RESTORE_POSITION,
  ELVERSON_MOM_GREETING_PATH,
  ELVERSON_MOM_GREETING_POSITION,
  createElversonDockSpeechInteractions,
  isElversonDockSpeechTriggerPosition,
} from "./adventureElversonOpeningScene.mjs";
import {
  ELVERSON_TOWN_SAFE_POSITIONS,
  ELVERSON_WYETH_HAND_NET_PATH,
} from "./adventureElversonTownLayout.mjs";
import {
  advanceGuidedWalkClock,
  createGuidedWalkPlan,
  sampleGuidedWalk,
} from "./adventureGuidedWalk.mjs";
import {
  ADVENTURE_PROFILE_IDS,
  claimUnscopedAdventureSaves,
  copyUnscopedAdventureSavesToAccount,
  createAccountScopedAdventureStorage,
  createAdventureStorageAdapter,
  inspectUnscopedAdventureSaves,
} from "./adventureStorage.mjs";
import { reconcileStarterCollection } from "./adventureCollection.mjs";
import { createActiveDuelDeckSnapshot } from "./adventureDecks.mjs";
import { assertAdventureDuelResultMatchesLaunch } from "./adventureDuel.mjs";
import { openAdventurePack } from "./adventurePacks.mjs";
import {
  ADVENTURE_CHARACTER_NAME_MAX_LENGTH,
  normalizeAdventureCharacterName,
  setQuestFlag,
} from "./adventureProgression.mjs";
import AdventureDecksModal from "./AdventureDecksModal";
import AdventureSettingsModal from "./AdventureSettingsModal";
import {
  AdventureWorldMapModal,
  AdventureFieldworkModal,
} from "./AdventurePhase4Modals";
import {
  getAdventureEcosystemConversationMode,
  getAdventureEcosystemChapterByQuestId,
  getAdventureEcosystemChapterByTownId,
  hasMetAdventureEcosystemGuide,
} from "./adventureEcosystemChapters.mjs";
import { TRENCHLIGHT_RESPONSE_CHOICES } from "./adventureTrenchlight.mjs";
import {
  TRENCHLIGHT_EXPEDITION_STEPS,
  TRENCHLIGHT_MISSION_CONTROL_SCENE_ID,
  TRENCHLIGHT_SUB_SCENE_ID,
  advanceTrenchlightExpedition,
  getTrenchlightExpeditionState,
  launchTrenchlightExpedition,
  returnTrenchlightExpeditionToStation,
} from "./adventureTrenchlightExpedition.mjs";
import {
  autoSteerAdventureRoute,
  boardAdventureRoute,
  buildAdventureWorldMapModel,
  dockAdventureRoute,
} from "./adventureTravel.mjs";
import {
  SHELLSHORE_RESIDENT_ENCOUNTER_IDS,
  beginChampionsWakeQuestAtCurrentScene,
  completeAdventureEncounter,
  createNewAdventureSession,
  enterAdventureScene,
  isAdventureEncounterAvailable,
  reconcileAdventureProgression,
  recordAdventureDuelResult,
  recoverElversonAdventureResume,
} from "./adventureSession.mjs";
import {
  CHAMPIONS_WAKE_QUEST_ID,
  CHAMPIONS_WAKE_REQUIRED_FIELD_NOTE_IDS,
  CHAMPIONS_WAKE_REQUIRED_TIDE_MARK_IDS,
  CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS,
  getChampionsWakeTournamentAvailability,
  getChampionsWakeTournamentLaunch,
  getChampionsWakeTournamentProgress,
  recordChampionsWakeTournamentResult,
  recoverChampionsWakeTournamentState,
  registerChampionsWakeTournament,
} from "./adventureTournament.mjs";
import styles from "./adventure.module.css";

const Simulator = dynamic(() => import("@/app/simulator/Simulator"), {
  ssr: false,
  loading: () => (
    <main className={styles.gameShell}>
      <div className={styles.oceanGlow} aria-hidden="true" />
      <div className={styles.introLayer} role="status">
        <div className={styles.introCard}>
          <div className={styles.introEyebrow}>Preparing the table</div>
          <h1>REEFBOUND</h1>
          <p>Opening the SeaRealm lesson…</p>
        </div>
      </div>
    </main>
  ),
});

const NEWSLETTER_INVITE_DISMISSAL_KEY_PREFIX =
  "seapals-reefbound-newsletter-invite-dismissed-v1";
const NEWSLETTER_INVITE_SUPPRESSED_STATUSES = new Set([
  "processing",
  "submitted",
  "subscribed",
]);

function getNewsletterInviteDismissalKey(accountId) {
  return `${NEWSLETTER_INVITE_DISMISSAL_KEY_PREFIX}:${accountId}`;
}

const BASE_TRAINERS = Object.freeze(Object.fromEntries(
  ADVENTURE_CONTENT.npcs
    .filter((npc) => npc.conversationId)
    .map((npc) => {
      const resolved = resolveAdventureNpc(npc.id);
      return [npc.id, Object.freeze({
        ...npc,
        deckId: resolved.encounter?.opponentDeckId ?? null,
        difficulty: resolved.encounter?.difficulty ?? null,
        victoryTarget: resolved.encounter?.victoryTarget ?? null,
        dialogue: resolved.conversation?.lines ?? {},
        intro: resolved.conversation?.lines?.intro ?? [],
        rematch: resolved.conversation?.lines?.rematch ?? [],
        victory: resolved.conversation?.lines?.victory ?? [],
      })];
    }),
));

const SUNPATCH_EXHIBITION_TRAINER_ID = "sunpatch-leader-exhibition";
const SUNPATCH_EXHIBITION_ENCOUNTER = ADVENTURE_CONTENT.encounters.find(
  (encounter) => encounter.id === "encounter-sunpatch-exhibition",
);
const TRAINERS = Object.freeze({
  ...BASE_TRAINERS,
  [SUNPATCH_EXHIBITION_TRAINER_ID]: Object.freeze({
    ...BASE_TRAINERS["sunpatch-leader"],
    encounterId: SUNPATCH_EXHIBITION_ENCOUNTER.id,
    deckId: SUNPATCH_EXHIBITION_ENCOUNTER.opponentDeckId,
    difficulty: SUNPATCH_EXHIBITION_ENCOUNTER.difficulty,
    victoryTarget: SUNPATCH_EXHIBITION_ENCOUNTER.victoryTarget,
    crest: null,
    virtual: true,
    dialogue: Object.freeze({
      ...BASE_TRAINERS["sunpatch-leader"].dialogue,
      exhibitionOffer: BASE_TRAINERS["sunpatch-leader"].dialogue.exhibition,
      exhibitionVictory: Object.freeze([
        "That was a strong full-match reef. The exhibition is complete, and your Tide Mark and story progress remain exactly as they were.",
        "Optional exhibitions carry no extra story reward, but they are a good way to test whether a deck can sustain its plan all the way to 30 VP.",
      ]),
    }),
  }),
});

const ACADEMY_MENTOR_ID = "academy-mentor";
const FISHERMAN_WYETH_ID = "fisherman-wyeth";
const FISHERMAN_WYETH_INTERACTION_ID = "interaction-elverson-fisherman-wyeth";
const ACADEMY_MENTOR_INTERACTION_ID = "interaction-academy-mentor";
const ELVERSON_OPENING_MENTOR_INTERACTION_ID = "interaction-elverson-opening-mentor";
const ELVERSON_AQUARIUM_GUIDED_TRANSITION = (() => {
  const entrance = SCENES.town.interactions.find(
    ({ id }) => id === "interaction-elverson-enter-aquarium",
  );
  if (!entrance) throw new Error("Elverson is missing its aquarium entrance.");
  return Object.freeze({
    type: "guided",
    interactionId: "guided-introduction-enter-aquarium",
    targetScene: entrance.targetScene,
    spawn: entrance.spawn,
    facing: entrance.facing,
  });
})();
const ELVERSON_OPENING_MENTOR_INTERACTION = (() => {
  const aquariumExit = SCENES["academy-lab"].interactions.find(
    ({ id }) => id === "interaction-academy-exit",
  );
  if (!aquariumExit) throw new Error("Elverson is missing its aquarium exit.");
  return Object.freeze({
    id: ELVERSON_OPENING_MENTOR_INTERACTION_ID,
    type: "npc",
    npcId: ACADEMY_MENTOR_ID,
    at: Object.freeze({
      x: aquariumExit.spawn.x + 1,
      y: aquariumExit.spawn.y,
    }),
    facing: "left",
  });
})();
const ELVERSON_DOCK_SPEECH_INTERACTIONS = createElversonDockSpeechInteractions(
  Object.values(TRAINERS)
    .filter((trainer) => trainer.townId === "shellshore-village" && !trainer.virtual)
    .map((trainer) => trainer.id),
  { mentorId: ACADEMY_MENTOR_ID },
);
const ELVERSON_HOME_OPENING_TRAINER_IDS = new Set([
  "player-mom",
  "player-dad",
]);
const ELVERSON_BEST_FRIEND_ARRIVAL_INTERACTION = Object.freeze({
  id: ELVERSON_BEST_FRIEND_ARRIVAL_INTERACTION_ID,
  type: "npc",
  npcId: ELVERSON_PROLOGUE_BEST_FRIEND_ID,
  at: ELVERSON_BEST_FRIEND_ARRIVAL_POSITION,
  facing: "left",
});
const ELVERSON_RIVAL_AQUARIUM_INTERACTION = Object.freeze({
  id: ELVERSON_RIVAL_DEPARTURE_CONVERSATION.interactionId,
  type: "npc",
  npcId: ELVERSON_PROLOGUE_BEST_FRIEND_ID,
  at: Object.freeze({ x: 9, y: 3 }),
  facing: "left",
});
const ELVERSON_FISHING_TUTORIAL_SESSION = Object.freeze({
  tutorial: true,
  required: true,
  spotId: "fishing-platform-west",
});
const SHELLSHORE_TUTORIAL = resolveAdventureTutorial("tutorial-shellshore-live-basics");
const SHELLSHORE_FIELD_NOTE = SHELLSHORE_TUTORIAL.fieldNote;
const STARTER_DECKS = Object.freeze(SHELLSHORE_TUTORIAL.starterDecks);
const PREBUILT_DECKS_BY_ID = Object.freeze(Object.fromEntries(
  prebuiltDecks.map((deck) => [deck.id, deck]),
));
const PACK_POOLS_BY_ID = Object.freeze(Object.fromEntries(
  ADVENTURE_CONTENT.packPools.map((pool) => [pool.id, pool]),
));
const STARTER_METRICS = Object.freeze([
  ["offense", "Offense"],
  ["defense", "Defense"],
  ["economy", "RP economy"],
  ["consistency", "Consistency"],
  ["tempo", "Tempo"],
]);

const SHELLSHORE_ENCOUNTER_IDS = SHELLSHORE_RESIDENT_ENCOUNTER_IDS;
const SHELLSHORE_RESIDENT_TRAINERS = Object.freeze(
  Object.values(TRAINERS).filter((trainer) => (
    SHELLSHORE_ENCOUNTER_IDS.includes(trainer.encounterId)
  )),
);

const SPRITE_SOURCE_BY_CHARACTER = Object.freeze({
  // Elverson residents use explicit age- and role-appropriate human designs.
  // This avoids clone-heavy hashing and never recolors an entire human sprite.
  "fisherman-wyeth": "fisherman-wyeth",
  landon: "player",
  william: "player",
  "teacher-caroline": "teacher-caroline",
  "player-mom": "teacher-caroline",
  eloise: "player",
  ivy: "ivy",
  karah: "marina",
  charlotte: "marina",
  "explorer-jordan": "explorer-jordan",
  finn: "dorian",
  "marine-biologist-jonah": "marine-biologist-jonah",
  ellis: "player",
  "programmer-harlan": "programmer-harlan",
  "player-dad": "town-adult",
  "player-best-friend": "explorer-jordan",
  edith: "marina",
  henderson: "town-adult",
  emilio: "town-adult",
  eli: "town-adult",
  calvin: "town-adult",
  henry: "player",
  jack: "player",
  oliver: "player",
  luke: "player",
  micah: "player",
  sam: "player",
  marina: "player",
  "town-theo": "player",
  "town-erik": "dorian",
  "red-schoolhouse-hudson": "player",
  "red-schoolhouse-harrison": "player",
  "red-schoolhouse-rosie": "marina",
  "red-schoolhouse-juliana": "marina",
  "reef-house-charlie": "player",
  "reef-house-danny": "dorian",
  "hybrid-house-olivia": "marina",
  "hybrid-house-alyssa": "marina",
  "hybrid-house-henry": "player",
  "sunpatch-tavi": "marina",
  "sunpatch-mira": "academy-mentor",
  "sunpatch-gardener": "marina",
  "sunpatch-surveyor": "dorian",
  "sunpatch-leader": "academy-mentor",
  "brackwater-rhea": "marina",
  "brackwater-scientist": "dorian",
  "brackwater-naturalist": "marina",
  "brackwater-harbormaster": "dorian",
  "brackwater-leader": "marina",
  // Later chapters retain role hooks for final authored sprite sheets while
  // falling back to the original human-toned animated cast.
  "current-guide": "current-guide",
  "current-analyst": "current-analyst",
  "current-navigator": "current-navigator",
  "current-deckhand": "current-deckhand",
  "current-leader": "current-leader",
  // Kelpwatch Island uses temporary role-specific source hooks until its final
  // authored character sheets are available.
  "kelpwatch-guide": "kelpwatch-guide",
  "kelpwatch-ecologist": "kelpwatch-ecologist",
  "kelpwatch-diver": "kelpwatch-diver",
  "kelpwatch-ranger": "kelpwatch-ranger",
  "kelpwatch-leader": "kelpwatch-leader",
  // Trenchlight Station uses temporary shadow treatments while its final
  // deep-ocean character sheets are being authored.
  "trenchlight-guide": "trenchlight-guide",
  "trenchlight-scientist": "trenchlight-scientist",
  "trenchlight-engineer": "trenchlight-engineer",
  "trenchlight-observer": "trenchlight-observer",
  "trenchlight-leader": "trenchlight-leader",
  // Champion's Wake reuses the human-toned animated sheets with stronger
  // edge shadows until final cast sprite sheets are authored.
  "champions-wake-director": "champions-wake-director",
  "tournament-quarterfinalist": "tournament-quarterfinalist",
  "tournament-semifinalist": "tournament-semifinalist",
  "tournament-champion": "tournament-champion",
  "champions-wake-reflector": "champions-wake-reflector",
  "champions-wake-spectator": "champions-wake-spectator",
});

const RESIDENT_SPRITE_ARCHETYPES = Object.freeze([
  "player",
  "marina",
  "dorian",
]);

function residentSpriteSource(character) {
  if (["player", "marina", "dorian", ACADEMY_MENTOR_ID].includes(character)) return character;
  let hash = 0;
  for (const characterCode of character) {
    hash = ((hash * 31) + characterCode.codePointAt(0)) >>> 0;
  }
  return RESIDENT_SPRITE_ARCHETYPES[hash % RESIDENT_SPRITE_ARCHETYPES.length];
}

// Idle-frame alpha bounds differ substantially across the authored sheets and
// even between facing rows. These percentages place each ground shadow on the
// visible sole line inside the shared one-tile actor cell instead of assuming
// every sheet ends at the same point in its transparent crop.
const SPRITE_FEET_Y_BY_PROFILE = Object.freeze({
  player: Object.freeze({ down: 53.5, left: 52.9, right: 53.5, up: 53.9 }),
  marina: Object.freeze({ down: 53.9, left: 53.9, right: 53.9, up: 53.9 }),
  dorian: Object.freeze({ down: 53.2, left: 54.2, right: 53.9, up: 53.9 }),
  "fisherman-wyeth": Object.freeze({ down: 50.6, left: 47.1, right: 42.6, up: 40 }),
  "teacher-caroline": Object.freeze({ down: 42.3, left: 41.3, right: 37.8, up: 37.8 }),
  ivy: Object.freeze({ down: 55.8, left: 59, right: 59, up: 53.2 }),
  "explorer-jordan": Object.freeze({ down: 49.7, left: 46.5, right: 43.6, up: 41.3 }),
  "marine-biologist-jonah": Object.freeze({ down: 48.1, left: 45.2, right: 40, up: 36.2 }),
  "programmer-harlan": Object.freeze({ down: 52.6, left: 46.8, right: 42.3, up: 42.6 }),
  "town-adult": Object.freeze({ down: 45.5, left: 48.7, right: 45.8, up: 48.4 }),
  "town-elder": Object.freeze({ down: 55.8, left: 56.4, right: 52.6, up: 52.9 }),
  "academy-mentor": Object.freeze({ down: 53.7, left: 47.8, right: 58.8, up: 38.3 }),
});

const SPRITE_FOOT_PROFILE_BY_ARTWORK = Object.freeze({
  "current-guide": "player",
  "current-deckhand": "player",
  "kelpwatch-guide": "player",
  "kelpwatch-ranger": "player",
  "trenchlight-guide": "player",
  "trenchlight-engineer": "player",
  "tournament-quarterfinalist": "player",
  "champions-wake-spectator": "player",
  "current-analyst": "marina",
  "current-leader": "marina",
  "kelpwatch-ecologist": "marina",
  "kelpwatch-leader": "marina",
  "trenchlight-scientist": "marina",
  "trenchlight-leader": "marina",
  "champions-wake-director": "marina",
  "tournament-champion": "marina",
  "current-navigator": "dorian",
  "kelpwatch-diver": "dorian",
  "trenchlight-observer": "dorian",
  "tournament-semifinalist": "dorian",
  "champions-wake-reflector": "dorian",
});

function spriteArtworkCharacter(character) {
  return SPRITE_SOURCE_BY_CHARACTER[character] ?? residentSpriteSource(character);
}

function sceneCharacterSpriteProfileIds(scene) {
  const residentProfiles = scene?.interactions
    ?.filter((interaction) => (
      ["trainer", "npc"].includes(interaction.type)
      && TRAINERS[interaction.trainerId ?? interaction.npcId]
    ))
    .map((interaction) => spriteArtworkCharacter(
      interaction.trainerId ?? interaction.npcId,
    )) ?? [];
  return ["player", ...residentProfiles];
}

function spriteFeetY(character, facing) {
  const artworkCharacter = spriteArtworkCharacter(character);
  const profileId = SPRITE_FOOT_PROFILE_BY_ARTWORK[artworkCharacter] ?? artworkCharacter;
  const profile = SPRITE_FEET_Y_BY_PROFILE[profileId] ?? SPRITE_FEET_Y_BY_PROFILE.player;
  return `${profile[facing] ?? profile.down}%`;
}

function spriteAnimationProfile(character) {
  const artworkCharacter = spriteArtworkCharacter(character);
  return SPRITE_FOOT_PROFILE_BY_ARTWORK[artworkCharacter] ?? artworkCharacter;
}

const CHAMPIONSHIP_ENDING_FLAGS = Object.freeze({
  ceremony: "championship-ceremony-complete",
  epilogue: "championship-epilogue-complete",
  credits: "championship-credits-complete",
  postgame: "postgame-unlocked",
});

const DIALOGUE_SPEED_MULTIPLIERS = Object.freeze({
  slow: 1.5,
  normal: 1,
  fast: 0.55,
  instant: 0,
});

const CHAMPIONS_WAKE_ROUNDS = Object.freeze([
  Object.freeze({
    id: "encounter-tournament-quarterfinal",
    label: "Quarterfinal",
    opponent: "Miri Fen",
    trainerId: "tournament-quarterfinalist",
  }),
  Object.freeze({
    id: "encounter-tournament-semifinal",
    label: "Semifinal",
    opponent: "Oren Vale",
    trainerId: "tournament-semifinalist",
  }),
  Object.freeze({
    id: "encounter-tournament-final",
    label: "Championship final",
    opponent: "Sabine Rook",
    trainerId: "tournament-champion",
  }),
]);

const TIDE_MARK_LABELS = Object.freeze({
  "tide-mark-sunpatch": "Sunpatch Tide Mark",
  "tide-mark-brackwater": "Brackwater Tide Mark",
  "tide-mark-current": "Current Commons Tide Mark",
  "tide-mark-kelpwatch": "Kelpwatch Tide Mark",
  "tide-mark-trenchlight": "Trenchlight Tide Mark",
});

const FIELD_NOTE_LABELS = Object.freeze({
  "field-note-coral-observations": "Coral observations",
  "field-note-estuary-conditions": "Estuary conditions",
  "field-note-current-connections": "Current connections",
  "field-note-kelp-food-web": "Kelp food web",
  "field-note-deep-adaptations": "Deep adaptations",
});

const LOCATION_NAMES = Object.freeze(Object.fromEntries(
  Object.values(SCENES).map((scene) => [scene.id, scene.name]),
));

const DIRECTIONS = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  W: "up",
  s: "down",
  S: "down",
  a: "left",
  A: "left",
  d: "right",
  D: "right",
};

const MIN_MOVEMENT_INTENT_MS = 34;

function actorPosition(position, scene, actorId = null) {
  const layeredZIndex = actorId && scene.layeredObjects?.length
    ? getLayeredSceneZIndex(createLayeredActorRenderable({ id: actorId, position }))
    : null;
  return {
    left: `${((position.x + 0.5) / scene.width) * 100}%`,
    top: `${((position.y + 0.5) / scene.height) * 100}%`,
    width: `${100 / scene.width}%`,
    height: `${100 / scene.height}%`,
    zIndex: layeredZIndex ?? 20 + Math.round(position.y * 10),
  };
}

function AdventureLayeredMapObject({ object, scene }) {
  return (
    <Image
      className={styles.layeredMapObject}
      src={object.sprite.src}
      alt=""
      aria-hidden="true"
      width={Math.max(1, Math.round(object.sprite.width * 64))}
      height={Math.max(1, Math.round(object.sprite.height * 64))}
      sizes="100vw"
      draggable={false}
      unoptimized
      style={getLayeredSceneObjectStyle(object, scene)}
    />
  );
}

function AdventureAquariumExhibits({ model, reducedMotion = false }) {
  if (!model) return null;
  return (
    <div
      className={styles.aquariumExhibitLayer}
      aria-label={`${model.representedSpeciesCount} of ${model.requestedSpeciesCount} Elverson species represented in the Aquarium`}
    >
      {model.exhibits.map((exhibit) => (
        <section
          key={exhibit.id}
          className={`${styles.aquariumExhibit} ${exhibit.populated ? styles.aquariumExhibitPopulated : styles.aquariumExhibitEmpty}`}
          style={{
            left: `${exhibit.bounds.left}%`,
            top: `${exhibit.bounds.top}%`,
            width: `${exhibit.bounds.width}%`,
            height: `${exhibit.bounds.height}%`,
          }}
          aria-label={`${exhibit.name}, ${exhibit.representedSpeciesCount} represented species`}
        >
          <span className={styles.aquariumExhibitWater} aria-hidden="true"><i /><i /></span>
          {exhibit.populated ? exhibit.occupants.map((occupant) => {
            const creatureName = cardsById[occupant.cardId]?.name ?? occupant.id;
            return (
              <span
                key={occupant.id}
                className={`${styles.aquariumCreature} ${occupant.animation.direction < 0 ? styles.aquariumCreatureReverse : ""} ${occupant.category === "invertebrate" ? styles.aquariumCreatureInvertebrate : ""}`}
                title={`${creatureName}${occupant.quantity > 1 ? ` ×${occupant.quantity}` : ""}`}
                aria-label={`${creatureName}, ${occupant.quantity} recorded`}
                style={{
                  "--aquarium-atlas-x": `${occupant.atlasPosition.x}%`,
                  "--aquarium-atlas-y": `${occupant.atlasPosition.y}%`,
                  "--aquarium-lane": occupant.animation.lane,
                  "--aquarium-direction": occupant.animation.direction,
                  "--aquarium-delay": `${reducedMotion ? 0 : occupant.animation.delaySeconds}s`,
                  "--aquarium-duration": `${occupant.animation.durationSeconds}s`,
                  animationPlayState: reducedMotion ? "paused" : undefined,
                  backgroundImage: `url("${model.atlasPath}")`,
                }}
              />
            );
          }) : (
            <span className={styles.aquariumExhibitAwaiting}>{exhibit.emptyMessage}</span>
          )}
          <span className={styles.aquariumExhibitLabel} aria-hidden="true">{exhibit.name}</span>
        </section>
      ))}
    </div>
  );
}

function SpriteArtwork({
  character = "player",
  facing = "down",
  moving = false,
  steppingInPlace = false,
  portrait = false,
  walkSpeed = null,
}) {
  const facingName = `${facing[0].toUpperCase()}${facing.slice(1)}`;
  const artworkCharacter = spriteArtworkCharacter(character);
  const animationProfile = spriteAnimationProfile(character);
  const frameRegistration = getAdventureWalkFrameRegistration({
    profile: animationProfile,
    facing,
  });
  const walkStyle = (moving || steppingInPlace) && Number.isFinite(walkSpeed) && walkSpeed > 0
    ? {
        "--sprite-walk-cycle-duration": `${getAdventureWalkCycleDurationMs(walkSpeed)}ms`,
        "--sprite-step-frame-a-x": `${frameRegistration.frameA}%`,
        "--sprite-step-neutral-x": `${frameRegistration.neutral}%`,
        "--sprite-step-frame-b-x": `${frameRegistration.frameB}%`,
      }
    : undefined;
  return (
    <span
      className={`${styles.spriteArtwork} ${styles[`${artworkCharacter}SpriteArtwork`]} ${styles[`spriteFacing${facingName}`]} ${moving ? styles.spriteWalking : ""} ${steppingInPlace ? styles.spriteSteppingInPlace : ""} ${portrait ? styles.spritePortrait : ""}`}
      data-sprite-profile={animationProfile}
      style={walkStyle}
      aria-hidden="true"
    />
  );
}

function CharacterPortrait({ character = "player", facing = "down" }) {
  if (character === ACADEMY_MENTOR_ID) {
    return <span className={styles.mrEasterlingPortraitArtwork} aria-hidden="true" />;
  }
  return <SpriteArtwork character={character} facing={facing} portrait />;
}

function CharacterGroundShadow({ character = "player", facing = "down" }) {
  return (
    <span
      className={styles.characterShadow}
      style={{ "--character-feet-y": spriteFeetY(character, facing) }}
      aria-hidden="true"
    />
  );
}

function AdventureTrainerSprite({
  trainer,
  position,
  facing = "down",
  moving = false,
  steppingInPlace = false,
  engaged = false,
  defeated,
  status = null,
  scene,
  walkSpeed = ADVENTURE_ACTOR_DEFAULTS.speed,
}) {
  const resolvedStatus = defeated ? "Won" : status;
  const showMarker = Boolean(trainer.encounterId || status);
  return (
    <div
      className={`${styles.characterCell} ${styles.npcCell} ${engaged ? styles.npcEngaged : ""}`}
      style={actorPosition(position, scene, trainer.id)}
      aria-label={`${trainer.name}, ${trainer.title}${resolvedStatus ? ` — ${resolvedStatus}` : ""}`}
    >
      <CharacterGroundShadow character={trainer.id} facing={facing} />
      <SpriteArtwork
        character={trainer.id}
        facing={facing}
        moving={moving}
        steppingInPlace={steppingInPlace}
        walkSpeed={walkSpeed}
      />
      {showMarker ? (
        <span className={`${styles.trainerMarker} ${defeated ? styles.trainerDefeated : ""} ${status === "Locked" ? styles.trainerLocked : ""}`}>
          {defeated ? "★" : status === "Locked" ? "•" : "!"}
        </span>
      ) : null}
    </div>
  );
}

function AdventurePlayerSprite({
  position,
  facing,
  moving,
  interaction,
  scene,
  walkSpeed,
  transitionPhase = null,
  transitionVector = null,
}) {
  const transitionStyle = transitionVector ? {
    "--door-step-x": `${transitionVector.x * 28}%`,
    "--door-step-y": `${transitionVector.y * 28}%`,
    "--door-arrival-x": `${transitionVector.x * -28}%`,
    "--door-arrival-y": `${transitionVector.y * -28}%`,
  } : undefined;
  return (
    <div
      className={`${styles.characterCell} ${styles.playerCell} ${transitionPhase ? styles[`playerScene${transitionPhase === "departing" ? "Departing" : "Arriving"}`] : ""}`}
      style={{ ...actorPosition(position, scene, "player"), ...transitionStyle }}
      aria-label="You"
    >
      <CharacterGroundShadow facing={facing} />
      <SpriteArtwork facing={facing} moving={moving} walkSpeed={walkSpeed} />
      {interaction && !["enter", "exit"].includes(interaction.type) ? <span className={styles.actionCue} aria-hidden="true">A</span> : null}
    </div>
  );
}

function AdventureBoatSprite({ position, facing, heading, speed, moving, interaction, scene }) {
  const speedRatio = Math.min(1, Math.abs(speed) / (scene.movement?.speed ?? BOAT_MOTION_DEFAULTS.maxForwardSpeed));
  return (
    <div
      className={`${styles.characterCell} ${styles.playerCell} ${styles.boatCell} ${styles[`boatFacing${facing}`]} ${moving ? styles.boatMoving : ""}`}
      style={{
        ...actorPosition(position, scene, "player-boat"),
        "--boat-heading": `${heading}deg`,
        "--boat-wake-strength": speedRatio,
      }}
      aria-label="Your personal boat"
    >
      <span className={styles.boatActor} aria-hidden="true">
        <span className={styles.boatWake} />
        <span className={styles.boatHull}><i /></span>
      </span>
      {interaction ? <span className={styles.actionCue} aria-hidden="true">A</span> : null}
    </div>
  );
}

const WORLD_CUE_COPY = Object.freeze({
  board: Object.freeze({ icon: "⚓", label: "Board" }),
  dock: Object.freeze({ icon: "⚓", label: "Dock" }),
  observation: Object.freeze({ icon: "⌕", label: "Inspect" }),
  interpretation: Object.freeze({ icon: "⇄", label: "Compare" }),
  response: Object.freeze({ icon: "✓", label: "Respond" }),
});

function AdventureWorldCue({ interaction, scene, active = false, recommended = false, complete = false }) {
  const copy = WORLD_CUE_COPY[interaction.type];
  if (!copy) return null;
  const className = [
    styles.worldCue,
    styles[`worldCue${interaction.type}`],
    active ? styles.worldCueActive : "",
    recommended ? styles.worldCueRecommended : "",
    complete ? styles.worldCueComplete : "",
    interaction.at.x <= 0 ? styles.worldCueLeftEdge : "",
    interaction.at.x >= scene.width - 1 ? styles.worldCueRightEdge : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={className}
      style={{ ...actorPosition(interaction.at, scene), zIndex: 80 + Math.round(interaction.at.y) }}
      aria-hidden="true"
    >
      <span className={styles.worldCueArrow}>▼</span>
      <span className={styles.worldCueBadge}>
        <b>{complete ? "✓" : copy.icon}</b>
        {complete ? "Done" : copy.label}
      </span>
    </div>
  );
}

function worldCueIsComplete(interaction, ecosystemProgress) {
  if (interaction.type === "observation") {
    return ecosystemProgress?.observedObservationIds?.includes(interaction.observationId) === true;
  }
  if (interaction.type === "interpretation") return ecosystemProgress?.interpretation?.correct === true;
  if (interaction.type === "response") return ecosystemProgress?.response?.correct === true;
  return false;
}

function worldCueIsRecommended(interaction, ecosystemProgress, guideMet, destinationDock) {
  if (interaction.type === "dock") return destinationDock?.id === interaction.id;
  if (!["observation", "interpretation", "response"].includes(interaction.type) || !guideMet) return false;
  const nextStep = ecosystemProgress?.nextStep;
  if (!nextStep) return false;
  if (interaction.type === "observation") {
    return nextStep.kind === "observation" && nextStep.id === interaction.observationId;
  }
  return nextStep.id === interaction.type;
}

const TRENCHLIGHT_TOOL_LABELS = Object.freeze({
  "trenchlight-use-light-meter": "Use calibrated light meter",
  "trenchlight-read-pressure-sensor": "Read external pressure sensor",
  "trenchlight-record-marine-snow-camera": "Record the fixed-camera transect",
  "trenchlight-use-passive-low-light-camera": "Switch to the passive low-light camera",
});

const TRENCHLIGHT_STEP_CONTEXT = Object.freeze({
  "trenchlight-fading-light-profile": "Descent marks / surface to 1,050 m",
  "trenchlight-pressure-profile": "Matched depth marks / pressure-rated cabin",
  "trenchlight-marine-snow-camera": "Midwater transect / 700 to 1,050 m",
  "trenchlight-bioluminescence-camera": "Dark-water stop / passive observation",
  "trenchlight-sensor-recovery": "Sensor site / camera-and-sonar clearance",
});

function trenchlightPreviewClass(stepId) {
  return {
    "trenchlight-fading-light-profile": styles.subPreviewLight,
    "trenchlight-pressure-profile": styles.subPreviewPressure,
    "trenchlight-marine-snow-camera": styles.subPreviewSnow,
    "trenchlight-bioluminescence-camera": styles.subPreviewBioluminescence,
    "trenchlight-sensor-recovery": styles.subPreviewRecovery,
  }[stepId] ?? styles.subPreviewStandby;
}

function TrenchlightSubExpedition({
  scene,
  expeditionState,
  assistedMode,
  feedback,
  onToggleAssistance,
  onAction,
  onReturn,
}) {
  const currentStep = expeditionState?.currentStep ?? null;
  const leg = expeditionState?.leg ?? "survey";
  const legSteps = TRENCHLIGHT_EXPEDITION_STEPS.filter((step) => step.leg === leg);
  const completedStepIds = new Set(expeditionState?.completedStepIds ?? []);
  const completedCount = legSteps.filter((step) => completedStepIds.has(step.id)).length;
  const activeIndex = currentStep
    ? TRENCHLIGHT_EXPEDITION_STEPS.findIndex((step) => step.id === currentStep.id)
    : TRENCHLIGHT_EXPEDITION_STEPS.length;
  const requiresReturn = Boolean(expeditionState?.requiresStationReturn || !currentStep);
  const previewClass = trenchlightPreviewClass(currentStep?.id);
  const heading = requiresReturn
    ? expeditionState?.phase === "analysis-required"
      ? "Survey records ready for interpretation"
      : "The guided expedition is safely complete"
    : currentStep.title;
  const instruction = requiresReturn
    ? expeditionState?.phase === "analysis-required"
      ? "Dr. Hana is holding the sub at a safe stop. Return to Mission Control and compare all four records before planning any recovery."
      : "The trained crew has secured the deployed sensor without collecting wildlife or contacting habitat. Return to Mission Control for the expedition debrief."
    : currentStep.instruction;

  return (
    <section
      className={styles.subExpeditionPanel}
      aria-labelledby="trenchlight-expedition-title"
      data-expedition-leg={leg}
    >
      <div className={styles.subSafetyBar}>
        <span><b>Expert pilot in control</b> · You operate observation instruments only.</span>
        <button type="button" onClick={onReturn}>Return to Station</button>
      </div>

      <div
        className={`${styles.subViewport} ${previewClass}`}
        style={{ backgroundImage: scene.artPath ? `url("${scene.artPath}")` : undefined }}
        aria-hidden="true"
      >
        <span className={styles.subViewportShade} />
        <span className={styles.subDepthRail} />
        <span className={styles.subMarineSnow} />
        <span className={styles.subLivingLight}><i /><i /><i /></span>
      </div>

      <div className={styles.subConsole}>
        <header className={styles.subConsoleHeader}>
          <div>
            <span className={styles.subEyebrow}>
              {leg === "survey" ? "Survey leg" : "Recovery leg"} · Step {Math.min(activeIndex + 1, TRENCHLIGHT_EXPEDITION_STEPS.length)} of {TRENCHLIGHT_EXPEDITION_STEPS.length}
            </span>
            <h2 id="trenchlight-expedition-title">{heading}</h2>
            <p>{instruction}</p>
            <small>{TRENCHLIGHT_STEP_CONTEXT[currentStep?.id] ?? "Safe holding position / Mission Control return available"}</small>
          </div>
          <button
            type="button"
            className={`${styles.subAssistToggle} ${assistedMode ? styles.subAssistToggleOn : ""}`}
            aria-pressed={assistedMode}
            onClick={onToggleAssistance}
          >
            <span aria-hidden="true">{assistedMode ? "✓" : "?"}</span>
            Assisted Guidance {assistedMode ? "On" : "Off"}
          </button>
        </header>

        <div
          className={styles.subProgressTrack}
          role="progressbar"
          aria-label={`${leg} expedition progress`}
          aria-valuemin={0}
          aria-valuemax={legSteps.length}
          aria-valuenow={completedCount}
        >
          <span style={{ width: `${legSteps.length ? (completedCount / legSteps.length) * 100 : 0}%` }} />
        </div>

        <ol className={styles.subStepList} aria-label={`${leg} expedition sequence`}>
          {legSteps.map((step, index) => {
            const complete = completedStepIds.has(step.id);
            const current = step.id === currentStep?.id;
            return (
              <li
                key={step.id}
                className={`${complete ? styles.subStepComplete : ""} ${current ? styles.subStepCurrent : ""}`}
                aria-current={current ? "step" : undefined}
              >
                <span>{complete ? "✓" : index + 1}</span>
                <div><strong>{step.title}</strong><small>{complete ? "Recorded" : current ? "Current station" : "Follows the current station"}</small></div>
              </li>
            );
          })}
        </ol>

        <div className={styles.subActionRegion} aria-label="Expedition instrument controls">
          {leg === "survey" ? legSteps.map((step) => {
            const complete = completedStepIds.has(step.id);
            const current = step.id === currentStep?.id;
            const highlighted = assistedMode
              && expeditionState?.assistance?.highlightedActionId === step.requiredActionId;
            return (
              <button
                key={step.requiredActionId}
                type="button"
                disabled={!current}
                className={`${styles.subInstrumentButton} ${highlighted ? styles.subActionAssisted : ""}`}
                onClick={() => onAction(step.requiredActionId)}
              >
                <span>{complete ? "Recorded" : current ? "Instrument ready" : "Locked in sequence"}</span>
                <strong>{TRENCHLIGHT_TOOL_LABELS[step.requiredActionId]}</strong>
              </button>
            );
          }) : (
            <div className={styles.subRecoveryChoices}>
              <p>Choose the crew instruction that protects the habitat. An unsafe choice gives corrective feedback and can be retried.</p>
              {TRENCHLIGHT_RESPONSE_CHOICES.map((choice) => {
                const highlighted = assistedMode
                  && expeditionState?.assistance?.highlightedActionId === choice.id;
                return (
                  <button
                    key={choice.id}
                    type="button"
                    disabled={!currentStep}
                    className={`${styles.subRecoveryChoice} ${highlighted ? styles.subActionAssisted : ""}`}
                    onClick={() => onAction(choice.id)}
                  >
                    <strong>{choice.label}</strong>
                    <span>{choice.detail}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {assistedMode && currentStep ? (
          <p className={styles.subAssistanceNote}>
            <b>Guidance:</b> {expeditionState.assistance.instruction} The highlighted control still requires your confirmation.
          </p>
        ) : null}
        <div
          className={`${styles.subFeedback} ${feedback?.correct === false ? styles.subFeedbackCorrective : ""}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {feedback?.message ?? "Mission Control is monitoring the route. You can return to the station at any time with no penalty."}
        </div>
      </div>
    </section>
  );
}

function boatControlInput(keyDirections, touchDirections) {
  const directions = [...keyDirections.values(), ...touchDirections];
  return {
    throttle: Math.sign(
      Number(directions.includes("up")) - Number(directions.includes("down")),
    ),
    rudder: Math.sign(
      Number(directions.includes("right")) - Number(directions.includes("left")),
    ),
  };
}

function boatSpeedLabel(speed, maximumForwardSpeed) {
  if (Math.abs(speed) < 0.04) return "Stopped";
  const maximum = speed >= 0 ? maximumForwardSpeed : BOAT_MOTION_DEFAULTS.maxReverseSpeed;
  const percentage = Math.min(100, Math.round((Math.abs(speed) / maximum) * 100));
  return `${speed >= 0 ? "Ahead" : "Reverse"} ${percentage}%`;
}

function boatRudderLabel(rudder) {
  if (rudder < 0) return "Port / left";
  if (rudder > 0) return "Starboard / right";
  return "Centered";
}

function relativeBoatBearing(position, heading, target) {
  if (!target) return null;
  const deltaX = target.x - position.x;
  const deltaY = target.y - position.y;
  const targetHeading = Math.atan2(deltaX, deltaY) * (180 / Math.PI);
  const relative = ((((targetHeading - heading) % 360) + 540) % 360) - 180;
  const direction = Math.abs(relative) <= 18
    ? "straight ahead"
    : Math.abs(relative) >= 162
      ? "behind you"
      : relative > 0
        ? "to starboard / right"
        : "to port / left";
  return { distance: Math.hypot(deltaX, deltaY), direction };
}

function actorVisualStateChanged(previousActors, nextActors) {
  const interactionIds = new Set([
    ...Object.keys(previousActors ?? {}),
    ...Object.keys(nextActors ?? {}),
  ]);
  return [...interactionIds].some((interactionId) => {
    const previous = previousActors?.[interactionId];
    const next = nextActors?.[interactionId];
    return !previous
      || !next
      || previous.position.x !== next.position.x
      || previous.position.y !== next.position.y
      || previous.facing !== next.facing
      || previous.moving !== next.moving;
  });
}

function BoatHelmReadout({ motion, maximumForwardSpeed, destinationDock, dockReady }) {
  const bearing = relativeBoatBearing(motion.position, motion.heading, destinationDock?.at);
  const destinationLabel = destinationDock?.label ?? "destination dock";
  return (
    <div
      className={`${styles.boatHelmReadout} ${dockReady ? styles.boatHelmDockReady : ""} ${motion.collided ? styles.boatHelmCollision : ""}`}
      role="group"
      aria-label={`Boat helm. Speed ${boatSpeedLabel(motion.speed, maximumForwardSpeed)}. Rudder ${boatRudderLabel(motion.rudder)}.`}
    >
      <span><small>Speed</small><strong>{boatSpeedLabel(motion.speed, maximumForwardSpeed)}</strong></span>
      <span><small>Rudder</small><strong>{boatRudderLabel(motion.rudder)}</strong></span>
      <span className={styles.boatHelmDestination}>
        <small>{dockReady ? "Dock in reach" : "Destination"}</small>
        <strong>
          {dockReady
            ? "Ease off, then press Enter or the on-screen A button"
            : motion.collided
              ? "Hull stopped safely — reverse and steer clear"
              : bearing
                ? `${destinationLabel} · ${bearing.distance.toFixed(1)} · ${bearing.direction}`
                : "Follow the marked channel"}
        </strong>
      </span>
    </div>
  );
}

function personalizeDialogueLine(line, identity = {}) {
  return String(line ?? "")
    .replaceAll("{{playerName}}", identity.playerName ?? "Explorer")
    .replaceAll("{{bestFriendName}}", identity.bestFriendName ?? "Finn");
}

function conversationLines(conversation, trainer, defeated, identity = {}) {
  let lines = null;
  if (Array.isArray(conversation?.lines) && conversation.lines.length) {
    lines = conversation.lines;
  }
  const authored = trainer.dialogue?.[conversation?.mode];
  if (!lines && Array.isArray(authored) && authored.length) lines = authored;
  if (!lines) lines = defeated ? trainer.rematch : trainer.intro;
  return lines.map((line) => personalizeDialogueLine(line, identity));
}

function ProgressiveDialogueLine({
  message,
  speaker,
  textSpeed = "normal",
  reducedMotion = false,
  children,
}) {
  const graphemes = useMemo(() => segmentProfessorMessage(message), [message]);
  const duration = useMemo(
    () => getProfessorSpeechDuration(graphemes.length)
      * (DIALOGUE_SPEED_MULTIPLIERS[textSpeed] ?? DIALOGUE_SPEED_MULTIPLIERS.normal),
    [graphemes.length, textSpeed],
  );
  // Keep the server and first client render identical. Reduced-motion is
  // applied immediately after mount by the effect below.
  const [visibleCount, setVisibleCount] = useState(0);
  const animationRef = useRef({ frameId: null, generation: 0 });
  const isComplete = visibleCount >= graphemes.length;
  const visibleMessage = graphemes.slice(0, visibleCount).join("");

  function showFullMessage() {
    const animation = animationRef.current;
    animation.generation += 1;
    if (animation.frameId !== null) window.cancelAnimationFrame(animation.frameId);
    animation.frameId = null;
    setVisibleCount(graphemes.length);
  }

  useEffect(() => {
    const animation = animationRef.current;
    const generation = animation.generation + 1;
    animation.generation = generation;
    if (animation.frameId !== null) window.cancelAnimationFrame(animation.frameId);
    animation.frameId = null;

    const motionPreference = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
    const finish = () => {
      if (animationRef.current.generation !== generation) return;
      if (animationRef.current.frameId !== null) {
        window.cancelAnimationFrame(animationRef.current.frameId);
      }
      animationRef.current.frameId = null;
      setVisibleCount(graphemes.length);
    };
    const handleMotionPreference = (event) => {
      if (event.matches) finish();
    };

    if (!graphemes.length || reducedMotion || textSpeed === "instant" || motionPreference?.matches) {
      setVisibleCount(graphemes.length);
    } else {
      setVisibleCount(0);
      const startsAt = window.performance.now() + 120;
      const tick = (now) => {
        if (animationRef.current.generation !== generation) return;
        const nextCount = getProfessorVisibleGraphemeCount({
          graphemeCount: graphemes.length,
          elapsedMs: Math.max(0, now - startsAt),
          durationMs: duration,
        });
        setVisibleCount(nextCount);
        if (nextCount >= graphemes.length) {
          animationRef.current.frameId = null;
          return;
        }
        animationRef.current.frameId = window.requestAnimationFrame(tick);
      };
      animation.frameId = window.requestAnimationFrame(tick);
    }

    if (motionPreference?.addEventListener) {
      motionPreference.addEventListener("change", handleMotionPreference);
    } else {
      motionPreference?.addListener?.(handleMotionPreference);
    }
    return () => {
      if (animationRef.current.generation === generation) {
        animationRef.current.generation += 1;
      }
      if (animationRef.current.frameId !== null) {
        window.cancelAnimationFrame(animationRef.current.frameId);
      }
      animationRef.current.frameId = null;
      if (motionPreference?.removeEventListener) {
        motionPreference.removeEventListener("change", handleMotionPreference);
      } else {
        motionPreference?.removeListener?.(handleMotionPreference);
      }
    };
  }, [duration, graphemes.length, message, reducedMotion, textSpeed]);

  return (
    <>
      <p className={styles.dialogueTypewriter}>
        <span className={styles.dialogueMessageMeasure} aria-hidden="true">{message}</span>
        <span className={styles.dialogueMessageVisible} aria-hidden="true">
          {visibleMessage}
          {!isComplete ? <span className={styles.dialogueTypeCursor} /> : null}
        </span>
        <span
          className={styles.dialogueScreenReader}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {message}
        </span>
      </p>
      <div className={styles.dialogueActions}>
        {!isComplete ? (
          <button
            type="button"
            autoFocus
            className={styles.dialogueShowAll}
            aria-label={`Show all of ${speaker}'s message`}
            onClick={showFullMessage}
          >
            Show all
          </button>
        ) : children}
      </div>
    </>
  );
}

function Conversation({
  conversation,
  trainer,
  defeated,
  blocked = false,
  primaryLabel,
  secondaryLabel = "Not yet",
  textSpeed = "normal",
  reducedMotion = false,
  identity,
  onAdvance,
  onPrimary,
  onSecondary,
}) {
  const dialogRef = useDialogFocusTrap(!blocked);
  const lines = conversationLines(conversation, trainer, defeated, identity);
  const finalLine = conversation.index === lines.length - 1;
  const line = lines[conversation.index] ?? "";

  return (
    <div ref={dialogRef} tabIndex={-1} inert={blocked} aria-hidden={blocked || undefined} data-adventure-modal="true" className={styles.dialogueLayer} role="dialog" aria-modal="true" aria-labelledby="dialogue-speaker">
      <div className={styles.dialogueBox}>
        <div className={`${styles.portrait} ${styles[`portrait${trainer.color}`]}`}>
          <CharacterPortrait character={trainer.id} facing="down" />
        </div>
        <div className={styles.dialogueCopy}>
          <div className={styles.dialogueMeta}>
            <strong id="dialogue-speaker">{trainer.name}</strong>
            <span>{trainer.title}</span>
          </div>
          <ProgressiveDialogueLine
            key={`${trainer.id}:${conversation.mode}:${conversation.index}:${line}`}
            message={line}
            speaker={trainer.name}
            textSpeed={textSpeed}
            reducedMotion={reducedMotion}
          >
            {!finalLine ? (
              <button type="button" autoFocus onClick={onAdvance}>Next</button>
            ) : (
              <>
                <button type="button" autoFocus className={styles.challengeButton} onClick={onPrimary}>
                  {primaryLabel}
                </button>
                {onSecondary ? (
                  <button type="button" className={styles.quietButton} onClick={onSecondary}>{secondaryLabel}</button>
                ) : null}
              </>
            )}
          </ProgressiveDialogueLine>
        </div>
      </div>
    </div>
  );
}

function OpeningSetupModal({ profileId, onCancel, onBegin }) {
  const dialogRef = useDialogFocusTrap();
  const [step, setStep] = useState("world");
  const [playerName, setPlayerName] = useState("");
  const [bestFriendName, setBestFriendName] = useState("");
  const [error, setError] = useState(null);
  const steps = ["world", "player", "friend", "confirm"];
  const stepNumber = steps.indexOf(step) + 1;

  function acceptName(value, field, nextStep) {
    try {
      const normalized = normalizeAdventureCharacterName(value, field);
      if (field === "Your name") setPlayerName(normalized);
      else setBestFriendName(normalized);
      setError(null);
      setStep(nextStep);
    } catch (nameError) {
      setError(nameError?.message ?? "Choose a short first name or nickname.");
    }
  }

  function submitName(event) {
    event.preventDefault();
    if (step === "player") {
      acceptName(playerName, "Your name", "friend");
    } else if (step === "friend") {
      acceptName(bestFriendName, "Your best friend's name", "confirm");
    }
  }

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      data-adventure-modal="true"
      className={styles.openingSetupLayer}
      role="dialog"
      aria-modal="true"
      aria-labelledby="opening-setup-title"
    >
      <section className={styles.openingSetupCard}>
        <div className={styles.openingSetupProgress} aria-label={`Opening setup step ${stepNumber} of ${steps.length}`}>
          {steps.map((stepId, index) => (
            <span key={stepId} className={index < stepNumber ? styles.openingSetupProgressActive : ""} />
          ))}
        </div>

        {step === "world" ? (
          <>
            <div className={styles.openingSetupEyebrow}>Welcome to Reefbound</div>
            <div className={styles.openingSetupIntroduction}>
              <div className={styles.openingSetupPortrait}>
                <CharacterPortrait character={ACADEMY_MENTOR_ID} facing="down" />
              </div>
              <div className={styles.openingSeaPal} aria-label="A colorful SeaPal" role="img" />
            </div>
            <div className={styles.openingSetupSpeaker}>
              <strong>Mr. Easterling</strong>
              <span>Aquarium Project Lead</span>
            </div>
            <h2 id="opening-setup-title">A world alive with SeaPals</h2>
            <p>
              This world is full of wonderful sea creatures. Around here, we call them
              <strong> SeaPals</strong>.
            </p>
            <p>
              People study their habitats, learn how healthy ecosystems fit together,
              and care for the waters they all share. Today, your own story begins.
            </p>
            <div className={styles.openingSetupActions}>
              <button type="button" className={styles.secondaryButton} onClick={onCancel}>Back</button>
              <button type="button" autoFocus onClick={() => setStep("player")}>Continue</button>
            </div>
          </>
        ) : null}

        {step === "player" ? (
          <form onSubmit={submitName}>
            <div className={styles.openingSetupEyebrow}>Your adventure</div>
            <h2 id="opening-setup-title">What is your name?</h2>
            <p>Choose the first name or nickname the people of Elverson will call you.</p>
            <label className={styles.openingNameField}>
              <span>Your name</span>
              <input
                autoFocus
                type="text"
                value={playerName}
                maxLength={ADVENTURE_CHARACTER_NAME_MAX_LENGTH}
                autoComplete="off"
                spellCheck="false"
                onChange={(event) => {
                  setPlayerName(event.target.value);
                  setError(null);
                }}
              />
              <small>Use a first name or nickname only—never a last name or contact information.</small>
            </label>
            {error ? <p className={styles.openingNameError} role="alert">{error}</p> : null}
            <div className={styles.openingSetupActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setStep("world")}>Back</button>
              <button type="submit">That&apos;s my name</button>
            </div>
          </form>
        ) : null}

        {step === "friend" ? (
          <form onSubmit={submitName}>
            <div className={styles.openingSetupEyebrow}>Your friendly rival</div>
            <h2 id="opening-setup-title">What is your best friend&apos;s name?</h2>
            <p>Your best friend will share the first steps of this adventure—and challenge you along the way.</p>
            <label className={styles.openingNameField}>
              <span>Best friend&apos;s name</span>
              <input
                autoFocus
                type="text"
                value={bestFriendName}
                maxLength={ADVENTURE_CHARACTER_NAME_MAX_LENGTH}
                autoComplete="off"
                spellCheck="false"
                onChange={(event) => {
                  setBestFriendName(event.target.value);
                  setError(null);
                }}
              />
              <small>A short first name or nickname works best.</small>
            </label>
            {error ? <p className={styles.openingNameError} role="alert">{error}</p> : null}
            <div className={styles.openingSetupActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setStep("player")}>Back</button>
              <button type="submit">That&apos;s their name</button>
            </div>
          </form>
        ) : null}

        {step === "confirm" ? (
          <>
            <div className={styles.openingSetupEyebrow}>Save {ADVENTURE_PROFILE_IDS.indexOf(profileId) + 1}</div>
            <h2 id="opening-setup-title">Ready for your birthday adventure?</h2>
            <div className={styles.openingIdentitySummary}>
              <span><small>You</small><strong>{playerName}</strong></span>
              <span><small>Best friend</small><strong>{bestFriendName}</strong></span>
            </div>
            <p>These names will be used in dialogue and saved with this Reefbound adventure.</p>
            <div className={styles.openingSetupActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => setStep("friend")}>Change names</button>
              <button
                type="button"
                autoFocus
                onClick={() => onBegin({ playerName, bestFriendName })}
              >
                Begin the adventure
              </button>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

function DirectionButton({ direction, ariaLabel = `Walk ${direction}`, onStart, onStop }) {
  const suppressClickRef = useRef(false);
  const clickStopTimerRef = useRef(null);

  useEffect(() => () => {
    if (clickStopTimerRef.current) window.clearTimeout(clickStopTimerRef.current);
  }, []);

  function releaseClickSuppression() {
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  function cancelClickStopTimer() {
    if (!clickStopTimerRef.current) return;
    window.clearTimeout(clickStopTimerRef.current);
    clickStopTimerRef.current = null;
  }

  function startPointer(event) {
    event.preventDefault();
    cancelClickStopTimer();
    suppressClickRef.current = true;
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      // Pointer capture is an enhancement; movement still stops on pointer-up.
    }
    onStart(direction);
  }

  function stopPointer(event) {
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onStop(direction);
    releaseClickSuppression();
  }

  function nudgeFromClick() {
    if (suppressClickRef.current) return;
    onStart(direction);
    cancelClickStopTimer();
    clickStopTimerRef.current = window.setTimeout(() => {
      clickStopTimerRef.current = null;
      onStop(direction);
    }, 140);
  }

  return (
    <button
      type="button"
      className={`${styles.directionButton} ${styles[`direction${direction}`]}`}
      aria-label={ariaLabel}
      title={ariaLabel}
      onPointerDown={startPointer}
      onPointerUp={stopPointer}
      onPointerCancel={stopPointer}
      onContextMenu={(event) => event.preventDefault()}
      onLostPointerCapture={(event) => {
        event.preventDefault();
        onStop(direction);
        releaseClickSuppression();
      }}
      onClick={nudgeFromClick}
      onBlur={() => {
        onStop(direction);
        releaseClickSuppression();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          cancelClickStopTimer();
          suppressClickRef.current = true;
          onStart(direction);
        }
      }}
      onKeyUp={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          onStop(direction);
          releaseClickSuppression();
        }
      }}
    />
  );
}

function formatSavedAt(savedAt) {
  if (!savedAt) return "Not saved yet";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(savedAt));
  } catch {
    return "Saved adventure";
  }
}

function formatPlaytime(totalSeconds) {
  const minutes = Math.max(0, Math.floor(Number(totalSeconds) / 60));
  if (minutes < 60) return `${minutes}m played`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m played`;
}

function useDialogFocusTrap(active = true) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!active) return undefined;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const previousFocus = document.activeElement;
    const focusableSelector = "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";
    const initialFocus = dialog.querySelector(focusableSelector) ?? dialog;
    initialFocus.focus({ preventScroll: true });

    function keepFocusInside(event) {
      if (event.key !== "Tab") return;
      const modalStack = [...document.querySelectorAll("[data-adventure-modal='true']")];
      if (modalStack.at(-1) !== dialog) return;
      const focusable = [...dialog.querySelectorAll(focusableSelector)]
        .filter((element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true");
      if (!focusable.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    dialog.addEventListener("keydown", keepFocusInside);
    return () => {
      dialog.removeEventListener("keydown", keepFocusInside);
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, [active]);

  return dialogRef;
}

function TitleScreen({
  profiles,
  notice,
  account,
  blocked = false,
  onContinue,
  onNewGame,
  onRetry,
  onSignOut,
}) {
  const dialogRef = useDialogFocusTrap(!blocked);
  return (
    <div ref={dialogRef} tabIndex={-1} inert={blocked} aria-hidden={blocked || undefined} data-adventure-modal="true" className={`${styles.introLayer} ${styles.titleLayer}`} role="dialog" aria-modal="true" aria-labelledby="adventure-title">
      <div className={`${styles.introCard} ${styles.titleCard}`}>
        <div className={styles.introEyebrow}>A SeaPals Story</div>
        <h1 id="adventure-title">REEFBOUND</h1>
        <div className={styles.introDivider}><span>◆</span></div>
        <p>
          Begin in coastal Elverson, where Mr. Easterling is creating a new aquarium exhibit.
          Meet your neighbors, learn about local waters, and help bring the first tanks to life.
        </p>
        <div className={styles.accountBar}>
          <span>
            <small>Family account</small>
            <strong>{account.email}</strong>
          </span>
          <button type="button" onClick={onSignOut}>Sign out</button>
          <p>
            SeaPals keeps each account&apos;s save slots separate in this
            browser profile.
          </p>
        </div>
        {notice ? (
          <div className={`${styles.saveNotice} ${notice.kind === "error" ? styles.saveNoticeError : styles.saveNoticeInfo}`} role={notice.kind === "error" ? "alert" : "status"}>
            {notice.message}
          </div>
        ) : null}
        <div className={styles.profileGrid} aria-label="Adventure save profiles">
          {profiles.map((profile) => (
            <section key={profile.profileId} className={`${styles.profileCard} ${profile.canContinue ? styles.profileCardUsed : ""}`}>
              <div className={styles.profileSlot}>Save {profile.slot}</div>
              {profile.canContinue ? (
                <>
                  <strong>{profile.playerName ?? "Explorer"}</strong>
                  <span>Elverson · {profile.completedEncounterCount} encounters complete</span>
                  {profile.starterDeckId ? <em>{getAdventureStarterDeck(profile.starterDeckId)?.name ?? "SeaPals"} starter</em> : null}
                  <small>{formatPlaytime(profile.playtimeSeconds)} · {formatSavedAt(profile.savedAt)}</small>
                  {profile.status === "recovered" ? <em>Backup recovery available</em> : null}
                  <div className={styles.profileActions}>
                    <button type="button" onClick={() => onContinue(profile.profileId)}>Continue</button>
                    <button type="button" className={styles.secondaryButton} onClick={() => onNewGame(profile.profileId, true)}>Start over</button>
                  </div>
                </>
              ) : profile.status === "unavailable" ? (
                <>
                  <strong>Storage unavailable</strong>
                  <span>Your browser did not allow this slot to be read.</span>
                  <div className={styles.profileActions}>
                    <button type="button" onClick={onRetry}>Retry</button>
                    <button type="button" className={styles.secondaryButton} onClick={() => onNewGame(profile.profileId, false)}>Play without saving</button>
                  </div>
                </>
              ) : (
                <>
                  <strong>{profile.occupied ? "Save needs recovery" : "Empty save"}</strong>
                  <span>{profile.occupied ? "No valid copy could be loaded." : "Begin at home on your tenth birthday."}</span>
                  <button type="button" onClick={() => onNewGame(profile.profileId, profile.occupied)}>
                    {profile.occupied ? "Recover with new game" : "New Game"}
                  </button>
                </>
              )}
            </section>
          ))}
        </div>
        <div className={styles.introControls}>
          <span><kbd>WASD</kbd> or arrows to walk</span>
          <span><kbd>ENTER</kbd> to interact</span>
          <span><kbd>ESC</kbd> to pause</span>
        </div>
        <a className={styles.titleExitLink} href="/">Return to SeaPals</a>
      </div>
    </div>
  );
}

function LegacySavePrompt({
  accountEmail,
  importableProfileCount,
  onImport,
  onStartFresh,
}) {
  const dialogRef = useDialogFocusTrap();
  const saveLabel =
    importableProfileCount === 1
      ? "one earlier Reefbound save"
      : `${importableProfileCount} earlier Reefbound saves`;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      data-adventure-modal="true"
      className={styles.confirmLayer}
      role="dialog"
      aria-modal="true"
      aria-labelledby="legacy-save-title"
      aria-describedby="legacy-save-description"
    >
      <div className={styles.confirmCard}>
        <div className={styles.introEyebrow}>Shared-device privacy</div>
        <h2 id="legacy-save-title">Use your earlier voyages?</h2>
        <p id="legacy-save-description">
          We found {saveLabel} from before family accounts. Choose whether to
          copy them into {accountEmail}. The original device copies will be
          preserved, and SeaPals will not offer them to another account in this
          browser profile.
        </p>
        <div className={styles.confirmActions}>
          <button type="button" onClick={onImport}>Use these saves</button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onStartFresh}
          >
            Start fresh
          </button>
        </div>
      </div>
    </div>
  );
}

function NewsletterOptInModal({
  error = null,
  submitting = false,
  onDismiss,
  onSubmit,
}) {
  const dialogRef = useDialogFocusTrap();
  const [adultAccountOwner, setAdultAccountOwner] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const canSubmit =
    adultAccountOwner && marketingConsent && !submitting;

  function submitConsent(event) {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit();
  }

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      data-adventure-modal="true"
      className={styles.confirmLayer}
      role="dialog"
      aria-modal="true"
      aria-labelledby="newsletter-opt-in-title"
      aria-describedby="newsletter-opt-in-description newsletter-opt-in-disclosure"
    >
      <section className={`${styles.confirmCard} ${styles.newsletterOptInCard}`}>
        <div className={styles.introEyebrow}>For a parent or grown-up</div>
        <h2 id="newsletter-opt-in-title">Keep up with SeaPals?</h2>
        <p id="newsletter-opt-in-description">
          The adult who owns this family account can choose to receive
          occasional SeaPals news and learning resources. This is optional:
          playing Reefbound does not subscribe anyone, and choosing Not now
          changes nothing about the game.
        </p>
        <form onSubmit={submitConsent}>
          <fieldset className={styles.newsletterConsentGroup}>
            <legend>Confirm both statements to request updates</legend>
            <label>
              <input
                type="checkbox"
                checked={adultAccountOwner}
                disabled={submitting}
                onChange={(event) => setAdultAccountOwner(event.target.checked)}
              />
              <span>
                I am the adult account owner, parent, or legal guardian
                responsible for this family account.
              </span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={marketingConsent}
                disabled={submitting}
                onChange={(event) => setMarketingConsent(event.target.checked)}
              />
              <span>
                I want occasional SeaPals news and learning resources sent to
                the email on this family account.
              </span>
            </label>
          </fieldset>
          <p
            id="newsletter-opt-in-disclosure"
            className={styles.newsletterOptInDisclosure}
          >
            Kit will send a confirmation email. Updates begin only after the
            adult account owner confirms that email. Unsubscribe anytime.
          </p>
          {error ? (
            <p className={styles.newsletterOptInError} role="alert">
              {error}
            </p>
          ) : null}
          <div className={`${styles.confirmActions} ${styles.newsletterOptInActions}`}>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={submitting}
              onClick={onDismiss}
            >
              Not now
            </button>
            <button type="submit" disabled={!canSubmit}>
              {submitting ? "Requesting updates…" : "Request SeaPals updates"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function PauseMenu({
  profileId,
  notice,
  blocked = false,
  fieldNoteCount = 0,
  activeDeckName = "No active deck",
  unopenedPackCount = 0,
  onResume,
  onSave,
  onDecks,
  onInventory,
  onFieldNote,
  onSettings,
  onReturnTitle,
  onRestart,
}) {
  const dialogRef = useDialogFocusTrap(!blocked);
  return (
    <div ref={dialogRef} tabIndex={-1} inert={blocked} aria-hidden={blocked || undefined} data-adventure-modal="true" className={styles.pauseLayer} role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <div className={styles.pauseCard}>
        <div className={styles.introEyebrow}>Elverson save {ADVENTURE_PROFILE_IDS.indexOf(profileId) + 1}</div>
        <h2 id="pause-title">Adventure paused</h2>
        <p>Your current safe position and quest progress can be saved to this device.</p>
        <div className={styles.pauseLoadout} aria-label="Current card loadout">
          <span><small>Active deck</small><strong>{activeDeckName}</strong></span>
          <span><small>Booster packs</small><strong>{unopenedPackCount} unopened</strong></span>
        </div>
        {notice ? (
          <div className={`${styles.saveNotice} ${notice.kind === "error" ? styles.saveNoticeError : styles.saveNoticeInfo}`} role={notice.kind === "error" ? "alert" : "status"}>
            {notice.message}
          </div>
        ) : null}
        <div className={styles.pauseActions}>
          <button type="button" autoFocus onClick={onResume}>Resume</button>
          <button type="button" onClick={onSave}>Save game</button>
          <button type="button" onClick={onDecks}>Open Deck Workshop</button>
          <button type="button" onClick={onInventory}>Open Inventory</button>
          <button type="button" onClick={onSettings}>Settings</button>
          {fieldNoteCount > 0 ? (
            <button type="button" onClick={onFieldNote}>Open Field Notes ({fieldNoteCount})</button>
          ) : null}
          <button type="button" className={styles.secondaryButton} onClick={onReturnTitle}>Save and return to title</button>
          <button type="button" className={styles.dangerButton} onClick={onRestart}>Restart this adventure</button>
        </div>
        <small>Tutorial checkpoints save as you complete them. Mid-duel board state is not saved.</small>
      </div>
    </div>
  );
}

function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }) {
  const dialogRef = useDialogFocusTrap();
  return (
    <div ref={dialogRef} tabIndex={-1} data-adventure-modal="true" className={styles.confirmLayer} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description">
      <div className={styles.confirmCard}>
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-description">{message}</p>
        <div className={styles.confirmActions}>
          <button type="button" className={styles.dangerButton} onClick={onConfirm}>{confirmLabel}</button>
          <button type="button" autoFocus className={styles.secondaryButton} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function StarterSelectionModal({ starters, selectedId, blocked = false, onSelect, onConfirm, onClose }) {
  const dialogRef = useDialogFocusTrap(!blocked);
  const selectedStarter = starters.find((starter) => starter.id === selectedId) ?? null;
  return (
    <div ref={dialogRef} tabIndex={-1} inert={blocked} aria-hidden={blocked || undefined} data-adventure-modal="true" className={styles.starterLayer} role="dialog" aria-modal="true" aria-labelledby="starter-title">
      <div className={styles.starterCard}>
        <div className={styles.introEyebrow}>Mr. Easterling&apos;s three starter reefs</div>
        <h2 id="starter-title">Choose your starter deck</h2>
        <p>Each is a complete 60-card deck for the aquarium project. Compare how they play, then choose once for this save.</p>
        <div className={styles.starterGrid}>
          {starters.map((starter) => (
            <button
              key={starter.id}
              type="button"
              className={`${styles.starterOption} ${styles[`starter${starter.color}`]} ${selectedId === starter.id ? styles.starterSelected : ""}`}
              aria-pressed={selectedId === starter.id}
              onClick={() => onSelect(starter.id)}
            >
              <span className={styles.starterHabitat}>{starter.habitat}</span>
              <strong>{starter.name}</strong>
              <em>{starter.tagline}</em>
              <span className={styles.starterSummary}>{starter.summary}</span>
              <span className={styles.starterPlayStyle}>{starter.playStyle}</span>
              <span className={styles.metricList}>
                {STARTER_METRICS.map(([metricId, label]) => (
                  <span key={metricId} className={styles.metricRow}>
                    <span>{label}</span>
                    <span aria-label={`${starter.metrics[metricId]} out of 5`}>
                      {Array.from({ length: 5 }, (_, index) => (
                        <i key={index} className={index < starter.metrics[metricId] ? styles.metricFilled : ""} />
                      ))}
                    </span>
                  </span>
                ))}
              </span>
              <span className={styles.starterStrengths}>{starter.strengths.join(" / ")}</span>
              <small><b>Mr. Easterling&apos;s tip:</b> {starter.watchFor}</small>
            </button>
          ))}
        </div>
        <div className={styles.starterActions}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>Choose later</button>
          <button type="button" disabled={!selectedStarter} onClick={() => onConfirm(selectedStarter.id)}>
            {selectedStarter ? `Choose ${selectedStarter.name}` : "Select a deck"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldNoteModal({
  note,
  notes = [],
  blocked = false,
  reviewRequired = false,
  onSelect,
  onAcknowledge,
  onDismiss,
}) {
  const dialogRef = useDialogFocusTrap(!blocked);
  const checklist = note.checklist ?? note.safetyChecklist ?? [];
  const checklistTitle = note.checklistTitle ?? "Boat safety check";
  const noteEyebrow = getAdventureFieldNoteEyebrow(note.id);
  const journalNotes = reviewRequired ? [note] : notes;
  return (
    <div ref={dialogRef} tabIndex={-1} inert={blocked} aria-hidden={blocked || undefined} data-adventure-modal="true" className={styles.fieldNoteLayer} role="dialog" aria-modal="true" aria-labelledby="field-note-title">
      <article className={`${styles.fieldNoteCard} ${journalNotes.length > 1 ? styles.fieldNoteJournalCard : ""}`}>
        <header>
          <div>
            <div className={styles.fieldNoteEyebrow}>{noteEyebrow}</div>
            <h2 id="field-note-title" aria-live="polite" aria-atomic="true">{note.title}</h2>
          </div>
          <button type="button" className={styles.noteCloseIcon} aria-label="Close Field Note" onClick={onDismiss}>×</button>
        </header>
        {journalNotes.length > 1 ? (
          <nav className={styles.fieldNoteJournal} aria-label="Unlocked Field Notes">
            <div className={styles.fieldNoteJournalHeading}>
              <strong>Field Note library</strong>
              <span>{journalNotes.length} unlocked</span>
            </div>
            <ul>
              {journalNotes.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    aria-current={entry.id === note.id ? "page" : undefined}
                    onClick={() => onSelect(entry.id)}
                  >
                    <small>{getAdventureFieldNoteEyebrow(entry.id)}</small>
                    <strong>{entry.title}</strong>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
        <p className={styles.fieldNoteSummary}>{note.summary}</p>
        <section>
          <h3>What we observed</h3>
          <ul>{note.observations.map((observation) => <li key={observation}>{observation}</li>)}</ul>
        </section>
        <section className={styles.safetyPanel}>
          <h3>{checklistTitle}</h3>
          <ul>{checklist.map((item) => <li key={item}>{item}</li>)}</ul>
        </section>
        <section>
          <h3>Ocean words</h3>
          <dl>
            {note.glossary.map((entry) => (
              <div key={entry.term}><dt>{entry.term}</dt><dd>{entry.definition}</dd></div>
            ))}
          </dl>
        </section>
        <button type="button" onClick={reviewRequired ? onAcknowledge : onDismiss}>
          {reviewRequired ? "I reviewed the safety check" : "Close Field Note"}
        </button>
      </article>
    </div>
  );
}

function inventoryItemLabel(identifier) {
  return String(identifier)
    .split("-")
    .filter(Boolean)
    .map((word) => `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`)
    .join(" ");
}

function InventoryItemList({ items, emptyMessage }) {
  const entries = Object.entries(items).sort(([left], [right]) => left.localeCompare(right));
  if (!entries.length) return <p className={styles.inventoryEmpty}>{emptyMessage}</p>;
  return (
    <ul className={styles.inventoryItemList}>
      {entries.map(([itemId, quantity]) => (
        <li key={itemId}>
          <span>
            <strong>{getElversonHandNetItemDefinition(itemId)?.name ?? inventoryItemLabel(itemId)}</strong>
            {itemId === ELVERSON_HAND_NET_ITEM_ID ? (
              <small>Permanent gear · cannot be discarded</small>
            ) : null}
          </span>
          <b aria-label={`${quantity} owned`}>x{quantity}</b>
        </li>
      ))}
    </ul>
  );
}

function InventoryModal({
  inventory,
  fishingProgress,
  reveal = null,
  notice = null,
  blocked = false,
  onOpenPack,
  onBuildDeck,
  onClose,
}) {
  const dialogRef = useDialogFocusTrap(!blocked);
  const ownedCards = Object.entries(inventory.cards)
    .map(([cardId, quantity]) => ({ cardId, quantity, card: cardsById[cardId] ?? null }))
    .sort((left, right) => (
      (left.card?.name ?? left.cardId).localeCompare(right.card?.name ?? right.cardId)
    ));
  const totalCards = ownedCards.reduce((total, entry) => total + entry.quantity, 0);
  const unopenedPacks = Object.entries(inventory.unopenedPacks)
    .map(([packId, quantity]) => ({ packId, quantity, pool: PACK_POOLS_BY_ID[packId] ?? null }))
    .sort((left, right) => (
      (left.pool?.name ?? left.packId).localeCompare(right.pool?.name ?? right.packId)
    ));
  const nonFishingStoryItems = Object.fromEntries(
    Object.entries(inventory.storyItems).filter(([itemId]) => !getElversonHandNetItemDefinition(itemId)),
  );
  const aquariumLog = fishingProgress?.creatures ?? [];

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      inert={blocked}
      aria-hidden={blocked || undefined}
      data-adventure-modal="true"
      className={styles.inventoryLayer}
      role="dialog"
      aria-modal="true"
      aria-labelledby="inventory-title"
    >
      <section className={styles.inventoryCard}>
        <header className={styles.inventoryHeader}>
          <div>
            <div className={styles.introEyebrow}>Elverson inventory</div>
            <h2 id="inventory-title">Your SeaPals collection</h2>
            <p>Cards stay in your collection. Booster packs are earned through adventure challenges and opened here.</p>
          </div>
          <button type="button" className={styles.inventoryClose} aria-label="Close inventory" onClick={onClose}>
            Close
          </button>
        </header>

        {notice ? (
          <div
            className={`${styles.saveNotice} ${notice.kind === "error" ? styles.saveNoticeError : styles.saveNoticeInfo}`}
            role={notice.kind === "error" ? "alert" : "status"}
          >
            {notice.message}
          </div>
        ) : null}

        {reveal ? (
          <section className={styles.packReveal} aria-labelledby="pack-reveal-title" aria-live="polite">
            <div>
              <span>Pack opened</span>
              <h3 id="pack-reveal-title">{PACK_POOLS_BY_ID[reveal.packId]?.name ?? "Discovery Pack"}</h3>
              <p>These four cards are now part of your permanent collection.</p>
            </div>
            <div className={styles.packRevealGrid}>
              {reveal.cards.map((cardId) => {
                const card = cardsById[cardId];
                const isNew = reveal.guaranteedNewCardId === cardId;
                return (
                  <article key={cardId} className={styles.revealedCard}>
                    {card?.image ? (
                      <Image src={card.image} alt="" width={90} height={126} />
                    ) : <span className={styles.inventoryCardPlaceholder} aria-hidden="true">?</span>}
                    <strong>{card?.name ?? inventoryItemLabel(cardId)}</strong>
                    <small>{isNew ? "New discovery" : "Added to collection"}</small>
                  </article>
                );
              })}
            </div>
            <button type="button" className={styles.packBuildButton} onClick={onBuildDeck}>
              Build with these cards
            </button>
          </section>
        ) : null}

        <div className={styles.inventorySectionGrid}>
          <section className={`${styles.inventorySection} ${styles.inventoryCollectionSection}`} aria-labelledby="collection-heading">
            <div className={styles.inventorySectionHeading}>
              <div>
                <span>01</span>
                <h3 id="collection-heading">Card Collection</h3>
              </div>
              <b>{totalCards} cards / {ownedCards.length} kinds</b>
            </div>
            {ownedCards.length ? (
              <div className={styles.inventoryCardGrid}>
                {ownedCards.map(({ cardId, quantity, card }) => (
                  <article key={cardId} className={styles.inventoryOwnedCard}>
                    {card?.image ? (
                      <Image src={card.image} alt="" width={64} height={90} />
                    ) : <span className={styles.inventoryCardPlaceholder} aria-hidden="true">?</span>}
                    <span>
                      <strong>{card?.name ?? inventoryItemLabel(cardId)}</strong>
                      <small>{[card?.category, card?.kind].filter(Boolean).join(" / ") || "SeaPals card"}</small>
                    </span>
                    <b aria-label={`${quantity} owned`}>x{quantity}</b>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.inventoryEmpty}>Choose a starter deck to receive your first 60 cards.</p>
            )}
          </section>

          <section className={styles.inventorySection} aria-labelledby="packs-heading">
            <div className={styles.inventorySectionHeading}>
              <div><span>02</span><h3 id="packs-heading">Booster Packs</h3></div>
              <b>{unopenedPacks.reduce((total, entry) => total + entry.quantity, 0)} unopened</b>
            </div>
            {unopenedPacks.length ? unopenedPacks.map(({ packId, quantity, pool }) => (
              <article key={packId} className={styles.inventoryPack}>
                <span className={styles.packIcon} aria-hidden="true">SP</span>
                <div>
                  <strong>{pool?.name ?? inventoryItemLabel(packId)}</strong>
                  <small>{pool?.theme ?? "Adventure discovery cards"} / {pool?.cardsPerPack ?? 4} cards</small>
                </div>
                <b>x{quantity}</b>
                <button
                  type="button"
                  disabled={pool?.status !== "playable"}
                  onClick={() => onOpenPack(packId)}
                >
                  {pool?.status === "playable" ? "Open pack" : "Coming later"}
                </button>
              </article>
            )) : (
              <p className={styles.inventoryEmpty}>Help an Elverson neighbor to earn your first local discovery pack.</p>
            )}
          </section>

          <section className={`${styles.inventorySection} ${styles.fishingInventorySection}`} aria-labelledby="aquarium-log-heading">
            <div className={styles.inventorySectionHeading}>
              <div><span>03</span><h3 id="aquarium-log-heading">Aquarium Reef Log</h3></div>
              <b>{fishingProgress?.aquariumSpeciesCount ?? 0} / {ELVERSON_REEF_CATCHES.length} delivered</b>
            </div>
            <div className={styles.fishingInventoryGrid}>
              {aquariumLog.map((creature) => {
                const card = cardsById[creature.cardId];
                return (
                  <article
                    key={creature.id}
                    className={`${styles.fishingInventoryCreature} ${creature.discovered ? styles.fishingInventoryCreatureFound : ""}`}
                  >
                    <div>
                      {creature.discovered && card?.image ? (
                        <Image src={card.image} alt="" width={58} height={82} />
                      ) : <span aria-hidden="true">?</span>}
                    </div>
                    <span>
                      <strong>{creature.discovered ? card?.name ?? inventoryItemLabel(creature.id) : "Undiscovered"}</strong>
                      <small>{creature.rarityLabel} · {creature.category}</small>
                      <em>{[
                        creature.aquarium > 0 ? `${creature.aquarium} in aquarium` : null,
                        creature.held > 0 ? `${creature.held} ready to deliver` : null,
                        creature.matchingCardsAwarded > 0
                          ? `${creature.matchingCardsAwarded} matching ${creature.matchingCardsAwarded === 1 ? "card" : "cards"} earned`
                          : null,
                      ].filter(Boolean).join(" · ") || "Not yet caught"}</em>
                    </span>
                  </article>
                );
              })}
            </div>
          </section>

          <section className={styles.inventorySection} aria-labelledby="story-items-heading">
            <div className={styles.inventorySectionHeading}>
              <div><span>04</span><h3 id="story-items-heading">Story Items</h3></div>
            </div>
            <InventoryItemList items={nonFishingStoryItems} emptyMessage="Adventure keepsakes will appear here." />
          </section>

          <section className={styles.inventorySection} aria-labelledby="boat-items-heading">
            <div className={styles.inventorySectionHeading}>
              <div><span>05</span><h3 id="boat-items-heading">Project Gear</h3></div>
            </div>
            <InventoryItemList items={inventory.boatItems} emptyMessage="Collection tools and aquarium equipment will appear as the exhibit grows." />
          </section>
        </div>
      </section>
    </div>
  );
}

function ElversonAquariumMilestone({ blocked = false, onContinue, onReset }) {
  const dialogRef = useDialogFocusTrap(!blocked);
  return (
    <div ref={dialogRef} tabIndex={-1} inert={blocked} aria-hidden={blocked || undefined} data-adventure-modal="true" className={styles.introLayer} role="dialog" aria-modal="true" aria-labelledby="completion-title">
      <div className={`${styles.introCard} ${styles.completionCard}`}>
        <div className={styles.crestPair}><span>★</span><span>★</span></div>
        <div className={styles.introEyebrow}>Elverson aquarium project</div>
        <h2 id="completion-title">THE FIRST TANKS ARE READY</h2>
        <p>
          Your first lessons and neighborhood challenges have given Mr. Easterling a strong
          foundation for Elverson&apos;s new exhibit. Keep exploring town and meeting the people who will help it grow.
        </p>
        <div className={styles.completionActions}>
          <button type="button" autoFocus onClick={onContinue}>Keep exploring</button>
          <button type="button" className={styles.quietButton} onClick={onReset}>Start over</button>
        </div>
      </div>
    </div>
  );
}

function tournamentRoundStatus(progress, roundId, save) {
  const postgameUnlocked = progress.save.progression.quests[CHAMPIONS_WAKE_QUEST_ID]
    ?.flags?.[CHAMPIONSHIP_ENDING_FLAGS.postgame] === true;
  if (progress.completedRoundIds.includes(roundId)) {
    return progress.complete
      ? postgameUnlocked ? "Won · Practice open" : "Won · Ceremony next"
      : "Won";
  }
  if (progress.activeRoundId === roundId) {
    const recoveredSave = progress.save ?? save;
    const result = recoveredSave.progression.encounterResults[roundId];
    const baseline = recoveredSave.progression.tournament.roundAttemptBaselines[roundId] ?? 0;
    const attemptedInThisBracket = (result?.attempts ?? 0) > baseline;
    return attemptedInThisBracket && result?.latest?.outcome !== "victory"
      ? "Retry available"
      : "Up next";
  }
  return progress.complete ? "Practice open" : "Locked";
}

function TournamentBracketPanel({ progress, save, compact = false }) {
  const lockedDeck = progress.lockedDeckSnapshot;
  return (
    <section
      className={`${styles.tournamentBracket} ${compact ? styles.tournamentBracketCompact : ""}`}
      aria-labelledby={compact ? "mobile-tournament-bracket-title" : "tournament-bracket-title"}
    >
      <header>
        <span>30 VP · three rounds</span>
        <h2 id={compact ? "mobile-tournament-bracket-title" : "tournament-bracket-title"}>
          Championship bracket
        </h2>
        <p>
          {lockedDeck
            ? <>Registered deck: <strong>{lockedDeck.name}</strong></>
            : progress.complete
              ? "Bracket completion verified; the archived deck list is unavailable."
              : "Register one legal 60-card deck in the Registration Hall."}
        </p>
      </header>
      <ol>
        {CHAMPIONS_WAKE_ROUNDS.map((round, index) => {
          const status = tournamentRoundStatus(progress, round.id, save);
          const active = progress.activeRoundId === round.id;
          return (
            <li
              key={round.id}
              className={`${status.startsWith("Won") ? styles.tournamentRoundWon : ""} ${active ? styles.tournamentRoundActive : ""}`}
              aria-current={active ? "step" : undefined}
            >
              <span aria-hidden="true">{status.startsWith("Won") ? "✓" : index + 1}</span>
              <div>
                <strong>{round.label}</strong>
                <small>{round.opponent} · 30 VP</small>
              </div>
              <b>{status}</b>
            </li>
          );
        })}
      </ol>
      {lockedDeck ? (
        <small className={styles.tournamentDeckFingerprint}>
          Deck record {lockedDeck.fingerprint.slice(0, 10)} · fixed until this bracket ends
        </small>
      ) : null}
    </section>
  );
}

function TournamentRegistrationModal({
  availability,
  progress,
  activeDeckName,
  deckReadiness,
  notice,
  blocked = false,
  onRegister,
  onSaveRegistration,
  onDecks,
  onClose,
}) {
  const dialogRef = useDialogFocusTrap(!blocked);
  const tideMarks = new Set(availability.save.progression.tideMarkIds);
  const fieldNotes = new Set(availability.save.fieldNotes.entryIds);
  const registered = progress.status === "active";
  const complete = progress.complete;
  const canRegister = availability.available && deckReadiness.ready;

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      inert={blocked}
      aria-hidden={blocked || undefined}
      data-adventure-modal="true"
      className={styles.tournamentModalLayer}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tournament-registration-title"
    >
      <section className={styles.tournamentRegistrationCard}>
        <header className={styles.tournamentRegistrationHeader}>
          <div>
            <span>Director Vela · Registration Hall</span>
            <h2 id="tournament-registration-title">Register for the SeaPals Tournament</h2>
            <p>Three ordered rounds. Every match is a complete 30 VP game.</p>
          </div>
          <button type="button" onClick={onClose}>Close</button>
        </header>

        {notice ? (
          <div className={`${styles.tournamentNotice} ${notice.kind === "error" ? styles.tournamentNoticeError : ""}`} role={notice.kind === "error" ? "alert" : "status"}>
            {notice.message}
          </div>
        ) : null}

        <div className={styles.tournamentRegistrationGrid}>
          <section aria-labelledby="tournament-voyage-record-title">
            <h3 id="tournament-voyage-record-title">Voyage record</h3>
            <p>All five communities must be represented by both a Tide Mark and its ecosystem Field Note.</p>
            <ul className={styles.tournamentRequirementList}>
              {CHAMPIONS_WAKE_REQUIRED_TIDE_MARK_IDS.map((id) => (
                <li key={id} className={tideMarks.has(id) ? styles.tournamentRequirementMet : ""}>
                  <span aria-hidden="true">{tideMarks.has(id) ? "✓" : "○"}</span>{TIDE_MARK_LABELS[id]}
                </li>
              ))}
            </ul>
            <ul className={styles.tournamentRequirementList}>
              {CHAMPIONS_WAKE_REQUIRED_FIELD_NOTE_IDS.map((id) => (
                <li key={id} className={fieldNotes.has(id) ? styles.tournamentRequirementMet : ""}>
                  <span aria-hidden="true">{fieldNotes.has(id) ? "✓" : "○"}</span>{FIELD_NOTE_LABELS[id]}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.tournamentDeckRegistration} aria-labelledby="tournament-deck-title">
            <span>Active deck</span>
            <h3 id="tournament-deck-title">
              {progress.lockedDeckSnapshot?.name
                ?? (complete ? "Championship deck archive unavailable" : activeDeckName)}
            </h3>
            <p className={progress.lockedDeckSnapshot || complete || deckReadiness.ready ? styles.tournamentDeckReady : styles.tournamentDeckInvalid}>
              {progress.lockedDeckSnapshot
                ? `The archived ${progress.lockedDeckSnapshot.cards.reduce((total, entry) => total + entry.quantity, 0)}-card snapshot is verified.`
                : complete
                  ? "The three ordered wins and championship reward are verified, but this save no longer contains the registered card list."
                  : deckReadiness.message}
            </p>
            <div className={styles.tournamentLockRule}>
              <strong>One deck for the full bracket</strong>
              <p>
                Registration saves an exact snapshot of this deck. That list remains fixed for the
                quarterfinal, semifinal, and final—even if you edit or activate another deck later.
                A loss safely retries the same round with the same registered list.
              </p>
            </div>
            {registered ? (
              <p><strong>Round {progress.activeRoundNumber} is ready.</strong> Your deck is already registered; head to the Arena.</p>
            ) : complete ? (
              <p><strong>Bracket complete.</strong> Your championship deck remains archived while postgame practice uses your current active deck.</p>
            ) : null}
          </section>
        </div>

        <div className={styles.tournamentRegistrationActions}>
          {!registered && !complete ? <button type="button" className={styles.secondaryButton} onClick={onDecks}>Open Deck Workshop</button> : null}
          {registered && notice?.kind === "error" ? (
            <button type="button" className={styles.secondaryButton} onClick={onSaveRegistration}>Save registration now</button>
          ) : null}
          {!registered && !complete ? (
            <button type="button" disabled={!canRegister} onClick={onRegister}>Register and lock deck</button>
          ) : (
            <button type="button" onClick={onClose}>{complete ? "Return to Champion's Wake" : "Head to the Arena"}</button>
          )}
        </div>
      </section>
    </div>
  );
}

const CHAMPIONSHIP_ENDING_COPY = Object.freeze({
  ceremony: Object.freeze({
    speaker: "Director Amara Vela",
    role: "SeaPals Tournament Director",
    character: "champions-wake-director",
    title: "The Championship Ceremony",
    message: "Welcome, SeaPals Champion! Across three complete 30 VP games, you protected your economy, adapted your ecosystem, and kept every conclusion proportional to the evidence. The five communities now present the SeaPals Championship Cup to you.",
    button: "Visit the Reflection Pavilion",
  }),
  epilogue: Object.freeze({
    speaker: "Dr. Ivo Kestrel",
    role: "Archipelago Learning Steward",
    character: "champions-wake-reflector",
    title: "What the habitats taught us",
    message: "Your Tide Marks do not say that any habitat is fixed forever. Sunpatch keeps comparing coral records, Brackwater repeats estuary measurements, Current Commons tracks connected paths, Kelpwatch compares food-web changes, and Trenchlight continues passive surveys. Careful ocean science observes again and changes course when better evidence arrives.",
    button: "Continue to the study club",
  }),
  credits: Object.freeze({
    speaker: "Tali",
    role: "Junior Reefkeeper",
    character: "champions-wake-spectator",
    title: "A bracket ends. Curiosity continues.",
    message: "We made a new chart called Questions We Still Have. You can revisit every town, reread Field Notes, rebuild decks, and challenge the tournament players to practice matches. A champion keeps learning—and leaves room to change their mind.",
    button: "Continue exploring",
  }),
});

function ChampionshipEnding({
  stage,
  replay = false,
  blocked = false,
  textSpeed = "normal",
  reducedMotion = false,
  onAdvance,
}) {
  const dialogRef = useDialogFocusTrap(!blocked);
  const copy = CHAMPIONSHIP_ENDING_COPY[stage];
  if (!copy) return null;
  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      inert={blocked}
      aria-hidden={blocked || undefined}
      data-adventure-modal="true"
      className={styles.championshipEndingLayer}
      role="dialog"
      aria-modal="true"
      aria-labelledby="championship-ending-title"
    >
      <article className={styles.championshipEndingCard} data-stage={stage}>
        <span className={styles.championshipGlow} aria-hidden="true" />
        <div className={`${styles.championshipPortrait} ${styles[`portrait${TRAINERS[copy.character]?.color ?? "teal"}`]}`}>
          <CharacterPortrait character={copy.character} facing="down" />
        </div>
        <section>
          <span className={styles.championshipStep}>{replay ? "Pavilion reflection" : `Championship ending · ${stage}`}</span>
          <h2 id="championship-ending-title">{copy.title}</h2>
          <div className={styles.championshipSpeaker}><strong>{copy.speaker}</strong><span>{copy.role}</span></div>
          <ProgressiveDialogueLine
            key={`${stage}:${replay}`}
            message={copy.message}
            speaker={copy.speaker}
            textSpeed={textSpeed}
            reducedMotion={reducedMotion}
          >
            <button type="button" autoFocus className={styles.challengeButton} onClick={onAdvance}>
              {replay ? "Return to the Pavilion" : copy.button}
            </button>
          </ProgressiveDialogueLine>
          {stage === "ceremony" ? (
            <ul className={styles.championshipMarks} aria-label="Five earned Tide Marks">
              {Object.values(TIDE_MARK_LABELS).map((label) => <li key={label}>★ <span>{label}</span></li>)}
            </ul>
          ) : null}
          {stage === "credits" ? (
            <div className={styles.championshipCredits} aria-label="Game credits">
              <strong>SeaPals: Reefbound</strong>
              <span>Created for young ocean learners and card-game explorers</span>
              <span>Ocean habitats · evidence-based choices · deck strategy</span>
              <small>Thank you for caring for every place you visit.</small>
            </div>
          ) : null}
        </section>
      </article>
    </div>
  );
}

function trenchlightLaunchLabel(
  expeditionState,
  briefingComplete = false,
  guideComplete = false,
) {
  if (expeditionState?.phase === "survey" && !guideComplete) return "Meet Luz before launching the guided survey";
  if (expeditionState?.phase === "survey" && !briefingComplete) return "Talk with Dr. Hana before launching the guided survey";
  if (expeditionState?.phase === "survey") return "Launch the guided survey leg with Dr. Hana";
  if (expeditionState?.phase === "analysis-required") return "Interpret the four survey records before relaunching";
  if (expeditionState?.phase === "recovery") return "Relaunch the guided sub for sensor recovery";
  if (expeditionState?.phase === "expedition-complete") return "Expedition complete — report to Dr. Hana";
  return "Complete the Trenchlight expedition briefing before launch";
}

function interactionLabel(
  interaction,
  sceneId,
  expeditionState = null,
  briefingComplete = false,
  guideComplete = false,
) {
  if (!interaction) return SCENES[sceneId]?.routeId
    ? "Steer through the marked channel and approach a dock"
    : "Walk into a doorway, or face someone or a field station to interact";
  if (interaction.type === "trainer" || interaction.type === "npc") {
    if (interaction.tournamentAction === "registration") return "Review tournament registration with Director Vela";
    if (interaction.tournamentAction === "round") return `Meet ${TRAINERS[interaction.trainerId]?.name ?? "your tournament opponent"} for a 30 VP round`;
    if (interaction.tournamentAction === "epilogue") return "Visit the Archipelago Reflection Pavilion";
    return `Talk to ${TRAINERS[interaction.trainerId ?? interaction.npcId]?.name ?? "Reefkeeper"}`;
  }
  if (interaction.type === "board") return interaction.label ?? "Board your personal boat";
  if (interaction.type === "dock") return interaction.label ?? "Dock your boat";
  if (interaction.type === "fishing") return interaction.label ?? "Face the shallows and ready the hand net";
  if (interaction.type === "sub-launch") {
    return trenchlightLaunchLabel(expeditionState, briefingComplete, guideComplete);
  }
  if (interaction.type === "observation") return interaction.label ?? "Record this ecosystem observation";
  if (interaction.type === "interpretation") return interaction.label ?? "Compare and interpret the evidence";
  if (interaction.type === "response") return interaction.label ?? "Choose an evidence-supported response";
  if (interaction.type === "exit") return sceneId === "academy-lab"
    ? "Keep walking into the doorway to leave the aquarium workshop"
    : sceneId === ELVERSON_PROLOGUE_BEDROOM_SCENE_ID
      ? "Keep walking toward the stairs to head downstairs"
      : "Keep walking into the doorway to leave this home";
  if (interaction.targetScene) return `Keep walking into the doorway to enter ${LOCATION_NAMES[interaction.targetScene] ?? "the building"}`;
  return "Interact";
}

function mapThemeClassForScene(scene) {
  const themeClasses = {
    "coastal-elverson": styles.elversonTownMap,
    "sunlit-reef": styles.townMap,
    "academy-lab": styles.academyLabMap,
    "player-bedroom": styles.playerBedroomMap,
    "player-home": styles.playerHomeMap,
    "coral-cottage": styles.coralHomeMap,
    "deep-sea-den": styles.deepHomeMap,
    "shellshore-sunpatch-route": styles.seaRouteMap,
    "sunpatch-cay": styles.sunpatchMap,
    "sunpatch-field-station": styles.sunpatchFieldStationMap,
    "sunpatch-tide-hall": styles.sunpatchTideHallMap,
    "sunpatch-brackwater-route": styles.seaRouteMap,
    "brackwater-landing": styles.sunpatchMap,
    "brackwater-water-lab": styles.sunpatchFieldStationMap,
    "brackwater-mangrove-home": styles.sunpatchFieldStationMap,
    "brackwater-tide-hall": styles.sunpatchTideHallMap,
    "brackwater-current-route": styles.seaRouteMap,
    "current-commons": styles.sunpatchMap,
    "current-navigation-lab": styles.sunpatchFieldStationMap,
    "current-navigator-home": styles.sunpatchFieldStationMap,
    "current-tide-hall": styles.sunpatchTideHallMap,
    "current-kelpwatch-route": styles.seaRouteMap,
    "kelpwatch-island": styles.sunpatchMap,
    "kelpwatch-ecology-lab": styles.sunpatchFieldStationMap,
    "kelpwatch-diver-home": styles.sunpatchFieldStationMap,
    "kelpwatch-tide-hall": styles.sunpatchTideHallMap,
    "kelpwatch-trenchlight-route": styles.trenchlightRouteMap,
    "trenchlight-station": styles.trenchlightStationMap,
    "trenchlight-mission-control": styles.trenchlightMissionControlMap,
    "trenchlight-engineer-workshop": styles.trenchlightWorkshopMap,
    "trenchlight-tide-hall": styles.trenchlightTideHallMap,
    "trenchlight-sub-descent": styles.trenchlightSubMap,
    "trenchlight-champions-wake-route": styles.championsWakeRouteMap,
    "champions-wake-town": styles.championsWakeTownMap,
    "champions-wake-registration-hall": styles.championsWakeRegistrationMap,
    "champions-wake-arena": styles.championsWakeArenaMap,
    "champions-wake-reflection-pavilion": styles.championsWakePavilionMap,
  };
  return themeClasses[scene.theme] ?? styles.townMap;
}

function actionLabel(
  interaction,
  expeditionState = null,
  briefingComplete = false,
  guideComplete = false,
) {
  if (!interaction) return "Interact";
  if (interaction.type === "board") return "Board";
  if (interaction.type === "dock") return "Dock";
  if (interaction.type === "fishing") return interaction.actionLabel ?? "Use hand net";
  if (interaction.type === "sub-launch") {
    if (expeditionState?.phase === "survey" && !guideComplete) return "Meet Luz";
    if (expeditionState?.phase === "survey" && !briefingComplete) return "Briefing first";
    if (expeditionState?.phase === "recovery") return "Relaunch";
    if (expeditionState?.phase === "analysis-required") return "Analyze first";
    if (expeditionState?.phase === "expedition-complete") return "Complete";
    if (expeditionState?.phase === "not-started") return "Briefing first";
    return "Launch";
  }
  if (interaction.type === "observation") return "Observe";
  if (["interpretation", "response"].includes(interaction.type)) return "Review";
  if (interaction.tournamentAction === "registration") return "Register";
  if (interaction.tournamentAction === "round") return "Challenge";
  if (interaction.tournamentAction === "epilogue") return "Reflect";
  return "Talk";
}

export default function AdventureGame({
  account,
  accountNotice = null,
  onSignOut,
}) {
  const [screen, setScreen] = useState("boot");
  const [profiles, setProfiles] = useState(() => ADVENTURE_PROFILE_IDS.map((profileId, index) => ({
    profileId,
    slot: index + 1,
    occupied: false,
    canContinue: false,
    status: "empty",
    sceneId: null,
    savedAt: null,
    playtimeSeconds: 0,
    completedEncounterCount: 0,
  })));
  const [newGameSetup, setNewGameSetup] = useState(null);
  const [gameSave, setGameSave] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [conversationLeadIn, setConversationLeadIn] = useState(null);
  const [activeTrainerId, setActiveTrainerId] = useState(null);
  const [postDuelConversation, setPostDuelConversation] = useState(null);
  const [starterSelectionOpen, setStarterSelectionOpen] = useState(false);
  const [selectedStarterId, setSelectedStarterId] = useState(null);
  const [fieldNoteOpen, setFieldNoteOpen] = useState(false);
  const [activeFieldNoteId, setActiveFieldNoteId] = useState(SHELLSHORE_FIELD_NOTE.id);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [decksOpen, setDecksOpen] = useState(false);
  const [worldMapOpen, setWorldMapOpen] = useState(false);
  const [fieldworkActivity, setFieldworkActivity] = useState(null);
  const [fieldworkFeedback, setFieldworkFeedback] = useState(null);
  const [fishingSession, setFishingSession] = useState(null);
  const [fishingRecastCue, setFishingRecastCue] = useState(null);
  const [packReveal, setPackReveal] = useState(null);
  const [showCompletion, setShowCompletion] = useState(false);
  const [tournamentRegistrationOpen, setTournamentRegistrationOpen] = useState(false);
  const [tournamentRegistrationError, setTournamentRegistrationError] = useState(null);
  const [decksReturnContext, setDecksReturnContext] = useState(null);
  const [championshipEndingStage, setChampionshipEndingStage] = useState(null);
  const [championshipEndingReplay, setChampionshipEndingReplay] = useState(false);
  const [newsletterInviteEligible, setNewsletterInviteEligible] = useState(false);
  const [newsletterInviteOpen, setNewsletterInviteOpen] = useState(false);
  const [newsletterInviteDismissed, setNewsletterInviteDismissed] = useState(false);
  const [newsletterInvitePreferenceReady, setNewsletterInvitePreferenceReady] = useState(false);
  const [newsletterInviteSubmitting, setNewsletterInviteSubmitting] = useState(false);
  const [newsletterInviteError, setNewsletterInviteError] = useState(null);
  const [newsletterInviteStatus, setNewsletterInviteStatus] = useState(
    account.newsletter?.status ?? "not_requested",
  );
  const [pauseOpen, setPauseOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveNotice, setSaveNotice] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [activeDuelDeckSnapshot, setActiveDuelDeckSnapshot] = useState(null);
  const [subAssistedMode, setSubAssistedMode] = useState(false);
  const [subFeedback, setSubFeedback] = useState(null);
  const [isMoving, setIsMoving] = useState(false);
  const [boatTelemetry, setBoatTelemetry] = useState(() => ({
    sceneId: null,
    ...createBoatMotionState({ position: START_STATE.position, heading: 0 }),
    throttle: 0,
    rudder: 0,
  }));
  const [actorRuntime, setActorRuntime] = useState(() => ({
    sceneId: START_STATE.sceneId,
    actors: createAdventureActorStates(SCENES[START_STATE.sceneId].interactions),
  }));
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [sceneTransition, setSceneTransition] = useState(null);
  const [openingPrelude, setOpeningPrelude] = useState(null);
  const [momGreetingStage, setMomGreetingStage] = useState(null);
  const [bestFriendSequence, setBestFriendSequence] = useState(null);
  const [bestFriendWalkSample, setBestFriendWalkSample] = useState(null);
  const [dockCutscenePhase, setDockCutscenePhase] = useState(null);
  const [guidedWalk, setGuidedWalk] = useState(null);
  const [guidedWalkSample, setGuidedWalkSample] = useState(null);
  const [legacySavePrompt, setLegacySavePrompt] = useState(null);
  const keyboardDirectionsRef = useRef(new Map());
  const touchDirectionsRef = useRef(new Set());
  const overworldDirectionsRef = useRef(new Map());
  const movementIntentStartedAtRef = useRef(new Map());
  const movementIntentReleaseTimersRef = useRef(new Map());
  const boatMotionRef = useRef(null);
  const actorRuntimeRef = useRef(actorRuntime);
  const guidedWalkClockRef = useRef(null);
  const bestFriendWalkClockRef = useRef(null);
  const movementActiveRef = useRef(false);
  const movementPausedRef = useRef(true);
  const interactRef = useRef(null);
  const escapeRef = useRef(null);
  const storageRef = useRef(null);
  const saveRef = useRef(null);
  const dirtyRef = useRef(false);
  const profileWriteAuthorizedRef = useRef(false);
  const pageVisibleRef = useRef(true);
  const duelResultRef = useRef(null);
  const activeDuelConversationOriginRef = useRef(null);
  const doorwayTransitionRef = useRef(null);
  const pendingSceneTransitionRef = useRef(null);
  const pendingDockSpeechSaveRef = useRef(null);
  const momGreetingPlayerPositionRef = useRef(null);
  const residentConversationSeenRef = useRef(new Set());
  const worldActionRef = useRef(null);
  const sceneAssetPreloaderRef = useRef(null);

  const createAccountStorageAdapter = useCallback(() => {
    if (!account?.id) {
      throw new Error("A signed-in family account is required for saving.");
    }
    const backend = createAccountScopedAdventureStorage({
      backend: window.localStorage,
      accountId: account.id,
    });
    return createAdventureStorageAdapter({ backend });
  }, [account?.id]);

  function rememberNewsletterInviteDismissal() {
    try {
      window.localStorage.setItem(
        getNewsletterInviteDismissalKey(account.id),
        ADVENTURE_MARKETING_CONSENT_VERSION,
      );
    } catch {
      // A privacy setting may block local storage. Dismissing the optional
      // invitation must always return the player to the game.
    }
    setNewsletterInviteDismissed(true);
  }

  function dismissNewsletterInvite() {
    rememberNewsletterInviteDismissal();
    setNewsletterInviteEligible(false);
    setNewsletterInviteOpen(false);
    setNewsletterInviteError(null);
  }

  async function submitNewsletterInvite() {
    if (newsletterInviteSubmitting) return;
    setNewsletterInviteSubmitting(true);
    setNewsletterInviteError(null);
    try {
      const response = await fetch("/api/adventure/newsletter-opt-in", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          adultAccountOwner: true,
          marketingConsent: true,
          consentVersion: ADVENTURE_MARKETING_CONSENT_VERSION,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          typeof result?.error === "string"
            ? result.error
            : "The updates request was not accepted.",
        );
      }
      const reportedStatus = result?.newsletterStatus ?? result?.status;
      setNewsletterInviteStatus(
        NEWSLETTER_INVITE_SUPPRESSED_STATUSES.has(reportedStatus)
          ? reportedStatus
          : "processing",
      );
      rememberNewsletterInviteDismissal();
      setNewsletterInviteEligible(false);
      setNewsletterInviteOpen(false);
      setSaveNotice({
        kind: "info",
        message:
          "SeaPals updates were requested. The adult account owner must confirm the email from Kit before updates begin.",
      });
    } catch (error) {
      setNewsletterInviteError(
        error?.message
        ?? "The optional updates request did not finish. Please try again later.",
      );
      setSaveNotice({
        kind: "error",
        message:
          "The optional updates request did not finish. Reefbound is still ready to play.",
      });
    } finally {
      setNewsletterInviteSubmitting(false);
    }
  }

  const setDirty = useCallback((value) => {
    dirtyRef.current = Boolean(value);
  }, []);

  const preloadAdventureSceneAssets = useCallback((destinationScene) => {
    if (!destinationScene || typeof window === "undefined") return Promise.resolve();
    if (!sceneAssetPreloaderRef.current) {
      sceneAssetPreloaderRef.current = createAdventureSceneAssetPreloader({
        createImage: () => new window.Image(),
      });
    }
    return sceneAssetPreloaderRef.current.preloadScene(destinationScene, {
      characterSpriteProfileIds: sceneCharacterSpriteProfileIds(destinationScene),
    });
  }, []);

  const preloadAdventureAsset = useCallback((assetPath) => {
    if (!assetPath || typeof window === "undefined") return Promise.resolve();
    if (!sceneAssetPreloaderRef.current) {
      sceneAssetPreloaderRef.current = createAdventureSceneAssetPreloader({
        createImage: () => new window.Image(),
      });
    }
    return sceneAssetPreloaderRef.current.preloadAsset(assetPath);
  }, []);

  const sceneId = gameSave?.world.sceneId ?? START_STATE.sceneId;
  const position = gameSave?.world.position ?? START_STATE.position;
  const facing = gameSave?.world.facing ?? START_STATE.facing;
  const defeated = useMemo(
    () => new Set(gameSave?.progression.completedEncounterIds ?? []),
    [gameSave],
  );
  const onboardingProgress = useMemo(
    () => gameSave ? getOnboardingProgress(gameSave) : null,
    [gameSave],
  );
  const prologueProgress = useMemo(
    () => gameSave ? getElversonPrologueProgress(gameSave) : null,
    [gameSave],
  );
  const dialogueIdentity = useMemo(() => ({
    playerName: gameSave?.player?.name ?? "Explorer",
    bestFriendName: gameSave?.player?.bestFriendName ?? "Finn",
  }), [gameSave?.player?.bestFriendName, gameSave?.player?.name]);
  const fishingProgress = useMemo(
    () => gameSave ? getElversonHandNetProgress(gameSave) : null,
    [gameSave],
  );
  const aquariumExhibitModel = useMemo(
    () => gameSave ? getElversonAquariumExhibitModel(gameSave) : null,
    [gameSave],
  );
  const unlockedFieldNotes = useMemo(
    () => buildUnlockedAdventureFieldNotes(gameSave?.fieldNotes.entryIds ?? [])
      .filter((note) => note.id === SHELLSHORE_FIELD_NOTE.id),
    [gameSave?.fieldNotes.entryIds],
  );
  const fieldNoteAvailable = unlockedFieldNotes.length > 0;
  const activeFieldNote = unlockedFieldNotes.find((note) => note.id === activeFieldNoteId)
    ?? SHELLSHORE_FIELD_NOTE;
  const ecosystemChapter = useMemo(
    () => gameSave ? getAdventureEcosystemChapterByTownId(gameSave.world.townId) : null,
    [gameSave],
  );
  const ecosystemProgress = useMemo(
    () => gameSave && ecosystemChapter ? ecosystemChapter.getProgress(gameSave) : null,
    [ecosystemChapter, gameSave],
  );
  const tournamentProgress = useMemo(
    () => gameSave ? getChampionsWakeTournamentProgress(gameSave) : null,
    [gameSave],
  );
  const tournamentAvailability = useMemo(
    () => gameSave ? getChampionsWakeTournamentAvailability(gameSave) : null,
    [gameSave],
  );
  const tournamentDeckReadiness = useMemo(() => {
    if (!gameSave) return { ready: false, message: "Choose an active deck first.", snapshot: null };
    try {
      const snapshot = createActiveDuelDeckSnapshot(gameSave, cardsById);
      const count = snapshot.cards.reduce((total, entry) => total + entry.quantity, 0);
      return {
        ready: true,
        message: `${count} cards · legal, owned, and ready to register.`,
        snapshot,
      };
    } catch (error) {
      return {
        ready: false,
        message: `${error?.message ?? "This deck is not tournament legal."} Open the Deck Workshop to repair it.`,
        snapshot: null,
      };
    }
  }, [gameSave]);
  const trenchlightGuideComplete = Boolean(
    gameSave
    && ecosystemChapter?.townId === "trenchlight-station"
    && hasMetAdventureEcosystemGuide(ecosystemChapter, gameSave)
  );
  const trenchlightBriefingComplete = Boolean(
    gameSave
    && ecosystemChapter?.townId === "trenchlight-station"
    && gameSave.progression.quests[ecosystemChapter.questId]?.flags?.[
      ecosystemChapter.ui.fieldPartnerMetFlagId
    ] === true
  );
  const worldMapModel = useMemo(
    () => gameSave ? buildAdventureWorldMapModel(gameSave) : null,
    [gameSave],
  );
  const scene = SCENES[sceneId];
  useEffect(() => {
    if (screen !== "playing" || scene.kind !== "interior") return;
    let cancelled = false;
    const warmDestinationScenes = async () => {
      // Finish the visible room first. On a cold mobile cache this prevents a
      // multi-megabyte destination preload from competing with the current map.
      await preloadAdventureSceneAssets(scene);
      if (cancelled) return;
      const connection = navigator.connection
        ?? navigator.mozConnection
        ?? navigator.webkitConnection;
      if (
        connection?.saveData === true
        || connection?.effectiveType === "slow-2g"
        || connection?.effectiveType === "2g"
      ) {
        return;
      }
      for (const destinationSceneId of getAdventureInteriorDestinationSceneIds(scene)) {
        void preloadAdventureSceneAssets(SCENES[destinationSceneId]);
      }
    };
    void warmDestinationScenes();
    return () => {
      cancelled = true;
    };
  }, [preloadAdventureSceneAssets, scene, screen]);
  const boatMode = Boolean(scene?.routeId || scene?.kind === "route");
  const vehicleMode = scene?.kind === "vehicle";
  const worldIntroductionConversationActive = conversation?.mode === "worldIntroduction"
    || conversationLeadIn?.mode === "worldIntroduction";
  const dockSpeechPending = Boolean(
    prologueProgress
    && !prologueProgress.legacySkipped
    && prologueProgress.readyForDockSpeech
  );
  const bestFriendArrivalPending = Boolean(
    prologueProgress
    && !prologueProgress.legacySkipped
    && prologueProgress.needsBestFriendArrival
    && sceneId === "town"
  );
  const openingMentorReady = prologueProgress?.legacySkipped
    && onboardingProgress?.needsWorldIntroduction;
  const stageOpeningMentor = !dockSpeechPending && sceneId === "town" && (
    openingMentorReady
    || worldIntroductionConversationActive
    || (
      sceneTransition?.type === "guided"
      && sceneTransition.interactionId === ELVERSON_AQUARIUM_GUIDED_TRANSITION.interactionId
    )
  );
  const sceneCharacterInteractions = useMemo(() => {
    if (dockSpeechPending) {
      return sceneId === "town" ? [...ELVERSON_DOCK_SPEECH_INTERACTIONS] : [];
    }
    const authoredInteractions = scene.interactions.filter((candidate) => {
      const npcId = candidate.trainerId ?? candidate.npcId;
      return (
        ["trainer", "npc"].includes(candidate.type)
        && TRAINERS[npcId]
        && !(
          sceneId === ELVERSON_PROLOGUE_HOME_SCENE_ID
          && npcId === ELVERSON_PROLOGUE_BEST_FRIEND_ID
        )
      );
    });
    const interactions = [...authoredInteractions];
    if (bestFriendArrivalPending) {
      interactions.push(ELVERSON_BEST_FRIEND_ARRIVAL_INTERACTION);
    }
    if (stageOpeningMentor) interactions.push(ELVERSON_OPENING_MENTOR_INTERACTION);
    if (
      sceneId === ELVERSON_PROLOGUE_AQUARIUM_SCENE_ID
      && prologueProgress?.friendVisibleInAquarium
    ) {
      interactions.push(ELVERSON_RIVAL_AQUARIUM_INTERACTION);
    }
    return interactions;
  }, [bestFriendArrivalPending, dockSpeechPending, prologueProgress?.friendVisibleInAquarium, scene.interactions, sceneId, stageOpeningMentor]);
  const anchoredActorStates = useMemo(
    () => createAdventureActorStates(sceneCharacterInteractions),
    [sceneCharacterInteractions],
  );
  const actorStates = actorRuntime.sceneId === sceneId
    ? actorRuntime.actors
    : anchoredActorStates;
  const actorPositionOverrides = useMemo(
    () => getAdventureActorPositionOverrides(actorStates),
    [actorStates],
  );
  const effectiveReducedMotion = gameSave?.settings?.reducedMotion === true || systemReducedMotion;
  const activeRoute = useMemo(
    () => boatMode ? ADVENTURE_CONTENT.routes.find((route) => route.id === scene.routeId) ?? null : null,
    [boatMode, scene.routeId],
  );
  const destinationDock = useMemo(() => {
    if (!activeRoute || !gameSave) return null;
    const destinationEndpoint = gameSave.world.townId === activeRoute.fromTownId ? "to" : "from";
    return scene.interactions.find((candidate) => (
      candidate.type === "dock" && candidate.endpoint === destinationEndpoint
    )) ?? null;
  }, [activeRoute, gameSave, scene.interactions]);
  const trenchlightExpeditionState = useMemo(
    () => gameSave && (
      sceneId === TRENCHLIGHT_SUB_SCENE_ID
      || sceneId === TRENCHLIGHT_MISSION_CONTROL_SCENE_ID
    )
      ? getTrenchlightExpeditionState(gameSave, { assistedMode: subAssistedMode })
      : null,
    [gameSave, sceneId, subAssistedMode],
  );
  const openingFreeRoamLocked = Boolean(
    prologueProgress
    && !prologueProgress.legacySkipped
    && !prologueProgress.complete
    && prologueProgress.needsRivalDeparture
  );
  const movementPaused = screen !== "playing"
    || openingFreeRoamLocked
    || Boolean(openingPrelude)
    || Boolean(momGreetingStage)
    || Boolean(bestFriendSequence)
    || Boolean(dockCutscenePhase)
    || vehicleMode
    || pauseOpen
    || settingsOpen
    || Boolean(confirmation)
    || Boolean(conversation)
    || Boolean(conversationLeadIn)
    || Boolean(activeTrainerId)
    || Boolean(sceneTransition)
    || Boolean(guidedWalk)
    || starterSelectionOpen
    || fieldNoteOpen
    || inventoryOpen
    || decksOpen
    || worldMapOpen
    || Boolean(fieldworkActivity)
    || Boolean(fishingSession)
    || showCompletion
    || tournamentRegistrationOpen
    || Boolean(championshipEndingStage)
    || newsletterInviteOpen;
  movementPausedRef.current = movementPaused;
  const playerWalking = bestFriendWalkSample?.follower.moving === true
    || guidedWalkSample?.follower.moving === true
    || isAdventurePlayerWalking({ isMoving, boatMode, movementPaused });
  const playerWalkSpeed = bestFriendWalkSample?.follower.moving === true
    ? bestFriendSequence?.plan?.speed
    : guidedWalkSample?.follower.moving === true
      ? guidedWalk?.plan?.speed
      : scene.movement?.speed;
  const authoredInteraction = useMemo(() => {
    if (screen !== "playing" || !gameSave || vehicleMode) return null;
    const candidate = getContinuousInteraction(sceneId, position, facing, {
      positionOverrides: actorPositionOverrides,
    });
    if (dockSpeechPending && ["trainer", "npc"].includes(candidate?.type)) {
      return null;
    }
    const candidateNpcId = candidate?.trainerId ?? candidate?.npcId;
    if (
      sceneId === ELVERSON_PROLOGUE_HOME_SCENE_ID
      && candidateNpcId === ELVERSON_PROLOGUE_BEST_FRIEND_ID
    ) {
      return null;
    }
    return candidate;
  }, [
    actorPositionOverrides,
    dockSpeechPending,
    facing,
    gameSave,
    position,
    sceneId,
    screen,
    vehicleMode,
  ]);
  const shorelineFishingInteraction = useMemo(
    () => screen === "playing" && gameSave && !vehicleMode
      ? getElversonHandNetInteraction(sceneId, position, facing)
      : null,
    [facing, gameSave, position, sceneId, screen, vehicleMode],
  );
  const cuedShorelineFishingInteraction = useMemo(() => {
    if (
      !shorelineFishingInteraction
      || !fishingRecastCue
      || fishingRecastCue.profileId !== gameSave?.profileId
      || fishingRecastCue.sceneId !== sceneId
      || fishingRecastCue.spotId !== shorelineFishingInteraction.spotId
    ) return shorelineFishingInteraction;
    return {
      ...shorelineFishingInteraction,
      actionLabel: "Try shallows again",
      recastReady: true,
      label: fishingRecastCue.outcome === "caught"
        ? "Catch secured. Press Enter or tap Try shallows again for another hand-net attempt."
        : "The creatures found cover. Press Enter or tap Try shallows again when the cove settles.",
    };
  }, [fishingRecastCue, gameSave?.profileId, sceneId, shorelineFishingInteraction]);
  // Authored characters, doors, and props always win when their interaction
  // corridor overlaps a shoreline edge.
  const interaction = authoredInteraction ?? cuedShorelineFishingInteraction;
  const trainerInteraction = ["trainer", "npc"].includes(interaction?.type) ? interaction : null;
  const actionInteraction = interaction && !["enter", "exit"].includes(interaction.type)
    ? interaction
    : null;

  useEffect(() => {
    if (!fishingRecastCue) return;
    if (
      screen !== "playing"
      || fishingRecastCue.profileId !== gameSave?.profileId
      || fishingRecastCue.sceneId !== sceneId
      || authoredInteraction
      || shorelineFishingInteraction?.spotId !== fishingRecastCue.spotId
    ) {
      setFishingRecastCue(null);
    }
  }, [
    authoredInteraction,
    fishingRecastCue,
    gameSave?.profileId,
    sceneId,
    screen,
    shorelineFishingInteraction?.spotId,
  ]);

  const setMovementActive = useCallback((nextActive) => {
    if (movementActiveRef.current === nextActive) return;
    movementActiveRef.current = nextActive;
    setIsMoving(nextActive);
  }, []);

  const clearMovement = useCallback(() => {
    keyboardDirectionsRef.current.clear();
    touchDirectionsRef.current.clear();
    overworldDirectionsRef.current.clear();
    movementIntentStartedAtRef.current.clear();
    for (const timer of movementIntentReleaseTimersRef.current.values()) {
      window.clearTimeout(timer);
    }
    movementIntentReleaseTimersRef.current.clear();
    if (boatMotionRef.current) {
      boatMotionRef.current = {
        ...boatMotionRef.current,
        speed: 0,
        collided: false,
        throttle: 0,
        rudder: 0,
      };
      setBoatTelemetry((current) => ({
        ...current,
        speed: 0,
        collided: false,
        throttle: 0,
        rudder: 0,
      }));
    }
    setMovementActive(false);
  }, [setMovementActive]);

  const syncMovementActive = useCallback(() => {
    const currentScene = SCENES[saveRef.current?.world?.sceneId];
    if (currentScene?.routeId || currentScene?.kind === "route") {
      const controls = boatControlInput(keyboardDirectionsRef.current, touchDirectionsRef.current);
      const coasting = Math.abs(boatMotionRef.current?.speed ?? 0) > BOAT_MOTION_DEFAULTS.stoppedSpeed;
      setMovementActive(
        !movementPausedRef.current
        && (controls.throttle !== 0 || controls.rudder !== 0 || coasting),
      );
      return;
    }
    const { vector } = resolveAdventureMovementInput(overworldDirectionsRef.current);
    setMovementActive(
      !movementPausedRef.current && (vector.x !== 0 || vector.y !== 0),
    );
  }, [setMovementActive]);

  const activateMovementIntent = useCallback((inputId, direction) => {
    const pendingRelease = movementIntentReleaseTimersRef.current.get(inputId);
    if (pendingRelease) window.clearTimeout(pendingRelease);
    movementIntentReleaseTimersRef.current.delete(inputId);
    if (!overworldDirectionsRef.current.has(inputId)) {
      movementIntentStartedAtRef.current.set(inputId, performance.now());
    }
    overworldDirectionsRef.current.delete(inputId);
    overworldDirectionsRef.current.set(inputId, direction);
  }, []);

  const releaseMovementIntent = useCallback((inputId, releaseSource) => {
    const finishRelease = () => {
      releaseSource();
      overworldDirectionsRef.current.delete(inputId);
      movementIntentStartedAtRef.current.delete(inputId);
      movementIntentReleaseTimersRef.current.delete(inputId);
      syncMovementActive();
    };
    const startedAt = movementIntentStartedAtRef.current.get(inputId) ?? performance.now();
    const remainingMs = Math.max(0, MIN_MOVEMENT_INTENT_MS - (performance.now() - startedAt));
    if (remainingMs === 0) {
      finishRelease();
      return;
    }
    const previousTimer = movementIntentReleaseTimersRef.current.get(inputId);
    if (previousTimer) window.clearTimeout(previousTimer);
    movementIntentReleaseTimersRef.current.set(
      inputId,
      window.setTimeout(finishRelease, remainingMs),
    );
  }, [syncMovementActive]);

  const refreshProfiles = useCallback(() => {
    const adapter = storageRef.current;
    if (!adapter) return null;
    const result = adapter.listProfileSummaries();
    setProfiles(result.profiles);
    return result;
  }, []);

  const persistSave = useCallback((nextSave, { kind = "autosave", checkpointId = "exploration" } = {}) => {
    const adapter = storageRef.current;
    if (!adapter) {
      setDirty(true);
      setSaveNotice({ kind: "error", message: "Saving is unavailable in this browser. Your current session is still playable." });
      return { ok: false, error: { code: "STORAGE_UNAVAILABLE" } };
    }
    if (!profileWriteAuthorizedRef.current) {
      setDirty(true);
      setSaveNotice({
        kind: "error",
        message: "This adventure is not connected to a writable save slot yet. Open the pause menu and choose Save game to claim the slot safely.",
      });
      return { ok: false, error: { code: "SAVE_AUTHORIZATION_REQUIRED" } };
    }

    const result = kind === "manual"
      ? adapter.manualSave(nextSave.profileId, nextSave)
      : adapter.autosave(nextSave.profileId, nextSave, checkpointId);
    if (result.ok) {
      setDirty(false);
      setSaveNotice({
        kind: "info",
        message: kind === "manual"
          ? `Game saved at ${formatSavedAt(result.savedAt)}.`
          : "Progress autosaved.",
      });
      refreshProfiles();
    } else {
      setDirty(true);
      setSaveNotice({
        kind: "error",
        message: `${result.error?.message ?? "The game could not be saved."} Keep playing, then retry from the pause menu.`,
      });
    }
    return result;
  }, [refreshProfiles, setDirty]);

  const startElversonHandNetGuidedWalk = useCallback((sourceSave) => {
    if (!sourceSave || sourceSave.world.sceneId !== "town") return false;
    void preloadAdventureAsset(ELVERSON_REEF_CREATURE_ATLAS_PATH);
    void preloadAdventureAsset(ELVERSON_HAND_NET_TIDEPOOL_PATH);
    const plan = createGuidedWalkPlan({
      path: ELVERSON_WYETH_HAND_NET_PATH.leader,
      followerPath: ELVERSON_WYETH_HAND_NET_PATH.follower,
      speed: 1.75,
      followerDelayMs: 520,
      reducedMotion: effectiveReducedMotion,
      reducedMotionSpeed: 3.5,
    });
    const initialSample = sampleGuidedWalk(plan, 0);
    clearMovement();
    guidedWalkClockRef.current = null;
    setGuidedWalkSample(initialSample);
    setGuidedWalk({
      id: "wyeth-hand-net-cove",
      plan,
      sourceProfileId: sourceSave.profileId,
    });
    return true;
  }, [clearMovement, effectiveReducedMotion, preloadAdventureAsset]);

  useEffect(() => {
    if (!guidedWalk || screen !== "playing") return undefined;
    let animationFrame = 0;
    let completionTimer = 0;
    let finished = false;

    const applySample = (sample) => {
      setGuidedWalkSample(sample);

      const currentSave = saveRef.current;
      if (
        currentSave
        && currentSave.profileId === guidedWalk.sourceProfileId
        && currentSave.world.sceneId === "town"
      ) {
        const movedSave = {
          ...currentSave,
          world: {
            ...currentSave.world,
            position: { ...sample.follower.position },
            facing: sample.follower.facing,
          },
        };
        saveRef.current = movedSave;
        setGameSave(movedSave);
      }

      const currentRuntime = actorRuntimeRef.current.sceneId === "town"
        ? actorRuntimeRef.current
        : { sceneId: "town", actors: anchoredActorStates };
      const wyethActor = currentRuntime.actors[FISHERMAN_WYETH_INTERACTION_ID]
        ?? anchoredActorStates[FISHERMAN_WYETH_INTERACTION_ID];
      if (wyethActor) {
        const nextRuntime = {
          sceneId: "town",
          actors: {
            ...currentRuntime.actors,
            [FISHERMAN_WYETH_INTERACTION_ID]: {
              ...wyethActor,
              position: { ...sample.leader.position },
              facing: sample.leader.facing,
              moving: sample.leader.moving,
            },
          },
        };
        actorRuntimeRef.current = nextRuntime;
        setActorRuntime(nextRuntime);
      }
    };

    const finishWalk = (sample) => {
      if (finished) return;
      applySample(sample);
      finished = true;
      guidedWalkClockRef.current = null;

      const resetRuntime = { sceneId: "town", actors: anchoredActorStates };
      actorRuntimeRef.current = resetRuntime;
      setActorRuntime(resetRuntime);
      // Release the movement lock and open the required lesson before saving.
      // A storage failure must never strand the player in the escort state.
      setGuidedWalk(null);
      setGuidedWalkSample(null);
      setFishingSession({ ...ELVERSON_FISHING_TUTORIAL_SESSION });

      const arrivedSave = saveRef.current;
      if (arrivedSave) {
        setDirty(true);
        try {
          const saveResult = persistSave(arrivedSave, {
            checkpointId: "elverson-hand-net-guided-walk-complete",
          });
          if (!saveResult?.ok) return;
        } catch (error) {
          setSaveNotice({
            kind: "error",
            message: `You reached the sandy cove, but the arrival checkpoint could not save: ${error?.message ?? "unknown storage error"}.`,
          });
          return;
        }
      }
      setSaveNotice({
        kind: "info",
        message: "You followed Wyeth to the sandy cove. Move gently and make one safe hand-net catch.",
      });
    };

    const advance = (timestamp) => {
      if (finished) return;
      const clock = advanceGuidedWalkClock(
        guidedWalk.plan,
        guidedWalkClockRef.current,
        timestamp,
      );
      guidedWalkClockRef.current = clock;
      const sample = sampleGuidedWalk(guidedWalk.plan, clock.elapsedMs);
      applySample(sample);

      if (!sample.complete) {
        animationFrame = window.requestAnimationFrame(advance);
        return;
      }
      finishWalk(sample);
    };

    const elapsedMs = guidedWalkClockRef.current?.elapsedMs ?? 0;
    const completionFallbackMs = Math.max(0, guidedWalk.plan.durationMs - elapsedMs) + 750;
    completionTimer = window.setTimeout(() => {
      finishWalk(sampleGuidedWalk(guidedWalk.plan, guidedWalk.plan.durationMs));
    }, completionFallbackMs);
    animationFrame = window.requestAnimationFrame(advance);
    return () => {
      finished = true;
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(completionTimer);
    };
  }, [anchoredActorStates, guidedWalk, persistSave, screen, setDirty]);

  const applySceneTransition = useCallback((candidate, sourceSave) => {
    if (!candidate?.targetScene || !candidate.spawn || !sourceSave) return null;
    let next = enterAdventureScene(sourceSave, {
      sceneId: candidate.targetScene,
      position: candidate.spawn,
      facing: candidate.facing ?? (candidate.type === "exit" ? "down" : "up"),
    });
    next = beginChampionsWakeQuestAtCurrentScene(next).save;
    saveRef.current = next;
    setGameSave(next);
    setDirty(true);
    persistSave(next, {
      checkpointId: `scene-transition:${candidate.interactionId ?? candidate.targetScene}`,
    });
    return next;
  }, [persistSave, setDirty]);

  const requestSceneTransition = useCallback((
    candidate,
    sourceSave = saveRef.current,
    {
      afterArrivalConversation = null,
      afterArrivalFishingSession = null,
    } = {},
  ) => {
    if (!candidate?.targetScene || !candidate.spawn || !sourceSave || sceneTransition) return false;
    const interactionId = candidate.interactionId ?? candidate.targetScene;
    const transitionKey = `${sourceSave.world.sceneId}:${interactionId}`;
    if (doorwayTransitionRef.current === transitionKey) return false;

    const arrivalDirection = candidate.facing ?? (candidate.type === "exit" ? "down" : "up");
    const transition = createAdventureSceneTransition({
      sourceSceneId: sourceSave.world.sceneId,
      targetSceneId: candidate.targetScene,
      interactionId,
      type: candidate.type ?? "enter",
      departureDirection: sourceSave.world.facing,
      arrivalDirection,
    });
    const artworkReady = preloadAdventureSceneAssets(SCENES[candidate.targetScene]);

    doorwayTransitionRef.current = transitionKey;
    pendingSceneTransitionRef.current = {
      candidate,
      sourceSave,
      artworkReady,
      afterArrivalConversation,
      afterArrivalFishingSession,
    };
    saveRef.current = sourceSave;
    setGameSave(sourceSave);
    setDirty(true);
    clearMovement();
    setSceneTransition(transition);
    return true;
  }, [clearMovement, preloadAdventureSceneAssets, sceneTransition, setDirty]);

  useEffect(() => {
    if (!sceneTransition) return undefined;
    let cancelled = false;
    const duration = getAdventureSceneTransitionDurationMs(sceneTransition.phase, {
      reducedMotion: effectiveReducedMotion,
    });
    const timer = window.setTimeout(async () => {
      if (sceneTransition.phase === "departing") {
        const pending = pendingSceneTransitionRef.current;
        if (!pending) {
          doorwayTransitionRef.current = null;
          setSceneTransition(null);
          return;
        }
        await Promise.race([
          pending.artworkReady,
          new Promise((resolve) => window.setTimeout(resolve, 600)),
        ]);
        if (cancelled) return;
        const next = applySceneTransition(pending.candidate, pending.sourceSave);
        if (!next) {
          pendingSceneTransitionRef.current = null;
          doorwayTransitionRef.current = null;
          setSceneTransition(null);
          return;
        }
        setSceneTransition(advanceAdventureSceneTransition(sceneTransition, {
          arrivalDirection: next.world.facing,
        }));
        return;
      }

      const pending = pendingSceneTransitionRef.current;
      pendingSceneTransitionRef.current = null;
      doorwayTransitionRef.current = null;
      setSceneTransition(null);
      if (pending?.afterArrivalFishingSession) {
        setFishingSession({ ...pending.afterArrivalFishingSession });
      } else if (pending?.afterArrivalConversation) {
        const arrivedSave = saveRef.current;
        const origin = {
          sceneId: arrivedSave?.world.sceneId ?? sceneTransition.targetSceneId,
          interactionId: pending.afterArrivalConversation.interactionId,
        };
        const currentRuntime = actorRuntimeRef.current;
        if (
          arrivedSave
          && currentRuntime.sceneId === origin.sceneId
          && currentRuntime.actors[origin.interactionId]
        ) {
          const focusedRuntime = {
            sceneId: currentRuntime.sceneId,
            actors: focusAdventureActor(
              currentRuntime.actors,
              origin.interactionId,
              arrivedSave.world.position,
            ),
          };
          actorRuntimeRef.current = focusedRuntime;
          setActorRuntime(focusedRuntime);
        }
        setConversationLeadIn({
          ...pending.afterArrivalConversation,
          ...origin,
        });
      }
    }, duration);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [applySceneTransition, effectiveReducedMotion, sceneTransition]);

  useEffect(() => {
    if (
      screen !== "playing"
      || !gameSave
      || !fishingProgress?.tutorialStarted
      || !fishingProgress.hasHandNet
      || fishingProgress.tutorialComplete
      || gameSave.world.sceneId !== "town"
      || conversation
      || conversationLeadIn
      || activeTrainerId
      || sceneTransition
      || guidedWalk
      || fishingSession
      || pauseOpen
      || settingsOpen
      || confirmation
      || starterSelectionOpen
      || fieldNoteOpen
      || inventoryOpen
      || decksOpen
      || worldMapOpen
      || fieldworkActivity
      || showCompletion
      || tournamentRegistrationOpen
      || championshipEndingStage
      || newsletterInviteOpen
    ) return;

    const current = saveRef.current ?? gameSave;
    const distanceToPracticeCove = Math.hypot(
      current.world.position.x - ELVERSON_TOWN_SAFE_POSITIONS.handNetCove.x,
      current.world.position.y - ELVERSON_TOWN_SAFE_POSITIONS.handNetCove.y,
    );
    clearMovement();
    if (distanceToPracticeCove <= 0.45) {
      setFishingSession({ ...ELVERSON_FISHING_TUTORIAL_SESSION });
      return;
    }
    const walkStarted = startElversonHandNetGuidedWalk(current);
    if (!walkStarted) {
      setFishingSession({ ...ELVERSON_FISHING_TUTORIAL_SESSION });
    }
  }, [
    activeTrainerId,
    championshipEndingStage,
    clearMovement,
    confirmation,
    conversation,
    conversationLeadIn,
    decksOpen,
    fieldNoteOpen,
    fieldworkActivity,
    fishingProgress?.tutorialComplete,
    fishingProgress?.hasHandNet,
    fishingProgress?.tutorialStarted,
    fishingSession,
    gameSave,
    guidedWalk,
    inventoryOpen,
    newsletterInviteOpen,
    pauseOpen,
    sceneTransition,
    screen,
    settingsOpen,
    showCompletion,
    starterSelectionOpen,
    tournamentRegistrationOpen,
    worldMapOpen,
  ]);

  useEffect(() => {
    if (!conversationLeadIn) return undefined;
    const timer = window.setTimeout(() => {
      setConversation(conversationLeadIn);
      setConversationLeadIn(null);
    }, effectiveReducedMotion ? 0 : 110);
    return () => window.clearTimeout(timer);
  }, [conversationLeadIn, effectiveReducedMotion]);

  useEffect(() => {
    setNewsletterInvitePreferenceReady(false);
    setNewsletterInviteEligible(false);
    setNewsletterInviteOpen(false);
    setNewsletterInviteSubmitting(false);
    setNewsletterInviteError(null);
    setNewsletterInviteStatus(account.newsletter?.status ?? "not_requested");
    let dismissed = false;
    try {
      dismissed =
        window.localStorage.getItem(
          getNewsletterInviteDismissalKey(account.id),
        ) === ADVENTURE_MARKETING_CONSENT_VERSION;
    } catch {
      // Continue without persistence when storage is unavailable.
    }
    setNewsletterInviteDismissed(dismissed);
    setNewsletterInvitePreferenceReady(true);
  }, [account.id, account.newsletter?.status]);

  useEffect(() => {
    try {
      const adapter = createAccountStorageAdapter();
      storageRef.current = adapter;
      let listed = adapter.listProfileSummaries();
      const unscoped = inspectUnscopedAdventureSaves({
        backend: window.localStorage,
        accountId: account.id,
      });
      if (
        listed.profiles.every((profile) => !profile.occupied)
        && unscoped.ok
        && unscoped.hasImportableSaves
        && !unscoped.claim
      ) {
        setProfiles(listed.profiles);
        setLegacySavePrompt({
          importableProfileCount: new Set([
            ...unscoped.importableProfileIds,
            ...(unscoped.legacy.valid ? ["profile-1"] : []),
          ]).size,
        });
        setScreen("title");
        return;
      }
      if (listed.profiles.every((profile) => !profile.occupied)) {
        const migration = adapter.migrateLegacyProfile("profile-1");
        if (migration.ok && migration.migrated) {
          setSaveNotice({ kind: "info", message: "Your earlier Elverson progress was recovered into Save 1." });
          listed = adapter.listProfileSummaries();
        } else if (!migration.ok && migration.error?.code !== "OVERWRITE_CONFIRMATION_REQUIRED") {
          setSaveNotice({ kind: "error", message: `${migration.error?.message ?? "Earlier progress could not be imported."} You can still begin a new Elverson adventure.` });
        }
      }
      setProfiles(listed.profiles);
    } catch (error) {
      setProfiles((current) => current.map((profile) => ({ ...profile, status: "unavailable" })));
      setSaveNotice({ kind: "error", message: `Local saves are unavailable: ${error?.message ?? "storage access failed"}.` });
    }
    setScreen("title");
  }, [account.id, createAccountStorageAdapter]);

  function resolveLegacySaveChoice(importSaves) {
    const claim = claimUnscopedAdventureSaves({
      backend: window.localStorage,
      accountId: account.id,
    });
    if (!claim.ok) {
      setSaveNotice({
        kind: "error",
        message:
          claim.error?.message ??
          "The earlier device saves could not be assigned safely. Please retry.",
      });
      return;
    }

    if (importSaves) {
      const copied = copyUnscopedAdventureSavesToAccount({
        backend: window.localStorage,
        accountId: account.id,
      });
      if (!copied.ok) {
        setSaveNotice({
          kind: "error",
          message:
            copied.error?.message ??
            "The earlier device saves could not be copied safely. Please retry.",
        });
        return;
      }
      refreshProfiles();
      setSaveNotice({
        kind: "info",
        message:
          copied.copiedProfileIds.length > 0
            ? "Your earlier Reefbound saves are now available in this family account."
            : "Your earlier Reefbound saves were already available in this family account.",
      });
    } else {
      setSaveNotice({
        kind: "info",
        message:
          "This family account will start fresh. The earlier device copies were preserved.",
      });
    }

    setLegacySavePrompt(null);
  }

  function installSession(nextSave, { storageAuthorized = false } = {}) {
    saveRef.current = nextSave;
    profileWriteAuthorizedRef.current = storageAuthorized;
    setGameSave(nextSave);
    setConversation(null);
    setConversationLeadIn(null);
    setActiveTrainerId(null);
    setPostDuelConversation(null);
    activeDuelConversationOriginRef.current = null;
    setStarterSelectionOpen(false);
    setSelectedStarterId(null);
    setFieldNoteOpen(false);
    setActiveFieldNoteId(SHELLSHORE_FIELD_NOTE.id);
    setInventoryOpen(false);
    setDecksOpen(false);
    setWorldMapOpen(false);
    setFieldworkActivity(null);
    setFieldworkFeedback(null);
    setFishingSession(null);
    setFishingRecastCue(null);
    setPackReveal(null);
    setActiveDuelDeckSnapshot(null);
    setSubAssistedMode(false);
    setSubFeedback(null);
    setShowCompletion(false);
    setTournamentRegistrationOpen(false);
    setTournamentRegistrationError(null);
    setDecksReturnContext(null);
    setChampionshipEndingStage(null);
    setChampionshipEndingReplay(false);
    setNewsletterInviteEligible(false);
    setNewsletterInviteOpen(false);
    setNewsletterInviteSubmitting(false);
    setPauseOpen(false);
    setSettingsOpen(false);
    setConfirmation(null);
    setNewGameSetup(null);
    pendingSceneTransitionRef.current = null;
    pendingDockSpeechSaveRef.current = null;
    momGreetingPlayerPositionRef.current = null;
    doorwayTransitionRef.current = null;
    setSceneTransition(null);
    setOpeningPrelude(null);
    setMomGreetingStage(null);
    bestFriendWalkClockRef.current = null;
    setBestFriendSequence(null);
    setBestFriendWalkSample(null);
    setDockCutscenePhase(null);
    guidedWalkClockRef.current = null;
    setGuidedWalk(null);
    setGuidedWalkSample(null);
    residentConversationSeenRef.current = new Set();
    setScreen("playing");
  }

  useEffect(() => {
    if (!openingPrelude) return undefined;
    const delay = openingPrelude === "narration"
      ? effectiveReducedMotion ? 1200 : 3200
      : effectiveReducedMotion ? 0 : 1050;
    const timer = window.setTimeout(() => {
      setOpeningPrelude((current) => current === "narration" ? "revealing" : null);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [effectiveReducedMotion, openingPrelude]);

  useEffect(() => {
    const homeConversation = prologueProgress?.homeConversation;
    if (
      screen !== "playing"
      || !gameSave
      || sceneId !== ELVERSON_PROLOGUE_HOME_SCENE_ID
      || prologueProgress?.nextBeatId !== ELVERSON_PROLOGUE_BEATS.breakfast
      || homeConversation?.trainerId !== "player-mom"
      || openingPrelude
      || momGreetingStage
      || conversation
      || conversationLeadIn
      || activeTrainerId
      || sceneTransition
      || pauseOpen
      || settingsOpen
      || confirmation
    ) return;

    clearMovement();
    momGreetingPlayerPositionRef.current = { ...position };
    const interactionId = homeConversation.interactionId;
    const currentRuntime = actorRuntimeRef.current?.sceneId === sceneId
      ? actorRuntimeRef.current
      : { sceneId, actors: anchoredActorStates };
    const focusedRuntime = {
      sceneId,
      actors: focusAdventureActor(
        currentRuntime.actors,
        interactionId,
        position,
        { dwellMs: effectiveReducedMotion ? 0 : 900 },
      ),
    };
    actorRuntimeRef.current = focusedRuntime;
    setActorRuntime(focusedRuntime);
    setMomGreetingStage("calling");
  }, [
    activeTrainerId,
    anchoredActorStates,
    clearMovement,
    confirmation,
    conversation,
    conversationLeadIn,
    effectiveReducedMotion,
    gameSave,
    momGreetingStage,
    openingPrelude,
    pauseOpen,
    position,
    prologueProgress?.homeConversation,
    prologueProgress?.nextBeatId,
    sceneId,
    sceneTransition,
    screen,
    settingsOpen,
  ]);

  useEffect(() => {
    if (momGreetingStage !== "calling") return undefined;
    const timer = window.setTimeout(
      () => setMomGreetingStage("approaching"),
      effectiveReducedMotion ? 0 : 1050,
    );
    return () => window.clearTimeout(timer);
  }, [effectiveReducedMotion, momGreetingStage]);

  useEffect(() => {
    if (momGreetingStage !== "approaching") return undefined;
    const interactionId = "interaction-elverson-prologue-player-mom";
    const playerPosition = momGreetingPlayerPositionRef.current ?? position;
    const plan = createGuidedWalkPlan({
      path: ELVERSON_MOM_GREETING_PATH,
      speed: 1.7,
      followerDelayMs: 0,
      reducedMotion: effectiveReducedMotion,
      reducedMotionSpeed: 8,
    });
    let animationFrame = 0;
    let walkClock = null;
    let finished = false;

    const finishGreeting = (runtime) => {
      if (finished) return;
      finished = true;
      const actor = runtime.actors[interactionId];
      const settledRuntime = actor ? {
        sceneId,
        actors: {
          ...runtime.actors,
          [interactionId]: {
            ...actor,
            position: { ...ELVERSON_MOM_GREETING_POSITION },
            facing: getAdventureFacingToward(
              ELVERSON_MOM_GREETING_POSITION,
              playerPosition,
              actor.facing,
            ),
            moving: false,
          },
        },
      } : runtime;
      actorRuntimeRef.current = settledRuntime;
      setActorRuntime(settledRuntime);
      const currentSave = saveRef.current;
      if (currentSave) {
        const greetedSave = {
          ...currentSave,
          world: {
            ...currentSave.world,
            facing: getAdventureFacingToward(
              playerPosition,
              ELVERSON_MOM_GREETING_POSITION,
              currentSave.world.facing,
            ),
          },
        };
        saveRef.current = greetedSave;
        setGameSave(greetedSave);
        setDirty(true);
      }
      setMomGreetingStage(null);
      setConversation({
        ...prologueProgress.homeConversation,
        openingBeatId: ELVERSON_PROLOGUE_BEATS.breakfast,
        index: 0,
      });
    };

    const updateGreeting = (timestamp) => {
      const runtime = actorRuntimeRef.current?.sceneId === sceneId
        ? actorRuntimeRef.current
        : { sceneId, actors: anchoredActorStates };
      const actor = runtime.actors[interactionId];
      if (!actor || effectiveReducedMotion) {
        finishGreeting(runtime);
        return;
      }
      walkClock = advanceGuidedWalkClock(plan, walkClock, timestamp);
      const sample = sampleGuidedWalk(plan, walkClock.elapsedMs).leader;
      const nextRuntime = {
        sceneId,
        actors: {
          ...runtime.actors,
          [interactionId]: {
            ...actor,
            position: { ...sample.position },
            facing: sample.facing,
            moving: sample.moving,
          },
        },
      };
      actorRuntimeRef.current = nextRuntime;
      setActorRuntime(nextRuntime);
      if (sample.complete) {
        finishGreeting(nextRuntime);
        return;
      }
      animationFrame = window.requestAnimationFrame(updateGreeting);
    };

    animationFrame = window.requestAnimationFrame(updateGreeting);
    return () => {
      finished = true;
      window.cancelAnimationFrame(animationFrame);
    };
  }, [
    anchoredActorStates,
    effectiveReducedMotion,
    momGreetingStage,
    position,
    prologueProgress?.homeConversation,
    sceneId,
    setDirty,
  ]);

  useEffect(() => {
    if (
      screen !== "playing"
      || !gameSave
      || !bestFriendArrivalPending
      || sceneId !== "town"
      || bestFriendSequence
      || conversation
      || conversationLeadIn
      || activeTrainerId
      || sceneTransition
      || pauseOpen
      || settingsOpen
      || confirmation
    ) return;

    clearMovement();
    const stagedSave = {
      ...(saveRef.current ?? gameSave),
      world: {
        ...(saveRef.current ?? gameSave).world,
        position: { ...ELVERSON_TOWN_SAFE_POSITIONS.playerHomeExterior },
        facing: "right",
      },
    };
    saveRef.current = stagedSave;
    setGameSave(stagedSave);
    setDirty(true);

    const friendActor = anchoredActorStates[ELVERSON_BEST_FRIEND_ARRIVAL_INTERACTION_ID];
    if (friendActor) {
      const stagedRuntime = {
        sceneId: "town",
        actors: {
          ...anchoredActorStates,
          [ELVERSON_BEST_FRIEND_ARRIVAL_INTERACTION_ID]: {
            ...friendActor,
            position: { ...ELVERSON_BEST_FRIEND_ARRIVAL_POSITION },
            facing: "left",
            moving: false,
          },
        },
      };
      actorRuntimeRef.current = stagedRuntime;
      setActorRuntime(stagedRuntime);
    }
    setBestFriendWalkSample(null);
    bestFriendWalkClockRef.current = null;
    setBestFriendSequence({ phase: "calling", plan: null });
  }, [
    activeTrainerId,
    anchoredActorStates,
    bestFriendArrivalPending,
    bestFriendSequence,
    clearMovement,
    confirmation,
    conversation,
    conversationLeadIn,
    gameSave,
    pauseOpen,
    sceneId,
    sceneTransition,
    screen,
    setDirty,
    settingsOpen,
  ]);

  useEffect(() => {
    if (bestFriendSequence?.phase !== "calling") return undefined;
    const timer = window.setTimeout(() => {
      const plan = createGuidedWalkPlan({
        path: ELVERSON_BEST_FRIEND_ARRIVAL_PATH,
        speed: 2.35,
        followerDelayMs: 0,
        reducedMotion: effectiveReducedMotion,
        reducedMotionSpeed: 6,
      });
      bestFriendWalkClockRef.current = null;
      setBestFriendWalkSample(sampleGuidedWalk(plan, 0));
      setBestFriendSequence({ phase: "approaching", plan });
    }, effectiveReducedMotion ? 250 : 900);
    return () => window.clearTimeout(timer);
  }, [bestFriendSequence?.phase, effectiveReducedMotion]);

  useEffect(() => {
    if (
      !["approaching", "escorting"].includes(bestFriendSequence?.phase)
      || !bestFriendSequence?.plan
      || screen !== "playing"
    ) return undefined;

    const phase = bestFriendSequence.phase;
    const plan = bestFriendSequence.plan;
    let animationFrame = 0;
    let completionTimer = 0;
    let finished = false;

    const applySample = (sample) => {
      setBestFriendWalkSample(sample);
      const currentRuntime = actorRuntimeRef.current?.sceneId === "town"
        ? actorRuntimeRef.current
        : { sceneId: "town", actors: anchoredActorStates };
      const friendActor = currentRuntime.actors[ELVERSON_BEST_FRIEND_ARRIVAL_INTERACTION_ID]
        ?? anchoredActorStates[ELVERSON_BEST_FRIEND_ARRIVAL_INTERACTION_ID];
      if (friendActor) {
        const nextRuntime = {
          sceneId: "town",
          actors: {
            ...currentRuntime.actors,
            [ELVERSON_BEST_FRIEND_ARRIVAL_INTERACTION_ID]: {
              ...friendActor,
              position: { ...sample.leader.position },
              facing: sample.leader.facing,
              moving: sample.leader.moving,
            },
          },
        };
        actorRuntimeRef.current = nextRuntime;
        setActorRuntime(nextRuntime);
      }

      if (phase === "escorting") {
        const currentSave = saveRef.current;
        if (currentSave?.world.sceneId === "town") {
          const movedSave = {
            ...currentSave,
            world: {
              ...currentSave.world,
              position: { ...sample.follower.position },
              facing: sample.follower.facing,
            },
          };
          saveRef.current = movedSave;
          setGameSave(movedSave);
          setDirty(true);
        }
      }
    };

    const finishWalk = (sample) => {
      if (finished) return;
      applySample(sample);
      finished = true;
      bestFriendWalkClockRef.current = null;
      setBestFriendWalkSample(null);

      if (phase === "approaching") {
        const currentSave = saveRef.current;
        if (currentSave) {
          const facingSave = {
            ...currentSave,
            world: {
              ...currentSave.world,
              position: { ...ELVERSON_TOWN_SAFE_POSITIONS.playerHomeExterior },
              facing: "right",
            },
          };
          saveRef.current = facingSave;
          setGameSave(facingSave);
          setDirty(true);
        }
        const currentRuntime = actorRuntimeRef.current;
        const friendActor = currentRuntime.actors[ELVERSON_BEST_FRIEND_ARRIVAL_INTERACTION_ID];
        if (friendActor) {
          const settledRuntime = {
            sceneId: "town",
            actors: {
              ...currentRuntime.actors,
              [ELVERSON_BEST_FRIEND_ARRIVAL_INTERACTION_ID]: {
                ...friendActor,
                position: { ...ELVERSON_BEST_FRIEND_MEETING_POSITION },
                facing: "left",
                moving: false,
              },
            },
          };
          actorRuntimeRef.current = settledRuntime;
          setActorRuntime(settledRuntime);
        }
        setBestFriendSequence({ phase: "talking", plan: null });
        setConversation({
          trainerId: ELVERSON_PROLOGUE_BEST_FRIEND_ID,
          sceneId: "town",
          interactionId: ELVERSON_BEST_FRIEND_ARRIVAL_INTERACTION_ID,
          openingBeatId: ELVERSON_PROLOGUE_BEATS.race,
          mode: "birthdayMorning",
          escortToDock: true,
          index: 0,
        });
        return;
      }

      try {
        const currentSave = saveRef.current;
        const recorded = recordElversonPrologueBeat(
          currentSave,
          ELVERSON_PROLOGUE_BEATS.race,
        );
        setBestFriendSequence(null);
        if (recorded.applied) {
          commitAdventureMutation(recorded.save, "elverson-opening:best-friend-dock-escort");
        }
      } catch (error) {
        setBestFriendSequence(null);
        setSaveNotice({
          kind: "error",
          message: error?.message ?? "The walk to the dock could not be recorded.",
        });
      }
    };

    const advance = (timestamp) => {
      if (finished) return;
      const clock = advanceGuidedWalkClock(
        plan,
        bestFriendWalkClockRef.current,
        timestamp,
      );
      bestFriendWalkClockRef.current = clock;
      const sample = sampleGuidedWalk(plan, clock.elapsedMs);
      applySample(sample);
      if (sample.complete) {
        finishWalk(sample);
        return;
      }
      animationFrame = window.requestAnimationFrame(advance);
    };

    const elapsedMs = bestFriendWalkClockRef.current?.elapsedMs ?? 0;
    completionTimer = window.setTimeout(() => {
      finishWalk(sampleGuidedWalk(plan, plan.durationMs));
    }, Math.max(0, plan.durationMs - elapsedMs) + 750);
    animationFrame = window.requestAnimationFrame(advance);
    return () => {
      finished = true;
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(completionTimer);
    };
  }, [
    anchoredActorStates,
    bestFriendSequence,
    screen,
    setDirty,
  ]);

  useEffect(() => {
    if (
      screen !== "playing"
      || !gameSave
      || !dockSpeechPending
      || sceneId !== "town"
      || !isElversonDockSpeechTriggerPosition(position)
      || conversation
      || conversationLeadIn
      || activeTrainerId
      || bestFriendSequence
      || dockCutscenePhase
      || sceneTransition
      || pauseOpen
      || settingsOpen
      || confirmation
    ) return;

    clearMovement();
    const stagedSave = {
      ...(saveRef.current ?? gameSave),
      world: {
        ...(saveRef.current ?? gameSave).world,
        position: { ...ELVERSON_DOCK_SPEECH_PLAYER_POSITION },
        facing: "down",
      },
    };
    saveRef.current = stagedSave;
    setGameSave(stagedSave);
    setDirty(true);
    persistSave(stagedSave, { checkpointId: "elverson-dock-speech-started" });
    setDockCutscenePhase("speech");
    setConversation({
      trainerId: ACADEMY_MENTOR_ID,
      sceneId: "town",
      interactionId: ELVERSON_DOCK_SPEECH_INTERACTION_ID,
      index: 0,
      mode: "worldIntroduction",
      dockSpeech: true,
    });
  }, [
    activeTrainerId,
    bestFriendSequence,
    clearMovement,
    confirmation,
    conversation,
    conversationLeadIn,
    dockCutscenePhase,
    dockSpeechPending,
    gameSave,
    pauseOpen,
    persistSave,
    position,
    sceneId,
    sceneTransition,
    screen,
    setDirty,
    settingsOpen,
  ]);

  useEffect(() => {
    const legacyIntroductionReady = prologueProgress?.legacySkipped
      && onboardingProgress?.needsWorldIntroduction;
    if (
      screen !== "playing"
      || !gameSave
      || !legacyIntroductionReady
      || sceneId !== "town"
      || conversation
      || conversationLeadIn
      || activeTrainerId
      || sceneTransition
      || pauseOpen
      || settingsOpen
      || confirmation
    ) return;

    clearMovement();
    setConversation({
      trainerId: ACADEMY_MENTOR_ID,
      sceneId: "town",
      interactionId: ELVERSON_OPENING_MENTOR_INTERACTION_ID,
      index: 0,
      mode: "worldIntroduction",
      dockSpeech: false,
    });
  }, [
    activeTrainerId,
    clearMovement,
    confirmation,
    conversation,
    conversationLeadIn,
    gameSave,
    onboardingProgress?.needsWorldIntroduction,
    pauseOpen,
    prologueProgress?.legacySkipped,
    sceneId,
    sceneTransition,
    screen,
    settingsOpen,
  ]);

  useEffect(() => {
    if (!["covering", "revealing"].includes(dockCutscenePhase)) return undefined;
    const delay = effectiveReducedMotion ? 0 : dockCutscenePhase === "covering" ? 520 : 700;
    const timer = window.setTimeout(() => {
      if (dockCutscenePhase === "covering") {
        const pending = pendingDockSpeechSaveRef.current;
        if (!pending) {
          setDockCutscenePhase(null);
          return;
        }
        const restored = {
          ...pending,
          world: {
            ...pending.world,
            position: { ...ELVERSON_DOCK_SPEECH_RESTORE_POSITION },
            facing: "down",
          },
        };
        commitAdventureMutation(
          restored,
          "elverson-dock-speech-complete",
          "The Sea Creature Challenge kickoff is complete. Registration is open inside the aquarium.",
        );
        setDockCutscenePhase("revealing");
        return;
      }
      pendingDockSpeechSaveRef.current = null;
      setDockCutscenePhase(null);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [dockCutscenePhase, effectiveReducedMotion]);

  useEffect(() => {
    if (
      screen !== "playing"
      || !gameSave
      || sceneId !== ELVERSON_PROLOGUE_AQUARIUM_SCENE_ID
      || !prologueProgress?.needsRivalDeparture
      || conversation
      || conversationLeadIn
      || activeTrainerId
      || postDuelConversation
      || sceneTransition
      || fieldNoteOpen
      || starterSelectionOpen
      || pauseOpen
      || settingsOpen
      || confirmation
    ) return;
    clearMovement();
    setConversation({
      ...ELVERSON_RIVAL_DEPARTURE_CONVERSATION,
      openingBeatId: ELVERSON_PROLOGUE_BEATS.rivalDeparture,
      index: 0,
    });
  }, [
    activeTrainerId,
    clearMovement,
    confirmation,
    conversation,
    conversationLeadIn,
    fieldNoteOpen,
    gameSave,
    pauseOpen,
    postDuelConversation,
    prologueProgress?.needsRivalDeparture,
    sceneId,
    sceneTransition,
    screen,
    settingsOpen,
    starterSelectionOpen,
  ]);

  function beginNewGame(profileId, overwriteConfirmed = false, identity = {}) {
    const adapter = storageRef.current;
    const initial = createNewAdventureSession(profileId, identity);
    let storageResult = null;
    if (adapter) {
      storageResult = adapter.startNewProfile(profileId, {
        overwriteConfirmed,
        saveValue: initial,
      });
      if (!storageResult.ok && storageResult.error?.code === "OVERWRITE_CONFIRMATION_REQUIRED") {
        setConfirmation({
          title: "Start this Elverson adventure over?",
          message: "The existing save in this slot will be replaced. This cannot be undone.",
          confirmLabel: "Start over",
          onConfirm: () => beginNewGame(profileId, true, identity),
        });
        return;
      }
    }

    installSession(initial, { storageAuthorized: Boolean(adapter && storageResult?.ok) });
    setOpeningPrelude("narration");
    setDirty(true);
    if (!adapter || !storageResult?.ok) {
      setSaveNotice({
        kind: "error",
        message: storageResult?.error?.message
          ? `${storageResult.error.message} This adventure is running without a confirmed save.`
          : "This adventure is running without local saving.",
      });
      return;
    }
    persistSave(initial, { checkpointId: "new-game-shellshore-quest" });
  }

  function requestNewGame(profileId, needsConfirmation = false) {
    if (!needsConfirmation) {
      setNewGameSetup({ profileId, overwriteConfirmed: false });
      return;
    }
    setConfirmation({
      title: "Replace this Elverson adventure?",
      message: "Starting a new game will replace this slot's current progress and backup.",
      confirmLabel: "Replace adventure",
      onConfirm: () => setNewGameSetup({ profileId, overwriteConfirmed: true }),
    });
  }

  function continueProfile(profileId) {
    const adapter = storageRef.current;
    if (!adapter) {
      setSaveNotice({ kind: "error", message: "Local storage is unavailable. Retry before continuing a saved adventure." });
      return;
    }
    const loaded = adapter.loadProfile(profileId);
    if (!loaded.ok || !loaded.save) {
      setSaveNotice({ kind: "error", message: loaded.error?.message ?? "This adventure could not be loaded." });
      refreshProfiles();
      return;
    }

    const worldResume = recoverElversonAdventureResume(loaded.save);
    const onboardingResume = recoverOnboardingResume(worldResume.save);
    const prologueResume = recoverElversonPrologueResume(onboardingResume.save);
    let resumedSave = prologueResume.save;
    let collectionRecovered = false;
    let collectionRecoveryError = null;
    let aquariumRewardsRecovered = false;
    let aquariumRewardRecoveryError = null;
    let aquariumCardsRecovered = 0;
    let aquariumRewardRecordsRepaired = 0;
    const starterDeckId = resumedSave.player.starterDeckId;
    if (starterDeckId && PREBUILT_DECKS_BY_ID[starterDeckId]) {
      try {
        const collection = reconcileStarterCollection(
          resumedSave,
          PREBUILT_DECKS_BY_ID[starterDeckId],
        );
        resumedSave = collection.save;
        collectionRecovered = collection.applied;
      } catch (error) {
        collectionRecoveryError = error;
      }
    }
    try {
      const aquariumRewards = reconcileElversonAquariumRewards(resumedSave);
      resumedSave = aquariumRewards.save;
      aquariumRewardsRecovered = aquariumRewards.applied;
      aquariumCardsRecovered = aquariumRewards.awardedCardCount;
      aquariumRewardRecordsRepaired = aquariumRewards.repairedRewardFlags.length;
    } catch (error) {
      aquariumRewardRecoveryError = error;
    }
    const tournamentResume = recoverChampionsWakeTournamentState(resumedSave);
    resumedSave = tournamentResume.save;
    installSession(resumedSave, { storageAuthorized: true });
    if (collectionRecoveryError || aquariumRewardRecoveryError) {
      setDirty(true);
      setSaveNotice({
        kind: "error",
        message: collectionRecoveryError
          ? `Your adventure loaded, but its starter collection needs attention: ${collectionRecoveryError?.message ?? "collection repair failed"}.`
          : `Your adventure loaded, but its aquarium card rewards need attention: ${aquariumRewardRecoveryError?.message ?? "reward repair failed"}.`,
      });
      return;
    }
    const wasRecovered = Boolean(
      loaded.recovery
      || loaded.metadata?.needsRewrite
      || worldResume.recovered
      || onboardingResume.recovered
      || prologueResume.recovered
      || collectionRecovered
      || aquariumRewardsRecovered
      || tournamentResume.recovered,
    );
    setDirty(wasRecovered);
    if (wasRecovered) {
      const repaired = persistSave(resumedSave, { checkpointId: "recovered-profile" });
      setSaveNotice({
        kind: repaired.ok ? "info" : "error",
        message: repaired.ok
          ? aquariumCardsRecovered > 0
            ? "Your Elverson adventure was recovered, including matching cards owed for earlier aquarium deliveries."
            : aquariumRewardRecordsRepaired > 0
              ? "Your Elverson adventure was recovered and its aquarium reward record was repaired safely."
            : "Your Elverson adventure was recovered and its starter collection is ready."
          : "Your Elverson adventure was recovered for this session, but the repaired save could not be written.",
      });
    } else {
      setSaveNotice(null);
    }
  }

  function retryStorage() {
    try {
      if (!storageRef.current) {
        storageRef.current = createAccountStorageAdapter();
      }
      const listed = refreshProfiles();
      setSaveNotice(listed?.ok
        ? { kind: "info", message: "Save storage is available again." }
        : { kind: "error", message: "Some adventure slots still cannot be read." });
    } catch (error) {
      setSaveNotice({ kind: "error", message: `Storage is still unavailable: ${error?.message ?? "access failed"}.` });
    }
  }

  useEffect(() => {
    if (activeTrainerId || !postDuelConversation) return;
    setConversation({
      ...postDuelConversation,
      ...(activeDuelConversationOriginRef.current ?? {}),
    });
    activeDuelConversationOriginRef.current = null;
    setPostDuelConversation(null);
  }, [activeTrainerId, postDuelConversation]);

  useEffect(() => {
    if (
      screen !== "playing"
      || !tournamentProgress?.complete
      || activeTrainerId
      || conversation
      || postDuelConversation
      || championshipEndingStage
      || championshipEndingReplay
      || pauseOpen
      || tournamentRegistrationOpen
      || decksOpen
      || inventoryOpen
      || fieldNoteOpen
      || worldMapOpen
      || fieldworkActivity
    ) return;
    const flags = tournamentProgress.save.progression.quests[CHAMPIONS_WAKE_QUEST_ID]?.flags ?? {};
    if (flags[CHAMPIONSHIP_ENDING_FLAGS.postgame] === true) return;
    const nextStage = ["ceremony", "epilogue", "credits"]
      .find((stage) => flags[CHAMPIONSHIP_ENDING_FLAGS[stage]] !== true)
      ?? "credits";
    clearMovement();
    setChampionshipEndingReplay(false);
    setChampionshipEndingStage(nextStage);
  }, [
    activeTrainerId,
    championshipEndingReplay,
    championshipEndingStage,
    clearMovement,
    conversation,
    decksOpen,
    fieldNoteOpen,
    fieldworkActivity,
    inventoryOpen,
    pauseOpen,
    postDuelConversation,
    screen,
    tournamentProgress,
    tournamentRegistrationOpen,
    worldMapOpen,
  ]);

  useEffect(() => {
    if (
      !newsletterInviteEligible
      || !newsletterInvitePreferenceReady
      || newsletterInviteDismissed
      || newsletterInviteOpen
      || NEWSLETTER_INVITE_SUPPRESSED_STATUSES.has(newsletterInviteStatus)
      || screen !== "playing"
      || activeTrainerId
      || postDuelConversation
      || conversation
      || conversationLeadIn
      || sceneTransition
      || guidedWalk
      || pauseOpen
      || settingsOpen
      || confirmation
      || starterSelectionOpen
      || fieldNoteOpen
      || inventoryOpen
      || decksOpen
      || worldMapOpen
      || fieldworkActivity
      || packReveal
      || showCompletion
      || tournamentRegistrationOpen
      || championshipEndingStage
    ) return;
    const endingFlags =
      tournamentProgress?.save.progression.quests[CHAMPIONS_WAKE_QUEST_ID]?.flags
      ?? {};
    if (
      tournamentProgress?.complete
      && endingFlags[CHAMPIONSHIP_ENDING_FLAGS.postgame] !== true
    ) return;
    clearMovement();
    setNewsletterInviteEligible(false);
    setNewsletterInviteError(null);
    setNewsletterInviteOpen(true);
  }, [
    activeTrainerId,
    championshipEndingStage,
    clearMovement,
    confirmation,
    conversation,
    conversationLeadIn,
    decksOpen,
    fieldNoteOpen,
    fieldworkActivity,
    guidedWalk,
    inventoryOpen,
    newsletterInviteDismissed,
    newsletterInviteEligible,
    newsletterInviteOpen,
    newsletterInvitePreferenceReady,
    newsletterInviteStatus,
    packReveal,
    pauseOpen,
    postDuelConversation,
    sceneTransition,
    screen,
    settingsOpen,
    showCompletion,
    starterSelectionOpen,
    tournamentProgress,
    tournamentRegistrationOpen,
    worldMapOpen,
  ]);

  useEffect(() => {
    const runtime = {
      sceneId,
      actors: anchoredActorStates,
    };
    actorRuntimeRef.current = runtime;
    setActorRuntime(runtime);
  }, [anchoredActorStates, gameSave?.profileId, sceneId]);

  useEffect(() => {
    if (effectiveReducedMotion) {
      const runtime = { sceneId, actors: anchoredActorStates };
      actorRuntimeRef.current = runtime;
      setActorRuntime((current) => actorVisualStateChanged(current.actors, runtime.actors)
        || current.sceneId !== runtime.sceneId
        ? runtime
        : current);
      return undefined;
    }
    if (!sceneCharacterInteractions.some((candidate) => candidate.patrol)) return undefined;
    if (screen !== "playing" || movementPaused || !pageVisible) {
      const currentRuntime = actorRuntimeRef.current?.sceneId === sceneId
        ? actorRuntimeRef.current
        : { sceneId, actors: anchoredActorStates };
      const pausedRuntime = {
        sceneId,
        actors: Object.fromEntries(Object.entries(currentRuntime.actors).map(([interactionId, actor]) => [
          interactionId,
          actor.moving ? { ...actor, moving: false } : actor,
        ])),
      };
      actorRuntimeRef.current = pausedRuntime;
      if (actorVisualStateChanged(currentRuntime.actors, pausedRuntime.actors)) {
        setActorRuntime(pausedRuntime);
      }
      return undefined;
    }

    let animationFrame = 0;
    let previousTime = null;

    function updateActors(timestamp) {
      const elapsedMs = previousTime === null ? 0 : Math.min(timestamp - previousTime, 80);
      previousTime = timestamp;
      const currentSave = saveRef.current;
      const currentRuntime = actorRuntimeRef.current?.sceneId === sceneId
        ? actorRuntimeRef.current
        : { sceneId, actors: anchoredActorStates };
      if (
        elapsedMs > 0
        && currentSave?.world.sceneId === sceneId
        && !movementPausedRef.current
        && pageVisibleRef.current
      ) {
        const nextRuntime = {
          sceneId,
          actors: advanceAdventureActorStates(
            sceneId,
            sceneCharacterInteractions,
            currentRuntime.actors,
            elapsedMs,
            {
              playerPosition: currentSave.world.position,
              reducedMotion: false,
            },
          ),
        };
        actorRuntimeRef.current = nextRuntime;
        if (actorVisualStateChanged(currentRuntime.actors, nextRuntime.actors)) {
          setActorRuntime(nextRuntime);
        }
      }
      animationFrame = window.requestAnimationFrame(updateActors);
    }

    animationFrame = window.requestAnimationFrame(updateActors);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [
    anchoredActorStates,
    effectiveReducedMotion,
    movementPaused,
    pageVisible,
    sceneCharacterInteractions,
    sceneId,
    screen,
  ]);

  useEffect(() => {
    if (!boatMode) {
      boatMotionRef.current = null;
      return;
    }
    const current = saveRef.current;
    if (!current || current.world.sceneId !== sceneId) return;
    const initial = {
      sceneId,
      ...createBoatMotionState({
        position: current.world.position,
        heading: getContinuousBoatHeading(null, current.world.facing),
      }),
      throttle: 0,
      rudder: 0,
    };
    boatMotionRef.current = initial;
    setBoatTelemetry(initial);
    setMovementActive(false);
  }, [boatMode, gameSave?.profileId, sceneId, setMovementActive]);

  useEffect(() => {
    if (movementPaused || !isMoving) return undefined;

    let animationFrame = 0;
    let previousTime = null;

    function updateMovement(timestamp) {
      const elapsedMs = previousTime === null ? 0 : Math.min(timestamp - previousTime, 50);
      previousTime = timestamp;
      if (elapsedMs > 0) {
        const current = saveRef.current;
        if (current?.world.sceneId !== sceneId) return;
        let next;
        let nextFacing;

        if (boatMode) {
          const controls = boatControlInput(
            keyboardDirectionsRef.current,
            touchDirectionsRef.current,
          );
          const existing = boatMotionRef.current?.sceneId === sceneId
            ? boatMotionRef.current
            : {
                sceneId,
                ...createBoatMotionState({
                  position: current.world.position,
                  heading: getContinuousBoatHeading(null, current.world.facing),
                }),
                throttle: 0,
                rudder: 0,
              };
          const motion = stepBoatMotion(
            { ...existing, position: current.world.position },
            controls,
            elapsedMs,
            {
              maxForwardSpeed: scene.movement?.speed ?? BOAT_MOTION_DEFAULTS.maxForwardSpeed,
              maxStepDistance: scene.movement?.maxStepDistance ?? BOAT_MOTION_DEFAULTS.maxStepDistance,
              canOccupy: (candidate) => canOccupyContinuousPosition(
                sceneId,
                candidate,
                scene.movement?.radius ?? 0.28,
              ),
            },
          );
          next = motion.position;
          nextFacing = getBoatFacingFromHeading(motion.heading);
          boatMotionRef.current = { sceneId, ...motion };
          const traveled = Math.hypot(
            next.x - current.world.position.x,
            next.y - current.world.position.y,
          );
          setBoatTelemetry((previous) => ({
            sceneId,
            ...motion,
            collided: motion.collided || (
              previous.sceneId === sceneId
              && previous.collided
              && controls.throttle >= 0
              && traveled < 0.01
            ),
          }));
          setMovementActive(
            controls.throttle !== 0
            || controls.rudder !== 0
            || Math.abs(motion.speed) > BOAT_MOTION_DEFAULTS.stoppedSpeed,
          );
        } else {
          const movementInput = resolveAdventureMovementInput(overworldDirectionsRef.current);
          const { vector } = movementInput;
          if (vector.x === 0 && vector.y === 0) {
            setMovementActive(false);
            return;
          }
          nextFacing = movementInput.direction;
          next = movePlayerContinuous(
            sceneId,
            current.world.position,
            vector,
            elapsedMs,
            {
              speed: scene.movement?.speed ?? 3.6,
              radius: scene.movement?.radius ?? 0.22,
              maxStepDistance: scene.movement?.maxStepDistance ?? 0.08,
              dynamicBlockers: getAdventureActorBlockers(
                actorRuntimeRef.current?.sceneId === sceneId
                  ? actorRuntimeRef.current.actors
                  : anchoredActorStates,
              ),
              ignoreActorTiles: true,
            },
          );
        }
        const updated = {
          ...current,
          world: {
            ...current.world,
            position: next,
            facing: nextFacing,
          },
        };
        const doorway = getDoorwayTransition(sceneId, next, nextFacing);
        if (
          doorway?.interactionId === "interaction-player-home-exit"
          && getElversonPrologueProgress(updated).needsHomeSequence
        ) {
          clearMovement();
          const expected = getElversonPrologueProgress(updated).homeConversation;
          setSaveNotice({
            kind: "info",
            message: expected?.trainerId === "player-dad"
              ? "Check with Dad before heading into town."
              : "Finish talking with your family before heading into town.",
          });
          return;
        }
        if (doorway && requestSceneTransition(doorway, updated)) return;

        if (
          next.x !== current.world.position.x
          || next.y !== current.world.position.y
          || nextFacing !== current.world.facing
        ) {
          saveRef.current = updated;
          setGameSave(updated);
          setDirty(true);
        }
      }

      animationFrame = window.requestAnimationFrame(updateMovement);
    }

    animationFrame = window.requestAnimationFrame(updateMovement);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [anchoredActorStates, boatMode, isMoving, movementPaused, requestSceneTransition, scene, sceneId, setDirty, setMovementActive]);

  useEffect(() => {
    if (movementPaused) {
      if (vehicleMode || boatMode) clearMovement();
      else setMovementActive(false);
      return;
    }
    syncMovementActive();
  }, [boatMode, clearMovement, movementPaused, setMovementActive, syncMovementActive, vehicleMode]);

  function beginTouchDirection(direction) {
    if (movementPaused) return;
    touchDirectionsRef.current.add(direction);
    activateMovementIntent(`touch:${direction}`, direction);
    setGameSave((current) => {
      const currentScene = SCENES[current?.world?.sceneId];
      if (currentScene?.routeId || currentScene?.kind === "route") return current;
      if (!current || current.world.facing === direction) return current;
      const updated = { ...current, world: { ...current.world, facing: direction } };
      saveRef.current = updated;
      return updated;
    });
    setDirty(true);
    syncMovementActive();
  }

  function endTouchDirection(direction) {
    releaseMovementIntent(
      `touch:${direction}`,
      () => touchDirectionsRef.current.delete(direction),
    );
  }

  function openStarterSelection() {
    setSelectedStarterId(null);
    setStarterSelectionOpen(true);
  }

  function requestStarterCommit(starterDeckId) {
    const starter = getAdventureStarterDeck(starterDeckId);
    if (!starter) return;
    setConfirmation({
      title: `Choose ${starter.name}?`,
      message: `${starter.name} will become this adventure's permanent starter and active deck. This choice cannot be changed in this save.`,
      confirmLabel: "Choose this starter",
      onConfirm: () => {
        const current = saveRef.current ?? gameSave;
        if (!current) return;
        try {
          const committed = commitStarterSelection(current, starter.id);
          const manifest = PREBUILT_DECKS_BY_ID[starter.id];
          if (!manifest) throw new Error(`The ${starter.name} deck list is unavailable.`);
          const collection = reconcileStarterCollection(committed.save, manifest);
          const opening = recordElversonPrologueBeat(
            collection.save,
            ELVERSON_PROLOGUE_BEATS.starter,
          );
          saveRef.current = opening.save;
          setGameSave(opening.save);
          setDirty(true);
          persistSave(opening.save, { checkpointId: `starter-selected:${starter.id}` });
          setStarterSelectionOpen(false);
          setSelectedStarterId(null);
          setConversation((currentConversation) => ({
            ...currentConversation,
            trainerId: ACADEMY_MENTOR_ID,
            index: 0,
            mode: "starterConfirmed",
          }));
        } catch (error) {
          setSaveNotice({ kind: "error", message: error?.message ?? "That starter could not be selected." });
        }
      },
    });
  }

  function commitAdventureMutation(nextSave, checkpointId, message = null) {
    saveRef.current = nextSave;
    setGameSave(nextSave);
    setDirty(true);
    const saved = persistSave(nextSave, { checkpointId });
    if (message) {
      setSaveNotice({
        kind: saved.ok ? "info" : "error",
        message: saved.ok ? message : `${message} The new progress is playable but has not saved yet.`,
      });
    }
    return saved;
  }

  function saveFishingCatch(creatureId) {
    const current = saveRef.current ?? gameSave;
    if (!current) return null;
    try {
      const tutorialCatch = fishingSession?.tutorial === true;
      const result = tutorialCatch
        ? recordElversonHandNetTutorialCatch(current, creatureId)
        : recordElversonHandNetCatch(current, creatureId);
      const creatureName = cardsById[result.creature.cardId]?.name ?? result.creature.id;
      commitAdventureMutation(
        result.save,
        tutorialCatch
          ? `elverson-fishing-tutorial-complete:${result.creature.id}`
          : `elverson-fishing-catch:${result.progress.heldCount}`,
        tutorialCatch
          ? `${creatureName} completed Wyeth's practice lesson. Shallow-water hand-net collecting is now unlocked.`
          : `${creatureName} was added to your aquarium catches. Bring it to Mr. Easterling in the workshop.`,
      );
      if (tutorialCatch && result.progress.tutorialComplete) {
        setFishingSession((currentSession) => currentSession
          ? { ...currentSession, required: false }
          : currentSession);
      }
      return result;
    } catch (error) {
      setSaveNotice({
        kind: "error",
        message: error?.message ?? "That catch could not be recorded.",
      });
      return null;
    }
  }

  function restoreFishingActionFocus() {
    window.requestAnimationFrame(() => {
      worldActionRef.current?.focus({ preventScroll: true });
    });
  }

  function closeFishingSession() {
    if (!fishingSession) return;
    if (fishingSession.required) {
      setSaveNotice({
        kind: "info",
        message: "Complete Wyeth's practice catch before leaving the lesson.",
      });
      return;
    }
    setFishingRecastCue(null);
    setFishingSession(null);
    restoreFishingActionFocus();
  }

  function returnFishingSessionToShore(outcome = null) {
    if (!fishingSession) return;
    if (fishingSession.required) {
      setSaveNotice({
        kind: "info",
        message: "Complete Wyeth's practice catch before leaving the lesson.",
      });
      return;
    }

    if (
      !fishingSession.tutorial
      && ["caught", "escaped"].includes(outcome?.reason)
    ) {
      const current = saveRef.current ?? gameSave;
      setFishingRecastCue({
        profileId: current?.profileId ?? null,
        sceneId: current?.world.sceneId ?? sceneId,
        spotId: fishingSession.spotId,
        outcome: outcome.reason,
      });
    } else {
      setFishingRecastCue(null);
    }
    setFishingSession(null);
    restoreFishingActionFocus();
  }

  function registerForChampionsWake() {
    const current = saveRef.current ?? gameSave;
    if (!current) return;
    setTournamentRegistrationError(null);
    try {
      const registration = registerChampionsWakeTournament(current, cardsById);
      saveRef.current = registration.save;
      setGameSave(registration.save);
      setDirty(true);
      const saved = persistSave(registration.save, {
        checkpointId: `tournament-registered:${registration.lockedDeckSnapshot.fingerprint}`,
      });
      if (!saved.ok) {
        setTournamentRegistrationError({
          kind: "error",
          message: "Registration is active in this session, but its deck lock did not save. Keep this window open and retry Save game before entering the Arena.",
        });
        return;
      }
      setTournamentRegistrationOpen(false);
      setSaveNotice({
        kind: "info",
        message: `${registration.lockedDeckSnapshot.name} is registered for all three 30 VP rounds. The quarterfinal table is ready in the Arena.`,
      });
    } catch (error) {
      setTournamentRegistrationError({
        kind: "error",
        message: `${error?.message ?? "Registration could not be completed."} Your bracket and rewards are unchanged.`,
      });
    }
  }

  function saveChampionsWakeRegistration() {
    const current = saveRef.current ?? gameSave;
    if (!current) return;
    const saved = persistSave(current, {
      kind: "manual",
      checkpointId: "tournament-registration-retry",
    });
    if (saved.ok) {
      setTournamentRegistrationError(null);
      setSaveNotice({
        kind: "info",
        message: "The registered deck and current bracket round are safely saved.",
      });
    }
  }

  function advanceChampionshipEnding() {
    if (!championshipEndingStage) return;
    if (championshipEndingReplay) {
      setChampionshipEndingStage(null);
      setChampionshipEndingReplay(false);
      return;
    }
    const current = saveRef.current ?? gameSave;
    if (!current) return;
    const flagId = CHAMPIONSHIP_ENDING_FLAGS[championshipEndingStage];
    let next = setQuestFlag(current, CHAMPIONS_WAKE_QUEST_ID, flagId, true);
    let nextStage = null;
    if (championshipEndingStage === "ceremony") {
      const pavilion = SCENES["champions-wake-reflection-pavilion"];
      next = enterAdventureScene(next, {
        sceneId: pavilion.id,
        position: pavilion.spawn,
        facing: "up",
      });
      nextStage = "epilogue";
    } else if (championshipEndingStage === "epilogue") {
      nextStage = "credits";
    } else {
      next = setQuestFlag(next, CHAMPIONS_WAKE_QUEST_ID, CHAMPIONSHIP_ENDING_FLAGS.postgame, true);
    }
    const saved = commitAdventureMutation(
      next,
      `championship-ending:${championshipEndingStage}`,
      championshipEndingStage === "credits"
        ? "Postgame free travel and tournament practice rematches are now open."
        : null,
    );
    if (!saved.ok) {
      setSaveNotice({
        kind: "error",
        message: "This ending step is complete in your current session, but it did not save. Use Save game before leaving the page.",
      });
    }
    setChampionshipEndingStage(nextStage);
  }

  function beginEcosystemChapter(saveValue) {
    const chapter = getAdventureEcosystemChapterByTownId(saveValue.world.townId);
    return chapter ? chapter.begin(saveValue).save : saveValue;
  }

  function boardRoute(interactionValue) {
    const current = saveRef.current ?? gameSave;
    if (!current) return;
    try {
      const next = boardAdventureRoute(current, {
        routeId: interactionValue.routeId,
        originDockId: interactionValue.originDockId ?? interactionValue.dockId,
        mode: "manual",
      });
      commitAdventureMutation(next, `board:${interactionValue.routeId}`, "You cast off into the marked channel. Steer between the buoys and approach the opposite dock.");
    } catch (error) {
      const message = String(error?.message ?? "This voyage is not ready yet.");
      setSaveNotice({
        kind: "info",
        message: /first-voyage-quest-incomplete|prerequisite|quest/i.test(message)
          ? "The waters beyond Elverson are closed while we focus on getting the aquarium exhibit started."
          : message,
      });
    }
  }

  function dockRoute(interactionValue) {
    const current = saveRef.current ?? gameSave;
    if (!current) return;
    try {
      let next = dockAdventureRoute(current, {
        routeId: interactionValue.routeId,
        destinationDockId: interactionValue.destinationDockId ?? interactionValue.dockId,
        mode: "manual",
      });
      next = beginChampionsWakeQuestAtCurrentScene(next).save;
      next = beginEcosystemChapter(next);
      const arrivedChapter = getAdventureEcosystemChapterByTownId(next.world.townId);
      commitAdventureMutation(
        next,
        `dock:${interactionValue.routeId}:${next.world.lastSafeDockId}`,
        arrivedChapter
          ? `Welcome to ${arrivedChapter.ui.chapterName}. Your manual route is complete, and the ${arrivedChapter.ui.activityLabel} is ready.`
          : "Docking complete. Your last safe dock has been updated.",
      );
    } catch (error) {
      setSaveNotice({ kind: "error", message: error?.message ?? "The boat could not dock safely." });
    }
  }

  function autoSteerRoute(routeId, destinationDockId) {
    const current = saveRef.current ?? gameSave;
    if (!current) return;
    try {
      let next = autoSteerAdventureRoute(current, { routeId, destinationDockId });
      next = beginChampionsWakeQuestAtCurrentScene(next).save;
      next = beginEcosystemChapter(next);
      setWorldMapOpen(false);
      commitAdventureMutation(next, `auto-steer:${routeId}:${destinationDockId}`, "Auto-steer followed your previously completed route and docked safely.");
    } catch (error) {
      setSaveNotice({ kind: "error", message: error?.message ?? "Auto-steer could not start from this location." });
    }
  }

  function openFieldwork(interactionValue) {
    const chapter = getAdventureEcosystemChapterByQuestId(interactionValue.questId)
      ?? getAdventureEcosystemChapterByTownId((saveRef.current ?? gameSave)?.world?.townId);
    if (!chapter) {
      setSaveNotice({ kind: "error", message: "This ecosystem activity is not connected to a live chapter yet." });
      return;
    }
    setFieldworkFeedback(null);
    setFieldworkActivity({
      type: interactionValue.type,
      observationId: interactionValue.observationId ?? null,
      interactionId: interactionValue.interactionId,
      questId: chapter.questId,
    });
  }

  function submitFieldworkChoice(choiceId) {
    const current = saveRef.current ?? gameSave;
    if (!current || !fieldworkActivity) return;
    try {
      const chapter = getAdventureEcosystemChapterByQuestId(fieldworkActivity.questId);
      if (!chapter) throw new Error("This ecosystem activity is not connected to a live chapter.");
      const result = fieldworkActivity.type === "observation"
        ? chapter.recordObservation(current, choiceId)
        : fieldworkActivity.type === "interpretation"
          ? chapter.submitInterpretation(current, choiceId)
          : chapter.submitResponse(current, choiceId);
      commitAdventureMutation(result.save, `${chapter.ui.fieldworkCheckpointPrefix}:${fieldworkActivity.type}:${choiceId}`);
      setFieldworkFeedback({
        correct: result.correct ?? true,
        message: result.feedback ?? "That fieldwork step has been recorded.",
      });
    } catch (error) {
      setFieldworkFeedback({ correct: false, message: error?.message ?? "That field observation could not be recorded." });
    }
  }

  function launchTrenchlightSub() {
    const current = saveRef.current ?? gameSave;
    if (!current) return;
    const chapter = getAdventureEcosystemChapterByTownId("trenchlight-station");
    const questFlags = current.progression.quests[chapter?.questId]?.flags ?? {};
    if (!chapter || !hasMetAdventureEcosystemGuide(chapter, current)) {
      setSaveNotice({
        kind: "info",
        message: chapter?.ui.guideGateNotice ?? "Meet Luz before beginning the Trenchlight expedition.",
      });
      return;
    }
    if (questFlags[chapter.ui.fieldPartnerMetFlagId] !== true) {
      setSaveNotice({
        kind: "info",
        message: "Talk with Dr. Hana Okoye before launch. She will review the ordered instrument stops, expert-pilot controls, abort criteria, and safe return plan.",
      });
      return;
    }
    try {
      const launched = launchTrenchlightExpedition(current);
      setSubFeedback({
        correct: true,
        message: launched.leg === "survey"
          ? "Dr. Hana has begun the guided descent. Start with the calibrated light meter; each station unlocks in evidence order."
          : "Dr. Hana has returned to the marked sensor site. Compare every recovery instruction before confirming the crew's approach.",
      });
      commitAdventureMutation(
        launched.save,
        `trenchlight-expedition-launch:${launched.leg}`,
        launched.leg === "survey"
          ? "The expert-piloted survey leg has launched."
          : "The expert-piloted recovery leg has launched.",
      );
    } catch (error) {
      setSaveNotice({ kind: "info", message: error?.message ?? "The guided sub is not ready to launch yet." });
    }
  }

  function operateTrenchlightInstrument(actionId) {
    const current = saveRef.current ?? gameSave;
    if (!current) return;
    try {
      const result = advanceTrenchlightExpedition(current, actionId, {
        assistedMode: subAssistedMode,
      });
      setSubFeedback({
        correct: result.correct,
        message: result.feedback ?? (result.applied
          ? "The expedition record has been updated."
          : "That instrument is not the next step in the ordered survey."),
      });

      if (!result.applied) return;
      if (result.shouldReturnToStation) {
        const returned = returnTrenchlightExpeditionToStation(result.save);
        const needsAnalysis = result.state.phase === "analysis-required";
        commitAdventureMutation(
          returned.save,
          needsAnalysis
            ? "trenchlight-survey-returned-for-analysis"
            : "trenchlight-sensor-recovery-returned",
          needsAnalysis
            ? "All four survey records are secure. The sub returned safely; compare them at the Mission Control interpretation console."
            : "The sensor is secure and the observed habitat remains undisturbed. The sub returned safely for debrief.",
        );
        setSubFeedback(null);
        return;
      }
      commitAdventureMutation(
        result.save,
        `trenchlight-expedition-action:${actionId}`,
      );
    } catch (error) {
      setSubFeedback({
        correct: false,
        message: error?.message ?? "That expedition control could not be used at this station.",
      });
    }
  }

  function returnTrenchlightSubToStation() {
    const current = saveRef.current ?? gameSave;
    if (!current) return;
    try {
      const returned = returnTrenchlightExpeditionToStation(current);
      if (!returned.applied) return;
      setSubFeedback(null);
      commitAdventureMutation(
        returned.save,
        "trenchlight-voluntary-safe-return",
        "The expert pilot returned to Mission Control safely. No progress or reward was lost; relaunch when you are ready.",
      );
    } catch (error) {
      setSubFeedback({ correct: false, message: error?.message ?? "Mission Control could not complete the safe return." });
    }
  }

  function interact() {
    if (screen !== "playing" || openingFreeRoamLocked || openingPrelude || momGreetingStage || bestFriendSequence || dockCutscenePhase || pauseOpen || settingsOpen || conversation || conversationLeadIn || activeTrainerId || sceneTransition || guidedWalk || starterSelectionOpen || fieldNoteOpen || inventoryOpen || decksOpen || worldMapOpen || fieldworkActivity || fishingSession || showCompletion || tournamentRegistrationOpen || championshipEndingStage || newsletterInviteOpen || !interaction || !gameSave) return;
    clearMovement();
    const worldConversationOrigin = ["trainer", "npc"].includes(interaction.type)
      ? { sceneId, interactionId: interaction.interactionId }
      : null;
    const beginWorldConversation = (nextConversation) => {
      if (worldConversationOrigin) {
        const currentRuntime = actorRuntimeRef.current?.sceneId === sceneId
          ? actorRuntimeRef.current
          : { sceneId, actors: anchoredActorStates };
        const focusedRuntime = {
          sceneId,
          actors: focusAdventureActor(
            currentRuntime.actors,
            worldConversationOrigin.interactionId,
            position,
          ),
        };
        actorRuntimeRef.current = focusedRuntime;
        setActorRuntime(focusedRuntime);
      }
      setConversationLeadIn({ ...nextConversation, ...worldConversationOrigin });
    };
    if (interaction.type === "fishing") {
      const currentFishingProgress = getElversonHandNetProgress(saveRef.current ?? gameSave);
      if (!currentFishingProgress.canCatchWithHandNet) {
        setSaveNotice({
          kind: "info",
          message: currentFishingProgress.hasHandNet
            ? "Return to Fisherman Wyeth at the sandy cove. He will stay with you until you make the required practice catch."
            : "Find Fisherman Wyeth at the wharf. He has a hand net and a hands-on shallow-water lesson for you.",
        });
        return;
      }
      const startWithCast = interaction.recastReady === true;
      setFishingRecastCue(null);
      setFishingSession({
        tutorial: false,
        spotId: interaction.spotId,
        startWithCast,
      });
      return;
    }
    if (interaction.type === "sub-launch") {
      launchTrenchlightSub();
      return;
    }
    if (interaction.type === "board") {
      boardRoute(interaction);
      return;
    }
    if (interaction.type === "dock") {
      dockRoute(interaction);
      return;
    }
    if (["observation", "interpretation", "response"].includes(interaction.type)) {
      const current = saveRef.current ?? gameSave;
      const chapter = getAdventureEcosystemChapterByQuestId(interaction.questId)
        ?? getAdventureEcosystemChapterByTownId(current.world.townId);
      if (!chapter) {
        setSaveNotice({ kind: "error", message: "This ecosystem activity is not connected to a live chapter yet." });
        return;
      }
      if (!hasMetAdventureEcosystemGuide(chapter, current)) {
        setSaveNotice({ kind: "info", message: chapter.ui.guideGateNotice });
        return;
      }
      const progress = chapter.getProgress(current);
      if (interaction.type === "interpretation" && progress.missingObservationIds.length) {
        setSaveNotice({
          kind: "info",
          message: `${chapter.ui.interpretationGateNotice} ${progress.missingObservationIds.length} station${progress.missingObservationIds.length === 1 ? " remains" : "s remain"}.`,
        });
        return;
      }
      if (interaction.type === "response" && !progress.interpretation.correct) {
        setSaveNotice({ kind: "info", message: chapter.ui.responseGateNotice });
        return;
      }
      openFieldwork(interaction);
      return;
    }
    if (interaction.tournamentAction === "registration") {
      const current = saveRef.current ?? gameSave;
      const begun = beginChampionsWakeQuestAtCurrentScene(current);
      if (begun.applied) {
        commitAdventureMutation(
          begun.save,
          "champions-wake-arrival",
          "Champion's Wake has entered your voyage record. Director Vela is ready to review registration.",
        );
      }
      const progressState = getChampionsWakeTournamentProgress(begun.save);
      beginWorldConversation({
        trainerId: interaction.npcId,
        index: 0,
        mode: progressState.complete
          ? "postgame"
          : progressState.status === "active"
            ? "roundReady"
            : getChampionsWakeTournamentAvailability(begun.save).requirementsMet
              ? "registration"
              : "guidance",
      });
      return;
    }
    if (interaction.tournamentAction === "epilogue") {
      const progressState = getChampionsWakeTournamentProgress(saveRef.current ?? gameSave);
      if (progressState.complete) {
        const flags = progressState.save.progression.quests[CHAMPIONS_WAKE_QUEST_ID]?.flags ?? {};
        const unfinishedStage = ["ceremony", "epilogue", "credits"]
          .find((stage) => flags[CHAMPIONSHIP_ENDING_FLAGS[stage]] !== true);
        setChampionshipEndingReplay(!unfinishedStage);
        setChampionshipEndingStage(unfinishedStage ?? "epilogue");
      } else {
        beginWorldConversation({
          trainerId: interaction.npcId,
          index: 0,
          mode: progressState.status === "active" ? "guidance" : "intro",
        });
      }
      return;
    }
    if (interaction.type === "trainer" || interaction.type === "npc") {
      const trainerId = interaction.trainerId ?? interaction.npcId;
      const trainer = TRAINERS[trainerId];
      if (!trainer) return;
      if (
        sceneId === ELVERSON_PROLOGUE_HOME_SCENE_ID
        && ELVERSON_HOME_OPENING_TRAINER_IDS.has(trainerId)
        && !prologueProgress?.legacySkipped
        && !prologueProgress?.complete
      ) {
        const expectedConversation = prologueProgress?.homeConversation;
        if (expectedConversation?.trainerId === trainerId) {
          beginWorldConversation({
            ...expectedConversation,
            openingBeatId: prologueProgress.nextBeatId,
            index: 0,
          });
        } else {
          const expectedName = TRAINERS[expectedConversation?.trainerId]?.name;
          beginWorldConversation({
            trainerId,
            index: 0,
            mode: "guidance",
            lines: expectedName
              ? [`Let's hear what ${expectedName} has to say first. This is a big morning, and nobody wants you to miss a thing.`]
              : [...(trainer.dialogue?.guidance ?? trainer.dialogue?.return ?? [])],
          });
        }
        return;
      }
      if (trainerId === FISHERMAN_WYETH_ID) {
        const current = saveRef.current ?? gameSave;
        beginWorldConversation({
          trainerId,
          index: 0,
          mode: getElversonHandNetConversationMode(current),
        });
        return;
      }
      if (trainerId === ACADEMY_MENTOR_ID) {
        const current = saveRef.current ?? gameSave;
        const currentFishingProgress = getElversonHandNetProgress(current);
        if (currentFishingProgress.heldCount > 0) {
          const catchNames = currentFishingProgress.creatures
            .filter((creature) => creature.held > 0)
            .map((creature) => cardsById[creature.cardId]?.name ?? creature.id);
          beginWorldConversation({
            trainerId,
            index: 0,
            mode: "fishingTurnIn",
            lines: [
              `You brought ${currentFishingProgress.heldCount} ${currentFishingProgress.heldCount === 1 ? "creature" : "creatures"} from the shore: ${catchNames.join(", ")}.`,
              ...(trainer.dialogue?.fishingTurnIn ?? []),
            ],
          });
          return;
        }
        const progress = getOnboardingProgress(current);
        beginWorldConversation({
          trainerId,
          index: 0,
          mode: progress.needsStarterSelection
            ? "registration"
            : progress.needsBoatSafetyReview
              ? "boatSafety"
              : progress.tutorialComplete
                ? "rematch"
                : "tutorialIntro",
        });
        return;
      }
      if (trainer.encounterId && trainer.townId === "shellshore-village" && !onboardingProgress?.tutorialComplete) {
        beginWorldConversation({
          trainerId,
          index: 0,
          mode: "onboardingGate",
          lines: [
            "Mr. Easterling asked me to wait until your aquarium lesson is complete.",
            "Choose your starter and finish Mr. Easterling's guided strategy lesson, then come challenge me!",
          ],
        });
        return;
      }
      if (!trainer.encounterId) {
        const current = saveRef.current ?? gameSave;
        if (trainer.townId === "shellshore-village") {
          const returning = residentConversationSeenRef.current.has(trainerId);
          residentConversationSeenRef.current.add(trainerId);
          beginWorldConversation({
            trainerId,
            index: 0,
            mode: returning ? "return" : "intro",
            lines: returning
              ? [...(trainer.dialogue?.return ?? trainer.dialogue?.guidance ?? [])]
              : [
                  ...(trainer.dialogue?.intro ?? []),
                  ...(trainer.dialogue?.guidance ?? []),
                ],
          });
          return;
        }
        if (trainer.townId === "champions-wake") {
          const progressState = getChampionsWakeTournamentProgress(current);
          beginWorldConversation({
            trainerId,
            index: 0,
            mode: progressState.complete ? "postgame" : progressState.status === "active" ? "guidance" : "intro",
          });
          return;
        }
        const chapter = getAdventureEcosystemChapterByTownId(trainer.townId);
        const progress = chapter?.getProgress(current) ?? null;
        const mode = chapter
          ? getAdventureEcosystemConversationMode(chapter, trainer.roleId, current, progress)
          : "guidance";
        beginWorldConversation({ trainerId, index: 0, mode });
        return;
      }
      const availability = isAdventureEncounterAvailable(saveRef.current ?? gameSave, trainer.encounterId);
      if (!availability.available) {
        beginWorldConversation({
          trainerId,
          index: 0,
          mode: "locked",
          lines: [...(trainer.intro ?? []), availability.reason],
        });
        return;
      }
      beginWorldConversation({
        trainerId,
        index: 0,
        mode: trainer.townId === "champions-wake"
          ? availability.practiceOnly ? "postgame" : "roundReady"
          : "challenge",
      });
      return;
    }
  }

  interactRef.current = interact;

  function advanceConversation() {
    if (!conversation) return;
    const trainer = TRAINERS[conversation.trainerId];
    const lines = conversationLines(
      conversation,
      trainer,
      defeated.has(trainer.encounterId),
      dialogueIdentity,
    );
    setConversation((current) => ({
      ...current,
      index: Math.min(current.index + 1, lines.length - 1),
    }));
  }

  function closeConversation() {
    const trainer = conversation ? TRAINERS[conversation.trainerId] : null;
    const wasResidentVictory = conversation?.mode === "victory"
      && trainer
      && SHELLSHORE_ENCOUNTER_IDS.includes(trainer.encounterId);
    setConversation(null);
    if (wasResidentVictory && SHELLSHORE_ENCOUNTER_IDS.every((encounterId) => defeated.has(encounterId))) {
      setShowCompletion(true);
    }
  }

  function launchDuel(trainerId, playerDeckSnapshot) {
    duelResultRef.current = null;
    activeDuelConversationOriginRef.current = conversation?.sceneId && conversation?.interactionId
      ? { sceneId: conversation.sceneId, interactionId: conversation.interactionId }
      : null;
    setPostDuelConversation(null);
    setActiveDuelDeckSnapshot(playerDeckSnapshot);
    setActiveTrainerId(trainerId);
    setConversation(null);
  }

  function startDuel(trainerKeyOverride = null) {
    const current = saveRef.current ?? gameSave;
    if (!conversation || !current) return;
    clearMovement();
    const trainerKey = trainerKeyOverride ?? conversation.trainerId;
    const trainer = TRAINERS[trainerKey];
    const progress = getOnboardingProgress(current);
    if (trainer.id === ACADEMY_MENTOR_ID && progress.needsStarterSelection) {
      openStarterSelection();
      return;
    }
    if (trainer.id !== ACADEMY_MENTOR_ID && !progress.tutorialComplete) {
      setSaveNotice({ kind: "info", message: "Finish Mr. Easterling's aquarium lesson before challenging Elverson residents." });
      closeConversation();
      return;
    }
    if (trainer.id !== ACADEMY_MENTOR_ID) {
      const availability = isAdventureEncounterAvailable(current, trainer.encounterId);
      if (!availability.available) {
        setSaveNotice({ kind: "info", message: availability.reason });
        closeConversation();
        return;
      }
    }
    const tournamentRound = trainer.townId === "champions-wake"
      && CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS.includes(trainer.encounterId);
    const progressState = tournamentRound
      ? getChampionsWakeTournamentProgress(current)
      : null;
    if (tournamentRound && progressState?.status === "active") {
      try {
        const launch = getChampionsWakeTournamentLaunch(current);
        if (launch.encounterId !== trainer.encounterId || launch.opponentId !== trainer.id) {
          setSaveNotice({
            kind: "info",
            message: "The bracket steward is holding this table. Meet the highlighted opponent for your next round.",
          });
          closeConversation();
          return;
        }
        const checkpoint = persistSave(progressState.save, {
          checkpointId: `before-tournament-round:${launch.encounterId}`,
        });
        if (!checkpoint.ok) {
          setSaveNotice({
            kind: "error",
            message: "The required pre-round checkpoint could not be saved. Your bracket is unchanged; retry Save game before starting this round.",
          });
          setConversation(null);
          return;
        }
        launchDuel(trainerKey, launch.playerDeckSnapshot);
      } catch (error) {
        setSaveNotice({
          kind: "error",
          message: error?.message ?? "The registered tournament round could not be prepared safely.",
        });
        setConversation(null);
      }
      return;
    }
    let playerDeckSnapshot;
    try {
      playerDeckSnapshot = createActiveDuelDeckSnapshot(current, cardsById);
    } catch (error) {
      setSaveNotice({
        kind: "error",
        message: `${error?.message ?? "Your active deck is not ready for a duel."} Open the Deck Workshop and choose a legal 60-card deck.`,
      });
      setConversation(null);
      setPauseOpen(false);
      setDecksOpen(true);
      return;
    }
    const checkpoint = persistSave(current, {
      checkpointId: `before-duel:${trainer.encounterId}`,
    });
    if (!checkpoint.ok) {
      setConfirmation({
        title: "Start without a duel checkpoint?",
        message: "The game could not save immediately before this duel. You may retry from the pause menu or continue knowing the latest checkpoint is unchanged.",
        confirmLabel: "Start duel",
        onConfirm: () => launchDuel(trainerKey, playerDeckSnapshot),
      });
      return;
    }
    launchDuel(trainerKey, playerDeckSnapshot);
  }

  function acceptValidDuelResult(result) {
    duelResultRef.current = result;
    setNewsletterInviteEligible(true);
  }

  function recordDuelResult(trainerId, result) {
    if (duelResultRef.current) return;
    const trainer = TRAINERS[trainerId];
    const current = saveRef.current ?? gameSave;
    if (!trainer || !current) return;
    const tournamentRound = trainer.townId === "champions-wake"
      && CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS.includes(trainer.encounterId);
    const tournamentState = tournamentRound
      ? getChampionsWakeTournamentProgress(current)
      : null;
    if (tournamentRound && tournamentState?.status === "active") {
      try {
        const recorded = recordChampionsWakeTournamentResult(current, result);
        acceptValidDuelResult(result);
        saveRef.current = recorded.save;
        setGameSave(recorded.save);
        setDirty(true);
        const saved = persistSave(recorded.save, {
          checkpointId: `tournament-result:${recorded.roundId}:${recorded.outcome}`,
        });
        const loss = result.outcome !== "victory";
        setSaveNotice({
          kind: saved.ok ? "info" : "error",
          message: saved.ok
            ? loss
              ? "The attempt is recorded. Your round, registered deck, cards, and rewards are unchanged; retry whenever you are ready."
              : recorded.tournamentComplete
                ? "All three 30 VP wins are recorded. The Championship Ceremony is ready."
                : "Round victory saved. The same registered deck is ready for the next 30 VP match."
            : "The result is safe in this session but did not reach storage. Save from the pause menu before continuing.",
        });
        setPostDuelConversation({
          trainerId,
          index: 0,
          mode: loss ? "defeat" : "roundVictory",
        });
      } catch (error) {
        setSaveNotice({
          kind: "error",
          message: `${error?.message ?? "The tournament result could not be recorded."} No bracket progress or rewards were changed.`,
        });
      }
      return;
    }
    if (tournamentRound && tournamentState?.complete) {
      try {
        assertAdventureDuelResultMatchesLaunch(result, {
          encounterId: trainer.encounterId,
          opponentId: trainer.id,
          opponentDeckId: trainer.deckId,
          victoryTarget: trainer.victoryTarget,
          playerDeckSnapshot: activeDuelDeckSnapshot,
        });
        const recorded = recordAdventureDuelResult(current, result);
        acceptValidDuelResult(result);
        saveRef.current = recorded.save;
        setGameSave(recorded.save);
        setDirty(true);
        const saved = persistSave(recorded.save, {
          checkpointId: `postgame-practice:${trainer.encounterId}:${result.outcome}`,
        });
        setSaveNotice({
          kind: saved.ok ? "info" : "error",
          message: saved.ok
            ? "Practice result saved. The completed bracket, archived deck, Cup, and rewards were not changed."
            : "The practice result did not save, but your completed bracket and rewards remain safe.",
        });
        setPostDuelConversation({
          trainerId,
          index: 0,
          mode: result.outcome === "victory" ? "postgame" : "defeat",
        });
      } catch (error) {
        setSaveNotice({
          kind: "error",
          message: `${error?.message ?? "The practice result could not be recorded."} The championship bracket was not changed.`,
        });
      }
      return;
    }
    try {
      assertAdventureDuelResultMatchesLaunch(result, {
        encounterId: trainer.encounterId,
        opponentId: trainer.id,
        opponentDeckId: trainer.deckId,
        victoryTarget: trainer.victoryTarget,
        playerDeckSnapshot: activeDuelDeckSnapshot,
      });
    } catch {
      setSaveNotice({
        kind: "error",
        message: "The duel result did not match the locked deck snapshot, so no story progress or rewards were changed.",
      });
      return;
    }
    let recordedAttempt;
    const wasEncounterCompleted = current.progression.completedEncounterIds.includes(
      trainer.encounterId,
    );
    try {
      recordedAttempt = recordAdventureDuelResult(current, result);
    } catch (error) {
      setSaveNotice({
        kind: "error",
        message: `${error?.message ?? "The duel result could not be recorded."} No story progress or rewards were changed.`,
      });
      return;
    }
    const resultSave = recordedAttempt.save;
    acceptValidDuelResult(result);
    if (trainer.id === ACADEMY_MENTOR_ID) {
      const practicedEverySkill = ["readyToTurnIn", "complete"].includes(resultSave.tutorial?.status);
      const reachedPracticeTarget = practicedEverySkill
        && isStoryDuelVpTargetVictory(result, {
          encounterId: trainer.encounterId,
          victoryTarget: trainer.victoryTarget,
        });
      const outcome = reachedPracticeTarget ? "won" : "lost";
      try {
        const resolved = recordPracticeDuelResult(resultSave, outcome);
        const opening = outcome === "won"
          ? recordElversonPrologueBeat(
              resolved.save,
              ELVERSON_PROLOGUE_BEATS.tutorial,
            )
          : { save: resolved.save };
        saveRef.current = opening.save;
        setGameSave(opening.save);
        setDirty(true);
        persistSave(opening.save, { checkpointId: `duel-result:${trainer.encounterId}` });
        if (outcome === "won") {
          setPostDuelConversation({ trainerId, index: 0, mode: "victory" });
        } else {
          setPostDuelConversation({
            trainerId,
            index: 0,
            mode: result.outcome === "victory" ? "practiceRetry" : "practiceLoss",
          });
        }
      } catch (error) {
        setSaveNotice({ kind: "error", message: error?.message ?? "The practice result could not be recorded." });
        setPostDuelConversation({ trainerId, index: 0, mode: "practiceRetry" });
      }
      return;
    }
    if (result.outcome !== "victory") {
      saveRef.current = resultSave;
      setGameSave(resultSave);
      setDirty(true);
      persistSave(resultSave, { checkpointId: `duel-result:${trainer.encounterId}` });
      return;
    }
    const next = completeAdventureEncounter(resultSave, {
      encounterId: trainer.encounterId,
      opponentId: trainer.id,
      chapterEncounterIds: trainer.townId === "shellshore-village" ? SHELLSHORE_ENCOUNTER_IDS : [],
    });
    const awardedPacks = Object.entries(next.inventory.unopenedPacks)
      .filter(([packId, quantity]) => quantity > (resultSave.inventory.unopenedPacks[packId] ?? 0))
      .map(([packId, quantity]) => ({
        packId,
        quantity: quantity - (resultSave.inventory.unopenedPacks[packId] ?? 0),
      }));
    saveRef.current = next;
    setGameSave(next);
    setDirty(true);
    const saved = persistSave(next, { checkpointId: `duel-result:${trainer.encounterId}` });
    if (awardedPacks.length) {
      const packNames = awardedPacks
        .map(({ packId, quantity }) => `${quantity} ${PACK_POOLS_BY_ID[packId]?.name ?? "booster pack"}`)
        .join(" and ");
      setSaveNotice({
        kind: saved.ok ? "info" : "error",
        message: saved.ok
          ? `${trainer.name} awarded you ${packNames}. Open it from the pause menu's Inventory.`
          : `${trainer.name} awarded you ${packNames}, but the reward has not saved yet. Retry Save game from the pause menu.`,
      });
    }
    setPostDuelConversation({
      trainerId,
      index: 0,
      mode: trainer.encounterId === "encounter-sunpatch-exhibition"
        ? "exhibitionVictory"
        : !wasEncounterCompleted
          ? "victory"
          : "rematch",
    });
  }

  function recordSimulatorTutorialCheckpoint(event) {
    const current = saveRef.current ?? gameSave;
    if (!current || !event?.checkpointId) return;
    try {
      const recorded = recordTutorialCheckpoint(current, event.checkpointId);
      if (!recorded.advanced) return;
      saveRef.current = recorded.save;
      setGameSave(recorded.save);
      setDirty(true);
      persistSave(recorded.save, { checkpointId: `tutorial:${event.checkpointId}` });
    } catch (error) {
      setSaveNotice({ kind: "error", message: error?.message ?? "That tutorial step could not be saved." });
    }
  }

  function exitDuel(trainerId) {
    const trainer = TRAINERS[trainerId];
    if (trainer?.id === ACADEMY_MENTOR_ID && !duelResultRef.current) {
      const current = saveRef.current ?? gameSave;
      if (current) {
        try {
          recordPracticeDuelResult(current, "exited");
        } catch {
          // Exiting is always safe; malformed recovery is handled on the next load.
        }
      }
      setPostDuelConversation({ trainerId, index: 0, mode: "practiceExit" });
    }
    setActiveTrainerId(null);
    setActiveDuelDeckSnapshot(null);
  }

  function acknowledgeFieldNote() {
    const current = saveRef.current ?? gameSave;
    if (!current) {
      setFieldNoteOpen(false);
      return;
    }
    try {
      const reviewed = recordBoatSafetyReview(current);
      if (reviewed.applied) {
        const reconciled = reconcileAdventureProgression(reviewed.save);
        commitAdventureMutation(reconciled, "boat-safety-reviewed");
      }
      setFieldNoteOpen(false);
    } catch (error) {
      setSaveNotice({
        kind: "error",
        message: error?.message ?? "The safety review could not be saved.",
      });
    }
  }

  function handleConversationPrimary() {
    if (!conversation) return;
    const trainer = TRAINERS[conversation.trainerId];
    if (!trainer) return;
    if (conversation.openingBeatId) {
      if (
        conversation.openingBeatId === ELVERSON_PROLOGUE_BEATS.race
        && conversation.escortToDock
      ) {
        const plan = createGuidedWalkPlan({
          path: ELVERSON_BEST_FRIEND_DOCK_WALK.leader,
          followerPath: ELVERSON_BEST_FRIEND_DOCK_WALK.follower,
          speed: 2.45,
          followerDelayMs: 420,
          reducedMotion: effectiveReducedMotion,
          reducedMotionSpeed: 6,
        });
        clearMovement();
        bestFriendWalkClockRef.current = null;
        setBestFriendWalkSample(sampleGuidedWalk(plan, 0));
        setConversation(null);
        setBestFriendSequence({ phase: "escorting", plan });
        return;
      }
      const current = saveRef.current ?? gameSave;
      if (!current) return;
      try {
        const recorded = recordElversonPrologueBeat(
          current,
          conversation.openingBeatId,
        );
        if (recorded.applied) {
          commitAdventureMutation(
            recorded.save,
            `elverson-opening:${conversation.openingBeatId}`,
            conversation.openingBeatId === ELVERSON_PROLOGUE_BEATS.rivalDeparture
              ? `${dialogueIdentity.bestFriendName} has set out for Pelora City. The race to Master of the Sea is underway.`
              : null,
          );
        }

        if (conversation.openingBeatId === ELVERSON_PROLOGUE_BEATS.rivalDeparture) {
          setConversation(null);
          setActiveFieldNoteId(SHELLSHORE_FIELD_NOTE.id);
          setFieldNoteOpen(true);
          return;
        }

        if (conversation.openingBeatId === ELVERSON_PROLOGUE_BEATS.race) {
          setSaveNotice({
            kind: "info",
            message: "The whole town is gathering at the waterfront. Explore Elverson, then approach the central dock for Mr. Easterling's kickoff.",
          });
        }
        setConversation(null);
      } catch (error) {
        setSaveNotice({
          kind: "error",
          message: error?.message ?? "The Elverson opening checkpoint could not be recorded.",
        });
      }
      return;
    }
    if (trainer.id !== ACADEMY_MENTOR_ID) {
      if (!trainer.encounterId) {
        const current = saveRef.current ?? gameSave;
        if (!current) return;
        if (trainer.id === FISHERMAN_WYETH_ID) {
          if (["fishingLesson", "fishingPractice"].includes(conversation.mode)) {
            try {
              const lesson = beginElversonHandNetTutorial(current);
              const lessonProgress = getElversonHandNetProgress(lesson.save);
              commitAdventureMutation(
                lesson.save,
                "elverson-fishing-tutorial-started",
                lesson.handNetGranted
                  ? "Wyeth's hand net was added to Project Gear. Follow him to the sandy practice cove."
                  : "Wyeth is leading you to the sandy practice cove for the required first catch.",
              );
              setConversation(null);
              if (lessonProgress.tutorialComplete) {
                setSaveNotice({ kind: "info", message: "Wyeth restored your hand net. Your completed lesson remains recorded." });
                return;
              }
              const walkStarted = startElversonHandNetGuidedWalk(lesson.save);
              if (!walkStarted) {
                setFishingSession({ ...ELVERSON_FISHING_TUTORIAL_SESSION });
              }
            } catch (error) {
              setSaveNotice({
                kind: "error",
                message: error?.message ?? "Wyeth could not begin the hand-net lesson.",
              });
            }
            return;
          }
          closeConversation();
          return;
        }
        if (trainer.townId === "shellshore-village") {
          closeConversation();
          return;
        }
        if (trainer.roleId === "tournament-director") {
          setConversation(null);
          setTournamentRegistrationError(null);
          setTournamentRegistrationOpen(true);
          return;
        }
        if (trainer.townId === "champions-wake") {
          closeConversation();
          return;
        }
        const chapter = getAdventureEcosystemChapterByTownId(trainer.townId);
        if (trainer.roleId === "local-guide" && conversation.mode === "intro") {
          if (!chapter) {
            setSaveNotice({ kind: "error", message: "This guide's ecosystem chapter is not available yet." });
            closeConversation();
            return;
          }
          const started = chapter.begin(current);
          const greeted = setQuestFlag(started.save, started.progress.questId, chapter.guideMetFlagId, true);
          commitAdventureMutation(greeted, chapter.ui.guideStartCheckpointId, chapter.ui.guideStartNotice);
          closeConversation();
          return;
        }
        if (trainer.roleId === "field-partner" && conversation.mode === "intro") {
          if (!chapter) {
            setSaveNotice({ kind: "error", message: "This field partner's ecosystem chapter is not available yet." });
            closeConversation();
            return;
          }
          const started = chapter.begin(current);
          const welcomed = setQuestFlag(
            started.save,
            started.progress.questId,
            chapter.ui.fieldPartnerMetFlagId,
            true,
          );
          commitAdventureMutation(
            welcomed,
            chapter.ui.fieldPartnerIntroCheckpointId,
            chapter.ui.fieldPartnerIntroNotice,
          );
          closeConversation();
          return;
        }
        if (trainer.roleId === "field-partner" && conversation.mode === "debrief") {
          try {
            if (!chapter) throw new Error("This field report is not connected to a live ecosystem chapter.");
            const turnedIn = chapter.turnIn(current);
            commitAdventureMutation(turnedIn.save, chapter.ui.turnInCheckpointId, chapter.ui.turnInNotice);
            setConversation(null);
            setActiveFieldNoteId(chapter.fieldNoteId);
            setFieldNoteOpen(true);
          } catch (error) {
            setSaveNotice({ kind: "error", message: error?.message ?? "The field report is not ready yet." });
          }
          return;
        }
        closeConversation();
        return;
      }
      if (["victory", "roundVictory", "exhibitionVictory", "onboardingGate", "locked"].includes(conversation.mode)) closeConversation();
      else startDuel();
      return;
    }

    if (conversation.mode === "fishingTurnIn") {
      const current = saveRef.current ?? gameSave;
      if (!current) return;
      try {
        const delivered = deliverElversonHandNetCatches(current);
        if (!delivered.applied) {
          closeConversation();
          return;
        }
        const matchingCardSummary = delivered.awardedCards
          .map(({ cardId, quantity }) => {
            const cardName = cardsById[cardId]?.name ?? inventoryItemLabel(cardId);
            return quantity === 1 ? cardName : `${quantity}× ${cardName}`;
          })
          .join(", ");
        commitAdventureMutation(
          delivered.save,
          `elverson-aquarium-delivery:${delivered.progress.aquariumCount}`,
          `${delivered.deliveredCount} ${delivered.deliveredCount === 1 ? "catch is" : "catches are"} now with the aquarium care team; ${delivered.awardedCardCount} matching ${delivered.awardedCardCount === 1 ? "card was" : "cards were"} added to your collection.`,
        );
        const rewardLines = [
          matchingCardSummary
            ? `Your Sea Realm reward: ${matchingCardSummary}.`
            : null,
        ].filter(Boolean);
        setConversation((currentConversation) => ({
          ...currentConversation,
          index: 0,
          mode: delivered.collectionCompletedNow
            ? "fishingCollectionComplete"
            : "fishingDelivered",
          lines: [
            ...(delivered.collectionCompletedNow
              ? trainer.dialogue?.fishingCollectionComplete ?? []
              : trainer.dialogue?.fishingDelivered ?? []),
            ...rewardLines,
          ],
        }));
      } catch (error) {
        setSaveNotice({
          kind: "error",
          message: error?.message ?? "The aquarium team could not record that catch.",
        });
      }
      return;
    }
    if (["fishingDelivered", "fishingCollectionComplete"].includes(conversation.mode)) {
      closeConversation();
      return;
    }
    if (conversation.mode === "worldIntroduction") {
      const current = saveRef.current ?? gameSave;
      if (!current) return;
      const introduced = recordWorldIntroduction(current);
      const opening = recordElversonPrologueBeat(
        introduced.save,
        ELVERSON_PROLOGUE_BEATS.challenge,
      );
      if (conversation.dockSpeech) {
        pendingDockSpeechSaveRef.current = opening.save;
        setConversation(null);
        setDockCutscenePhase("covering");
        return;
      }
      if (introduced.applied || opening.applied) {
        commitAdventureMutation(
          opening.save,
          "elverson-aquarium-challenge-accepted",
        );
      }
      setConversation(null);
      const transitionStarted = requestSceneTransition(
        ELVERSON_AQUARIUM_GUIDED_TRANSITION,
        opening.save,
        {
          afterArrivalConversation: {
            trainerId: trainer.id,
            interactionId: ACADEMY_MENTOR_INTERACTION_ID,
            index: 0,
            mode: "intro",
          },
        },
      );
      if (!transitionStarted) {
        setSaveNotice({
          kind: "error",
          message: "The walk to the aquarium could not begin. Enter the waterfront aquarium to continue Mr. Easterling's lesson.",
        });
      }
      return;
    }
    if (conversation.mode === "registration") {
      setConversation((currentConversation) => ({
        ...currentConversation,
        trainerId: trainer.id,
        index: 0,
        mode: "starterPresentation",
      }));
      return;
    }
    if (conversation.mode === "intro") {
      setConversation((currentConversation) => ({
        ...currentConversation,
        trainerId: trainer.id,
        index: 0,
        mode: "starterPresentation",
      }));
      return;
    }
    if (conversation.mode === "starterPresentation") {
      openStarterSelection();
      return;
    }
    if (conversation.mode === "starterConfirmed") {
      setConversation((currentConversation) => ({
        ...currentConversation,
        trainerId: trainer.id,
        index: 0,
        mode: "tutorialIntro",
      }));
      return;
    }
    if (conversation.mode === "victory") {
      const current = saveRef.current ?? gameSave;
      const opening = current ? getElversonPrologueProgress(current) : null;
      if (opening?.needsRivalDeparture) {
        setConversation({
          ...ELVERSON_RIVAL_DEPARTURE_CONVERSATION,
          openingBeatId: ELVERSON_PROLOGUE_BEATS.rivalDeparture,
          index: 0,
        });
        return;
      }
      setConversation(null);
      setActiveFieldNoteId(SHELLSHORE_FIELD_NOTE.id);
      setFieldNoteOpen(true);
      return;
    }
    if (conversation.mode === "boatSafety") {
      setConversation(null);
      setActiveFieldNoteId(SHELLSHORE_FIELD_NOTE.id);
      setFieldNoteOpen(true);
      return;
    }
    startDuel();
  }

  function conversationPrimaryLabel() {
    if (!conversation) return "Continue";
    if (conversation.openingBeatId === ELVERSON_PROLOGUE_BEATS.breakfast) {
      return "Check with Dad";
    }
    if (conversation.openingBeatId === ELVERSON_PROLOGUE_BEATS.permission) {
      return "Meet your best friend";
    }
    if (conversation.openingBeatId === ELVERSON_PROLOGUE_BEATS.race) {
      return "Join the kickoff at the dock";
    }
    if (conversation.openingBeatId === ELVERSON_PROLOGUE_BEATS.rivalDeparture) {
      return "Begin the race to Pelora City";
    }
    const trainer = TRAINERS[conversation.trainerId];
    if (trainer?.id !== ACADEMY_MENTOR_ID) {
      if (["victory", "exhibitionVictory"].includes(conversation.mode)) return "Continue exploring";
      if (conversation.mode === "roundVictory") {
        return tournamentProgress?.complete
          ? "Join the Championship Ceremony"
          : "Continue to the next round";
      }
      if (conversation.mode === "defeat") return "Retry this 30 VP round";
      if (conversation.mode === "postgame" && trainer?.encounterId) return "Start a 30 VP practice rematch";
      if (conversation.mode === "exhibitionOffer") return "Start 30 VP exhibition";
      if (conversation.mode === "onboardingGate") return "Return to the aquarium";
      if (conversation.mode === "locked") return "Continue fieldwork";
      if (!trainer?.encounterId) {
        if (
          trainer?.id === FISHERMAN_WYETH_ID
          && ["fishingLesson", "fishingPractice"].includes(conversation.mode)
        ) {
          return "Follow Wyeth to the sandy cove";
        }
        if (trainer?.townId === "shellshore-village") return "Continue exploring";
        if (trainer?.roleId === "tournament-director") {
          return tournamentProgress?.complete ? "View championship record" : tournamentProgress?.status === "active" ? "Review registered deck" : "Review registration";
        }
        if (trainer?.roleId === "local-guide" && conversation.mode === "intro") {
          const chapter = getAdventureEcosystemChapterByTownId(trainer.townId);
          return `Begin the ${chapter?.ui.activityLabel ?? "field survey"}`;
        }
        if (trainer?.roleId === "field-partner" && conversation.mode === "debrief") return "Complete the field report";
        return "Continue exploring";
      }
      return defeated.has(trainer?.encounterId) ? "Rematch" : "Start duel";
    }
    if (conversation.mode === "fishingTurnIn") return "Place catches with the care team";
    if (conversation.mode === "fishingCollectionComplete") return "Celebrate the complete Reef Log";
    if (conversation.mode === "fishingDelivered") return "Keep exploring";
    if (conversation.mode === "worldIntroduction") {
      return conversation.dockSpeech ? "Open challenge registration" : "Follow me to the aquarium";
    }
    if (conversation.mode === "registration") return "Register and view starter decks";
    if (conversation.mode === "intro") return "Meet the starter decks";
    if (conversation.mode === "starterPresentation") return "Choose your starter";
    if (conversation.mode === "starterConfirmed") return "Continue";
    if (conversation.mode === "victory") return "Read your Field Note";
    if (conversation.mode === "boatSafety") return "Open the safety Field Note";
    if (conversation.mode === "practiceLoss" || conversation.mode === "practiceRetry") return "Try again";
    if (conversation.mode === "practiceExit") return "Restart practice duel";
    if (conversation.mode === "rematch") return "Practice again";
    return "Begin live tutorial";
  }

  function claimSaveSlotAndSave(current, overwriteConfirmed = false) {
    let adapter = storageRef.current;
    if (!adapter) {
      try {
        adapter = createAccountStorageAdapter();
        storageRef.current = adapter;
      } catch (error) {
        setSaveNotice({
          kind: "error",
          message: `Local saving is still unavailable: ${error?.message ?? "storage access failed"}. Your current session remains playable.`,
        });
        return;
      }
    }

    const claimed = adapter.startNewProfile(current.profileId, {
      overwriteConfirmed,
      saveValue: current,
    });
    if (!claimed.ok && claimed.error?.code === "OVERWRITE_CONFIRMATION_REQUIRED") {
      setConfirmation({
        title: "Replace the recovered adventure?",
        message: "This slot became readable again and already contains progress. Saving this offline session will replace it.",
        confirmLabel: "Replace and save",
        onConfirm: () => claimSaveSlotAndSave(current, true),
      });
      return;
    }
    if (!claimed.ok) {
      setDirty(true);
      setSaveNotice({
        kind: "error",
        message: `${claimed.error?.message ?? "The save slot could not be claimed."} Your current session remains playable.`,
      });
      return;
    }

    profileWriteAuthorizedRef.current = true;
    persistSave(current, { kind: "manual" });
  }

  function manualSave() {
    const current = saveRef.current ?? gameSave;
    if (!current) return;
    if (!profileWriteAuthorizedRef.current) {
      claimSaveSlotAndSave(current);
      return;
    }
    persistSave(current, { kind: "manual" });
  }

  function openInventoryPack(packId) {
    const current = saveRef.current ?? gameSave;
    if (!current) return;
    try {
      const opened = openAdventurePack(current, packId);
      saveRef.current = opened.save;
      setGameSave(opened.save);
      setPackReveal(opened);
      setDirty(true);
      const saved = persistSave(opened.save, { checkpointId: `pack-opened:${packId}:v${opened.poolVersion}` });
      if (saved.ok) {
        setSaveNotice({
          kind: "info",
          message: `${PACK_POOLS_BY_ID[packId]?.name ?? "Booster pack"} opened and saved to your collection.`,
        });
      }
    } catch (error) {
      setSaveNotice({
        kind: "error",
        message: error?.message ?? "That booster pack could not be opened.",
      });
    }
  }

  function commitDeckWorkshopSave(nextSave, {
    checkpointId = "deck-workshop",
    message = "Deck changes saved to this adventure.",
  } = {}) {
    saveRef.current = nextSave;
    setGameSave(nextSave);
    setDirty(true);
    const saved = persistSave(nextSave, { checkpointId });
    if (saved.ok) {
      setSaveNotice({ kind: "info", message });
    }
  }

  function finishReturnToTitle() {
    clearMovement();
    setScreen("title");
    setGameSave(null);
    saveRef.current = null;
    setConversation(null);
    setConversationLeadIn(null);
    setActiveTrainerId(null);
    setPostDuelConversation(null);
    activeDuelConversationOriginRef.current = null;
    setStarterSelectionOpen(false);
    setSelectedStarterId(null);
    setFieldNoteOpen(false);
    setActiveFieldNoteId(SHELLSHORE_FIELD_NOTE.id);
    setInventoryOpen(false);
    setDecksOpen(false);
    setWorldMapOpen(false);
    setFieldworkActivity(null);
    setFieldworkFeedback(null);
    setPackReveal(null);
    setActiveDuelDeckSnapshot(null);
    setSubAssistedMode(false);
    setSubFeedback(null);
    setShowCompletion(false);
    setTournamentRegistrationOpen(false);
    setTournamentRegistrationError(null);
    setDecksReturnContext(null);
    setChampionshipEndingStage(null);
    setChampionshipEndingReplay(false);
    setNewsletterInviteEligible(false);
    setNewsletterInviteOpen(false);
    setNewsletterInviteSubmitting(false);
    setNewsletterInviteError(null);
    setPauseOpen(false);
    setSettingsOpen(false);
    setConfirmation(null);
    setNewGameSetup(null);
    pendingSceneTransitionRef.current = null;
    pendingDockSpeechSaveRef.current = null;
    momGreetingPlayerPositionRef.current = null;
    doorwayTransitionRef.current = null;
    setSceneTransition(null);
    setOpeningPrelude(null);
    setMomGreetingStage(null);
    bestFriendWalkClockRef.current = null;
    setBestFriendSequence(null);
    setBestFriendWalkSample(null);
    setDockCutscenePhase(null);
    guidedWalkClockRef.current = null;
    setGuidedWalk(null);
    setGuidedWalkSample(null);
    setDirty(false);
    profileWriteAuthorizedRef.current = false;
    refreshProfiles();
  }

  function returnToTitle() {
    const current = saveRef.current ?? gameSave;
    const saved = current
      ? persistSave(current, { checkpointId: "return-to-title" })
      : { ok: true };
    if (saved.ok) {
      finishReturnToTitle();
      return;
    }
    setConfirmation({
      title: "Return without saving?",
      message: "The latest movement or quest change could not be saved. You can stay and retry, or return to the title with the last confirmed save unchanged.",
      confirmLabel: "Return without saving",
      onConfirm: finishReturnToTitle,
    });
  }

  function requestRestart() {
    if (!gameSave) return;
    setConfirmation({
      title: "Restart this Elverson adventure?",
      message: "All progress in this save will be replaced with a new Elverson start.",
      confirmLabel: "Restart adventure",
      onConfirm: () => beginNewGame(gameSave.profileId, true, {
        playerName: gameSave.player.name,
        bestFriendName: gameSave.player.bestFriendName,
      }),
    });
  }

  escapeRef.current = () => {
    if (screen !== "playing" || activeTrainerId || sceneTransition || guidedWalk || conversationLeadIn) return;
    if (openingPrelude || momGreetingStage || bestFriendSequence || dockCutscenePhase) return;
    clearMovement();
    if (openingFreeRoamLocked && !conversation) return;
    if (confirmation) {
      setConfirmation(null);
    } else if (newsletterInviteOpen) {
      if (!newsletterInviteSubmitting) dismissNewsletterInvite();
    } else if (championshipEndingStage) {
      if (championshipEndingReplay) {
        setChampionshipEndingStage(null);
        setChampionshipEndingReplay(false);
      }
    } else if (tournamentRegistrationOpen) {
      setTournamentRegistrationOpen(false);
      setTournamentRegistrationError(null);
    } else if (settingsOpen) {
      setSettingsOpen(false);
      setPauseOpen(true);
    } else if (fieldworkActivity) {
      setFieldworkActivity(null);
      setFieldworkFeedback(null);
    } else if (fishingSession) {
      if (fishingSession.required) {
        setSaveNotice({
          kind: "info",
          message: "Wyeth will stay with you until you make this first practice catch. Let the animals settle, approach slowly, and scoop when the net is close.",
        });
      } else {
        closeFishingSession();
      }
    } else if (worldMapOpen) {
      setWorldMapOpen(false);
    } else if (starterSelectionOpen) {
      setStarterSelectionOpen(false);
      setSelectedStarterId(null);
    } else if (fieldNoteOpen) {
      setFieldNoteOpen(false);
    } else if (inventoryOpen) {
      setInventoryOpen(false);
      setPackReveal(null);
    } else if (decksOpen) {
      setDecksOpen(false);
      if (decksReturnContext === "tournament-registration") {
        setDecksReturnContext(null);
        setTournamentRegistrationOpen(true);
      }
    } else if (
      conversation?.trainerId === FISHERMAN_WYETH_ID
      && ["fishingLesson", "fishingPractice"].includes(conversation.mode)
    ) {
      return;
    } else if (
      conversation?.mode === "worldIntroduction"
      || Boolean(conversation?.openingBeatId)
    ) {
      return;
    } else if (conversation) {
      closeConversation();
    } else if (showCompletion) {
      setShowCompletion(false);
    } else {
      setPauseOpen((current) => !current);
    }
  };

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        escapeRef.current?.();
        return;
      }
      const direction = DIRECTIONS[event.key];
      if (direction) {
        if (event.target?.closest?.("input, select, textarea, [contenteditable='true']")) return;
        if (movementPausedRef.current) return;
        event.preventDefault();
        const inputCode = event.code || event.key;
        if (!keyboardDirectionsRef.current.has(inputCode)) {
          keyboardDirectionsRef.current.set(inputCode, direction);
          activateMovementIntent(`keyboard:${inputCode}`, direction);
        }
        setGameSave((current) => {
          const currentScene = SCENES[current?.world?.sceneId];
          if (currentScene?.routeId || currentScene?.kind === "route") return current;
          if (!current || current.world.facing === direction) return current;
          const updated = { ...current, world: { ...current.world, facing: direction } };
          saveRef.current = updated;
          return updated;
        });
        setDirty(true);
        syncMovementActive();
        return;
      }
      if (
        (event.key === "Enter" || event.key === " ")
        && !event.target?.closest?.("button, a, input, select, textarea, summary")
      ) {
        event.preventDefault();
        interactRef.current?.();
      }
    }

    function onKeyUp(event) {
      const direction = DIRECTIONS[event.key];
      if (!direction) return;
      const inputCode = event.code || event.key;
      releaseMovementIntent(
        `keyboard:${inputCode}`,
        () => keyboardDirectionsRef.current.delete(inputCode),
      );
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearMovement);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearMovement);
    };
  }, [activateMovementIntent, clearMovement, releaseMovementIntent, syncMovementActive]);

  useEffect(() => {
    const preference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!preference) return undefined;
    const syncPreference = () => setSystemReducedMotion(preference.matches);
    syncPreference();
    if (preference.addEventListener) preference.addEventListener("change", syncPreference);
    else preference.addListener?.(syncPreference);
    return () => {
      if (preference.removeEventListener) preference.removeEventListener("change", syncPreference);
      else preference.removeListener?.(syncPreference);
    };
  }, []);

  useEffect(() => {
    function syncVisibility() {
      const visible = document.visibilityState === "visible";
      pageVisibleRef.current = visible;
      setPageVisible(visible);
      if (!visible) clearMovement();
    }

    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, [clearMovement]);

  useEffect(() => {
    if (screen !== "playing" || openingPrelude || momGreetingStage || bestFriendSequence || dockCutscenePhase || pauseOpen || settingsOpen || confirmation || sceneTransition || guidedWalk || conversationLeadIn || starterSelectionOpen || fieldNoteOpen || inventoryOpen || decksOpen || worldMapOpen || fieldworkActivity || fishingSession || tournamentRegistrationOpen || championshipEndingStage || newsletterInviteOpen || !pageVisible) return undefined;
    const timer = window.setInterval(() => {
      if (!pageVisibleRef.current) return;
      setGameSave((current) => {
        if (!current) return current;
        const updated = {
          ...current,
          playtimeSeconds: current.playtimeSeconds + 1,
        };
        saveRef.current = updated;
        setDirty(true);
        return updated;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [bestFriendSequence, championshipEndingStage, confirmation, conversationLeadIn, decksOpen, dockCutscenePhase, fieldNoteOpen, fieldworkActivity, fishingSession, guidedWalk, inventoryOpen, momGreetingStage, newsletterInviteOpen, openingPrelude, pageVisible, pauseOpen, sceneTransition, screen, setDirty, settingsOpen, starterSelectionOpen, tournamentRegistrationOpen, worldMapOpen]);

  useEffect(() => {
    function saveWhenHidden() {
      if (
        document.visibilityState !== "hidden"
        || !dirtyRef.current
        || screen !== "playing"
      ) return;
      const current = saveRef.current;
      if (current) persistSave(current, { checkpointId: "visibility-hidden" });
    }

    document.addEventListener("visibilitychange", saveWhenHidden);
    return () => document.removeEventListener("visibilitychange", saveWhenHidden);
  }, [persistSave, screen]);

  if (screen === "boot") {
    return (
      <main className={styles.gameShell}>
        <div className={styles.oceanGlow} aria-hidden="true" />
        <div className={styles.introLayer} role="status">
          <div className={styles.introCard}>
            <div className={styles.introEyebrow}>A SeaPals Story</div>
            <h1>REEFBOUND</h1>
            <p>Checking your Elverson saves…</p>
          </div>
        </div>
      </main>
    );
  }

  if (screen === "title") {
    return (
      <main className={styles.gameShell}>
        <div className={styles.oceanGlow} aria-hidden="true" />
        <TitleScreen
          profiles={profiles}
          notice={accountNotice ?? saveNotice}
          account={account}
          blocked={Boolean(confirmation || legacySavePrompt || newGameSetup)}
          onContinue={continueProfile}
          onNewGame={requestNewGame}
          onRetry={retryStorage}
          onSignOut={onSignOut}
        />
        {legacySavePrompt ? (
          <LegacySavePrompt
            accountEmail={account.email}
            importableProfileCount={legacySavePrompt.importableProfileCount}
            onImport={() => resolveLegacySaveChoice(true)}
            onStartFresh={() => resolveLegacySaveChoice(false)}
          />
        ) : null}
        {newGameSetup ? (
          <OpeningSetupModal
            key={`${newGameSetup.profileId}:${newGameSetup.overwriteConfirmed}`}
            profileId={newGameSetup.profileId}
            onCancel={() => setNewGameSetup(null)}
            onBegin={(identity) => beginNewGame(
              newGameSetup.profileId,
              newGameSetup.overwriteConfirmed,
              identity,
            )}
          />
        ) : null}
        {confirmation ? (
          <ConfirmDialog
            {...confirmation}
            onConfirm={() => {
              const action = confirmation.onConfirm;
              setConfirmation(null);
              action();
            }}
            onCancel={() => setConfirmation(null)}
          />
        ) : null}
      </main>
    );
  }

  if (activeTrainerId) {
    const trainer = TRAINERS[activeTrainerId];
    const isAcademyPractice = trainer.id === ACADEMY_MENTOR_ID;
    const isTournamentMatch = trainer.townId === "champions-wake"
      && CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS.includes(trainer.encounterId);
    if (!activeDuelDeckSnapshot) {
      return (
        <main className={styles.gameShell}>
          <div className={styles.oceanGlow} aria-hidden="true" />
          <div className={styles.introLayer} role="status">
            <div className={styles.introCard}>
              <div className={styles.introEyebrow}>Preparing your deck</div>
              <h1>REEFBOUND</h1>
              <p>Locking your active deck for this duel…</p>
            </div>
          </div>
        </main>
      );
    }
    return (
      <div className={[
        gameSave.settings.highContrast ? styles.highContrastMode : "",
        gameSave.settings.reducedMotion ? styles.reducedMotionMode : "",
      ].filter(Boolean).join(" ")}>
      <div inert={settingsOpen || undefined} aria-hidden={settingsOpen || undefined}>
        <Simulator
        key={`reefbound-${trainer.encounterId}-${activeDuelDeckSnapshot.fingerprint}`}
        accessibilitySettings={gameSave?.settings}
        onOpenAccessibilitySettings={() => setSettingsOpen(true)}
        storyMode={{
          encounterId: trainer.encounterId,
          opponentId: trainer.id,
          playerDeckId: activeDuelDeckSnapshot.id,
          playerDeckSnapshot: activeDuelDeckSnapshot,
          opponentDeckId: trainer.deckId,
          victoryTarget: trainer.victoryTarget,
          difficulty: trainer.difficulty,
          opponentName: trainer.name,
          returnLabel: isAcademyPractice ? "Aquarium" : isTournamentMatch ? "Arena" : "Town",
          ...(isAcademyPractice ? {
            tutorial: {
              scriptedDecks: gameSave?.tutorial?.status !== "complete",
              guide: {
                name: trainer.name,
                role: trainer.title,
                portraitSrc: "/images/adventure/mr-easterling-portrait-v2.webp",
              },
              contract: {
                id: SHELLSHORE_TUTORIAL.id,
                title: "Mr. Easterling's Live Lesson",
                ordered: SHELLSHORE_TUTORIAL.ordered,
                checkpoints: SHELLSHORE_TUTORIAL.checkpoints,
              },
              initialProgress: gameSave?.tutorial,
              onCheckpoint: recordSimulatorTutorialCheckpoint,
              onRetry: () => {
                duelResultRef.current = null;
                setPostDuelConversation(null);
              },
            },
          } : {}),
          onExit: () => exitDuel(activeTrainerId),
          onResult: (result) => recordDuelResult(activeTrainerId, result),
        }}
        />
      </div>
      {settingsOpen ? (
        <AdventureSettingsModal
          save={gameSave}
          notice={saveNotice}
          onCommit={(nextSave, meta) => {
            const saved = commitAdventureMutation(nextSave, meta.checkpointId, meta.message);
            if (!saved.ok) {
              throw new Error("Settings changed for this session, but the save could not be written. Retry Save game after returning to the adventure.");
            }
          }}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
      </div>
    );
  }

  const baseConversationTrainer = conversation ? TRAINERS[conversation.trainerId] : null;
  const activeConversationTrainer = baseConversationTrainer?.id === ELVERSON_PROLOGUE_BEST_FRIEND_ID
    ? { ...baseConversationTrainer, name: dialogueIdentity.bestFriendName }
    : baseConversationTrainer;
  const activeWorldConversation = conversationLeadIn ?? conversation;
  const activeConversationInteractionId = activeWorldConversation?.sceneId === sceneId
    ? activeWorldConversation.interactionId ?? null
    : null;
  const conversationLeadInLabel = conversationLeadIn
    ? `${conversationLeadIn.trainerId === ELVERSON_PROLOGUE_BEST_FRIEND_ID
      ? dialogueIdentity.bestFriendName
      : TRAINERS[conversationLeadIn.trainerId]?.name ?? "Your neighbor"} turns to greet you...`
    : null;
  const canOfferSunpatchExhibition = conversation?.trainerId === "sunpatch-leader"
    && defeated.has("encounter-sunpatch-qualifier");
  const conversationSecondaryAction = activeConversationTrainer
    ? getAdventureConversationSecondaryAction({
        trainer: activeConversationTrainer,
        mode: conversation.mode,
        canOfferSunpatchExhibition,
      })
    : null;
  const currentTownId = gameSave.world.townId;
  const isChampionsWake = currentTownId === "champions-wake";
  const activeFieldworkChapter = fieldworkActivity
    ? getAdventureEcosystemChapterByQuestId(fieldworkActivity.questId)
    : ecosystemChapter;
  const activeFieldworkProgress = activeFieldworkChapter
    ? activeFieldworkChapter.getProgress(gameSave)
    : null;
  const townChallengeTrainers = Object.values(TRAINERS).filter((trainer) => (
    trainer.townId === currentTownId && trainer.encounterId && trainer.roleId !== "mentor" && !trainer.virtual
  ));
  const townEncounterIds = townChallengeTrainers.map((trainer) => trainer.encounterId);
  const progress = townEncounterIds.filter((encounterId) => defeated.has(encounterId)).length;
  const worldCueInteractions = scene.interactions.filter((candidate) => (
    candidate.type === "board"
    || candidate.type === "dock"
    || (
      ["observation", "interpretation", "response"].includes(candidate.type)
      && ecosystemChapter?.questId === candidate.questId
    )
  ));
  const mapThemeClass = mapThemeClassForScene(scene);
  const cameraLayout = getAdventureCameraLayout({
    worldWidth: scene.width,
    worldHeight: scene.height,
    playerX: position.x + 0.5,
    playerY: position.y + 0.5,
  });
  // Elverson is the first layered scene large enough for off-camera DOM to be
  // meaningful. Runtime actors, collision, and interaction lists stay whole;
  // only the mounted visual elements are filtered with a wide safety margin.
  const renderBounds = scene.layeredObjects.length
    ? getAdventureCameraRenderBounds(cameraLayout)
    : null;
  const renderedLayeredObjects = renderBounds
    ? scene.layeredObjects.filter((object) => (
        isAdventureLayeredObjectInRenderBounds(object, renderBounds)
      ))
    : scene.layeredObjects;
  const renderedCharacterInteractions = renderBounds
    ? sceneCharacterInteractions.filter((characterInteraction) => (
        characterInteraction.id === activeConversationInteractionId
        || isAdventureActorInRenderBounds(
          actorStates[characterInteraction.id]?.position ?? characterInteraction.at,
          renderBounds,
        )
      ))
    : sceneCharacterInteractions;
  const completedHomeBeatCount = [
    ELVERSON_PROLOGUE_BEATS.breakfast,
    ELVERSON_PROLOGUE_BEATS.permission,
    ELVERSON_PROLOGUE_BEATS.race,
  ].filter((beatId) => prologueProgress.completedBeatIds.includes(beatId)).length;
  const shellshoreQuestView = prologueProgress.needsHomeSequence
    ? {
        title: "Your tenth-birthday morning",
        description: `Head downstairs, greet Mom, check with Dad, then meet ${dialogueIdentity.bestFriendName} outside.`,
        value: completedHomeBeatCount,
        total: 3,
        label: `${completedHomeBeatCount} / 3 birthday opening beats complete`,
      }
    : prologueProgress.needsBestFriendArrival
      ? {
          title: `Meet ${dialogueIdentity.bestFriendName} outside`,
          description: "Head through the front door. Your best friend is coming to find you with news about the waterfront kickoff.",
          value: completedHomeBeatCount,
          total: 3,
          label: "Your birthday adventure is about to begin",
        }
      : prologueProgress.readyForDockSpeech
      ? {
          title: "Join the kickoff at the dock",
          description: "Explore Elverson at your own pace, then approach the central dock to hear Mr. Easterling open the Sea Creature Challenge.",
          value: 0,
          total: 1,
          label: "The town is gathered at the waterfront",
        }
      : onboardingProgress.needsWorldIntroduction
        ? {
            title: "Meet Mr. Easterling",
            description: "Hear about the new Sea Realm Aquarium, its requested creature set, and what it truly means to become Master of the Sea.",
            value: 0,
            total: 1,
            label: "A new project is beginning",
          }
        : onboardingProgress.needsStarterSelection
          ? {
              title: "Register at the Sea Realm Aquarium",
              description: "Mr. Easterling invited new challengers to visit him in the aquarium. Explore town, then speak with him inside to choose your first deck.",
              value: 0,
              total: 1,
              label: "Challenge registration is open",
            }
          : !onboardingProgress.tutorialComplete
            ? {
                title: "Learn how healthy ecosystems work",
                description: onboardingProgress.readyForPracticeDuel
                  ? "Keep building your economy, establish a Coral Reef habitat, welcome a Filter Feeder, and finish with an Apex predator at 26 VP."
                  : "Follow Mr. Easterling's guided SeaRealm lesson. Each completed lesson step saves automatically.",
                value: onboardingProgress.completedCheckpointCount,
                total: onboardingProgress.checkpointCount,
                label: `${onboardingProgress.completedCheckpointCount} / ${onboardingProgress.checkpointCount} lesson steps`,
              }
            : prologueProgress.needsRivalDeparture
              ? {
                  title: "Begin the friendly race",
                  description: `${dialogueIdentity.bestFriendName} has one last thing to say before setting out for Pelora City.`,
                  value: 0,
                  total: 1,
                  label: "Your rival is ready to depart",
                }
              : onboardingProgress.needsBoatSafetyReview
                ? {
                    title: "Review the aquarium field plan",
                    description: "Read Mr. Easterling's checklist for gathering observations safely along Elverson's shore.",
                    value: 0,
                    total: 1,
                    label: "Field-plan review waiting",
                  }
                : !fishingProgress.hasHandNet || !fishingProgress.tutorialStarted
                  ? {
                      title: "Find Fisherman Wyeth",
                      description: "Mr. Easterling asked you to learn how to collect responsibly. Find Wyeth on the south platform beside the pier.",
                      value: 0,
                      total: 1,
                      label: "First catching lesson waiting",
                    }
                  : !fishingProgress.tutorialComplete
                    ? {
                        title: "Land one practice catch with Wyeth",
                        description: "Follow Wyeth to the sandy practice cove. He will stay beside you through your first required hand-net catch.",
                        value: 0,
                        total: 1,
                        label: "Hands-on catching tutorial required",
                      }
                    : fishingProgress.heldCount > 0
                      ? {
                          title: "Bring your catch to Mr. Easterling",
                          description: "Return to the aquarium workshop so the care team can assess your catch and prepare the right habitat.",
                          value: fishingProgress.heldCount,
                          total: fishingProgress.heldCount,
                          label: `${fishingProgress.heldCount} ${fishingProgress.heldCount === 1 ? "catch" : "catches"} ready for the aquarium`,
                        }
                      : progress < townEncounterIds.length
                        ? {
                            title: "Meet Elverson's reef keepers",
                            description: "Challenge Elverson's resident reef keepers and learn how each neighbor supports the aquarium project.",
                            value: progress,
                            total: townEncounterIds.length,
                            label: `${progress} / ${townEncounterIds.length} neighborhood challenges complete`,
                          }
                        : fishingProgress.aquariumSpeciesCount < ELVERSON_REEF_CATCHES.length
                          ? {
                              title: "Grow the Elverson aquarium",
                              description: "Explore marked shore collection areas, discover all ten local reef creatures, and bring them to Mr. Easterling.",
                              value: fishingProgress.aquariumSpeciesCount,
                              total: ELVERSON_REEF_CATCHES.length,
                              label: `${fishingProgress.aquariumSpeciesCount} / ${ELVERSON_REEF_CATCHES.length} reef species in the aquarium`,
                            }
                          : {
                              title: "Elverson Reef Log complete",
                              description: "All ten local reef species are represented in the aquarium, and every delivery earned its matching Sea Realm card. The wider Sea Realm requested set continues beyond Elverson.",
                              value: ELVERSON_REEF_CATCHES.length,
                              total: ELVERSON_REEF_CATCHES.length,
                              label: "Elverson reef collection complete",
                            };
  const ecosystemCompletedSteps = (ecosystemProgress?.observedObservationIds.length ?? 0)
    + (ecosystemProgress?.completedResidentEncounterIds.length ?? 0)
    + (ecosystemProgress?.interpretation.correct ? 1 : 0)
    + (ecosystemProgress?.response.correct ? 1 : 0);
  const ecosystemRequiredSteps = (ecosystemProgress?.requiredObservationIds.length ?? 0)
    + (ecosystemProgress?.residentEncounterIds.length ?? 0)
    + (ecosystemChapter ? 2 : 0);
  const ecosystemGuideMet = ecosystemChapter
    ? hasMetAdventureEcosystemGuide(ecosystemChapter, gameSave)
    : false;
  const voyageQuestView = {
    title: "Pilot the marked channel",
    description: "Steer between rocks and buoys. Slow near shallow habitat, then approach the opposite dock and choose Dock.",
    value: 0,
    total: 1,
    label: "Manual voyage in progress",
  };
  const ecosystemQuestView = ecosystemChapter && ecosystemProgress
    ? !ecosystemGuideMet
      ? {
          title: ecosystemChapter.ui.guideQuestTitle,
          description: ecosystemChapter.ui.guideQuestDescription,
          value: 0,
          total: 1,
          label: "Guide briefing waiting",
        }
      : ecosystemProgress.complete
      ? gameSave.progression.tideMarkIds.includes(ecosystemChapter.ui.tideMarkId)
        ? {
            title: ecosystemChapter.ui.tideMarkTitle,
            description: ecosystemChapter.ui.tideMarkDescription,
            value: 1,
            total: 1,
            label: "Tide Mark secured",
          }
        : {
            title: ecosystemChapter.ui.qualifierTitle,
            description: ecosystemChapter.ui.qualifierDescription,
            value: 0,
            total: 1,
            label: "Qualifier waiting",
          }
      : ecosystemProgress.readyToTurnIn
        ? {
            title: ecosystemChapter.ui.fieldReportTitle,
            description: ecosystemChapter.ui.fieldReportDescription,
            value: ecosystemRequiredSteps,
            total: ecosystemRequiredSteps,
            label: "Fieldwork ready to submit",
          }
        : {
            title: ecosystemChapter.ui.questTitle,
            description: ecosystemProgress.nextStep?.label
              ? `Next: ${ecosystemProgress.nextStep.label}. ${ecosystemChapter.ui.questDescription}`
              : ecosystemChapter.ui.questDescription,
            value: ecosystemCompletedSteps,
            total: ecosystemRequiredSteps,
            label: `${ecosystemCompletedSteps} / ${ecosystemRequiredSteps} investigation steps`,
          }
    : null;
  const tournamentCompletedCount = tournamentProgress?.completedRoundIds.length ?? 0;
  const tournamentPostgameUnlocked = gameSave.progression.quests[CHAMPIONS_WAKE_QUEST_ID]
    ?.flags?.[CHAMPIONSHIP_ENDING_FLAGS.postgame] === true;
  const tournamentActiveRound = CHAMPIONS_WAKE_ROUNDS.find(
    (round) => round.id === tournamentProgress?.activeRoundId,
  );
  const tournamentQuestView = isChampionsWake && tournamentProgress
    ? tournamentProgress.complete
      ? tournamentPostgameUnlocked
        ? {
            title: "Champion's free voyage",
            description: "Revisit every habitat, refine your decks, or challenge any tournament opponent to a 30 VP practice rematch.",
            value: 3,
            total: 3,
            label: "Championship complete · postgame open",
          }
        : {
            title: "Join the Championship Ceremony",
            description: "Director Vela and the archipelago learning team are ready to present the Cup and reflect on all five habitats.",
            value: 3,
            total: 3,
            label: "Three tournament wins recorded",
          }
      : tournamentProgress.status === "active"
        ? {
            title: tournamentActiveRound ? `Play the ${tournamentActiveRound.label}` : "Continue the tournament",
            description: tournamentActiveRound
              ? `Meet ${tournamentActiveRound.opponent} in the Arena. Your registered deck remains fixed for this complete 30 VP round.`
              : "Return to the Arena for the next ordered 30 VP round.",
            value: tournamentCompletedCount,
            total: 3,
            label: `${tournamentCompletedCount} / 3 rounds won`,
          }
        : {
            title: "Register for the SeaPals Tournament",
            description: "Meet Director Vela in the Registration Hall. Review all five Tide Marks and Field Notes, then lock one legal 60-card deck for the bracket.",
            value: 0,
            total: 3,
            label: tournamentAvailability?.requirementsMet ? "Registration ready" : "Voyage record incomplete",
          }
    : null;
  const questView = boatMode
    ? voyageQuestView
    : tournamentQuestView ?? ecosystemQuestView ?? shellshoreQuestView;
  const activeStarter = onboardingProgress.starterDeckId
    ? getAdventureStarterDeck(onboardingProgress.starterDeckId)
    : null;
  const activeDeckName = gameSave.savedDecks[gameSave.player.activeDeckId]?.name
    ?? activeStarter?.name
    ?? "Choose a starter first";
  const unopenedPackCount = Object.values(gameSave.inventory.unopenedPacks)
    .reduce((total, quantity) => total + quantity, 0);
  const explorationBlocked = Boolean(
    openingPrelude || momGreetingStage || bestFriendSequence || dockCutscenePhase || pauseOpen || settingsOpen || confirmation || activeConversationTrainer || starterSelectionOpen || fieldNoteOpen || inventoryOpen || decksOpen || worldMapOpen || fieldworkActivity || fishingSession || guidedWalk || showCompletion || tournamentRegistrationOpen || championshipEndingStage || newsletterInviteOpen,
  );
  const gameplaySurfaceLocked = Boolean(
    explorationBlocked || sceneTransition || conversationLeadIn,
  );
  const gameShellClassName = [
    styles.gameShell,
    gameSave.settings.highContrast ? styles.highContrastMode : "",
    gameSave.settings.reducedMotion || systemReducedMotion ? styles.reducedMotionMode : "",
  ].filter(Boolean).join(" ");
  const maximumBoatSpeed = scene.movement?.speed ?? BOAT_MOTION_DEFAULTS.maxForwardSpeed;
  const sceneTransitionVector = sceneTransition
    ? getAdventureDoorStepVector(sceneTransition.direction)
    : null;
  const bestFriendSequenceLabel = bestFriendSequence?.phase === "calling"
    ? `${dialogueIdentity.playerName}!! ${dialogueIdentity.bestFriendName} is calling from the right...`
    : bestFriendSequence?.phase === "approaching"
      ? `${dialogueIdentity.bestFriendName} is hurrying over from the right...`
      : bestFriendSequence?.phase === "escorting"
        ? `Following ${dialogueIdentity.bestFriendName} to the waterfront dock...`
        : null;
  const sceneTransitionLabel = bestFriendSequenceLabel
    ?? (guidedWalk
      ? "Following Fisherman Wyeth to the sandy practice cove..."
      : sceneTransition
        ? sceneTransition.type === "guided"
          ? sceneTransition.phase === "departing"
            ? "Walking with Mr. Easterling to the waterfront aquarium..."
            : "Arriving at the Elverson Aquarium workshop..."
          : sceneTransition.phase === "departing"
            ? `Entering ${LOCATION_NAMES[sceneTransition.targetSceneId] ?? "the next room"}...`
            : `Arriving in ${LOCATION_NAMES[sceneTransition.targetSceneId] ?? "the next room"}...`
        : null);
  const displayedBoatMotion = boatTelemetry.sceneId === sceneId
    ? boatTelemetry
    : {
        sceneId,
        ...createBoatMotionState({
          position,
          heading: getContinuousBoatHeading(null, facing),
        }),
        throttle: 0,
        rudder: 0,
      };
  const dockReady = boatMode && actionInteraction?.type === "dock";
  const destinationDockView = destinationDock ? {
    ...destinationDock,
    label: destinationDock.label
      ?? `Dock at ${LOCATION_NAMES[destinationDock.targetScene] ?? "the destination"}`,
  } : null;
  const destinationBearing = boatMode
    ? relativeBoatBearing(position, displayedBoatMotion.heading, destinationDock?.at)
    : null;
  const boatGuidance = dockReady
    ? `${actionInteraction.label ?? "Dock in reach"}. Ease off the throttle, then press Enter or the on-screen A button.`
    : displayedBoatMotion.collided
      ? "The hull stopped safely at an obstacle. Reverse, turn the rudder, and ease forward when clear."
      : destinationBearing
        ? `Destination dock is ${destinationBearing.distance.toFixed(1)} away, ${destinationBearing.direction}.`
        : "Use W/S for throttle and brake; use A/D for the rudder.";
  const boatAnnouncement = dockReady
    ? "Destination dock in reach. Ease off the throttle, then press Enter or the on-screen A button."
    : displayedBoatMotion.collided
      ? "The hull stopped safely at an obstacle. Reverse and steer clear."
      : "";

  return (
    <main className={gameShellClassName}>
      <div className={styles.oceanGlow} aria-hidden="true" />
      {openingPrelude ? (
        <div
          className={`${styles.openingPrelude} ${openingPrelude === "revealing" ? styles.openingPreludeRevealing : ""}`}
          role="status"
          aria-live="polite"
          aria-label="Morning thoughts"
        >
          <div>
            <p>…Is it morning yet?</p>
            <p>…I feel like a great adventure awaits me this morning…</p>
          </div>
        </div>
      ) : null}
      {["covering", "revealing"].includes(dockCutscenePhase) ? (
        <div
          className={`${styles.dockCutsceneFade} ${dockCutscenePhase === "covering" ? styles.dockCutsceneFadeCovering : styles.dockCutsceneFadeRevealing}`}
          role="status"
          aria-label={dockCutscenePhase === "covering"
            ? "The waterfront fades to black."
            : "Elverson returns after the kickoff."}
        />
      ) : null}
      <header className={styles.gameHeader} inert={explorationBlocked} aria-hidden={explorationBlocked || undefined}>
        <button
          type="button"
          className={styles.exitLink}
          aria-label="Open pause menu"
          disabled={Boolean(bestFriendSequence || sceneTransition || guidedWalk || conversationLeadIn)}
          onClick={() => {
            clearMovement();
            setPauseOpen(true);
          }}
        >☰</button>
        <div className={styles.brandLockup}>
          <img src="/images/brand/SeaPalsTCGLogoWhite.svg" alt="SeaPals TCG" />
          <span>REEFBOUND</span>
        </div>
        <div className={styles.locationPill}>
          <span>NOW EXPLORING</span>
          <strong key={sceneId} className={styles.locationName}>{LOCATION_NAMES[sceneId]}</strong>
        </div>
        <div className={styles.compactProgress} aria-label={`${progress} of ${townEncounterIds.length} local challenges won`}>
          {townChallengeTrainers.map((trainer) => (
            <span key={trainer.id} className={defeated.has(trainer.encounterId) ? styles.earned : ""}>★</span>
          ))}
        </div>
      </header>

      {saveNotice ? (
        <div
          key={saveNotice.message}
          className={`${styles.saveToast} ${saveNotice.kind === "error" ? styles.saveToastError : styles.saveToastInfo}`}
          role={saveNotice.kind === "error" ? "alert" : "status"}
        >{saveNotice.message}</div>
      ) : null}

      {sceneTransitionLabel || conversationLeadInLabel ? (
        <span className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
          {sceneTransitionLabel ?? conversationLeadInLabel}
        </span>
      ) : null}

      <div className={styles.gameLayout} inert={gameplaySurfaceLocked} aria-hidden={gameplaySurfaceLocked || undefined}>
        <aside className={styles.sidePanel}>
          <div className={styles.panelEyebrow}>Current quest</div>
          <h2>{questView.title}</h2>
          <p>{questView.description}</p>
          <div className={styles.questProgress}>
            <span style={{ width: `${(questView.value / questView.total) * 100}%` }} />
          </div>
          <strong>{questView.label}</strong>
          <div className={styles.controlLegend}>
            {boatMode ? (
              <>
                <div><kbd>W / S</kbd><span>Throttle / brake + reverse</span></div>
                <div><kbd>A / D</kbd><span>Rudder left / right</span></div>
                <div><kbd>↵</kbd><span>Dock when in reach</span></div>
              </>
            ) : (
              <>
                <div><kbd>{vehicleMode ? "TAB" : "WASD"}</kbd><span>{vehicleMode ? "Choose an instrument" : "Walk"}</span></div>
                <div><kbd>↵</kbd><span>{vehicleMode ? "Confirm the selected control" : "Interact"}</span></div>
              </>
            )}
          </div>
        </aside>

        <section className={styles.stageColumn} aria-label={`${LOCATION_NAMES[sceneId]} game area`}>
          <div className={styles.mobileQuestSummary} aria-label="Current quest progress">
            <span>{questView.title}</span>
            <strong>{questView.label}</strong>
            <div className={styles.questProgress} aria-hidden="true">
              <span style={{ width: `${(questView.value / questView.total) * 100}%` }} />
            </div>
          </div>
          {isChampionsWake && tournamentProgress ? (
            <TournamentBracketPanel progress={tournamentProgress} save={gameSave} compact />
          ) : null}
          <div className={styles.interactionBar} aria-live={boatMode ? undefined : "polite"}>
            <span className={interaction || vehicleMode || sceneTransition ? styles.readyDot : ""} />
            <span
              key={sceneTransition
                ? `${sceneTransition.targetSceneId}:${sceneTransition.phase}`
                : conversationLeadIn
                  ? `greeting:${conversationLeadIn.interactionId}`
                  : "steady-guidance"}
              className={bestFriendSequence || sceneTransition || guidedWalk || conversationLeadIn ? styles.sceneTransitionStatus : undefined}
            >
              {sceneTransitionLabel ?? conversationLeadInLabel ?? (vehicleMode
                ? trenchlightExpeditionState?.currentStep?.title ?? "Return to Mission Control for the next expedition decision"
                : boatMode
                  ? boatGuidance
                  : interactionLabel(
                    interaction,
                    sceneId,
                    trenchlightExpeditionState,
                    trenchlightBriefingComplete,
                    trenchlightGuideComplete,
                  ))}
            </span>
            {actionInteraction && !vehicleMode && !sceneTransition ? <kbd>ENTER</kbd> : null}
          </div>
          {boatMode ? (
            <span className={styles.srOnly} aria-live="polite" aria-atomic="true">
              {boatAnnouncement}
            </span>
          ) : null}
          {vehicleMode ? (
            <TrenchlightSubExpedition
              scene={scene}
              expeditionState={trenchlightExpeditionState}
              assistedMode={subAssistedMode}
              feedback={subFeedback}
              onToggleAssistance={() => setSubAssistedMode((enabled) => !enabled)}
              onAction={operateTrenchlightInstrument}
              onReturn={returnTrenchlightSubToStation}
            />
          ) : (
            <>
          <div
            className={`${styles.map} ${sceneTransition ? styles[`mapScene${sceneTransition.phase === "departing" ? "Departing" : "Arriving"}`] : ""}`}
            role="application"
            aria-busy={Boolean(sceneTransition)}
            aria-label={boatMode
              ? `Top-down sea route at ${LOCATION_NAMES[sceneId]}. Up or W increases throttle. Down or S brakes and reverses. Left and right or A and D move the rudder. Coast toward a dock and press Enter, Space, or the on-screen A button when it is in reach.`
              : `Top-down map of ${LOCATION_NAMES[sceneId]}. Use arrow keys or WASD to walk. Walk into doorways to enter or leave, and press Enter, Space, or the on-screen A button to interact.`}
          >
            <div
              className={`${styles.mapWorld} ${mapThemeClass} ${sceneTransition ? styles[`mapWorldScene${sceneTransition.phase === "departing" ? "Departing" : "Arriving"}`] : ""}`}
              style={{
                width: `${cameraLayout.worldWidthPercent}%`,
                height: `${cameraLayout.worldHeightPercent}%`,
                left: `${cameraLayout.leftPercent}%`,
                top: `${cameraLayout.topPercent}%`,
                gridTemplateColumns: `repeat(${scene.width}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${scene.height}, minmax(0, 1fr))`,
                backgroundImage: scene.artPath ? `url("${scene.artPath}")` : undefined,
              }}
            >
            {renderedLayeredObjects.map((object) => (
              <AdventureLayeredMapObject
                key={object.renderId ?? object.id}
                object={object}
                scene={scene}
              />
            ))}
            {sceneId === ELVERSON_AQUARIUM_SCENE_ID ? (
              <AdventureAquariumExhibits
                model={aquariumExhibitModel}
                reducedMotion={effectiveReducedMotion}
              />
            ) : null}
            {worldCueInteractions.map((candidate) => (
              <AdventureWorldCue
                key={`world-cue:${candidate.id}`}
                interaction={candidate}
                scene={scene}
                active={interaction?.interactionId === candidate.id}
                recommended={worldCueIsRecommended(
                  candidate,
                  ecosystemProgress,
                  ecosystemGuideMet,
                  destinationDock,
                )}
                complete={worldCueIsComplete(candidate, ecosystemProgress)}
              />
            ))}
            {renderedCharacterInteractions.map((characterInteraction) => {
              const trainer = TRAINERS[characterInteraction.trainerId ?? characterInteraction.npcId];
              const runtimeActor = actorStates[characterInteraction.id];
              const actorIsEngaged = activeConversationInteractionId === characterInteraction.id;
              const actorFacing = actorIsEngaged
                ? getAdventureFacingToward(
                    runtimeActor?.position ?? characterInteraction.at,
                    position,
                    runtimeActor?.facing ?? characterInteraction.facing ?? "down",
                  )
                : runtimeActor?.facing ?? "down";
              const actorIsScriptedWalker = runtimeActor?.moving === true && Boolean(
                momGreetingStage || bestFriendSequence || guidedWalk,
              );
              const actorAnimationMode = getAdventureActorAnimationMode({
                hasPatrol: Boolean(characterInteraction.patrol),
                isMoving: runtimeActor?.moving === true,
                isEngaged: actorIsEngaged,
                movementPaused: movementPaused && !actorIsScriptedWalker,
                pageVisible,
                reducedMotion: effectiveReducedMotion,
              });
              const tournamentActor = Boolean(
                trainer.encounterId
                && CHAMPIONS_WAKE_TOURNAMENT_ROUND_IDS.includes(trainer.encounterId),
              );
              const tournamentStatus = tournamentActor && isChampionsWake
                ? tournamentRoundStatus(tournamentProgress, trainer.encounterId, gameSave)
                : null;
              const trainerDefeated = Boolean(trainer.encounterId && (
                tournamentActor
                  ? tournamentProgress.completedRoundIds.includes(trainer.encounterId)
                  : defeated.has(trainer.encounterId)
              ));
              return (
                <AdventureTrainerSprite
                  key={characterInteraction.id ?? characterInteraction.interactionId}
                  trainer={trainer}
                  position={runtimeActor?.position ?? characterInteraction.at}
                  facing={actorFacing}
                  moving={actorAnimationMode === ADVENTURE_ACTOR_ANIMATION_MODES.WALKING}
                  steppingInPlace={actorAnimationMode === ADVENTURE_ACTOR_ANIMATION_MODES.STEPPING_IN_PLACE}
                  engaged={actorIsEngaged}
                  walkSpeed={characterInteraction.patrol?.speed ?? ADVENTURE_ACTOR_DEFAULTS.speed}
                  defeated={trainerDefeated}
                  status={tournamentStatus?.startsWith("Won") ? "Won" : tournamentStatus}
                  scene={scene}
                />
              );
            })}
            {momGreetingStage === "calling" && sceneId === ELVERSON_PROLOGUE_HOME_SCENE_ID ? (
              <div
                className={styles.overworldSpeechAnchor}
                style={actorPosition(
                  actorStates["interaction-elverson-prologue-player-mom"]?.position
                    ?? { x: 4.75, y: 4.55 },
                  scene,
                  "opening-mom-greeting",
                )}
                aria-live="assertive"
              >
                <span>{dialogueIdentity.playerName}! Good morning!</span>
              </div>
            ) : null}
            {boatMode ? (
              <AdventureBoatSprite
                position={position}
                facing={facing}
                heading={displayedBoatMotion.heading}
                speed={displayedBoatMotion.speed}
                moving={Math.abs(displayedBoatMotion.speed) > BOAT_MOTION_DEFAULTS.stoppedSpeed}
                interaction={actionInteraction}
                scene={scene}
              />
            ) : (
              <AdventurePlayerSprite
                position={position}
                facing={facing}
                moving={playerWalking}
                walkSpeed={playerWalkSpeed}
                interaction={actionInteraction}
                scene={scene}
                transitionPhase={sceneTransition?.phase ?? null}
                transitionVector={sceneTransitionVector}
              />
            )}
            </div>
            {bestFriendSequence?.phase === "calling" && sceneId === "town" ? (
              <div className={styles.openingNameCallout} role="status" aria-live="assertive">
                {dialogueIdentity.playerName}!!
              </div>
            ) : null}
            {sceneTransition ? (
              <div
                className={`${styles.sceneTransitionCurtain} ${styles[`sceneTransition${sceneTransition.phase === "departing" ? "Departing" : "Arriving"}`]}`}
                aria-hidden="true"
              >
                <span className={styles.sceneTransitionLeft} />
                <span className={styles.sceneTransitionRight} />
                <i className={styles.sceneTransitionSeam} />
              </div>
            ) : null}
          </div>

          {boatMode ? (
            <BoatHelmReadout
              motion={{ ...displayedBoatMotion, position }}
              maximumForwardSpeed={maximumBoatSpeed}
              destinationDock={destinationDockView}
              dockReady={dockReady}
            />
          ) : null}

          <div className={`${styles.controlDock} ${boatMode ? styles.boatControlDock : ""}`}>
            <div className={styles.dpad} aria-label={boatMode ? "Boat helm controls" : "Movement controls"}>
              <DirectionButton direction="up" ariaLabel={boatMode ? "Increase boat throttle" : "Walk up"} onStart={beginTouchDirection} onStop={endTouchDirection} />
              <DirectionButton direction="left" ariaLabel={boatMode ? "Turn rudder port, left" : "Walk left"} onStart={beginTouchDirection} onStop={endTouchDirection} />
              <span className={styles.dpadCenter} />
              <DirectionButton direction="right" ariaLabel={boatMode ? "Turn rudder starboard, right" : "Walk right"} onStart={beginTouchDirection} onStop={endTouchDirection} />
              <DirectionButton direction="down" ariaLabel={boatMode ? "Brake or reverse boat" : "Walk down"} onStart={beginTouchDirection} onStop={endTouchDirection} />
            </div>
            <button
              ref={worldActionRef}
              type="button"
              className={styles.actionButton}
              disabled={Boolean(sceneTransition || guidedWalk || conversationLeadIn) || !actionInteraction || (
                actionInteraction.type === "sub-launch"
                && (
                  !trenchlightExpeditionState?.canLaunch
                  || !trenchlightGuideComplete
                  || !trenchlightBriefingComplete
                )
              )}
              onClick={interact}
            >
              <span>A</span>
              {actionLabel(
                actionInteraction,
                trenchlightExpeditionState,
                trenchlightBriefingComplete,
                trenchlightGuideComplete,
              )}
            </button>
          </div>
            </>
          )}
        </section>

        <aside className={`${styles.sidePanel} ${styles.trainerPanel}`}>
          {isChampionsWake && tournamentProgress ? (
            <>
              <TournamentBracketPanel progress={tournamentProgress} save={gameSave} />
              <button
                type="button"
                className={styles.fieldNoteButton}
                onClick={() => {
                  setTournamentRegistrationError(null);
                  setTournamentRegistrationOpen(true);
                }}
              >{tournamentProgress.status === "active" ? "Review registered deck" : tournamentProgress.complete ? "View championship record" : "Open registration record"}</button>
              {fieldNoteAvailable ? (
                <button type="button" className={styles.tournamentQuietAction} onClick={() => {
                  setActiveFieldNoteId(unlockedFieldNotes.at(-1)?.id ?? SHELLSHORE_FIELD_NOTE.id);
                  setFieldNoteOpen(true);
                }}>Open latest Field Note</button>
              ) : null}
            </>
          ) : (
            <>
          <div className={styles.panelEyebrow}>{currentTownId === "shellshore-village" ? "Aquarium project" : ecosystemChapter?.ui.recordLabel ?? "Town record"}</div>
          <div className={`${styles.trainerCard} ${onboardingProgress.tutorialComplete ? styles.trainerCardWon : ""}`}>
            <span className={`${styles.miniPortrait} ${styles.portraitteal}`}>
              <CharacterPortrait character={ACADEMY_MENTOR_ID} facing="down" />
            </span>
            <span>
              <strong>{activeStarter?.name ?? "Starter waiting"}</strong>
              <small>{onboardingProgress.tutorialComplete ? "Aquarium lesson complete" : "Mr. Easterling's lesson"}</small>
              <em>{onboardingProgress.needsBoatSafetyReview
                ? "Field plan waiting"
                : onboardingProgress.tutorialComplete
                  ? "Field plan reviewed"
                  : `${onboardingProgress.completedCheckpointCount} / ${onboardingProgress.checkpointCount} steps`}</em>
            </span>
            <b>{onboardingProgress.tutorialComplete ? "\u2605" : "?"}</b>
          </div>
          {fieldNoteAvailable ? (
            <button type="button" className={styles.fieldNoteButton} onClick={() => {
              setActiveFieldNoteId(unlockedFieldNotes.at(-1)?.id ?? SHELLSHORE_FIELD_NOTE.id);
              setFieldNoteOpen(true);
            }}>Open latest Field Note</button>
          ) : null}
          {ecosystemChapter && ecosystemProgress ? (
            <div className={styles.sunpatchSurveySummary}>
              <strong>{ecosystemProgress.observedObservationIds.length} / {ecosystemProgress.requiredObservationIds.length} {ecosystemChapter.ui.observationNoun}</strong>
              <span>{ecosystemProgress.interpretation.correct ? "Evidence interpreted" : "Interpretation waiting"}</span>
              <span>{ecosystemProgress.response.correct ? "Response selected" : "Response waiting"}</span>
              <span>{ecosystemProgress.completedResidentEncounterIds.length} / {ecosystemProgress.residentEncounterIds.length} resident perspectives</span>
            </div>
          ) : null}
          <div className={styles.panelEyebrow}>{ecosystemChapter?.ui.challengerLabel ?? "Village challengers"}</div>
          {townChallengeTrainers.map((trainer) => {
            const won = defeated.has(trainer.encounterId);
            return (
              <div key={trainer.id} className={`${styles.trainerCard} ${won ? styles.trainerCardWon : ""}`}>
                <span className={`${styles.miniPortrait} ${styles[`portrait${trainer.color}`]}`}>
                  <CharacterPortrait character={trainer.id} facing="down" />
                </span>
                <span>
                  <strong>{trainer.name}</strong>
                  <small>{trainer.title}</small>
                  <em>{won ? `${trainer.crest ?? "Challenge"} earned` : `${trainer.difficulty} · ${trainer.victoryTarget} VP`}</em>
                </span>
                <b>{won ? "★" : "?"}</b>
              </div>
            );
          })}
          {progress ? (
            <button type="button" className={styles.resetButton} onClick={requestRestart}>Restart adventure</button>
          ) : null}
            </>
          )}
        </aside>
      </div>

      {activeConversationTrainer ? (
        <Conversation
          conversation={conversation}
          trainer={activeConversationTrainer}
          defeated={defeated.has(activeConversationTrainer.encounterId)}
          blocked={Boolean(confirmation || starterSelectionOpen || fieldNoteOpen || inventoryOpen || decksOpen || worldMapOpen || fieldworkActivity)}
          primaryLabel={conversationPrimaryLabel()}
          secondaryLabel={conversationSecondaryAction?.label}
          textSpeed={gameSave.settings.textSpeed}
          reducedMotion={gameSave.settings.reducedMotion}
          identity={dialogueIdentity}
          onAdvance={advanceConversation}
          onPrimary={handleConversationPrimary}
          onSecondary={conversationSecondaryAction?.kind === "exhibition"
            ? () => setConversation({
                trainerId: SUNPATCH_EXHIBITION_TRAINER_ID,
                index: 0,
                mode: "exhibitionOffer",
                sceneId: conversation.sceneId,
                interactionId: conversation.interactionId,
              })
            : conversationSecondaryAction?.kind === "close"
              ? closeConversation
              : null}
        />
      ) : null}
      {starterSelectionOpen ? (
        <StarterSelectionModal
          starters={STARTER_DECKS}
          selectedId={selectedStarterId}
          blocked={Boolean(confirmation)}
          onSelect={setSelectedStarterId}
          onConfirm={requestStarterCommit}
          onClose={() => {
            setStarterSelectionOpen(false);
            setSelectedStarterId(null);
          }}
        />
      ) : null}
      {fieldNoteOpen ? (
        <FieldNoteModal
          note={activeFieldNote}
          notes={unlockedFieldNotes}
          blocked={Boolean(confirmation)}
          reviewRequired={activeFieldNote.id === SHELLSHORE_FIELD_NOTE.id && onboardingProgress.needsBoatSafetyReview}
          onSelect={setActiveFieldNoteId}
          onAcknowledge={acknowledgeFieldNote}
          onDismiss={() => setFieldNoteOpen(false)}
        />
      ) : null}
      {inventoryOpen ? (
        <InventoryModal
          inventory={gameSave.inventory}
          fishingProgress={fishingProgress}
          reveal={packReveal}
          notice={saveNotice}
          blocked={Boolean(confirmation)}
          onOpenPack={openInventoryPack}
          onBuildDeck={() => {
            setInventoryOpen(false);
            setDecksOpen(true);
          }}
          onClose={() => {
            setInventoryOpen(false);
            setPackReveal(null);
          }}
        />
      ) : null}
      {tournamentRegistrationOpen && tournamentAvailability && tournamentProgress ? (
        <TournamentRegistrationModal
          availability={tournamentAvailability}
          progress={tournamentProgress}
          activeDeckName={activeDeckName}
          deckReadiness={tournamentDeckReadiness}
          notice={tournamentRegistrationError ?? saveNotice}
          blocked={Boolean(confirmation)}
          onRegister={registerForChampionsWake}
          onSaveRegistration={saveChampionsWakeRegistration}
          onDecks={() => {
            setTournamentRegistrationOpen(false);
            setTournamentRegistrationError(null);
            setDecksReturnContext("tournament-registration");
            setDecksOpen(true);
          }}
          onClose={() => {
            setTournamentRegistrationOpen(false);
            setTournamentRegistrationError(null);
          }}
        />
      ) : null}
      {decksOpen ? (
        <AdventureDecksModal
          save={gameSave}
          notice={saveNotice}
          blocked={Boolean(confirmation)}
          featuredCardIds={packReveal?.cards ?? []}
          onCommit={commitDeckWorkshopSave}
          onClose={() => {
            setDecksOpen(false);
            setPackReveal(null);
            if (decksReturnContext === "tournament-registration") {
              setDecksReturnContext(null);
              setTournamentRegistrationOpen(true);
            }
          }}
        />
      ) : null}
      {worldMapOpen ? (
        <AdventureWorldMapModal
          model={worldMapModel}
          notice={saveNotice}
          blocked={Boolean(confirmation)}
          onAutoSteer={autoSteerRoute}
          autoSteerEnabled={gameSave.settings.boatAutoSteer}
          onClose={() => setWorldMapOpen(false)}
        />
      ) : null}
      {fieldworkActivity ? (
        <AdventureFieldworkModal
          activity={fieldworkActivity}
          progress={activeFieldworkProgress}
          definition={activeFieldworkChapter?.ui}
          feedback={fieldworkFeedback}
          blocked={Boolean(confirmation)}
          onChoose={submitFieldworkChoice}
          onClose={() => {
            setFieldworkActivity(null);
            setFieldworkFeedback(null);
          }}
        />
      ) : null}
      {fishingSession ? (
        <AdventureHandNetModal
          tutorial={fishingSession.tutorial}
          required={fishingSession.required}
          startWithCast={fishingSession.startWithCast}
          reducedMotion={gameSave.settings.reducedMotion || systemReducedMotion}
          onCatch={saveFishingCatch}
          onClose={closeFishingSession}
          onReturnToShore={returnFishingSessionToShore}
        />
      ) : null}
      {showCompletion ? (
        <ElversonAquariumMilestone blocked={Boolean(confirmation)} onContinue={() => setShowCompletion(false)} onReset={requestRestart} />
      ) : null}
      {championshipEndingStage ? (
        <ChampionshipEnding
          stage={championshipEndingStage}
          replay={championshipEndingReplay}
          blocked={Boolean(confirmation)}
          textSpeed={gameSave.settings.textSpeed}
          reducedMotion={gameSave.settings.reducedMotion}
          onAdvance={advanceChampionshipEnding}
        />
      ) : null}
      {newsletterInviteOpen ? (
        <NewsletterOptInModal
          error={newsletterInviteError}
          submitting={newsletterInviteSubmitting}
          onDismiss={dismissNewsletterInvite}
          onSubmit={submitNewsletterInvite}
        />
      ) : null}
      {settingsOpen ? (
        <AdventureSettingsModal
          save={gameSave}
          notice={saveNotice}
          blocked={Boolean(confirmation)}
          onCommit={(nextSave, meta) => {
            const saved = commitAdventureMutation(nextSave, meta.checkpointId, meta.message);
            if (!saved.ok) {
              throw new Error("Settings changed for this session, but the save could not be written. Retry Save game before leaving.");
            }
          }}
          onClose={() => {
            setSettingsOpen(false);
            setPauseOpen(true);
          }}
        />
      ) : null}
      {pauseOpen ? (
        <PauseMenu
          profileId={gameSave.profileId}
          notice={saveNotice}
          blocked={Boolean(confirmation)}
          fieldNoteCount={unlockedFieldNotes.length}
          activeDeckName={activeDeckName}
          unopenedPackCount={unopenedPackCount}
          onResume={() => setPauseOpen(false)}
          onSave={manualSave}
          onDecks={() => {
            setPauseOpen(false);
            setDecksOpen(true);
          }}
          onInventory={() => {
            setPauseOpen(false);
            setPackReveal(null);
            setInventoryOpen(true);
          }}
          onSettings={() => {
            setPauseOpen(false);
            setSettingsOpen(true);
          }}
          onFieldNote={() => {
            setPauseOpen(false);
            setActiveFieldNoteId(unlockedFieldNotes.at(-1)?.id ?? SHELLSHORE_FIELD_NOTE.id);
            setFieldNoteOpen(true);
          }}
          onReturnTitle={returnToTitle}
          onRestart={requestRestart}
        />
      ) : null}
      {confirmation ? (
        <ConfirmDialog
          {...confirmation}
          onConfirm={() => {
            const action = confirmation.onConfirm;
            setConfirmation(null);
            action();
          }}
          onCancel={() => setConfirmation(null)}
        />
      ) : null}
      <div className={styles.saveAnnouncer} aria-live="polite">
        {saveNotice?.kind === "info" ? saveNotice.message : ""}
      </div>
    </main>
  );
}
