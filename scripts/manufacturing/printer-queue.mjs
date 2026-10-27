import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const executeFile = promisify(execFile);
const probePath = fileURLToPath(new URL("./read-printer-queue.ps1", import.meta.url));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const DEFAULT_QUEUE_GUARD = Object.freeze({ timeoutMs: 600_000, pollMs: 1_500, quietMs: 3_000 });
const pendingPrinters = new Set();
const integer = (n) => Number.isSafeInteger(n) && n >= 0;
const namedPrinter = (name) => typeof name === "string" && name.trim() === name && name.length > 0 && !/[\0\r\n]/.test(name);

export function queueGuardSettings(route) {
  const override = route?.queueGuard;
  if (override !== undefined && (!override || typeof override !== "object" || Array.isArray(override) ||
      Object.keys(override).some((key) => !Object.hasOwn(DEFAULT_QUEUE_GUARD, key))))
    throw new Error("Printer queueGuard accepts only timeoutMs, pollMs, and quietMs.");
  const settings = { ...DEFAULT_QUEUE_GUARD, ...override };
  if (!integer(settings.timeoutMs) || settings.timeoutMs < 1_000 || settings.timeoutMs > 600_000 ||
      !integer(settings.pollMs) || settings.pollMs < 250 || settings.pollMs > 5_000 ||
      !integer(settings.quietMs) || settings.quietMs < 1_000 || settings.quietMs > 30_000 ||
      settings.quietMs >= settings.timeoutMs)
    throw new Error("Configure a bounded printer queue wait (at most ten minutes) and a quiet period shorter than the timeout.");
  return settings;
}

export function validateQueueSnapshot(snapshot, printerName) {
  if (!snapshot || snapshot.printerName !== printerName || !integer(snapshot.printerStatus) ||
      snapshot.printerStatus > 0xffffffff || !integer(snapshot.jobCount) || !Array.isArray(snapshot.jobs) ||
      !Array.isArray(snapshot.failures) || snapshot.jobs.length > 1_000 || snapshot.failures.length > 200)
    throw new Error("The Windows printer queue returned an unknown status; check the printer before retrying.");
  const ids = new Set();
  for (const job of snapshot.jobs) {
    if (!job || !integer(job.id) || ids.has(job.id) || !integer(job.status) || job.status > 0xffffffff ||
        !integer(job.size) || !integer(job.totalPages) || !integer(job.pagesPrinted) || typeof job.matchesDocument !== "boolean")
      throw new Error("The Windows printer queue returned invalid job information.");
    ids.add(job.id);
  }
  for (const failure of snapshot.failures)
    if (!failure || !integer(failure.recordId) || typeof failure.timeCreated !== "string" ||
        !Number.isFinite(Date.parse(failure.timeCreated)) || !/^\d{1,10}$/.test(failure.errorCode))
      throw new Error("The Windows print error log returned invalid information.");
  return snapshot;
}

export async function readPrinterQueue(printerName, { documentPath, sinceUtc } = {}) {
  if (!namedPrinter(printerName)) throw new Error("A valid exact Windows printer name is required.");
  const args = ["-NoProfile", "-NonInteractive", "-File", probePath, "-PrinterName", printerName];
  if (documentPath !== undefined) {
    if (typeof documentPath !== "string" || /[\0\r\n]/.test(documentPath) || !documentPath)
      throw new Error("A valid print document path is required.");
    args.push("-DocumentPath", documentPath);
  }
  if (sinceUtc !== undefined) {
    if (typeof sinceUtc !== "string" || !Number.isFinite(Date.parse(sinceUtc))) throw new Error("A valid print attempt timestamp is required.");
    args.push("-SinceUtc", sinceUtc);
  }
  let stdout;
  try {
    ({ stdout } = await executeFile("powershell.exe", args, {
      shell: false, windowsHide: true, timeout: 20_000, maxBuffer: 256 * 1024, encoding: "utf8",
    }));
  } catch {
    throw new Error("Could not read the Windows printer queue or print error log. No following pages will be sent; inspect the printer before retrying.");
  }
  let snapshot;
  try { snapshot = JSON.parse(stdout.replace(/^\uFEFF/, "").trim()); }
  catch { throw new Error("The Windows printer queue returned invalid JSON."); }
  return validateQueueSnapshot(snapshot, printerName);
}

// MSFT_PrintJob bit flags match JOB_INFO_2. Printed/Complete may mean only
// handed to the port; they never authorize physical-paper confirmation.
// https://learn.microsoft.com/en-us/windows/win32/printdocs/job-info-2
const JOB_ERROR = 0x1 | 0x2 | 0x4 | 0x20 | 0x40 | 0x100 | 0x200 | 0x400;
const JOB_ACTIVE = 0x8 | 0x10 | 0x800 | 0x4000;
const JOB_TERMINAL = 0x80 | 0x1000;
const JOB_KNOWN = 0x7fff;
const PRINTER_ERROR = 0x1 | 0x2 | 0x4 | 0x8 | 0x10 | 0x20 | 0x40 | 0x80 |
  0x800 | 0x1000 | 0x40000 | 0x80000 | 0x100000 | 0x200000 | 0x400000 | 0x800000;
