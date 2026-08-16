export function isCartSummaryAheadOfViewport(entry) {
  const cartTop = Number(entry?.boundingClientRect?.top);
  const viewportTop = Number(entry?.rootBounds?.top ?? 0);

  return (
    entry?.isIntersecting === false &&
    Number.isFinite(cartTop) &&
    Number.isFinite(viewportTop) &&
    cartTop > viewportTop
  );
}

export function shouldShowMobileCartDock({
  checkoutEnabled,
  cartReady,
  cartCount,
  isCartSummaryAhead,
}) {
  return Boolean(
    checkoutEnabled && cartReady && cartCount > 0 && isCartSummaryAhead
  );
}
