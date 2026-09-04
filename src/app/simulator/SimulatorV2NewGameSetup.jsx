"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./SimulatorV2NewGameSetup.module.css";

function getDifficultyIndex(options, difficultyId) {
  const index = options.findIndex((option) => option.id === difficultyId);
  return index >= 0 ? index : Math.min(1, Math.max(0, options.length - 1));
}

export default function SimulatorV2NewGameSetup({
  decks,
  initialPlayerDeckId,
  initialOpponentDeckId,
  initialDifficulty,
  difficultyOptions,
  reducedMotion = false,
  onStart,
  onCancel = null,
}) {
  const screenRef = useRef(null);
  const restoreFocusRef = useRef(false);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const [playerDeckId, setPlayerDeckId] = useState(initialPlayerDeckId);
  const [opponentDeckId, setOpponentDeckId] = useState(initialOpponentDeckId);
  const [difficultyIndex, setDifficultyIndex] = useState(() => (
    getDifficultyIndex(difficultyOptions, initialDifficulty)
  ));
  const selectedDifficulty = useMemo(
    () => difficultyOptions[difficultyIndex] ?? difficultyOptions[0],
    [difficultyIndex, difficultyOptions],
  );
  const difficultyProgress = difficultyOptions.length > 1
    ? (difficultyIndex / (difficultyOptions.length - 1)) * 100
    : 0;

  useEffect(() => {
    const screen = screenRef.current;
    const previousFocus = document.activeElement;
    const focusSelector = "button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])";
    const focusFrame = window.requestAnimationFrame(() => {
      screen?.querySelector("[data-v2-player-deck]")?.focus({ preventScroll: true });
    });
    const keepFocusInDialog = (event) => {
      if (event.key === "Escape" && onCancelRef.current) {
        event.preventDefault();
        restoreFocusRef.current = true;
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab" || !screen) return;
      const focusable = [...screen.querySelectorAll(focusSelector)];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !screen.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !screen.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keepFocusInDialog);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", keepFocusInDialog);
      if (restoreFocusRef.current && previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  function startMatch(event) {
    event.preventDefault();
    if (!selectedDifficulty) return;
    onStart(playerDeckId, opponentDeckId, selectedDifficulty.id);
  }

  function cancelSetup() {
    restoreFocusRef.current = true;
    onCancelRef.current?.();
  }

  return (
    <div
      ref={screenRef}
      className={`${styles.screen}${reducedMotion ? ` ${styles.reducedMotion}` : ""}`}
      data-v2-new-game-setup
      role="dialog"
      aria-modal="true"
      aria-labelledby="seapals-v2-setup-title"
      aria-describedby="seapals-v2-setup-description"
    >
      <div className={styles.oceanScene} data-v2-ocean-scene aria-hidden="true">
        <span className={styles.sunGlow} />
        <span className={styles.lightRays} />
        <span className={styles.caustics} />
        <span className={`${styles.bubble} ${styles.bubbleOne}`} />
        <span className={`${styles.bubble} ${styles.bubbleTwo}`} />
        <span className={`${styles.bubble} ${styles.bubbleThree}`} />
        <span className={`${styles.bubble} ${styles.bubbleFour}`} />
        <span className={`${styles.fish} ${styles.fishOne}`} />
        <span className={`${styles.fish} ${styles.fishTwo}`} />
        <span className={`${styles.fish} ${styles.fishThree}`} />
        <span className={styles.deepShade} />
      </div>

      <div className={styles.layout}>
        <section className={styles.panel}>
          {onCancel ? (
            <button type="button" onClick={cancelSetup} className={styles.cancelButton}>
              <span aria-hidden="true">&#8592;</span> Back to game
            </button>
          ) : null}

          <header className={styles.header}>
            <img
              src="/images/brand/SeaPalsTCGLogo.svg"
              alt="SeaPals Trading Card Game"
              className={styles.logo}
            />
            <p className={styles.eyebrow}>SeaPals Simulator</p>
            <h2 id="seapals-v2-setup-title" className={styles.title}>Choose your Decks</h2>
            <p id="seapals-v2-setup-description" className={styles.subtitle}>
              Pick both decks, set the challenge, and dive in.
            </p>
          </header>

          <form className={styles.form} onSubmit={startMatch}>
            <div className={styles.deckGrid}>
              <label className={`${styles.deckField} ${styles.playerField}`}>
                <span className={styles.fieldLabel}>Your deck</span>
                <span className={styles.selectWrap}>
                  <select
                    value={playerDeckId}
                    onChange={(event) => setPlayerDeckId(event.currentTarget.value)}
                    className={styles.select}
                    data-v2-player-deck
                  >
                    {decks.map((deck) => (
                      <option key={deck.id} value={deck.id}>{deck.name}</option>
                    ))}
                  </select>
                  <span className={styles.selectChevron} aria-hidden="true" />
                </span>
              </label>

              <label className={`${styles.deckField} ${styles.opponentField}`}>
                <span className={styles.fieldLabel}>Opponent deck</span>
                <span className={styles.selectWrap}>
                  <select
                    value={opponentDeckId}
                    onChange={(event) => setOpponentDeckId(event.currentTarget.value)}
                    className={styles.select}
                    data-v2-opponent-deck
                  >
                    {decks.map((deck) => (
                      <option key={deck.id} value={deck.id}>{deck.name}</option>
                    ))}
                  </select>
                  <span className={styles.selectChevron} aria-hidden="true" />
                </span>
              </label>
            </div>

            <fieldset className={styles.difficultyField}>
              <legend id="seapals-v2-difficulty-label" className={styles.fieldLabel}>
                Opponent difficulty
              </legend>
              <div className={styles.difficultySummary}>
                <output
                  htmlFor="seapals-v2-difficulty"
                  className={styles.difficultyValue}
                  aria-live="polite"
                >
                  {selectedDifficulty?.label}
                </output>
              </div>
              <div className={styles.sliderRow}>
                <input
                  id="seapals-v2-difficulty"
                  type="range"
                  min="0"
                  max={Math.max(0, difficultyOptions.length - 1)}
                  step="1"
                  value={difficultyIndex}
                  onChange={(event) => setDifficultyIndex(Number(event.currentTarget.value))}
                  aria-labelledby="seapals-v2-difficulty-label"
                  aria-valuetext={selectedDifficulty?.label}
                  className={styles.slider}
                  style={{ "--difficulty-progress": `${difficultyProgress}%` }}
                  data-v2-difficulty-slider
                />
              </div>
              <div className={styles.difficultyMarks} aria-hidden="true">
                {difficultyOptions.map((option, index) => (
                  <span
                    key={option.id}
                    className={index === difficultyIndex ? styles.activeMark : undefined}
                  >
                    {option.label}
                  </span>
                ))}
              </div>
            </fieldset>

            <button type="submit" className={styles.startButton} data-v2-start-game>
              <span>Start Match</span>
              <span className={styles.startIcon} aria-hidden="true">&#8594;</span>
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
