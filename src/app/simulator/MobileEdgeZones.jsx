export default function MobileEdgeZones({
  owner = "player",
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
  const ownerLabel = owner === "opponent" ? "Opponent" : "Your";

  return (
    <aside
      className={`seapals-mobile-edge-zones is-${owner} xl:hidden${tutorialTargetClass}`}
      aria-label={`${ownerLabel} deck, discard pile, and Lost Zone`}
      data-mobile-edge-zones
      data-zone-owner={owner}
      data-tutorial-target={owner === "player" ? "zones" : undefined}
    >
      <button
        type="button"
        className="seapals-mobile-edge-zone is-deck"
        aria-label={`Open ${owner === "opponent" ? "the opponent's" : "your"} deck summary. ${safeDeckCount} cards remain.`}
        disabled={disabled}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onOpenDecks}
      >
        <span className="seapals-mobile-edge-zone-art seapals-mobile-deck-back" aria-hidden="true">
          <img src="/images/brand/SeaPalsTCGLogoWhite.svg" alt="" />
        </span>
        <span className="seapals-mobile-edge-zone-count">{safeDeckCount}</span>
      </button>

      <button
        type="button"
        className={`seapals-mobile-edge-zone is-discard${discardCard?.image ? " has-card" : " is-empty"}`}
        aria-label={`Open ${owner === "opponent" ? "the opponent's" : "your"} discard pile. ${safeDiscardCount} cards.`}
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
      </button>

      <button
        type="button"
        className="seapals-mobile-edge-zone is-lost"
        aria-label={`Open ${owner === "opponent" ? "the opponent's" : "your"} Lost Zone. ${safeLostCount} cards.`}
        disabled={disabled}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onOpenLost}
      >
        <span className="seapals-mobile-edge-zone-art" aria-hidden="true">
          <span className="seapals-mobile-lost-empty">◇</span>
        </span>
      </button>
    </aside>
  );
}
