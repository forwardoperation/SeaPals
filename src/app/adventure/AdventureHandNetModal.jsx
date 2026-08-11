"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cardsById } from "@/data/cards";
import {
  ELVERSON_REEF_CATCHES,
} from "./adventureFishing.mjs";
import { ELVERSON_BAITS_BY_ID } from "./adventureBait.mjs";
import {
  HAND_NET_ACTIONS,
  HAND_NET_PHASES,
  HAND_NET_SIMULATION_STEP_MS,
  applyHandNetAction,
  consumeHandNetFrameElapsed,
  createHandNetState,
  interpolateHandNetRenderPositions,
  tickHandNetState,
} from "./adventureHandNet.mjs";
import { ELVERSON_REEF_CREATURE_ATLAS_PATH } from "./adventureAquariumExhibits.mjs";
import styles from "./adventure.module.css";

export const ELVERSON_HAND_NET_TIDEPOOL_PATH = "/images/adventure/elverson-hand-net-tidepool-v2.webp";
export const ELVERSON_HAND_NET_PLAYER_ATLAS_PATH = "/images/adventure/player-hand-net-isometric-v2.png";

const MOVE_KEYS = Object.freeze({
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
});

const HAND_NET_DIRECTION_VECTORS = Object.freeze({
  up: [0, -1],
  left: [-1, 0],
  right: [1, 0],
  down: [0, 1],
});

