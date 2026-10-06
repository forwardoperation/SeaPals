import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  BOOSTER_POLICY,
  buildPrintingCatalog,
  generateBooster,
  validateBoosterPool,
} from "./boosters.mjs";
import {
  BACK_TEMPLATE,
  PRINT_LAYOUT,
  createManufacturingManifest,
  preflightPrintAssets,
  verifyManifest,
} from "./printPlan.mjs";
import {
  applyManufacturingEvent,
  createManufacturingState,
  workflowReadiness,
} from "./workflow.mjs";
import { saveOrder } from "../../../scripts/manufacturing/orders.mjs";

const setList = JSON.parse(
  await readFile(
    new URL("../../data/gallery-set-list.json", import.meta.url),
    "utf8",
  ),
);
const gallery = JSON.parse(
  await readFile(
    new URL("../../data/gallery-images.json", import.meta.url),
    "utf8",
  ),
);
const catalog = buildPrintingCatalog(setList, gallery);
const request = {
  orderId: "test-order",
  orderNumber: "TEST-001",
  items: [{ productId: "deep-dive-pack", quantity: 1 }],
};
function manifest(randomIndex = () => 0) {
  return createManufacturingManifest({
    request,
    catalog,
    artworkRelease: "test-release",
    randomIndex,
    now: "2026-10-05T00:00:00.000Z",
  });
}
function exercise(saved) {
  let state = createManufacturingState(saved);
  let sequence = 0;
  return {
    state: () => state,
    apply(type, fields = {}) {
      const event = {
        id: `event-${++sequence}`,
        type,
        actor: "test-operator",
        role: "operator",
        expectedRevision: state.revision,
        ...fields,
      };
      state = applyManufacturingEvent(state, saved, event);
      return event;
    },
    print(sheetId, side) {
      this.apply("submission_started", { sheetId, side, role: "agent" });
      this.apply("submission_succeeded", { sheetId, side, role: "agent" });
      this.apply("confirm_printed", { sheetId, side });
    },
  };
}

test("every set has the expected explicit printing pools", () => {
  const expected = {
    reef: [39, 30, 18, 15],
    ocean: [26, 18, 15, 5],
    deep: [21, 15, 11, 15],
  };
  for (const [set, counts] of Object.entries(expected)) {
    const pool = validateBoosterPool(catalog, set);
    assert.deepEqual(
      ["Common", "Uncommon", "Rare", "Holo Rare"].map(
        (rarity) => pool.filter((card) => card.rarity === rarity).length,
      ),
      counts,
    );
  }
});

test("premium boundary is exactly 25 percent; it replaces the rare", () => {
  for (const [roll, rarity] of [
    [0, "Holo Rare"],
    [2499, "Holo Rare"],
    [2500, "Rare"],
    [9999, "Rare"],
  ]) {
    const pack = generateBooster({
      catalog,
      set: "oceanic",
      randomIndex: (upper) => (upper === 10000 ? roll : 0),
    });
    assert.equal(pack.cards.length, 9);
    assert.equal(pack.cards[8].rarity, rarity);
    assert.equal(
      pack.cards.filter((card) => card.rarity === "Common").length,
      5,
    );
    assert.equal(
      pack.cards.filter((card) => card.rarity === "Uncommon").length,
      3,
    );
  }
});

test("all possible premium printings fit a unique, set-specific nine-card pack", () => {
  for (const set of ["reef", "deep", "ocean"]) {
    for (const rarity of ["Rare", "Holo Rare"]) {
      const candidates = catalog.filter(
        (card) => card.set === set && card.rarity === rarity,
      );
      for (
        let premiumIndex = 0;
        premiumIndex < candidates.length;
        premiumIndex++
      ) {
        let draw = 0;
        const pack = generateBooster({
          catalog,
          set,
          randomIndex: () =>
            ++draw === 1
              ? rarity === "Rare"
                ? 9999
                : 0
              : draw === 2
                ? premiumIndex
                : 0,
        });
        assert.equal(
          pack.cards[8].printingId,
          candidates[premiumIndex].printingId,
        );
        assert.equal(new Set(pack.cards.map((card) => card.cardId)).size, 9);
        assert.ok(pack.cards.every((card) => card.set === set));
        assert.equal(pack.cards[8].slot, 9);
      }
    }
  }
});

test("prerelease remains eligible even if hidden from the public gallery", () => {
  const stamped = buildPrintingCatalog(setList, {
    cards: gallery.cards.map((card) => ({
      ...card,
      prerelease: true,
      hidden: true,
    })),
  });
  const before = generateBooster({
    catalog,
    set: "reef",
    randomIndex: () => 0,
  });
  const after = generateBooster({
    catalog: stamped,
    set: "reef",
    randomIndex: () => 0,
  });
  assert.deepEqual(
    before.cards.map((card) => card.printingId),
    after.cards.map((card) => card.printingId),
  );
  assert.ok(after.cards.some((card) => card.prerelease));
});

