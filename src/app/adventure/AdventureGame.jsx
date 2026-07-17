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
  resolveAdventureNpc,
} from "./adventureContent.mjs";
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
        intro: resolved.conversation.lines.intro,
        rematch: resolved.conversation.lines.rematch,
        victory: resolved.conversation.lines.victory,
      })];
    }),
));

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

function Conversation({ conversation, trainer, defeated, blocked = false, onAdvance, onChallenge, onClose }) {
  const dialogRef = useDialogFocusTrap(!blocked);
  const lines = conversation.mode === "victory"
    ? trainer.victory
    : defeated
      ? trainer.rematch
      : trainer.intro;
  const finalLine = conversation.index === lines.length - 1;
  const isVictory = conversation.mode === "victory";

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
            ) : isVictory ? (
              <button type="button" autoFocus onClick={onClose}>Continue exploring</button>
            ) : (
              <>
                <button type="button" autoFocus className={styles.challengeButton} onClick={onChallenge}>
                  {defeated ? "Rematch" : "Start duel"}
                </button>
                <button type="button" className={styles.quietButton} onClick={onClose}>Not yet</button>
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

function PauseMenu({ profileId, notice, blocked = false, onResume, onSave, onReturnTitle, onRestart }) {
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
          <button type="button" className={styles.secondaryButton} onClick={onReturnTitle}>Save and return to title</button>
          <button type="button" className={styles.dangerButton} onClick={onRestart}>Restart this voyage</button>
        </div>
        <small>Mid-duel saving is not included. Duel results save when you return to town.</small>
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

function interactionLabel(interaction) {
  if (!interaction) return "Walk closer to a door or Reefkeeper";
  if (interaction.type === "trainer") return `Talk to ${TRAINERS[interaction.trainerId]?.name ?? "Reefkeeper"}`;
  if (interaction.type === "exit") return "Leave this home";
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
  const [postDuelTrainerId, setPostDuelTrainerId] = useState(null);
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
  const scene = SCENES[sceneId];
  const movementPaused = screen !== "playing"
    || pauseOpen
    || Boolean(confirmation)
    || Boolean(conversation)
    || Boolean(activeTrainerId)
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
    setPostDuelTrainerId(null);
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

    const resumed = recoverAdventureResume(loaded.save);
    installSession(resumed.save, { storageAuthorized: true });
    setDirty(Boolean(loaded.recovery || resumed.recovered));
    if (loaded.recovery || resumed.recovered) {
      const repaired = persistSave(resumed.save, { checkpointId: "recovered-profile" });
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
    if (activeTrainerId || !postDuelTrainerId) return;
    setConversation({ trainerId: postDuelTrainerId, index: 0, mode: "victory" });
    setPostDuelTrainerId(null);
  }, [activeTrainerId, postDuelTrainerId]);

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

  function interact() {
    if (screen !== "playing" || pauseOpen || conversation || activeTrainerId || showCompletion || !interaction || !gameSave) return;
    clearMovement();
    if (interaction.type === "trainer") {
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
    const lines = conversation.mode === "victory"
      ? trainer.victory
      : defeated.has(trainer.encounterId)
        ? trainer.rematch
        : trainer.intro;
    setConversation((current) => ({
      ...current,
      index: Math.min(current.index + 1, lines.length - 1),
    }));
  }

  function closeConversation() {
    const wasVictory = conversation?.mode === "victory";
    setConversation(null);
    if (wasVictory && SHELLSHORE_ENCOUNTER_IDS.every((encounterId) => defeated.has(encounterId))) {
      setShowCompletion(true);
    }
  }

  function launchDuel(trainerId) {
    setActiveTrainerId(trainerId);
    setConversation(null);
  }

  function startDuel() {
    const current = saveRef.current ?? gameSave;
    if (!conversation || !current) return;
    clearMovement();
    const trainer = TRAINERS[conversation.trainerId];
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
    if (result.outcome !== "victory") return;
    const trainer = TRAINERS[trainerId];
    const current = saveRef.current ?? gameSave;
    if (!trainer || !current) return;
    const next = completeAdventureEncounter(current, {
      encounterId: trainer.encounterId,
      opponentId: trainer.id,
      chapterEncounterIds: SHELLSHORE_ENCOUNTER_IDS,
    });
    saveRef.current = next;
    setGameSave(next);
    setDirty(true);
    persistSave(next, { checkpointId: `duel-result:${trainer.encounterId}` });
    setPostDuelTrainerId(trainerId);
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
    setPostDuelTrainerId(null);
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
    if (screen !== "playing" || pauseOpen || confirmation || !pageVisible) return undefined;
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
  }, [confirmation, pageVisible, pauseOpen, screen, setDirty]);

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
    return (
      <Simulator
        key={`reefbound-${trainer.id}`}
        storyMode={{
          encounterId: trainer.encounterId,
          opponentId: trainer.id,
          playerDeckId: "coral-garden",
          opponentDeckId: trainer.deckId,
          victoryTarget: trainer.victoryTarget,
          difficulty: trainer.difficulty,
          opponentName: trainer.name,
          onExit: () => setActiveTrainerId(null),
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
    : sceneId === "coral-home"
      ? styles.coralHomeMap
      : styles.deepHomeMap;
  const explorationBlocked = Boolean(
    pauseOpen || confirmation || activeConversationTrainer || showCompletion,
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
          <h2>Meet the Reefkeepers</h2>
          <p>Enter both homes and win each resident&apos;s 10 VP duel.</p>
          <div className={styles.questProgress}>
            <span style={{ width: `${(progress / 2) * 100}%` }} />
          </div>
          <strong>{progress} / 2 crests earned</strong>
          <div className={styles.controlLegend}>
            <div><kbd>WASD</kbd><span>Walk</span></div>
            <div><kbd>↵</kbd><span>Interact</span></div>
          </div>
        </aside>

        <section className={styles.stageColumn} aria-label={`${LOCATION_NAMES[sceneId]} game area`}>
          <div className={styles.interactionBar} aria-live="polite">
            <span className={interaction ? styles.readyDot : ""} />
            {interactionLabel(interaction)}
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
          blocked={Boolean(confirmation)}
          onAdvance={advanceConversation}
          onChallenge={startDuel}
          onClose={closeConversation}
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
          onResume={() => setPauseOpen(false)}
          onSave={manualSave}
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