function seedFromIdentity(identity) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < identity.length; index += 1) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function createAttempt({ seed, tutorial, reducedMotion }) {
  return createHandNetState({
    seed,
    creatureCount: tutorial ? 2 : 3,
    populationCap: tutorial ? 5 : 7,
    requiredCreatureId: tutorial ? "white-grunt" : null,
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

function normalizedMovementKey(key) {
  return typeof key === "string" && key.length === 1 ? key.toLowerCase() : key;
}

function isometricSpriteRow(vector) {
  if (vector.y >= 0) return vector.x >= 0 ? 0 : 1;
  return vector.x >= 0 ? 2 : 3;
}

function HandNetDirectionButton({ direction, onStart, onStop }) {
  const suppressClickRef = useRef(false);
  const clickStopTimerRef = useRef(null);
  const [x, y] = HAND_NET_DIRECTION_VECTORS[direction];
  const ariaLabel = `Move ${direction}`;

  useEffect(() => () => {
    if (clickStopTimerRef.current) window.clearTimeout(clickStopTimerRef.current);
  }, []);

  function releaseClickSuppression() {
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  function stopPointer(event) {
    event.preventDefault();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onStop();
    releaseClickSuppression();
  }

  return (
    <button
      type="button"
      className={`${styles.directionButton} ${styles[`direction${direction}`]}`}
      aria-label={ariaLabel}
      title={ariaLabel}
      onPointerDown={(event) => {
        event.preventDefault();
        suppressClickRef.current = true;
        if (clickStopTimerRef.current) window.clearTimeout(clickStopTimerRef.current);
        try {
          event.currentTarget.setPointerCapture?.(event.pointerId);
        } catch {
          // Pointer capture is an enhancement; pointer-up still stops movement.
        }
        onStart(x, y);
      }}
      onPointerUp={stopPointer}
      onPointerCancel={stopPointer}
      onLostPointerCapture={() => {
        onStop();
        releaseClickSuppression();
      }}
      onContextMenu={(event) => event.preventDefault()}
      onClick={() => {
        if (suppressClickRef.current) return;
        onStart(x, y);
        clickStopTimerRef.current = window.setTimeout(() => {
          clickStopTimerRef.current = null;
          onStop();
        }, 140);
      }}
      onBlur={() => {
        onStop();
        releaseClickSuppression();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        if (event.repeat) return;
        suppressClickRef.current = true;
        onStart(x, y);
      }}
      onKeyUp={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        onStop();
        releaseClickSuppression();
      }}
    />
  );
}

function handNetStatus(state, tutorial, required, catchError) {
  if (catchError) return catchError;
  if (state.phase === HAND_NET_PHASES.CAUGHT) return "Catch recorded in your Reef Log.";
  if (state.phase === HAND_NET_PHASES.ESCAPED) return required
    ? "The animals found cover. Wyeth points out another calm patch for you to try."
    : "The shallows went quiet. Return to shore or try a fresh patch.";
  const baitDefinition = state.bait?.active
    ? ELVERSON_BAITS_BY_ID[state.bait.active.baitId]
    : state.bait?.placement
      ? ELVERSON_BAITS_BY_ID[state.bait.placement.baitId]
      : null;
  if (state.bait?.placement) return `You lower ${baitDefinition?.name ?? "the bait pouch"} into the water with the hand net.`;
  const recentEvent = state.lastEvent
    && state.simulationTimeMs - state.lastEvent.atMs < 2_200
    ? state.lastEvent
    : null;
  if (recentEvent?.type === "creature-arrived") return "The quiet water stirs—a new creature has ventured out.";
  if (recentEvent?.type === "creature-hidden") return "That fish tucked behind a rock. It is safe from the net until it comes back out.";
  const feedingCount = state.creatures.filter(({ status }) => status === "feeding").length;
  if (feedingCount > 0) return `${feedingCount} ${feedingCount === 1 ? "creature is" : "creatures are"} eating ${baitDefinition?.name ?? "the bait"}. Their catch area is larger while they feed.`;
  if (state.bait?.active) return `${baitDefinition?.name ?? "The bait"} is drifting. Matching creatures are following the scent.`;
  if (state.lastEvent?.type === "creature-fled") return "That one startled. Stop moving and let the others settle before approaching again.";
  if (state.lastEvent?.type === "scoop-missed") return "The net missed. Pause, watch the animal's path, then line up another gentle scoop.";
  if (state.net.scoopRemainingMs > 0) return "Scoop!";
  const presentCount = state.creatures.filter(({ status }) => !["waiting", "escaped", "caught"].includes(status)).length;
  if (presentCount === 0) return "The pool is quiet. Stay still for a moment and the reef life will return.";
  return tutorial
    ? "Move slowly through the shallows. Stay still to draw reef life out, then scoop without chasing it."
    : "Watch each animal's path and the rocks it trusts. Stay still to let more creatures venture out.";
}

function encyclopediaSnippet(text, fallback) {
  const normalized = text?.trim();
  if (!normalized) return fallback;
  const sentenceEnd = normalized.search(/[.!?](?=\s|$)/);
  return sentenceEnd >= 0 ? normalized.slice(0, sentenceEnd + 1) : normalized;
}

export default function AdventureHandNetModal({
  tutorial = false,
  required = false,
  reducedMotion = false,
  startWithCast = false,
  baitShop = null,
  onUseBait,
  onCatch,
  onClose,
  onReturnToShore,
}) {
  const dialogRef = useRef(null);
  const primaryActionRef = useRef(null);
  const baitMenuTriggerRef = useRef(null);
  const baitMenuRef = useRef(null);
  const baitMenuOpenRef = useRef(false);
  const pressedKeysRef = useRef(new Set());
  const shallowsRef = useRef(null);
  const playerElementRef = useRef(null);
  const creatureNodesRef = useRef(new Map());
  const creatureNodeCallbacks = useRef(new Map());
  const shallowsSizeRef = useRef({ width: 0, height: 0 });
  const attemptIdentity = useId();
  const seedRef = useRef(seedFromIdentity(attemptIdentity));
  const recordedOutcomeRef = useRef(null);
  const previousFocusRef = useRef(null);
  const initialStateRef = useRef(null);
  if (initialStateRef.current === null) {
    initialStateRef.current = createAttempt({
      seed: seedRef.current,
      tutorial,
      reducedMotion,
    });
  }
  const [state, setState] = useState(initialStateRef.current);
  const simulationClockRef = useRef(null);
  if (simulationClockRef.current === null) {
    simulationClockRef.current = {
      previous: initialStateRef.current,
      current: initialStateRef.current,
      remainderMs: 0,
    };
  }
  const [catchResult, setCatchResult] = useState(null);
  const [catchError, setCatchError] = useState(null);
  const [catchDetailsOpen, setCatchDetailsOpen] = useState(false);
  const [baitMenuOpen, setBaitMenuOpen] = useState(false);
  const [encyclopediaEntry, setEncyclopediaEntry] = useState({ slug: null, creature: null });
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState !== "hidden",
  );

  const terminal = state.phase !== HAND_NET_PHASES.PLAYING;
  const status = handNetStatus(state, tutorial, required, catchError);
  const caughtCreature = state.outcome?.type === "caught"
    ? cardsById[state.outcome.cardId] ?? ELVERSON_REEF_CATCHES.find((entry) => entry.id === state.outcome.speciesId)
    : null;
  const caughtDefinition = catchResult?.creature ?? (state.outcome?.type === "caught"
    ? ELVERSON_REEF_CATCHES.find((entry) => entry.id === state.outcome.speciesId)
    : null);
  const caughtCardId = catchResult?.creature?.cardId ?? state.outcome?.cardId ?? null;
  const encyclopediaSlug = encyclopediaEntry.slug;
  const encyclopediaCreature = encyclopediaEntry.creature;
  const celebrating = state.phase === HAND_NET_PHASES.CAUGHT && Boolean(catchResult) && !catchError;
  const baitPlacement = state.bait?.placement ?? null;
  const activeBait = state.bait?.active ?? null;
  const activeBaitDefinition = activeBait ? ELVERSON_BAITS_BY_ID[activeBait.baitId] ?? null : null;
  const placingBait = Boolean(baitPlacement);
  const baitActionLocked = placingBait || state.net.scoopRemainingMs > 0 || state.net.cooldownRemainingMs > 0;
  const availableBaitCount = baitShop?.baits.reduce((total, bait) => total + bait.quantity, 0) ?? 0;
  const playerVelocityMagnitude = Math.hypot(state.player.velocity.x, state.player.velocity.y);
  const playerMoving = playerVelocityMagnitude > 0.0001;
  const playerSpriteRow = celebrating ? 0 : isometricSpriteRow(state.player.facing);
  const playerSpriteFrame = celebrating
    ? 6
    : placingBait
      ? state.presentation.baitPlacementFrameIndex
      : state.net.scoopRemainingMs > 0
        ? state.presentation.scoopFrameIndex
        : playerMoving
          ? state.presentation.walkFrameIndex
          : 0;
  const playerSpritePosition = {
    x: `${(playerSpriteFrame / 6) * 100}%`,
    y: `${(playerSpriteRow / 3) * 100}%`,
  };
  const netSplash = state.presentation.netImpact;
  const baitImpact = state.presentation.baitImpact;
  const baitImpactDefinition = baitImpact ? ELVERSON_BAITS_BY_ID[baitImpact.baitId] ?? null : null;
  const atlasPositions = useMemo(() => Object.fromEntries(
    ELVERSON_REEF_CATCHES.map((entry) => [entry.id, creatureAtlasPosition(entry.id)]),
  ), []);

  const positionActorElement = useCallback((element, position) => {
    const { width, height } = shallowsSizeRef.current;
    if (!element || !position || width <= 0 || height <= 0) return;
    const arena = simulationClockRef.current.current.arena;
    const nextTranslate = [
      `${Math.round(((position.x / arena.width) * width) * 1_000) / 1_000}px`,
      `${Math.round(((position.y / arena.height) * height) * 1_000) / 1_000}px`,
    ].join(" ");
    if (element.style.translate !== nextTranslate) element.style.translate = nextTranslate;
  }, []);

  const paintRenderPositions = useCallback((renderPositions) => {
    positionActorElement(playerElementRef.current, renderPositions.player.position);
    for (const creature of renderPositions.creatures) {
      positionActorElement(
        creatureNodesRef.current.get(creature.id),
        creature.position,
      );
    }
  }, [positionActorElement]);

  const creatureNodeRef = useCallback((creatureId) => {
    let ref = creatureNodeCallbacks.current.get(creatureId);
    if (!ref) {
      ref = (element) => {
        if (!element) {
          creatureNodesRef.current.delete(creatureId);
          return;
        }
        creatureNodesRef.current.set(creatureId, element);
        const clock = simulationClockRef.current;
        const renderPositions = interpolateHandNetRenderPositions(
          clock.previous,
          clock.current,
          clock.remainderMs,
        );
        const creature = renderPositions.creatures.find(({ id }) => id === creatureId);
        positionActorElement(element, creature?.position);
      };
      creatureNodeCallbacks.current.set(creatureId, ref);
    }
    return ref;
  }, [positionActorElement]);

  useLayoutEffect(() => {
    const shallows = shallowsRef.current;
    if (!shallows) return undefined;
    const measureAndPaint = () => {
      shallowsSizeRef.current = {
        width: shallows.clientWidth,
        height: shallows.clientHeight,
      };
      const clock = simulationClockRef.current;
      paintRenderPositions(interpolateHandNetRenderPositions(
        clock.previous,
        clock.current,
        clock.remainderMs,
      ));
    };
    measureAndPaint();
    const resizeObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver(measureAndPaint)
      : null;
    resizeObserver?.observe(shallows);
    window.addEventListener("resize", measureAndPaint);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measureAndPaint);
    };
  }, [paintRenderPositions]);

  const applyClockAction = useCallback((action) => {
    const clock = simulationClockRef.current;
    const nextCurrent = applyHandNetAction(clock.current, action);
    const nextPrevious = clock.previous === clock.current
      ? nextCurrent
      : applyHandNetAction(clock.previous, action);
    clock.previous = nextPrevious;
    clock.current = nextCurrent;
    setState(nextCurrent);
    return nextCurrent;
  }, []);

  const resetAttempt = useCallback(() => {
    seedRef.current = (seedRef.current + 1) >>> 0;
    recordedOutcomeRef.current = null;
    pressedKeysRef.current.clear();
    setCatchResult(null);
    setCatchError(null);
    setCatchDetailsOpen(false);
    setBaitMenuOpen(false);
    const nextAttempt = createAttempt({
      seed: seedRef.current,
      tutorial,
      reducedMotion,
    });
    simulationClockRef.current = {
      previous: nextAttempt,
      current: nextAttempt,
      remainderMs: 0,
    };
    paintRenderPositions(interpolateHandNetRenderPositions(nextAttempt, nextAttempt, 0));
    setState(nextAttempt);
  }, [paintRenderPositions, reducedMotion, tutorial]);

  const stopMoving = useCallback(() => {
    pressedKeysRef.current.clear();
    applyClockAction({ type: HAND_NET_ACTIONS.STOP });
  }, [applyClockAction]);

  const returnToShore = useCallback((reason) => {
    if (placingBait) return;
    stopMoving();
    const payload = {
      reason,
      creatureId: state.outcome?.speciesId ?? null,
    };
    if (onReturnToShore) onReturnToShore(payload);
    else onClose?.();
  }, [onClose, onReturnToShore, placingBait, state.outcome?.speciesId, stopMoving]);

  useEffect(() => {
    const handleVisibilityChange = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!caughtCardId) {
      setEncyclopediaEntry({ slug: null, creature: null });
      return () => {
        cancelled = true;
      };
    }
    import("@/data/encyclopedia")
      .then(({ encyclopediaCreatureBySlug, encyclopediaSlugByCardId }) => {
        if (cancelled) return;
        const slug = encyclopediaSlugByCardId[caughtCardId] ?? null;
        setEncyclopediaEntry({
          slug,
          creature: slug ? encyclopediaCreatureBySlug[slug] ?? null : null,
        });
      })
      .catch(() => {
        if (!cancelled) setEncyclopediaEntry({ slug: null, creature: null });
      });
    return () => {
      cancelled = true;
    };
  }, [caughtCardId]);

  useEffect(() => {
    baitMenuOpenRef.current = baitMenuOpen;
    if (!baitMenuOpen) return;
    window.requestAnimationFrame(() => {
      baitMenuRef.current?.querySelector("button:not(:disabled)")?.focus({ preventScroll: true });
    });
  }, [baitMenuOpen]);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    primaryActionRef.current?.focus({ preventScroll: true });
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const focusableSelector = "button:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])";
    const trapFocus = (event) => {
      if (event.key !== "Tab") return;
      const modalStack = [...document.querySelectorAll("[data-adventure-modal='true']")];
      if (modalStack.at(-1) !== dialog) return;
      const focusScope = baitMenuOpenRef.current ? baitMenuRef.current : dialog;
      const focusable = [...(focusScope ?? dialog).querySelectorAll(focusableSelector)];
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
    if (!pageVisible || baitMenuOpen || state.phase !== HAND_NET_PHASES.PLAYING) return undefined;
    let animationFrame = 0;
    let lastTimestamp = null;
    const advance = (timestamp) => {
      if (lastTimestamp !== null) {
        const elapsed = Math.min(100, Math.max(0, timestamp - lastTimestamp));
        const clock = simulationClockRef.current;
        const frame = consumeHandNetFrameElapsed(clock.remainderMs, elapsed);
        let simulationElapsedMs = frame.simulationElapsedMs;
        while (
          simulationElapsedMs > 0
          && clock.current.phase === HAND_NET_PHASES.PLAYING
        ) {
          clock.previous = clock.current;
          clock.current = tickHandNetState(clock.current, HAND_NET_SIMULATION_STEP_MS);
          simulationElapsedMs -= HAND_NET_SIMULATION_STEP_MS;
        }
        clock.remainderMs = clock.current.phase === HAND_NET_PHASES.PLAYING
          ? frame.remainderMs
          : 0;
        if (frame.simulationElapsedMs > 0) {
          setState(clock.current);
        }
      }
      lastTimestamp = timestamp;
      const clock = simulationClockRef.current;
      if (clock.current.phase !== HAND_NET_PHASES.PLAYING) {
        clock.previous = clock.current;
      }
      paintRenderPositions(interpolateHandNetRenderPositions(
        clock.previous,
        clock.current,
        clock.remainderMs,
      ));
      if (clock.current.phase === HAND_NET_PHASES.PLAYING) {
        animationFrame = window.requestAnimationFrame(advance);
      }
    };
    animationFrame = window.requestAnimationFrame(advance);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [baitMenuOpen, pageVisible, paintRenderPositions, state.phase]);

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
      const movementKey = normalizedMovementKey(event.key);
      if (!MOVE_KEYS[movementKey]) return;
      pressedKeysRef.current.delete(movementKey);
      const intent = movementIntent(pressedKeysRef.current);
      applyClockAction({
        type: Math.abs(intent.x) + Math.abs(intent.y) > 0 ? HAND_NET_ACTIONS.MOVE : HAND_NET_ACTIONS.STOP,
        ...intent,
      });
    };
    window.addEventListener("keyup", releaseMovementKey);
    window.addEventListener("blur", stopMoving);
    return () => {
      window.removeEventListener("keyup", releaseMovementKey);
      window.removeEventListener("blur", stopMoving);
    };
  }, [applyClockAction, stopMoving]);

  function beginMove(x, y) {
    if (terminal) return;
    applyClockAction({ type: HAND_NET_ACTIONS.MOVE, x, y });
  }

  function scoop() {
    if (terminal || baitMenuOpen || placingBait) return;
    applyClockAction({ type: HAND_NET_ACTIONS.SCOOP });
  }

  function openBaitMenu() {
    if (terminal || baitActionLocked) return;
    baitMenuOpenRef.current = true;
    stopMoving();
    setBaitMenuOpen(true);
  }

  function closeBaitMenu({ restoreFocus = true } = {}) {
    baitMenuOpenRef.current = false;
    setBaitMenuOpen(false);
    if (!restoreFocus) return;
    window.requestAnimationFrame(() => {
      baitMenuTriggerRef.current?.focus({ preventScroll: true });
    });
  }

  function placeBait(baitId) {
    if (terminal || placingBait || activeBait || !onUseBait) return;
    const action = { type: HAND_NET_ACTIONS.PLACE_BAIT, baitId };
    const clock = simulationClockRef.current;
    if (applyHandNetAction(clock.current, action) === clock.current) return;
    const used = onUseBait(baitId);
    if (!used) return;
    applyClockAction(action);
    closeBaitMenu({ restoreFocus: false });
    window.requestAnimationFrame(() => shallowsRef.current?.focus({ preventScroll: true }));
  }

  function handleWaterScoop(event) {
    if (terminal || event.defaultPrevented) return;
    const target = event.target;
    if (target instanceof Element && target.closest("button, a, input, select, textarea, [data-hand-net-ui]")) return;
    event.currentTarget.focus({ preventScroll: true });
    scoop();
  }

  function handleKeyDown(event) {
    const target = event.target;
    const nativeTextEntry = target instanceof Element
      && target.closest("input, select, textarea, [contenteditable='true']");
    const movementKey = normalizedMovementKey(event.key);
    const nativeInteractive = target instanceof Element
      && target.closest("button, a, input, select, textarea, [contenteditable='true']");
    const actionKey = event.key === "Enter" || event.key === " ";
    if (baitMenuOpen) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeBaitMenu();
        return;
      }
      if (MOVE_KEYS[movementKey]) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (nativeInteractive) {
        if (actionKey && event.repeat) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      return;
    }
    if (MOVE_KEYS[movementKey] && !nativeTextEntry) {
      event.preventDefault();
      event.stopPropagation();
      if (terminal || event.repeat || pressedKeysRef.current.has(movementKey)) return;
      pressedKeysRef.current.add(movementKey);
      const intent = movementIntent(pressedKeysRef.current);
      beginMove(intent.x, intent.y);
      return;
    }
    if (nativeInteractive && event.key !== "Escape") {
      if (actionKey && event.repeat) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    if (actionKey && !terminal) {
      event.preventDefault();
      event.stopPropagation();
      if (event.repeat) return;
      scoop();
      return;
    }
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    if (placingBait) return;
    if (required && !catchResult) {
      stopMoving();
      onClose?.();
      return;
    }
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
        <div
          ref={shallowsRef}
          className={`${styles.handNetShallows} ${state.presentation.waveMotion ? styles.handNetShallowsMoving : ""}`}
          style={{
            "--hand-net-tidepool-image": `url("${ELVERSON_HAND_NET_TIDEPOOL_PATH}")`,
          }}
          role="application"
          tabIndex={0}
          inert={baitMenuOpen}
          aria-hidden={baitMenuOpen ? "true" : undefined}
          aria-label="Shallow-water hand-net area with reef-rock shelters. Use arrow keys or WASD to move. Stay still to let new creatures venture out. Press Enter or Space, or click or tap the water, to catch. Fish hidden behind rocks are safe from the net. Open the bait bag from the controls to attract fish."
          onClick={handleWaterScoop}
        >
          <h2 id="hand-net-title" className={styles.srOnly}>
            {tutorial ? "Fisherman Wyeth's hand-net lesson" : "Elverson tide-pool survey"}
          </h2>

          <span className={styles.handNetWave} aria-hidden="true"><i /><i /><i /></span>
          <span className={styles.handNetSandRipples} aria-hidden="true" />
          {activeBait && activeBaitDefinition ? (
            <span
              key={`active-bait-${activeBait.sequence}`}
              className={styles.handNetBaitSpot}
              data-hand-net-bait={activeBait.baitId}
              style={{
                left: `${(activeBait.position.x / state.arena.width) * 100}%`,
                top: `${(activeBait.position.y / state.arena.height) * 100}%`,
                "--hand-net-bait-color": activeBaitDefinition.color,
              }}
              aria-hidden="true"
            ><i /><b /><em /></span>
          ) : null}
          {state.creatures.map((creature) => {
            if (["waiting", "escaped", "caught"].includes(creature.status)) return null;
            const sprite = atlasPositions[creature.speciesId];
            const creatureName = cardsById[creature.cardId]?.name ?? creature.speciesId;
            return (
              <span
                key={creature.id}
                ref={creatureNodeRef(creature.id)}
                className={`${styles.handNetCreature} ${creature.spawnedAtMs > 0 && state.simulationTimeMs - creature.spawnedAtMs < 900 ? styles.handNetCreatureArriving : ""} ${creature.status === "fleeing" ? styles.handNetCreatureFleeing : ""} ${creature.status === "seeking-cover" ? styles.handNetCreatureSeekingCover : ""} ${creature.status === "hidden" ? styles.handNetCreatureHidden : ""} ${creature.status === "attracted" ? styles.handNetCreatureAttracted : ""} ${creature.status === "feeding" ? styles.handNetCreatureFeeding : ""} ${creature.category === "invertebrate" ? styles.handNetCreatureInvertebrate : ""}`}
                style={{
                  "--hand-net-facing": creature.heading.x < 0 ? -1 : 1,
                  "--hand-net-creature-scale": creature.visualScale ?? 1,
                  "--hand-net-atlas-x": `${sprite.x}%`,
                  "--hand-net-atlas-y": `${sprite.y}%`,
                  "--hand-net-alert": creature.alert,
                  backgroundImage: `url("${ELVERSON_REEF_CREATURE_ATLAS_PATH}")`,
                }}
                data-hand-net-creature-status={creature.status}
                data-hand-net-creature-scale={creature.visualScale ?? 1}
                aria-label={creature.status === "hidden"
                  ? `${creatureName}, hidden behind a rock and safe from the net`
                  : creature.status === "seeking-cover"
                    ? `${creatureName}, darting toward a rock shelter`
                    : creature.status === "feeding"
                      ? `${creatureName}, eating bait and easier to catch`
                      : creature.status === "attracted"
                        ? `${creatureName}, following the bait scent`
                        : `${creatureName}, ${creature.status}${creature.alert > 0.35 ? ", becoming alert" : ""}`}
              >
                {creature.alert > 0.12 ? <i className={styles.handNetAlert} aria-hidden="true" /> : null}
              </span>
            );
          })}
          {state.rocks.map((rock) => (
            <span
              key={rock.id}
              className={styles.handNetRockCover}
              data-hand-net-rock={rock.id}
              style={{
                "--hand-net-rock-x": `${(rock.position.x / state.arena.width) * 100}%`,
                "--hand-net-rock-y": `${(rock.position.y / state.arena.height) * 100}%`,
                "--hand-net-rock-radius-x": `${(rock.coverRadius.x / state.arena.width) * 100}%`,
                "--hand-net-rock-radius-y": `${(rock.coverRadius.y / state.arena.height) * 100}%`,
              }}
              aria-hidden="true"
            />
          ))}
          <span className={styles.handNetSurfaceVeil} data-hand-net-effect="surface-veil" aria-hidden="true" />
          <span
            ref={playerElementRef}
            className={`${styles.handNetPlayer} ${playerMoving ? styles.handNetPlayerMoving : ""} ${placingBait ? styles.handNetPlayerPlacingBait : ""} ${celebrating ? styles.handNetPlayerCelebrating : ""} ${playerSpriteRow >= 2 ? styles.handNetPlayerFacingRear : styles.handNetPlayerFacingFront}`}
            style={{
              "--hand-net-player-atlas-x": playerSpritePosition.x,
              "--hand-net-player-atlas-y": playerSpritePosition.y,
              backgroundImage: `url("${ELVERSON_HAND_NET_PLAYER_ATLAS_PATH}")`,
            }}
            aria-label={celebrating
              ? "You celebrate the catch with the hand net held high"
              : placingBait
                ? "You lower a bait pouch into the water with the hand net"
                : "You with Wyeth's hand net"}
            data-hand-net-scoop-phase={state.presentation.scoopPhase}
            data-hand-net-scoop-frame={playerSpriteFrame}
            data-hand-net-bait-placement-phase={state.presentation.baitPlacementPhase}
            data-hand-net-bait-placement-frame={state.presentation.baitPlacementFrameIndex}
          >
            <i className={styles.handNetPlayerRipple} aria-hidden="true" />
          </span>
          {celebrating ? (
            <span className={styles.handNetVictoryBurst} aria-hidden="true"><i /><b /></span>
          ) : null}
          {netSplash ? (
            <span
              key={`${seedRef.current}-${netSplash.sequence}`}
              className={`${styles.handNetNetSplash} ${styles.handNetNetSplashActive}`}
              data-hand-net-effect="net-splash"
              style={{
                left: `${(netSplash.position.x / state.arena.width) * 100}%`,
                top: `${(netSplash.position.y / state.arena.height) * 100}%`,
              }}
              aria-hidden="true"
            ><i /><b /></span>
          ) : null}
          {baitImpact && baitImpactDefinition ? (
            <span
              key={`bait-impact-${baitImpact.sequence}`}
              className={styles.handNetBaitImpact}
              data-hand-net-effect="bait-impact"
              style={{
                left: `${(baitImpact.position.x / state.arena.width) * 100}%`,
                top: `${(baitImpact.position.y / state.arena.height) * 100}%`,
                "--hand-net-bait-color": baitImpactDefinition.color,
              }}
              aria-hidden="true"
            ><i /><b /></span>
          ) : null}

          <p id="hand-net-status" className={celebrating ? styles.srOnly : styles.handNetStatus} data-hand-net-ui role="status" aria-live="polite" aria-atomic="true">
            {celebrating
              ? `${encyclopediaCreature?.name ?? caughtCreature?.name ?? "Creature"} caught and added to your Reef Log.`
              : status}
          </p>

          {celebrating && caughtDefinition ? (
            <section className={styles.handNetCatchReveal} data-hand-net-ui aria-labelledby="hand-net-catch-name">
              <span className={styles.handNetCatchEyebrow}>
                {catchResult.firstDiscovery ? "New Reef Log discovery!" : "Caught again!"}
              </span>
              <div className={styles.handNetCatchRevealBody}>
                <span className={styles.handNetCatchCreatureStage} aria-hidden="true">
                  <i
                    style={{
                      "--hand-net-atlas-x": `${atlasPositions[caughtDefinition.id]?.x ?? 0}%`,
                      "--hand-net-atlas-y": `${atlasPositions[caughtDefinition.id]?.y ?? 0}%`,
                      backgroundImage: `url("${ELVERSON_REEF_CREATURE_ATLAS_PATH}")`,
                    }}
                  />
                </span>
                <div className={styles.handNetCatchCopy}>
                  <h3 id="hand-net-catch-name">{encyclopediaCreature?.name ?? caughtCreature?.name ?? caughtDefinition.id}</h3>
                  <p className={styles.handNetCatchTagline}>{encyclopediaCreature?.tagline ?? caughtDefinition.note}</p>
                  <button
                    type="button"
                    className={styles.handNetReadMoreButton}
                    aria-expanded={catchDetailsOpen}
                    aria-controls="hand-net-catch-details"
                    onClick={() => setCatchDetailsOpen((current) => !current)}
                  >{catchDetailsOpen ? "Show less" : "Read more"} <span aria-hidden="true">{catchDetailsOpen ? "↑" : "↓"}</span></button>
                  <div id="hand-net-catch-details" className={styles.handNetCatchDetails} hidden={!catchDetailsOpen}>
                    <p>{encyclopediaSnippet(encyclopediaCreature?.intro, caughtDefinition.note)}</p>
                    {encyclopediaCreature?.lookFor ? <p><strong>Look for:</strong> {encyclopediaCreature.lookFor}</p> : null}
                    {encyclopediaSlug ? (
                      <Link className={styles.handNetEncyclopediaLink} href={`/encyclopedia/${encyclopediaSlug}`}>
                        Open the full encyclopedia entry <span aria-hidden="true">→</span>
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </div>
        {baitMenuOpen && baitShop ? (
          <div className={styles.handNetBaitMenuBackdrop} data-hand-net-ui>
            <section
              ref={baitMenuRef}
              className={styles.handNetBaitDrawer}
              aria-labelledby="hand-net-bait-title"
              aria-describedby="hand-net-bait-help"
            >
              <header>
                <div>
                  <span>Inventory · Bait bag</span>
                  <h3 id="hand-net-bait-title">Choose bait for this patch</h3>
                </div>
                <button type="button" onClick={() => closeBaitMenu()} aria-label="Close bait bag">Close</button>
              </header>
              <p id="hand-net-bait-help">
                Place one pouch with the hand net. Matching creatures will follow it and become easier to catch while they eat.
              </p>
              {activeBaitDefinition ? (
                <p className={styles.handNetBaitActiveNotice} role="status">
                  {activeBaitDefinition.name} is already working in the water. Close the bait bag and let it finish before placing another pouch.
                </p>
              ) : null}
              <div className={styles.handNetBaitOptions}>
                {baitShop.baits.map((bait) => {
                  const matchingCreatureCount = state.creatures.filter((creature) => (
                    ["wandering", "attracted", "feeding"].includes(creature.status)
                    && bait.speciesIds.includes(creature.speciesId)
                  )).length;
                  const hasMatchingCreature = matchingCreatureCount > 0;
                  return (
                    <article
                      key={bait.id}
                      className={styles.handNetBaitOption}
                      style={{ "--bait-color": bait.color }}
                    >
                      <span className={styles.baitInventoryPouch} aria-hidden="true"><i /></span>
                      <div>
                        <span>{bait.targetLabel}</span>
                        <h4>{bait.name}</h4>
                        <p>{bait.description}</p>
                      </div>
                      <div className={styles.handNetBaitOptionAction}>
                        <b>{bait.quantity} in bag / {matchingCreatureCount} {matchingCreatureCount === 1 ? "match" : "matches"} here</b>
                        <button
                          type="button"
                          disabled={bait.quantity < 1 || Boolean(activeBait) || placingBait || !hasMatchingCreature}
                          onClick={() => placeBait(bait.id)}
                        >{bait.quantity < 1
                            ? "Out of bait"
                            : activeBait
                              ? "Bait active"
                              : hasMatchingCreature
                                ? "Place bait"
                                : "No match here"}</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        ) : null}
        <div
          className={`${styles.controlDock} ${styles.handNetControlDock}`}
          data-hand-net-ui
          inert={baitMenuOpen}
          aria-hidden={baitMenuOpen ? "true" : undefined}
        >
          {!terminal ? (
            <div className={`${styles.dpad} ${styles.handNetDockDpad}`} aria-label="Move in the shallows">
              <HandNetDirectionButton direction="up" onStart={beginMove} onStop={stopMoving} />
              <HandNetDirectionButton direction="left" onStart={beginMove} onStop={stopMoving} />
              <span className={styles.dpadCenter} aria-hidden="true" />
              <HandNetDirectionButton direction="right" onStart={beginMove} onStop={stopMoving} />
              <HandNetDirectionButton direction="down" onStart={beginMove} onStop={stopMoving} />
            </div>
          ) : null}
          <div className={styles.handNetDockExit}>
            {!required && state.phase !== HAND_NET_PHASES.CAUGHT ? (
              <button
                type="button"
                className={`${styles.actionButton} ${styles.handNetExitAction}`}
                aria-keyshortcuts="Escape"
                disabled={placingBait}
                onClick={() => returnToShore("cancelled")}
              ><span aria-hidden="true">B</span> Leave</button>
            ) : null}
          </div>
          <div className={styles.handNetDockActions}>
            {!terminal ? (
              <>
                {baitShop ? (
                  <button
                    ref={baitMenuTriggerRef}
                    type="button"
                    className={`${styles.actionButton} ${styles.handNetSecondaryAction}`}
                    disabled={baitActionLocked}
                    aria-haspopup="true"
                    aria-expanded={baitMenuOpen}
                    onClick={openBaitMenu}
                  ><span aria-hidden="true">X</span> Bait bag ({availableBaitCount})</button>
                ) : null}
                <button
                  ref={primaryActionRef}
                  type="button"
                  className={`${styles.actionButton} ${styles.handNetPrimaryAction}`}
                  disabled={placingBait || state.net.scoopRemainingMs > 0 || state.net.cooldownRemainingMs > 0}
                  aria-keyshortcuts="Enter Space"
                  onClick={scoop}
                ><span aria-hidden="true">A</span> Catch</button>
              </>
            ) : state.phase === HAND_NET_PHASES.ESCAPED ? (
              <button ref={primaryActionRef} type="button" className={`${styles.actionButton} ${styles.handNetPrimaryAction}`} onClick={() => resetAttempt()}>
                <span aria-hidden="true">A</span> Try again
              </button>
            ) : catchError ? (
              <button ref={primaryActionRef} type="button" className={`${styles.actionButton} ${styles.handNetPrimaryAction}`} onClick={() => resetAttempt()}>
                <span aria-hidden="true">A</span> Retry catch
              </button>
            ) : (
              <button
                ref={primaryActionRef}
                type="button"
                className={`${styles.actionButton} ${styles.handNetPrimaryAction}`}
                onClick={() => returnToShore(tutorial ? "tutorial-complete" : "caught")}
              ><span aria-hidden="true">A</span> Return to shore</button>
            )}
          </div>
        </div>
        <span className={styles.srOnly}>Watch their paths, approach gently, then scoop when the net is close.</span>
        {startWithCast ? <span className={styles.srOnly}>The hand net is ready for another attempt.</span> : null}
      </section>
    </div>
  );
}
