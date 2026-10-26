import test from "node:test";
import assert from "node:assert/strict";
import { fixedArtworkSources, fixedSheetAssets, fixedSheetLabel, DECK_FRAMES } from "./recipes.mjs";
import { requireOrderArtwork } from "./integration.mjs";
import { createManufacturingManifest, verifyManifest } from "./printPlan.mjs";

const items = [{ productId: "blue-water", quantity: 1 }];
const legacyIds = Array.from({ length: 7 }, (_, i) => `sheet-blue-water-${i + 1}`);

test("Drop Off display labels preserve the seven existing asset identities and source nodes", () => {
  assert.deepEqual(fixedSheetAssets("blue-water"), legacyIds);
  const sources = fixedArtworkSources().filter(source => legacyIds.includes(source.id));
  assert.equal(sources.length, 7);
  assert.deepEqual(sources.map(source => source.nodeId), DECK_FRAMES["blue-water"]);
  assert.deepEqual(sources.map(source => source.displayName), Array.from({ length: 7 }, (_, i) => `sheets-drop-off-${i + 1}`));
  assert.deepEqual(sources.map(source => fixedSheetLabel(source.id)), sources.map(source => source.displayName));
  for (const other of ["sheet-conditions-1", "sheet-coral-garden-2", "reef-001", "sheet-blue-water-8", "sheet-blue-water-10"])
    assert.equal(fixedSheetLabel(other), other);
});

test("missing Drop Off artwork is reported with the recognizable sheet names", () => {
  assert.throws(() => requireOrderArtwork(items, { catalog: [], assets: { "standard-back-sheet": {} } }), error => {
    assert.match(error.message, /sheets-drop-off-1, sheets-drop-off-2/);
    assert.match(error.message, /sheets-drop-off-7/);
    assert.match(error.message, /No print sheets were prepared/);
    assert.doesNotMatch(error.message, /sheet-blue-water|booster draw/);
    return true;
  });
  // A display name alone cannot satisfy a missing immutable asset key.
  const displayOnly = Object.fromEntries(legacyIds.map(id => [fixedSheetLabel(id), {}]));
  assert.throws(() => requireOrderArtwork(items, { catalog: [], assets: { ...displayOnly, "standard-back-sheet": {} } }), /incomplete/);
});

test("complete expansion-deck sheets remain printable regardless of prerelease catalog metadata", () => {
  const catalog = [{ printingId: "reef-prerelease", prerelease: true, publicGallery: false }];
  const release = { releaseId: "drop-off-prerelease", catalog, assets: Object.fromEntries([...legacyIds, "standard-back-sheet"].map(id => [id, {}])) };
  assert.doesNotThrow(() => requireOrderArtwork(items, release));
  const manifest = createManufacturingManifest({
    request: { orderId: "drop-off-prerelease", orderNumber: "DROP-OFF", items },
    catalog, artworkRelease: release.releaseId,
    randomIndex: () => { throw new Error("Fixed deck contents must not be randomized or filtered"); },
  });
  assert.deepEqual(manifest.sheets.map(sheet => sheet.fronts.assetId), legacyIds);
  assert.equal(manifest.packs.length, 0);
  assert.doesNotThrow(() => verifyManifest(manifest));
});