test("broken pools and invalid random sources fail rather than silently changing odds", () => {
  assert.throws(
    () =>
      generateBooster({
        catalog: catalog.filter((card) => card.rarity !== "Holo Rare"),
        set: "deep",
      }),
    /no Holo Rare/,
  );
  assert.throws(
    () => generateBooster({ catalog, set: "reef", randomIndex: () => 10000 }),
    /Invalid premium roll/,
  );
  assert.throws(
    () =>
      generateBooster({
        catalog,
        set: "reef",
        policy: { ...BOOSTER_POLICY, allowPrerelease: false },
      }),
    /includes prerelease/,
  );
  assert.throws(
    () => generateBooster({ catalog, set: "shared" }),
    /Unknown booster set/,
  );
});

test("two printer routes, separate sheets, and Canon correction match the measured Figma grid", () => {
  const saved = manifest();
  assert.match(saved.sheets[0].fronts.printerName, /ET-8550/);
  assert.match(saved.sheets[0].backs.printerName, /Canon/);
  assert.equal(saved.assembly, "separate-sheets-glued-together");
  assert.equal(
    150 * BACK_TEMPLATE.contentScale + BACK_TEMPLATE.translateX,
    PRINT_LAYOUT.left,
  );
  assert.equal(
    75 * BACK_TEMPLATE.contentScale + BACK_TEMPLATE.translateY,
    PRINT_LAYOUT.top,
  );
  assert.equal(750 * BACK_TEMPLATE.contentScale, PRINT_LAYOUT.cardWidth);
  assert.equal(1050 * BACK_TEMPLATE.contentScale, PRINT_LAYOUT.cardHeight);
  assert.equal(saved.holoChecklist[0].slot, 9);
});

test("all order items must have recipes; no partially fulfilled mixed order", () => {
  assert.throws(
    () =>
      createManufacturingManifest({
        request: {
          ...request,
          items: [
            ...request.items,
            { productId: "unconfigured-future-product", quantity: 1 },
          ],
        },
        catalog,
        artworkRelease: "v1",
      }),
    /entire order is held/,
  );
  assert.throws(
    () =>
      createManufacturingManifest({
        request: {
          ...request,
          items: [{ productId: "deep-dive-pack", quantity: -1 }],
        },
        catalog,
        artworkRelease: "v1",
      }),
    /quantity/,
  );
});

test("repeat generation reuses saved contents across changed catalogs and odds", async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), "searealm-manufacturing-test-"),
  );
  try {
    const first = await saveOrder({
      root,
      request,
      catalog,
      artworkRelease: "v1",
      randomIndex: () => 0,
    });
    const second = await saveOrder({
      root,
      request,
      catalog: [],
      artworkRelease: "v2",
      randomIndex: () => {
        throw new Error("Must not reroll");
      },
    });
    assert.equal(second.reused, true);
    assert.deepEqual(second.manifest, first.manifest);
    await assert.rejects(
      saveOrder({
        root,
        request: {
          ...request,
          items: [{ productId: "deep-dive-pack", quantity: 2 }],
        },
        catalog,
        artworkRelease: "v1",
      }),
      /different saved contents/,
    );
  } finally {
    const resolved = path.resolve(root);
    const allowed = path.resolve(os.tmpdir()) + path.sep;
    assert.ok(
      resolved.startsWith(allowed) &&
        path.basename(resolved).startsWith("searealm-manufacturing-test-"),
    );
    await rm(resolved, { recursive: true, force: true });
  }
});

test("manifest tampering and missing or low-resolution artwork are rejected", () => {
  const saved = manifest();
  const changed = structuredClone(saved);
  changed.packs[0].cards[0].name = "Substitution";
  assert.throws(() => verifyManifest(changed), /has changed/);
  const assets = Object.fromEntries(
    saved.packs[0].cards.map((card) => [
      card.printingId,
      { path: "private.png", sha256: "a".repeat(64), width: 375, height: 525 },
    ]),
  );
  const result = preflightPrintAssets(saved, {
    releaseId: "test-release",
    assets,
  });
  assert.equal(result.ready, false);
  assert.equal(result.errors.length, 10);
  assert.throws(
    () => preflightPrintAssets(saved, { releaseId: "new-release" }),
    /does not match/,
  );
});

