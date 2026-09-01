"use client";

import { useEffect, useRef } from "react";
import {
  OpeningCoinPhase,
  OpeningCoinSide,
  OpeningPlayer,
  formatOpeningCoinSide,
} from "./openingCoinFlip.mjs";
import styles from "./OpeningCoinBoardPresentation.module.css";

const WIN_BURST_RAYS = [
  [0, "#67e8f9", 0, 1],
  [36, "#fbbf24", 45, 0.78],
  [72, "#34d399", 15, 0.92],
  [108, "#fb7185", 70, 0.7],
  [144, "#a78bfa", 30, 1],
  [180, "#22d3ee", 65, 0.82],
  [216, "#f59e0b", 20, 0.72],
  [252, "#2dd4bf", 75, 0.96],
  [288, "#f472b6", 35, 0.76],
  [324, "#fde68a", 55, 0.9],
];

const WIN_BURST_SPARKS = [
  [18, "#fef3c7", 5, 0.8],
  [62, "#67e8f9", 80, 1],
  [116, "#fb7185", 30, 0.72],
  [166, "#34d399", 95, 0.9],
  [222, "#fde68a", 55, 1],
  [274, "#a78bfa", 20, 0.78],
  [332, "#22d3ee", 70, 0.86],
];

function OpeningCoinWinBurst() {
  return (
    <span className={styles.winBurst} data-opening-coin-win-burst aria-hidden="true">
      <span className={styles.burstHalo} />
      <span className={styles.burstRing} />
      {WIN_BURST_RAYS.map(([angle, color, delay, scale]) => (
        <i
          key={`ray-${angle}`}
          className={styles.burstRay}
          style={{
            "--burst-angle": `${angle}deg`,
            "--burst-color": color,
            "--burst-delay": `${delay}ms`,
            "--burst-scale": scale,
          }}
        />
      ))}
      {WIN_BURST_SPARKS.map(([angle, color, delay, scale]) => (
        <i
          key={`spark-${angle}`}
          className={styles.burstSpark}
          style={{
            "--burst-angle": `${angle}deg`,
            "--burst-color": color,
            "--burst-delay": `${delay}ms`,
            "--burst-scale": scale,
          }}
        />
      ))}
    </span>
  );
}

export function OpeningCoinVisual({
  mode = "landed",
  side = OpeningCoinSide.FISH,
  onAnimationEnd = null,
  label = "",
  celebrate = false,
}) {
  const normalizedSide = side === OpeningCoinSide.BLANK ? OpeningCoinSide.BLANK : OpeningCoinSide.FISH;
  const motionClass = mode === "spinning"
    ? "seapals-opening-coin-spinning"
    : mode === "flipping"
      ? `seapals-opening-coin-flipping-${normalizedSide}`
      : mode === "ready"
        ? `seapals-opening-coin-ready-${normalizedSide}`
        : `seapals-opening-coin-landed-${normalizedSide}`;
  const shadowClass = mode === "spinning"
    ? " seapals-opening-coin-shadow-spinning"
    : mode === "flipping"
      ? " seapals-opening-coin-shadow-flipping"
      : "";

  return (
    <div
      className="seapals-opening-coin-stage"
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    >
      {celebrate ? <OpeningCoinWinBurst /> : null}
      <div className={`seapals-opening-coin ${motionClass}`} onAnimationEnd={onAnimationEnd ?? undefined}>
        <span className={`seapals-opening-coin-face seapals-opening-coin-fish ${styles.fishFace}`}>
          <img
            className={styles.fishIcon}
            src="/images/icons/reef-fish-icon.png"
            alt=""
            draggable={false}
          />
        </span>
        <span className={`seapals-opening-coin-face seapals-opening-coin-blank ${styles.blankFace}`}>
          <i className={styles.blankEmboss} />
        </span>
      </div>
      <span className={`seapals-opening-coin-shadow${shadowClass}`} />
    </div>
  );
}

