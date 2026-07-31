"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { cardsById } from "@/data/cards";
import {
  ELVERSON_REEF_CATCHES,
  rollElversonReefCatch,
} from "./adventureFishing.mjs";
import styles from "./adventure.module.css";

const MAX_MISSED_REELS = 3;

function createCatchZone(width, randomValue = Math.random()) {
  const margin = 8;
  const available = 100 - width - margin * 2;
  return margin + Math.max(0, Math.min(0.999999, randomValue)) * available;
}

function phaseCopy(phase, tutorial, required, assistedMode, creatureName, rarityLabel) {
  if (phase === "waiting") return "The float is drifting. Watch closely for a bite...";
  if (phase === "bite") return "BITE! Set the hook now!";
  if (phase === "reeling") return assistedMode
    ? "Steady reel is active. Reel carefully to bring the creature alongside."
    : "Keep the line marker inside the calm-water zone when you reel.";
  if (phase === "escaped") return required
    ? "The creature slipped free. Wyeth checks the line and stays with you for another practice cast."
    : "The creature slipped free. Check the line and try another careful cast.";
  if (phase === "caught") return `${creatureName ?? "Creature"} caught! ${rarityLabel ?? "Reef"} observation secured in a water-safe carrier for Mr. Easterling's aquarium team.`;
  return tutorial
    ? "Wyeth points out the float, the safe tension zone, and how to stop before the line strains. Ready for a practice cast?"
    : "Would you like to fish here? The aquarium team will assess every catch for safe, permitted care.";
}

