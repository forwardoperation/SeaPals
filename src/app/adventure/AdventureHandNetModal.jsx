"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cardsById } from "@/data/cards";
import {
  ELVERSON_REEF_CATCHES,
} from "./adventureFishing.mjs";
import {
  HAND_NET_ACTIONS,
  HAND_NET_PHASES,
  applyHandNetAction,
  createHandNetState,
  tickHandNetState,
} from "./adventureHandNet.mjs";
import { ELVERSON_REEF_CREATURE_ATLAS_PATH } from "./adventureAquariumExhibits.mjs";
import styles from "./adventure.module.css";

const MOVE_KEYS = Object.freeze({
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  W: [0, -1],
  s: [0, 1],
  S: [0, 1],
  a: [-1, 0],
  A: [-1, 0],
  d: [1, 0],
  D: [1, 0],
});

function createAttempt({ seed, tutorial, assistedMode, reducedMotion }) {
  return createHandNetState({
    seed,
    creatureCount: tutorial ? 4 : 6,
    requiredCreatureId: tutorial ? "white-grunt" : null,
    assisted: assistedMode,
    reducedMotion,
  });
}

function creatureAtlasPosition(speciesId) {
  const index = Math.max(0, ELVERSON_REEF_CATCHES.findIndex((entry) => entry.id === speciesId));
  return {
    x: (index % 5) * 25,
    y: Math.floor(index / 5) * 100,
  };
}

function movementIntent(keys) {
  let x = 0;
  let y = 0;
  for (const key of keys) {
    const direction = MOVE_KEYS[key];
    if (!direction) continue;
    x += direction[0];
    y += direction[1];
  }
  return {
    x: Math.max(-1, Math.min(1, x)),
    y: Math.max(-1, Math.min(1, y)),
  };
}

function handNetStatus(state, tutorial, required, catchError) {
  if (catchError) return catchError;
  if (state.phase === HAND_NET_PHASES.CAUGHT) return "Safe catch! The animal is resting in Wyeth's seawater carrier.";
  if (state.phase === HAND_NET_PHASES.ESCAPED) return required
    ? "The animals found cover. Wyeth points out another calm patch for you to try."
    : "The shallows went quiet. Return to shore or try a fresh patch.";
  if (state.lastEvent?.type === "creature-fled") return "That one startled. Stop moving and let the others settle before approaching again.";
  if (state.lastEvent?.type === "scoop-missed") return "The net missed. Pause, watch the animal's path, then line up another gentle scoop.";
  if (state.net.scoopRemainingMs > 0) return "Scoop!";
  return tutorial
    ? "Move slowly through the shallows. Face a nearby animal, then scoop without chasing it."
    : "Watch each animal's path, approach gently, and scoop only when the net is close.";
}

