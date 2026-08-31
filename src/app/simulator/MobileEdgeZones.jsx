export default function MobileEdgeZones({
  owner = "player",
  deckCount,
  discardCount,
  lostCount,
  discardCard = null,
  disabled = false,
  deckActionLabel = "Open your deck summary",
  deckExpanded = false,
  tutorialTargetClass = "",
  onOpenDecks,
  onOpenDiscard,
  onOpenLost,
}) {
  const safeDeckCount = Math.max(0, Number(deckCount) || 0);
  const safeDiscardCount = Math.max(0, Number(discardCount) || 0);
  const safeLostCount = Math.max(0, Number(lostCount) || 0);
  const ownerLabel = owner === "opponent" ? "Opponent" : "Your";
  const opponentDeckHidden = owner === "opponent";

  const deckArtwork = (
    <>
      <span className="seapals-mobile-edge-zone-art seapals-mobile-deck-back" aria-hidden="true">
        <img src="/images/brand/SeaPalsTCGLogoWhite.svg" alt="" />
      </span>
      <span className="seapals-mobile-edge-zone-count">{safeDeckCount}</span>
    </>
  );

  return (
    <aside
      className={`seapals-mobile-edge-zones is-${owner} xl:hidden${tutorialTargetClass}`}
      aria-label={`${ownerLabel} deck, discard pile, and Lost Zone`}
      data-mobile-edge-zones
      data-zone-owner={owner}
      data-tutorial-target={owner === "player" ? "zones" : undefined}
    >
      {opponentDeckHidden ? (
        <div
          className="seapals-mobile-edge-zone is-deck is-readonly"
          data-mobile-zone="deck"
          role="img"
          aria-label={`Opponent deck. ${safeDeckCount} cards remain; contents are hidden.`}
        >
          {deckArtwork}
        </div>
      ) : (
        <button
          type="button"
          className="seapals-mobile-edge-zone is-deck"
          data-mobile-zone="deck"
          aria-label={`${deckActionLabel}. ${safeDeckCount} cards remain.`}
          aria-controls="seapals-mobile-draw-tray"
          aria-expanded={deckExpanded}
          disabled={disabled}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onOpenDecks}
        >
          {deckArtwork}
        </button>
      )}

      <button
        type="button"
        className={`seapals-mobile-edge-zone is-discard${discardCard?.image ? " has-card" : " is-empty"}`}
        data-mobile-zone="discard"
        aria-label={`Open ${owner === "opponent" ? "the opponent's" : "your"} discard pile. ${safeDiscardCount} cards.`}
        disabled={disabled}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onOpenDiscard}
      >
        <span className="seapals-mobile-edge-zone-art" aria-hidden="true">
          {discardCard?.image ? (
            <img src={discardCard.image} alt="" />
          ) : (
            <span className="seapals-mobile-discard-empty" />
          )}
        </span>
      </button>

      <button
        type="button"
        className="seapals-mobile-edge-zone is-lost"
        data-mobile-zone="lost"
        aria-label={`Open ${owner === "opponent" ? "the opponent's" : "your"} Lost Zone. ${safeLostCount} cards.`}
        disabled={disabled}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onOpenLost}
      >
        <span className="seapals-mobile-edge-zone-art" aria-hidden="true">
          <span className="seapals-mobile-lost-empty" />
        </span>
      </button>
    </aside>
  );
}
