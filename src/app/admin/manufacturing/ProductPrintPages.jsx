"use client";
import { useEffect, useRef, useState } from "react";
import { isFlyerSheet, printSidesForSheet } from "../../../lib/manufacturing/sheetKinds.mjs";
import PagePreview from "./PagePreview";
import { pageReprintBlockedReason, pageReprintButtonLabel, pageReprintRetryKey, pageReprintSelectionError, pageReprintWasRejected, readPageReprintRetry, selectedPageTargets } from "./productPages.mjs";

const action = "rounded-xl bg-cyan-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-40";
const field = "mt-1 block w-full min-w-0 rounded-lg border border-slate-300 bg-white p-2 text-sm";
const statusLabels = { submitted: "Sent", confirmed: "Checked", needs_review: "Needs review", queued: "Queued", submitting: "Sending" };
const shortRun = (job) => job.displayNumber?.startsWith("STOCK-") ? `Stock ${job.displayNumber.slice(6, 14)}` : (job.displayNumber || "Saved run");
const runLabel = (job) => {
  const date = new Date(job.createdAt), copies = new Set(job.pages.map((page) => page.unit)).size;
  return `${Number.isFinite(date.getTime()) ? date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Saved run"} · ${shortRun(job)} · ${copies} ${copies === 1 ? "copy" : "copies"}`;
};

