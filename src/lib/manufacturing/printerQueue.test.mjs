import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { DEFAULT_QUEUE_GUARD, queueGuardSettings, validateQueueSnapshot, queueIsIdle,
  withPrinterSubmission, waitForPrinterIdle, monitorPrinterSubmission } from "../../../scripts/manufacturing/printer-queue.mjs";
import { submitPdf } from "../../../scripts/manufacturing/agent.mjs";

const name = "TEST PRINTER — never used";
const settings = { timeoutMs: 10_000, pollMs: 500, quietMs: 1_000 };
const snapshot = (jobs = [], printerStatus = 0) => ({ printerName: name, printerStatus, jobCount: jobs.length, jobs, failures: [] });
const job = (id, status = 0x10, matchesDocument = true) => ({ id, status, size: 201_590_720, totalPages: 1, pagesPrinted: 0, matchesDocument });
const timing = () => {
  let time = 0;
  return { now: () => time, pause: async (ms) => { time += ms; await Promise.resolve(); } };
};
const failure = () => ({ recordId: 9, timeCreated: "2026-10-26T20:00:00.000Z", errorCode: "2147500037" });

async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "searealm-print-queue-"));
  t.after(async () => {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith("searealm-print-queue-"));
    await rm(directory, { recursive: true, force: true });
  });
  const file = path.join(directory, "saved-front.pdf");
  await writeFile(file, "Immutable canonical PDF test bytes; no hardware submission.");
  return { directory, file, config: {
    calibrationConfirmed: true, sumatraPath: path.join(directory, "not-executable.exe"),
    fronts: { printerName: name, printSettings: "noscale,simplex,color,paper=letter", queueGuard: settings },
  }, target: { sheetId: "saved-sheet-1", side: "fronts", file } };
}

test("all routes get a bounded quiet-queue guard by default and invalid overrides fail closed", () => {
  assert.deepEqual(queueGuardSettings({}), DEFAULT_QUEUE_GUARD);
  assert.deepEqual(queueGuardSettings({ queueGuard: { quietMs: 4_000 } }), { ...DEFAULT_QUEUE_GUARD, quietMs: 4_000 });
  for (const value of [false, null, { enabled: false }, { timeoutMs: 600_001 }, { quietMs: 0 }, { pollMs: 0 }, { timeoutMs: 1_000, quietMs: 1_000 }])
    assert.throws(() => queueGuardSettings({ queueGuard: value }), /queueGuard|bounded/);
});

test("queue snapshots require the exact printer and valid non-private status fields", () => {
  assert.equal(validateQueueSnapshot(snapshot(), name).printerName, name);
  for (const altered of [ { ...snapshot(), printerName: "Other printer" }, { ...snapshot(), printerStatus: null },
    { ...snapshot(), jobs: null }, snapshot([job(1), job(1)]), snapshot([{ ...job(1), status: -1 }]) ])
    assert.throws(() => validateQueueSnapshot(altered, name), /unknown|invalid/);
});

test("normal and completed retained jobs may settle; active or count-race queues may not", () => {
  assert.equal(queueIsIdle(snapshot()), true);
  assert.equal(queueIsIdle(snapshot([job(2, 0x2000 | 0x1000)])), true);
  assert.equal(queueIsIdle(snapshot([job(3, 0x2000 | 0x80)])), true);
  for (const value of [snapshot([job(1, 0)]), snapshot([job(1)]), snapshot([job(1, 0x4000)]),
    snapshot([], 0x200), { ...snapshot(), jobCount: 1 }]) assert.equal(queueIsIdle(value), false);
});

test("offline, failed, cancelled, blocked and unknown status flags never count as completion", () => {
  for (const flag of [0x80, 0x2, 0x1, 0x800000, 0x400000, 0x40000, 0x80000000])
    assert.throws(() => queueIsIdle(snapshot([], flag)), /printer reports/);
  for (const flag of [1, 2, 4, 32, 64, 256, 512, 1024, 0x8000])
    assert.throws(() => queueIsIdle(snapshot([job(1, flag)])), /Windows print job/);
  assert.throws(() => queueIsIdle({ ...snapshot(), failures: [failure()] }), /event 372/);
});

test("preflight waits through existing work and requires an uninterrupted quiet period", async () => {
  const clock = timing(), observed = [];
  const states = [snapshot([job(8)]), snapshot(), snapshot([job(9)]), snapshot(), snapshot(), snapshot()];
  await waitForPrinterIdle({ printerName: name, settings, ...clock,
    probe: async () => states.shift() ?? snapshot(), onSnapshot: async (s) => observed.push(s.jobCount) });
  assert.deepEqual(observed, [1, 0, 1, 0, 0, 0]);
  assert.equal(clock.now(), 2_500);
});

