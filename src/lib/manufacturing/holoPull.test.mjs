import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PDFArray, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { PNG } from "pngjs";
import { buildPrintingCatalog, contentHash, generateBooster } from "./boosters.mjs";
import { V4_PRINT_LAYOUT as PRINT_LAYOUT, V4_BACK_TEMPLATE as BACK_TEMPLATE, createManufacturingManifest, preflightPrintAssets, verifyManifest } from "./printPlan.mjs";
import { applyManufacturingEvent, createManufacturingState } from "./workflow.mjs";
import { renderJob } from "../../../scripts/manufacturing/render.mjs";

const read = async (name) => JSON.parse(await readFile(new URL(`../../data/${name}`, import.meta.url), "utf8"));
const catalog = buildPrintingCatalog(await read("gallery-set-list.json"), await read("gallery-images.json"));
const printTemplates = { version: PRINT_LAYOUT.version, fronts: PRINT_LAYOUT, backs: BACK_TEMPLATE };
const create = (set = "reef", roll = 0) => createManufacturingManifest({
  request: { orderId: "holo-pull-test", orderNumber: "HOLO-PULL", items: [{ productId: `${set === "ocean" ? "oceanic" : set}-dive-pack`, quantity: 1 }] },
  catalog, artworkRelease: "holo-pull-test", printTemplates,
  randomIndex: (upper) => upper === 10000 ? roll : 0,
});
function legacy(saved) {
  const { manifestHash, holoHandling, ...body } = structuredClone(saved);
  for (const sheet of body.sheets) {
    sheet.fronts.assetIds = sheet.slots.map((slot) => slot.printingId);
    for (const slot of sheet.slots) delete slot.pullFinishedHolo;
  }
  body.holoChecklist = body.holoChecklist.map(({ set, collectorNumber, setTotal, ...item }) => ({ ...item, instruction: "Manually apply the holo sticker and confirm." }));
  return { ...body, manifestHash: contentHash(body) };
}
function run(saved) {
  let state = createManufacturingState(saved), sequence = 0;
  const apply = (type, fields = {}) => {
    const event = { id: `pull-${++sequence}`, actor: "test", role: "operator", type, expectedRevision: state.revision, ...fields };
    state = applyManufacturingEvent(state, saved, event);
    return event;
  };
  return { apply, state: () => state, print() {
    const sheetId = saved.sheets[0].sheetId;
    apply("submission_started", { sheetId, side: "fronts", role: "agent" });
    apply("submission_succeeded", { sheetId, side: "fronts", role: "agent" });
    apply("confirm_printed", { sheetId, side: "fronts" });
  } };
}

test("new holo sheets retain all nine saved draws and identify the finished pull without requesting its artwork", () => {
  for (const set of ["reef", "deep", "ocean"]) {
    const saved = create(set), pack = saved.packs[0], holo = pack.cards[8];
    assert.equal(saved.holoHandling, "pull-finished");
    assert.deepEqual(pack, generateBooster({ catalog, set, packId: pack.packId, randomIndex: () => 0 }));
    assert.equal(saved.sheets[0].slots.length, 9);
    assert.equal(saved.sheets[0].fronts.assetIds.length, 8);
    assert.ok(!saved.sheets[0].fronts.assetIds.includes(holo.printingId));
    assert.deepEqual(saved.sheets[0].slots[8].pullFinishedHolo, {
      name: holo.name, set, collectorNumber: holo.collectorNumber, setTotal: holo.setTotal, printingId: holo.printingId,
    });
    assert.deepEqual(Object.fromEntries(Object.keys(PRINT_LAYOUT.positions[8]).map((key) => [key, saved.sheets[0].slots[8][key]])), PRINT_LAYOUT.positions[8]);
    assert.equal(saved.holoChecklist[0].collectorNumber, holo.collectorNumber);
    assert.equal(saved.holoChecklist[0].setTotal, holo.setTotal);
    assert.doesNotThrow(() => verifyManifest(JSON.parse(JSON.stringify(saved))));
    const rare = create(set, 9999);
    assert.equal(rare.sheets[0].fronts.assetIds.length, 9);
    assert.equal(rare.holoChecklist.length, 0);
    assert.ok(rare.sheets[0].slots.every((slot) => !slot.pullFinishedHolo));
  }
});

test("new finished pulls and legacy sticker confirmations cannot be confused; neither can be confirmed by the agent", () => {
  for (const [saved, accepted, rejected] of [[create(), "holo_pulled", "holo_applied"], [legacy(create()), "holo_applied", "holo_pulled"]]) {
    const flow = run(saved), holoId = saved.holoChecklist[0].id;
    assert.throws(() => flow.apply(accepted, { holoId }), /matching front sheet/);
    flow.print();
    assert.throws(() => flow.apply(rejected, { holoId }), /requires/);
    assert.throws(() => flow.apply(accepted, { holoId, role: "agent" }), /Only an operator/);
    const event = flow.apply(accepted, { holoId });
    assert.equal(flow.state().holos[holoId], true);
    assert.equal(applyManufacturingEvent(flow.state(), saved, event), flow.state());
    assert.equal(saved.packs[0].cards[8].printingId, create().packs[0].cards[8].printingId);
  }
});

