"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Simulator from "@/app/simulator/Simulator";
import {
  SCENES,
  START_STATE,
  getContinuousInteraction,
  movePlayerContinuous,
} from "./adventureWorld.mjs";
import {
  ADVENTURE_CONTENT,
  getAdventureStarterDeck,
  resolveAdventureNpc,
  resolveAdventureTutorial,
} from "./adventureContent.mjs";
import {
  commitStarterSelection,
  getOnboardingProgress,
  recordBoatSafetyReview,
  recordPracticeDuelResult,
  recordTutorialCheckpoint,
  recoverOnboardingResume,
} from "./adventureOnboarding.mjs";
import {
  ADVENTURE_PROFILE_IDS,
  createAdventureStorageAdapter,
} from "./adventureStorage.mjs";
import {
  SHELLSHORE_RESIDENT_ENCOUNTER_IDS,
  completeAdventureEncounter,
  createNewAdventureSession,
  enterAdventureScene,
  recoverAdventureResume,
} from "./adventureSession.mjs";
import styles from "./adventure.module.css";

const TRAINERS = Object.freeze(Object.fromEntries(
  ADVENTURE_CONTENT.npcs
    .filter((npc) => npc.townId === "shellshore-village" && npc.encounterId)
    .map((npc) => {
      const resolved = resolveAdventureNpc(npc.id);
      return [npc.id, Object.freeze({
        ...npc,
        deckId: resolved.encounter.opponentDeckId,
        difficulty: resolved.encounter.difficulty,
        victoryTarget: resolved.encounter.victoryTarget,
        dialogue: resolved.conversation.lines,
        intro: resolved.conversation.lines.intro,
        rematch: resolved.conversation.lines.rematch,
        victory: resolved.conversation.lines.victory,
      })];
    }),
));

const ACADEMY_MENTOR_ID = "academy-mentor";
const SHELLSHORE_TUTORIAL = resolveAdventureTutorial("tutorial-shellshore-live-basics");
const SHELLSHORE_FIELD_NOTE = SHELLSHORE_TUTORIAL.fieldNote;
const STARTER_DECKS = Object.freeze(SHELLSHORE_TUTORIAL.starterDecks);
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

