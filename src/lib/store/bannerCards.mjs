import { getGalleryImageSrc } from "../cardImages.mjs";

// Reviewed public artwork from the Oceanic, Deep, and Reef sets. Release
// eligibility is rechecked against the supplied gallery data on every render.
export const STORE_BANNER_CARD_IDS = Object.freeze([
  "oceanic-manta-ray",
  "thresher-shark",
  "cast-net",
  "colossal-squid",
  "rov-lights",
  "great-white",
  "queen-angelfish",
  "clownfish",
  "elkhorn-coral-stage-2",
  "coral-cement",
  "goliath-grouper",
  "blue-tang",
]);

// The caller supplies server-loaded JSON. Keep the full image manifest and
// master set list out of the storefront's client bundle.
export function getStoreBannerCards(imageManifest, masterSetList = null) {
  const images = Array.isArray(imageManifest?.cards) ? imageManifest.cards : [];
  const masterCards = Array.isArray(masterSetList?.sets)
    ? masterSetList.sets.flatMap((set) => Array.isArray(set?.cards) ? set.cards : [])
    : [];
  const imageById = new Map(images.map((image) => [image?.cardId, image]));
  const publicCardById = new Map(masterCards.map((card) => [card?.cardId, card]));

  return STORE_BANNER_CARD_IDS.flatMap((id) => {
    const image = imageById.get(id);
    const publicCard = publicCardById.get(id);
    if (!publicCard || image?.prerelease !== false || image.hidden ||
        typeof image.src !== "string" || !image.src.startsWith("/images/cards/") ||
        !Number.isSafeInteger(image.width) || image.width < 1 ||
        !Number.isSafeInteger(image.height) || image.height < 1) {
      return [];
    }
    const name = typeof publicCard.name === "string" ? publicCard.name.trim() : "";
    const src = getGalleryImageSrc(image);
    if (!name || !src) return [];
    return [{ id, name, src, width: image.width, height: image.height }];
  });
}
