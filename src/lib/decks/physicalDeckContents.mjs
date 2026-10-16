import { getGalleryImageSrc } from "../cardImages.mjs";

export const PHYSICAL_DECK_IDS = Object.freeze([
  "coral-garden",
  "blue-water",
  "darkness-shroud",
  "open-ocean-hunt",
  "murky-water",
  "stinging-fortress",
  "disruption",
]);

const CATEGORY_LABELS = Object.freeze({
  coral: "Coral",
  support: "Support",
  fish: "Fish",
  baitball: "Creature Schools",
  predator: "Predator",
  apex: "Apex",
  "filter-feeder": "Filter Feeder",
  invertebrate: "Invertebrate",
  habitat: "Habitat",
  condition: "Condition",
});
const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);
const STAGED_CARD_ID = /(?:stage[-_]?[123]|[-_]base)(?:$|[-_])/;

function requiredText(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing physical deck ${label}.`);
  }
  return value.trim();
}

// Display metadata never registers a playable card or changes simulator rules.
// The public master supplies canonical metadata; verified printed names can
// override display copy. A physical card outside that master (currently Winter
// Flounder) uses its image-manifest entry for canonical metadata.
export function buildPhysicalDeckContents(physicalManifest, imageManifest, masterSetList) {
  const definitions = physicalManifest?.decks;
  if (!Array.isArray(definitions) || definitions.length !== PHYSICAL_DECK_IDS.length ||
      new Set(definitions.map((deck) => deck?.id)).size !== PHYSICAL_DECK_IDS.length ||
      definitions.some((deck) => !PHYSICAL_DECK_IDS.includes(deck?.id))) {
    throw new Error("Physical contents must contain exactly the seven established deck IDs.");
  }
  requiredText(physicalManifest.fileKey, "Figma file key");

  const imageById = new Map(
    (Array.isArray(imageManifest?.cards) ? imageManifest.cards : [])
      .map((image) => [image?.cardId, image])
  );
  const masterById = new Map(
    (Array.isArray(masterSetList?.sets) ? masterSetList.sets : [])
      .flatMap((set) => Array.isArray(set?.cards) ? set.cards : [])
      .map((card) => [card?.cardId, card])
  );

  return definitions.map((definition) => {
    const sourceName = requiredText(definition.sourceName, `${definition.id} source name`);
    if (!/^\d+:\d+$/.test(definition.pageId ?? "") ||
        !/^\d{4}-\d{2}-\d{2}$/.test(definition.evidenceDate ?? "")) {
      throw new Error(`Missing physical deck source provenance for ${definition.id}.`);
    }
    requiredText(definition.verification, `${definition.id} verification method`);
    requiredText(definition.evidenceFile, `${definition.id} evidence file`);
    if (!Array.isArray(definition.cards) || !definition.cards.length) {
      throw new Error(`Missing physical deck cards for ${definition.id}.`);
    }
    const seenCardIds = new Set();
    const groups = new Map();
    const cards = definition.cards.map((entry) => {
      const cardId = requiredText(entry?.cardId, "card ID");
      if (seenCardIds.has(cardId) || !Number.isSafeInteger(entry.quantity) || entry.quantity < 1) {
        throw new Error(`Invalid physical deck quantity or duplicate card: ${definition.id}/${cardId}.`);
      }
      seenCardIds.add(cardId);
      const image = imageById.get(cardId);
      const src = typeof image?.src === "string" ? getGalleryImageSrc(image) : null;
      if (!src || !image.src.startsWith("/images/cards/") ||
          !Number.isSafeInteger(image.width) || image.width < 1 ||
          !Number.isSafeInteger(image.height) || image.height < 1) {
        throw new Error(`Missing physical deck image metadata for ${cardId}.`);
      }
      const metadata = masterById.get(cardId) ?? image;
      const canonicalName = requiredText(metadata.name, `card name for ${cardId}`);
      const name = Object.hasOwn(entry, "printedName")
        ? requiredText(entry.printedName, `printed name for ${cardId}`)
        : canonicalName;
      const category = metadata.category;
      if (!Object.hasOwn(CATEGORY_LABELS, category)) {
        throw new Error(`Missing physical deck category metadata for ${cardId}.`);
      }
      const stageLabel = metadata.stageLabel == null
        ? null : requiredText(metadata.stageLabel, `stage label for ${cardId}`);
      if (STAGED_CARD_ID.test(cardId) && !stageLabel) {
        throw new Error(`Missing physical deck stage metadata for ${cardId}.`);
      }
      const card = {
        cardId,
        quantity: entry.quantity,
        name,
        stageLabel,
        displayName: stageLabel ? `${name} — ${stageLabel}` : name,
        category,
        categoryLabel: CATEGORY_LABELS[category],
        image: src,
        width: image.width,
        height: image.height,
        prerelease: image.prerelease === true,
      };
      const group = groups.get(category) ?? {
        category, label: CATEGORY_LABELS[category], count: 0, cards: [],
      };
      group.count += card.quantity;
      group.cards.push(card);
      groups.set(category, group);
      return card;
    });
    const totalCards = cards.reduce((total, card) => total + card.quantity, 0);
    if (totalCards !== 60) {
      throw new Error(`Physical deck ${definition.id} must contain exactly 60 cards; found ${totalCards}.`);
    }
    return {
      id: definition.id,
      sourceName,
      pageId: definition.pageId,
      evidenceDate: definition.evidenceDate,
      verification: definition.verification,
      evidenceFile: definition.evidenceFile,
      totalCards,
      uniqueCards: cards.length,
      cards,
      groups: [...groups.values()]
        .map((group) => ({
          ...group,
          cards: [...group.cards].sort((first, second) =>
            first.displayName.localeCompare(second.displayName)
          ),
        }))
        .sort((first, second) => CATEGORY_ORDER.indexOf(first.category) - CATEGORY_ORDER.indexOf(second.category)),
    };
  });
}
