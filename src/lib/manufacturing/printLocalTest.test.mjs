import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile, access, rm } from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PDFDocument } from "pdf-lib";
import { PRIVATE_ROOT, REPO_ROOT } from "../../../scripts/manufacturing/orders.mjs";
import { runLocalPrinterTest } from "../../../scripts/manufacturing/print-local-test.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function fixture(t) {
  await mkdir(PRIVATE_ROOT, { recursive: true });
  const directory = await mkdtemp(path.join(PRIVATE_ROOT, "print-local-test-"));
  t.after(async () => {
    // Restrict recursive cleanup to the exact temporary directory this fixture created.
    assert.equal(path.dirname(directory), path.resolve(PRIVATE_ROOT));
    assert.ok(path.basename(directory).startsWith("print-local-test-"));
    await rm(directory, { recursive: true, force: true });
  });
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  const bytes = await pdf.save();
  const packet = {
    schemaVersion: 1, kind: "local-printer-test", label: "LOCAL TEST ONLY",
    jobId: randomUUID(), createdAt: new Date().toISOString(), directory,
    files: ["ticket", "fronts", "backs"].map((side) => ({
      sheetId: side === "ticket" ? "work-ticket" : "sheet-1", side,
      file: path.join(directory, `${side}.pdf`), sha256: hash(bytes), pages: 1,
    })),
  };
  for (const job of packet.files) await writeFile(job.file, bytes);
  const sumatraPath = path.join(directory, "fake-sumatra.exe");
  await writeFile(sumatraPath, "Not executable: tests inject submission.");
  const profile = { printerName: "TEST PRINTER (never used)", printSettings: "noscale,simplex,color,paper=letter" };
  const config = { calibrationConfirmed: true, sumatraPath, ticket: profile, fronts: profile, backs: profile };
  const packetPath = path.join(directory, "packet.json");
  const configPath = path.join(directory, "printers.json");
  const receiptPath = path.join(directory, "print-receipt.json");
  const save = async () => {
    await writeFile(packetPath, JSON.stringify(packet));
    await writeFile(configPath, JSON.stringify(config));
  };
  await save();
  return { directory, packet, config, packetPath, configPath, receiptPath, save };
}

test("default validates only and creates no receipt, including the CLI", async (t) => {
  const f = await fixture(t);
  let calls = 0;
  const result = await runLocalPrinterTest({ ...f, submit: async () => { calls++; } });
  assert.equal(result.status, "validated");
  assert.equal(result.printingRequested, false);
  assert.equal(calls, 0);
  await assert.rejects(access(f.receiptPath), { code: "ENOENT" });
  const { stdout } = await promisify(execFile)(process.execPath, [
    path.join(REPO_ROOT, "scripts/manufacturing/print-local-test.mjs"),
    "--packet", f.packetPath, "--config", f.configPath,
  ]);
  assert.equal(JSON.parse(stdout).status, "validated");
  await assert.rejects(access(f.receiptPath), { code: "ENOENT" });
});

test("a corrupt later PDF prevents every submission and receipt creation", async (t) => {
  const f = await fixture(t);
  await writeFile(f.packet.files[2].file, "corrupt");
  let calls = 0;
  await assert.rejects(runLocalPrinterTest({ ...f, print: true, submit: async () => { calls++; } }), /checksum mismatch for backs/);
  assert.equal(calls, 0);
  await assert.rejects(access(f.receiptPath), { code: "ENOENT" });
});

test("a later PDF with matching checksum but wrong dimensions prevents any printing", async (t) => {
  const f = await fixture(t);
  const pdf = await PDFDocument.create();
  pdf.addPage([595, 842]);
  const bytes = await pdf.save();
  await writeFile(f.packet.files[2].file, bytes);
  f.packet.files[2].sha256 = hash(bytes);
  await f.save();
  let calls = 0;
  await assert.rejects(runLocalPrinterTest({ ...f, print: true, submit: async () => { calls++; } }), /portrait Letter/);
  assert.equal(calls, 0);
  await assert.rejects(access(f.receiptPath), { code: "ENOENT" });
});

test("multi-page PDF is refused even when metadata claims one page", async (t) => {
  const f = await fixture(t);
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  pdf.addPage([612, 792]);
  const bytes = await pdf.save();
  await writeFile(f.packet.files[2].file, bytes);
  f.packet.files[2].sha256 = hash(bytes);
  await f.save();
  await assert.rejects(runLocalPrinterTest(f), /exactly one page/);
});

test("submission is ticket first, durable intent precedes each call, and receipt blocks repeats", async (t) => {
  const f = await fixture(t), calls = [];
  const submit = async (_config, job) => {
    const receipt = JSON.parse(await readFile(f.receiptPath, "utf8"));
    assert.equal(receipt.status, "submitting");
    assert.equal(receipt.files.find((file) => file.side === job.side).status, "submitting");
    for (const side of calls)
      assert.equal(receipt.files.find((file) => file.side === side).status, "succeeded");
    calls.push(job.side);
  };
  assert.equal((await runLocalPrinterTest({ ...f, print: true, submit })).status, "submitted");
  assert.deepEqual(calls, ["ticket", "fronts", "backs"]);
  const receipt = JSON.parse(await readFile(f.receiptPath, "utf8"));
  assert.equal(receipt.status, "succeeded");
  assert.ok(receipt.files.every((job) => job.status === "succeeded"));
  await assert.rejects(runLocalPrinterTest({ ...f, print: true, submit }), /receipt already exists/);
  assert.equal(calls.length, 3);
});

