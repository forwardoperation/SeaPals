export const ELVERSON_DOCK_SPEECH_INTERACTION_ID =
  "interaction-elverson-dock-speech-mentor";

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

export const ELVERSON_DOCK_SPEECH_RESTORE_POSITION = Object.freeze({
  x: 20,
  y: 17,
});

export const ELVERSON_MOM_GREETING_POSITION = Object.freeze({
  x: 6.15,
  y: 3.55,
});

const DOCK_AUDIENCE_POSITIONS = Object.freeze([
  ...Array.from({ length: 25 }, (_, index) => Object.freeze({
    x: 12.3 + (index * 0.65),
    y: 16.35,
  })),
  ...Array.from({ length: 23 }, (_, index) => Object.freeze({
    x: 9.7 + (index * 0.65),
    y: 17.15,
  })),
]);

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
  if (audienceIds.length > DOCK_AUDIENCE_POSITIONS.length) {
    throw new RangeError(
      `Elverson dock speech has ${audienceIds.length} audience members but only ${DOCK_AUDIENCE_POSITIONS.length} safe positions.`,
    );
  }

  return Object.freeze([
    Object.freeze({
      id: ELVERSON_DOCK_SPEECH_INTERACTION_ID,
      type: "npc",
      npcId: mentorId,
      at: ELVERSON_DOCK_SPEECH_MENTOR_POSITION,
      facing: "up",
    }),
    ...audienceIds.map((npcId, index) => Object.freeze({
      id: `interaction-elverson-dock-speech-audience-${npcId}`,
      type: "npc",
      npcId,
      at: DOCK_AUDIENCE_POSITIONS[index],
      facing: "down",
    })),
  ]);
}
