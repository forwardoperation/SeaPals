import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { getBugReportReference } from "./bugReports.mjs";

const schema = await readFile(new URL("../../supabase/bug-reports.sql", import.meta.url), "utf8");
// PGlite provides gen_random_uuid in core, but cannot load Supabase's extension.
const localSchema = schema.replace("create extension if not exists pgcrypto;", "");

async function fixture(t) {
  const db = new PGlite();
  t.after(() => db.close());
  // Match Supabase's role boundary without relying on its default object grants.
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  await db.exec(localSchema);
  return db;
}

async function asRole(db, role, action) {
  assert.ok(["anon", "authenticated", "service_role"].includes(role));
  await db.exec(`set role ${role}`);
  try {
    return await action();
  } finally {
    await db.exec("reset role");
  }
}

async function insertReport(db, overrides = {}) {
  const report = {
    client_report_id: randomUUID(),
    surface: "simulator",
    summary: "Lost Zone card cannot be retrieved",
    description: "The selected card stays in the Lost Zone after trying to retrieve it.",
    ...overrides,
  };
  const entries = Object.entries(report);
  // Only test-owned column names are used; every value is a bound parameter.
  const { rows } = await db.query(
    `insert into public.bug_reports (${entries.map(([key]) => key).join(", ")})
     values (${entries.map((_, index) => `$${index + 1}`).join(", ")}) returning *`,
    entries.map(([, value]) => value),
  );
  return rows[0];
}

test("bug-report SQL permits server submission and review while browser roles stay private", async (t) => {
  const db = await fixture(t);
  const report = await asRole(db, "service_role", () => insertReport(db));
  assert.match(report.id, /^[0-9a-f-]{36}$/);
  assert.equal(getBugReportReference(report), "BR-0001");
  assert.equal(report.priority, "untriaged");
  assert.equal(report.status, "new");
  assert.equal(report.approved_for_fix, false);
  assert.deepEqual(report.context, {});

  await asRole(db, "service_role", async () => {
    const read = await db.query("select * from public.bug_reports where id = $1", [report.id]);
    assert.equal(read.rows[0].summary, report.summary);
    const updated = await db.query(
      "update public.bug_reports set priority = 'high', status = 'investigating' where id = $1 returning *",
      [report.id],
    );
    assert.equal(updated.rows[0].priority, "high");
    assert.equal(updated.rows[0].status, "investigating");
    assert.equal(updated.rows[0].approved_for_fix, false);
  });

  for (const role of ["anon", "authenticated"]) {
    await asRole(db, role, async () => {
      await assert.rejects(db.query("select * from public.bug_reports"), { code: "42501" });
      await assert.rejects(insertReport(db), { code: "42501" });
      await assert.rejects(db.query("update public.bug_reports set approved_for_fix = true"), { code: "42501" });
      await assert.rejects(db.query("select nextval('public.bug_reports_report_number_seq')"), { code: "42501" });
    });
  }

  // Even an accidental future table grant must not expose reports through RLS.
  await db.exec("grant select, insert, update on public.bug_reports to anon, authenticated;");
  for (const role of ["anon", "authenticated"]) {
    await asRole(db, role, async () => {
      assert.deepEqual((await db.query("select * from public.bug_reports")).rows, []);
      await assert.rejects(insertReport(db), { code: "42501", message: /row-level security/ });
      assert.deepEqual((await db.query("update public.bug_reports set approved_for_fix = true returning id")).rows, []);
    });
  }
});

test("bug-report SQL preserves the original reference when a client retries a saved report", async (t) => {
  const db = await fixture(t);
  await asRole(db, "service_role", async () => {
    const clientReportId = randomUUID();
    const original = await insertReport(db, { client_report_id: clientReportId });
    await assert.rejects(insertReport(db, { client_report_id: clientReportId }), { code: "23505" });
    const duplicate = await db.query(
      "select report_number from public.bug_reports where client_report_id = $1",
      [clientReportId],
    );
    assert.equal(duplicate.rows.length, 1);
    assert.equal(getBugReportReference(duplicate.rows[0]), getBugReportReference(original));
    assert.equal((await db.query("select count(*)::integer as count from public.bug_reports")).rows[0].count, 1);
  });
});

test("bug-report SQL enforces report limits and triage values independently of API validation", async (t) => {
  const db = await fixture(t);
  await asRole(db, "service_role", async () => {
    const invalidReports = [
      { surface: "store" },
      { summary: "abc" },
      { summary: "x".repeat(161) },
      { description: "too short" },
      { description: "x".repeat(4001) },
      { steps: "x".repeat(4001) },
      { expected_behavior: "x".repeat(2001) },
      { impact: "critical" },
      { priority: "urgent" },
      { status: "published" },
      { admin_notes: "x".repeat(4001) },
      // Count UTF-8 bytes, including JSON formatting, rather than JS characters.
      { context: JSON.stringify({ text: "\u{1f420}".repeat(4000) }) },
    ];
    for (const report of invalidReports) {
      await assert.rejects(insertReport(db, report), { code: "23514" });
    }
    await assert.rejects(insertReport(db, { client_report_id: null }), { code: "23502" });
    assert.equal((await db.query("select count(*)::integer as count from public.bug_reports")).rows[0].count, 0);

    const boundary = await insertReport(db, {
      summary: "x".repeat(160),
      description: "x".repeat(4000),
      steps: "x".repeat(4000),
      expected_behavior: "x".repeat(2000),
      admin_notes: "x".repeat(4000),
      context: JSON.stringify({ text: "\u{1f420}".repeat(3997) }),
    });
    assert.equal(boundary.context.text.length, 3997 * 2);
  });
});

test("bug-report SQL can be rerun without losing saved reports, references, or role protection", async (t) => {
  const db = await fixture(t);
  const original = await asRole(db, "service_role", () => insertReport(db));
  await db.exec("grant select, insert on public.bug_reports to anon, authenticated;");
  await db.exec("grant usage, select on public.bug_reports_report_number_seq to anon, authenticated;");
  await db.exec(localSchema);
  await db.exec(localSchema);
  await asRole(db, "service_role", async () => {
    const persisted = (await db.query("select * from public.bug_reports where id = $1", [original.id])).rows[0];
    assert.deepEqual(persisted, original);
    const next = await insertReport(db);
    assert.equal(Number(next.report_number), Number(original.report_number) + 1);
  });
  for (const role of ["anon", "authenticated"]) {
    await asRole(db, role, async () => {
      await assert.rejects(db.query("select * from public.bug_reports"), { code: "42501" });
      await assert.rejects(insertReport(db), { code: "42501" });
      await assert.rejects(db.query("select nextval('public.bug_reports_report_number_seq')"), { code: "42501" });
    });
  }
});
