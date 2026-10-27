import { readFile, mkdir, rename, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { renderJob, verifiedPng } from "./render.mjs";
import { preflightPrintAssets } from "../../src/lib/manufacturing/printPlan.mjs";
import { PRIVATE_ROOT as privateRoot, atomicJson } from "./orders.mjs";
import { preparePrinterPdf, validatePrinterPlacement } from "./printer-placement.mjs";
import { queueGuardSettings, readPrinterQueue, withPrinterSubmission, waitForPrinterIdle, monitorPrinterSubmission } from "./printer-queue.mjs";

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export function printerArguments(config, job) {
  const placement = validatePrinterPlacement(config, job);
  const route = config[job.side];
  if (
    !route?.printerName ||
    !route.printSettings ||
    !route.printSettings.split(",").includes("noscale") ||
    !route.printSettings.split(",").includes("simplex")
  )
    throw new Error(
      `Configure an actual-size simplex printer profile for ${job.side}.`,
    );
  if (!path.isAbsolute(job.file))
    throw new Error("Print file must be absolute.");
  // The transport page is larger than nominal Letter. Force DMPAPER_LETTER
  // numerically: Epson's localized "Letter (8.5 x 11 in)" does not match
  // Sumatra's paper=letter name lookup, and this PDF cannot auto-detect Letter.
  const settings = placement
    ? route.printSettings.replace("paper=letter", "paperkind=1")
    : route.printSettings;
  return [
    "-print-to",
    route.printerName,
    "-print-settings",
    settings,
    "-silent",
    job.file,
  ];
}
export function launchPrintApplication(executable, args, { signal, timeoutMs = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error("Print submission was stopped before launching.")); return; }
    let child;
    try { child = spawn(executable, args, { shell: false, windowsHide: true, stdio: "ignore" }); }
    catch { reject(new Error("Could not launch the configured print application.")); return; }
    let finished = false;
    const complete = (error, code) => {
      if (finished) return;
      finished = true; clearTimeout(timer); signal?.removeEventListener("abort", abort);
      error ? reject(error) : resolve(code);
    };
    const abort = () => {
      child.kill();
      complete(new Error("Printer submission was interrupted; its physical outcome needs review."));
    };
    const timer = setTimeout(() => {
      child.kill();
      complete(new Error("Printer submission timed out; its physical outcome needs review."));
    }, timeoutMs);
    signal?.addEventListener("abort", abort, { once: true });
    child.once("error", () => complete(new Error("Could not launch the configured print application.")));
    child.once("exit", (code) => complete(null, code));
  });
}

