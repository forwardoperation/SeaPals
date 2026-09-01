"use client";

import { useEffect, useRef } from "react";
import { CardCoinPhase, CardCoinSide } from "./cardCoinFlip.mjs";
import { OpeningCoinVisual } from "./OpeningCoinBoardPresentation";
import styles from "./OpeningCoinBoardPresentation.module.css";

function formatCardCoinSide(side) {
  return side === CardCoinSide.BLANK
    ? "blank side, tails"
    : "Reef Fish side, heads";
}

export default function CardCoinBoardPresentation({
  active,
  event,
  reducedMotion = false,
  restoreFocus = true,
  onStop,
  onLanded,
  onContinue,
}) {
  const layerRef = useRef(null);
  const previousFocusRef = useRef(null);
  const restoreFocusFrameRef = useRef(0);
  const phase = event?.phase;

  useEffect(() => {
    window.cancelAnimationFrame(restoreFocusFrameRef.current);
    if (!active || !restoreFocus) return undefined;
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
  }, [active, restoreFocus]);

  useEffect(() => {
    if (!active) return undefined;
    const focusFrame = window.requestAnimationFrame(() => {
      const primaryControl = layerRef.current?.querySelector("[data-card-coin-primary]");
      const focusTarget = primaryControl ?? layerRef.current;
      focusTarget?.focus?.({ preventScroll: true });
      if (primaryControl && phase === CardCoinPhase.RESULT) {
        primaryControl.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      }
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [active, phase]);

  if (!active || !event) return null;

  const isWaiting = phase === CardCoinPhase.READY;
  const isLanding = phase === CardCoinPhase.FLIPPING;
  const isResult = phase === CardCoinPhase.RESULT;
  const eyebrow = event.eyebrow || event.sourceCardName || "Coin flip";
  const visualSide = isLanding || isResult ? event.side : CardCoinSide.FISH;
  const landedLabel = formatCardCoinSide(event.side);
  const readyTitle = event.title || `Flip for ${event.sourceCardName || "this card"}`;
  const readyMessage = event.message || "Tap anywhere to flip. Reef Fish counts as heads; blank counts as tails.";

  function trapFocus(keyEvent) {
    if (keyEvent.key !== "Tab") return;
    const controls = [...(layerRef.current?.querySelectorAll(
      'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ) ?? [])];
    if (!controls.length) {
      keyEvent.preventDefault();
      layerRef.current?.focus?.({ preventScroll: true });
      return;
    }
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (controls.length === 1) {
      keyEvent.preventDefault();
      first.focus({ preventScroll: true });
      return;
    }
    if (keyEvent.shiftKey && document.activeElement === first) {
      keyEvent.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!keyEvent.shiftKey && document.activeElement === last) {
      keyEvent.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  return (
    <div
      ref={layerRef}
      className={`${styles.layer}${reducedMotion ? ` ${styles.reducedMotion}` : ""}`}
      data-board-coin
      data-board-coin-layer
      data-board-coin-phase={phase}
      data-card-coin
      data-card-coin-layer
      data-card-coin-phase={phase}
      data-card-coin-id={event.id}
      data-card-coin-owner={event.owner || "player"}
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-coin-board-title"
      aria-describedby="card-coin-board-message"
      tabIndex={-1}
      onKeyDown={trapFocus}
    >
      {!isWaiting ? <div className={styles.screenBlocker} aria-hidden="true" /> : null}
      {isWaiting ? (
        <button
          type="button"
          className={styles.tapCatcher}
          data-board-coin-primary
          data-card-coin-primary
          data-flip-card-coin
          aria-label={`${readyTitle}. ${readyMessage}`}
          onClick={onStop}
        >
          <span className="sr-only">Tap anywhere on the board, or press Enter or Space, to flip the coin.</span>
        </button>
      ) : null}

      <div
        className={`${styles.playerZone} ${styles.cardCoinZone}${isResult ? ` ${styles.cardCoinResultZone}` : ""}`}
        data-board-coin-player-zone
        data-card-coin-player-zone
      >
        <section
          className={`${styles.panel}${isWaiting ? ` ${styles.passThroughPanel}` : ""}${isWaiting || isLanding ? ` ${styles.motionPanel}` : ""}${isResult ? ` ${styles.resultPanel}` : ""}`}
        >
          {isWaiting ? (
            <>
              <span className={styles.eyebrow}>{eyebrow}</span>
              <h2 id="card-coin-board-title" className="sr-only">{readyTitle}</h2>
              <p id="card-coin-board-message" className="sr-only">{readyMessage}</p>
              <div className={styles.visual} data-card-coin-visual>
                <OpeningCoinVisual mode={reducedMotion ? "ready" : "spinning"} side={visualSide} />
              </div>
              <strong className={styles.tapPrompt} aria-hidden="true">Tap to flip</strong>
            </>
          ) : null}

          {isLanding ? (
            <>
              <span className={styles.eyebrow}>{eyebrow}</span>
              <h2 id="card-coin-board-title" className="sr-only">{eyebrow} coin landing</h2>
              <p id="card-coin-board-message" className="sr-only">The coin is landing. Reef Fish counts as heads; blank counts as tails.</p>
              <div className={styles.visual} data-card-coin-visual>
                <OpeningCoinVisual
                  mode="flipping"
                  side={visualSide}
                  onAnimationEnd={() => onLanded?.(event.id)}
                />
              </div>
              <strong className={styles.landingPrompt} role="status" aria-live="polite" aria-atomic="true">Landing&hellip;</strong>
            </>
          ) : null}

          {isResult ? (
            <>
              <span className={styles.eyebrow}>{eyebrow}</span>
              <h2 id="card-coin-board-title" className={styles.title}>{event.title}</h2>
              <p id="card-coin-board-message" className={`${styles.message} ${styles.cardResultMessage}`}>{event.message}</p>
              <div className={styles.resultVisual} data-card-coin-visual>
                <OpeningCoinVisual
                  mode="landed"
                  side={event.side}
                  label={`Coin landed ${landedLabel}`}
                  celebrate={event.success === true}
                />
              </div>
              <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
                {event.title} {event.message} The coin landed {landedLabel}.
              </p>
              <button
                type="button"
                data-board-coin-primary
                data-card-coin-primary
                data-continue-card-coin
                onClick={onContinue}
                className={event.success === true ? styles.primaryAction : styles.opponentAction}
              >
                {event.continueLabel || "Continue"}
              </button>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