export default function AdventureHandNetModal({
  tutorial = false,
  required = false,
  reducedMotion = false,
  startWithCast = false,
  progress,
  onCatch,
  onClose,
  onReturnToShore,
}) {
  const dialogRef = useRef(null);
  const primaryActionRef = useRef(null);
  const pressedKeysRef = useRef(new Set());
  const seedRef = useRef((Math.floor(Math.random() * 0x1_0000_0000)) >>> 0);
  const recordedOutcomeRef = useRef(null);
  const previousFocusRef = useRef(null);
  const [assistedMode, setAssistedMode] = useState(Boolean(reducedMotion || (tutorial && required)));
  const [state, setState] = useState(() => createAttempt({
    seed: seedRef.current,
    tutorial,
    assistedMode: Boolean(reducedMotion || (tutorial && required)),
    reducedMotion,
  }));
  const [catchResult, setCatchResult] = useState(null);
  const [catchError, setCatchError] = useState(null);
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState !== "hidden",
  );

  const terminal = state.phase !== HAND_NET_PHASES.PLAYING;
  const status = handNetStatus(state, tutorial, required, catchError);
  const caughtCreature = state.outcome?.type === "caught"
    ? cardsById[state.outcome.cardId] ?? ELVERSON_REEF_CATCHES.find((entry) => entry.id === state.outcome.speciesId)
    : null;
  const activeCreatureCount = state.creatures.filter((creature) => (
    creature.status === "wandering" || creature.status === "fleeing"
  )).length;
  const atlasPositions = useMemo(() => Object.fromEntries(
    ELVERSON_REEF_CATCHES.map((entry) => [entry.id, creatureAtlasPosition(entry.id)]),
  ), []);

  const resetAttempt = useCallback((nextAssistedMode = assistedMode) => {
    seedRef.current = (seedRef.current + 1) >>> 0;
    recordedOutcomeRef.current = null;
    pressedKeysRef.current.clear();
    setCatchResult(null);
    setCatchError(null);
    setState(createAttempt({
      seed: seedRef.current,
      tutorial,
      assistedMode: nextAssistedMode,
      reducedMotion,
    }));
  }, [assistedMode, reducedMotion, tutorial]);

  const stopMoving = useCallback(() => {
    pressedKeysRef.current.clear();
    setState((current) => applyHandNetAction(current, { type: HAND_NET_ACTIONS.STOP }));
  }, []);

  const returnToShore = useCallback((reason) => {
    stopMoving();
    const payload = {
      reason,
      creatureId: state.outcome?.speciesId ?? null,
    };
    if (onReturnToShore) onReturnToShore(payload);
    else onClose?.();
  }, [onClose, onReturnToShore, state.outcome?.speciesId, stopMoving]);

  useEffect(() => {
    const handleVisibilityChange = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    primaryActionRef.current?.focus({ preventScroll: true });
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const focusableSelector = "button:not(:disabled), [tabindex]:not([tabindex='-1'])";
    const trapFocus = (event) => {
      if (event.key !== "Tab") return;
      const modalStack = [...document.querySelectorAll("[data-adventure-modal='true']")];
      if (modalStack.at(-1) !== dialog) return;
      const focusable = [...dialog.querySelectorAll(focusableSelector)];
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
    };
    dialog.addEventListener("keydown", trapFocus);
    return () => {
      dialog.removeEventListener("keydown", trapFocus);
      previousFocusRef.current?.focus?.({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (!pageVisible || state.phase !== HAND_NET_PHASES.PLAYING) return undefined;
    let animationFrame = 0;
    let lastTimestamp = null;
    const advance = (timestamp) => {
      if (lastTimestamp !== null) {
        const elapsed = Math.min(100, Math.max(0, timestamp - lastTimestamp));
        setState((current) => tickHandNetState(current, elapsed));
      }
      lastTimestamp = timestamp;
      animationFrame = window.requestAnimationFrame(advance);
    };
    animationFrame = window.requestAnimationFrame(advance);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [pageVisible, state.phase]);

  useEffect(() => {
    if (state.outcome?.type !== "caught" || recordedOutcomeRef.current === state.outcome.creatureId) return;
    recordedOutcomeRef.current = state.outcome.creatureId;
    try {
      const result = onCatch?.(state.outcome.speciesId);
      if (!result) throw new Error("The catch could not be added to the Reef Log.");
      setCatchResult(result);
    } catch (error) {
      setCatchError(error?.message ?? "The catch could not be recorded.");
    }
  }, [onCatch, state.outcome]);

  useEffect(() => {
    const releaseMovementKey = (event) => {
      if (!MOVE_KEYS[event.key]) return;
      pressedKeysRef.current.delete(event.key);
      const intent = movementIntent(pressedKeysRef.current);
      setState((current) => applyHandNetAction(current, {
        type: Math.abs(intent.x) + Math.abs(intent.y) > 0 ? HAND_NET_ACTIONS.MOVE : HAND_NET_ACTIONS.STOP,
        ...intent,
      }));
    };
    window.addEventListener("keyup", releaseMovementKey);
    window.addEventListener("blur", stopMoving);
    return () => {
      window.removeEventListener("keyup", releaseMovementKey);
      window.removeEventListener("blur", stopMoving);
    };
  }, [stopMoving]);

  function beginMove(x, y) {
    if (terminal) return;
    setState((current) => applyHandNetAction(current, { type: HAND_NET_ACTIONS.MOVE, x, y }));
  }

  function scoop() {
    if (terminal) return;
    setState((current) => applyHandNetAction(current, { type: HAND_NET_ACTIONS.SCOOP }));
  }

  function handleKeyDown(event) {
    if (MOVE_KEYS[event.key]) {
      event.preventDefault();
      pressedKeysRef.current.add(event.key);
      const intent = movementIntent(pressedKeysRef.current);
      beginMove(intent.x, intent.y);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && !terminal) {
      event.preventDefault();
      scoop();
      return;
    }
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (required && !catchResult) return;
    returnToShore(catchResult ? (tutorial ? "tutorial-complete" : "caught") : "escaped");
  }

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      data-adventure-modal="true"
      className={styles.handNetLayer}
      role="dialog"
      aria-modal="true"
      aria-labelledby="hand-net-title"
      aria-describedby="hand-net-status"
      onKeyDown={handleKeyDown}
    >
      <section className={styles.handNetCard} data-hand-net-phase={state.phase}>
        <header className={styles.handNetHeader}>
          <div>
            <span>{tutorial ? "Fisherman Wyeth's lesson" : "Elverson shallow-water survey"}</span>
            <h2 id="hand-net-title">{terminal
              ? state.phase === HAND_NET_PHASES.CAUGHT
                ? `${caughtCreature?.name ?? "Creature"} safely caught!`
                : "The animals found cover"
              : "Approach gently, then scoop"}</h2>
          </div>
          <span className={styles.handNetCount}>{activeCreatureCount} in view</span>
        </header>

        <ol className={styles.handNetSteps} aria-label="Hand-net catching steps">
          <li><span>1</span><strong>Watch</strong><small>Learn their paths</small></li>
          <li><span>2</span><strong>Approach</strong><small>Move gently</small></li>
          <li><span>3</span><strong>Scoop</strong><small>Net when close</small></li>
        </ol>

        <div
          className={`${styles.handNetShallows} ${state.presentation.waveMotion ? styles.handNetShallowsMoving : ""}`}
          role="application"
          aria-label="Top-down shallow-water hand-net area. Use arrow keys or WASD to move and Enter or Space to scoop."
        >
          <span className={styles.handNetWave} aria-hidden="true"><i /><i /><i /></span>
          <span className={styles.handNetSandRipples} aria-hidden="true" />
          {state.creatures.map((creature) => {
            if (creature.status === "escaped" || creature.status === "caught") return null;
            const sprite = atlasPositions[creature.speciesId];
            const creatureName = cardsById[creature.cardId]?.name ?? creature.speciesId;
            return (
              <span
                key={creature.id}
                className={`${styles.handNetCreature} ${creature.status === "fleeing" ? styles.handNetCreatureFleeing : ""} ${creature.category === "invertebrate" ? styles.handNetCreatureInvertebrate : ""}`}
                style={{
                  left: `${(creature.position.x / state.arena.width) * 100}%`,
                  top: `${(creature.position.y / state.arena.height) * 100}%`,
                  "--hand-net-facing": creature.heading.x < 0 ? -1 : 1,
                  "--hand-net-atlas-x": `${sprite.x}%`,
                  "--hand-net-atlas-y": `${sprite.y}%`,
                  "--hand-net-alert": creature.alert,
                  backgroundImage: `url("${ELVERSON_REEF_CREATURE_ATLAS_PATH}")`,
                }}
                aria-label={`${creatureName}, ${creature.status}${creature.alert > 0.35 ? ", becoming alert" : ""}`}
              >
                {creature.alert > 0.12 ? <i className={styles.handNetAlert} aria-hidden="true" /> : null}
              </span>
            );
          })}
          <span
            className={`${styles.handNetPlayer} ${Math.hypot(state.player.velocity.x, state.player.velocity.y) > 0 ? styles.handNetPlayerMoving : ""}`}
            style={{
              left: `${(state.player.position.x / state.arena.width) * 100}%`,
              top: `${(state.player.position.y / state.arena.height) * 100}%`,
              "--hand-net-player-angle": `${Math.atan2(state.player.facing.y, state.player.facing.x) * (180 / Math.PI) + 90}deg`,
            }}
            aria-label="You with Wyeth's hand net"
          ><i /><b /></span>
          <span
            className={`${styles.handNetScoop} ${state.net.scoopRemainingMs > 0 ? styles.handNetScoopActive : ""}`}
            style={{
              left: `${(state.net.position.x / state.arena.width) * 100}%`,
              top: `${(state.net.position.y / state.arena.height) * 100}%`,
              width: `${(state.net.radius / state.arena.width) * 200}%`,
            }}
            aria-hidden="true"
          />
        </div>

        <p id="hand-net-status" className={styles.handNetStatus} role="status" aria-live="polite" aria-atomic="true">
          {status}
        </p>

        <div className={styles.handNetControls}>
          <div className={styles.handNetDpad} aria-label="Move in the shallows">
            <button type="button" aria-label="Move up" onPointerDown={() => beginMove(0, -1)} onPointerUp={stopMoving} onPointerCancel={stopMoving}>↑</button>
            <button type="button" aria-label="Move left" onPointerDown={() => beginMove(-1, 0)} onPointerUp={stopMoving} onPointerCancel={stopMoving}>←</button>
            <button type="button" aria-label="Stop moving" onClick={stopMoving}>•</button>
            <button type="button" aria-label="Move right" onPointerDown={() => beginMove(1, 0)} onPointerUp={stopMoving} onPointerCancel={stopMoving}>→</button>
            <button type="button" aria-label="Move down" onPointerDown={() => beginMove(0, 1)} onPointerUp={stopMoving} onPointerCancel={stopMoving}>↓</button>
          </div>
          {!terminal ? (
            <button
              ref={primaryActionRef}
              type="button"
              className={styles.handNetScoopButton}
              disabled={state.net.scoopRemainingMs > 0 || state.net.cooldownRemainingMs > 0}
              aria-keyshortcuts="Enter Space"
              onClick={scoop}
            >Scoop net</button>
          ) : state.phase === HAND_NET_PHASES.ESCAPED ? (
            <button ref={primaryActionRef} type="button" className={styles.handNetScoopButton} onClick={() => resetAttempt()}>
              Try another calm patch
            </button>
          ) : catchError ? (
            <button ref={primaryActionRef} type="button" className={styles.handNetScoopButton} onClick={() => resetAttempt()}>
              Retry the catch safely
            </button>
          ) : (
            <button
              ref={primaryActionRef}
              type="button"
              className={styles.handNetScoopButton}
              onClick={() => returnToShore(tutorial ? "tutorial-complete" : "caught")}
            >Return to shore</button>
          )}
        </div>

        <footer className={styles.handNetFooter}>
          <button
            type="button"
            aria-pressed={assistedMode}
            onClick={() => {
              const next = !assistedMode;
              setAssistedMode(next);
              resetAttempt(next);
            }}
          >Gentle guidance: {assistedMode ? "On" : "Off"}</button>
          <span>{progress?.discoveredCount ?? 0} discovered · {progress?.aquariumSpeciesCount ?? 0} in Aquarium</span>
          {!required ? <button type="button" onClick={() => returnToShore("cancelled")}>Leave shallows</button> : null}
        </footer>
        {startWithCast ? <span className={styles.srOnly}>The hand net is ready for another attempt.</span> : null}
      </section>
    </div>
  );
}