export default function AdventureFishingModal({
  tutorial = false,
  required = false,
  reducedMotion = false,
  progress,
  onCatch,
  onClose,
}) {
  const dialogRef = useRef(null);
  const primaryActionRef = useRef(null);
  const [phase, setPhase] = useState("prompt");
  const [creature, setCreature] = useState(null);
  const [meterPosition, setMeterPosition] = useState(0);
  const [zoneStart, setZoneStart] = useState(33);
  const [successfulReels, setSuccessfulReels] = useState(0);
  const [missedReels, setMissedReels] = useState(0);
  const [catchResult, setCatchResult] = useState(null);
  const [assistedMode, setAssistedMode] = useState(Boolean(reducedMotion || (tutorial && required)));

  const creatureCard = creature ? cardsById[creature.cardId] ?? null : null;
  const statusMessage = phaseCopy(
    phase,
    tutorial,
    required,
    assistedMode,
    creatureCard?.name ?? creature?.id,
    creature?.rarityLabel,
  );
  const visibleDiscoveries = progress?.discoveredCount ?? 0;
  const aquariumSpecies = progress?.aquariumSpeciesCount ?? 0;
  const lineInZone = creature
    ? meterPosition >= zoneStart && meterPosition <= zoneStart + creature.catchZoneWidth
    : false;

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
    if (phase === "waiting") {
      dialogRef.current?.focus({ preventScroll: true });
      return undefined;
    }
    const frame = window.requestAnimationFrame(() => {
      primaryActionRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [phase]);

  useEffect(() => {
    if (phase !== "waiting") return undefined;
    const delay = reducedMotion ? 700 : 850 + Math.floor(Math.random() * 950);
    const timer = window.setTimeout(() => setPhase("bite"), delay);
    return () => window.clearTimeout(timer);
  }, [phase, reducedMotion]);

  useEffect(() => {
    if (phase !== "bite") return undefined;
    const timer = window.setTimeout(
      () => setPhase("escaped"),
      reducedMotion || assistedMode ? 6500 : 3000,
    );
    return () => window.clearTimeout(timer);
  }, [assistedMode, phase, reducedMotion]);

  useEffect(() => {
    if (phase !== "reeling" || assistedMode || reducedMotion) return undefined;
    let animationFrame = 0;
    let startedAt = null;
    const cycleDuration = reducedMotion ? 2600 : 1500;
    const updateMeter = (timestamp) => {
      if (startedAt === null) startedAt = timestamp;
      const cycle = ((timestamp - startedAt) % cycleDuration) / cycleDuration;
      const position = cycle <= 0.5 ? cycle * 200 : (1 - cycle) * 200;
      setMeterPosition(position);
      animationFrame = window.requestAnimationFrame(updateMeter);
    };
    animationFrame = window.requestAnimationFrame(updateMeter);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [assistedMode, phase, reducedMotion]);

  const collectionPreview = useMemo(() => (
    ELVERSON_REEF_CATCHES.map((entry) => ({
      ...entry,
      discovered: progress?.creatures?.find((candidate) => candidate.id === entry.id)?.discovered === true,
    }))
  ), [progress]);

  function castLine() {
    const selectedCreature = tutorial && creature === null
      ? ELVERSON_REEF_CATCHES[0]
      : rollElversonReefCatch(Math.random());
    const nextZoneStart = createCatchZone(selectedCreature.catchZoneWidth);
    setCreature(selectedCreature);
    setMeterPosition(assistedMode ? nextZoneStart + selectedCreature.catchZoneWidth / 2 : 0);
    setZoneStart(nextZoneStart);
    setSuccessfulReels(0);
    setMissedReels(0);
    setCatchResult(null);
    setPhase("waiting");
  }

  function setHook() {
    if (phase !== "bite") return;
    const nextZoneStart = createCatchZone(creature.catchZoneWidth);
    setMeterPosition(assistedMode ? nextZoneStart + creature.catchZoneWidth / 2 : 0);
    setZoneStart(nextZoneStart);
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
      if (nextSuccessfulReels >= creature.requiredReels) {
        const result = onCatch(creature.id);
        if (!result) {
          setCatchResult(null);
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
    if (nextMissedReels >= MAX_MISSED_REELS) {
      setPhase("escaped");
      return;
    }
    const nextZoneStart = createCatchZone(creature.catchZoneWidth);
    setZoneStart(nextZoneStart);
    if (assistedMode) setMeterPosition(nextZoneStart + creature.catchZoneWidth / 2);
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
    >
      <section className={styles.fishingCard} data-fishing-phase={phase}>
        <header className={styles.fishingHeader}>
          <div>
            <span className={styles.fishingEyebrow}>
              {tutorial ? "Fisherman Wyeth's lesson" : "Elverson reef fishing"}
            </span>
            <h2 id="fishing-title">
              {phase === "caught" ? `You caught ${creatureCard?.name ?? creature?.id}!` : "Cast, watch, and reel"}
            </h2>
          </div>
          {required ? (
            <span className={styles.fishingRequiredBadge}>Practice catch required</span>
          ) : (
            <button type="button" className={styles.fishingClose} onClick={onClose}>Leave shore</button>
          )}
        </header>

        <div className={styles.fishingWater} aria-hidden="true">
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
          <section className={styles.fishingTensionPanel} aria-label="Fishing line tension challenge">
            <div className={styles.fishingTensionLabels}>
              <span>Slack</span>
              <strong>{successfulReels} / {creature.requiredReels} careful reels</strong>
              <span>Strain</span>
            </div>
            <div
              className={styles.fishingTensionTrack}
              data-assisted={assistedMode || undefined}
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
            <div className={styles.fishingAttempts} aria-label={`${missedReels} strained reels out of ${MAX_MISSED_REELS}`}>
              {Array.from({ length: MAX_MISSED_REELS }, (_, index) => (
                <i key={index} className={index < missedReels ? styles.fishingAttemptMissed : ""} />
              ))}
            </div>
            <span className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
              {assistedMode
                ? `Steady assisted reel active. ${Math.max(0, creature.requiredReels - successfulReels)} careful reels remain.`
                : `Standard visual timing active. ${Math.max(0, creature.requiredReels - successfulReels)} successful reels remain. Use assisted reel for a static, untimed challenge.`}
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
              <small>Bring this catch to Mr. Easterling in the aquarium workshop.</small>
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
              <button ref={primaryActionRef} type="button" onClick={castLine}>
                {tutorial ? "Start the practice cast" : "Yes, cast a line"}
              </button>
              {!required ? <button type="button" className={styles.secondaryButton} onClick={onClose}>Not now</button> : null}
            </>
          ) : null}
          {phase === "waiting" ? <button type="button" disabled>Watch the float...</button> : null}
          {phase === "bite" ? <button ref={primaryActionRef} type="button" className={styles.fishingHookButton} onClick={setHook}>Set the hook!</button> : null}
          {phase === "reeling" ? <button ref={primaryActionRef} type="button" onClick={reelLine}>{assistedMode ? "Reel steadily" : "Reel now"}</button> : null}
          {phase === "caught" || phase === "escaped" ? (
            <>
              {phase === "caught" && tutorial ? (
                <button ref={primaryActionRef} type="button" onClick={onClose}>Finish Wyeth&apos;s lesson</button>
              ) : (
                <button ref={primaryActionRef} type="button" onClick={castLine}>
                  {required ? "Try the practice cast again" : "Cast again"}
                </button>
              )}
              {!required && !(phase === "caught" && tutorial) ? (
                <button type="button" className={styles.secondaryButton} onClick={onClose}>
                  {phase === "caught" ? "Return to shore" : "Put the rod away"}
                </button>
              ) : null}
            </>
          ) : null}
        </div>

        <footer className={styles.fishingLogStrip}>
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
        </footer>
      </section>
    </div>
  );
}
