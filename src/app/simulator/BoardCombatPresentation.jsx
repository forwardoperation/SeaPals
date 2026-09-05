"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./BoardCombatPresentation.module.css";
import {
  createAttackVectorGeometry,
  getAttackIntentWindupDuration,
} from "./attackIntentPresentation.mjs";

function getDieKind(expression) {
  const match = String(expression ?? "").toUpperCase().match(/D(\d+)/);
  return match ? `d${match[1]}` : "die";
}

function getDieGeometry(kind) {
  switch (kind) {
    case "d4":
      return {
        points: "50,6 94,88 6,88",
        facets: ["50,6 50,88", "6,88 50,50 94,88"],
      };
    case "d6":
      return {
        points: "12,12 88,12 88,88 12,88",
        facets: ["12,12 31,31 69,31 88,12", "31,31 31,69 12,88", "69,31 69,69 88,88", "31,69 69,69"],
      };
    case "d8":
      return {
        points: "50,4 94,50 50,96 6,50",
        facets: ["50,4 50,96", "6,50 50,31 94,50", "6,50 50,69 94,50"],
      };
    case "d10":
      return {
        points: "50,4 78,14 95,45 84,79 50,96 16,79 5,45 22,14",
        facets: ["50,4 50,96", "5,45 50,24 95,45", "16,79 50,67 84,79", "50,24 50,67"],
      };
    case "d12":
      return {
        points: "50,4 73,10 90,27 96,50 90,73 73,90 50,96 27,90 10,73 4,50 10,27 27,10",
        facets: ["27,10 38,31 62,31 73,10", "10,27 31,41 31,64 10,73", "90,27 69,41 69,64 90,73", "27,90 38,69 62,69 73,90", "38,31 31,41 31,64 38,69 62,69 69,64 69,41 62,31 38,31"],
      };
    case "d20":
      return {
        points: "50,3 87,20 97,58 72,92 28,92 3,58 13,20",
        facets: ["50,3 35,30 65,30 87,20", "13,20 35,30 22,60 3,58", "87,20 65,30 78,60 97,58", "3,58 22,60 28,92 50,68", "97,58 78,60 72,92 50,68", "35,30 50,68 65,30", "22,60 50,68 78,60"],
      };
    default:
      return {
        points: "50,5 90,25 96,67 70,94 30,94 4,67 10,25",
        facets: ["50,5 50,94", "10,25 50,38 90,25", "4,67 50,62 96,67"],
      };
  }
}

function CombatDie({ expression, value, owner, purpose, locked }) {
  const kind = getDieKind(expression);
  const geometry = getDieGeometry(kind);
  const expressionLabel = String(expression ?? "Die").toUpperCase();

  return (
    <div
      className={`seapals-combat-die is-${purpose}${locked ? " is-locked" : " is-rolling"}`}
      data-combat-die
      data-owner={owner}
      data-purpose={purpose}
      data-die-kind={kind}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" data-die-outline fill="none" aria-hidden="true">
        <polygon className="seapals-combat-die-shell" points={geometry.points} />
        {geometry.facets.map((points) => (
          <polyline key={points} className="seapals-combat-die-facet" points={points} />
        ))}
      </svg>
      <span className="seapals-combat-die-expression">{expressionLabel}</span>
      <strong data-die-value>{value ?? "?"}</strong>
    </div>
  );
}

