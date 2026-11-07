import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  applyBoosterArtworkPolicy, applyUnfinishedArtworkPolicy, buildSourceMap, selectProductArtwork,
} from "../../../scripts/manufacturing/sync-figma.mjs";
import { BOOSTER_POLICY, contentHash, generateBooster, validateBoosterPool } from "./boosters.mjs";
import { manufacturingService, releaseBoosterCatalog, requireOrderArtwork, validateRelease } from "./integration.mjs";
import { createManufacturingManifest, preflightPrintAssets, verifyManifest } from "./printPlan.mjs";
import { createManufacturingState } from "./workflow.mjs";
import { createHoloBatch, verifyHoloBatch } from "./holoBatch.mjs";
import { BOOSTER_PRODUCTS, FIXED_PRODUCTS, fixedSheetAssets } from "./recipes.mjs";
import { backgroundsForLayout } from "./backdrops.mjs";

const read = async (relative) => JSON.parse(await readFile(new URL(relative, import.meta.url), "utf8"));
const [sets, gallery, holos, unfinished, policy] = await Promise.all([
  read("../../data/gallery-set-list.json"), read("../../data/gallery-images.json"),
  read("../../../scripts/manufacturing/figma-holo-sources.json"),
  read("../../../scripts/manufacturing/figma-unfinished-printings.json"),
  read("../../../scripts/manufacturing/booster-artwork-exclusions.json"),
]);
const source = applyUnfinishedArtworkPolicy(buildSourceMap(sets, gallery, holos), unfinished);
const heldIds = ["reef-011", "reef-026", "reef-034", "reef-044", "reef-076"];
const withPolicy = applyBoosterArtworkPolicy(source, policy);
const products = [...Object.keys(FIXED_PRODUCTS), ...Object.keys(BOOSTER_PRODUCTS)];
const cardIds = (cards) => cards.map((card) => card.printingId);
const mockAsset = (nodeId, width = 750, height = 1050) => ({
  nodeId, width, height, sha256: "a".repeat(64), path: `manufacturing/sha256/${"a".repeat(64)}.png`,
});
function releaseFixture() {
  return {
    releaseId: "booster-artwork-test", figmaVersion: "fixture", catalog: source.catalog,
    printTemplates: source.templates, excludedBoosterArtwork: withPolicy.excludedBoosterArtwork,
    assets: {
      ...Object.fromEntries(source.catalog.map((card) => [card.printingId, mockAsset("card")])),
      ...Object.fromEntries(Object.values(backgroundsForLayout(source.templates.version)).map((background) =>
        [background.assetId, mockAsset(background.nodeId, 2550, 3300)])),
    },
  };
}

test("approved booster holds preserve the full catalog, mapped artwork, and selected export scope", () => {
  const before = structuredClone(source);
  assert.deepEqual(policy.printingIds, heldIds);
  const selected = selectProductArtwork(source, products);
  const updated = applyBoosterArtworkPolicy(selected, policy);
  assert.equal(updated.catalog.length, 217);
  assert.equal(updated.sources.length, 272);
  assert.equal(updated.sources.filter((item) => item.kind === "card").length, 217);
  assert.equal(updated.sources.filter((item) => item.kind === "sheet").length, 51);
  for (const key of ["catalog", "sources", "templates", "missing", "excludedUnfinished", "exportScope"])
    assert.deepEqual(updated[key], selected[key]);
  assert.deepEqual(updated.excludedBoosterArtwork.map((item) => item.printingId), heldIds);
  assert.ok(heldIds.every((id) => updated.sources.some((item) => item.id === id && item.nodeId)));
  assert.notEqual(contentHash(updated), contentHash(selected), "A policy change must invalidate the sync cache");
  assert.deepEqual(source, before);
  for (const product of ["deep-dive-pack", "oceanic-dive-pack", "reef-dive-pack", "conditions-deck"]) {
    const scoped = selectProductArtwork(source, [product]);
    const refreshed = applyBoosterArtworkPolicy(scoped, policy);
    assert.deepEqual(refreshed.sources, scoped.sources);
    assert.deepEqual(refreshed.catalog, source.catalog);
    assert.deepEqual(refreshed.excludedBoosterArtwork, updated.excludedBoosterArtwork);
  }
});

