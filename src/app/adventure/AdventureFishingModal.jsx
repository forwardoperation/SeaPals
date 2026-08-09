"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cardsById } from "@/data/cards";
import {
  ELVERSON_REEF_CATCHES,
  rollElversonReefCatch,
} from "./adventureFishing.mjs";
import styles from "./adventure.module.css";

const MAX_MISSED_REELS = 3;
const CASTING_DURATION_MS = 420;
const ESCAPE_RETURN_DELAY_MS = 1400;
const FISHING_STAGES = Object.freeze(["Cast", "Watch", "Hook", "Reel"]);

function createCatchZone(width, randomValue = Math.random()) {
  const margin = 8;
  const available = 100 - width - margin * 2;
  return margin + Math.max(0, Math.min(0.999999, randomValue)) * available;
}

function fishingStageIndex(phase, escapeReason) {
  if (phase === "prompt" || phase === "casting") return 0;
  if (phase === "waiting") return 1;
  if (phase === "bite" || (phase === "escaped" && escapeReason === "missed-bite")) return 2;
  return 3;
}

function phaseHeading(phase, creatureName) {
  if (phase === "casting") return "Casting the line...";
  if (phase === "waiting") return "Watch the float";
  if (phase === "bite") return "Set the hook!";
  if (phase === "reeling") return "Keep the line steady";
  if (phase === "escaped") return "It slipped away";
  if (phase === "caught") return `${creatureName ?? "Creature"} caught!`;
  return "Ready at the water";
}

function phaseCopy(
  phase,
  tutorial,
  required,
  assistedMode,
  creatureName,
  escapeReason,
  reelFeedback,
) {
  if (phase === "casting") return "The line arcs out and the float settles on the reef.";
  if (phase === "waiting") return "The float is drifting. Watch closely for a bite...";
  if (phase === "bite") return assistedMode
    ? "BITE! No rush—set the hook when you are ready."
    : "BITE! Set the hook now!";
  if (phase === "reeling" && reelFeedback === "success") return "Good tension! The creature is coming closer.";
  if (phase === "reeling" && reelFeedback === "strain") return "Too much strain. Wait for the marker to enter the green zone.";
  if (phase === "reeling") return assistedMode
    ? "Steady reel is active. Bring the creature in one careful reel at a time."
    : "Reel while the marker is inside the green calm-water zone.";
  if (phase === "escaped") {
    const reasonCopy = escapeReason === "missed-bite"
      ? "The bite passed before the hook was set."
      : escapeReason === "record-failed"
        ? "The catch could not be secured this time."
        : "The line strained and the creature slipped free.";
    return required
      ? `${reasonCopy} Wyeth checks the line and readies another practice cast.`
      : `${reasonCopy} Head back to the water's edge when you are ready.`;
  }
  if (phase === "caught") return `${creatureName ?? "Creature"} is safely alongside. Check the Reef Log, then return to shore.`;
  return tutorial
    ? "Wyeth points out the float and the safe tension zone. Ready for a practice cast?"
    : "Cast into the reef and watch the float for a bite.";
}

