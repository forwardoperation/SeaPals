import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  PDFArray,
  PDFDocument,
  PDFName,
  PDFRawStream,
  decodePDFRawStream,
} from "pdf-lib";
import { PNG } from "pngjs";
import { BOOSTER_POLICY, contentHash } from "./boosters.mjs";
import { sha256 } from "./integration.mjs";
import { renderJob } from "../../../scripts/manufacturing/render.mjs";

// Independent measurements from the two Figma cutter templates. These also
// protect saved v1 manifests when the default layout changes in the future.
const CARD_WIDTH = 738.59521484375,
  CARD_HEIGHT = 1034.0333251953125,
  FRONT_X = [164.702392578125, 944.702392578125, 1724.702392578125],
  FRONT_Y = [61.316650390625, 1117.9832763671875, 2174.64990234375],
  BACK_X = [85.702392578125, 865.702392578125, 1645.702392578125],
  BACK_Y = [79.316650390625, 1135.9832763671875, 2192.64990234375],
  positions = (xs, ys, width = CARD_WIDTH, height = CARD_HEIGHT) =>
    ys.flatMap((y) => xs.map((x) => ({ x, y, width, height }))),
  fronts = positions(FRONT_X, FRONT_Y),
  backs = positions(BACK_X, BACK_Y),
  sources = positions([195, 918.333, 1641.667], [138, 1146, 2154], 720, 1008),
  colors = Array.from({ length: 9 }, (_, i) => [35 + 20 * i, 180 - 12 * i, 75 + 15 * i]);
const backgroundBounds = { x: 36, y: 20, width: 2467, height: 3240 },
  background = (back = false) => ({
    ...backgroundBounds,
    assetId: `print-template-${back ? "back" : "front"}-background`,
    nodeId: back ? "4116:234589" : "4116:234587",
  }),
  oceanColors = [[18, 111, 161], [11, 72, 118]];

