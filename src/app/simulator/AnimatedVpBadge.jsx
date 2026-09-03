"use client";

import { useEffect, useRef, useState } from "react";
import {
  VP_COUNTER_MAX_DURATION_MS,
  VP_COUNTER_GLOW_HOLD_MS,
  getVpCounterDirection,
  getVpCounterStepDelay,
  normalizeVpCounterValue,
} from "./vpCounterPresentation.mjs";

export default function AnimatedVpBadge({
  value,
  owner,
  label,
  reducedMotion = false,
  className = "",
  tutorialTarget,
  variant = "badge",
}) {
  const targetValue = normalizeVpCounterValue(value);
  const [displayValue, setDisplayValue] = useState(targetValue);
  const [direction, setDirection] = useState(null);
  const [announcement, setAnnouncement] = useState("");
  const [systemReducedMotion, setSystemReducedMotion] = useState(false);
  const displayValueRef = useRef(targetValue);
  const previousTargetRef = useRef(targetValue);
  const sequenceRef = useRef(0);
  const stepTimerRef = useRef(null);
  const glowTimerRef = useRef(null);

  useEffect(() => {
    const motionPreference = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
    if (!motionPreference) return undefined;
    const syncPreference = () => setSystemReducedMotion(motionPreference.matches);
    syncPreference();
    if (motionPreference.addEventListener) motionPreference.addEventListener("change", syncPreference);
    else motionPreference.addListener?.(syncPreference);
    return () => {
      if (motionPreference.removeEventListener) motionPreference.removeEventListener("change", syncPreference);
      else motionPreference.removeListener?.(syncPreference);
    };
  }, []);

  const motionReduced = reducedMotion || systemReducedMotion;

  useEffect(() => {
    const sequence = ++sequenceRef.current;
    window.clearTimeout(stepTimerRef.current);
    window.clearTimeout(glowTimerRef.current);
    stepTimerRef.current = null;
    glowTimerRef.current = null;

    const previousTarget = previousTargetRef.current;
    previousTargetRef.current = targetValue;
    const startingValue = displayValueRef.current;
    const semanticDirection = getVpCounterDirection(previousTarget, targetValue);
    const visualDirection = getVpCounterDirection(startingValue, targetValue);
    if (!semanticDirection) {
      displayValueRef.current = targetValue;
      setDisplayValue(targetValue);
      setDirection(null);
      return undefined;
    }

    const scoreDelta = Math.abs(targetValue - previousTarget);
    setDirection(semanticDirection);
    setAnnouncement(`${label} VP ${semanticDirection === "gain" ? "increased" : "decreased"} by ${scoreDelta} to ${targetValue}.`);

    const finish = () => {
      glowTimerRef.current = window.setTimeout(() => {
        if (sequenceRef.current === sequence) {
          setDirection(null);
        }
      }, VP_COUNTER_GLOW_HOLD_MS);
    };

    if (motionReduced || !visualDirection || visualDirection !== semanticDirection) {
      displayValueRef.current = targetValue;
      setDisplayValue(targetValue);
      finish();
      return () => {
        window.clearTimeout(glowTimerRef.current);
      };
    }

    const step = visualDirection === "gain" ? 1 : -1;
    const stepDelay = getVpCounterStepDelay(startingValue, targetValue);
    const startedAt = Date.now();
    let nextValue = startingValue;
    const advance = () => {
      if (sequenceRef.current !== sequence) return;
      const elapsed = Date.now() - startedAt;
      nextValue = elapsed >= VP_COUNTER_MAX_DURATION_MS
        ? targetValue
        : nextValue + step;
      displayValueRef.current = nextValue;
      setDisplayValue(nextValue);
      if (nextValue === targetValue) {
        stepTimerRef.current = null;
        finish();
        return;
      }
      stepTimerRef.current = window.setTimeout(advance, stepDelay);
    };
    stepTimerRef.current = window.setTimeout(advance, Math.min(stepDelay, 64));

    return () => {
      window.clearTimeout(stepTimerRef.current);
      window.clearTimeout(glowTimerRef.current);
      stepTimerRef.current = null;
      glowTimerRef.current = null;
    };
  }, [label, motionReduced, targetValue]);

  const rootClassName = [
    variant === "inline" ? "seapals-vp-value" : "seapals-reef-score-card is-vp",
    direction ? `is-vp-${direction}` : "",
    motionReduced ? "is-vp-reduced-motion" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <span
      className={rootClassName}
      data-vp-counter={owner}
      data-vp-direction={direction ?? "steady"}
      data-tutorial-target={tutorialTarget}
      aria-label={`${label}: ${targetValue} Victory Points`}
    >
      {variant === "badge" ? <small aria-hidden="true">VP</small> : null}
      <strong key={`${direction ?? "steady"}-${displayValue}`} aria-hidden="true">{displayValue}</strong>
      <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
    </span>
  );
}
