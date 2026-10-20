import { readFile, mkdir, rename, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { PDFDocument, PDFName, PDFNumber } from "pdf-lib";
import { readPrinterCapabilities } from "./printer-capabilities.mjs";

const MODE = "fill-driver-page";
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
  const route = config?.[job?.side];
  const placement = route?.pagePlacement;
  if (placement === undefined) return null;
  if (job.side !== "fronts")
    throw new Error("Driver-page placement is supported only for Epson fronts.");
  if (!exactKeys(placement, ["mode", "expectedDevice"]) || placement.mode !== MODE)
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
export async function preparePrinterPdf(config, job, { probe = readPrinterCapabilities } = {}) {
  const placement = validatePrinterPlacement(config, job);
  if (!placement) return job;
  if (typeof probe !== "function") throw new Error("A printer capabilities probe is required.");
  const route = config[job.side];
  const actual = await probe(route.printerName);
  verifyDevice(actual, placement.expectedDevice);

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
  };
  const profileSha256 = sha256(JSON.stringify(profile));
  const cacheKey = sha256(JSON.stringify({ sourceSha256, profileSha256 }));
  const widthPoints = device.physicalWidth * 72 / device.rasterDpiX;
  const heightPoints = device.physicalHeight * 72 / device.rasterDpiY;
  const scale = Math.max(widthPoints / 612, heightPoints / 792);
  const offsetXPoints = (widthPoints - 612 * scale) / 2;
  const offsetYPoints = (heightPoints - 792 * scale) / 2;

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
  page.drawPage(embedded, {
    x: offsetXPoints,
    y: offsetYPoints,
    xScale: scale,
    yScale: scale,
  });
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