function paint(png, rect, color) {
  const left = Math.round(rect.x), top = Math.round(rect.y),
    right = Math.round(rect.x + rect.width), bottom = Math.round(rect.y + rect.height);
  for (let y = top; y < bottom; y++)
    for (let x = left; x < right; x++) {
      const offset = (y * png.width + x) * 4;
      png.data.set([...color, 255], offset);
    }
}
function blank(width, height) {
  const png = new PNG({ width, height });
  paint(png, { x: 0, y: 0, width, height }, [255, 0, 255]);
  return png;
}
function makeManifest({ legacy = false, fixed = false, sourceAssetId = "sheet-test", ocean = false } = {}) {
  const order = {
    orderId: "10000000-0000-4000-8000-000000000001",
    orderNumber: "CUTTER-TEST",
    items: [{ productId: fixed ? "coral-garden" : "deep-dive-pack", quantity: 1 }],
  },
    layout = legacy
      ? { version: "figma-letter-nine-up-v1", width: 2550, height: 3300, dpi: 300, cardWidth: 720, cardHeight: 1008, left: 195, top: 138, columns: 3, rows: 3 }
      : { version: ocean ? "figma-cutter-nine-up-v3" : "figma-cutter-nine-up-v2", width: 2550, height: 3300, dpi: 300, cardWidth: CARD_WIDTH, cardHeight: CARD_HEIGHT, positions: fronts, columns: 3, rows: 3, ...(ocean ? { background: background() } : {}) },
    body = {
      schemaVersion: 1,
      order,
      requestHash: contentHash(order),
      artworkRelease: "cutter-render-test",
      policy: BOOSTER_POLICY,
      layout,
      packs: [],
      holoChecklist: [],
      accessoryChecklist: [],
      sheets: [{
        sheetId: "CUTTER-TEST-001",
        ...(fixed ? { productId: "coral-garden" } : { set: "deep" }),
        fronts: fixed ? { assetId: sourceAssetId } : { assetIds: colors.map((_, i) => `deep-${i + 1}`) },
        backs: { assetId: "standard-back-sheet", template: legacy
          ? { contentScale: 0.96, translateX: 51, translateY: 66 }
          : { positions: backs, ...(ocean ? { background: background(true) } : {}) } },
        slots: fixed ? [] : (legacy ? sources : fronts).map((p, i) => ({ ...p, printingId: `deep-${i + 1}`, slot: i + 1 })),
      }],
    };
  return { ...body, manifestHash: contentHash(body) };
}
async function fixture(dir, options = {}) {
  const manifest = makeManifest(options), assets = {}, assetFiles = {};
  async function asset(id, png, extra = {}) {
    const bytes = PNG.sync.write(png);
    assetFiles[id] = path.join(dir, `${id}.png`);
    await writeFile(assetFiles[id], bytes);
    assets[id] = { path: `manufacturing/sha256/${sha256(bytes)}.png`, sha256: sha256(bytes), width: png.width, height: png.height, ...extra };
  }
  const rear = blank(2550, 3300);
  paint(rear, { x: 150, y: 75, width: 750, height: 1050 }, [12, 82, 122]);
  // Different left/right edges reveal any unintended artwork reflection.
  paint(rear, { x: 150, y: 75, width: 1, height: 1050 }, [250, 20, 30]);
  paint(rear, { x: 899, y: 75, width: 1, height: 1050 }, [20, 30, 250]);
  await asset("standard-back-sheet", rear);
  if (options.ocean) {
    for (const [index, back] of [false, true].entries()) {
      const source = background(back), png = blank(source.width, source.height);
      paint(png, { x: 0, y: 0, width: png.width, height: png.height }, oceanColors[index]);
      await asset(source.assetId, png, { nodeId: source.nodeId });
    }
  }
  if (options.fixed) {
    const front = blank(2550, 3300), sourcePositions = options.sourcePositions ?? sources;
    for (const [i, rect] of sourcePositions.entries()) paint(front, rect, colors[i]);
    // Figma layer order need not match the sheet's visual reading order.
    await asset(options.sourceAssetId ?? "sheet-test", front, { positions: options.legacy ? sourcePositions : sourcePositions.toReversed() });
  } else {
    for (const [i, color] of colors.entries()) {
      const front = blank(750, 1050);
      paint(front, { x: 0, y: 0, width: 750, height: 1050 }, color);
      await asset(`deep-${i + 1}`, front);
    }
  }
  const printTemplates = options.ocean ? {
    version: "figma-cutter-nine-up-v3",
    fronts: { ...manifest.layout, fileKey: "xeol2YE0jCE0N5vAD6tjzx", nodeId: "4099:61637", name: "print-test-die-cut-front-epson" },
    backs: { ...manifest.sheets[0].backs.template, fileKey: "xeol2YE0jCE0N5vAD6tjzx", nodeId: "4099:61666", name: "print-test-die-cut-rear-canon", width: 2550, height: 3300 },
  } : undefined;
  return { manifest, release: { releaseId: manifest.artworkRelease, assets, ...(printTemplates ? { printTemplates } : {}) }, assetFiles, outputDir: dir, siteOrigin: "https://searealm.com" };
}
async function inspect(file) {
  const pdf = await PDFDocument.load(await readFile(file));
  assert.equal(pdf.getPageCount(), 1);
  const page = pdf.getPage(0);
  assert.deepEqual(page.getSize(), { width: 612, height: 792 });
  const raw = page.node.lookup(PDFName.of("Contents")),
    streams = raw instanceof PDFArray ? raw.asArray() : [raw],
    content = streams.map((ref) => Buffer.from(decodePDFRawStream(pdf.context.lookup(ref, PDFRawStream)).decode()).toString()).join("\n"),
    xobjects = page.node.Resources().lookup(PDFName.of("XObject"));
  const refs = [...new Map(xobjects.entries().map(([, ref]) => [ref.toString(), ref])).values()];
  return { content, images: refs.map((ref) => {
    const stream = pdf.context.lookup(ref, PDFRawStream);
    return {
      width: stream.dict.lookup(PDFName.of("Width")).asNumber(),
      height: stream.dict.lookup(PDFName.of("Height")).asNumber(),
      pixels: decodePDFRawStream(stream).decode(),
    };
  }) };
}
function imagePlacements(content) {
  return [...content.matchAll(/1 0 0 1 ([\d.-]+) ([\d.-]+) cm\s+1 0 0 1 0 0 cm\s+([\d.-]+) 0 0 ([\d.-]+) 0 0 cm\s+1 0 0 1 0 0 cm\s+\/\S+ Do/g)]
    .map((m) => ({ x: Number(m[1]), y: Number(m[2]), width: Number(m[3]), height: Number(m[4]) }));
}
function assertPlacements(content, expected) {
  const actual = imagePlacements(content);
  assert.equal(actual.length, expected.length);
  expected.forEach((p, i) => {
    const point = { x: p.x * 0.24, y: 792 - (p.y + p.height) * 0.24, width: p.width * 0.24, height: p.height * 0.24 };
    for (const key of Object.keys(point)) assert.ok(Math.abs(actual[i][key] - point[key]) < 0.000001, `slot ${i + 1} ${key}`);
  });
}
async function temporary(action) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "searealm-cutter-render-"));
  try { return await action(dir); }
  finally {
    assert.ok(path.resolve(dir).startsWith(path.join(os.tmpdir(), "searealm-cutter-render-")));
    await rm(dir, { recursive: true, force: true });
  }
}

