import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, readdir, rm, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { PDFDocument, PDFName, PDFNumber, PDFArray, PDFRawStream, decodePDFRawStream, degrees, rgb } from "pdf-lib";
import { validatePrinterPlacement, preparePrinterPdf } from "../../../scripts/manufacturing/printer-placement.mjs";

const expectedDevice = {
  rasterDpiX: 720, rasterDpiY: 720, physicalWidth: 6284, physicalHeight: 8020,
  offsetX: 0, offsetY: 0, printableWidth: 6284, printableHeight: 8020,
};
const configuration = () => ({
  fronts: {
    printerName: "ET-8550 Series(Network)",
    printSettings: "noscale,simplex,color,paper=letter",
    pagePlacement: { mode: "fill-driver-page", expectedDevice: { ...expectedDevice } },
  },
  backs: { printerName: "Canon", printSettings: "noscale,simplex,color,paper=letter" },
  ticket: { printerName: "Canon", printSettings: "noscale,simplex,monochrome,paper=letter" },
});
const probe = async () => ({ paperSize: 1, orientation: 1, ...expectedDevice });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const almost = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);

async function fixture(t, mutate = () => {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "searealm-placement-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const document = await PDFDocument.create();
  const page = document.addPage([612, 792]);
  page.drawRectangle({ x: 43, y: 61, width: 177, height: 248, color: rgb(0.1, 0.2, 0.3) });
  mutate(document, page);
  const file = path.join(directory, "fronts.pdf");
  const bytes = Buffer.from(await document.save());
  await writeFile(file, bytes);
  return { directory, file, bytes, job: { side: "fronts", file, sheetId: "test-sheet" } };
}

function contentText(document, page) {
  const contents = page.node.Contents();
  const streams = contents instanceof PDFArray
    ? contents.asArray().map((ref) => document.context.lookup(ref))
    : [contents];
  return streams.map((stream) => {
    assert.ok(stream instanceof PDFRawStream);
    return Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
  }).join("\n");
}

test("ordinary Epson, Canon and ticket routes bypass placement without probing or reading files", async () => {
  const config = configuration();
  delete config.fronts.pagePlacement;
  for (const side of ["fronts", "backs", "ticket"]) {
    const job = { side, file: "missing.pdf" };
    assert.equal(validatePrinterPlacement(config, job), null);
    assert.equal(await preparePrinterPdf(config, job, {
      probe: () => assert.fail("Unconfigured routes must not probe the driver"),
    }), job);
  }
});

test("explicit placement requires a supported front route, exact print settings and a complete borderless profile", () => {
  const job = { side: "fronts", file: path.resolve("fronts.pdf") };
  assert.deepEqual(validatePrinterPlacement(configuration(), job), {
    mode: "fill-driver-page", expectedDevice,
  });
  const mutations = [
    (c) => { c.fronts.pagePlacement = null; },
    (c) => { c.fronts.pagePlacement.mode = "fit"; },
    (c) => { c.fronts.pagePlacement.extra = true; },
    (c) => { delete c.fronts.pagePlacement.expectedDevice.rasterDpiY; },
    (c) => { c.fronts.pagePlacement.expectedDevice.rasterDpiY = 360; },
    (c) => { c.fronts.pagePlacement.expectedDevice.physicalWidth = -1; },
    (c) => { c.fronts.pagePlacement.expectedDevice.rasterDpiX = "720"; },
    (c) => { c.fronts.pagePlacement.expectedDevice.offsetX = 1; },
    (c) => { c.fronts.pagePlacement.expectedDevice.printableWidth--; },
    (c) => { c.fronts.pagePlacement.expectedDevice.extra = 1; },
    (c) => { c.fronts.printSettings = "fit,simplex,color,paper=letter"; },
    (c) => { c.fronts.printSettings = "noscale,fit,simplex,color,paper=letter"; },
    (c) => { c.fronts.printSettings = "noscale,simplex,color,paper=a4"; },
    (c) => { c.fronts.printSettings = "noscale,duplex,color,paper=letter"; },
    (c) => { c.fronts.printSettings = "noscale,simplex,monochrome,paper=letter"; },
    (c) => { c.fronts.printSettings = "noscale,simplex,color,paper=letter,bin=2"; },
    (c) => { c.fronts.printSettings = "noscale,simplex,color,paper=letter,2x"; },
    (c) => { c.fronts.printSettings = "noscale,noscale,simplex,color,paper=letter"; },
    (c) => { c.fronts.printerName = " "; },
  ];
  for (const mutate of mutations) {
    const config = configuration();
    mutate(config);
    assert.throws(() => validatePrinterPlacement(config, job));
  }
  const config = configuration();
  config.backs.pagePlacement = structuredClone(config.fronts.pagePlacement);
  assert.throws(() => validatePrinterPlacement(config, { ...job, side: "backs" }), /only.*fronts/);
  assert.throws(() => validatePrinterPlacement(configuration(), { ...job, file: "relative.pdf" }), /absolute/);
});

test("wrapper covers and centers the full Letter page without altering the canonical file", async (t) => {
  const { job, bytes } = await fixture(t);
  job.leaseToken = "do-not-save-job-credentials";
  let probedName;
  const result = await preparePrinterPdf(configuration(), job, {
    probe: async (name) => { probedName = name; return probe(); },
  });
  assert.equal(probedName, "ET-8550 Series(Network)");
  assert.equal(result.sheetId, job.sheetId);
  assert.equal(job.file.endsWith("fronts.pdf"), true);
  assert.notEqual(result.file, job.file);
  assert.equal(path.dirname(result.file), path.join(path.dirname(job.file), "printer-ready"));
  assert.match(path.basename(result.file), /^[a-f0-9]{64}\.pdf$/);
  assert.deepEqual(await readFile(job.file), bytes);
  assert.equal(result.placement.sourceSha256, hash(bytes));
  assert.equal(result.placement.sourceFile, job.file);
  const auditBytes = await readFile(result.placement.metadataFile, "utf8");
  assert.equal(auditBytes.includes(job.leaseToken), false);
  const audit = JSON.parse(auditBytes);
  assert.equal(audit.sourceSha256, hash(bytes));
  assert.equal(audit.profile.mode, "fill-driver-page");
  assert.deepEqual(audit.profile.expectedDevice, expectedDevice);
  almost(audit.scale, 628.4 / 612);
  const wrapperBytes = await readFile(result.file);
  assert.equal(audit.outputSha256, hash(wrapperBytes));
  assert.equal(result.placement.outputSha256, hash(wrapperBytes));
  const wrapper = await PDFDocument.load(wrapperBytes, { updateMetadata: false });
  assert.equal(wrapper.getPageCount(), 1);
  const page = wrapper.getPage(0);
  assert.deepEqual(page.getMediaBox(), { x: 0, y: 0, width: 628.4, height: 802 });
  assert.deepEqual(page.getCropBox(), page.getMediaBox());
  assert.equal(page.getRotation().angle, 0);
  const scale = 628.4 / 612;
  const offsetY = (802 - 792 * scale) / 2;
  almost(result.placement.scale, scale);
  almost(result.placement.offsetXPoints, 0);
  almost(result.placement.offsetYPoints, offsetY);
  almost(offsetY, -5.611764705882308);
  almost(612 * scale, page.getWidth());
  assert.ok(792 * scale > page.getHeight(), "The original must cover, not fit inside, the driver canvas");
  almost(-offsetY, 792 * scale + offsetY - page.getHeight());
  // Inspect actual PDF operations, not only metadata returned by the module.
  const operations = contentText(wrapper, page);
  const matrices = [...operations.matchAll(/([-\d.e]+) ([-\d.e]+) ([-\d.e]+) ([-\d.e]+) ([-\d.e]+) ([-\d.e]+) cm/g)]
    .map((match) => match.slice(1).map(Number));
  assert.ok(matrices.some((m) => m[0] === 1 && m[3] === 1 && m[4] === 0 && Math.abs(m[5] - offsetY) < 1e-9));
  assert.ok(matrices.some((m) => Math.abs(m[0] - scale) < 1e-9 && Math.abs(m[3] - scale) < 1e-9));
  const objects = page.node.Resources().lookup(PDFName.of("XObject"));
  const entries = objects.entries();
  assert.equal(entries.length, 1, "Embed the complete canonical page once");
  const embedded = wrapper.context.lookup(entries[0][1]);
  assert.ok(embedded instanceof PDFRawStream);
  assert.equal(embedded.dict.get(PDFName.of("Subtype")).toString(), "/Form");
  assert.deepEqual(embedded.dict.lookup(PDFName.of("BBox")).asArray().map((n) => n.asNumber()), [0, 0, 612, 792]);
  const source = await PDFDocument.load(bytes, { updateMetadata: false });
  const embeddedOperations = Buffer.from(decodePDFRawStream(embedded).decode()).toString("latin1");
  assert.ok(embeddedOperations.includes(contentText(source, source.getPage(0)).trim()),
    "Source drawing commands remain intact inside the page form");
});

test("changed device capabilities reject before any wrapper directory is created", async (t) => {
  const { job, directory, bytes } = await fixture(t);
  for (const field of [...Object.keys(expectedDevice), "paperSize", "orientation"]) {
    const changed = await probe();
    changed[field]++;
    await assert.rejects(
      preparePrinterPdf(configuration(), job, { probe: async () => changed }),
      /capabilities changed|portrait Letter/,
      field,
    );
    await assert.rejects(access(path.join(directory, "printer-ready")), { code: "ENOENT" });
  }
  await assert.rejects(preparePrinterPdf(configuration(), job, { probe: async () => null }), /portrait Letter/);
  assert.deepEqual(await readFile(job.file), bytes);
});

test("source pages with different dimensions, crops, rotations or page count cannot be placed", async (t) => {
  const cases = [
    (_d, p) => p.setSize(595, 842),
    (_d, p) => p.setCropBox(5, 0, 607, 792),
    (_d, p) => p.setMediaBox(5, 0, 612, 792),
    (_d, p) => p.setRotation(degrees(90)),
    (_d, p) => p.node.set(PDFName.of("UserUnit"), PDFNumber.of(2)),
    (d) => d.addPage([612, 792]),
  ];
  for (const mutate of cases) {
    const { job, directory } = await fixture(t, mutate);
    await assert.rejects(preparePrinterPdf(configuration(), job, { probe }), /Letter|rotated|point units/);
    await assert.rejects(access(path.join(directory, "printer-ready")), { code: "ENOENT" });
  }
});

test("cache is deterministic, detects modified output and keys source bytes and profile separately", async (t) => {
  const { job, directory } = await fixture(t);
  const first = await preparePrinterPdf(configuration(), job, { probe });
  const initial = await readFile(first.file);
  const second = await preparePrinterPdf(configuration(), job, { probe });
  assert.equal(second.file, first.file);
  assert.deepEqual(await readFile(second.file), initial);
  assert.deepEqual(second.placement, first.placement);
  await writeFile(first.file, "damaged cached PDF");
  const repaired = await preparePrinterPdf(configuration(), job, { probe });
  assert.deepEqual(await readFile(repaired.file), initial);
  const modified = await PDFDocument.load(await readFile(job.file));
  modified.getPage(0).drawRectangle({ x: 300, y: 200, width: 20, height: 20 });
  await writeFile(job.file, await modified.save());
  const newSource = await preparePrinterPdf(configuration(), job, { probe });
  assert.notEqual(newSource.file, first.file);
  assert.notEqual(newSource.placement.sourceSha256, first.placement.sourceSha256);
  const differentProfile = configuration();
  differentProfile.fronts.pagePlacement.expectedDevice.physicalWidth += 2;
  differentProfile.fronts.pagePlacement.expectedDevice.printableWidth += 2;
  const newProfile = await preparePrinterPdf(differentProfile, job, {
    probe: async () => ({ ...(await probe()), physicalWidth: 6286, printableWidth: 6286 }),
  });
  assert.notEqual(newProfile.file, newSource.file);
  assert.notEqual(newProfile.placement.profileSha256, newSource.placement.profileSha256);
  const cachedFiles = await readdir(path.join(directory, "printer-ready"));
  assert.equal(cachedFiles.filter((name) => name.endsWith(".pdf")).length, 3);
  assert.equal(cachedFiles.filter((name) => name.endsWith(".placement.json")).length, 3);
  assert.equal(cachedFiles.length, 6, "Atomic cache writes must not leave temporary files");
});