test("competing submissions cannot reserve the same packet twice", async (t) => {
  const f = await fixture(t), calls = [];
  const options = { ...f, print: true, submit: async (_config, job) => { calls.push(job.side); } };
  const results = await Promise.allSettled([runLocalPrinterTest(options), runLocalPrinterTest(options)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.match(results.find((result) => result.status === "rejected").reason.message, /receipt already exists/);
  assert.deepEqual(calls, ["ticket", "fronts", "backs"]);
});

test("Sumatra failure records uncertain, stops following pages, and blocks retries", async (t) => {
  const f = await fixture(t), calls = [];
  const submit = async (_config, job) => {
    calls.push(job.side);
    if (job.side === "fronts") throw new Error("Simulated Sumatra failure");
  };
  await assert.rejects(runLocalPrinterTest({ ...f, print: true, submit }), /fronts submission is uncertain/);
  const receipt = JSON.parse(await readFile(f.receiptPath, "utf8"));
  assert.equal(receipt.status, "needs_review");
  assert.deepEqual(receipt.files.map((job) => job.status), ["succeeded", "uncertain", "pending"]);
  assert.equal(receipt.files[1].error, "Simulated Sumatra failure");
  await assert.rejects(runLocalPrinterTest({ ...f, print: true, submit }), /receipt already exists/);
  assert.deepEqual(calls, ["ticket", "fronts"]);
});

test("duplicate sides, unconfirmed profiles, and unsafe later routes fail preflight", async (t) => {
  const f = await fixture(t);
  let calls = 0;
  const options = { ...f, print: true, submit: async () => { calls++; } };
  f.packet.files[2].side = "fronts";
  await f.save();
  await assert.rejects(runLocalPrinterTest(options), /exactly one ticket, fronts, and backs/);
  f.packet.files[2].side = "backs";
  f.config.calibrationConfirmed = false;
  await f.save();
  await assert.rejects(runLocalPrinterTest(options), /Confirm the existing/);
  f.config.calibrationConfirmed = true;
  f.config.backs = { printerName: "TEST", printSettings: "fit,simplex" };
  await f.save();
  await assert.rejects(runLocalPrinterTest(options), /actual-size simplex printer profile for backs/);
  assert.equal(calls, 0);
  await assert.rejects(access(f.receiptPath), { code: "ENOENT" });
});

test("packet and config paths outside the private manufacturing directory are refused", async (t) => {
  const f = await fixture(t);
  await assert.rejects(runLocalPrinterTest({ ...f, configPath: path.join(REPO_ROOT, "outside-printers.json") }), /must be inside/);
  await assert.rejects(runLocalPrinterTest({ ...f, packetPath: path.join(REPO_ROOT, "outside-packet.json") }), /must be inside/);
});

test("extra copies, contradictory settings, duplicate options, and unsafe bins never create a receipt or submit", async (t) => {
  const f = await fixture(t);
  let calls = 0;
  const options = { ...f, print: true, submit: async () => { calls++; } };
  for (const invalid of [
    "noscale,simplex,color,paper=letter,3x",
    "noscale,simplex,color,paper=letter,fit",
    "noscale,simplex,color,paper=letter,duplex",
    "noscale,simplex,color,paper=a4",
    "noscale,simplex,color,paper=letter,landscape",
    "noscale,simplex,color,paper=letter,noscale",
    "noscale,simplex,color,paper=letter,monochrome",
    "noscale,simplex,paper=letter",
    "noscale,simplex,color,paper=letter,bin=1,bin=2",
    'noscale,simplex,color,paper=letter,bin="2"',
    "noscale,simplex,color,paper=letter,bin=",
  ]) {
    f.config.backs = { printerName: "TEST", printSettings: invalid };
    await f.save();
    await assert.rejects(runLocalPrinterTest(options), /backs local test settings/, invalid);
    assert.equal(calls, 0, invalid);
    await assert.rejects(access(f.receiptPath), { code: "ENOENT" });
  }
});

test("safe named and indexed trays are accepted with either color mode", async (t) => {
  const f = await fixture(t);
  f.config.fronts = { printerName: "TEST", printSettings: "noscale,simplex,color,paper=letter,bin=Rear Paper Feed" };
  f.config.backs = { printerName: "TEST", printSettings: "noscale,simplex,color,paper=letter,bin=2" };
  f.config.ticket = { printerName: "TEST", printSettings: "noscale,simplex,monochrome,paper=letter" };
  await f.save();
  assert.equal((await runLocalPrinterTest(f)).status, "validated");
  await assert.rejects(access(f.receiptPath), { code: "ENOENT" });
});
