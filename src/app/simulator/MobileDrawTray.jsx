"use client";

import { useEffect, useRef } from "react";

export default function MobileDrawTray({
  open,
  selection,
  foundationCount,
  palsCount,
  allowedDeckType = null,
  tutorialTargetClass = "",
  onAdjust,
  onConfirm,
  onClose,
}) {
  const trayRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const focusFrame = window.requestAnimationFrame(() => {
      const firstChoice = trayRef.current?.querySelector(
        '[data-tutorial-draw-add]:not(:disabled), [data-tutorial-target="confirm-draw"]:not(:disabled), button',
      );
      firstChoice?.focus?.({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(focusFrame);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  if (!open || !selection) return null;

  const selectedTotal = selection.foundation + selection.pals;
  const remainingChoices = Math.max(0, selection.target - selectedTotal);
  const decks = [
    {
      id: "foundation",
      label: "Foundation",
      count: foundationCount,
      selected: selection.foundation,
      detail: "Corals & schools",
    },
    {
      id: "pals",
      label: "Pals",
      count: palsCount,
      selected: selection.pals,
      detail: "Creatures & tools",
    },
  ];

  return (
    <section
      ref={trayRef}
      id="seapals-mobile-draw-tray"
      className={`seapals-mobile-draw-tray${tutorialTargetClass}`}
      data-mobile-draw-tray
      data-tutorial-target="draw-controls"
      aria-label="Choose cards to draw"
      aria-describedby="seapals-mobile-draw-tray-status"
    >
      <header className="seapals-mobile-draw-tray-header">
        <div>
          <strong>Draw {selection.target}</strong>
          <span id="seapals-mobile-draw-tray-status" aria-live="polite" aria-atomic="true">
            {remainingChoices ? `${remainingChoices} choice${remainingChoices === 1 ? "" : "s"} left` : "Ready to draw"}
          </span>
        </div>
        <button type="button" aria-label="Close draw tray" onClick={onClose}>×</button>
      </header>

      {selection?.shortfall > 0 ? (
        <p className="seapals-mobile-draw-shortfall" role="alert">
          Only {selection.target} of {selection.requested} required cards remain. The game ends after this draw.
        </p>
      ) : null}

      <div className="seapals-mobile-draw-options">
        {decks.map((deck) => {
          const deckLocked = Boolean(allowedDeckType && allowedDeckType !== deck.id);
          const totalReady = selectedTotal >= selection.target;
          return (
            <div key={deck.id} className={`seapals-mobile-draw-option is-${deck.id}`} data-tutorial-draw-deck={deck.id}>
              <div className="seapals-mobile-draw-option-copy">
                <strong>{deck.label}</strong>
                <span>{deck.count} left · {deck.detail}</span>
              </div>
              <div className="seapals-mobile-draw-stepper" aria-label={`${deck.label} cards selected: ${deck.selected}`}>
                <button
                  type="button"
                  aria-label={`Remove one ${deck.label} card. ${deck.selected} currently selected.`}
                  disabled={!deck.selected}
                  data-tutorial-draw-remove={deck.id}
                  onClick={() => onAdjust(deck.id, -1)}
                >
                  −
                </button>
                <strong aria-hidden="true">{deck.selected}</strong>
                <button
                  type="button"
                  aria-label={`Add one ${deck.label} card. ${deck.selected} currently selected.`}
                  disabled={deckLocked || totalReady || deck.selected >= deck.count}
                  data-tutorial-draw-add={deck.id}
                  onClick={() => onAdjust(deck.id, 1)}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        className="seapals-mobile-draw-confirm"
        disabled={selection.foundation + selection.pals !== selection.target}
        data-tutorial-target="confirm-draw"
        onClick={onConfirm}
      >
        Draw selected {selection.target === 1 ? "card" : "cards"}
      </button>
    </section>
  );
}
