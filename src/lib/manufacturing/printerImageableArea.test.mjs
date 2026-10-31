import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, readdir, rm, access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { PDFDocument, PDFName, PDFArray, PDFRawStream, decodePDFRawStream, rgb } from "pdf-lib";
import { validatePrinterPlacement, preparePrinterPdf } from "../../../scripts/manufacturing/printer-placement.mjs";
import { readPrinterImageableArea, validatedPrinterImageableArea } from "../../../scripts/manufacturing/printer-imageable-area.mjs";
import { printerArguments } from "../../../scripts/manufacturing/agent.mjs";

const printerName = "Canon MF750C II Series UFR II";
const expectedDevice = {
  rasterDpiX: 1200, rasterDpiY: 1200, physicalWidth: 10200, physicalHeight: 13200,
  offsetX: 0, offsetY: 0, printableWidth: 10200, printableHeight: 13200,
};
const expectedImageableArea = {
  unit: "dip96", pageWidth: 816, pageHeight: 1056,
  originX: 18.897637795275593, originY: 18.897637795275593,
  width: 778.2047244094489, height: 1018.2047244094489,
};
const configuration = () => ({
  backs: { printerName, printSettings: "noscale,simplex,color,paper=letter",
    pagePlacement: { mode: "fill-imageable-area", expectedDevice: { ...expectedDevice }, expectedImageableArea: { ...expectedImageableArea } } },
  ticket: { printerName, printSettings: "noscale,simplex,monochrome,paper=letter" },
});
const snapshot = () => ({
  printerName, mediaSize: "NorthAmericaLetter", orientation: "Portrait", color: "Color", duplex: "OneSided",
  resolutionX: 1200, resolutionY: 1200, area: { ...expectedImageableArea },
});
const probes = () => ({
  probe: async () => ({ paperSize: 1, orientation: 1, ...expectedDevice }),
  probeImageableArea: async () => snapshot(),
});
const almost = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, String(actual) + " != " + expected);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "searealm-imageable-"));
  t.after(async () => {
    assert.ok(path.resolve(directory).startsWith(path.join(os.tmpdir(), "searealm-imageable-")));
    await rm(directory, { recursive: true, force: true });
  });
  const source = await PDFDocument.create();
  source.setCreationDate(new Date(0));
  source.setModificationDate(new Date(0));
  const page = source.addPage([612, 792]);
  page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: rgb(0.1, 0.3, 0.6) });
  const file = path.join(directory, "backs.pdf"), bytes = Buffer.from(await source.save());
  await writeFile(file, bytes);
  return { directory, bytes, job: { side: "backs", file, sheetId: "test-sheet" } };
}
function operations(document, page) {
  const contents = page.node.Contents();
  const streams = contents instanceof PDFArray ? contents.asArray().map((ref) => document.context.lookup(ref)) : [contents];
  return streams.map((stream) => {
    assert.ok(stream instanceof PDFRawStream);
    return Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1");
  }).join("\n");
}

test("imageable placement is opt-in for backs with complete Letter geometry in explicit dip96 units", () => {
  const job = { side: "backs", file: path.resolve("rear.pdf") };
  assert.deepEqual(validatePrinterPlacement(configuration(), job), configuration().backs.pagePlacement);
  for (const side of ["fronts", "ticket"]) {
    const config = configuration();
    config[side] = config.backs;
    assert.throws(() => validatePrinterPlacement(config, { ...job, side }), /only for rear pages/);
  }
  const mutations = [
    (c) => { delete c.backs.pagePlacement.expectedImageableArea; },
    (c) => { c.backs.pagePlacement.expectedImageableArea.unit = "points"; },
    (c) => { c.backs.pagePlacement.expectedImageableArea.pageWidth = 1056; },
    (c) => { c.backs.pagePlacement.expectedImageableArea.originX = -1; },
    (c) => { c.backs.pagePlacement.expectedImageableArea.width = 900; },
    (c) => { c.backs.pagePlacement.expectedImageableArea.height = 0; },
    (c) => { c.backs.pagePlacement.expectedImageableArea.originY = NaN; },
    (c) => { c.backs.pagePlacement.expectedImageableArea.extra = 0; },
    (c) => { c.backs.pagePlacement.expectedDevice.offsetX = 1; },
    (c) => { c.backs.pagePlacement.expectedDevice.physicalWidth++; c.backs.pagePlacement.expectedDevice.printableWidth++; },
    (c) => { c.backs.printSettings = "fit,simplex,color,paper=letter"; },
  ];
  for (const mutate of mutations) {
    const config = configuration(); mutate(config);
    assert.throws(() => validatePrinterPlacement(config, job));
  }
});

