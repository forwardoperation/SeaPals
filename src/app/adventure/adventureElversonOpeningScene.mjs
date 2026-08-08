import { ELVERSON_TOWN_ROADS } from "./adventureElversonTownLayout.mjs";

export const ELVERSON_DOCK_SPEECH_INTERACTION_ID =
  "interaction-elverson-dock-speech-mentor";
export const ELVERSON_BEST_FRIEND_ARRIVAL_INTERACTION_ID =
  "interaction-elverson-best-friend-arrival";

export const ELVERSON_DOCK_SPEECH_TRIGGER = Object.freeze({
  left: 18.75,
  top: 15.35,
  right: 22.25,
  bottom: 16.05,
});

export const ELVERSON_DOCK_SPEECH_PLAYER_POSITION = Object.freeze({
  x: 20.5,
  y: 15.7,
});

export const ELVERSON_DOCK_SPEECH_MENTOR_POSITION = Object.freeze({
  x: 20.5,
  y: 19,
});

// Keep the speech group high enough to clear the fixed bottom dialogue box.
// The vertical target accounts for the artwork extending above and below each
// actor cell, so neither the player's head nor Mr. Easterling's feet are cropped.
export const ELVERSON_DOCK_SPEECH_CAMERA_POSITION = Object.freeze({
  x: ((ELVERSON_DOCK_SPEECH_PLAYER_POSITION.x + 0.5)
    + (ELVERSON_DOCK_SPEECH_MENTOR_POSITION.x + 0.5)) / 2,
  y: 18.6,
});

export const ELVERSON_DOCK_SPEECH_RESTORE_POSITION = Object.freeze({
  x: 20,
  y: 17,
});

export const ELVERSON_MOM_GREETING_POSITION = Object.freeze({
  x: 6.15,
  y: 3.55,
});

export const ELVERSON_MOM_GREETING_PATH = Object.freeze([
  Object.freeze({ x: 4.75, y: 4.55 }),
  Object.freeze({ x: 6.15, y: 4.55 }),
  ELVERSON_MOM_GREETING_POSITION,
]);

export const ELVERSON_BEST_FRIEND_ARRIVAL_POSITION = Object.freeze({
  x: 11.2,
  y: 5.05,
});

export const ELVERSON_BEST_FRIEND_MEETING_POSITION = Object.freeze({
  x: 4.5,
  y: 5.05,
});

export const ELVERSON_BEST_FRIEND_ARRIVAL_PATH = Object.freeze([
  ELVERSON_BEST_FRIEND_ARRIVAL_POSITION,
  Object.freeze({ x: 8, y: 5.05 }),
  ELVERSON_BEST_FRIEND_MEETING_POSITION,
]);

export const ELVERSON_BEST_FRIEND_DOCK_WALK = Object.freeze({
  leader: Object.freeze([
    ELVERSON_BEST_FRIEND_MEETING_POSITION,
    Object.freeze({ x: 8, y: 5.8 }),
    Object.freeze({ x: 20.5, y: 5.8 }),
    Object.freeze({ x: 20.5, y: 14.8 }),
    Object.freeze({ x: 21.2, y: 15.7 }),
  ]),
  follower: Object.freeze([
    Object.freeze({ x: 3.55, y: 5.05 }),
    Object.freeze({ x: 7.2, y: 6.2 }),
    Object.freeze({ x: 19.7, y: 6.2 }),
    Object.freeze({ x: 19.7, y: 14.8 }),
    ELVERSON_DOCK_SPEECH_PLAYER_POSITION,
  ]),
});

const DOCK_AUDIENCE_COLUMN_COUNT = 12;
const DOCK_AUDIENCE_COLUMN_SPACING = 0.65;
const DOCK_AUDIENCE_STAGGER = DOCK_AUDIENCE_COLUMN_SPACING / 2;
const DOCK_AUDIENCE_AISLE_PADDING = 0.25;
const waterfrontPromenade = ELVERSON_TOWN_ROADS.waterfrontPromenade.bounds;
const dockAudienceBackRowY = waterfrontPromenade.top;
const dockAudienceFrontRowY = waterfrontPromenade.top + 0.18;
const dockAudienceInnerLeftX = ELVERSON_DOCK_SPEECH_TRIGGER.left
  - DOCK_AUDIENCE_AISLE_PADDING;