test("preflight queue timeout and lost lease stop without initiating a submission", async () => {
  const clock = timing();
  await assert.rejects(waitForPrinterIdle({ printerName: name, settings, ...clock,
    probe: async () => snapshot([job(8)]) }), /Timed out/);
  assert.equal(clock.now(), settings.timeoutMs);
  await assert.rejects(waitForPrinterIdle({ printerName: name, settings, ...timing(),
    probe: async () => assert.fail("No queue read after lease loss"),
    assertCanSubmit: () => { throw new Error("Lease lost"); } }), /Lease lost/);
});

test("monitor continues after application exit until the target queue settles", async () => {
  const clock = timing(), observations = [], exits = [];
  const states = [snapshot([job(4, 0x8)]), snapshot([job(4)]), snapshot([job(4)]), snapshot(), snapshot(), snapshot()];
  await monitorPrinterSubmission({ printerName: name, documentPath: "C:\\private\\proof.pdf",
    sinceUtc: "2026-10-26T20:00:00Z", settings, deadline: 10_000, ...clock,
    launch: async () => 0,
    probe: async (_name, context) => {
      assert.equal(context.documentPath, "C:\\private\\proof.pdf");
      assert.equal(context.sinceUtc, "2026-10-26T20:00:00Z");
      return states.shift() ?? snapshot();
    }, onSnapshot: async (s) => observations.push(s.jobCount), onExit: async (code) => exits.push(code),
  });
  assert.deepEqual(observations, [1, 1, 1, 0, 0, 0]);
  assert.deepEqual(exits, [0]); assert.equal(clock.now(), 2_500);
});

test("a fast unobserved job may settle, but is never treated as physical confirmation", async () => {
  const clock = timing();
  await monitorPrinterSubmission({ printerName: name, documentPath: "C:\\private\\fast.pdf",
    sinceUtc: "2026-10-26T20:00:00Z", settings, deadline: 10_000, ...clock,
    launch: async () => 0, probe: async () => snapshot() });
  assert.ok(clock.now() >= settings.quietMs);
});

test("a matching event 372 catches an already-removed failed job even when the application exits zero", async () => {
  const clock = timing(); let polls = 0;
  await assert.rejects(monitorPrinterSubmission({ printerName: name, documentPath: "C:\\private\\failed.pdf",
    sinceUtc: "2026-10-26T20:00:00Z", settings, deadline: 10_000, ...clock,
    launch: async () => 0,
    probe: async () => ++polls === 1 ? snapshot() : { ...snapshot(), failures: [failure()] },
  }), /event 372/);
  assert.equal(polls, 2);
});

test("a queue error during active rendering aborts that application and does not retry", async () => {
  let launches = 0, aborted = false;
  await assert.rejects(monitorPrinterSubmission({ printerName: name, documentPath: "C:\\private\\failed.pdf",
    sinceUtc: "2026-10-26T20:00:00Z", settings, deadline: 10_000, ...timing(),
    launch: async (signal) => {
      launches++;
      return new Promise((_resolve, reject) => signal.addEventListener("abort", () => { aborted = true; reject(new Error("Aborted")); }, { once: true }));
    }, probe: async () => snapshot([job(4, 0x2)]),
  }), /Windows print job/);
  assert.equal(launches, 1); assert.equal(aborted, true);
});

test("nonzero application exit is a failure even with an empty Windows queue", async () => {
  await assert.rejects(monitorPrinterSubmission({ printerName: name, documentPath: "C:\\private\\failed.pdf",
    sinceUtc: "2026-10-26T20:00:00Z", settings, deadline: 10_000, ...timing(),
    launch: async () => 5, probe: async () => snapshot() }), /submission returned an error/);
});

test("overlapping local submissions to the same printer are rejected and release their guard after failure", async () => {
  let release; const pending = new Promise((resolve) => { release = resolve; });
  const first = withPrinterSubmission(name, () => pending);
  await assert.rejects(withPrinterSubmission(name.toLowerCase(), () => assert.fail("Must not overlap")), /already in progress/);
  release(); await first;
  await assert.rejects(withPrinterSubmission(name, async () => { throw new Error("Stopped"); }), /Stopped/);
  assert.equal(await withPrinterSubmission(name, async () => "next"), "next");
});

