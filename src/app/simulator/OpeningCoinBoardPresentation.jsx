"use client";

import { useEffect, useRef } from "react";
import {
  OpeningCoinPhase,
  OpeningPlayer,
  formatOpeningCoinSide,
} from "./openingCoinFlip.mjs";
import styles from "./OpeningCoinBoardPresentation.module.css";

export function OpeningCoinVisual({ mode = "landed", side = "heads", onAnimationEnd = null, label = "" }) {
  const normalizedSide = side === "tails" ? "tails" : "heads";
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
      <div className={`seapals-opening-coin ${motionClass}`} onAnimationEnd={onAnimationEnd ?? undefined}>
        <span className="seapals-opening-coin-face seapals-opening-coin-heads"><strong>H</strong><span>Heads</span></span>
        <span className="seapals-opening-coin-face seapals-opening-coin-tails"><strong>T</strong><span>Tails</span></span>
      </div>
      <span className={`seapals-opening-coin-shadow${shadowClass}`} />
    </div>
  );
}

export default function OpeningCoinBoardPresentation({
  active,
  event,
  tutorial = false,
  guideName = "Mr. Easterling",
  reducedMotion = false,
  onCall,
  onStop,
  onLanded,
  onChangeCall,
  onChooseOpeningPlayer,
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
      if (
        primaryControl
        && (phase === OpeningCoinPhase.CALL || phase === OpeningCoinPhase.RESULT)
      ) {
        primaryControl.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      }
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [active, phase]);

  if (!active || !event) return null;

  const isCalling = phase === OpeningCoinPhase.CALL;
  const isWaiting = phase === OpeningCoinPhase.READY;
  const isLanding = phase === OpeningCoinPhase.FLIPPING;
  const isResult = phase === OpeningCoinPhase.RESULT;
  const callLabel = formatOpeningCoinSide(event.coinCall);
  const landedLabel = formatOpeningCoinSide(event.coinLanded);
  const playerWon = event.coinWinner === OpeningPlayer.PLAYER;
  const visualSide = isLanding || isResult ? event.coinLanded : event.coinCall;

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
          aria-label={`Stop the opening coin. You called ${callLabel}.`}
          onClick={onStop}
        >
          <span className="sr-only">Tap anywhere on the board, or press Enter or Space, to stop the opening coin.</span>
        </button>
      ) : null}

      <div className={styles.playerZone} data-opening-coin-player-zone>
        <section className={`${styles.panel}${isWaiting ? ` ${styles.passThroughPanel}` : ""}${isWaiting || isLanding ? ` ${styles.motionPanel}` : ""}`}>
          {isCalling ? (
            <>
              <span className={styles.eyebrow}>Opening flip</span>
              <h2 id="opening-coin-board-title" className={styles.title}>{event.title}</h2>
              <p id="opening-coin-board-message" className={styles.message}>
                {tutorial
                  ? `${guideName} hands you the workshop coin. Make your call.`
                  : "Make your call. If it matches, you choose who takes the first turn."}
              </p>
              <div className={styles.callCoin} aria-hidden="true">?</div>
              <div className={styles.actions}>
                <button type="button" data-opening-coin-primary onClick={() => onCall?.("heads")} className={styles.primaryAction}>Heads</button>
                <button type="button" onClick={() => onCall?.("tails")} className={styles.secondaryAction}>Tails</button>
              </div>
            </>
          ) : null}

          {isWaiting ? (
            <>
              <span className={styles.eyebrow}>You called {callLabel}</span>
              <h2 id="opening-coin-board-title" className="sr-only">Opening coin spinning</h2>
              <p id="opening-coin-board-message" className="sr-only">Tap anywhere on the board to stop the coin.</p>
              <div className={styles.visual}>
                <OpeningCoinVisual mode={reducedMotion ? "ready" : "spinning"} side={visualSide} />
              </div>
              <strong className={styles.tapPrompt} aria-hidden="true">Tap to stop the coin</strong>
              <span className={styles.changeCallHint} aria-hidden="true">Your call: {callLabel}</span>
              <button
                type="button"
                className={styles.changeCallAction}
                onClick={(clickEvent) => {
                  clickEvent.stopPropagation();
                  onChangeCall?.();
                }}
              >
                Change call
              </button>
            </>
          ) : null}

          {isLanding ? (
            <>
              <span className={styles.eyebrow}>Opening flip</span>
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
              <span className={styles.eyebrow}>Opening flip</span>
              <h2 id="opening-coin-board-title" className={styles.title}>{event.title}</h2>
              <p id="opening-coin-board-message" className={styles.message}>{event.message}</p>
              <div className={styles.resultVisual}>
                <OpeningCoinVisual mode="landed" side={event.coinLanded} label={`Coin landed ${landedLabel}`} />
              </div>
              <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{event.title} {event.message}</p>
              {playerWon ? (
                <div className={styles.actions}>
                  <button type="button" data-opening-coin-primary onClick={() => onChooseOpeningPlayer?.(OpeningPlayer.PLAYER)} className={styles.primaryAction}>
                    {tutorial ? "Begin Setup" : "Go First"}
                  </button>
                  {!tutorial ? (
                    <button type="button" onClick={() => onChooseOpeningPlayer?.(OpeningPlayer.OPPONENT)} className={styles.secondaryAction}>Let Opponent Go First</button>
                  ) : null}
                </div>
              ) : (
                <button type="button" data-opening-coin-primary onClick={() => onChooseOpeningPlayer?.(OpeningPlayer.OPPONENT)} className={styles.opponentAction}>Begin Setup</button>
              )}
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
