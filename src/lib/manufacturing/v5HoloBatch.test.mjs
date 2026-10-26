import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PDFArray, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { PNG } from "pngjs";
import { buildPrintingCatalog, contentHash } from "./boosters.mjs";
import { V5_PRINT_LAYOUT as PRINT_LAYOUT, BACK_TEMPLATE, V5_HOLO_PRINT_LAYOUT as HOLO_PRINT_LAYOUT, HOLO_BACK_TEMPLATE, PRINT_LAYOUT as CURRENT_PRINT_LAYOUT, HOLO_PRINT_LAYOUT as CURRENT_HOLO_PRINT_LAYOUT, createManufacturingManifest } from "./printPlan.mjs";
import { sha256 } from "./integration.mjs";
import { createHoloBatch, parseHoloSelections, verifyHoloBatch } from "./holoBatch.mjs";
import { renderHoloBatch, renderJob } from "../../../scripts/manufacturing/render.mjs";
import { generateHoloBatch } from "../../../scripts/manufacturing/holo-batch.mjs";

const read = async (name) => JSON.parse(await readFile(new URL(`../../data/${name}`, import.meta.url), "utf8"));
const catalog = buildPrintingCatalog(await read("gallery-set-list.json"), await read("gallery-images.json"));
const holo = catalog.find((card) => card.set === "reef" && card.rarity === "Holo Rare");
const common = catalog.find((card) => card.rarity === "Common");
const templates = { version: PRINT_LAYOUT.version, fronts: PRINT_LAYOUT, backs: BACK_TEMPLATE,
  holoFronts: HOLO_PRINT_LAYOUT, holoBacks: HOLO_BACK_TEMPLATE };

function png(width, height, color) {
  const image = new PNG({ width, height });
  for (let index = 0; index < image.data.length; index += 4) image.data.set([...color, 255], index);
  return PNG.sync.write(image);
}
async function fixture(root) {
  const releaseDir = path.join(root, ".private", "manufacturing", "releases", "holo-v5-test");
  await mkdir(releaseDir, { recursive: true });
  const assets = {}, assetFiles = {};
  async function add(id, bytes, width, height, nodeId) {
    const checksum = sha256(bytes), file = path.join(releaseDir, `${checksum}.png`);
    await writeFile(file, bytes);
    assets[id] = { width, height, nodeId, sha256: checksum, path: `manufacturing/sha256/${checksum}.png` };
    assetFiles[id] = file;
  }
  for (const [index, template] of [PRINT_LAYOUT, BACK_TEMPLATE, HOLO_PRINT_LAYOUT, HOLO_BACK_TEMPLATE].entries())
    await add(template.background.assetId, png(2550, 3300, [20 + index * 20, 80, 150]), 2550, 3300, template.background.nodeId);
  const card = png(750, 1050, [150, 10, 20]), checksum = sha256(card), cardFile = path.join(releaseDir, `${checksum}.png`);
  await writeFile(cardFile, card);
  for (const item of catalog) {
    assets[item.printingId] = { width: 750, height: 1050, nodeId: "fixture-card", sha256: checksum, path: `manufacturing/sha256/${checksum}.png` };
    assetFiles[item.printingId] = cardFile;
  }
  const release = { releaseId: "holo-v5-test", figmaVersion: "fixture-v5", catalog, printTemplates: templates, assets };
  const releaseFile = path.join(releaseDir, "release.json");
  await writeFile(releaseFile, JSON.stringify(release));
  return { release, assetFiles, releaseFile, privateRoot: path.resolve(releaseDir, "../..") };
}
async function temporary(action) {
  const root = await mkdtemp(path.join(os.tmpdir(), "searealm-holo-v5-"));
  try { return await action(root, await fixture(root)); }
  finally {
    assert.ok(path.resolve(root).startsWith(path.join(os.tmpdir(), "searealm-holo-v5-")));
    await rm(root, { recursive: true, force: true });
  }
}
async function inspect(file) {
  const doc = await PDFDocument.load(await readFile(file)), page = doc.getPage(0);
  assert.equal(doc.getPageCount(), 1);
  assert.deepEqual(page.getSize(), { width: 612, height: 792 });
  const raw = page.node.lookup(PDFName.of("Contents")), streams = raw instanceof PDFArray ? raw.asArray() : [raw],
    content = streams.map((ref) => Buffer.from(decodePDFRawStream(doc.context.lookup(ref, PDFRawStream)).decode()).toString()).join("\n"),
    objects = page.node.Resources().lookup(PDFName.of("XObject")).entries().map(([, ref]) => doc.context.lookup(ref, PDFRawStream)),
    placements = [...content.matchAll(/\bq\s+([\s\S]*?)\s+Q\b/g)].filter((match) => /\/\S+ Do/.test(match[1]))
      .map((match) => [...match[1].matchAll(/^([^\n]+) cm$/gm)].map((matrix) => matrix[1].trim().split(/\s+/).map(Number)));
  return { content, objects, placements };
}
const image = (stream) => stream.dict.get(PDFName.of("Subtype")) === PDFName.of("Image");