export default function AdventureFishingModal({
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
  const headingRef = useRef(null);
  const primaryActionRef = useRef(null);
  const initialCastStartedRef = useRef(false);
  const returnedToShoreRef = useRef(false);
  const castingRemainingRef = useRef(CASTING_DURATION_MS);
  const waitingRemainingRef = useRef(0);
  const biteRemainingRef = useRef(3000);
  const escapeReturnRemainingRef = useRef(ESCAPE_RETURN_DELAY_MS);
  const meterElapsedRef = useRef(0);
  const [phase, setPhase] = useState("prompt");
  const [creature, setCreature] = useState(null);
  const [meterPosition, setMeterPosition] = useState(0);
  const [zoneStart, setZoneStart] = useState(33);
  const [successfulReels, setSuccessfulReels] = useState(0);
  const [missedReels, setMissedReels] = useState(0);
  const [catchResult, setCatchResult] = useState(null);
  const [assistedMode, setAssistedMode] = useState(Boolean(reducedMotion || (tutorial && required)));
  const [escapeReason, setEscapeReason] = useState(null);
  const [reelFeedback, setReelFeedback] = useState(null);
  const [reelFeedbackNonce, setReelFeedbackNonce] = useState(0);
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState !== "hidden",
  );

  const creatureCard = creature ? cardsById[creature.cardId] ?? null : null;
  const statusMessage = phaseCopy(
    phase,
    tutorial,
    required,
    assistedMode,
    creatureCard?.name ?? creature?.id,
    escapeReason,
    reelFeedback,
  );
  const visibleDiscoveries = progress?.discoveredCount ?? 0;
  const aquariumSpecies = progress?.aquariumSpeciesCount ?? 0;
  const lineInZone = creature
    ? meterPosition >= zoneStart && meterPosition <= zoneStart + creature.catchZoneWidth
    : false;
  const currentStageIndex = fishingStageIndex(phase, escapeReason);
  const terminalPhase = phase === "caught" || phase === "escaped";
  const showReefLog = !["casting", "waiting", "bite", "reeling"].includes(phase);

  const returnToShore = useCallback((payload) => {
    if (returnedToShoreRef.current) return;
    returnedToShoreRef.current = true;
    if (onReturnToShore) {
      onReturnToShore(payload);
      return;
    }
    onClose?.();
  }, [onClose, onReturnToShore]);

  useEffect(() => {
    const handleVisibilityChange = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const previousFocus = document.activeElement;
    const focusableSelector = "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";
    primaryActionRef.current?.focus();
    const handleTab = (event) => {
      if (event.key !== "Tab") return;
      const modalStack = [...document.querySelectorAll("[data-adventure-modal='true']")];
      if (modalStack.at(-1) !== dialog) return;
      const focusable = Array.from(dialog.querySelectorAll(focusableSelector))
        .filter((element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true");
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!dialog.contains(document.activeElement) || !focusable.includes(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", handleTab);
    return () => {
      dialog.removeEventListener("keydown", handleTab);
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    if (!reducedMotion) return;
    setAssistedMode(true);
    if (phase === "reeling" && creature) {
      setMeterPosition(zoneStart + creature.catchZoneWidth / 2);
    }
  }, [creature, phase, reducedMotion, zoneStart]);

  useEffect(() => {
    if (terminalPhase) {
      const frame = window.requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
      return () => window.cancelAnimationFrame(frame);
    }
    if (phase === "casting" || phase === "waiting") {
      dialogRef.current?.focus({ preventScroll: true });
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => {
      primaryActionRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [phase, terminalPhase]);

  useEffect(() => {
    if (!startWithCast || initialCastStartedRef.current) return;
    initialCastStartedRef.current = true;
    castLine();
  }, [startWithCast]);

  useEffect(() => {
    if (phase !== "casting" || !pageVisible) return undefined;
    const remaining = Math.max(0, castingRemainingRef.current);
    const startedAt = performance.now();
    const timer = window.setTimeout(() => {
      castingRemainingRef.current = 0;
      setPhase("waiting");
    }, remaining);
    return () => {
      window.clearTimeout(timer);
      if (castingRemainingRef.current > 0) {
        castingRemainingRef.current = Math.max(0, remaining - (performance.now() - startedAt));
      }
    };
  }, [pageVisible, phase]);

  useEffect(() => {
    if (phase !== "waiting" || !pageVisible) return undefined;
    const remaining = Math.max(0, waitingRemainingRef.current);
    const startedAt = performance.now();
    const timer = window.setTimeout(() => {
      waitingRemainingRef.current = 0;
      biteRemainingRef.current = 3000;
      setPhase("bite");
    }, remaining);
    return () => {
      window.clearTimeout(timer);
      if (waitingRemainingRef.current > 0) {
        waitingRemainingRef.current = Math.max(0, remaining - (performance.now() - startedAt));
      }
    };
  }, [pageVisible, phase]);

  useEffect(() => {
    if (phase !== "bite" || !pageVisible || reducedMotion || assistedMode) return undefined;
    const remaining = Math.max(0, biteRemainingRef.current);
    const startedAt = performance.now();
    const timer = window.setTimeout(() => {
      biteRemainingRef.current = 0;
      escapeReturnRemainingRef.current = ESCAPE_RETURN_DELAY_MS;
      setEscapeReason("missed-bite");
      setPhase("escaped");
    }, remaining);
    return () => {
      window.clearTimeout(timer);
      if (biteRemainingRef.current > 0) {
        biteRemainingRef.current = Math.max(0, remaining - (performance.now() - startedAt));
      }
    };
  }, [assistedMode, pageVisible, phase, reducedMotion]);

  useEffect(() => {
    if (
      phase !== "escaped"
      || required
      || escapeReason === "record-failed"
      || !pageVisible
    ) return undefined;
    const remaining = Math.max(0, escapeReturnRemainingRef.current);
    const startedAt = performance.now();
    const timer = window.setTimeout(() => {
      escapeReturnRemainingRef.current = 0;
      returnToShore({ reason: "escaped", escapeReason });
    }, remaining);
    return () => {
      window.clearTimeout(timer);
      if (escapeReturnRemainingRef.current > 0) {
        escapeReturnRemainingRef.current = Math.max(0, remaining - (performance.now() - startedAt));
      }
    };
  }, [escapeReason, pageVisible, phase, required, returnToShore]);

  useEffect(() => {
    if (phase !== "reeling" || assistedMode || reducedMotion || !pageVisible) return undefined;
    let animationFrame = 0;
    let lastTimestamp = null;
    const cycleDuration = 1500;
    const updateMeter = (timestamp) => {
      if (lastTimestamp !== null) meterElapsedRef.current += timestamp - lastTimestamp;
      lastTimestamp = timestamp;
      const cycle = (meterElapsedRef.current % cycleDuration) / cycleDuration;
      const position = cycle <= 0.5 ? cycle * 200 : (1 - cycle) * 200;
      setMeterPosition(position);
      animationFrame = window.requestAnimationFrame(updateMeter);
    };
    animationFrame = window.requestAnimationFrame(updateMeter);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [assistedMode, pageVisible, phase, reducedMotion]);

  const collectionPreview = useMemo(() => (
    ELVERSON_REEF_CATCHES.map((entry) => ({
      ...entry,
      discovered: progress?.creatures?.find((candidate) => candidate.id === entry.id)?.discovered === true,
    }))
  ), [progress]);

  function castLine() {
    const selectedCreature = tutorial
      ? ELVERSON_REEF_CATCHES[0]
      : rollElversonReefCatch(Math.random());
    const nextZoneStart = createCatchZone(selectedCreature.catchZoneWidth);
    returnedToShoreRef.current = false;
    castingRemainingRef.current = reducedMotion ? 80 : CASTING_DURATION_MS;
    waitingRemainingRef.current = reducedMotion ? 700 : 850 + Math.floor(Math.random() * 950);
    biteRemainingRef.current = 3000;
    escapeReturnRemainingRef.current = ESCAPE_RETURN_DELAY_MS;
    meterElapsedRef.current = 0;
    setCreature(selectedCreature);
    setMeterPosition(assistedMode ? nextZoneStart + selectedCreature.catchZoneWidth / 2 : 0);
    setZoneStart(nextZoneStart);
    setSuccessfulReels(0);
    setMissedReels(0);
    setCatchResult(null);
    setEscapeReason(null);
    setReelFeedback(null);
    setPhase("casting");
  }

  function setHook() {
    if (phase !== "bite" || !creature) return;
    const nextZoneStart = createCatchZone(creature.catchZoneWidth);
    meterElapsedRef.current = 0;
    setMeterPosition(assistedMode ? nextZoneStart + creature.catchZoneWidth / 2 : 0);
    setZoneStart(nextZoneStart);
    setReelFeedback(null);
    setPhase("reeling");
  }

  function enableAssistedReel() {
    if (assistedMode) return;
    setAssistedMode(true);
    if (phase === "reeling" && creature) {
      setMeterPosition(zoneStart + creature.catchZoneWidth / 2);
      window.requestAnimationFrame(() => primaryActionRef.current?.focus());
    }
  }

  function reelLine() {
    if (phase !== "reeling" || !creature) return;
    if (assistedMode || lineInZone) {
      const nextSuccessfulReels = successfulReels + 1;
      setSuccessfulReels(nextSuccessfulReels);
      setReelFeedback("success");
      setReelFeedbackNonce((current) => current + 1);
      if (nextSuccessfulReels >= creature.requiredReels) {
        const result = onCatch(creature.id);
        if (!result) {
          setCatchResult(null);
          escapeReturnRemainingRef.current = ESCAPE_RETURN_DELAY_MS;
          setEscapeReason("record-failed");
          setPhase("escaped");
          return;
        }
        setCatchResult(result);
        setPhase("caught");
        return;
      }
      const nextZoneStart = createCatchZone(creature.catchZoneWidth);
      setZoneStart(nextZoneStart);
      if (assistedMode) setMeterPosition(nextZoneStart + creature.catchZoneWidth / 2);
      return;
    }

    const nextMissedReels = missedReels + 1;
    setMissedReels(nextMissedReels);
    setReelFeedback("strain");
    setReelFeedbackNonce((current) => current + 1);
    if (nextMissedReels >= MAX_MISSED_REELS) {
      escapeReturnRemainingRef.current = ESCAPE_RETURN_DELAY_MS;
      setEscapeReason("line-strain");
      setPhase("escaped");
      return;
    }
    const nextZoneStart = createCatchZone(creature.catchZoneWidth);
    setZoneStart(nextZoneStart);
    if (assistedMode) setMeterPosition(nextZoneStart + creature.catchZoneWidth / 2);
  }

  function handleDialogKeyDown(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();

    if (phase === "caught") {
      returnToShore({
        reason: tutorial ? "tutorial-complete" : "caught",
        creatureId: creature?.id,
      });
      return;
    }
    if (phase === "escaped" && !required) {
      returnToShore({
        reason: escapeReason === "record-failed" ? "error" : "escaped",
        escapeReason,
      });
      return;
    }
    onClose?.();
  }

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      data-adventure-modal="true"
      className={styles.fishingLayer}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fishing-title"
      aria-describedby="fishing-status"
      onKeyDown={handleDialogKeyDown}
    >
      <section className={styles.fishingCard} data-fishing-phase={phase}>
        <header className={styles.fishingHeader}>
          <div>
            <span className={styles.fishingEyebrow}>
              {tutorial ? "Fisherman Wyeth's lesson" : "Elverson reef fishing"}
            </span>
            <h2 ref={headingRef} id="fishing-title" tabIndex={terminalPhase ? -1 : undefined}>
              {phaseHeading(phase, creatureCard?.name ?? creature?.id)}
            </h2>
          </div>
          {required ? (
            <span className={styles.fishingRequiredBadge}>Practice catch required</span>
          ) : !["prompt", "caught", "escaped"].includes(phase) ? (
            <button type="button" className={styles.fishingClose} onClick={onClose}>Leave shore</button>
          ) : null}
        </header>

        <ol className={styles.fishingStageRail} aria-label="Fishing steps">
          {FISHING_STAGES.map((stage, index) => {
            const state = phase === "caught" || index < currentStageIndex
              ? "complete"
              : index === currentStageIndex
                ? "current"
                : "upcoming";
            return (
              <li key={stage} data-state={state} aria-current={state === "current" ? "step" : undefined}>
                <span>{index + 1}</span>
                <strong>{stage}</strong>
              </li>
            );
          })}
        </ol>

        <div className={styles.fishingWater} data-feedback={reelFeedback || undefined} aria-hidden="true">
          <span className={styles.fishingHorizon} />
          <span className={`${styles.fishingFloat} ${styles[`fishingFloat${phase[0].toUpperCase()}${phase.slice(1)}`] ?? ""}`}>
            <i />
          </span>
          <span className={styles.fishingRipple}><i /><i /><i /></span>
          <span className={styles.fishingShadow} />
          <span className={styles.fishingLine} />
        </div>

        <p
          id="fishing-status"
          className={`${styles.fishingStatus} ${phase === "bite" ? styles.fishingStatusBite : ""}`}
          role="status"
          aria-live={phase === "bite" ? "assertive" : "polite"}
          aria-atomic="true"
        >
          {statusMessage}
        </p>

        {phase === "reeling" && creature ? (
          <section
            className={styles.fishingTensionPanel}
            data-feedback={reelFeedback || undefined}
            aria-label="Fishing line tension challenge"
          >
            <div className={styles.fishingTensionLabels}>
              <span>Slack</span>
              <strong>{successfulReels} / {creature.requiredReels} careful reels</strong>
              <span>Strain</span>
            </div>
            <div
              key={`${reelFeedback ?? "steady"}-${reelFeedbackNonce}`}
              className={styles.fishingTensionTrack}
              data-assisted={assistedMode || undefined}
              data-feedback={reelFeedback || undefined}
              aria-hidden="true"
            >
              <span
                className={styles.fishingCatchZone}
                style={{ left: `${zoneStart}%`, width: `${creature.catchZoneWidth}%` }}
              />
              <span
                className={`${styles.fishingMeterMarker} ${lineInZone ? styles.fishingMeterMarkerReady : ""}`}
                style={{ left: `${meterPosition}%` }}
              />
            </div>
            <div className={styles.fishingReelCue} data-ready={assistedMode || lineInZone || undefined}>
              <strong>{assistedMode || lineInZone ? "REEL" : "HOLD"}</strong>
              <span>{assistedMode || lineInZone ? "The line is in calm water" : "Wait for the marker to reach green"}</span>
            </div>
            <div className={styles.fishingAttempts} aria-label={`${missedReels} strained reels out of ${MAX_MISSED_REELS}`}>
              {Array.from({ length: MAX_MISSED_REELS }, (_, index) => (
                <i key={index} className={index < missedReels ? styles.fishingAttemptMissed : ""} />
              ))}
            </div>
            <span className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
              {assistedMode
                ? `Steady assisted reel active. ${Math.max(0, creature.requiredReels - successfulReels)} careful reels remain. ${Math.max(0, MAX_MISSED_REELS - missedReels)} strain chances remain.`
                : `Standard visual timing active. ${Math.max(0, creature.requiredReels - successfulReels)} successful reels remain. ${Math.max(0, MAX_MISSED_REELS - missedReels)} strain chances remain. Use assisted reel for a static, untimed challenge.`}
            </span>
            {!assistedMode ? (
              <button type="button" className={styles.fishingAssistInline} onClick={enableAssistedReel}>
                Use assisted reel
              </button>
            ) : null}
          </section>
        ) : null}

        {phase === "caught" && creature ? (
          <article className={styles.fishingCatchReveal}>
            <div className={styles.fishingCatchArt}>
              {creatureCard?.image ? (
                <Image src={creatureCard.image} alt="" width={138} height={192} />
              ) : <span aria-hidden="true">?</span>}
            </div>
            <div>
              <span className={`${styles.fishingRarity} ${styles[`fishingRarity${creature.rarity}`]}`}>
                {creature.rarityLabel} {creature.category}
              </span>
              <h3>{creatureCard?.name ?? creature.id}</h3>
              <p>{creature.note}</p>
              <strong>{catchResult?.firstDiscovery ? "New Reef Log discovery!" : "Another healthy observation recorded."}</strong>
              <small>Bring this catch to Mr. Easterling at the Aquarium care desk.</small>
            </div>
          </article>
        ) : null}

        {phase === "prompt" ? (
          <div className={styles.fishingAssistOption}>
            <button
              type="button"
              aria-pressed={assistedMode}
              disabled={reducedMotion}
              onClick={() => setAssistedMode((current) => !current)}
            >
              Assisted reel: {assistedMode ? "On" : "Off"}
            </button>
            <span>{reducedMotion ? "Enabled by your reduced-motion preference." : "Turns the moving timing meter into a steady, untimed reel."}</span>
          </div>
        ) : null}

        <div className={styles.fishingActions}>
          {phase === "prompt" ? (
            <>
              <button ref={primaryActionRef} type="button" aria-keyshortcuts="Enter Space" onClick={castLine}>
                {tutorial ? "Start the practice cast" : "Cast line"}
              </button>
              {!required ? <button type="button" className={styles.secondaryButton} onClick={onClose}>Not now</button> : null}
            </>
          ) : null}
          {phase === "casting" ? <button type="button" disabled>Casting...</button> : null}
          {phase === "waiting" ? <button type="button" disabled>Watch the float...</button> : null}
          {phase === "bite" ? <button ref={primaryActionRef} type="button" aria-keyshortcuts="Enter Space" className={styles.fishingHookButton} onClick={setHook}>Set hook</button> : null}
          {phase === "reeling" ? <button ref={primaryActionRef} type="button" aria-keyshortcuts="Enter Space" onClick={reelLine}>Reel</button> : null}
          {phase === "caught" ? (
            <button
              ref={primaryActionRef}
              type="button"
              onClick={() => returnToShore({
                reason: tutorial ? "tutorial-complete" : "caught",
                creatureId: creature?.id,
              })}
            >
              {tutorial ? "Finish Wyeth's lesson" : "Return to shore"}
            </button>
          ) : null}
          {phase === "escaped" && required ? (
            <button ref={primaryActionRef} type="button" onClick={castLine}>Try again with Wyeth</button>
          ) : null}
          {phase === "escaped" && !required ? (
            <button
              ref={primaryActionRef}
              type="button"
              className={escapeReason === "record-failed" ? undefined : styles.secondaryButton}
              onClick={() => returnToShore({
                reason: escapeReason === "record-failed" ? "error" : "escaped",
                escapeReason,
              })}
            >
              Return to shore
            </button>
          ) : null}
        </div>

        {showReefLog ? <footer className={styles.fishingLogStrip}>
          <div>
            <strong>Elverson Reef Log</strong>
            <span>{visibleDiscoveries} / {ELVERSON_REEF_CATCHES.length} discovered · {aquariumSpecies} species in the aquarium</span>
          </div>
          <ol aria-label="Elverson reef creature discoveries">
            {collectionPreview.map((entry) => (
              <li
                key={entry.id}
                className={entry.discovered ? styles.fishingLogFound : ""}
                title={entry.discovered ? cardsById[entry.cardId]?.name ?? entry.id : "Undiscovered creature"}
                aria-label={entry.discovered
                  ? `${cardsById[entry.cardId]?.name ?? entry.id}, discovered`
                  : `Undiscovered ${entry.rarityLabel.toLowerCase()} ${entry.category}`}
              >
                <span aria-hidden="true">{entry.discovered ? "●" : "?"}</span>
              </li>
            ))}
          </ol>
        </footer> : null}
      </section>
    </div>
  );
}
