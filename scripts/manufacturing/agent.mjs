import { readFile, mkdir, rename, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { renderJob, verifiedPng } from "./render.mjs";
import { preflightPrintAssets } from "../../src/lib/manufacturing/printPlan.mjs";
import { PRIVATE_ROOT as privateRoot, atomicJson } from "./orders.mjs";

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export function printerArguments(config, job) {
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
  return [
    "-print-to",
    route.printerName,
    "-print-settings",
    route.printSettings,
    "-silent",
    job.file,
  ];
}
export async function submitPdf(config, job) {
  if (config.calibrationConfirmed !== true)
    throw new Error(
      "Calibrate and confirm both printer profiles before submission.",
    );
  await readFile(job.file);
  const args = printerArguments(config, job);
  await new Promise((resolve, reject) => {
    const child = spawn(config.sumatraPath, args, {
      shell: false,
      windowsHide: true,
      stdio: "ignore",
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(
        new Error(
          "Printer submission timed out; the physical outcome needs review.",
        ),
      );
    }, 120_000);
    child.once("error", () => {
      clearTimeout(timer);
      reject(new Error("Could not launch the configured print application."));
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      code === 0
        ? resolve()
        : reject(
            new Error(
              "Printer submission returned an error; inspect its queue before retrying.",
            ),
          );
    });
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
    for (const target of jobs) {
      if (status(target) !== "queued") continue;
      if (leaseLost) throw new Error("Lease lost before print submission.");
      const eventTarget = { sheetId: target.sheetId, side: target.side };
      await event("submission_started", eventTarget);
      try {
        await print(config, target);
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
