"use client";

export default function MobileHandDock({
  entries,
  selectedIndex,
  playingCardId,
  tutorialTargetClass = "",
  onInspect,
}) {
  const placementPending = Boolean(playingCardId);

  return (
    <section
      className={`seapals-mobile-hand-dock xl:hidden${tutorialTargetClass}`}
      aria-label="Your hand"
      data-mobile-hand-dock
      data-tutorial-target="hand"
    >
      <div className="seapals-mobile-hand-panel">
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
                      aria-haspopup="dialog"
                      aria-expanded={selected}
                      aria-pressed={selected}
                      aria-label={`${entry.card?.name ?? entry.cardId}. ${entry.setupPlayable ? "Legal setup card. " : ""}${entry.playError || `${entry.cost} RP, ready to play`}`}
                      data-card-id={entry.cardId}
                      data-setup-playable={entry.setupPlayable ? "true" : undefined}
                      data-tutorial-hand-card-id={entry.cardId}
                      onClick={(event) => onInspect(entry.cardId, entry.index, event.currentTarget)}
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