test("cutter booster PDFs use exact front/rear geometry without labels or reflection", () => temporary(async (dir) => {
  const args = await fixture(dir), jobs = await renderJob(args),
    front = await inspect(jobs.find((j) => j.side === "fronts").file),
    rear = await inspect(jobs.find((j) => j.side === "backs").file);
  assertPlacements(front.content, fronts);
  assertPlacements(rear.content, backs);
  assert.doesNotMatch(front.content + rear.content, /\b(?:BT|Tj|TJ)\b/);
  assert.equal(front.images.length, 9);
  front.images.forEach((image, i) => assert.deepEqual([...image.pixels.slice(0, 3)], colors[i]));
  assert.equal(rear.images.length, 1);
  const image = rear.images[0];
  assert.equal(image.width, 750);
  assert.equal(image.height, 1050);
  assert.deepEqual([...image.pixels.slice(0, 3)], [250, 20, 30]);
  assert.deepEqual([...image.pixels.slice(3, 6)], [12, 82, 122]);
  assert.deepEqual([...image.pixels.slice(749 * 3, 750 * 3)], [20, 30, 250]);
}));

test("v3 fronts and backs paint their own ocean first, retaining card offsets and unprinted outer margins", () => temporary(async (dir) => {
  const jobs = await renderJob(await fixture(dir, { ocean: true }));
  for (const [index, side] of ["fronts", "backs"].entries()) {
    const page = await inspect(jobs.find((job) => job.side === side).file);
    assertPlacements(page.content, [backgroundBounds, ...(side === "fronts" ? fronts : backs)]);
    // Resource pixels prove each page uses its own private backdrop; content
    // ordering proves the opaque card artwork sits on top of it.
    assert.equal(page.images[0].width, 2467);
    assert.equal(page.images[0].height, 3240);
    assert.deepEqual([...page.images[0].pixels.slice(0, 3)], oceanColors[index]);
    assert.deepEqual([...page.images[0].pixels.slice(-3)], oceanColors[index]);
    assert.equal(page.images.length, side === "fronts" ? 10 : 2);
    assert.doesNotMatch(page.content, /\b(?:BT|Tj|TJ|re|S|f)\b/, "No labels, guide strokes, or full-page fill may cover the ocean or margins");
    // All painted images stay inside the measured frame. Letter's untouched
    // edges therefore stay white: 36/47 px left/right and 20/40 px top/bottom.
    for (const placed of imagePlacements(page.content)) {
      assert.ok(placed.x >= 36 * 0.24 - 1e-6);
      assert.ok(placed.x + placed.width <= (2550 - 47) * 0.24 + 1e-6);
      assert.ok(placed.y >= 40 * 0.24 - 1e-6);
      assert.ok(placed.y + placed.height <= (3300 - 20) * 0.24 + 1e-6);
    }
  }
}));