const PRINTER_BUSY = 0x100 | 0x200 | 0x400 | 0x2000 | 0x4000 | 0x8000 | 0x10000;
const PRINTER_KNOWN = 0x1ffffff;
export function queueIsIdle(snapshot) {
  if (snapshot.failures.length)
    throw new Error(`Windows reported that this PDF failed to print (event 372, code ${snapshot.failures[0].errorCode}). Check its physical sheet before authorizing a reprint.`);
  if ((snapshot.printerStatus & PRINTER_ERROR) || (snapshot.printerStatus & ~PRINTER_KNOWN))
    throw new Error("The printer reports an error, offline, paused, or unknown state. Check the printer and its queue before retrying.");
  for (const job of snapshot.jobs)
    if ((job.status & JOB_ERROR) || (job.status & ~JOB_KNOWN))
      throw new Error("A Windows print job is paused, failed, cancelled, or needs attention. Check the printer queue before retrying.");
  const active = snapshot.jobs.some((job) => (job.status & JOB_ACTIVE) || !(job.status & JOB_TERMINAL));
  // A race between the printer count and job enumeration must not look empty.
  return !(snapshot.printerStatus & PRINTER_BUSY) && !active && snapshot.jobCount <= snapshot.jobs.length;
}

export async function withPrinterSubmission(printerName, action) {
  if (!namedPrinter(printerName)) throw new Error("A valid exact Windows printer name is required.");
  const key = printerName.toLowerCase();
  if (pendingPrinters.has(key)) throw new Error("A submission to this printer is already in progress. Wait for its queue before retrying.");
  pendingPrinters.add(key);
  try { return await action(); } finally { pendingPrinters.delete(key); }
}

export async function waitForPrinterIdle({ printerName, settings, deadline, probe = readPrinterQueue,
  pause = sleep, now = () => performance.now(), assertCanSubmit = () => {}, onSnapshot = async () => {} }) {
  const expires = deadline ?? now() + settings.timeoutMs;
  let quietSince = null;
  while (true) {
    assertCanSubmit();
    if (now() >= expires) throw new Error("Timed out waiting for the printer queue. Inspect its pages and queue before retrying.");
    const snapshot = validateQueueSnapshot(await probe(printerName), printerName);
    await onSnapshot(snapshot);
    assertCanSubmit();
    if (now() >= expires) throw new Error("Timed out waiting for the printer queue. Inspect its pages and queue before retrying.");
    if (queueIsIdle(snapshot)) quietSince ??= now(); else quietSince = null;
    if (quietSince !== null && now() - quietSince >= settings.quietMs) return;
    await pause(Math.min(settings.pollMs, Math.max(0, expires - now())));
  }
}

// Observe queue/errors while Sumatra runs, then require a sustained quiet queue.
// A very fast job can disappear between polls. An empty queue is not proof of
// ink on paper; the manufacturing workflow still requires the operator check.
export async function monitorPrinterSubmission({ printerName, documentPath, sinceUtc, settings, deadline,
  launch, probe = readPrinterQueue, pause = sleep, now = () => performance.now(),
  assertCanSubmit = () => {}, onSnapshot = async () => {}, onExit = async () => {} }) {
  const abort = new AbortController();
  let completed = false, launchError = null, exitCode = null, quietSince = null;
  const result = Promise.resolve().then(() => launch(abort.signal)).then(
    (code) => { exitCode = code; completed = true; },
    (error) => { launchError = error; completed = true; },
  );
  let exitRecorded = false;
  try {
    while (true) {
      assertCanSubmit();
      if (now() >= deadline) throw new Error("Timed out waiting for printer submission and queue completion. Its physical outcome needs review.");
      const snapshot = validateQueueSnapshot(await probe(printerName, { documentPath, sinceUtc }), printerName);
      await onSnapshot(snapshot);
      assertCanSubmit();
      if (now() >= deadline) throw new Error("Timed out waiting for printer submission and queue completion. Its physical outcome needs review.");
      if (completed && !exitRecorded) { await onExit(exitCode); exitRecorded = true; }
      const idle = queueIsIdle(snapshot);
      if (launchError) throw launchError;
      if (completed && exitCode !== 0) throw new Error("Printer submission returned an error; inspect its queue before retrying.");
      if (completed && idle) quietSince ??= now(); else quietSince = null;
      if (quietSince !== null && now() - quietSince >= settings.quietMs) return;
      await pause(Math.min(settings.pollMs, Math.max(0, deadline - now())));
    }
  } finally {
    // Stop this application's outstanding rendering on failure; never delete a
    // Windows spool job or retry it. A submitted physical page remains uncertain.
    if (!completed) abort.abort();
    await result;
    if (!exitRecorded && exitCode !== null) await onExit(exitCode);
  }
}