const MOVEMENT_VECTORS = Object.freeze({
  up: Object.freeze({ x: 0, y: -1 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  right: Object.freeze({ x: 1, y: 0 }),
});

function actorPosition(position, scene) {
  return {
    left: `${((position.x + 0.5) / scene.width) * 100}%`,
    top: `${((position.y + 0.5) / scene.height) * 100}%`,
    width: `${100 / scene.width}%`,
    height: `${100 / scene.height}%`,
    zIndex: 20 + Math.round(position.y * 10),
  };
}

function SpriteArtwork({ character = "player", facing = "down", moving = false, portrait = false }) {
  const facingName = `${facing[0].toUpperCase()}${facing.slice(1)}`;
  return (
    <span
      className={`${styles.spriteArtwork} ${styles[`${character}SpriteArtwork`]} ${styles[`spriteFacing${facingName}`]} ${moving ? styles.spriteWalking : ""} ${portrait ? styles.spritePortrait : ""}`}
      aria-hidden="true"
    />
  );
}

function AdventureTrainerSprite({ trainer, position, defeated, scene }) {
  return (
    <div
      className={styles.characterCell}
      style={actorPosition(position, scene)}
      aria-label={`${trainer.name}, ${trainer.title}`}
    >
      <span className={styles.characterShadow} />
      <SpriteArtwork character={trainer.id} facing="down" />
      <span className={`${styles.trainerMarker} ${defeated ? styles.trainerDefeated : ""}`}>
        {defeated ? "★" : "!"}
      </span>
    </div>
  );
}

function AdventurePlayerSprite({ position, facing, moving, interaction, scene }) {
  return (
    <div
      className={`${styles.characterCell} ${styles.playerCell}`}
      style={actorPosition(position, scene)}
      aria-label="You"
    >
      <span className={styles.characterShadow} />
      <SpriteArtwork facing={facing} moving={moving} />
      {interaction ? <span className={styles.actionCue} aria-hidden="true">A</span> : null}
    </div>
  );
}

function movementVector(keyDirections, touchDirections) {
  const vector = { x: 0, y: 0 };
  for (const direction of [...keyDirections.values(), ...touchDirections]) {
    const delta = MOVEMENT_VECTORS[direction];
    if (delta) {
      vector.x += delta.x;
      vector.y += delta.y;
    }
  }
  return vector;
}

function movementFacing(keyDirections, touchDirections, vector) {
  const activeDirections = [...keyDirections.values(), ...touchDirections];
  for (let index = activeDirections.length - 1; index >= 0; index -= 1) {
    const direction = activeDirections[index];
    const delta = MOVEMENT_VECTORS[direction];
    if (delta && delta.x * vector.x + delta.y * vector.y > 0) return direction;
  }
  return Math.abs(vector.x) >= Math.abs(vector.y)
    ? vector.x > 0 ? "right" : "left"
    : vector.y > 0 ? "down" : "up";
}

function conversationLines(conversation, trainer, defeated) {
  if (Array.isArray(conversation?.lines) && conversation.lines.length) return conversation.lines;
  const authored = trainer.dialogue?.[conversation?.mode];
  if (Array.isArray(authored) && authored.length) return authored;
  return defeated ? trainer.rematch : trainer.intro;
}

function Conversation({
  conversation,
  trainer,
  defeated,
  blocked = false,
  primaryLabel,
  secondaryLabel = "Not yet",
  onAdvance,
  onPrimary,
  onSecondary,
}) {
  const dialogRef = useDialogFocusTrap(!blocked);
  const lines = conversationLines(conversation, trainer, defeated);
  const finalLine = conversation.index === lines.length - 1;

  return (
    <div ref={dialogRef} tabIndex={-1} inert={blocked} aria-hidden={blocked || undefined} data-adventure-modal="true" className={styles.dialogueLayer} role="dialog" aria-modal="true" aria-labelledby="dialogue-speaker">
      <div className={styles.dialogueBox}>
        <div className={`${styles.portrait} ${styles[`portrait${trainer.color}`]}`}>
          <SpriteArtwork character={trainer.id} facing="down" portrait />
        </div>
        <div className={styles.dialogueCopy}>
          <div className={styles.dialogueMeta}>
            <strong id="dialogue-speaker">{trainer.name}</strong>
            <span>{trainer.title}</span>
          </div>
          <p>{lines[conversation.index]}</p>
          <div className={styles.dialogueActions}>
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
          </div>
        </div>
      </div>
    </div>
  );
}

function DirectionButton({ direction, label, onStart, onStop }) {
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
      aria-label={`Walk ${direction}`}
      onPointerDown={startPointer}
      onPointerUp={stopPointer}
      onPointerCancel={stopPointer}
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
    >
      {label}
    </button>
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
    return "Saved voyage";
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

function TitleScreen({ profiles, notice, blocked = false, onContinue, onNewGame, onRetry }) {
  const dialogRef = useDialogFocusTrap(!blocked);
  return (
    <div ref={dialogRef} tabIndex={-1} inert={blocked} aria-hidden={blocked || undefined} data-adventure-modal="true" className={`${styles.introLayer} ${styles.titleLayer}`} role="dialog" aria-modal="true" aria-labelledby="adventure-title">
      <div className={`${styles.introCard} ${styles.titleCard}`}>
        <div className={styles.introEyebrow}>A SeaPals Story</div>
        <h1 id="adventure-title">REEFBOUND</h1>
        <div className={styles.introDivider}><span>◆</span></div>
        <p>
          Choose one of three local voyage slots. Explore Shellshore, meet its Reefkeepers,
          and save your progress whenever you pause.
        </p>
        {notice ? (
          <div className={`${styles.saveNotice} ${notice.kind === "error" ? styles.saveNoticeError : styles.saveNoticeInfo}`} role={notice.kind === "error" ? "alert" : "status"}>
            {notice.message}
          </div>
        ) : null}
        <div className={styles.profileGrid} aria-label="Adventure save profiles">
          {profiles.map((profile) => (
            <section key={profile.profileId} className={`${styles.profileCard} ${profile.canContinue ? styles.profileCardUsed : ""}`}>
              <div className={styles.profileSlot}>Voyage {profile.slot}</div>
              {profile.canContinue ? (
                <>
                  <strong>{LOCATION_NAMES[profile.sceneId] ?? "Recovered location"}</strong>
                  <span>{profile.completedEncounterCount} encounters complete</span>
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
                  <strong>{profile.occupied ? "Save needs recovery" : "Empty voyage"}</strong>
                  <span>{profile.occupied ? "No valid copy could be loaded." : "Begin at Shellshore Academy."}</span>
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

function PauseMenu({
  profileId,
  notice,
  blocked = false,
  fieldNoteAvailable = false,
  onResume,
  onSave,
  onFieldNote,
  onReturnTitle,
  onRestart,
}) {
  const dialogRef = useDialogFocusTrap(!blocked);
  return (
    <div ref={dialogRef} tabIndex={-1} inert={blocked} aria-hidden={blocked || undefined} data-adventure-modal="true" className={styles.pauseLayer} role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <div className={styles.pauseCard}>
        <div className={styles.introEyebrow}>Voyage {ADVENTURE_PROFILE_IDS.indexOf(profileId) + 1}</div>
        <h2 id="pause-title">Adventure paused</h2>
        <p>Your current safe position and quest progress can be saved to this device.</p>
        {notice ? (
          <div className={`${styles.saveNotice} ${notice.kind === "error" ? styles.saveNoticeError : styles.saveNoticeInfo}`} role={notice.kind === "error" ? "alert" : "status"}>
            {notice.message}
          </div>
        ) : null}
        <div className={styles.pauseActions}>
          <button type="button" autoFocus onClick={onResume}>Resume</button>
          <button type="button" onClick={onSave}>Save game</button>
          {fieldNoteAvailable ? <button type="button" onClick={onFieldNote}>Open Harbor Field Note</button> : null}
          <button type="button" className={styles.secondaryButton} onClick={onReturnTitle}>Save and return to title</button>
          <button type="button" className={styles.dangerButton} onClick={onRestart}>Restart this voyage</button>
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
        <div className={styles.introEyebrow}>Professor Current&apos;s three partners</div>
        <h2 id="starter-title">Choose your starter deck</h2>
        <p>Each is a complete 60-card deck and can finish the voyage. Compare how they play, then choose once for this save.</p>
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
              <small><b>Professor&apos;s tip:</b> {starter.watchFor}</small>
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

function FieldNoteModal({ note, blocked = false, reviewRequired = false, onAcknowledge, onDismiss }) {
  const dialogRef = useDialogFocusTrap(!blocked);
  return (
    <div ref={dialogRef} tabIndex={-1} inert={blocked} aria-hidden={blocked || undefined} data-adventure-modal="true" className={styles.fieldNoteLayer} role="dialog" aria-modal="true" aria-labelledby="field-note-title">
      <article className={styles.fieldNoteCard}>
        <header>
          <div>
            <div className={styles.fieldNoteEyebrow}>Field Note 01 / Shellshore Harbor</div>
            <h2 id="field-note-title">{note.title}</h2>
          </div>
          <button type="button" className={styles.noteCloseIcon} aria-label="Close Field Note" onClick={onDismiss}>×</button>
        </header>
        <p className={styles.fieldNoteSummary}>{note.summary}</p>
        <section>
          <h3>What we observed</h3>
          <ul>{note.observations.map((observation) => <li key={observation}>{observation}</li>)}</ul>
        </section>
        <section className={styles.safetyPanel}>
          <h3>Boat safety check</h3>
          <ul>{note.safetyChecklist.map((item) => <li key={item}>{item}</li>)}</ul>
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

function Completion({ blocked = false, onContinue, onReset }) {
  const dialogRef = useDialogFocusTrap(!blocked);
  return (
    <div ref={dialogRef} tabIndex={-1} inert={blocked} aria-hidden={blocked || undefined} data-adventure-modal="true" className={styles.introLayer} role="dialog" aria-modal="true" aria-labelledby="completion-title">
      <div className={`${styles.introCard} ${styles.completionCard}`}>
        <div className={styles.crestPair}><span>★</span><span>★</span></div>
        <div className={styles.introEyebrow}>Both crests earned</div>
        <h2 id="completion-title">TIDEBOUND CHAMPION</h2>
        <p>
          Marina and Dorian recognize your skill. You explored both homes and conquered two
          different SeaPals strategies.
        </p>
        <div className={styles.completionActions}>
          <button type="button" autoFocus onClick={onContinue}>Keep exploring</button>
          <button type="button" className={styles.quietButton} onClick={onReset}>Start over</button>
        </div>
      </div>
    </div>
  );
}

function interactionLabel(interaction, sceneId) {
  if (!interaction) return "Walk closer to a door or Reefkeeper";
  if (interaction.type === "trainer") return `Talk to ${TRAINERS[interaction.trainerId]?.name ?? "Reefkeeper"}`;
  if (interaction.type === "exit") return sceneId === "academy-lab" ? "Leave the academy" : "Leave this home";
  if (interaction.targetScene) return `Enter ${LOCATION_NAMES[interaction.targetScene] ?? "building"}`;
  return "Interact";
}

export default function AdventureGame() {
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
  const [gameSave, setGameSave] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [activeTrainerId, setActiveTrainerId] = useState(null);
  const [postDuelConversation, setPostDuelConversation] = useState(null);
  const [starterSelectionOpen, setStarterSelectionOpen] = useState(false);
  const [selectedStarterId, setSelectedStarterId] = useState(null);
  const [fieldNoteOpen, setFieldNoteOpen] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [saveNotice, setSaveNotice] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [isMoving, setIsMoving] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const keyboardDirectionsRef = useRef(new Map());
  const touchDirectionsRef = useRef(new Set());
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

  const setDirty = useCallback((value) => {
    dirtyRef.current = Boolean(value);
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
  const fieldNoteAvailable = Boolean(
    gameSave?.fieldNotes.entryIds.includes(SHELLSHORE_FIELD_NOTE.id),
  );
  const scene = SCENES[sceneId];
  const movementPaused = screen !== "playing"
    || pauseOpen
    || Boolean(confirmation)
    || Boolean(conversation)
    || Boolean(activeTrainerId)
    || starterSelectionOpen
    || fieldNoteOpen
    || showCompletion;
  movementPausedRef.current = movementPaused;
  const interaction = useMemo(
    () => screen === "playing" && gameSave
      ? getContinuousInteraction(sceneId, position, facing)
      : null,
    [facing, gameSave, position, sceneId, screen],
  );

  const setMovementActive = useCallback((nextActive) => {
    if (movementActiveRef.current === nextActive) return;
    movementActiveRef.current = nextActive;
    setIsMoving(nextActive);
  }, []);

  const clearMovement = useCallback(() => {
    keyboardDirectionsRef.current.clear();
    touchDirectionsRef.current.clear();
    setMovementActive(false);
  }, [setMovementActive]);

  const syncMovementActive = useCallback(() => {
    const vector = movementVector(keyboardDirectionsRef.current, touchDirectionsRef.current);
    setMovementActive(
      !movementPausedRef.current && (vector.x !== 0 || vector.y !== 0),
    );
  }, [setMovementActive]);

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
        message: "This voyage is not connected to a writable save slot yet. Open the pause menu and choose Save game to claim the slot safely.",
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

  useEffect(() => {
    try {
      const adapter = createAdventureStorageAdapter({ backend: window.localStorage });
      storageRef.current = adapter;
      let listed = adapter.listProfileSummaries();
      if (listed.profiles.every((profile) => !profile.occupied)) {
        const migration = adapter.migrateLegacyProfile("profile-1");
        if (migration.ok && migration.migrated) {
          setSaveNotice({ kind: "info", message: "Your earlier Shellshore progress was recovered into Voyage 1." });
          listed = adapter.listProfileSummaries();
        } else if (!migration.ok && migration.error?.code !== "OVERWRITE_CONFIRMATION_REQUIRED") {
          setSaveNotice({ kind: "error", message: `${migration.error?.message ?? "Earlier progress could not be imported."} You can still begin a new voyage.` });
        }
      }
      setProfiles(listed.profiles);
    } catch (error) {
      setProfiles((current) => current.map((profile) => ({ ...profile, status: "unavailable" })));
      setSaveNotice({ kind: "error", message: `Local saves are unavailable: ${error?.message ?? "storage access failed"}.` });
    }
    setScreen("title");
  }, []);

  function installSession(nextSave, { storageAuthorized = false } = {}) {
    saveRef.current = nextSave;
    profileWriteAuthorizedRef.current = storageAuthorized;
    setGameSave(nextSave);
    setConversation(null);
    setActiveTrainerId(null);
    setPostDuelConversation(null);
    setStarterSelectionOpen(false);
    setSelectedStarterId(null);
    setFieldNoteOpen(false);
    setShowCompletion(false);
    setPauseOpen(false);
    setConfirmation(null);
    setScreen("playing");
  }

  function beginNewGame(profileId, overwriteConfirmed = false) {
    const adapter = storageRef.current;
    const initial = createNewAdventureSession(profileId);
    let storageResult = null;
    if (adapter) {
      storageResult = adapter.startNewProfile(profileId, {
        overwriteConfirmed,
        saveValue: initial,
      });
      if (!storageResult.ok && storageResult.error?.code === "OVERWRITE_CONFIRMATION_REQUIRED") {
        setConfirmation({
          title: "Start this voyage over?",
          message: "The existing save in this slot will be replaced. This cannot be undone.",
          confirmLabel: "Start over",
          onConfirm: () => beginNewGame(profileId, true),
        });
        return;
      }
    }

    installSession(initial, { storageAuthorized: Boolean(adapter && storageResult?.ok) });
    setDirty(true);
    if (!adapter || !storageResult?.ok) {
      setSaveNotice({
        kind: "error",
        message: storageResult?.error?.message
          ? `${storageResult.error.message} This voyage is running without a confirmed save.`
          : "This voyage is running without local saving.",
      });
      return;
    }
    persistSave(initial, { checkpointId: "new-game-shellshore-quest" });
  }

  function requestNewGame(profileId, needsConfirmation = false) {
    if (!needsConfirmation) {
      beginNewGame(profileId, false);
      return;
    }
    setConfirmation({
      title: "Replace this voyage?",
      message: "Starting a new game will replace this slot's current progress and backup.",
      confirmLabel: "Replace voyage",
      onConfirm: () => beginNewGame(profileId, true),
    });
  }

  function continueProfile(profileId) {
    const adapter = storageRef.current;
    if (!adapter) {
      setSaveNotice({ kind: "error", message: "Local storage is unavailable. Retry before continuing a saved voyage." });
      return;
    }
    const loaded = adapter.loadProfile(profileId);
    if (!loaded.ok || !loaded.save) {
      setSaveNotice({ kind: "error", message: loaded.error?.message ?? "This voyage could not be loaded." });
      refreshProfiles();
      return;
    }

    const worldResume = recoverAdventureResume(loaded.save);
    const onboardingResume = recoverOnboardingResume(worldResume.save);
    installSession(onboardingResume.save, { storageAuthorized: true });
    const wasRecovered = Boolean(loaded.recovery || worldResume.recovered || onboardingResume.recovered);
    setDirty(wasRecovered);
    if (wasRecovered) {
      const repaired = persistSave(onboardingResume.save, { checkpointId: "recovered-profile" });
      setSaveNotice({
        kind: repaired.ok ? "info" : "error",
        message: repaired.ok
          ? "Your voyage was recovered from a safe copy and repaired."
          : "Your voyage was recovered for this session, but the repaired save could not be written.",
      });
    } else {
      setSaveNotice(null);
    }
  }

  function retryStorage() {
    try {
      if (!storageRef.current) {
        storageRef.current = createAdventureStorageAdapter({ backend: window.localStorage });
      }
      const listed = refreshProfiles();
      setSaveNotice(listed?.ok
        ? { kind: "info", message: "Save storage is available again." }
        : { kind: "error", message: "Some voyage slots still cannot be read." });
    } catch (error) {
      setSaveNotice({ kind: "error", message: `Storage is still unavailable: ${error?.message ?? "access failed"}.` });
    }
  }

  useEffect(() => {
    if (activeTrainerId || !postDuelConversation) return;
    setConversation(postDuelConversation);
    setPostDuelConversation(null);
  }, [activeTrainerId, postDuelConversation]);

  useEffect(() => {
    if (movementPaused || !isMoving) return undefined;

    let animationFrame = 0;
    let previousTime = null;

    function updateMovement(timestamp) {
      const elapsedMs = previousTime === null ? 0 : Math.min(timestamp - previousTime, 50);
      previousTime = timestamp;
      const vector = movementVector(keyboardDirectionsRef.current, touchDirectionsRef.current);
      if (vector.x === 0 && vector.y === 0) {
        setMovementActive(false);
        return;
      }

      if (elapsedMs > 0) {
        const nextFacing = movementFacing(
          keyboardDirectionsRef.current,
          touchDirectionsRef.current,
          vector,
        );
        setGameSave((current) => {
          if (!current) return current;
          const next = movePlayerContinuous(
            sceneId,
            current.world.position,
            vector,
            elapsedMs,
            { speed: 3.6, radius: 0.22, maxStepDistance: 0.08 },
          );
          if (
            next.x === current.world.position.x
            && next.y === current.world.position.y
            && nextFacing === current.world.facing
          ) return current;
          const updated = {
            ...current,
            world: {
              ...current.world,
              position: next,
              facing: nextFacing,
            },
          };
          saveRef.current = updated;
          return updated;
        });
        setDirty(true);
      }

      animationFrame = window.requestAnimationFrame(updateMovement);
    }

    animationFrame = window.requestAnimationFrame(updateMovement);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [isMoving, movementPaused, sceneId, setMovementActive]);

  useEffect(() => {
    if (movementPaused) {
      setMovementActive(false);
      return;
    }
    syncMovementActive();
  }, [movementPaused, setMovementActive, syncMovementActive]);

  function beginTouchDirection(direction) {
    if (movementPaused) return;
    touchDirectionsRef.current.add(direction);
    setGameSave((current) => {
      if (!current || current.world.facing === direction) return current;
      const updated = { ...current, world: { ...current.world, facing: direction } };
      saveRef.current = updated;
      return updated;
    });
    setDirty(true);
    syncMovementActive();
  }

  function endTouchDirection(direction) {
    touchDirectionsRef.current.delete(direction);
    syncMovementActive();
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
      message: `${starter.name} will become this voyage's permanent starter and active deck. This choice cannot be changed in this save.`,
      confirmLabel: "Choose this starter",
      onConfirm: () => {
        const current = saveRef.current ?? gameSave;
        if (!current) return;
        try {
          const committed = commitStarterSelection(current, starter.id);
          saveRef.current = committed.save;
          setGameSave(committed.save);
          setDirty(true);
          persistSave(committed.save, { checkpointId: `starter-selected:${starter.id}` });
          setStarterSelectionOpen(false);
          setSelectedStarterId(null);
          setConversation({ trainerId: ACADEMY_MENTOR_ID, index: 0, mode: "starterConfirmed" });
        } catch (error) {
          setSaveNotice({ kind: "error", message: error?.message ?? "That starter could not be selected." });
        }
      },
    });
  }

  function interact() {
    if (screen !== "playing" || pauseOpen || conversation || activeTrainerId || starterSelectionOpen || fieldNoteOpen || showCompletion || !interaction || !gameSave) return;
    clearMovement();
    if (interaction.type === "trainer") {
      if (interaction.trainerId === ACADEMY_MENTOR_ID) {
        const progress = getOnboardingProgress(saveRef.current ?? gameSave);
        setConversation({
          trainerId: interaction.trainerId,
          index: 0,
          mode: progress.needsStarterSelection
            ? "intro"
            : progress.needsBoatSafetyReview
              ? "boatSafety"
              : progress.tutorialComplete
                ? "rematch"
                : "tutorialIntro",
        });
        return;
      }
      if (!onboardingProgress?.tutorialComplete) {
        setConversation({
          trainerId: interaction.trainerId,
          index: 0,
          mode: "onboardingGate",
          lines: [
            "Professor Current asked me to wait until your academy lesson is complete.",
            "Choose your starter and finish the friendly 10 VP practice duel, then come challenge me!",
          ],
        });
        return;
      }
      setConversation({ trainerId: interaction.trainerId, index: 0, mode: "challenge" });
      return;
    }
    if (interaction.targetScene && interaction.spawn) {
      const next = enterAdventureScene(gameSave, {
        sceneId: interaction.targetScene,
        position: interaction.spawn,
        facing: interaction.facing ?? "up",
      });
      saveRef.current = next;
      setGameSave(next);
      setDirty(true);
      persistSave(next, { checkpointId: `scene-transition:${interaction.interactionId ?? interaction.targetScene}` });
    }
  }

  interactRef.current = interact;

  function advanceConversation() {
    if (!conversation) return;
    const trainer = TRAINERS[conversation.trainerId];
    const lines = conversationLines(conversation, trainer, defeated.has(trainer.encounterId));
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

  function launchDuel(trainerId) {
    duelResultRef.current = null;
    setPostDuelConversation(null);
    setActiveTrainerId(trainerId);
    setConversation(null);
  }

  function startDuel() {
    const current = saveRef.current ?? gameSave;
    if (!conversation || !current) return;
    clearMovement();
    const trainer = TRAINERS[conversation.trainerId];
    const progress = getOnboardingProgress(current);
    if (trainer.id === ACADEMY_MENTOR_ID && progress.needsStarterSelection) {
      openStarterSelection();
      return;
    }
    if (trainer.id !== ACADEMY_MENTOR_ID && !progress.tutorialComplete) {
      setSaveNotice({ kind: "info", message: "Finish Professor Current's academy lesson before challenging village Reefkeepers." });
      closeConversation();
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
        onConfirm: () => launchDuel(trainer.id),
      });
      return;
    }
    launchDuel(trainer.id);
  }

  function recordDuelResult(trainerId, result) {
    duelResultRef.current = result;
    const trainer = TRAINERS[trainerId];
    const current = saveRef.current ?? gameSave;
    if (!trainer || !current) return;
    if (trainer.id === ACADEMY_MENTOR_ID) {
      const outcome = result.outcome === "victory" ? "won" : "lost";
      try {
        const resolved = recordPracticeDuelResult(current, outcome);
        if (outcome === "won") {
          saveRef.current = resolved.save;
          setGameSave(resolved.save);
          setDirty(true);
          persistSave(resolved.save, { checkpointId: `duel-result:${trainer.encounterId}` });
          setPostDuelConversation({ trainerId, index: 0, mode: "victory" });
        } else {
          setPostDuelConversation({ trainerId, index: 0, mode: "practiceLoss" });
        }
      } catch (error) {
        setSaveNotice({ kind: "error", message: error?.message ?? "The practice result could not be recorded." });
        setPostDuelConversation({ trainerId, index: 0, mode: "practiceRetry" });
      }
      return;
    }
    if (result.outcome !== "victory") return;
    const next = completeAdventureEncounter(current, {
      encounterId: trainer.encounterId,
      opponentId: trainer.id,
      chapterEncounterIds: SHELLSHORE_ENCOUNTER_IDS,
    });
    saveRef.current = next;
    setGameSave(next);
    setDirty(true);
    persistSave(next, { checkpointId: `duel-result:${trainer.encounterId}` });
    setPostDuelConversation({ trainerId, index: 0, mode: "victory" });
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
        saveRef.current = reviewed.save;
        setGameSave(reviewed.save);
        setDirty(true);
        persistSave(reviewed.save, { checkpointId: "boat-safety-reviewed" });
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
    if (trainer.id !== ACADEMY_MENTOR_ID) {
      if (conversation.mode === "victory" || conversation.mode === "onboardingGate") closeConversation();
      else startDuel();
      return;
    }

    if (conversation.mode === "intro") {
      setConversation({ trainerId: trainer.id, index: 0, mode: "starterPresentation" });
      return;
    }
    if (conversation.mode === "starterPresentation") {
      openStarterSelection();
      return;
    }
    if (conversation.mode === "victory" || conversation.mode === "boatSafety") {
      setConversation(null);
      setFieldNoteOpen(true);
      return;
    }
    startDuel();
  }

  function conversationPrimaryLabel() {
    if (!conversation) return "Continue";
    const trainer = TRAINERS[conversation.trainerId];
    if (trainer?.id !== ACADEMY_MENTOR_ID) {
      if (conversation.mode === "victory") return "Continue exploring";
      if (conversation.mode === "onboardingGate") return "Return to the academy";
      return defeated.has(trainer?.encounterId) ? "Rematch" : "Start duel";
    }
    if (conversation.mode === "intro") return "Meet the starter decks";
    if (conversation.mode === "starterPresentation") return "Choose your starter";
    if (conversation.mode === "victory") return "Read your Field Note";
    if (conversation.mode === "boatSafety") return "Open the safety Field Note";
    if (conversation.mode === "practiceLoss" || conversation.mode === "practiceRetry") return "Try again";
    if (conversation.mode === "practiceExit") return "Resume the lesson";
    if (conversation.mode === "rematch") return "Practice again";
    return "Begin live tutorial";
  }

  function claimSaveSlotAndSave(current, overwriteConfirmed = false) {
    let adapter = storageRef.current;
    if (!adapter) {
      try {
        adapter = createAdventureStorageAdapter({ backend: window.localStorage });
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
        title: "Replace the recovered voyage?",
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

  function finishReturnToTitle() {
    clearMovement();
    setScreen("title");
    setGameSave(null);
    saveRef.current = null;
    setConversation(null);
    setActiveTrainerId(null);
    setPostDuelConversation(null);
    setStarterSelectionOpen(false);
    setSelectedStarterId(null);
    setFieldNoteOpen(false);
    setShowCompletion(false);
    setPauseOpen(false);
    setConfirmation(null);
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
      title: "Restart this voyage?",
      message: "All progress in this voyage slot will be replaced with a new Shellshore start.",
      confirmLabel: "Restart voyage",
      onConfirm: () => beginNewGame(gameSave.profileId, true),
    });
  }

  escapeRef.current = () => {
    if (screen !== "playing" || activeTrainerId) return;
    clearMovement();
    if (confirmation) {
      setConfirmation(null);
    } else if (starterSelectionOpen) {
      setStarterSelectionOpen(false);
      setSelectedStarterId(null);
    } else if (fieldNoteOpen) {
      setFieldNoteOpen(false);
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
        keyboardDirectionsRef.current.set(event.code || event.key, direction);
        setGameSave((current) => {
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
      keyboardDirectionsRef.current.delete(event.code || event.key);
      syncMovementActive();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", clearMovement);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", clearMovement);
    };
  }, [clearMovement, syncMovementActive]);

  useEffect(() => {
    function syncVisibility() {
      const visible = document.visibilityState === "visible";
      pageVisibleRef.current = visible;
      setPageVisible(visible);
    }

    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  useEffect(() => {
    if (screen !== "playing" || pauseOpen || confirmation || starterSelectionOpen || fieldNoteOpen || !pageVisible) return undefined;
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
  }, [confirmation, fieldNoteOpen, pageVisible, pauseOpen, screen, setDirty, starterSelectionOpen]);

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
            <p>Checking your local voyages…</p>
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
          notice={saveNotice}
          blocked={Boolean(confirmation)}
          onContinue={continueProfile}
          onNewGame={requestNewGame}
          onRetry={retryStorage}
        />
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
    return (
      <Simulator
        key={`reefbound-${trainer.id}`}
        storyMode={{
          encounterId: trainer.encounterId,
          opponentId: trainer.id,
          playerDeckId: gameSave?.player.activeDeckId ?? gameSave?.player.starterDeckId ?? "coral-garden",
          opponentDeckId: trainer.deckId,
          victoryTarget: trainer.victoryTarget,
          difficulty: trainer.difficulty,
          opponentName: trainer.name,
          returnLabel: isAcademyPractice ? "Academy" : "Town",
          ...(isAcademyPractice ? {
            tutorial: {
              guide: {
                name: trainer.name,
                role: trainer.title,
                portraitSrc: "/images/adventure/academy-mentor-sprites.png",
              },
              contract: {
                id: SHELLSHORE_TUTORIAL.id,
                title: "Professor Current's Live Lesson",
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
          onExit: () => exitDuel(trainer.id),
          onResult: (result) => recordDuelResult(trainer.id, result),
        }}
      />
    );
  }

  const activeConversationTrainer = conversation ? TRAINERS[conversation.trainerId] : null;
  const progress = SHELLSHORE_ENCOUNTER_IDS.filter((encounterId) => defeated.has(encounterId)).length;
  const sceneTrainerInteraction = scene.interactions.find((candidate) => (
    candidate.type === "trainer" && TRAINERS[candidate.trainerId]
  ));
  const sceneTrainer = sceneTrainerInteraction
    ? TRAINERS[sceneTrainerInteraction.trainerId]
    : null;
  const mapThemeClass = sceneId === "town"
    ? styles.townMap
    : sceneId === "academy-lab"
      ? styles.academyLabMap
    : sceneId === "coral-home"
      ? styles.coralHomeMap
      : styles.deepHomeMap;
  const questView = onboardingProgress.needsStarterSelection
    ? {
        title: "Choose your first SeaPals",
        description: "Meet Professor Current in the academy lab and compare all three starter decks.",
        value: 0,
        total: 1,
        label: "Starter choice waiting",
      }
    : !onboardingProgress.tutorialComplete
      ? {
          title: "Professor's live lesson",
          description: onboardingProgress.readyForPracticeDuel
            ? "All seven lesson actions are complete. Finish the friendly 10 VP practice duel."
            : "Follow each real simulator action. Completed steps save automatically, even if you take a break.",
          value: onboardingProgress.completedCheckpointCount,
          total: onboardingProgress.checkpointCount,
          label: `${onboardingProgress.completedCheckpointCount} / ${onboardingProgress.checkpointCount} lesson steps`,
        }
      : onboardingProgress.needsBoatSafetyReview
        ? {
            title: "Review your Harbor Field Note",
            description: "Read Professor Current's boat-safety checklist before leaving the harbor.",
            value: 0,
            total: 1,
            label: "Safety review waiting",
          }
        : {
            title: "Meet the Reefkeepers",
            description: "Enter both homes and win each resident's 10 VP duel.",
            value: progress,
            total: SHELLSHORE_ENCOUNTER_IDS.length,
            label: `${progress} / ${SHELLSHORE_ENCOUNTER_IDS.length} crests earned`,
          };
  const activeStarter = onboardingProgress.starterDeckId
    ? getAdventureStarterDeck(onboardingProgress.starterDeckId)
    : null;
  const explorationBlocked = Boolean(
    pauseOpen || confirmation || activeConversationTrainer || starterSelectionOpen || fieldNoteOpen || showCompletion,
  );

  return (
    <main className={styles.gameShell}>
      <div className={styles.oceanGlow} aria-hidden="true" />
      <header className={styles.gameHeader} inert={explorationBlocked} aria-hidden={explorationBlocked || undefined}>
        <button
          type="button"
          className={styles.exitLink}
          aria-label="Open pause menu"
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
          <strong>{LOCATION_NAMES[sceneId]}</strong>
        </div>
        <div className={styles.compactProgress} aria-label={`${progress} of ${SHELLSHORE_ENCOUNTER_IDS.length} crests earned`}>
          {SHELLSHORE_RESIDENT_TRAINERS.map((trainer) => (
            <span key={trainer.id} className={defeated.has(trainer.encounterId) ? styles.earned : ""}>★</span>
          ))}
        </div>
      </header>

      {saveNotice?.kind === "error" ? (
        <div className={styles.saveToast} role="alert">{saveNotice.message}</div>
      ) : null}

      <div className={styles.gameLayout} inert={explorationBlocked} aria-hidden={explorationBlocked || undefined}>
        <aside className={styles.sidePanel}>
          <div className={styles.panelEyebrow}>Current quest</div>
          <h2>{questView.title}</h2>
          <p>{questView.description}</p>
          <div className={styles.questProgress}>
            <span style={{ width: `${(questView.value / questView.total) * 100}%` }} />
          </div>
          <strong>{questView.label}</strong>
          <div className={styles.controlLegend}>
            <div><kbd>WASD</kbd><span>Walk</span></div>
            <div><kbd>↵</kbd><span>Interact</span></div>
          </div>
        </aside>

        <section className={styles.stageColumn} aria-label={`${LOCATION_NAMES[sceneId]} game area`}>
          <div className={styles.interactionBar} aria-live="polite">
            <span className={interaction ? styles.readyDot : ""} />
            {interactionLabel(interaction, sceneId)}
            {interaction ? <kbd>ENTER</kbd> : null}
          </div>
          <div
            className={`${styles.map} ${mapThemeClass}`}
            style={{
              gridTemplateColumns: `repeat(${scene.width}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${scene.height}, minmax(0, 1fr))`,
              aspectRatio: `${scene.width} / ${scene.height}`,
            }}
            role="application"
            aria-label={`Top-down map of ${LOCATION_NAMES[sceneId]}. Use arrow keys or WASD to walk.`}
          >
            {sceneTrainer ? (
              <AdventureTrainerSprite
                trainer={sceneTrainer}
                position={sceneTrainerInteraction.at}
                defeated={defeated.has(sceneTrainer.encounterId)}
                scene={scene}
              />
            ) : null}
            <AdventurePlayerSprite
              position={position}
              facing={facing}
              moving={isMoving}
              interaction={interaction}
              scene={scene}
            />
          </div>

          <div className={styles.controlDock}>
            <div className={styles.dpad} aria-label="Movement controls">
              <DirectionButton direction="up" label="▲" onStart={beginTouchDirection} onStop={endTouchDirection} />
              <DirectionButton direction="left" label="◀" onStart={beginTouchDirection} onStop={endTouchDirection} />
              <span className={styles.dpadCenter} />
              <DirectionButton direction="right" label="▶" onStart={beginTouchDirection} onStop={endTouchDirection} />
              <DirectionButton direction="down" label="▼" onStart={beginTouchDirection} onStop={endTouchDirection} />
            </div>
            <button type="button" className={styles.actionButton} disabled={!interaction} onClick={interact}>
              <span>A</span>
              Interact
            </button>
          </div>
        </section>

        <aside className={`${styles.sidePanel} ${styles.trainerPanel}`}>
          <div className={styles.panelEyebrow}>Academy record</div>
          <div className={`${styles.trainerCard} ${onboardingProgress.tutorialComplete ? styles.trainerCardWon : ""}`}>
            <span className={`${styles.miniPortrait} ${styles.portraitteal}`}>
              <SpriteArtwork character={ACADEMY_MENTOR_ID} facing="down" portrait />
            </span>
            <span>
              <strong>{activeStarter?.name ?? "Starter waiting"}</strong>
              <small>{onboardingProgress.tutorialComplete ? "Academy lesson complete" : "Professor Current's lesson"}</small>
              <em>{onboardingProgress.needsBoatSafetyReview
                ? "Safety review waiting"
                : onboardingProgress.tutorialComplete
                  ? "Field Note reviewed"
                  : `${onboardingProgress.completedCheckpointCount} / ${onboardingProgress.checkpointCount} steps`}</em>
            </span>
            <b>{onboardingProgress.tutorialComplete ? "\u2605" : "?"}</b>
          </div>
          {fieldNoteAvailable ? (
            <button type="button" className={styles.fieldNoteButton} onClick={() => setFieldNoteOpen(true)}>Open Harbor Field Note</button>
          ) : null}
          <div className={styles.panelEyebrow}>Village challengers</div>
          {SHELLSHORE_RESIDENT_TRAINERS.map((trainer) => {
            const won = defeated.has(trainer.encounterId);
            return (
              <div key={trainer.id} className={`${styles.trainerCard} ${won ? styles.trainerCardWon : ""}`}>
                <span className={`${styles.miniPortrait} ${styles[`portrait${trainer.color}`]}`}>
                  <SpriteArtwork character={trainer.id} facing="down" portrait />
                </span>
                <span>
                  <strong>{trainer.name}</strong>
                  <small>{trainer.title}</small>
                  <em>{won ? `${trainer.crest} earned` : `${trainer.difficulty} · 10 VP`}</em>
                </span>
                <b>{won ? "★" : "?"}</b>
              </div>
            );
          })}
          {progress ? (
            <button type="button" className={styles.resetButton} onClick={requestRestart}>Restart voyage</button>
          ) : null}
        </aside>
      </div>

      {activeConversationTrainer ? (
        <Conversation
          conversation={conversation}
          trainer={activeConversationTrainer}
          defeated={defeated.has(activeConversationTrainer.encounterId)}
          blocked={Boolean(confirmation || starterSelectionOpen || fieldNoteOpen)}
          primaryLabel={conversationPrimaryLabel()}
          secondaryLabel={conversation.mode === "practiceLoss" || conversation.mode === "practiceExit" ? "Take a break" : "Not yet"}
          onAdvance={advanceConversation}
          onPrimary={handleConversationPrimary}
          onSecondary={conversation.mode === "victory" || conversation.mode === "onboardingGate" ? null : closeConversation}
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
          note={SHELLSHORE_FIELD_NOTE}
          blocked={Boolean(confirmation)}
          reviewRequired={onboardingProgress.needsBoatSafetyReview}
          onAcknowledge={acknowledgeFieldNote}
          onDismiss={() => setFieldNoteOpen(false)}
        />
      ) : null}
      {showCompletion ? (
        <Completion blocked={Boolean(confirmation)} onContinue={() => setShowCompletion(false)} onReset={requestRestart} />
      ) : null}
      {pauseOpen ? (
        <PauseMenu
          profileId={gameSave.profileId}
          notice={saveNotice}
          blocked={Boolean(confirmation)}
          fieldNoteAvailable={fieldNoteAvailable}
          onResume={() => setPauseOpen(false)}
          onSave={manualSave}
          onFieldNote={() => {
            setPauseOpen(false);
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