// Bounded explicit quantities are separate from random booster recipes.
test("holo selection syntax rejects ambiguous, negative, fractional and empty entries", () => {
  assert.deepEqual(parseHoloSelections(`${holo.printingId}:10`), [{ printingId: holo.printingId, quantity: 10 }]);
  for (const input of ["", "reef-101", "reef-101:0", "reef-101:-1", "reef-101:2.5", "reef-101:01", "reef-101:1,", "../card:1"])
    assert.throws(() => parseHoloSelections(input));
});

test("holo batch saves explicit choices and the dedicated templates, preserving a partial final sheet", () => temporary(async (_, { release }) => {
  const batch = createHoloBatch({ release, selections: [{ printingId: holo.printingId, quantity: 10 }] });
  assert.equal(batch.kind, "holo-replenishment");
  assert.equal(batch.quantity, 10);
  assert.deepEqual(batch.sheets.map((sheet) => sheet.slots.length), [9, 1]);
  assert.equal(batch.layout.nodeId, "4311:139557");
  assert.equal(batch.backTemplate.nodeId, "4311:139076");
  assert.equal(batch.layout.positions[0].x, PRINT_LAYOUT.positions[0].x - 55);
  assert.equal(batch.backTemplate.positions[0].x, BACK_TEMPLATE.positions[0].x + 45);
  assert.deepEqual(batch.sheets[1].slots[0], { ...HOLO_PRINT_LAYOUT.positions[0], printingId: holo.printingId, slot: 1 });
  assert.ok(batch.sheets.flatMap((sheet) => sheet.slots).every((slot) => !slot.pullFinishedHolo));
  assert.ok(!Object.hasOwn(batch, "order"));
  assert.ok(!Object.hasOwn(batch, "inventoryPlan"));
  assert.deepEqual(Object.keys(batch.assets), ["print-template-holo-front-background", "holographic-back-sheet", holo.printingId]);
  assert.equal(verifyHoloBatch(JSON.parse(JSON.stringify(batch)), release).batchHash, batch.batchHash);
  for (const selections of [[{ printingId: common.printingId, quantity: 1 }], [{ printingId: "reef-999", quantity: 1 }],
    [{ printingId: holo.printingId, quantity: 0 }], [{ printingId: holo.printingId, quantity: 1.5 }],
    [{ printingId: holo.printingId, quantity: 901 }], Array(2).fill({ printingId: holo.printingId, quantity: 1 })])
    assert.throws(() => createHoloBatch({ release, selections }));
  const tampered = structuredClone(batch);
  tampered.sheets[0].slots[0].x += 2;
  const { batchHash, ...body } = tampered;
  tampered.batchHash = contentHash(body);
  assert.throws(() => verifyHoloBatch(tampered, release), /pinned artwork/);
}));

test("holo PDFs print native artwork on holo geometry and embed each complete rear once", () => temporary(async (root, { release, assetFiles }) => {
  const batch = createHoloBatch({ release, selections: [{ printingId: holo.printingId, quantity: 10 }] });
  const files = await renderHoloBatch({ batch, release, assetFiles, outputDir: path.join(root, "rendered") });
  assert.equal(files.length, 4);
  for (const [index, file] of files.entries()) {
    assert.equal(file.sha256, sha256(await readFile(file.file)));
    const output = await inspect(file.file);
    assert.ok(output.objects.every(image), "Holo manufacturing prints artwork, never a finished-holo pull placeholder");
    if (file.side === "backs") {
      assert.equal(output.objects.length, 1);
      assert.deepEqual(output.placements[0], [[1, 0, 0, 1, 0, 0], [1, 0, 0, 1, 0, 0], [612, 0, 0, 792, 0, 0], [1, 0, 0, 1, 0, 0]]);
      assert.equal(output.objects[0].dict.lookup(PDFName.of("Width")).asNumber(), 2550);
      assert.deepEqual([...decodePDFRawStream(output.objects[0]).decode().slice(0, 3)], [80, 80, 150]);
    } else {
      assert.equal(output.placements.length, index === 0 ? 10 : 2);
      const position = HOLO_PRINT_LAYOUT.positions[0], translation = output.placements[1][0];
      assert.ok(Math.abs(translation[4] - position.x * .24) < 1e-7);
      assert.ok(Math.abs(translation[5] - (792 - (position.y + position.height) * .24)) < 1e-7);
      assert.deepEqual(output.placements[1][1], [1, 0, 0, 1, 0, 0]);
      assert.deepEqual([...decodePDFRawStream(output.objects[0]).decode().slice(0, 3)], [60, 80, 150]);
    }
  }
}));

