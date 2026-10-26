import { contentHash } from "./boosters.mjs";
import { resolvePrintTemplates } from "./printPlan.mjs";
import { validateRelease } from "./integration.mjs";
import { CUTTER_LAYOUT_V5 } from "./backdrops.mjs";

export function parseHoloSelections(value) {
  if (typeof value !== "string" || !value.length)
    throw new Error("Specify holo printings as printingId:quantity, separated by commas.");
  return value.split(",").map((entry) => {
    const match = /^(reef|deep|ocean)-([0-9]{3}):([1-9][0-9]{0,2})$/.exec(entry.trim());
    if (!match) throw new Error("Use entries such as reef-101:9 with a positive whole-number quantity.");
    return { printingId: `${match[1]}-${match[2]}`, quantity: Number(match[3]) };
  });
}

export function createHoloBatch({ release, selections }) {
  validateRelease(release);
  if (release.printTemplates?.version !== CUTTER_LAYOUT_V5)
    throw new Error("Holo replenishment requires a release with the dedicated V5 holo templates.");
  if (!Array.isArray(selections) || !selections.length || selections.length > 100)
    throw new Error("Select between 1 and 100 different finished-artwork holo printings.");
  const seen = new Set(), catalog = new Map(release.catalog.map((card) => [card.printingId, card]));
  let quantity = 0;
  const items = selections.map((selection) => {
    const card = catalog.get(selection?.printingId);
    if (!card || card.rarity !== "Holo Rare" || card.requiresHoloSticker !== true || !release.assets[card.printingId])
      throw new Error(`A finished-artwork holo printing is required: ${selection?.printingId ?? "missing"}.`);
    if (seen.has(card.printingId) || !Number.isSafeInteger(selection.quantity) || selection.quantity < 1 || selection.quantity > 900)
      throw new Error("Use one positive whole-number quantity per holo printing, with at most 900 cards per batch.");
    seen.add(card.printingId);
    quantity += selection.quantity;
    return { printingId: card.printingId, quantity: selection.quantity, name: card.name,
      set: card.set, collectorNumber: card.collectorNumber, setTotal: card.setTotal };
  });
  if (quantity > 900) throw new Error("A holo replenishment batch may contain at most 900 cards.");
  const { holoLayout: layout, holoBackTemplate: backTemplate } = resolvePrintTemplates(release.printTemplates),
    cards = items.flatMap((item) => Array.from({ length: item.quantity }, () => item.printingId)),
    assets = Object.fromEntries([...new Set([
      layout.background.assetId, backTemplate.background.assetId, ...cards,
    ])].map((id) => [id, release.assets[id].sha256])),
    sheets = [];
  for (let offset = 0; offset < cards.length; offset += 9)
    sheets.push({
      sheetId: `holo-${String(sheets.length + 1).padStart(3, "0")}`,
      slots: cards.slice(offset, offset + 9).map((printingId, index) => ({
        ...layout.positions[index], printingId, slot: index + 1,
      })),
    });
  const body = {
    schemaVersion: 1, kind: "holo-replenishment", artworkRelease: release.releaseId,
    figmaVersion: release.figmaVersion, quantity, items, layout, backTemplate, assets, sheets,
  };
  return { ...body, batchHash: contentHash(body) };
}

export function verifyHoloBatch(batch, release) {
  if (!batch || batch.kind !== "holo-replenishment" || !Array.isArray(batch.items) ||
      batch.artworkRelease !== release?.releaseId)
    throw new Error("The saved holo batch needs its original private artwork release.");
  const { batchHash, ...body } = batch;
  if (batchHash !== contentHash(body)) throw new Error("The saved holo batch checksum changed.");
  const expected = createHoloBatch({ release, selections: batch.items });
  if (contentHash(batch) !== contentHash(expected))
    throw new Error("The saved holo batch does not match its pinned artwork, card choices, or templates.");
  return batch;
}