async function fixture(dir, saved) {
  const assets = {}, assetFiles = {};
  async function asset(id, width, height, color, extra = {}) {
    const png = new PNG({ width, height });
    for (let index = 0; index < png.data.length; index += 4) png.data.set([...color, 255], index);
    const bytes = PNG.sync.write(png), sha256 = createHash("sha256").update(bytes).digest("hex");
    assetFiles[id] = path.join(dir, `${id}.png`);
    await writeFile(assetFiles[id], bytes);
    assets[id] = { path: `manufacturing/sha256/${sha256}.png`, sha256, width, height, ...extra };
  }
  for (const id of saved.sheets[0].fronts.assetIds) await asset(id, 750, 1050, [40, 150, 60]);
  await asset("standard-back-sheet", 2550, 3300, [17, 99, 151], { nodeId: "4244:451219" });
  await asset("print-template-front-background", 2439, 3239, [17, 99, 151], { nodeId: "4116:234587" });
  return { manifest: saved, release: { releaseId: saved.artworkRelease, assets, printTemplates }, assetFiles, outputDir: dir, siteOrigin: "https://searealm.com" };
}
function contents(doc, page) {
  const raw = page.node.lookup(PDFName.of("Contents"));
  return (raw instanceof PDFArray ? raw.asArray() : [raw]).map((ref) => Buffer.from(decodePDFRawStream(doc.context.lookup(ref, PDFRawStream)).decode()).toString()).join("\n");
}
async function temporary(action) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "searealm-holo-pull-"));
  try { return await action(dir); }
  finally {
    assert.ok(path.resolve(dir).startsWith(path.join(os.tmpdir(), "searealm-holo-pull-")));
    await rm(dir, { recursive: true, force: true });
  }
}

test("new holo fronts embed a legible vector pull marker at the exact native slot transform, and keep the rear artwork intact", () => temporary(async (dir) => {
  const args = await fixture(dir, create()), holo = args.manifest.packs[0].cards[8];
  const check = preflightPrintAssets(args.manifest, args.release);
  assert.equal(check.ready, true, check.errors.join("; "));
  assert.ok(!check.requiredAssetIds.includes(holo.printingId));
  const jobs = await renderJob(args), doc = await PDFDocument.load(await readFile(jobs.find((job) => job.side === "fronts").file)), page = doc.getPage(0);
  const objects = page.node.Resources().lookup(PDFName.of("XObject")).entries().map(([, ref]) => doc.context.lookup(ref, PDFRawStream));
  assert.equal(objects.filter((stream) => stream.dict.get(PDFName.of("Subtype")) === PDFName.of("Image")).length, 9);
  const forms = objects.filter((stream) => stream.dict.get(PDFName.of("Subtype")) === PDFName.of("Form"));
  assert.equal(forms.length, 1);
  const markerFonts = forms[0].dict.lookup(PDFName.of("Resources")).lookup(PDFName.of("Font")).entries();
  assert.equal(new Set(markerFonts.map(([, ref]) => ref.toString())).size, 2);
  for (const [, ref] of markerFonts)
    assert.equal(doc.context.lookup(ref)?.get(PDFName.of("Type")), PDFName.of("Font"), "Marker fonts must be embedded before the page is copied");
  const text = Buffer.from(decodePDFRawStream(forms[0]).decode()).toString();
  for (const label of ["PULL FINISHED HOLO", holo.name, `Reef ${holo.collectorNumber}/${holo.setTotal}`, holo.printingId, "Do not pack this placeholder."])
    assert.ok(text.includes(Buffer.from(label).toString("hex").toUpperCase()), label);
  const placements = [...contents(doc, page).matchAll(/\bq\s+([\s\S]*?)\s+Q\b/g)].filter((match) => /\/\S+ Do/.test(match[1]));
  const matrices = [...placements.at(-1)[1].matchAll(/^([^\n]+) cm$/gm)].map((match) => match[1].trim().split(/\s+/).map(Number));
  const position = PRINT_LAYOUT.positions[8], radians = position.rotation * Math.PI / 180;
  const expected = [[1, 0, 0, 1, (position.x - Math.sin(radians) * position.height) * 0.24, 792 - (position.y + Math.cos(radians) * position.height) * 0.24], [Math.cos(radians), -Math.sin(radians), Math.sin(radians), Math.cos(radians), 0, 0]];
  expected.forEach((matrix, index) => matrix.forEach((value, term) => assert.ok(Math.abs(matrices[index][term] - value) < 1e-7)));
  const rear = await PDFDocument.load(await readFile(jobs.find((job) => job.side === "backs").file));
  assert.equal(rear.getPage(0).node.Resources().lookup(PDFName.of("XObject")).entries().length, 1);
}));

test("legacy manifests still require and print the original holo art without new pull placeholders", () => temporary(async (dir) => {
  const saved = legacy(create()), args = await fixture(dir, saved), holo = saved.packs[0].cards[8];
  assert.ok(preflightPrintAssets(saved, args.release).requiredAssetIds.includes(holo.printingId));
  const jobs = await renderJob(args), doc = await PDFDocument.load(await readFile(jobs.find((job) => job.side === "fronts").file));
  const objects = doc.getPage(0).node.Resources().lookup(PDFName.of("XObject")).entries().map(([, ref]) => doc.context.lookup(ref, PDFRawStream));
  assert.equal(objects.length, 10);
  assert.ok(objects.every((stream) => stream.dict.get(PDFName.of("Subtype")) === PDFName.of("Image")));
  delete args.release.assets[holo.printingId];
  assert.equal(preflightPrintAssets(saved, args.release).ready, false);
}));