const dockAudienceInnerRightX = ELVERSON_DOCK_SPEECH_TRIGGER.right
  + DOCK_AUDIENCE_AISLE_PADDING;

export const ELVERSON_DOCK_AUDIENCE_POSITIONS = Object.freeze(
  Array.from({ length: DOCK_AUDIENCE_COLUMN_COUNT }, (_, columnIndex) => {
    const columnOffset = columnIndex * DOCK_AUDIENCE_COLUMN_SPACING;
    return [
      Object.freeze({
        x: dockAudienceInnerLeftX - columnOffset,
        y: dockAudienceBackRowY,
      }),
      Object.freeze({
        x: dockAudienceInnerRightX + columnOffset,
        y: dockAudienceBackRowY,
      }),
      Object.freeze({
        x: dockAudienceInnerLeftX - DOCK_AUDIENCE_STAGGER - columnOffset,
        y: dockAudienceFrontRowY,
      }),
      Object.freeze({
        x: dockAudienceInnerRightX + DOCK_AUDIENCE_STAGGER + columnOffset,
        y: dockAudienceFrontRowY,
      }),
    ];
  }).flat(),
);

function createDockSpeechGesture(index, { speaker = false } = {}) {
  if (speaker) {
    return Object.freeze({
      kind: "speaker",
      baseFacing: "up",
      durationMs: 3600,
      delayMs: 0,
    });
  }
  if (index % 4 === 3) return null;
  const durationMs = 6800 + ((index % 5) * 520);
  return Object.freeze({
    kind: index % 2 === 0 ? "audience-left" : "audience-right",
    baseFacing: "down",
    durationMs,
    delayMs: -((index * 1379) % durationMs),
  });
}

export function isElversonDockSpeechTriggerPosition(position) {
  return Boolean(
    Number.isFinite(position?.x)
    && Number.isFinite(position?.y)
    && position.x >= ELVERSON_DOCK_SPEECH_TRIGGER.left
    && position.x <= ELVERSON_DOCK_SPEECH_TRIGGER.right
    && position.y >= ELVERSON_DOCK_SPEECH_TRIGGER.top
    && position.y <= ELVERSON_DOCK_SPEECH_TRIGGER.bottom
  );
}

/**
 * Builds a render-only waterfront gathering. The IDs deliberately differ from
 * authored resident interactions so dismissing the cutscene restores every
 * actor to the scene coordinates in adventureContent without mutating them.
 */
export function createElversonDockSpeechInteractions(
  npcIds,
  { mentorId = "academy-mentor" } = {},
) {
  if (!Array.isArray(npcIds)) {
    throw new TypeError("Elverson dock speech NPC IDs must be an array.");
  }
  const uniqueNpcIds = [...new Set(npcIds.map((npcId) => String(npcId ?? "").trim()))]
    .filter(Boolean);
  if (!uniqueNpcIds.includes(mentorId)) {
    throw new RangeError("Elverson dock speech requires Mr. Easterling in the cast.");
  }
  const audienceIds = uniqueNpcIds.filter((npcId) => npcId !== mentorId);
  if (audienceIds.length > ELVERSON_DOCK_AUDIENCE_POSITIONS.length) {
    throw new RangeError(
      `Elverson dock speech has ${audienceIds.length} audience members but only ${ELVERSON_DOCK_AUDIENCE_POSITIONS.length} safe positions.`,
    );
  }

  return Object.freeze([
    Object.freeze({
      id: ELVERSON_DOCK_SPEECH_INTERACTION_ID,
      type: "npc",
      npcId: mentorId,
      at: ELVERSON_DOCK_SPEECH_MENTOR_POSITION,
      facing: "up",
      dockSpeechGesture: createDockSpeechGesture(0, { speaker: true }),
    }),
    ...audienceIds.map((npcId, index) => Object.freeze({
      id: `interaction-elverson-dock-speech-audience-${npcId}`,
      type: "npc",
      npcId,
      at: ELVERSON_DOCK_AUDIENCE_POSITIONS[index],
      facing: "down",
      dockSpeechGesture: createDockSpeechGesture(index),
    })),
  ]);
}
