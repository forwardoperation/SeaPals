import { readFile, mkdir, rename, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { PDFDocument, PDFName, PDFNumber, pushGraphicsState, popGraphicsState, rectangle, clip, endPath } from "pdf-lib";
import { readPrinterCapabilities } from "./printer-capabilities.mjs";
import { readPrinterImageableArea, validatedPrinterImageableArea, validateImageableArea, IMAGEABLE_AREA_TOLERANCE } from "./printer-imageable-area.mjs";

const MODE = "fill-driver-page";
const IMAGEABLE_MODE = "fill-imageable-area";
const PROFILE_VERSION = 1;
const DEVICE_FIELDS = [
  "rasterDpiX", "rasterDpiY", "physicalWidth", "physicalHeight",
  "offsetX", "offsetY", "printableWidth", "printableHeight",
];
const REQUIRED_SETTINGS = ["noscale", "simplex", "color", "paper=letter"];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const plainObject = (value) => value !== null && typeof value === "object" &&
  !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exactKeys = (value, keys) => plainObject(value) &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));

/** Validate the opt-in transport profile without reading files or touching a printer. */
export function validatePrinterPlacement(config, job) {
  if (job?.kind === "flyer" && job.side !== "fronts")
    throw new Error("Flyers print only on the Epson front route.");
  const route = config?.[job?.side];
  const placement = route?.pagePlacement;
  if (placement === undefined) {
    if (job?.kind === "flyer") throw new Error("Flyers require a verified Epson Letter placement profile.");
    return null;
  }
  const imageable = placement?.mode === IMAGEABLE_MODE;
  if (imageable && job.side !== "backs")
    throw new Error("Imageable-area placement is supported only for rear pages.");
  if (!imageable && job.side !== "fronts")
    throw new Error("Driver-page placement is supported only for Epson fronts.");
  if (!exactKeys(placement, imageable ? ["mode", "expectedDevice", "expectedImageableArea"] : ["mode", "expectedDevice"]) ||
      ![MODE, IMAGEABLE_MODE].includes(placement.mode))
    throw new Error("Configure a supported fill-driver-page placement profile.");
  if (typeof route.printerName !== "string" || !route.printerName.trim() ||
      route.printerName !== route.printerName.trim() || /[\r\n\0]/.test(route.printerName))
    throw new Error("Configure a valid printer name for driver-page placement.");
  const settings = typeof route.printSettings === "string" ? route.printSettings.split(",") : [];
  if (settings.length !== REQUIRED_SETTINGS.length ||
      !REQUIRED_SETTINGS.every((setting) => settings.includes(setting)))
    throw new Error("Driver-page placement requires exactly noscale,simplex,color,paper=letter; tray overrides are not supported.");
  const device = placement.expectedDevice;
  if (!exactKeys(device, DEVICE_FIELDS) ||
      DEVICE_FIELDS.some((field) => !Number.isSafeInteger(device[field])) ||
      DEVICE_FIELDS.filter((field) => !field.startsWith("offset")).some((field) => device[field] <= 0) ||
      device.rasterDpiX !== device.rasterDpiY ||
      device.physicalWidth >= device.physicalHeight ||
      device.offsetX !== 0 || device.offsetY !== 0 ||
      device.printableWidth !== device.physicalWidth ||
      device.printableHeight !== device.physicalHeight)
    throw new Error("Driver-page placement requires a complete portrait borderless device profile with equal X/Y resolution.");
  if (typeof job.file !== "string" || !path.isAbsolute(job.file))
    throw new Error("Print file must be absolute.");
  if (imageable) {
    if (Math.abs(device.physicalWidth * 72 / device.rasterDpiX - 612) > 0.001 ||
        Math.abs(device.physicalHeight * 72 / device.rasterDpiY - 792) > 0.001)
      throw new Error("Imageable-area placement requires GDI to expose the complete physical Letter page without offsets.");
    return { mode: IMAGEABLE_MODE, expectedDevice: { ...device },
      expectedImageableArea: validateImageableArea(placement.expectedImageableArea) };
  }
  if (job.kind === "flyer" && (device.physicalWidth * 72 / device.rasterDpiX < 612 ||
      device.physicalHeight * 72 / device.rasterDpiY < 792))
    throw new Error("Flyers require a complete physical Letter canvas.");
  return { mode: MODE, expectedDevice: { ...device } };
}

