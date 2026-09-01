"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./BoardCombatPresentation.module.css";

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
  diceByOwner[attackerOwner]?.push(
    <CombatDie
      key="attack"
      expression={attackExpression}
      value={preview?.attack}
      owner={attackerOwner}
      purpose="attack"
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
    ? `Rolls locked. Attack ${preview.attack}${defenseExpression ? `, defense ${preview.defense}` : ""}.`
    : "";
  const playerRollIntent = attackerOwner === "player"
    ? "attack"
    : defenderOwner === "player"
      ? "defend"
      : "resolve";
  const rollPrompt = locked
    ? "Resolving attack…"
    : `Tap to ${playerRollIntent}`;
  const rollControlLabel = locked
    ? "Attack resolving"
    : `${rollPrompt}. Stop the dice and resolve the attack.`;

  return (
    <div
      className={`seapals-combat-dice-layer${reducedMotion ? " is-reduced-motion" : ""}`}
      data-board-faceoff
      data-combat-dice-layer
      role="dialog"
      aria-modal="true"
      aria-label="Attack roll off"
    >
      <button
        ref={stopButtonRef}
        type="button"
        className={`seapals-combat-roll-catcher${tutorialClass}`}
        data-stop-combat-roll
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
          Tap anywhere on the board to stop {String(attackExpression ?? "the attack die").toUpperCase()}
          {defenseExpression ? ` and ${String(defenseExpression).toUpperCase()}` : ""} and resolve the attack.
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
      const size = Math.max(42, Math.min(88, Math.max(rect.width, rect.height) * 0.76));
      const halfSize = size / 2;
      const x = Math.max(rootRect.left + halfSize, Math.min(rootRect.right - halfSize, rect.left + rect.width / 2));
      const y = Math.max(rootRect.top + halfSize, Math.min(rootRect.bottom - halfSize, rect.top + rect.height / 2));
      return {
        key: `${element.dataset.attackTargetInstance}-${index}`,
        instanceId: element.dataset.attackTargetInstance,
        x,
        y,
        fromX: viewportCenterX - x,
        fromY: viewportCenterY - y,
        size,
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
            left: target.x,
            top: target.y,
            width: target.size,
            height: target.size,
            "--seapals-reticle-from-x": `${target.fromX}px`,
            "--seapals-reticle-from-y": `${target.fromY}px`,
            "--seapals-reticle-delay": `${target.delay}ms`,
          }}
        >
          <svg className="seapals-attack-reticle-glyph" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <path d="M32 3v22M21 14l11 11 11-11" />
            <path d="M61 32H39M50 21 39 32l11 11" />
            <path d="M32 61V39M43 50 32 39 21 50" />
            <path d="M3 32h22M14 43l11-11-11-11" />
          </svg>
        </span>
      ))}
    </div>
  );
}