test("read-only probe uses argument-safe invocation and rejects invalid normalized tickets and bounds", async () => {
  const name = 'Canon & "Desk"';
  let invoked = 0;
  const result = await readPrinterImageableArea(name, { execute: async (file, args, options) => {
    invoked++;
    assert.equal(file, "powershell.exe");
    assert.equal(args.at(-2), "-PrinterName");
    assert.equal(args.at(-1), name);
    assert.equal(options.shell, false);
    assert.equal(options.windowsHide, true);
    assert.equal(options.timeout, 20000);
    return { stdout: "\ufeff" + JSON.stringify({ ...snapshot(), printerName: name }) };
  } });
  assert.equal(invoked, 1);
  assert.equal(result.printerName, name);
  for (const key of ["printerName", "mediaSize", "orientation", "color", "duplex", "resolutionX", "resolutionY"]) {
    const value = snapshot(); value[key] = key.startsWith("resolution") ? 0 : "unexpected";
    assert.throws(() => validatedPrinterImageableArea(value, printerName));
  }
  assert.throws(() => validatedPrinterImageableArea({ ...snapshot(), area: null }, printerName));
  await assert.rejects(readPrinterImageableArea("bad\nname", { execute: () => assert.fail("Invalid name reached process launch") }));
  await assert.rejects(readPrinterImageableArea(name, { execute: async () => ({ stdout: "not JSON" }) }), /invalid JSON/);
});

test("rear wrapper covers and clips the measured imageable area on physical Letter without modifying its source", async (t) => {
  const { job, bytes } = await fixture(t);
  const result = await preparePrinterPdf(configuration(), job, probes());
  assert.deepEqual(await readFile(job.file), bytes);
  const pdfBytes = await readFile(result.file), document = await PDFDocument.load(pdfBytes, { updateMetadata: false }), page = document.getPage(0);
  assert.deepEqual(page.getMediaBox(), { x: 0, y: 0, width: 612, height: 792 });
  assert.deepEqual(page.getCropBox(), page.getMediaBox());
  const { scale, offsetXPoints, offsetYPoints, clipRectangle: clip } = result.placement;
  almost(scale, expectedImageableArea.height / 1056);
  almost(scale, 0.9642090193271297);
  almost(offsetXPoints * 25.4 / 72, 3.86363636363636);
  almost(offsetYPoints * 25.4 / 72, 5);
  almost(clip.x * 25.4 / 72, 5);
  almost(clip.y * 25.4 / 72, 5);
  assert.ok(612 * scale > clip.width);
  almost(792 * scale, clip.height);
  const text = operations(document, page);
  const rectangle = [...text.matchAll(/([-\d.e]+) ([-\d.e]+) ([-\d.e]+) ([-\d.e]+) re/g)][0];
  assert.ok(rectangle, "The clip must be in the PDF, not only in audit metadata");
  rectangle.slice(1).map(Number).forEach((v, index) => almost(v, [clip.x, clip.y, clip.width, clip.height][index]));
  assert.match(text, /re\s+W\s+n\s+q/);
  assert.ok(text.indexOf("W") < text.indexOf("Do"));
  const matrices = [...text.matchAll(/([-\d.e]+) ([-\d.e]+) ([-\d.e]+) ([-\d.e]+) ([-\d.e]+) ([-\d.e]+) cm/g)].map((m) => m.slice(1).map(Number));
  assert.ok(matrices.some((m) => Math.abs(m[0] - scale) < 1e-9 && Math.abs(m[3] - scale) < 1e-9));
  assert.ok(matrices.some((m) => Math.abs(m[4] - offsetXPoints) < 1e-9 && Math.abs(m[5] - offsetYPoints) < 1e-9));
  const entries = page.node.Resources().lookup(PDFName.of("XObject")).entries();
  assert.equal(entries.length, 1);
  const embedded = document.context.lookup(entries[0][1]);
  assert.deepEqual(embedded.dict.lookup(PDFName.of("BBox")).asArray().map((n) => n.asNumber()), [0, 0, 612, 792]);
  const audit = JSON.parse(await readFile(result.placement.metadataFile, "utf8"));
  assert.equal(audit.sourceSha256, hash(bytes));
  assert.equal(audit.outputSha256, hash(pdfBytes));
  assert.deepEqual(audit.expectedImageableArea, expectedImageableArea);
  assert.deepEqual(audit.profile.expectedImageableArea, expectedImageableArea);
  assert.deepEqual(audit.imageableSnapshot, snapshot());
});

