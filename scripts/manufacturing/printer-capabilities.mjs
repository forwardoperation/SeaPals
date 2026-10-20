import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const executeFile = promisify(execFile);
const probePath = fileURLToPath(new URL("./read-printer-capabilities.ps1", import.meta.url));
const positiveFields = [
  "rasterDpiX", "rasterDpiY", "physicalWidth", "physicalHeight",
  "printableWidth", "printableHeight",
];

/** Read the current user's normalized Letter/portrait driver geometry without printing. */
export async function readPrinterCapabilities(printerName) {
  if (typeof printerName !== "string" || !printerName.trim() || /[\0\r\n]/.test(printerName))
    throw new Error("A valid Windows printer name is required.");
  const { stdout } = await executeFile("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-File", probePath, "-PrinterName", printerName,
  ], {
    shell: false,
    windowsHide: true,
    timeout: 20_000,
    maxBuffer: 64 * 1024,
    encoding: "utf8",
  });
  let capabilities;
  try {
    capabilities = JSON.parse(stdout.replace(/^\uFEFF/, "").trim());
  } catch {
    throw new Error("The printer capability probe returned invalid JSON.");
  }
  if (!capabilities || Array.isArray(capabilities) ||
      capabilities.paperSize !== 1 || capabilities.orientation !== 1 ||
      positiveFields.some((key) => !Number.isSafeInteger(capabilities[key]) || capabilities[key] <= 0) ||
      ["offsetX", "offsetY"].some((key) => !Number.isSafeInteger(capabilities[key]) || capabilities[key] < 0) ||
      capabilities.physicalWidth >= capabilities.physicalHeight ||
      capabilities.offsetX + capabilities.printableWidth > capabilities.physicalWidth ||
      capabilities.offsetY + capabilities.printableHeight > capabilities.physicalHeight)
    throw new Error("The printer did not report valid portrait Letter capabilities.");
  return Object.fromEntries([
    "paperSize", "orientation", ...positiveFields, "offsetX", "offsetY",
  ].map((key) => [key, capabilities[key]]));
}