export async function submitPdf(config, job, {
  prepare = preparePrinterPdf, probe = readPrinterQueue, launch = launchPrintApplication,
  now = () => performance.now(), sleep = pause, assertCanSubmit = () => {},
  receiptRoot = path.join(privateRoot, "print-receipts"),
} = {}) {
  if (config.calibrationConfirmed !== true)
    throw new Error("Calibrate and confirm both printer profiles before submission.");
  assertCanSubmit();
  const prepared = await prepare(config, job);
  const sourceBytes = await readFile(job.file), preparedBytes = await readFile(prepared.file);
  const args = printerArguments(config, prepared), route = config[job.side], settings = queueGuardSettings(route);
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  return withPrinterSubmission(route.printerName, async () => {
    const attemptId = randomUUID(), startedAt = new Date().toISOString();
    await mkdir(receiptRoot, { recursive: true });
    const receiptFile = path.join(receiptRoot, attemptId + ".json");
    const receipt = {
      schemaVersion: 1, attemptId, sheetId: job.sheetId, side: job.side,
      sourceFile: job.file, sourceSha256: hash(sourceBytes),
      preparedFile: prepared.file, preparedSha256: hash(preparedBytes),
      printerName: route.printerName, printSettings: args[3], queueGuard: settings,
      startedAt, state: "waiting_for_queue", applicationStarted: false,
      applicationExitCode: null, targetJobObserved: false, windowsJobIds: [],
      observations: [], observationCount: 0, physicalPrintConfirmed: false,
    };
    const save = async (state) => {
      receipt.state = state; receipt.updatedAt = new Date().toISOString();
      await atomicJson(receiptFile, receipt);
    };
    let observationPhase = "before_submission", lastObservation = "";
    const observe = async (snapshot) => {
      receipt.observationCount++;
      for (const item of snapshot.jobs) if (item.matchesDocument && !receipt.windowsJobIds.includes(item.id)) {
        receipt.targetJobObserved = true; receipt.windowsJobIds.push(item.id);
      }
      const sample = {
        phase: observationPhase, printerStatus: snapshot.printerStatus, jobCount: snapshot.jobCount,
        jobs: snapshot.jobs.slice(0, 32), jobsTruncated: snapshot.jobs.length > 32,
        failures: snapshot.failures,
      };
      const identity = JSON.stringify(sample);
      receipt.lastObservedAt = new Date().toISOString();
      if (identity !== lastObservation) {
        lastObservation = identity;
        receipt.observations.push({ ...sample, at: receipt.lastObservedAt });
        if (receipt.observations.length > 40) receipt.observations.shift();
        await save(receipt.state);
      }
    };
    const deadline = now() + settings.timeoutMs;
    await save(receipt.state);
    try {
      await waitForPrinterIdle({ printerName: route.printerName, settings, deadline,
        probe, pause: sleep, now, assertCanSubmit, onSnapshot: observe });
      assertCanSubmit();
      receipt.applicationStarted = true; receipt.launchStartedAt = new Date().toISOString();
      await save("submitting");
      observationPhase = "submission";
      await monitorPrinterSubmission({ printerName: route.printerName, documentPath: prepared.file,
        sinceUtc: receipt.launchStartedAt, settings, deadline, probe, pause: sleep, now,
        assertCanSubmit, onSnapshot: observe,
        launch: (signal) => launch(config.sumatraPath, args, {
          signal, timeoutMs: Math.max(1, Math.min(120_000, deadline - now())),
        }),
        onExit: async (code) => {
          receipt.applicationExitCode = code; receipt.applicationExitedAt = new Date().toISOString();
          await save("waiting_for_queue_completion");
        },
      });
      receipt.completedAt = new Date().toISOString();
      await save("spooler_quiet_needs_paper_check");
      return { receiptFile, targetJobObserved: receipt.targetJobObserved, physicalPrintConfirmed: false };
    } catch (error) {
      receipt.error = error.message;
      await save(receipt.applicationStarted ? "needs_review" : "not_submitted");
      throw error;
    }
  });
}
export function agentClient(siteOrigin, token, fetchImpl = fetch) {
  const base = new URL(siteOrigin);
  if (
    base.protocol !== "https:" &&
    !(
      base.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(base.hostname)
    )
  )
    throw new Error("Agent endpoint must use HTTPS.");
  const endpoint = new URL("/api/manufacturing/agent", base.origin);
  return {
    async post(payload) {
      // Retrying the same event ID is safe. Physical submission itself is never retried.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetchImpl(endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(25_000),
            redirect: "error",
          });
          const data = await response.json();
          if (!response.ok) {
            const error = new Error(data.error ?? "Agent request rejected.");
            error.rejected = true;
            throw error;
          }
          return data;
        } catch (error) {
          if (error.rejected || attempt === 2) throw error;
          await pause(500 * (attempt + 1));
        }
      }
    },
    async download(job, id) {
      const url = new URL(endpoint);
      url.search = new URLSearchParams({
        orderId: job.order_id,
        leaseToken: job.lease_token,
        assetId: id,
      });
      const response = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(60_000),
        redirect: "error",
      });
      if (!response.ok)
        throw new Error("Could not fetch a private print asset.");
      if (Number(response.headers.get("content-length")) > 30_000_000)
        throw new Error("Private artwork is too large.");
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 30_000_000)
        throw new Error("Private artwork is too large.");
      return bytes;
    },
  };
}
export async function runJob({
  job,
  client,
  config,
  root = privateRoot,
  siteOrigin,
  print = submitPdf,
  render = renderJob,
  prepare = preparePrinterPdf,
}) {
  const dir = path.join(root, "agent", job.order_id),
    assetDir = path.join(root, "assets");
  await mkdir(dir, { recursive: true });
  await mkdir(assetDir, { recursive: true });
  await atomicJson(path.join(dir, "pinned-job.json"), job);
  let state = job.state,
    leaseLost = false;
  const common = { orderId: job.order_id, leaseToken: job.lease_token };
  const heartbeat = setInterval(
    () =>
      client
        .post({ action: "heartbeat", ...common })
        .then((r) => {
          if (!r.renewed) leaseLost = true;
        })
        .catch(() => {
          leaseLost = true;
        }),
    30_000,
  );
  heartbeat.unref();
  async function event(type, target) {
    if (leaseLost)
      throw new Error(
        "Agent lease was lost. Stop and review any active attempt.",
      );
    const payload = {
      action: "event",
      ...common,
      event: {
        id: randomUUID(),
        type,
        expectedRevision: state.revision,
        ...target,
      },
    };
    // Persist intent before contacting the server, then reserve remotely before printing.
    await atomicJson(path.join(dir, "last-intent.json"), payload);
    const r = await client.post(payload);
    state = r.state;
    await atomicJson(path.join(dir, "last-state.json"), state);
  }
  try {
    const targets = [
      { sheetId: "work-ticket", side: "ticket" },
      ...job.manifest.sheets.flatMap((s) =>
        ["fronts", "backs"].map((side) => ({ sheetId: s.sheetId, side })),
      ),
    ];
    const status = (t) =>
      t.side === "ticket"
        ? state.ticket?.ticket
        : state.sheets[t.sheetId][t.side];
    let uncertain = false;
    for (const target of targets) {
      if (status(target) === "submitting") {
        await event("submission_uncertain", target);
        uncertain = true;
      }
      if (status(target) === "needs_review") uncertain = true;
    }
    if (uncertain)
      throw new Error(
        "An earlier print attempt needs operator review. Confirm the paper or authorize a reprint.",
      );
    if (state.hold) throw new Error("Order is on hold.");
    const files = {};
    for (const id of preflightPrintAssets(job.manifest, job.release)
      .requiredAssetIds) {
      const asset = job.release.assets[id],
        file = path.join(assetDir, `${asset.sha256}.png`);
      try {
        await verifiedPng(file, asset);
      } catch {
        const temp = `${file}.${randomUUID()}.tmp`;
        await writeFile(temp, await client.download(job, id), { flush: true });
        await verifiedPng(temp, asset);
        await rename(temp, file);
      }
      files[id] = file;
    }
    const jobs = await render({
      manifest: job.manifest,
      release: job.release,
      order: job.order,
      assetFiles: files,
      outputDir: path.join(dir, "pdf"),
      siteOrigin,
    });
    // Validate every pending printer placement before any page is submitted.
    // submitPdf rechecks the device immediately before its individual submission.
    for (const target of jobs) {
      if (status(target) === "queued") await prepare(config, target);
    }
    for (const target of jobs) {
      if (status(target) !== "queued") continue;
      if (leaseLost) throw new Error("Lease lost before print submission.");
      const eventTarget = { sheetId: target.sheetId, side: target.side };
      await event("submission_started", eventTarget);
      try {
        await print(config, target, {
          assertCanSubmit: () => {
            if (leaseLost) throw new Error("Agent lease was lost while waiting for the printer. Review its physical outcome before retrying.");
          },
        });
      } catch (error) {
        await event("submission_uncertain", eventTarget);
        throw error;
      }
      // A crash or failed acknowledgement here leaves 'submitting', never 'queued'.
      await event("submission_succeeded", eventTarget);
    }
    const settled = await client.post({ action: "settle", ...common });
    return { orderId: job.order_id, phase: settled.phase };
  } catch (error) {
    await client
      .post({ action: "block", ...common, issue: error.message })
      .catch(() => {});
    throw error;
  } finally {
    clearInterval(heartbeat);
  }
}
async function main() {
  const args = process.argv.slice(2),
    configPath = args[args.indexOf("--config") + 1];
  if (!args.includes("--config") || !configPath)
    throw new Error(
      "Use --config .private/manufacturing/printers.json. Use --once for one poll.",
    );
  const config = JSON.parse(await readFile(configPath, "utf8"));
  if (process.platform !== "win32")
    throw new Error("This printer adapter requires Windows.");
  if (!path.isAbsolute(config.sumatraPath ?? ""))
    throw new Error("Configure the absolute SumatraPDF executable path.");
  await access(config.sumatraPath);
  if (config.calibrationConfirmed !== true)
    throw new Error(
      "Set calibrationConfirmed only after checking the Epson and Canon output at actual size.",
    );
  if (!process.env.MANUFACTURING_AGENT_TOKEN)
    throw new Error(
      "Set MANUFACTURING_AGENT_TOKEN in the local process environment.",
    );
  for (const side of ["fronts", "backs", "ticket"])
    printerArguments(config, { side, file: path.resolve("example.pdf") });
  const client = agentClient(
    config.siteOrigin,
    process.env.MANUFACTURING_AGENT_TOKEN,
  );
  do {
    try {
      const r = await client.post({
        action: "claim",
        leaseToken: randomUUID(),
      });
      if (r.job && !r.job.blocked)
        console.log(
          JSON.stringify(
            await runJob({
              job: r.job,
              client,
              config,
              siteOrigin: config.siteOrigin,
            }),
          ),
        );
      else
        console.log(
          JSON.stringify({
            status: r.disabled
              ? "disabled"
              : r.job?.blocked
                ? "blocked"
                : "idle",
            orderId: r.job?.orderId,
          }),
        );
    } catch (error) {
      console.error(error.message);
    }
    if (args.includes("--once")) break;
    await pause(15_000);
  } while (true);
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