test("holds persist through artwork remapping and require explicit review-policy removal", () => {
  const remapped = structuredClone(source);
  remapped.sources.find((item) => item.id === "reef-011").nodeId = "9999:9999";
  assert.deepEqual(applyBoosterArtworkPolicy(remapped, policy).excludedBoosterArtwork, withPolicy.excludedBoosterArtwork);
  const released = applyBoosterArtworkPolicy(remapped, { ...policy, printingIds: heldIds.filter((id) => id !== "reef-011") });
  assert.ok(releaseBoosterCatalog(released).some((card) => card.printingId === "reef-011"));
  assert.ok(!releaseBoosterCatalog(released).some((card) => card.printingId === "reef-026"));
});

test("only the five reviewed Reef printing variants leave the Dive Pack pool", () => {
  const release = validateRelease(releaseFixture()), pool = releaseBoosterCatalog(release);
  assert.equal(pool.length, 212);
  assert.deepEqual(cardIds(source.catalog.filter((card) => !pool.includes(card))), heldIds);
  for (const set of ["reef", "deep", "ocean"]) {
    const eligible = validateBoosterPool(pool, set);
    if (set !== "reef") assert.deepEqual(eligible, validateBoosterPool(source.catalog, set));
    else assert.deepEqual(Object.fromEntries(["Common", "Uncommon", "Rare", "Holo Rare"].map((rarity) =>
      [rarity, eligible.filter((card) => card.rarity === rarity).length])),
    { Common: 31, Uncommon: 28, Rare: 17, "Holo Rare": 14 });
    // Exercise both sides of the exact 25% boundary and every index in the largest pool.
    for (const roll of [0, 2499, 2500, 9999]) for (let offset = 0; offset < 100; offset++) {
      let call = 0;
      const pack = generateBooster({ catalog: pool, set, randomIndex: (max) => call++ === 0 ? roll : offset % max });
      assert.deepEqual(pack.policy, BOOSTER_POLICY);
      assert.equal(pack.cards.length, 9);
      assert.equal(new Set(pack.cards.map((card) => card.cardId)).size, 9);
      assert.equal(pack.cards.filter((card) => card.rarity === "Common").length, 5);
      assert.equal(pack.cards.filter((card) => card.rarity === "Uncommon").length, 3);
      assert.equal(pack.cards[8].rarity, roll < 2500 ? "Holo Rare" : "Rare");
      assert.ok(pack.cards.every((card) => card.set === set && !heldIds.includes(card.printingId)));
    }
  }
  assert.equal(BOOSTER_POLICY.allowPrerelease, true);
  assert.equal(BOOSTER_POLICY.holoBasisPoints, 2500);
});

test("new booster artwork preflight ignores held cards but never ignores a missing eligible card or deck sheet", () => {
  const release = releaseFixture();
  for (const id of heldIds) delete release.assets[id];
  const items = [{ productId: "reef-dive-pack", quantity: 1 }];
  assert.doesNotThrow(() => requireOrderArtwork(items, release));
  delete release.assets["reef-027"];
  assert.throws(() => requireOrderArtwork(items, release), /reef-027.*No booster draw was created/);
  for (const productId of Object.keys(FIXED_PRODUCTS)) {
    const deck = { ...releaseFixture(), assets: Object.fromEntries([
      ...Object.entries(releaseFixture().assets),
      ...fixedSheetAssets(productId).map((id) => [id, {}]),
    ]) };
    assert.doesNotThrow(() => requireOrderArtwork([{ productId, quantity: 1 }], deck));
    const first = fixedSheetAssets(productId)[0];
    if (first) {
      delete deck.assets[first];
      assert.throws(() => requireOrderArtwork([{ productId, quantity: 1 }], deck), /No print sheets were prepared/);
    }
  }
});

test("manual Giant Triton holo replenishment and saved batches remain available", () => {
  const release = releaseFixture();
  const batch = createHoloBatch({ release, selections: [{ printingId: "reef-011", quantity: 9 }] });
  assert.equal(batch.items[0].printingId, "reef-011");
  assert.equal(batch.sheets[0].slots.length, 9);
  assert.equal(verifyHoloBatch(batch, release).batchHash, batch.batchHash);
  const legacy = { ...release }; delete legacy.excludedBoosterArtwork;
  assert.equal(releaseBoosterCatalog(legacy), legacy.catalog);
  assert.deepEqual(createHoloBatch({ release: legacy, selections: batch.items }), batch);
});

