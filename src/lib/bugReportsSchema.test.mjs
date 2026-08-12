import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("bug reports use a private constrained Supabase table", async () => {
  const sql = await readFile(new URL("../../supabase/bug-reports.sql", import.meta.url), "utf8");

  assert.match(sql, /create table if not exists public\.bug_reports/i);
  assert.match(sql, /client_report_id text not null unique/i);
  assert.match(sql, /check \(surface in \('reefbound', 'simulator'\)\)/i);
  assert.match(sql, /check \(priority in \('critical', 'high', 'normal', 'low', 'untriaged'\)\)/i);
  assert.match(sql, /approved_for_fix boolean not null default false/i);
  assert.match(sql, /octet_length\(context::text\) <= 16000/i);
  assert.match(sql, /enable row level security/i);
  assert.match(sql, /using \(false\)[\s\S]*with check \(false\)/i);
  assert.match(sql, /revoke all on table public\.bug_reports from anon, authenticated/i);
  assert.match(sql, /revoke all on sequence public\.bug_reports_report_number_seq from anon, authenticated/i);
  assert.match(sql, /bug_reports_priority_submitted_at_idx/i);
  assert.match(sql, /bug_reports_status_submitted_at_idx/i);
});

test("the owner dashboard keeps approval separate and prevents stale updates", async () => {
  const [handler, dashboard] = await Promise.all([
    readFile(new URL("../app/api/admin/bug-reports/handler.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/bugs/BugReportsDashboard.jsx", import.meta.url), "utf8"),
  ]);

  assert.match(handler, /configuredToken\?\.length >= 32/);
  assert.match(handler, /\.eq\("updated_at", expectedUpdatedAt\)/);
  assert.match(handler, /changed in another review session[\s\S]{0,160}\}, 409\);/);
  assert.match(dashboard, /expectedUpdatedAt: report\.updated_at/);
  assert.match(dashboard, /Approve for a code change/);
  assert.match(dashboard, /does not edit, commit, or publish code/);
  assert.match(dashboard, /buildApprovedBugReportBrief\(reports\)/);
});