test("the unused ninth slot of a v3 eight-card sheet shows ocean, with no placeholder or extra card", () => temporary(async (dir) => {
  const jobs = await renderJob(await fixture(dir, {
    ocean: true,
    fixed: true,
    sourceAssetId: "sheet-murky-water-7",
    sourcePositions: positions([167, 887, 1607], [106, 1114, 2122], 720, 1008).slice(0, 8),
  }));
  const page = await inspect(jobs.find((job) => job.side === "fronts").file);
  assertPlacements(page.content, [backgroundBounds, ...fronts.slice(0, 8)]);
  assert.equal(page.images.length, 9);
  assert.deepEqual([...page.images[0].pixels.slice(0, 3)], oceanColors[0]);
  page.images.slice(1).forEach((image, index) => assert.deepEqual([...image.pixels.slice(0, 3)], colors[index]));
  const empty = fronts[8], sample = { x: empty.x + empty.width / 2, y: empty.y + empty.height / 2 };
  assert.ok(sample.x > backgroundBounds.x && sample.x < backgroundBounds.x + backgroundBounds.width);
  assert.ok(sample.y > backgroundBounds.y && sample.y < backgroundBounds.y + backgroundBounds.height);
  assert.ok(fronts.slice(0, 8).every((p) => sample.x < p.x || sample.x > p.x + p.width || sample.y < p.y || sample.y > p.y + p.height));
  assert.doesNotMatch(page.content, /\b(?:BT|Tj|TJ|re|S|f)\b/);
}));

test("missing, corrupt or wrong-sized v3 background art stops before any PDF is written", () => temporary(async (dir) => {
  const base = await fixture(dir, { ocean: true }), id = "print-template-back-background";
  const cases = [
    ["missing", (release) => { delete release.assets[id]; }, null, /background|backdrop/i],
    ["wrong-size", (release) => { release.assets[id].width -= 1; }, null, /background|backdrop|dimensions/i],
    ["wrong-source", (release) => { release.assets[id].nodeId = "4116:234587"; }, null, /background|backdrop/i],
    ["tampered", () => {}, Buffer.from("not the pinned PNG"), /checksum/i],
    ["corrupt", (release) => { release.assets[id].sha256 = sha256(Buffer.from("not a PNG")); }, Buffer.from("not a PNG"), /PNG|buffer|stream|signature/i],
  ];
  for (const [name, mutate, bytes, message] of cases) {
    const release = structuredClone(base.release), assetFiles = { ...base.assetFiles }, outputDir = path.join(dir, `output-${name}`);
    mutate(release);
    if (bytes) {
      assetFiles[id] = path.join(dir, `${name}.png`);
      await writeFile(assetFiles[id], bytes);
      if (name === "corrupt") release.assets[id].path = `manufacturing/sha256/${release.assets[id].sha256}.png`;
    }
    await assert.rejects(renderJob({ ...base, release, assetFiles, outputDir }), message, name);
    assert.deepEqual(await readdir(outputDir).catch((error) => error.code === "ENOENT" ? [] : Promise.reject(error)), [], name);
  }
}));

test("cutter fixed sheets crop each saved card and impose it in template order", () => temporary(async (dir) => {
  const jobs = await renderJob(await fixture(dir, { fixed: true })),
    front = await inspect(jobs.find((j) => j.side === "fronts").file),
    rear = await inspect(jobs.find((j) => j.side === "backs").file);
  assertPlacements(front.content, fronts);
  assertPlacements(rear.content, backs);
  assert.equal(front.images.length, 9);
  front.images.forEach((image, i) => {
    assert.equal(image.width, 720);
    assert.equal(image.height, 1008);
    assert.deepEqual([...image.pixels.slice(0, 3)], colors[i]);
    assert.deepEqual([...image.pixels.slice(-3)], colors[i]);
  });
}));

test("mixed Blue Water source sizes keep exact crops and unchanged cutter placement", () => temporary(async (dir) => {
  // Measured from Blue Water 1, Figma node 2224:257783, pinned version
  // 2409981651040810260. Its two smaller Robotic Survey cards share the
  // bottom row with a normal card; their top edges are aligned.
  const measuredSources = positions([167, 887, 1607], [106, 1114, 2122], 720, 1008)
    .map((position, index) => index >= 7 ? { ...position, width: 705, height: 987 } : position);
  const jobs = await renderJob(await fixture(dir, { fixed: true, sourcePositions: measuredSources })),
    front = await inspect(jobs.find((j) => j.side === "fronts").file),
    rear = await inspect(jobs.find((j) => j.side === "backs").file);

  assertPlacements(front.content, fronts);
  assertPlacements(rear.content, backs);
  assert.equal(front.images.length, 9);
  front.images.forEach((image, index) => {
    const expected = measuredSources[index];
    assert.equal(image.width, expected.width);
    assert.equal(image.height, expected.height);
    // Distinct colors prove visual ordering. All four corners must remain
    // inside the saved crop, without the magenta sheet background bleeding in.
    const corners = [0, image.width - 1, (image.height - 1) * image.width, image.height * image.width - 1];
    for (const corner of corners)
      assert.deepEqual([...image.pixels.slice(corner * 3, corner * 3 + 3)], colors[index]);
  });
}));

