import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applyUnfinishedArtworkPolicy,
  buildSourceMap,
  parseBatchSize,
} from "../../../scripts/manufacturing/sync-figma.mjs";
import { generateBooster, validateBoosterPool } from "./boosters.mjs";
import { requireOrderArtwork, sha256 } from "./integration.mjs";

const readJson = async (relative) =>
  JSON.parse(await readFile(new URL(relative, import.meta.url), "utf8"));
const [setList, gallery, holos, policy] = await Promise.all([
  readJson("../../data/gallery-set-list.json"),
  readJson("../../data/gallery-images.json"),
  readJson("../../../scripts/manufacturing/figma-holo-sources.json"),
  readJson("../../../scripts/manufacturing/figma-unfinished-printings.json"),
]);
const canonical = (overrides = {}) =>
  buildSourceMap(setList, gallery, holos, overrides);
const approvedIds = [
  "deep-060", "deep-061", "deep-062", "ocean-064", "reef-094",
  "reef-096", "reef-097", "reef-098", "reef-099", "reef-100", "reef-101",
];
const sortedIds = (items, field) => items.map((item) => item[field]).sort();

test("unfinished-artwork approval names exactly the eleven audited printings", () => {
  assert.equal(policy.schemaVersion, 1);
  assert.deepEqual([...policy.printingIds].sort(), approvedIds);
  assert.ok(policy.reason.trim());
});

test("eligibility removes approved unmapped cards consistently and records their identities", () => {
  const full = canonical();
  const before = structuredClone(full);
  const eligible = applyUnfinishedArtworkPolicy(full, policy);

  assert.deepEqual(full, before, "The canonical source remains available for the next sync");
  assert.equal(full.catalog.length, 228);
  assert.equal(eligible.catalog.length, 217);
  assert.equal(eligible.sources.length, 271);
  assert.deepEqual(eligible.missing, []);
  assert.deepEqual(sortedIds(eligible.excludedUnfinished, "printingId"), approvedIds);
  assert.deepEqual(
    sortedIds(eligible.catalog, "printingId"),
    sortedIds(eligible.sources.filter((item) => item.kind === "card"), "id"),
  );
  for (const excluded of eligible.excludedUnfinished) {
    const card = full.catalog.find((item) => item.printingId === excluded.printingId);
    assert.deepEqual(excluded, {
      printingId: card.printingId,
      cardId: card.cardId,
      name: card.name,
      reason: policy.reason.trim(),
    });
  }
});

test("an empty approval does not hide any unmapped artwork", () => {
  const full = canonical();
  const eligible = applyUnfinishedArtworkPolicy(full, { ...policy, printingIds: [] });
  assert.deepEqual(eligible.catalog, full.catalog);
  assert.deepEqual(eligible.sources, full.sources);
  assert.deepEqual(eligible.missing, full.missing);
  assert.deepEqual(eligible.excludedUnfinished, []);
});

test("adding a source mapping automatically restores each approved printing to the next release", () => {
  const earlier = applyUnfinishedArtworkPolicy(canonical(), policy);
  const earlierHash = sha256(Buffer.from(JSON.stringify(earlier)));
  for (const [index, id] of approvedIds.entries()) {
    // A mapped node still undergoes the exporter's collector-number and image checks.
    const nodeId = `9876:${index + 1}`;
    const next = applyUnfinishedArtworkPolicy(canonical({ [id]: nodeId }), policy);
    assert.equal(next.catalog.length, 218);
    assert.equal(next.sources.find((item) => item.id === id)?.nodeId, nodeId);
    assert.ok(next.catalog.some((card) => card.printingId === id));
    assert.equal(next.excludedUnfinished.some((item) => item.printingId === id), false);
    assert.deepEqual(next.missing, []);
    assert.notEqual(sha256(Buffer.from(JSON.stringify(next))), earlierHash);
  }
  assert.equal(earlier.catalog.length, 217, "Existing release data does not change");
});

test("an unapproved missing card stays in the pool and blocks an incomplete order", () => {
  const full = canonical();
  const unknown = full.sources.find((item) => item.id === "deep-001");
  unknown.nodeId = null;
  // The helper must discover current mapping failures even if cached missing metadata is stale.
  full.missing = [];
  const eligible = applyUnfinishedArtworkPolicy(full, policy);
  assert.deepEqual(eligible.missing, [{ id: unknown.id, cardId: unknown.cardId }]);
  assert.ok(eligible.catalog.some((card) => card.printingId === unknown.id));
  assert.ok(eligible.sources.some((item) => item.id === unknown.id));
  assert.equal(eligible.excludedUnfinished.some((item) => item.printingId === unknown.id), false);
  const assets = Object.fromEntries(
    eligible.sources.filter((item) => item.nodeId).map((item) => [item.id, {}]),
  );
  assert.throws(
    () => requireOrderArtwork([{ productId: "deep-dive-pack", quantity: 1 }], {
      catalog: eligible.catalog,
      assets,
    }),
    /deep-001.*No booster draw was created/,
  );
});

