import { readFile, realpath, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { PDFDocument } from "pdf-lib";
import { printerArguments, submitPdf } from "./agent.mjs";
import { PRIVATE_ROOT, atomicJson } from "./orders.mjs";

const SIDES = ["ticket", "fronts", "backs"];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const isInside = (root, file) => {
  const relative = path.relative(root, file);
  return relative === "" ||
    (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
};

function validateLocalPrintSettings(config, side) {
  const settings = config[side].printSettings.split(",");
  const unique = new Set(settings.map((setting) => setting.toLowerCase()));
  const binSettings = settings.filter((setting) => setting.startsWith("bin="));
  if (
    unique.size !== settings.length ||
    !["noscale", "simplex", "paper=letter"].every((setting) => settings.includes(setting)) ||
    settings.filter((setting) => setting === "color" || setting === "monochrome").length !== 1 ||
    binSettings.length > 1 ||
    settings.some((setting) =>
      !["noscale", "simplex", "paper=letter", "color", "monochrome"].includes(setting) &&
      !/^bin=[A-Za-z0-9][A-Za-z0-9 _().-]{0,79}$/.test(setting))
  ) throw new Error(
    `${side} local test settings must contain only noscale,simplex,paper=letter, one of color or monochrome, and optionally one safe bin= name or index.`,
  );
}

async function privatePath(file, label, root) {
  if (typeof file !== "string" || !isInside(path.resolve(PRIVATE_ROOT), path.resolve(file)))
    throw new Error(`${label} must be inside this workspace's .private/manufacturing directory.`);
  const resolved = await realpath(file);
  if (!isInside(root, resolved))
    throw new Error(`${label} resolves outside this workspace's private manufacturing directory.`);
  return resolved;
}

async function verifyPdf(job) {
  const bytes = await readFile(job.file);
  if (sha256(bytes) !== job.sha256)
    throw new Error(`PDF checksum mismatch for ${job.side}.`);
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  if (pdf.getPageCount() !== 1)
    throw new Error(`${job.side} PDF must contain exactly one page.`);
  const page = pdf.getPage(0);
  for (const box of [page.getMediaBox(), page.getCropBox()]) {
    if (Math.abs(box.width - 612) > 0.01 || Math.abs(box.height - 792) > 0.01)
      throw new Error(`${job.side} PDF must be portrait Letter (612 × 792 points).`);
  }
  if (page.getRotation().angle % 360 !== 0)
    throw new Error(`${job.side} PDF must not have a rotated page.`);
}

// This packet is local printer QA only. It neither claims nor advances a production job.
export async function validateLocalTestPacket({ packetPath, configPath }) {
  const root = await realpath(PRIVATE_ROOT);
  const packetFile = await privatePath(packetPath, "Packet", root);
  const configFile = await privatePath(configPath, "Printer config", root);
  const packetBytes = await readFile(packetFile);
  const configBytes = await readFile(configFile);
  const packet = JSON.parse(packetBytes);
  const config = JSON.parse(configBytes);
  if (
    packet.schemaVersion !== 1 || packet.kind !== "local-printer-test" ||
    typeof packet.label !== "string" || !packet.label.trim() ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(packet.jobId ?? "") ||
    typeof packet.createdAt !== "string" || !Number.isFinite(Date.parse(packet.createdAt))
  ) throw new Error("Invalid local printer test packet identity or schema.");
  if (typeof packet.directory !== "string" || !path.isAbsolute(packet.directory))
    throw new Error("Packet directory must be absolute.");
  const directory = await privatePath(packet.directory, "Packet directory", root);
  if (!(await stat(directory)).isDirectory() || path.dirname(packetFile) !== directory)
    throw new Error("The packet JSON must be stored directly inside its packet directory.");
  if (!Array.isArray(packet.files) || packet.files.length !== 3 ||
      packet.files.some((job, index) => job?.side !== SIDES[index]))
    throw new Error("Packet must contain exactly one ticket, fronts, and backs PDF, in that order.");
  if (config.calibrationConfirmed !== true)
    throw new Error("Confirm the existing Epson and Canon printer profiles before submission.");
  if (typeof config.sumatraPath !== "string" || !path.isAbsolute(config.sumatraPath) ||
      !(await stat(config.sumatraPath)).isFile())
    throw new Error("Configure an existing absolute SumatraPDF executable path.");

  const files = [], seen = new Set();
  for (const job of packet.files) {
    if (typeof job.sheetId !== "string" || !job.sheetId.trim() || job.pages !== 1 ||
        typeof job.file !== "string" || !path.isAbsolute(job.file) ||
        typeof job.sha256 !== "string" || !/^[0-9a-f]{64}$/i.test(job.sha256))
      throw new Error(`Invalid file metadata for ${job.side}.`);
    const file = await privatePath(job.file, `${job.side} PDF`, root);
    if (!isInside(directory, file) || !(await stat(file)).isFile())
      throw new Error(`${job.side} PDF must be a file inside the packet directory.`);
    const identity = process.platform === "win32" ? file.toLowerCase() : file;
    if (seen.has(identity)) throw new Error("Each packet side must use a distinct PDF file.");
    seen.add(identity);
    const normalized = { sheetId: job.sheetId, side: job.side, file, sha256: job.sha256.toLowerCase(), pages: 1 };
    printerArguments(config, normalized);
    validateLocalPrintSettings(config, job.side);
    await verifyPdf(normalized);
    files.push(normalized);
  }
  return {
    packet: { ...packet, directory, files }, config, packetFile, configFile,
    packetSha256: sha256(packetBytes), configSha256: sha256(configBytes),
    receiptPath: path.join(directory, "print-receipt.json"),
  };
}

export async function runLocalPrinterTest({ packetPath, configPath, print = false, submit = submitPdf }) {
  // Complete validation of every file and route before reserving or submitting any page.
  const validated = await validateLocalTestPacket({ packetPath, configPath });
  const { packet, config, receiptPath } = validated;
  const summary = {
    kind: packet.kind, jobId: packet.jobId, label: packet.label,
    status: "validated", printingRequested: print, receiptPath,
    files: packet.files.map((job) => ({ ...job,
      printerName: config[job.side].printerName, printSettings: config[job.side].printSettings,
    })),
  };
  if (!print) return summary;
  if (submit === submitPdf && process.platform !== "win32")
    throw new Error("The physical printer adapter requires Windows.");
  const receipt = {
    schemaVersion: 1, kind: "local-printer-test-receipt", jobId: packet.jobId,
    label: packet.label, createdAt: new Date().toISOString(), status: "reserved",
    packetPath: validated.packetFile, packetSha256: validated.packetSha256,
    configPath: validated.configFile, configSha256: validated.configSha256,
    files: summary.files.map((job) => ({ ...job, status: "pending" })),
  };
  try {
    // Exclusive creation is the duplicate guard; flush intent before any submission.
    await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, {
      flag: "wx", mode: 0o600, flush: true,
    });
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error("A print receipt already exists. Inspect the paper and printer queues; this packet cannot be printed again.");
    throw error;
  }
  for (const job of receipt.files) {
    receipt.status = "submitting";
    job.status = "submitting";
    job.startedAt = new Date().toISOString();
    await atomicJson(receiptPath, receipt);
    try {
      // Catch changes made after the initial all-files preflight, before calling Sumatra.
      await verifyPdf(job);
      await submit(config, job);
    } catch (error) {
      job.status = "uncertain";
      job.error = String(error.message ?? error).slice(0, 1000);
      job.finishedAt = new Date().toISOString();
      receipt.status = "needs_review";
      // If persistence fails, the last durable state is still 'submitting', never retryable.
      await atomicJson(receiptPath, receipt);
      throw new Error(`${job.side} submission is uncertain. Inspect the paper and printer queue before any further action.`, { cause: error });
    }
    job.status = "succeeded";
    job.finishedAt = new Date().toISOString();
    await atomicJson(receiptPath, receipt);
  }
  // 'Succeeded' records adapter acknowledgement, not confirmation of physical output.
  receipt.status = "succeeded";
  receipt.completedAt = new Date().toISOString();
  await atomicJson(receiptPath, receipt);
  return { ...summary, status: "submitted" };
}

async function main() {
  const args = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === "--print" && options.print === undefined) options.print = true;
    else if ((flag === "--packet" || flag === "--config") && !options[flag.slice(2) + "Path"] &&
             args[i + 1] && !args[i + 1].startsWith("--"))
      options[flag.slice(2) + "Path"] = args[++i];
    else throw new Error("Use --packet <private packet.json> --config <private printers.json> [--print].");
  }
  if (!options.packetPath || !options.configPath)
    throw new Error("Use --packet <private packet.json> --config <private printers.json> [--print]. Default: validate only.");
  console.log(JSON.stringify(await runLocalPrinterTest(options), null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