test("asymmetric imageable bounds use top-left WPF coordinates and uniform cover, not fixed Canon offsets", async (t) => {
  const { job } = await fixture(t), config = configuration();
  const area = { unit: "dip96", pageWidth: 816, pageHeight: 1056, originX: 24, originY: 12, width: 760, height: 1008 };
  config.backs.pagePlacement.expectedImageableArea = area;
  const result = await preparePrinterPdf(config, job, { ...probes(), probeImageableArea: async () => ({ ...snapshot(), area }) });
  assert.deepEqual(result.placement.clipRectangle, { x: 18, y: 27, width: 570, height: 756 });
  almost(result.placement.scale, 756 / 792);
  almost(result.placement.offsetXPoints, 18 + (570 - 612 * 756 / 792) / 2);
  almost(result.placement.offsetYPoints, 27);
});

test("every preparation rechecks GDI and WPF capabilities, including cached files and ticket resolution", async (t) => {
  const { job, directory } = await fixture(t);
  for (const field of [...Object.keys(expectedDevice), "paperSize", "orientation"]) {
    const changed = { paperSize: 1, orientation: 1, ...expectedDevice }; changed[field]++;
    await assert.rejects(preparePrinterPdf(configuration(), job, { ...probes(), probe: async () => changed }), /capabilities changed|portrait Letter/);
    await assert.rejects(access(path.join(directory, "printer-ready")), { code: "ENOENT" });
  }
  let deviceReads = 0, areaReads = 0;
  const options = { probe: async () => { deviceReads++; return probes().probe(); }, probeImageableArea: async () => { areaReads++; return snapshot(); } };
  const first = await preparePrinterPdf(configuration(), job, options);
  const second = await preparePrinterPdf(configuration(), job, options);
  assert.equal(first.file, second.file);
  assert.equal(deviceReads, 2); assert.equal(areaReads, 2);
  for (const mutate of [
    (s) => { s.area.originX -= 1; }, (s) => { s.area.originY -= 1; },
    (s) => { s.area.width -= 1; }, (s) => { s.area.height -= 1; },
    (s) => { s.resolutionX = 600; }, (s) => { s.duplex = "TwoSidedLongEdge"; },
    (s) => { s.printerName = "another printer"; },
  ]) {
    const changed = snapshot(); mutate(changed);
    await assert.rejects(preparePrinterPdf(configuration(), job, { ...probes(), probeImageableArea: async () => changed }));
  }
});

test("rear cache is deterministic, repairs damaged derived bytes and separates measured profiles", async (t) => {
  const { job, bytes, directory } = await fixture(t);
  const first = await preparePrinterPdf(configuration(), job, probes()), firstBytes = await readFile(first.file);
  await writeFile(first.file, "damaged derived file");
  const second = await preparePrinterPdf(configuration(), job, probes());
  assert.equal(first.file, second.file);
  assert.deepEqual(await readFile(second.file), firstBytes);
  assert.deepEqual(first.placement, second.placement);
  const config = configuration();
  config.backs.pagePlacement.expectedImageableArea.width -= 1;
  const third = await preparePrinterPdf(config, job, { ...probes(), probeImageableArea: async () => ({ ...snapshot(), area: config.backs.pagePlacement.expectedImageableArea }) });
  assert.notEqual(third.file, first.file);
  assert.notEqual(third.placement.profileSha256, first.placement.profileSha256);
  assert.deepEqual(await readFile(job.file), bytes);
  assert.equal((await readdir(path.join(directory, "printer-ready"))).length, 4);
});

test("Canon keeps literal Letter, Epson keeps numeric Letter, and ticket paths remain untouched", async () => {
  const config = configuration(), file = path.resolve("page.pdf");
  assert.equal(printerArguments(config, { side: "backs", file })[3], config.backs.printSettings);
  const ticket = { side: "ticket", file: "not-read.pdf" };
  assert.equal(await preparePrinterPdf(config, ticket, { probe: () => assert.fail(), probeImageableArea: () => assert.fail() }), ticket);
  assert.equal(printerArguments(config, { side: "ticket", file })[3], config.ticket.printSettings);
  config.fronts = {
    printerName: "Epson", printSettings: "noscale,simplex,color,paper=letter",
    pagePlacement: { mode: "fill-driver-page", expectedDevice: {
      rasterDpiX: 720, rasterDpiY: 720, physicalWidth: 6284, physicalHeight: 8020,
      offsetX: 0, offsetY: 0, printableWidth: 6284, printableHeight: 8020,
    } },
  };
  assert.equal(printerArguments(config, { side: "fronts", file })[3], "noscale,simplex,color,paperkind=1");
  delete config.backs.pagePlacement;
  const unchanged = { side: "backs", file: "not-read.pdf" };
  assert.equal(await preparePrinterPdf(config, unchanged, { probe: () => assert.fail(), probeImageableArea: () => assert.fail() }), unchanged);
});