test("an approved eight-card final sheet leaves the ninth front empty and keeps nine backs", () => temporary(async (dir) => {
  // Murky Water 7, node 2241:485700, has these eight measured source crops
  // at pinned Figma version 2409981651040810260; bottom-right is empty.
  const measuredSources = positions([167, 887, 1607], [106, 1114, 2122], 720, 1008).slice(0, 8);
  const jobs = await renderJob(await fixture(dir, {
    fixed: true,
    sourceAssetId: "sheet-murky-water-7",
    sourcePositions: measuredSources,
  })),
    front = await inspect(jobs.find((j) => j.side === "fronts").file),
    rear = await inspect(jobs.find((j) => j.side === "backs").file);

  assertPlacements(front.content, fronts.slice(0, 8));
  assertPlacements(rear.content, backs);
  assert.equal(front.images.length, 8);
  front.images.forEach((image, index) => {
    assert.equal(image.width, 720);
    assert.equal(image.height, 1008);
    assert.deepEqual([...image.pixels.slice(0, 3)], colors[index]);
    assert.deepEqual([...image.pixels.slice(-3)], colors[index]);
  });
  assert.equal(rear.images.length, 1);
}));

test("rendering rejects unknown eight-card sheets and wrong counts on approved final sheets", () => temporary(async (dir) => {
  const base = await fixture(dir, { fixed: true });
  const cases = [
    { sourceAssetId: "sheet-unapproved-final", count: 8 },
    ...["sheet-murky-water-7", "sheet-stinging-fortress-7", "sheet-disruption-7"]
      .flatMap((sourceAssetId) => [7, 9].map((count) => ({ sourceAssetId, count }))),
  ];
  for (const { sourceAssetId, count } of cases) {
    await assert.rejects(renderJob({
      ...base,
      manifest: makeManifest({ fixed: true, sourceAssetId }),
      release: {
        ...base.release,
        assets: {
          ...base.release.assets,
          [sourceAssetId]: { ...base.release.assets["sheet-test"], positions: sources.slice(0, count) },
        },
      },
      assetFiles: { ...base.assetFiles, [sourceAssetId]: base.assetFiles["sheet-test"] },
    }), /valid source card positions/, `${sourceAssetId} must reject ${count} sources`);
  }
}));

test("saved v1 boosters keep their original back scaling and margin labels", () => temporary(async (dir) => {
  const args = await fixture(dir, { legacy: true }), jobs = await renderJob(args),
    front = await inspect(jobs.find((j) => j.side === "fronts").file),
    rear = await inspect(jobs.find((j) => j.side === "backs").file);
  assertPlacements(front.content, sources);
  assertPlacements(rear.content, [{ x: 51, y: 66, width: 2550 * 0.96, height: 3300 * 0.96 }]);
  assert.match(front.content, /\bBT\b/);
  assert.match(rear.content, /\bBT\b/);
  assert.equal(rear.images[0].width, 2550);
}));

test("saved v1 fixed sheets retain full-page fronts and reflected source positions", () => temporary(async (dir) => {
  const jobs = await renderJob(await fixture(dir, { legacy: true, fixed: true })),
    front = await inspect(jobs.find((j) => j.side === "fronts").file),
    rear = await inspect(jobs.find((j) => j.side === "backs").file);
  assert.equal(front.images.length, 1);
  assert.equal(front.images[0].width, 2550);
  assertPlacements(front.content, [{ x: 0, y: 0, width: 2550, height: 3300 }]);
  assertPlacements(rear.content, sources.map((p) => ({ ...p, x: 2550 - p.x - p.width })));
}));
