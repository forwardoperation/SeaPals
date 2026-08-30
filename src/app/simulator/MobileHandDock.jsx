"use client";

export default function MobileHandDock({
  entries,
  selectedIndex,
  playingCardId,
  rp,
  tutorialTargetClass = "",
  onSelect,
  onInspect,
  onPlay,
}) {
  const selectedEntry = entries.find((entry) => entry.index === selectedIndex) ?? null;
  const placementPending = Boolean(playingCardId);

  return (
    <section
      className={`seapals-mobile-hand-dock xl:hidden${tutorialTargetClass}`}
      aria-label="Your hand"
      data-mobile-hand-dock
      data-tutorial-target="hand"
    >
      <div className="seapals-mobile-hand-panel">
        <div className="seapals-mobile-hand-summary">
          <div className="min-w-0 flex-1">
            <span className="seapals-mobile-hand-kicker">
              {placementPending ? "Placement in progress" : "Your hand"}
            </span>
            <strong className="seapals-mobile-hand-title" role="status" aria-live="polite">
              {placementPending
                ? "Choose the highlighted reef space"
                : selectedEntry?.card?.name ?? "Swipe cards - tap one to lift"}
            </strong>
            {selectedEntry && !placementPending ? (
              <span className={`seapals-mobile-hand-status${selectedEntry.playError ? " is-unavailable" : ""}`}>
                {selectedEntry.playError || `${selectedEntry.cost} RP - Ready to play`}
              </span>
            ) : null}
          </div>

          <div className="seapals-mobile-hand-actions">
            <span
              className="seapals-mobile-hand-rp"
              aria-label={`${rp} Resource Points available`}
              data-tutorial-target="rp-bank"
            >
              {rp}<small>RP</small>
            </span>
            {selectedEntry && !placementPending ? (
              <>
                <button
                  type="button"
                  onClick={() => onInspect(selectedEntry.cardId)}
                  className="seapals-mobile-hand-secondary"
                >
                  Details
                </button>
                <button
                  type="button"
                  disabled={Boolean(selectedEntry.playError)}
                  onClick={() => onPlay(selectedEntry.cardId)}
                  className="seapals-mobile-hand-primary"
                  data-tutorial-target="play-card"
                >
                  Play
                </button>
              </>
            ) : null}
          </div>
        </div>

        <div
          className="seapals-mobile-hand-rail"
          data-simulator-hand-card-rail
          aria-label={`${entries.length} cards in your hand`}
        >
          {entries.length ? (
            <ul className="seapals-mobile-hand-list" role="list">
              {entries.map((entry) => {
                const selected = entry.index === selectedIndex;
                return (
                  <li key={`${entry.cardId}-${entry.index}`}>
                    <button
                      type="button"
                      disabled={placementPending}
                      aria-pressed={selected}
                      aria-label={`${entry.card?.name ?? entry.cardId}. ${entry.setupPlayable ? "Legal setup card. " : ""}${entry.playError || `${entry.cost} RP, ready to play`}`}
                      data-card-id={entry.cardId}
                      data-setup-playable={entry.setupPlayable ? "true" : undefined}
                      data-tutorial-hand-card-id={entry.cardId}
                      onClick={() => onSelect(selected ? null : entry.index)}
                      className={`seapals-mobile-hand-card${selected ? " is-selected" : ""}${entry.playError ? " is-unavailable" : " is-ready"}${entry.setupPlayable ? " seapals-setup-playable-card" : ""}${entry.tutorialClass ?? ""}`}
                    >
                      <img src={entry.card?.image} alt="" />
                      {entry.setupPlayable ? <span className="seapals-mobile-hand-card-setup-badge">Setup</span> : null}
                      <span className="seapals-mobile-hand-card-name">{entry.card?.name ?? entry.cardId}</span>
                      <span className="seapals-mobile-hand-card-cost">{entry.cost} RP</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="seapals-mobile-hand-empty">Your hand is empty.</div>
          )}
        </div>
      </div>
    </section>
  );
}