function claimFixture(release, savedManifest = null) {
  const orderId = savedManifest?.order.orderId ?? randomUUID(), token = randomUUID();
  let row = { order_id: orderId, release_id: release.releaseId, lease_token: token,
    manifest_text: savedManifest ? JSON.stringify(savedManifest) : null,
    state: savedManifest ? createManufacturingState(savedManifest) : undefined };
  const calls = [];
  const db = {
    from(table) {
      const query = { select: () => query, eq: () => query, single: async () => ({ data: table === "store_orders"
        ? { id: orderId, order_number: "EXCLUSION-TEST", store_order_items: [{ product_id: "reef-dive-pack", quantity: 1 }] }
        : { manifest_text: JSON.stringify(release) } }) };
      return query;
    },
    async rpc(name, args) {
      calls.push(name);
      if (name === "manufacturing_save_manifest") row = { ...row, manifest_text: args.p_manifest, state: args.p_state };
      return { data: row };
    },
  };
  return { token, calls, service: manufacturingService(db) };
}

test("Worker claim saves new packs using the excluded pool and reuses saved contents without rerolling", async () => {
  const release = releaseFixture(), fixture = claimFixture(release);
  const job = await fixture.service.claim(fixture.token);
  assert.equal(job.blocked, undefined, job.issue);
  assert.equal(job.manifest.catalogHash, contentHash(releaseBoosterCatalog(release)));
  assert.ok(job.manifest.packs[0].cards.every((card) => !heldIds.includes(card.printingId)));
  assert.deepEqual(fixture.calls, ["manufacturing_claim", "manufacturing_save_manifest"]);

  const rares = source.catalog.filter((card) => card.set === "reef" && card.rarity === "Rare");
  let draw = 0;
  const original = createManufacturingManifest({
    request: { orderId: randomUUID(), orderNumber: "EXCLUSION-TEST", items: [{ productId: "reef-dive-pack", quantity: 1 }] },
    catalog: source.catalog, artworkRelease: release.releaseId, printTemplates: release.printTemplates,
    randomIndex: () => draw++ === 0 ? 9999 : draw === 2 ? rares.findIndex((card) => card.printingId === "reef-026") : 0,
  });
  assert.equal(original.packs[0].cards[8].printingId, "reef-026");
  assert.equal(preflightPrintAssets(original, release).ready, true);
  const pinned = claimFixture(release, original), replay = await pinned.service.claim(pinned.token);
  assert.equal(replay.blocked, undefined, replay.issue);
  assert.deepEqual(replay.manifest, original);
  assert.equal(verifyManifest(replay.manifest).manifestHash, original.manifestHash);
  assert.deepEqual(pinned.calls, ["manufacturing_claim"]);
});

test("malformed policy or release exclusions fail closed, including pools too small after exclusion", () => {
  for (const change of [
    { schemaVersion: 2 }, { reason: " " }, { reason: "x".repeat(501) },
    { printingIds: ["reef-999"] }, { printingIds: ["reef-011", "reef-011"] }, { printingIds: [null] },
  ]) assert.throws(() => applyBoosterArtworkPolicy(source, { ...policy, ...change }), /booster-artwork policy/);
  for (const exclusions of [null, {}, [null], [withPolicy.excludedBoosterArtwork[0], withPolicy.excludedBoosterArtwork[0]],
    [{ ...withPolicy.excludedBoosterArtwork[0], printingId: "reef-999" }],
    [{ ...withPolicy.excludedBoosterArtwork[0], cardId: "wrong" }],
    [{ ...withPolicy.excludedBoosterArtwork[0], name: "wrong" }],
    [{ ...withPolicy.excludedBoosterArtwork[0], reason: " " }],
  ]) assert.throws(() => validateRelease({ ...releaseFixture(), excludedBoosterArtwork: exclusions }), /booster-artwork exclusions/);
  const emptyCommons = source.catalog.filter((card) => card.set === "reef" && card.rarity === "Common").map((card) => ({
    printingId: card.printingId, cardId: card.cardId, name: card.name, reason: policy.reason,
  }));
  assert.throws(() => validateRelease({ ...releaseFixture(), excludedBoosterArtwork: emptyCommons }), /reef cannot fill Common/);
});
