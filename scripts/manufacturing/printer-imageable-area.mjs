import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const executeFile = promisify(execFile);
const probePath = fileURLToPath(new URL("./read-printer-imageable-area.ps1", import.meta.url));
const AREA_FIELDS = ["pageWidth", "pageHeight", "originX", "originY", "width", "height"];
export const IMAGEABLE_AREA_TOLERANCE = 0.000001;
const near = (a, b) => Math.abs(a - b) <= IMAGEABLE_AREA_TOLERANCE;

/** WPF coordinates: 1/96-inch units, measured from the physical page's top-left. */
export function validateImageableArea(area) {
  if (!area || typeof area !== "object" || Array.isArray(area) ||
      Object.keys(area).length !== AREA_FIELDS.length + 1 || area.unit !== "dip96" ||
      AREA_FIELDS.some((field) => !Object.hasOwn(area, field) || !Number.isFinite(area[field])) ||
      !near(area.pageWidth, 816) || !near(area.pageHeight, 1056) ||
      area.originX < 0 || area.originY < 0 || area.width <= 0 || area.height <= 0 ||
      area.originX + area.width > area.pageWidth + IMAGEABLE_AREA_TOLERANCE ||
      area.originY + area.height > area.pageHeight + IMAGEABLE_AREA_TOLERANCE)
    throw new Error("Imageable-area placement requires complete portrait Letter bounds in dip96 units.");
  return { unit: "dip96", ...Object.fromEntries(AREA_FIELDS.map((field) => [field, area[field]])) };
}

export function validatedPrinterImageableArea(value, printerName) {
  if (!value || value.printerName !== printerName ||
      value.mediaSize !== "NorthAmericaLetter" || value.orientation !== "Portrait" ||
      value.color !== "Color" || value.duplex !== "OneSided" ||
      !Number.isSafeInteger(value.resolutionX) || value.resolutionX <= 0 ||
      !Number.isSafeInteger(value.resolutionY) || value.resolutionY <= 0)
    throw new Error("The imageable-area probe must report the exact printer's normalized portrait Letter/color/simplex query ticket and resolution.");
  return {
    printerName, mediaSize: value.mediaSize, orientation: value.orientation,
    color: value.color, duplex: value.duplex,
    resolutionX: value.resolutionX, resolutionY: value.resolutionY,
    area: validateImageableArea(value.area),
  };
}

/** Read-only normalized WPF/XPS capabilities; never commits defaults or submits a document. */
export async function readPrinterImageableArea(printerName, { execute = executeFile } = {}) {
  if (typeof printerName !== "string" || !printerName.trim() ||
      printerName !== printerName.trim() || /[\0\r\n]/.test(printerName))
    throw new Error("A valid Windows printer name is required.");
  const { stdout } = await execute("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-File", probePath, "-PrinterName", printerName,
  ], { shell: false, windowsHide: true, timeout: 20_000, maxBuffer: 64 * 1024, encoding: "utf8" });
  let capabilities;
  try { capabilities = JSON.parse(stdout.replace(/^\uFEFF/, "").trim()); }
  catch { throw new Error("The imageable-area probe returned invalid JSON."); }
  return validatedPrinterImageableArea(capabilities, printerName);
}