function verifyDevice(actual, expected) {
  if (actual?.paperSize !== 1 || actual?.orientation !== 1)
    throw new Error("Epson driver-page placement requires the current printer to use portrait Letter paper.");
  const mismatch = DEVICE_FIELDS.find((field) => actual[field] !== expected[field]);
  if (mismatch)
    throw new Error(`Epson printer capabilities changed (${mismatch}); review the driver-page placement profile before printing.`);
}

function verifySourcePage(document) {
  if (document.getPageCount() !== 1)
    throw new Error("Driver-page placement requires a single-page Letter PDF.");
  const page = document.getPage(0);
  for (const box of [page.getMediaBox(), page.getCropBox()]) {
    if (Math.abs(box.x) > 0.001 || Math.abs(box.y) > 0.001 ||
        Math.abs(box.width - 612) > 0.001 || Math.abs(box.height - 792) > 0.001)
      throw new Error("Driver-page placement requires an unmodified portrait Letter PDF (612 by 792 points).");
  }
  if (page.getRotation().angle % 360 !== 0)
    throw new Error("Driver-page placement does not accept rotated PDF pages.");
  const userUnit = page.node.get(PDFName.of("UserUnit"));
  if (userUnit && (!(userUnit instanceof PDFNumber) || userUnit.asNumber() !== 1))
    throw new Error("Driver-page placement requires standard PDF point units.");
  return page;
}

/**
 * Preserve the canonical PDF and place its whole page on the driver's borderless
 * canvas. The original page is uniformly scaled to cover that canvas and centered.
 * Sumatra must still use noscale, so it does not apply a second layout operation.
 */