export function BoardCombatDice({
  active,
  attackExpression,
  defenseExpression,
  preview,
  attackerOwner = "player",
  defenderOwner = "opponent",
  locked = false,
  onStop,
  reducedMotion = false,
  tutorialClass = "",
  mode = "combat",
  prompt = null,
  lockedPrompt = null,
  ariaLabel = null,
}) {
  const stopButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const restoreFocusFrameRef = useRef(0);

  useEffect(() => {
    if (!active) return undefined;
    window.cancelAnimationFrame(restoreFocusFrameRef.current);
    previousFocusRef.current = document.activeElement;
    return () => {
      const previousFocus = previousFocusRef.current;
      restoreFocusFrameRef.current = window.requestAnimationFrame(() => {
        const successorDialog = [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')]
          .find((element) => !element.hasAttribute("data-combat-dice-layer"));
        if (successorDialog) {
          const focusable = successorDialog.querySelector(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          );
          if (!successorDialog.contains(document.activeElement)) {
            focusable?.focus?.({ preventScroll: true });
          }
          return;
        }

        const previousFocusIsUsable = previousFocus instanceof HTMLElement
          && previousFocus.isConnected
          && previousFocus !== document.body
          && previousFocus !== document.documentElement
          && !previousFocus.closest("[inert]");
        if (previousFocusIsUsable) {
          previousFocus.focus({ preventScroll: true });
        } else {
          document.querySelector("[data-simulator-back-control]")?.focus?.({ preventScroll: true });
        }
      });
    };
  }, [active]);

  useEffect(() => {
    if (!active || !preview || locked) return undefined;
    const focusFrame = window.requestAnimationFrame(() => stopButtonRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(focusFrame);
  }, [active, locked, preview]);

  if (!active) return null;

  const diceByOwner = {
    player: [],
    opponent: [],
  };
  const isEffectRoll = mode === "effect";
  diceByOwner[attackerOwner]?.push(
    <CombatDie
      key="attack"
      expression={attackExpression}
      value={preview?.attack}
      owner={attackerOwner}
      purpose={isEffectRoll ? "effect" : "attack"}
      locked={locked}
    />,
  );
  if (defenseExpression) {
    diceByOwner[defenderOwner]?.push(
      <CombatDie
        key="defense"
        expression={defenseExpression}
        value={preview?.defense}
        owner={defenderOwner}
        purpose="defense"
        locked={locked}
      />,
    );
  }

  const lockedAnnouncement = locked && preview
    ? isEffectRoll
      ? `Roll locked at ${preview.attack}.`
      : `Rolls locked. Attack ${preview.attack}${defenseExpression ? `, defense ${preview.defense}` : ""}.`
    : "";
  const playerRollIntent = isEffectRoll
    ? "roll"
    : attackerOwner === "player"
      ? "attack"
      : defenderOwner === "player"
        ? "defend"
        : "resolve";
  const rollPrompt = locked
    ? lockedPrompt ?? (isEffectRoll ? "Resolving roll…" : "Resolving attack…")
    : prompt ?? `Tap to ${playerRollIntent}`;
  const rollControlLabel = locked
    ? isEffectRoll ? "Card effect roll resolving" : "Attack resolving"
    : `${rollPrompt}. Stop the ${String(attackExpression ?? "die").toUpperCase()} and resolve ${isEffectRoll ? "the card effect" : "the attack"}.`;

  return (
    <div
      className={`seapals-combat-dice-layer${reducedMotion ? " is-reduced-motion" : ""}`}
      data-board-faceoff
      data-combat-dice-layer
      data-effect-dice-layer={isEffectRoll ? "true" : undefined}
      data-effect-roll-layer={isEffectRoll ? "true" : undefined}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? (isEffectRoll ? "Card effect die roll" : "Attack roll off")}
    >
      <button
        ref={stopButtonRef}
        type="button"
        className={`seapals-combat-roll-catcher${tutorialClass}`}
        data-stop-combat-roll
        data-stop-effect-roll={isEffectRoll ? "true" : undefined}
        data-tutorial-target="faceoff-action"
        aria-label={rollControlLabel}
        disabled={!preview || locked}
        onClick={onStop}
        onKeyDown={(event) => {
          if (event.key === "Tab") {
            event.preventDefault();
            stopButtonRef.current?.focus({ preventScroll: true });
          }
        }}
      >
        <span className="sr-only">
          Tap anywhere on the board to stop {String(attackExpression ?? (isEffectRoll ? "the effect die" : "the attack die")).toUpperCase()}
          {defenseExpression ? ` and ${String(defenseExpression).toUpperCase()}` : ""} and resolve {isEffectRoll ? "the card effect" : "the attack"}.
        </span>
      </button>
      <span
        className={`${styles.rollPrompt}${reducedMotion ? ` ${styles.rollPromptReduced}` : ""}${locked ? ` ${styles.rollPromptLocked}` : ""}`}
        data-combat-roll-prompt
        data-roll-intent={playerRollIntent}
        aria-hidden="true"
      >
        {rollPrompt}
      </span>
      <div className="seapals-combat-dice-zones" aria-hidden="true">
        <div className="seapals-combat-dice-zone is-opponent">{diceByOwner.opponent}</div>
        <div className="seapals-combat-dice-divider-space" />
        <div className="seapals-combat-dice-zone is-player">{diceByOwner.player}</div>
      </div>
      <span className="sr-only" aria-live="polite" aria-atomic="true">{lockedAnnouncement}</span>
    </div>
  );
}

function findCombatAnchorNode(root, {
  instanceId,
  cardId = null,
  boardOwner = null,
  preferTarget = false,
  isVisible = () => true,
} = {}) {
  if (!root || (!instanceId && !cardId)) return null;
  const ownerRoot = boardOwner
    ? root.querySelector(`[data-board-owner="${boardOwner}"]`)
    : root;
  if (!ownerRoot) return null;
  const candidates = [...ownerRoot.querySelectorAll(
    "[data-attack-target-instance], [data-combat-target-id], [data-card-instance-id], [data-combat-anchor-ids], [data-card-id]",
  )];
  const chooseMatch = (matches) => {
    const visibleMatches = matches.filter(isVisible);
    if (!visibleMatches.length) return null;
    if (preferTarget) {
      return visibleMatches.find((node) => node.dataset.attackTargetInstance === instanceId)
        ?? visibleMatches.find((node) => node.dataset.combatTargetId === instanceId)
        ?? visibleMatches.find((node) => String(node.dataset.combatAnchorIds ?? "").split(/\s+/).includes(instanceId))
        ?? visibleMatches[0];
    }
    return visibleMatches.find((node) => node.dataset.cardInstanceId === instanceId)
      ?? visibleMatches.find((node) => node.dataset.combatTargetId === instanceId)
      ?? visibleMatches.find((node) => String(node.dataset.combatAnchorIds ?? "").split(/\s+/).includes(instanceId))
      ?? visibleMatches[0];
  };
  const matching = instanceId ? candidates.filter((node) => (
    node.dataset.attackTargetInstance === instanceId
    || node.dataset.combatTargetId === instanceId
    || node.dataset.cardInstanceId === instanceId
    || String(node.dataset.combatAnchorIds ?? "").split(/\s+/).includes(instanceId)
  )) : [];
  const exactMatch = chooseMatch(matching);
  if (exactMatch) return exactMatch;

  // Resumed games can carry a legacy or stale instance identity. Keep the
  // fallback inside the known physical reef so duplicate cards on the other
  // side cannot reverse the attack direction.
  const cardMatches = cardId
    ? candidates.filter((node) => node.dataset.cardId === cardId)
    : [];
  return chooseMatch(cardMatches);
}

function measureAttackIntent(root, anchorOptions) {
  if (!root) return { geometry: null, attackerNode: null, targetNode: null };
  const rootRect = root.getBoundingClientRect();
  const isVisibleInRoot = (node) => {
    const rect = node?.getBoundingClientRect();
    const clipNode = node?.closest?.(".seapals-ecosystem-ocean")
      ?? node?.closest?.("[data-board-owner]");
    const clipRect = clipNode?.getBoundingClientRect?.() ?? rootRect;
    const visibleLeft = Math.max(rootRect.left, clipRect.left);
    const visibleRight = Math.min(rootRect.right, clipRect.right);
    const visibleTop = Math.max(rootRect.top, clipRect.top);
    const visibleBottom = Math.min(rootRect.bottom, clipRect.bottom);
    return Boolean(
      rect?.width
      && rect?.height
      && rect.right > visibleLeft
      && rect.left < visibleRight
      && rect.bottom > visibleTop
      && rect.top < visibleBottom,
    );
  };
  const candidateAttackerNode = findCombatAnchorNode(root, {
    instanceId: anchorOptions.attackerInstanceId,
    cardId: anchorOptions.attackerCardId,
    boardOwner: anchorOptions.attackerBoardOwner,
    isVisible: isVisibleInRoot,
  });
  const candidateTargetNode = findCombatAnchorNode(root, {
    instanceId: anchorOptions.targetInstanceId,
    cardId: anchorOptions.targetCardId,
    boardOwner: anchorOptions.targetBoardOwner,
    preferTarget: true,
    isVisible: isVisibleInRoot,
  });
  const attackerNode = isVisibleInRoot(candidateAttackerNode) ? candidateAttackerNode : null;
  const targetNode = isVisibleInRoot(candidateTargetNode) ? candidateTargetNode : null;
  const geometry = attackerNode && targetNode
    ? createAttackVectorGeometry({
        rootRect,
        attackerRect: attackerNode.getBoundingClientRect(),
        targetRect: targetNode.getBoundingClientRect(),
      })
    : null;
  return { geometry, attackerNode, targetNode };
}

export function AttackIntentLayer({
  active,
  windup,
  presentationKey,
  rootRef,
  attackerInstanceId,
  targetInstanceId,
  attackerCardId = null,
  targetCardId = null,
  attackerBoardOwner = null,
  targetBoardOwner = null,
  attackerName = "Attacker",
  targetName = "target",
  reducedMotion = false,
  measureKey = null,
  onWindupComplete,
}) {
  const [geometry, setGeometry] = useState(null);
  const scheduleRef = useRef(0);
  const windupTimerRef = useRef(null);
  const windupFrameRef = useRef(0);
  const settleFrameRef = useRef(0);
  const attackerNodeRef = useRef(null);
  const completeRef = useRef(onWindupComplete);
  completeRef.current = onWindupComplete;

  useEffect(() => {
    const clearAttackerWindup = () => {
      attackerNodeRef.current?.removeAttribute("data-combat-attacker-windup");
      attackerNodeRef.current = null;
    };
    if (!active) {
      clearAttackerWindup();
      setGeometry(null);
      return undefined;
    }

    let disposed = false;
    const anchorOptions = {
      attackerInstanceId,
      targetInstanceId,
      attackerCardId,
      targetCardId,
      attackerBoardOwner,
      targetBoardOwner,
    };
    const measure = () => {
      window.cancelAnimationFrame(scheduleRef.current);
      scheduleRef.current = window.requestAnimationFrame(() => {
        if (disposed) return;
        const result = measureAttackIntent(rootRef?.current, anchorOptions);
        setGeometry(result.geometry);
        if (attackerNodeRef.current !== result.attackerNode) clearAttackerWindup();
        attackerNodeRef.current = result.attackerNode;
        if (result.attackerNode && windup && !reducedMotion) {
          result.attackerNode.setAttribute("data-combat-attacker-windup", "true");
        } else {
          result.attackerNode?.removeAttribute("data-combat-attacker-windup");
        }
      });
    };

    measure();
    settleFrameRef.current = window.requestAnimationFrame(measure);
    const resizeObserver = typeof ResizeObserver === "function"
      ? new ResizeObserver(measure)
      : null;
    if (rootRef?.current) resizeObserver?.observe(rootRef.current);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      disposed = true;
      window.cancelAnimationFrame(scheduleRef.current);
      window.cancelAnimationFrame(settleFrameRef.current);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
      clearAttackerWindup();
    };
  }, [
    active,
    attackerBoardOwner,
    attackerCardId,
    attackerInstanceId,
    measureKey,
    presentationKey,
    reducedMotion,
    rootRef,
    targetBoardOwner,
    targetCardId,
    targetInstanceId,
    windup,
  ]);

  useEffect(() => {
    if (!active || !windup || !presentationKey) return undefined;
    window.clearTimeout(windupTimerRef.current);
    window.cancelAnimationFrame(windupFrameRef.current);
    let cancelled = false;
    windupFrameRef.current = window.requestAnimationFrame(() => {
      windupFrameRef.current = window.requestAnimationFrame(() => {
        if (cancelled) return;
        const measured = measureAttackIntent(rootRef?.current, {
          attackerInstanceId,
          targetInstanceId,
          attackerCardId,
          targetCardId,
          attackerBoardOwner,
          targetBoardOwner,
        });
        const systemReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
        const delay = getAttackIntentWindupDuration({
          reducedMotion: reducedMotion || systemReducedMotion,
          anchorsAvailable: Boolean(measured.attackerNode && measured.targetNode),
        });
        windupTimerRef.current = window.setTimeout(() => {
          windupTimerRef.current = null;
          if (!cancelled) completeRef.current?.(presentationKey);
        }, delay);
      });
    });
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(windupFrameRef.current);
      window.clearTimeout(windupTimerRef.current);
      windupTimerRef.current = null;
    };
  }, [
    active,
    attackerBoardOwner,
    attackerCardId,
    attackerInstanceId,
    presentationKey,
    reducedMotion,
    rootRef,
    targetBoardOwner,
    targetCardId,
    targetInstanceId,
    windup,
  ]);

  if (!active) return null;
  const viewportWidth = typeof window === "undefined" ? 1 : Math.max(1, window.innerWidth);
  const viewportHeight = typeof window === "undefined" ? 1 : Math.max(1, window.innerHeight);
  const phase = windup ? "windup" : "rolling";

  return (
    <>
      <div
        className={`seapals-combat-attack-intent is-${phase}${reducedMotion ? " is-reduced-motion" : ""}`}
        data-combat-attack-intent
        data-combat-intent-phase={phase}
        data-combat-presentation-key={presentationKey}
        aria-hidden="true"
      >
        {geometry ? (
          <>
            <svg
              className="seapals-combat-attack-vector"
              data-combat-attack-vector
              viewBox={`0 0 ${viewportWidth} ${viewportHeight}`}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="seapals-combat-vector-gradient" gradientUnits="userSpaceOnUse" x1={geometry.start.x} y1={geometry.start.y} x2={geometry.end.x} y2={geometry.end.y}>
                  <stop offset="0" stopColor="#fbbf24" />
                  <stop offset="0.42" stopColor="#fb7185" />
                  <stop offset="1" stopColor="#ef4444" />
                </linearGradient>
                <marker
                  id="seapals-combat-vector-arrowhead"
                  viewBox="0 0 14 14"
                  refX="11"
                  refY="7"
                  markerUnits="userSpaceOnUse"
                  markerWidth="20"
                  markerHeight="20"
                  orient="auto-start-reverse"
                >
                  <path d="M 1 1 L 13 7 L 1 13 L 4.2 7 Z" fill="#ef4444" stroke="#fff7ed" strokeWidth="1" />
                </marker>
              </defs>
              <path className="seapals-combat-attack-vector-shadow" d={geometry.path} pathLength="1" />
              <path
                className="seapals-combat-attack-vector-path"
                data-combat-vector-path
                d={geometry.path}
                pathLength="1"
                markerEnd="url(#seapals-combat-vector-arrowhead)"
              />
              <circle className="seapals-combat-attack-vector-origin" cx={geometry.start.x} cy={geometry.start.y} r="8" />
            </svg>
          </>
        ) : null}
      </div>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {attackerName} attacks {targetName}.
      </span>
    </>
  );
}

