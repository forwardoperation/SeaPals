// Keep legacy gameplay IDs addressable by existing decks and saved matches.
const GALLERY_IMAGE_ALIASES = {
  boxfish: "longhorn-cowfish",
  "twinspot-butterflyfish": "spotfin-butterflyfish",
};

export function getGalleryImageSrc(image) {
  if (!image?.src || image.hidden) return null;
  return image.contentHash ? `${image.src}?v=${image.contentHash}` : image.src;
}

export function applyGalleryImages(cards, imageManifest) {
  const imageByCardId = new Map(imageManifest.cards.map((image) => [image.cardId, image]));

  return cards.map((card) => {
    const imageId = GALLERY_IMAGE_ALIASES[card.id] ?? card.id;
    const image = getGalleryImageSrc(imageByCardId.get(imageId));
    return image ? { ...card, image } : card;
  });
}