export async function preparePrinterPdf(config, job, {
  probe = readPrinterCapabilities, probeImageableArea = readPrinterImageableArea,
} = {}) {
  const placement = validatePrinterPlacement(config, job);
  if (!placement) return job;
  if (typeof probe !== "function") throw new Error("A printer capabilities probe is required.");
  const route = config[job.side];
  const actual = await probe(route.printerName);
  const imageable = placement.mode === IMAGEABLE_MODE, flyer = job.kind === "flyer";
  if (imageable) {
    if (actual?.paperSize !== 1 || actual?.orientation !== 1)
      throw new Error("Rear imageable-area placement requires the current printer to use portrait Letter paper.");
    const mismatch = DEVICE_FIELDS.find((field) => actual[field] !== placement.expectedDevice[field]);
    if (mismatch) throw new Error("Rear printer capabilities changed (" + mismatch + "); review the imageable-area profile before printing.");
  } else verifyDevice(actual, placement.expectedDevice);
  let imageableSnapshot;
  if (imageable) {
    if (typeof probeImageableArea !== "function") throw new Error("An imageable-area probe is required.");
    imageableSnapshot = validatedPrinterImageableArea(await probeImageableArea(route.printerName), route.printerName);
    if (imageableSnapshot.resolutionX !== actual.rasterDpiX || imageableSnapshot.resolutionY !== actual.rasterDpiY)
      throw new Error("The WPF ticket resolution does not match the pinned GDI printer profile.");
    const mismatch = Object.keys(placement.expectedImageableArea).find((field) => field !== "unit" &&
      Math.abs(imageableSnapshot.area[field] - placement.expectedImageableArea[field]) > IMAGEABLE_AREA_TOLERANCE);
    if (mismatch) throw new Error("Rear imageable area changed (" + mismatch + "); review the placement profile before printing.");
  }

  const sourceBytes = await readFile(job.file);
  const source = await PDFDocument.load(sourceBytes, { updateMetadata: false });
  verifySourcePage(source);
  const sourceSha256 = sha256(sourceBytes);
  const device = placement.expectedDevice;
  const profile = {
    version: PROFILE_VERSION,
    mode: placement.mode,
    printerName: route.printerName,
    printSettings: REQUIRED_SETTINGS,
    expectedDevice: Object.fromEntries(DEVICE_FIELDS.map((field) => [field, device[field]])),
    ...(imageable ? { expectedImageableArea: placement.expectedImageableArea } : {}),
    ...(flyer ? { contentPlacement: "flyer-fit-physical-letter-v1", insetPoints: 18 } : {}),
  };
  const profileSha256 = sha256(JSON.stringify(profile));
  const cacheKey = sha256(JSON.stringify({ sourceSha256, profileSha256 }));
  const widthPoints = imageable ? 612 : device.physicalWidth * 72 / device.rasterDpiX;
  const heightPoints = imageable ? 792 : device.physicalHeight * 72 / device.rasterDpiY;
  const area = placement.expectedImageableArea;
  // Convert WPF's top-left dip96 coordinates to PDF's bottom-left point units.
  // GDI must expose the whole Letter page, so Sumatra noscale adds no second offset.
  // Flyer artwork fits inside physical Letter with a quarter-inch margin. The
  // cutter transform deliberately fills the larger borderless driver canvas;
  // using that transform for a flyer could trim text near its exported edges.
  const clipRectangle = flyer ? { x: 18, y: 18, width: 576, height: 756 } : imageable ? {
    x: area.originX * 72 / 96,
    y: 792 - (area.originY + area.height) * 72 / 96,
    width: area.width * 72 / 96,
    height: area.height * 72 / 96,
  } : null;
  const scale = (flyer ? Math.min : Math.max)((clipRectangle?.width ?? widthPoints) / 612, (clipRectangle?.height ?? heightPoints) / 792);
  const offsetXPoints = clipRectangle ? clipRectangle.x + (clipRectangle.width - 612 * scale) / 2 : (widthPoints - 612 * scale) / 2;
  const offsetYPoints = clipRectangle ? clipRectangle.y + (clipRectangle.height - 792 * scale) / 2 : (heightPoints - 792 * scale) / 2;

  const output = await PDFDocument.create();
  // Stable metadata permits verification of an existing cache entry against the
  // freshly derived PDF, rather than trusting its name or a sidecar checksum.
  output.setCreationDate(new Date(0));
  output.setModificationDate(new Date(0));
  output.setProducer("Sea Realm printer placement");
  output.setCreator("Sea Realm manufacturing");
  const [embedded] = await output.embedPdf(source, [0]);
  const page = output.addPage([widthPoints, heightPoints]);
  page.setCropBox(0, 0, widthPoints, heightPoints);
  if (clipRectangle) page.pushOperators(pushGraphicsState(), rectangle(clipRectangle.x, clipRectangle.y, clipRectangle.width, clipRectangle.height), clip(), endPath());
  page.drawPage(embedded, {
    x: offsetXPoints,
    y: offsetYPoints,
    xScale: scale,
    yScale: scale,
  });
  if (clipRectangle) page.pushOperators(popGraphicsState());
  const outputBytes = Buffer.from(await output.save());
  const outputSha256 = sha256(outputBytes);
  const outputDirectory = path.join(path.dirname(job.file), "printer-ready");
  const outputFile = path.join(outputDirectory, `${cacheKey}.pdf`);
  const metadata = {
    mode: placement.mode,
    sourceFile: job.file,
    sourceSha256,
    profileSha256,
    outputSha256,
    expectedDevice: { ...device },
    widthPoints,
    heightPoints,
    scale,
    offsetXPoints,
    offsetYPoints,
    ...(imageable ? { expectedImageableArea: placement.expectedImageableArea, imageableSnapshot, clipRectangle } : {}),
    ...(flyer ? { contentPlacement: "flyer-fit-physical-letter-v1", clipRectangle } : {}),
  };
  const metadataFile = path.join(outputDirectory, `${cacheKey}.placement.json`);
  await writeVerifiedArtifact(outputFile, outputBytes);
  // Persist an audit of the derived transport page without copying job credentials.
  await writeVerifiedArtifact(metadataFile, Buffer.from(JSON.stringify({
    ...metadata,
    profile,
  }, null, 2) + "\n"));
  return { ...job, file: outputFile, placement: { ...metadata, metadataFile } };
}

async function writeVerifiedArtifact(file, bytes) {
  try {
    if ((await readFile(file)).equals(bytes)) return;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, bytes, { flag: "wx" });
    await rename(temporary, file);
  } finally {
    await unlink(temporary).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
}