function measureAttackTargets(root) {
  if (!root) return [];
  const rootRect = root.getBoundingClientRect();
  const visualViewport = window.visualViewport;
  const viewportCenterX = visualViewport
    ? visualViewport.offsetLeft + visualViewport.width / 2
    : window.innerWidth / 2;
  const viewportCenterY = visualViewport
    ? visualViewport.offsetTop + visualViewport.height / 2
    : window.innerHeight / 2;
  return [...root.querySelectorAll('[data-attack-target="true"][data-attack-target-instance]')]
    .map((element, index) => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      if (rect.right <= rootRect.left || rect.left >= rootRect.right || rect.bottom <= rootRect.top || rect.top >= rootRect.bottom) return null;
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const arrowSize = Math.max(28, Math.min(42, Math.min(rect.width, rect.height) * 0.36));
      const arrowGap = Math.max(7, Math.min(11, arrowSize * 0.26));
      return {
        key: `${element.dataset.attackTargetInstance}-${index}`,
        instanceId: element.dataset.attackTargetInstance,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        fromX: viewportCenterX - centerX,
        fromY: viewportCenterY - centerY,
        arrowSize,
        arrowGap,
        delay: index * 55,
      };
    })
    .filter(Boolean);
}

export function AttackTargetLayer({ active, rootRef, measureKey, reducedMotion = false }) {
  const [targets, setTargets] = useState([]);
  const scheduleRef = useRef(0);
  const generationRef = useRef(0);

  useEffect(() => {
    if (!active) {
      setTargets([]);
      return undefined;
    }

    generationRef.current += 1;
    const generation = generationRef.current;
    const measure = () => {
      window.cancelAnimationFrame(scheduleRef.current);
      scheduleRef.current = window.requestAnimationFrame(() => {
        if (generation !== generationRef.current) return;
        setTargets(measureAttackTargets(rootRef?.current));
      });
    };
    measure();
    const settleFrame = window.requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      generationRef.current += 1;
      window.cancelAnimationFrame(scheduleRef.current);
      window.cancelAnimationFrame(settleFrame);
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, [active, measureKey, rootRef]);

  const renderedTargets = useMemo(() => targets, [targets]);
  if (!active || !renderedTargets.length) return null;

  return (
    <div
      className={`seapals-attack-target-layer${reducedMotion ? " is-reduced-motion" : ""}`}
      data-attack-target-layer
      aria-hidden="true"
    >
      {renderedTargets.map((target) => (
        <span
          key={target.key}
          className="seapals-attack-reticle"
          data-attack-reticle
          data-target-instance={target.instanceId}
          style={{
            left: target.left,
            top: target.top,
            width: target.width,
            height: target.height,
            "--seapals-reticle-from-x": `${target.fromX}px`,
            "--seapals-reticle-from-y": `${target.fromY}px`,
            "--seapals-reticle-delay": `${target.delay}ms`,
            "--seapals-reticle-arrow-size": `${target.arrowSize}px`,
            "--seapals-reticle-arrow-half-size": `${target.arrowSize / 2}px`,
            "--seapals-reticle-arrow-gap": `${target.arrowGap}px`,
          }}
        >
          <svg className="seapals-attack-reticle-glyph is-top" data-reticle-arrow="top" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M16 3v21M7 15l9 9 9-9" />
          </svg>
          <svg className="seapals-attack-reticle-glyph is-right" data-reticle-arrow="right" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M29 16H8M17 7l-9 9 9 9" />
          </svg>
          <svg className="seapals-attack-reticle-glyph is-bottom" data-reticle-arrow="bottom" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M16 29V8M25 17l-9-9-9 9" />
          </svg>
          <svg className="seapals-attack-reticle-glyph is-left" data-reticle-arrow="left" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M3 16h21M15 7l9 9-9 9" />
          </svg>
        </span>
      ))}
    </div>
  );
}