test("spool success is not physical confirmation; both sides are required before glue", () => {
  const saved = manifest();
  const run = exercise(saved);
  const sheetId = saved.sheets[0].sheetId;
  run.apply("submission_started", { sheetId, side: "fronts", role: "agent" });
  run.apply("submission_succeeded", { sheetId, side: "fronts", role: "agent" });
  assert.throws(() => run.apply("glued", { sheetId }), /Both matching/);
  assert.throws(
    () =>
      run.apply("confirm_printed", { sheetId, side: "fronts", role: "agent" }),
    /Only an operator/,
  );
  run.apply("confirm_printed", { sheetId, side: "fronts" });
  assert.throws(() => run.apply("glued", { sheetId }), /Both matching/);
  run.print(sheetId, "backs");
  run.apply("glued", { sheetId });
  assert.equal(run.state().sheets[sheetId].glued, true);
});

test("manual holo work may precede or follow gluing/cutting, but always gates QC", () => {
  for (const early of [true, false]) {
    const saved = manifest();
    const run = exercise(saved);
    const sheetId = saved.sheets[0].sheetId;
    assert.throws(
      () => run.apply("holo_applied", { holoId: saved.holoChecklist[0].id }),
      /matching front/,
    );
    run.print(sheetId, "fronts");
    if (early) run.apply("holo_applied", { holoId: saved.holoChecklist[0].id });
    run.print(sheetId, "backs");
    run.apply("glued", { sheetId });
    run.apply("cut", { sheetId });
    if (!early) {
      assert.throws(() => run.apply("quality_checked"), /every holo sticker/);
      run.apply("holo_applied", { holoId: saved.holoChecklist[0].id });
    }
    run.apply("quality_checked");
    run.apply("packed");
    assert.equal(run.state().packed, true);
  }
});

test("front reprints reset stickers; back reprints preserve stickers but reset assembly", () => {
  for (const side of ["fronts", "backs"]) {
    const saved = manifest();
    const run = exercise(saved);
    const sheetId = saved.sheets[0].sheetId;
    run.print(sheetId, "fronts");
    run.print(sheetId, "backs");
    run.apply("holo_applied", { holoId: saved.holoChecklist[0].id });
    run.apply("glued", { sheetId });
    run.apply("cut", { sheetId });
    run.apply("quality_checked");
    run.apply("packed");
    run.apply("reprint", { sheetId, side, reason: "Damaged sheet" });
    assert.equal(
      run.state().holos[saved.holoChecklist[0].id],
      side === "backs",
    );
    assert.equal(run.state().sheets[sheetId].glued, false);
    assert.equal(run.state().packed, false);
    assert.equal(run.state().qualityChecked, false);
    assert.equal(
      run.state().sheets[sheetId][side === "backs" ? "fronts" : "backs"],
      "confirmed",
    );
  }
});

test("ambiguous submissions cannot auto-retry; duplicate scans are idempotent and stale writes fail", () => {
  const saved = manifest();
  const run = exercise(saved);
  const sheetId = saved.sheets[0].sheetId;
  const start = run.apply("submission_started", {
    sheetId,
    side: "fronts",
    role: "agent",
  });
  assert.equal(applyManufacturingEvent(run.state(), saved, start), run.state());
  assert.throws(
    () =>
      applyManufacturingEvent(run.state(), saved, { ...start, side: "backs" }),
    /different action/,
  );
  assert.throws(
    () =>
      run.apply("submission_started", {
        sheetId,
        side: "fronts",
        role: "agent",
      }),
    /already submitted/,
  );
  assert.throws(
    () => run.apply("reprint", { sheetId, side: "fronts", reason: "Unknown" }),
    /Reconcile/,
  );
  run.apply("submission_uncertain", { sheetId, side: "fronts", role: "agent" });
  assert.throws(
    () => run.apply("submission_started", { sheetId, side: "fronts" }),
    /already submitted/,
  );
  run.apply("reprint", {
    sheetId,
    side: "fronts",
    reason: "Confirmed nothing printed",
  });
  assert.throws(
    () => run.apply("hold", { expectedRevision: 0 }),
    /state changed/,
  );
});

test("holds prevent production and non-holo packs require zero sticker work", () => {
  const saved = manifest((upper) => (upper === 10000 ? 9999 : 0));
  const run = exercise(saved);
  assert.equal(saved.holoChecklist.length, 0);
  assert.equal(workflowReadiness(run.state()).holosRemaining, 0);
  run.apply("hold");
  assert.throws(
    () =>
      run.apply("submission_started", {
        sheetId: saved.sheets[0].sheetId,
        side: "fronts",
      }),
    /on hold/,
  );
  run.apply("release_hold");
  run.apply("submission_started", {
    sheetId: saved.sheets[0].sheetId,
    side: "fronts",
  });
});