test("ordinary V5 dive packs retain finished-holo instructions and ordinary template geometry", () => temporary(async (root, { release, assetFiles }) => {
  const manifest = createManufacturingManifest({ request: { orderId: "v5-pull", orderNumber: "V5-PULL", items: [{ productId: "reef-dive-pack", quantity: 1 }] },
    catalog, artworkRelease: release.releaseId, printTemplates: release.printTemplates, randomIndex: () => 0 });
  const jobs = await renderJob({ manifest, release, assetFiles, outputDir: path.join(root, "ordinary"), siteOrigin: "https://searealm.com" });
  const front = await inspect(jobs.find((job) => job.side === "fronts").file), rear = await inspect(jobs.find((job) => job.side === "backs").file);
  assert.equal(manifest.layout.nodeId, "4290:38532");
  assert.equal(manifest.holoHandling, "pull-finished");
  assert.equal(front.objects.filter((object) => !image(object)).length, 1);
  assert.deepEqual([...decodePDFRawStream(front.objects[0]).decode().slice(0, 3)], [20, 80, 150]);
  assert.equal(rear.objects.length, 1);
  assert.deepEqual([...decodePDFRawStream(rear.objects[0]).decode().slice(0, 3)], [40, 80, 150]);
}));

test("tampered private holo artwork stops before producing PDFs", () => temporary(async (root, { release, assetFiles }) => {
  const batch = createHoloBatch({ release, selections: [{ printingId: holo.printingId, quantity: 1 }] }), file = path.join(root, "bad.png");
  await writeFile(file, "not original artwork");
  const outputDir = path.join(root, "rejected");
  await assert.rejects(renderHoloBatch({ batch, release, assetFiles: { ...assetFiles, [holo.printingId]: file }, outputDir }), /checksum/);
  await assert.rejects(readdir(outputDir), { code: "ENOENT" });
}));

test("CLI creates only private new PDF batches and refuses output reuse or public paths", () => temporary(async (root, { releaseFile, privateRoot }) => {
  const options = { releaseFile, cards: `${holo.printingId}:1`, outputDir: path.join(privateRoot, "holo-batches", "example") };
  const result = await generateHoloBatch(options);
  assert.equal(result.printingRequested, false);
  assert.equal(result.inventoryAdded, false);
  assert.equal(result.files.length, 2);
  assert.equal(JSON.parse(await readFile(result.manifestPath, "utf8")).batch.quantity, 1);
  await assert.rejects(generateHoloBatch(options), { code: "EEXIST" });
  await assert.rejects(generateHoloBatch({ ...options, outputDir: path.join(root, "public") }), /private/);
}));


test("V6 replenishment keeps the unchanged holo grid and ordinary packs use shifted pull slots", () => temporary(async (_, { release }) => {
  const current = { ...release, releaseId: 'holo-v6-test', printTemplates: { ...templates,
    version: CURRENT_PRINT_LAYOUT.version, fronts: CURRENT_PRINT_LAYOUT, holoFronts: CURRENT_HOLO_PRINT_LAYOUT } };
  const old = createHoloBatch({ release, selections: [{ printingId: holo.printingId, quantity: 9 }] });
  const batch = createHoloBatch({ release: current, selections: [{ printingId: holo.printingId, quantity: 9 }] });
  assert.equal(batch.layout.version, 'figma-cutter-nine-up-v6');
  assert.equal(old.layout.version, 'figma-cutter-nine-up-v5');
  assert.deepEqual(batch.sheets, old.sheets); assert.deepEqual(batch.backTemplate, old.backTemplate);
  assert.equal(verifyHoloBatch(batch, current).batchHash, batch.batchHash);
  assert.equal(verifyHoloBatch(old, release).batchHash, old.batchHash);
  const manifest = createManufacturingManifest({ request: { orderId: 'v6-pull', orderNumber: 'V6-PULL', items: [{ productId: 'reef-dive-pack', quantity: 1 }] },
    catalog, artworkRelease: current.releaseId, printTemplates: current.printTemplates, randomIndex: () => 0 });
  assert.equal(manifest.layout.version, 'figma-cutter-nine-up-v6');
  assert.equal(manifest.sheets[0].slots[8].x, CURRENT_PRINT_LAYOUT.positions[8].x);
  assert.equal(manifest.sheets[0].slots[8].pullFinishedHolo.printingId, manifest.packs[0].cards[8].printingId);
}));
