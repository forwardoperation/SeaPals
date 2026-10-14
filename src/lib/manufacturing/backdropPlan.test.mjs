import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildPrintingCatalog, contentHash } from "./boosters.mjs";
import {
  BACK_TEMPLATE,
  PRINT_LAYOUT,
  createManufacturingManifest,
  preflightPrintAssets,
  verifyManifest,
} from "./printPlan.mjs";
import { manufacturingService, requireOrderArtwork, validateRelease } from "./integration.mjs";

const read = async (name) => JSON.parse(await readFile(new URL(`../../data/${name}`, import.meta.url), "utf8")),
  catalog = buildPrintingCatalog(await read("gallery-set-list.json"), await read("gallery-images.json")),
  request = {
    orderId: "10000000-0000-4000-8000-000000000001",
    orderNumber: "OCEAN-TEMPLATE-TEST",
    items: [{ productId: "deep-dive-pack", quantity: 1 }],
  };
const templates = () => structuredClone({ version: "figma-cutter-nine-up-v3", fronts: PRINT_LAYOUT, backs: BACK_TEMPLATE });
function releaseFixture() {
  const asset = (digit, width, height, extra = {}) => ({
    sha256: digit.repeat(64), path: `manufacturing/sha256/${digit.repeat(64)}.png`, width, height, ...extra,
  });
  return {
    releaseId: "ocean-template-test", figmaVersion: "pinned-figma-version", catalog,
    printTemplates: templates(),
    assets: {
      ...Object.fromEntries(catalog.map((card) => [card.printingId, asset("a", 750, 1050)])),
      "standard-back-sheet": asset("b", 2550, 3300),
      "print-template-front-background": asset("c", 2467, 3240, { nodeId: "4116:234587" }),
      "print-template-back-background": asset("d", 2467, 3240, { nodeId: "4116:234589" }),
    },
  };
}
const manifest = (options = {}) => createManufacturingManifest({
  request, catalog, artworkRelease: "ocean-template-test", randomIndex: () => 0,
  now: "2026-10-14T00:00:00.000Z", ...options,
});
function rehash(saved) {
  const { manifestHash, ...body } = saved;
  return { ...body, manifestHash: contentHash(body) };
}

test("v3 pins both ocean layers without changing booster draws, card geometry or v2 defaults", () => {
  const pinned = templates(), saved = manifest({ printTemplates: pinned }), legacy = manifest();
  assert.equal(saved.layout.version, "figma-cutter-nine-up-v3");
  assert.equal(legacy.layout.version, "figma-cutter-nine-up-v2");
  assert.deepEqual(saved.packs, legacy.packs);
  assert.deepEqual(saved.sheets[0].slots, legacy.sheets[0].slots);
  assert.deepEqual(saved.sheets[0].backs.template.positions, legacy.sheets[0].backs.template.positions);
  assert.deepEqual(saved.layout.background, { assetId: "print-template-front-background", nodeId: "4116:234587", x: 36, y: 20, width: 2467, height: 3240 });
  assert.deepEqual(saved.sheets[0].backs.template.background, { assetId: "print-template-back-background", nodeId: "4116:234589", x: 36, y: 20, width: 2467, height: 3240 });
  assert.equal(legacy.layout.background, undefined);
  assert.equal(legacy.sheets[0].backs.template.background, undefined);
  assert.notEqual(saved.manifestHash, legacy.manifestHash);
  pinned.fronts.background.x = 999;
  pinned.backs.positions[0].x = 999;
  assert.doesNotThrow(() => verifyManifest(saved), "Mutating the source template cannot change the saved job");
  assert.equal(saved.layout.background.x, 36);
  const fixed = manifest({ printTemplates: templates(), request: { ...request, items: [{ productId: "conditions-deck", quantity: 1 }] } });
  assert.equal(fixed.sheets.length, 2);
  assert.ok(fixed.sheets.every((sheet) => sheet.backs.template.background.assetId === "print-template-back-background"));
});

test("invalid background references stop manifest preparation before randomness is consumed", () => {
  const changes = [
    (value) => { delete value.fronts.background; },
    (value) => { value.backs.background = structuredClone(value.fronts.background); },
    (value) => { value.fronts.background.assetId = "standard-back-sheet"; },
    (value) => { value.fronts.background.nodeId = "4099:61637"; },
    (value) => { value.fronts.background.x = 0; },
    (value) => { value.backs.background.height = 3300; },
    (value) => { value.version = "figma-cutter-nine-up-v2"; },
  ];
  for (const change of changes) {
    const printTemplates = templates();
    change(printTemplates);
    let randomCalls = 0;
    assert.throws(() => manifest({ printTemplates, randomIndex: () => { randomCalls++; return 0; } }), /background|backdrop/i);
    assert.equal(randomCalls, 0);
  }
});

