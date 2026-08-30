export default function MobileEdgeZones({
  deckCount,
  discardCount,
  lostCount,
  discardCard = null,
  disabled = false,
  tutorialTargetClass = "",
  onOpenDecks,
  onOpenDiscard,
  onOpenLost,
}) {
  const safeDeckCount = Math.max(0, Number(deckCount) || 0);
  const safeDiscardCount = Math.max(0, Number(discardCount) || 0);
  const safeLostCount = Math.max(0, Number(lostCount) || 0);

  return (
    <aside
      className={`seapals-mobile-edge-zones xl:hidden${tutorialTargetClass}`}
      aria-label="Your deck, discard pile, and Lost Zone"
      data-mobile-edge-zones
      data-tutorial-target="zones"
    >
      <button
        type="button"
        className="seapals-mobile-edge-zone is-deck"
        aria-label={`Open your personal decks. ${safeDeckCount} cards remain.`}
        disabled={disabled}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onOpenDecks}
      >
        <span className="seapals-mobile-edge-zone-art seapals-mobile-deck-back" aria-hidden="true">
          <img src="/images/brand/SeaPalsTCGLogoWhite.svg" alt="" />
        </span>
        <span className="seapals-mobile-edge-zone-count">{safeDeckCount}</span>
        <span className="seapals-mobile-edge-zone-label">Deck</span>
      </button>

      <button
        type="button"
        className={`seapals-mobile-edge-zone is-discard${discardCard?.image ? " has-card" : " is-empty"}`}
        aria-label={`Open your discard pile. ${safeDiscardCount} cards.`}
        disabled={disabled}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onOpenDiscard}
      >
        <span className="seapals-mobile-edge-zone-art" aria-hidden="true">
          {discardCard?.image ? (
            <img src={discardCard.image} alt="" />
          ) : (
            <span className="seapals-mobile-discard-empty">↺</span>
          )}
        </span>
        <span className="seapals-mobile-edge-zone-count">{safeDiscardCount}</span>
        <span className="seapals-mobile-edge-zone-label">Discard</span>
      </button>

      <button
        type="button"
        className="seapals-mobile-edge-zone-lost"
        aria-label={`Open your Lost Zone. ${safeLostCount} cards.`}
        disabled={disabled}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onOpenLost}
      >
        <span aria-hidden="true">◇</span> {safeLostCount}
      </button>
    </aside>
  );
}