export default function ProductPrintPages({ productId, productName, busy, sessionKey, onLoadProductPages, onLoadPagePreview, onReprintPages, onOpenJob }) {
  const [snapshot, setSnapshot] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [orderId, setOrderId] = useState(""), [selected, setSelected] = useState([]), [previewId, setPreviewId] = useState("");
  const [printSide, setPrintSide] = useState("fronts"), [previewSide, setPreviewSide] = useState("fronts");
  const [reason, setReason] = useState("Replace damaged or missing pages"), [pending, setPending] = useState(null), [submitting, setSubmitting] = useState(false), [success, setSuccess] = useState("");
  const callbacks = useRef({ onLoadProductPages, onReprintPages });
  callbacks.current = { onLoadProductPages, onReprintPages };
  const readVersion = useRef(0), controller = useRef(null), source = useRef(""), mounted = useRef(false), sending = useRef(false), pendingRef = useRef(null);
  const storageKey = pageReprintRetryKey(productId);
  async function refresh(preferredId = source.current) {
    controller.current?.abort();
    const abort = new AbortController(), version = ++readVersion.current;
    controller.current = abort;
    setLoading(true);
    try {
      const data = await callbacks.current.onLoadProductPages(productId, { signal: abort.signal });
      if (!mounted.current || version !== readVersion.current) return false;
      setSnapshot(data);
      const next = data.jobs.find((job) => job.orderId === preferredId) ?? data.jobs[0];
      const changed = source.current !== (next?.orderId ?? "");
      source.current = next?.orderId ?? "";
      setOrderId(source.current);
      setSelected((ids) => changed ? [] : ids.filter((id) => next?.pages.some((page) => page.sheetId === id)));
      setPreviewId((id) => !changed && next?.pages.some((page) => page.sheetId === id) ? id : next?.pages[0]?.sheetId ?? "");
      return true;
    } catch (e) {
      if (!mounted.current || version !== readVersion.current || e.name === "AbortError") return false;
      setError(e.message || "Could not load saved print pages.");
      return false;
    } finally {
      if (mounted.current && version === readVersion.current) setLoading(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    let saved = null;
    try { saved = readPageReprintRetry(sessionStorage.getItem(storageKey), productId); } catch {}
    pendingRef.current = saved;
    setPending(saved);
    source.current = saved?.orderId ?? "";
    setOrderId(source.current);
    setSnapshot(null);
    setSelected([]);
    setPreviewId("");
    setError("");
    setSuccess("");
    refresh(source.current);
    return () => {
      mounted.current = false;
      readVersion.current++;
      controller.current?.abort();
    };
  }, [productId, sessionKey]);

  const jobs = snapshot?.jobs ?? [], job = jobs.find((entry) => entry.orderId === orderId), pages = job?.pages ?? [];
  const selectedPages = pages.filter((page) => selected.includes(page.sheetId));
  const flyersOnly = selectedPages.length > 0 && selectedPages.every(isFlyerSheet);
  const effectivePrintSide = flyersOnly ? "fronts" : printSide;
  const targets = selectedPageTargets(pages, selected, effectivePrintSide), blocker = pageReprintBlockedReason(job);
  const selectionError = pageReprintSelectionError(targets);
  const disabled = busy || submitting || !!pending;
  const repeated = new Set(pages.map((page) => page.unit)).size > 1;
  const preview = pages.find((page) => page.sheetId === previewId);
  const previewSides = preview ? printSidesForSheet(preview) : [];
  const effectivePreviewSide = previewSides.includes(previewSide) ? previewSide : "fronts";
  function chooseJob(id) {
    source.current = id;
    setOrderId(id);
    setSelected([]);
    setPreviewId(jobs.find((entry) => entry.orderId === id)?.pages[0]?.sheetId ?? "");
    setError("");
    setSuccess("");
  }
  async function submit() {
    if (sending.current || busy) return;
    const firstAttempt = !pendingRef.current;
    if (firstAttempt && (!job || blocker || selectionError || !targets.length || !reason.trim())) return;
    const saved = pendingRef.current ?? { id: crypto.randomUUID(), orderId: job.orderId, revision: job.revision, productId, targets, reason: reason.trim() };
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(saved));
    } catch {
      setError("The browser could not save this reprint for safe retries. Enable session storage before sending pages.");
      return;
    }
    sending.current = true;
    pendingRef.current = saved;
    setPending(saved);
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      await callbacks.current.onReprintPages(saved);
      sessionStorage.removeItem(storageKey);
      pendingRef.current = null;
      if (!mounted.current) return;
      setPending(null);
      setSelected([]);
      setSuccess(`${saved.targets.length} ${saved.targets.length === 1 ? "page" : "pages"} queued for reprint. Inventory counts are unchanged.`);
      await refresh(saved.orderId);
    } catch (e) {
      if (pageReprintWasRejected(e, firstAttempt)) {
        try {
          sessionStorage.removeItem(storageKey);
          pendingRef.current = null;
          if (mounted.current) setPending(null);
        } catch {}
      }
      if (!mounted.current) return;
      setError(e.message || "The reprint request did not return a response.");
      if (!pendingRef.current) await refresh(saved.orderId);
    } finally {
      sending.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }
  return (
    <section className="min-w-0 space-y-4" aria-label={`${productName} print pages`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900">Print pages</h3>
          <p className="mt-1 text-sm text-slate-600">Choose a saved run to match its artwork and alignment.</p>
        </div>
        <button type="button" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold disabled:opacity-40" disabled={busy || loading || submitting} onClick={() => { setError(""); refresh(); }}>Refresh pages</button>
      </div>
      {error && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{error}</p>}
      {success && <p role="status" className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-950">{success}</p>}
      {pending && <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
        <p className="font-bold">{submitting ? "Sending selected pages…" : "Check the saved reprint request"}</p>
        <p className="mt-1">{pending.targets.length} {pending.targets.length === 1 ? "page was" : "pages were"} requested. Retrying checks the same request without printing a second copy.</p>
        <button type="button" className={`${action} mt-3`} disabled={busy || submitting} onClick={submit}>Retry same reprint</button>
      </div>}
      {loading && !snapshot ? <p role="status" className="py-5 text-sm text-slate-600">Loading saved print pages…</p> : !snapshot ? <p className="py-4 text-sm text-slate-600">Saved pages could not be loaded. Refresh pages to retry.</p> : !jobs.length ? <p className="rounded-xl bg-white p-4 text-sm text-slate-600">No matching pages in the latest {snapshot.historyLimit ?? 100} prepared runs across all products. Older runs are not included. If this product has not been printed yet, create a stock build and send it to the printers first.</p> : <>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 text-xs font-bold text-slate-700">Recent saved print run
            <select className={field} value={orderId} disabled={disabled || loading} onChange={(event) => chooseJob(event.target.value)}>
              {jobs.map((entry) => <option key={entry.orderId} value={entry.orderId}>{runLabel(entry)}</option>)}
            </select>
          </label>
          {onOpenJob && <button type="button" className="rounded-lg px-2 py-2 text-xs font-bold text-cyan-900 underline" disabled={busy || submitting} onClick={() => onOpenJob(orderId)}>Open workshop run</button>}
        </div>
        <p className="text-xs text-slate-500">Showing matching pages from the latest {snapshot.historyLimit ?? 100} prepared runs across all products.</p>
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-700">{selected.length} of {pages.length} sheets selected</p>
              <div className="flex gap-3 text-xs font-bold text-cyan-900">
                <button type="button" className="underline disabled:opacity-40" disabled={disabled || loading} onClick={() => setSelected(pages.map((page) => page.sheetId))}>Select all</button>
                <button type="button" className="underline disabled:opacity-40" disabled={disabled || !selected.length} onClick={() => setSelected([])}>Clear</button>
              </div>
            </div>
            <div className="max-h-[28rem] overflow-y-auto rounded-xl border border-slate-200 bg-white">
              {pages.map((page, index) => <div key={page.sheetId} className={`flex items-start gap-2 border-b border-slate-100 p-3 last:border-b-0 ${previewId === page.sheetId ? "bg-cyan-50" : ""}`}>
                <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-cyan-900" checked={selected.includes(page.sheetId)} disabled={disabled || loading} aria-label={`Select ${page.label}${repeated ? `, copy ${page.unit}` : ""}`} onChange={(event) => {
                  setSelected((ids) => event.target.checked ? [...ids, page.sheetId] : ids.filter((id) => id !== page.sheetId));
                  setPreviewId(page.sheetId);
                }} />
                <button type="button" className="min-w-0 flex-1 text-left" aria-label={`Preview ${page.label}${repeated ? `, copy ${page.unit}` : ""}`} aria-pressed={previewId === page.sheetId} onClick={() => setPreviewId(page.sheetId)}>
                  <span className="block text-sm font-bold text-slate-900 [overflow-wrap:anywhere]">{repeated ? `Copy ${page.unit} · ` : ""}{page.label || `Page ${index + 1}`}</span>
                  <span className="mt-1 block text-[11px] text-slate-500">{isFlyerSheet(page) ? "Epson flyer" : "Front"}: {statusLabels[page.frontsStatus] ?? page.frontsStatus}{!isFlyerSheet(page) && <> · Back: {statusLabels[page.backsStatus] ?? page.backsStatus}</>}</span>
                </button>
              </div>)}
            </div>
          </div>
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap gap-1" aria-label="Preview side">
              {previewSides.map((side) => { const label = side === 'backs' ? 'Canon back' : isFlyerSheet(preview) ? 'Epson flyer' : 'Epson front'; return <button type="button" key={side} aria-pressed={effectivePreviewSide === side} onClick={() => setPreviewSide(side)} className={`rounded-lg px-3 py-2 text-xs font-bold ${effectivePreviewSide === side ? "bg-cyan-900 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>{label}</button>; })}
            </div>
            {preview && <>
              <p className="mb-2 text-xs font-bold text-slate-700">{repeated ? `Copy ${preview.unit} · ` : ""}{preview.label}</p>
              <PagePreview key={`${job.orderId}:${previewId}:${effectivePreviewSide}:${sessionKey}`} orderId={job.orderId} sheetId={previewId} side={effectivePreviewSide} onLoadPagePreview={onLoadPagePreview} />
            </>}
          </div>
        </div>
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)]">
            <label className="text-xs font-bold text-slate-700">Sides to reprint
              <select className={field} value={effectivePrintSide} disabled={disabled} onChange={(event) => { setPrintSide(event.target.value); setPreviewSide(event.target.value === "backs" ? "backs" : "fronts"); }}>
                <option value="fronts">Fronts only · Epson</option>
                {!flyersOnly && <option value="backs">Backs only · Canon</option>}
                {!flyersOnly && <option value="both">Fronts and backs</option>}
              </select>
            </label>
            <label className="text-xs font-bold text-slate-700">Reason
              <input className={field} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} disabled={disabled} />
            </label>
          </div>
          {selectedPages.some(isFlyerSheet) && <p className="text-xs text-slate-600">Flyers print on Epson only. Canon selections include card backs only.</p>}
          {blocker && <p role="status" className="text-xs text-amber-900">{blocker}</p>}
          {selectionError && <p role="alert" className="text-xs text-amber-900">{selectionError}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={action} disabled={disabled || loading || !!blocker || !!selectionError || !targets.length || !reason.trim()} onClick={submit}>{pageReprintButtonLabel(targets)}</button>
            <p className="min-w-0 flex-1 text-xs text-slate-600">Queues one replacement of each selected side. Finished inventory changes only when you receive packaged products.</p>
          </div>
        </div>
      </>}
    </section>
  );
}