test("fixed deck sheets, card-back artwork and ocean backgrounds are unaffected by unfinished-card exclusions", () => {
  const full = canonical();
  const fixed = full.sources.filter((item) => item.kind !== "card");
  assert.equal(fixed.length, 54);
  const eligible = applyUnfinishedArtworkPolicy(full, policy);
  assert.deepEqual(eligible.sources.filter((item) => item.kind !== "card"), fixed);
  assert.deepEqual(eligible.templates, full.templates);

  const broken = structuredClone(full);
  broken.sources.find((item) => item.id === "standard-back-sheet").nodeId = null;
  const result = applyUnfinishedArtworkPolicy(broken, policy);
  assert.ok(result.sources.some((item) => item.id === "standard-back-sheet"));
  assert.ok(result.missing.some((item) => item.id === "standard-back-sheet"));
  assert.equal(result.excludedUnfinished.length, 11);
});

test("every mapped prerelease card stays eligible", () => {
  const full = canonical();
  const mapped = new Set(full.sources.filter((item) => item.nodeId).map((item) => item.id));
  const prerelease = full.catalog.filter((card) => card.prerelease && mapped.has(card.printingId));
  assert.ok(prerelease.length > 0, "Exercise real printable prerelease cards");
  const eligible = applyUnfinishedArtworkPolicy(full, policy);
  assert.deepEqual(
    sortedIds(eligible.catalog.filter((card) => card.prerelease), "printingId"),
    sortedIds(prerelease, "printingId"),
  );
});

test("all three finished-artwork pools support rare and holo booster outcomes without rerolls", () => {
  const eligible = applyUnfinishedArtworkPolicy(canonical(), policy);
  const mapped = new Set(eligible.sources.filter((item) => item.nodeId).map((item) => item.id));
  for (const set of ["reef", "deep", "ocean"]) {
    assert.doesNotThrow(() => validateBoosterPool(eligible.catalog, set));
    for (const [roll, premiumRarity] of [[0, "Holo Rare"], [9999, "Rare"]]) {
      let first = true;
      const pack = generateBooster({
        catalog: eligible.catalog,
        set,
        randomIndex: () => {
          if (first) { first = false; return roll; }
          return 0;
        },
      });
      assert.equal(pack.cards.length, 9);
      assert.equal(new Set(pack.cards.map((card) => card.cardId)).size, 9);
      assert.equal(pack.cards.filter((card) => card.rarity === "Common").length, 5);
      assert.equal(pack.cards.filter((card) => card.rarity === "Uncommon").length, 3);
      assert.equal(pack.cards[8].rarity, premiumRarity);
      assert.ok(pack.cards.every((card) => card.set === set && mapped.has(card.printingId)));
    }
  }
});

test("invalid or unknown approval entries fail instead of silently changing the pool", () => {
  const full = canonical();
  for (const invalid of [
    null,
    { ...policy, schemaVersion: 2 },
    { ...policy, reason: " " },
    { ...policy, printingIds: "reef-094" },
    { ...policy, printingIds: ["reef-094", "reef-094"] },
    { ...policy, printingIds: ["reef-999"] },
    { ...policy, printingIds: ["standard-back-sheet"] },
  ]) {
    assert.throws(() => applyUnfinishedArtworkPolicy(full, invalid), /Invalid approved unfinished-artwork policy/);
  }
});

test("Figma batch size defaults to ten and accepts supported integer sizes", () => {
  assert.equal(parseBatchSize([]), 10);
  assert.equal(parseBatchSize(["--check"]), 10);
  for (const size of [1, 2, 10]) {
    assert.equal(parseBatchSize(["--batch-size", String(size)]), size);
    assert.equal(parseBatchSize(["--check", "--batch-size", String(size), "--if-changed"]), size);
  }
});

test("invalid Figma batch size arguments fail before a sync can run", () => {
  for (const args of [
    ["--batch-size"],
    ["--batch-size", "--check"],
    ["--batch-size", ""],
    ...["0", "-1", "NaN", "100", "1.5", "2.0", "1/2"].map((value) => ["--batch-size", value]),
    ["--batch-size", "1", "--batch-size", "2"],
  ]) {
    assert.throws(
      () => parseBatchSize(args),
      /--batch-size must be an integer from 1 to 10\./,
    );
  }
});