test("release and order validation require both private ocean assets with their own identities", () => {
  assert.doesNotThrow(() => validateRelease(releaseFixture()));
  const id = "print-template-back-background";
  const changes = [
    (value) => { delete value.assets[id]; },
    (value) => { value.assets[id].nodeId = "4116:234587"; },
    (value) => { value.assets[id].width = 2550; },
    (value) => { value.assets[id].height = 3300; },
    (value) => { value.assets[id].sha256 = "invalid"; },
    (value) => { value.assets[id].path = "https://example.test/public-ocean.png"; },
  ];
  for (const change of changes) {
    const release = releaseFixture();
    change(release);
    assert.throws(() => validateRelease(release), /background|backdrop/i);
    assert.throws(() => requireOrderArtwork(request.items, release), /background|backdrop/i);
    const preflight = preflightPrintAssets(manifest({ printTemplates: templates() }), release);
    assert.equal(preflight.ready, false);
    assert.match(preflight.errors.join("; "), /background|backdrop/i);
  }
  const orphan = releaseFixture();
  delete orphan.printTemplates;
  assert.throws(() => validateRelease(orphan), /background.*versioned/i);
});

test("preflight includes both backgrounds only for v3 and rejects silently mixing saved layouts", () => {
  const release = releaseFixture(), saved = manifest({ printTemplates: templates() }), legacy = manifest();
  const result = preflightPrintAssets(saved, release);
  assert.equal(result.ready, true);
  assert.ok(result.requiredAssetIds.includes("print-template-front-background"));
  assert.ok(result.requiredAssetIds.includes("print-template-back-background"));
  const old = preflightPrintAssets(legacy, release);
  assert.equal(old.ready, true);
  assert.ok(old.requiredAssetIds.every((id) => !id.startsWith("print-template-")));
  const wrong = structuredClone(saved);
  wrong.layout.background = structuredClone(saved.sheets[0].backs.template.background);
  assert.equal(preflightPrintAssets(rehash(wrong), release).ready, false);
  const oldRelease = structuredClone(release);
  delete oldRelease.printTemplates;
  assert.equal(preflightPrintAssets(saved, oldRelease).ready, false);
  const mixed = structuredClone(legacy);
  mixed.layout.background = structuredClone(saved.layout.background);
  assert.equal(preflightPrintAssets(rehash(mixed), release).ready, false);
});

// The real service must pass the pinned release's templates into the draw and
// refuse incomplete releases before any immutable manifest is persisted.
async function claimFixture(release) {
  const calls = [], token = "20000000-0000-4000-8000-000000000002",
    initial = { order_id: request.orderId, release_id: release.releaseId, lease_token: token, manifest_text: null };
  const db = {
    from(table) {
      const query = {
        select() { return query; }, eq() { return query; },
        async single() { return { data: table === "store_orders"
          ? { id: request.orderId, order_number: request.orderNumber, store_order_items: request.items.map((item) => ({ product_id: item.productId, quantity: item.quantity })) }
          : { manifest_text: JSON.stringify(release) } }; },
      };
      return query;
    },
    async rpc(name, args) {
      calls.push(name);
      if (name === "manufacturing_claim") return { data: initial };
      if (name === "manufacturing_save_manifest") return { data: { ...initial, manifest_text: args.p_manifest, state: args.p_state } };
      assert.equal(name, "manufacturing_block");
      return { data: true };
    },
  };
  return { result: await manufacturingService(db).claim(token), calls };
}
test("claiming a job pins the release's ocean templates and holds missing backgrounds without saving a draw", async () => {
  const good = await claimFixture(releaseFixture());
  assert.deepEqual(good.calls, ["manufacturing_claim", "manufacturing_save_manifest"]);
  assert.equal(good.result.manifest.layout.version, "figma-cutter-nine-up-v3");
  assert.equal(good.result.manifest.packs[0].cards.length, 9);
  assert.equal(good.result.manifest.sheets[0].backs.template.background.nodeId, "4116:234589");
  for (const id of ["print-template-front-background", "print-template-back-background"]) {
    const release = releaseFixture();
    delete release.assets[id];
    const bad = await claimFixture(release);
    assert.deepEqual(bad.calls, ["manufacturing_claim", "manufacturing_block"]);
    assert.equal(bad.result.blocked, true);
    assert.match(bad.result.issue, /background|backdrop/i);
  }
});
