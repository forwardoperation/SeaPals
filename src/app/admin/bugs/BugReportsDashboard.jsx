"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BUG_REPORT_PRIORITY_OPTIONS,
  BUG_REPORT_STATUS_OPTIONS,
  buildApprovedBugReportBrief,
  compareBugReports,
  getBugReportReference,
} from "@/lib/bugReports.mjs";

const TOKEN_STORAGE_KEY = "seapals-bug-report-admin-token";

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function label(value) {
  return String(value ?? "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function priorityClasses(priority) {
  return {
    critical: "border-rose-300 bg-rose-50 text-rose-900",
    high: "border-orange-300 bg-orange-50 text-orange-900",
    normal: "border-sky-300 bg-sky-50 text-sky-900",
    low: "border-slate-300 bg-slate-50 text-slate-700",
    untriaged: "border-violet-300 bg-violet-50 text-violet-900",
  }[priority] ?? "border-slate-300 bg-slate-50 text-slate-700";
}

function downloadJson(reports) {
  const blob = new Blob([JSON.stringify(reports, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `seapals-bug-reports-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function BugReportsDashboard() {
  const [token, setToken] = useState("");
  const [reports, setReports] = useState([]);
  const [draftNotes, setDraftNotes] = useState({});
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState("info");
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState("");
  const [sort, setSort] = useState("priority");
  const [surfaceFilter, setSurfaceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("open");
  const [approvalFilter, setApprovalFilter] = useState("all");

  useEffect(() => {
    try {
      setToken(window.sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? "");
    } catch {
      // A private session can still use the in-memory token field.
    }
  }, []);

  const visibleReports = useMemo(() => reports
    .filter((report) => surfaceFilter === "all" || report.surface === surfaceFilter)
    .filter((report) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "open") return !["fixed", "closed"].includes(report.status);
      return report.status === statusFilter;
    })
    .filter((report) => {
      if (approvalFilter === "all") return true;
      return approvalFilter === "approved"
        ? report.approved_for_fix === true
        : report.approved_for_fix !== true;
    })
    .sort((first, second) => compareBugReports(first, second, sort)), [
      approvalFilter,
      reports,
      sort,
      statusFilter,
      surfaceFilter,
    ]);

  const counts = useMemo(() => reports.reduce((totals, report) => {
    totals.total += 1;
    if (!["fixed", "closed"].includes(report.status)) totals.open += 1;
    if (report.priority === "untriaged") totals.untriaged += 1;
    if (report.approved_for_fix && !["fixed", "closed"].includes(report.status)) {
      totals.approved += 1;
    }
    return totals;
  }, { total: 0, open: 0, untriaged: 0, approved: 0 }), [reports]);

  const hasUnsavedNotes = useMemo(() => reports.some((report) => (
    (draftNotes[report.id] ?? "") !== (report.admin_notes ?? "")
  )), [draftNotes, reports]);

  function rememberToken(value) {
    setToken(value);
    try {
      if (value) window.sessionStorage.setItem(TOKEN_STORAGE_KEY, value);
      else window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // Keep the token only in component state if browser storage is unavailable.
    }
  }

  async function loadReports() {
    if (hasUnsavedNotes && !window.confirm("Refresh and discard unsaved owner notes?")) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/bug-reports", {
        headers: { "x-admin-token": token },
        cache: "no-store",
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "Bug reports could not be loaded.");
      const nextReports = result?.reports ?? [];
      setReports(nextReports);
      setDraftNotes(Object.fromEntries(nextReports.map((report) => [report.id, report.admin_notes ?? ""])));
      rememberToken(token);
      setMessageKind("success");
      setMessage(`Loaded ${nextReports.length} bug report${nextReports.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setMessageKind("error");
      setMessage(error?.message ?? "Bug reports could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function updateReport(report, patch, successMessage) {
    setSavingId(report.id);
    setMessage("");
    try {
      const response = await fetch("/api/admin/bug-reports", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify({
          id: report.id,
          expectedUpdatedAt: report.updated_at,
          ...patch,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "The bug report could not be updated.");
      setReports((current) => current.map((item) => item.id === report.id ? result.report : item));
      if (Object.hasOwn(patch, "adminNotes")) {
        setDraftNotes((current) => ({ ...current, [report.id]: result.report.admin_notes ?? "" }));
      }
      setMessageKind("success");
      setMessage(successMessage);
    } catch (error) {
      setMessageKind("error");
      setMessage(error?.message ?? "The bug report could not be updated.");
    } finally {
      setSavingId("");
    }
  }

  async function toggleApproval(report) {
    const approving = !report.approved_for_fix;
    if (approving && !window.confirm(
      `Approve ${getBugReportReference(report)} for a code change? This puts it in the Codex work queue but does not edit, commit, or publish code.`,
    )) return;

    await updateReport(
      report,
      { approvedForFix: approving },
      approving
        ? `${getBugReportReference(report)} is approved for investigation and a proposed code change.`
        : `${getBugReportReference(report)} was removed from the approved work queue.`,
    );
  }

  async function copyApprovedQueue() {
    const brief = buildApprovedBugReportBrief(reports);
    try {
      await navigator.clipboard.writeText(brief);
      setMessageKind("success");
      setMessage("Copied the approved bug-fix queue for Codex.");
    } catch {
      setMessageKind("error");
      setMessage("Clipboard access was blocked. Download the JSON list instead.");
    }
  }

  return (
    <main className="space-y-6 py-6">
      <section>
        <p className="text-sm font-black uppercase tracking-[0.16em] text-sky-700">SeaPals staff</p>
        <h1 className="mt-2 text-4xl font-black text-slate-950">Bug review</h1>
        <p className="mt-3 max-w-3xl leading-7 text-slate-600">
          Triage reports from Reefbound and the Simulator. Priority, progress, and permission to change code are deliberately separate decisions.
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="text-sm font-black text-slate-700" htmlFor="bug-admin-token">Bug report admin token</label>
        <div className="mt-2 flex flex-col gap-3 md:flex-row">
          <input id="bug-admin-token" type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="current-password" className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3" />
          <button type="button" onClick={loadReports} disabled={loading || !token.trim()} className="rounded-xl bg-sky-700 px-6 py-3 font-black text-white hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300">
            {loading ? "Loading…" : reports.length ? "Refresh reports" : "Load reports"}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">The token stays in this browser tab and is sent only to the private review endpoint.</p>
      </section>

      {message ? (
        <p className={`rounded-2xl border px-4 py-3 text-sm font-bold ${messageKind === "error" ? "border-rose-200 bg-rose-50 text-rose-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`} role={messageKind === "error" ? "alert" : "status"}>{message}</p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Bug report totals">
        {[["All reports", counts.total], ["Open", counts.open], ["Untriaged", counts.untriaged], ["Approved", counts.approved]].map(([name, count]) => (
          <div key={name} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><span className="text-xs font-black uppercase tracking-wider text-slate-500">{name}</span><strong className="mt-2 block text-3xl text-slate-950">{count}</strong></div>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm font-bold text-slate-700">Sort
              <select value={sort} onChange={(event) => setSort(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3">
                <option value="priority">Priority</option><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="updated">Recently updated</option>
              </select>
            </label>
            <label className="text-sm font-bold text-slate-700">Product
              <select value={surfaceFilter} onChange={(event) => setSurfaceFilter(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3">
                <option value="all">Both products</option><option value="reefbound">Reefbound</option><option value="simulator">Simulator</option>
              </select>
            </label>
            <label className="text-sm font-bold text-slate-700">Status
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3">
                <option value="open">All open</option><option value="all">Any status</option>{BUG_REPORT_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="text-sm font-bold text-slate-700">Code approval
              <select value={approvalFilter} onChange={(event) => setApprovalFilter(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3">
                <option value="all">Any approval</option><option value="approved">Approved only</option><option value="not-approved">Not approved</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copyApprovedQueue} disabled={!counts.approved} className="min-h-11 rounded-xl bg-violet-700 px-4 py-2 font-black text-white hover:bg-violet-800 disabled:opacity-40">Copy approved queue for Codex</button>
            <button type="button" onClick={() => downloadJson(visibleReports)} disabled={!visibleReports.length} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40">Download visible JSON</button>
          </div>
        </div>
      </section>

      <section className="space-y-4" aria-label="Bug reports">
        {visibleReports.map((report) => {
          const saving = Boolean(savingId);
          return (
            <article key={report.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wider ${priorityClasses(report.priority)}`}>{label(report.priority)}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-700">{label(report.surface)}</span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600">{label(report.status)}</span>
                    {report.approved_for_fix ? <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wider text-emerald-900">Approved for code</span> : null}
                  </div>
                  <p className="mt-4 text-sm font-black text-sky-800">{getBugReportReference(report)}</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">{report.summary}</h2>
                  <p className="mt-2 text-xs font-semibold text-slate-500">Submitted {formatDate(report.submitted_at)} · Impact: {label(report.impact)}</p>
                  <div className="mt-5 space-y-4 text-sm leading-7 text-slate-700">
                    <div><h3 className="font-black text-slate-950">What happened</h3><p className="whitespace-pre-wrap">{report.description}</p></div>
                    {report.steps ? <div><h3 className="font-black text-slate-950">Steps to repeat</h3><p className="whitespace-pre-wrap">{report.steps}</p></div> : null}
                    {report.expected_behavior ? <div><h3 className="font-black text-slate-950">Expected behavior</h3><p className="whitespace-pre-wrap">{report.expected_behavior}</p></div> : null}
                  </div>
                  <details className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <summary className="cursor-pointer font-black text-slate-800">Captured game diagnostics</summary>
                    <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-slate-700">{JSON.stringify(report.context ?? {}, null, 2)}</pre>
                  </details>
                </div>

                <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="font-black text-slate-950">Triage</h3>
                  <div className="mt-4 space-y-4">
                    <label className="block text-sm font-bold text-slate-700">Priority
                      <select value={report.priority} disabled={saving} onChange={(event) => updateReport(report, { priority: event.target.value }, `${getBugReportReference(report)} priority updated.`)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3">
                        {BUG_REPORT_PRIORITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <label className="block text-sm font-bold text-slate-700">Status
                      <select value={report.status} disabled={saving} onChange={(event) => updateReport(report, { status: event.target.value }, `${getBugReportReference(report)} status updated.`)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3">
                        {BUG_REPORT_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <label className="block text-sm font-bold text-slate-700">Owner notes
                      <textarea value={draftNotes[report.id] ?? ""} onChange={(event) => setDraftNotes((current) => ({ ...current, [report.id]: event.target.value }))} maxLength={4000} rows={5} disabled={saving} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2" placeholder="Reproduction notes, constraints, or acceptance criteria" />
                    </label>
                    <button type="button" disabled={saving || (draftNotes[report.id] ?? "") === (report.admin_notes ?? "")} onClick={() => updateReport(report, { adminNotes: draftNotes[report.id] ?? "" }, `${getBugReportReference(report)} notes saved.`)} className="min-h-11 w-full rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 font-black text-sky-900 hover:bg-sky-100 disabled:opacity-40">Save owner notes</button>
                    <div className="border-t border-slate-200 pt-4">
                      <button type="button" disabled={saving} onClick={() => toggleApproval(report)} className={`min-h-12 w-full rounded-xl px-4 py-3 font-black ${report.approved_for_fix ? "border border-rose-300 bg-white text-rose-800 hover:bg-rose-50" : "bg-emerald-700 text-white hover:bg-emerald-800"}`}>
                        {saving ? "Saving…" : report.approved_for_fix ? "Withdraw code approval" : "Approve for a code change"}
                      </button>
                      <p className="mt-2 text-xs leading-5 text-slate-500">Approval adds this report to the Codex work queue. It never edits or publishes code automatically.</p>
                    </div>
                  </div>
                </aside>
              </div>
            </article>
          );
        })}
        {!visibleReports.length ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">{reports.length ? "No reports match these filters." : "Load the private bug list to begin review."}</div> : null}
      </section>
    </main>
  );
}