export default function OpeningCoinBoardPresentation({
  active,
  event,
  reducedMotion = false,
  onStop,
  onLanded,
  onBeginSetup,
}) {
  const layerRef = useRef(null);
  const previousFocusRef = useRef(null);
  const restoreFocusFrameRef = useRef(0);
  const phase = event?.type;

  useEffect(() => {
    if (!active) return undefined;
    window.cancelAnimationFrame(restoreFocusFrameRef.current);
    previousFocusRef.current = document.activeElement;
    return () => {
      const previousFocus = previousFocusRef.current;
      restoreFocusFrameRef.current = window.requestAnimationFrame(() => {
        if (
          previousFocus instanceof HTMLElement
          && previousFocus.isConnected
          && previousFocus !== document.body
          && previousFocus !== document.documentElement
          && !previousFocus.closest("[inert]")
        ) {
          previousFocus.focus({ preventScroll: true });
          return;
        }
        document.querySelector("[data-simulator-back-control]")?.focus?.({ preventScroll: true });
      });
    };
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;
    const focusFrame = window.requestAnimationFrame(() => {
      const primaryControl = layerRef.current?.querySelector("[data-opening-coin-primary]");
      const focusTarget = primaryControl ?? layerRef.current;
      focusTarget?.focus?.({ preventScroll: true });
      if (primaryControl && phase === OpeningCoinPhase.RESULT) {
        primaryControl.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      }
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [active, phase]);

  if (!active || !event) return null;

  const isWaiting = phase === OpeningCoinPhase.READY;
  const isLanding = phase === OpeningCoinPhase.FLIPPING;
  const isResult = phase === OpeningCoinPhase.RESULT;
  const landedLabel = formatOpeningCoinSide(event.coinLanded);
  const playerWon = event.coinWinner === OpeningPlayer.PLAYER;
  const visualSide = isLanding || isResult ? event.coinLanded : OpeningCoinSide.FISH;

  function trapFocus(eventKey) {
    if (eventKey.key !== "Tab") return;
    const controls = [...(layerRef.current?.querySelectorAll(
      'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ) ?? [])];
    if (!controls.length) {
      eventKey.preventDefault();
      layerRef.current?.focus?.({ preventScroll: true });
      return;
    }
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (controls.length === 1) {
      eventKey.preventDefault();
      first.focus({ preventScroll: true });
      return;
    }
    if (eventKey.shiftKey && document.activeElement === first) {
      eventKey.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!eventKey.shiftKey && document.activeElement === last) {
      eventKey.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  return (
    <div
      ref={layerRef}
      className={`${styles.layer}${reducedMotion ? ` ${styles.reducedMotion}` : ""}`}
      data-opening-coin-layer
      data-opening-coin-phase={phase}
      role="dialog"
      aria-modal="true"
      aria-labelledby="opening-coin-board-title"
      aria-describedby="opening-coin-board-message"
      tabIndex={-1}
      onKeyDown={trapFocus}
    >
      {!isWaiting ? <div className={styles.screenBlocker} aria-hidden="true" /> : null}
      {isWaiting ? (
        <button
          type="button"
          className={styles.tapCatcher}
          data-opening-coin-primary
          data-flip-opening-coin
          aria-label="Flip the opening coin. Reef Fish means you go first; blank means the opponent goes first."
          onClick={onStop}
        >
          <span className="sr-only">Tap anywhere on the board, or press Enter or Space, to land the opening coin.</span>
        </button>
      ) : null}

      <div className={styles.playerZone} data-opening-coin-player-zone>
        <section className={`${styles.panel}${isWaiting ? ` ${styles.passThroughPanel}` : ""}${isWaiting || isLanding ? ` ${styles.motionPanel}` : ""}${isResult ? ` ${styles.resultPanel}` : ""}`}>
          {isWaiting ? (
            <>
              <span className={styles.eyebrow}>Opening toss</span>
              <h2 id="opening-coin-board-title" className="sr-only">Opening coin spinning</h2>
              <p id="opening-coin-board-message" className="sr-only">Tap anywhere to land the coin. Reef Fish means you go first; blank means the opponent goes first.</p>
              <div className={styles.visual}>
                <OpeningCoinVisual mode={reducedMotion ? "ready" : "spinning"} side={visualSide} />
              </div>
              <strong className={styles.tapPrompt} aria-hidden="true">Tap to flip</strong>
            </>
          ) : null}

          {isLanding ? (
            <>
              <span className={styles.eyebrow}>Opening toss</span>
              <h2 id="opening-coin-board-title" className="sr-only">Coin landing</h2>
              <p id="opening-coin-board-message" className="sr-only">The opening coin is landing.</p>
              <div className={styles.visual}>
                <OpeningCoinVisual
                  mode="flipping"
                  side={visualSide}
                  onAnimationEnd={() => onLanded?.(event.flipId)}
                />
              </div>
              <strong className={styles.landingPrompt} role="status" aria-live="polite" aria-atomic="true">Landing&hellip;</strong>
            </>
          ) : null}

          {isResult ? (
            <>
              <span className={styles.eyebrow}>Opening toss</span>
              <h2 id="opening-coin-board-title" className={styles.title}>{event.title}</h2>
              <p id="opening-coin-board-message" className={styles.message}>{event.message}</p>
              <div className={styles.resultVisual}>
                <OpeningCoinVisual
                  mode="landed"
                  side={event.coinLanded}
                  label={`Coin landed ${landedLabel}`}
                  celebrate={playerWon}
                />
              </div>
              <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{event.title} {event.message}</p>
              <button
                type="button"
                data-opening-coin-primary
                onClick={onBeginSetup}
                className={playerWon ? styles.primaryAction : styles.opponentAction}
              >
                Begin Setup
              </button>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
