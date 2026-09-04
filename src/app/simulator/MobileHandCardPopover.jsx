"use client";

import { useRef } from "react";

export default function MobileHandCardPopover({
  card,
  classLabel,
  cost,
  playError = "",
  guidance = null,
  tutorialCloseClass = "",
  tutorialPlayClass = "",
  onClose,
  onPlay,
}) {
  const dialogRef = useRef(null);
  if (!card) return null;

  const titleId = `seapals-hand-card-popover-${card.id ?? "card"}`;
  const errorId = playError ? `${titleId}-error` : undefined;

  function keepFocusInDialog(event) {
    if (event.key !== "Tab") return;
    const focusable = [...(dialogRef.current?.querySelectorAll("button:not(:disabled), [href], [tabindex]:not([tabindex='-1'])") ?? [])];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="seapals-hand-card-popover-layer" data-hand-card-popover>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close hand card popout"
        onClick={onClose}
        className="seapals-hand-card-popover-backdrop"
      />
      <section
        ref={dialogRef}
        className="seapals-hand-card-popover"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={errorId}
        onKeyDown={keepFocusInDialog}
      >
        <h2 id={titleId} className="sr-only">{card.name}</h2>
        <div className="seapals-hand-card-popover-art">
          <img src={card.image} alt={card.name} />
        </div>

        {guidance ? <div className="seapals-hand-card-popover-guidance">{guidance}</div> : null}

        <div className="seapals-hand-card-popover-meta">
          <strong>{card.name}</strong>
          <span>{classLabel}</span>
          <span>{cost} RP</span>
          {Number(card.victoryPoints ?? 0) > 0 ? <span>{card.victoryPoints} VP</span> : null}
        </div>

        {playError ? <div id={errorId} className="seapals-hand-card-popover-error" role="alert">{playError}</div> : null}

        <button
          type="button"
          disabled={Boolean(playError)}
          onClick={onPlay}
          className={`seapals-hand-card-popover-play${tutorialPlayClass}`}
          data-tutorial-target="play-card"
        >
          Play Card
        </button>
        <button
          type="button"
          autoFocus
          aria-label="Close hand card popout"
          onClick={onClose}
          className={`seapals-hand-card-popover-close${tutorialCloseClass}`}
          data-tutorial-target="close-modal"
        >
          <span aria-hidden="true">×</span>
        </button>
      </section>
    </div>
  );
}