test("submission records immutable source/transport hashes, queue evidence, and no physical confirmation", async (t) => {
  const f = await fixture(t), clock = timing(); let launches = 0, after = 0;
  const prepared = path.join(f.directory, "prepared-front.pdf"); await writeFile(prepared, "Prepared transport PDF test bytes");
  const result = await submitPdf(f.config, f.target, {
    prepare: async (_config, target) => ({ ...target, file: prepared }),
    receiptRoot: path.join(f.directory, "receipts"), now: clock.now, sleep: clock.pause,
    probe: async (_printer, context) => context?.documentPath && ++after < 3 ? snapshot([job(4)]) : snapshot(),
    launch: async (_executable, args) => { launches++; assert.equal(args.at(-1), prepared); return 0; },
  });
  const receipt = JSON.parse(await readFile(result.receiptFile, "utf8"));
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  assert.equal(receipt.sourceSha256, hash(await readFile(f.file)));
  assert.equal(receipt.preparedSha256, hash(await readFile(prepared)));
  assert.deepEqual(receipt.windowsJobIds, [4]); assert.equal(receipt.targetJobObserved, true);
  assert.equal(receipt.applicationExitCode, 0); assert.equal(receipt.state, "spooler_quiet_needs_paper_check");
  assert.equal(receipt.physicalPrintConfirmed, false); assert.equal(result.physicalPrintConfirmed, false);
  assert.equal(launches, 1); assert.ok(receipt.observations.length >= 3);
});

test("a pre-launch device error writes not_submitted and does not invoke the print application", async (t) => {
  const f = await fixture(t), clock = timing(), receiptRoot = path.join(f.directory, "receipts");
  await assert.rejects(submitPdf(f.config, f.target, {
    prepare: async (_config, target) => target, receiptRoot, now: clock.now, sleep: clock.pause,
    probe: async () => snapshot([], 0x80), launch: async () => assert.fail("No print on an offline printer"),
  }), /printer reports/);
  const receipt = JSON.parse(await readFile(path.join(receiptRoot, (await readdir(receiptRoot))[0]), "utf8"));
  assert.equal(receipt.state, "not_submitted"); assert.equal(receipt.applicationStarted, false);
});

test("a zero-exit failed print writes needs_review and never automatically retries", async (t) => {
  const f = await fixture(t), clock = timing(), receiptRoot = path.join(f.directory, "receipts"); let launches = 0;
  await assert.rejects(submitPdf(f.config, f.target, {
    prepare: async (_config, target) => target, receiptRoot, now: clock.now, sleep: clock.pause,
    probe: async (_printer, context) => context?.documentPath ? { ...snapshot(), failures: [failure()] } : snapshot(),
    launch: async () => { launches++; return 0; },
  }), /event 372/);
  const receipt = JSON.parse(await readFile(path.join(receiptRoot, (await readdir(receiptRoot))[0]), "utf8"));
  assert.equal(receipt.state, "needs_review"); assert.equal(receipt.applicationStarted, true);
  assert.equal(receipt.physicalPrintConfirmed, false); assert.equal(launches, 1);
  assert.equal(receipt.applicationExitCode, 0);
});

test("a slow final probe cannot turn an expired queue budget into permission to print", async () => {
  const clock = timing(); let count = 0;
  await assert.rejects(waitForPrinterIdle({ printerName: name, settings, ...clock, probe: async () => {
    if (++count === 2) await clock.pause(settings.timeoutMs); return snapshot();
  } }), /Timed out/);
});

test("lease loss during a queue probe is checked before idle can authorize submission", async () => {
  let lost = false, polls = 0;
  await assert.rejects(waitForPrinterIdle({ printerName: name, settings, ...timing(),
    assertCanSubmit: () => { if (lost) throw new Error("Lease lost during queue read"); },
    probe: async () => { if (++polls === 2) lost = true; return snapshot(); },
  }), /Lease lost during queue read/);
  assert.equal(polls, 2);
});

test("the submission monitor rejects a quiet queue returned after its deadline", async () => {
  const clock = timing(); let polls = 0, launches = 0;
  await assert.rejects(monitorPrinterSubmission({ printerName: name,
    documentPath: "C:\\private\\late.pdf", sinceUtc: "2026-10-26T20:00:00Z",
    settings, deadline: 10_000, ...clock,
    launch: async () => { launches++; return 0; },
    probe: async () => { if (++polls === 2) await clock.pause(10_000); return snapshot(); },
  }), /Timed out/);
  assert.equal(polls, 2); assert.equal(launches, 1);
});
