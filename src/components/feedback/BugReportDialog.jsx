"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BUG_REPORT_IMPACT_OPTIONS } from "@/lib/bugReports.mjs";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function getFocusableControls(dialog) {
  if (!dialog) return [];
  return [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)].filter((element) => (
    !element.hasAttribute("hidden")
    && element.getAttribute("aria-hidden") !== "true"
    && !element.closest("[inert]")
    && element.getClientRects().length > 0
  ));
}

function restoreAttribute(element, name, previousValue) {
  if (previousValue === null) element.removeAttribute(name);
  else element.setAttribute(name, previousValue);
}

function createClientReportId() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `report-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function reportReference(number) {
  return Number.isSafeInteger(Number(number))
    ? `BR-${String(number).padStart(4, "0")}`
    : "your report";
}

export default function BugReportDialog({
  open,
  surface,
  context = {},
  onClose,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const summaryRef = useRef(null);
  const successActionRef = useRef(null);
  const dialogRef = useRef(null);
  const openerRef = useRef(null);
  const openRef = useRef(open);
  const frozenContextRef = useRef(null);
  const [clientReportId, setClientReportId] = useState(createClientReportId);
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState("");
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [impact, setImpact] = useState("unsure");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  openRef.current = open;

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const contextSnapshot = typeof globalThis.structuredClone === "function"
      ? globalThis.structuredClone(context)
      : JSON.parse(JSON.stringify(context));
    frozenContextRef.current = {
      ...contextSnapshot,
      route: window.location.pathname,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      browser: window.navigator.userAgent.slice(0, 300),
      capturedAt: new Date().toISOString(),
    };
    setStatus("idle");
    setMessage("");
    const frame = window.requestAnimationFrame(() => summaryRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const dialog = dialogRef.current;
    const backgroundStates = [...document.body.children]
      .filter((element) => (
        element !== dialog
        && !["LINK", "SCRIPT", "STYLE"].includes(element.tagName)
      ))
      .map((element) => ({
        element,
        inert: element.getAttribute("inert"),
        ariaHidden: element.getAttribute("aria-hidden"),
      }));
    const previousOverflow = document.body.style.overflow;
    backgroundStates.forEach(({ element }) => {
      element.setAttribute("inert", "");
      element.setAttribute("aria-hidden", "true");
    });
    document.body.style.overflow = "hidden";

    return () => {
      backgroundStates.forEach(({ element, inert, ariaHidden }) => {
        if (!element.isConnected) return;
        restoreAttribute(element, "inert", inert);
        restoreAttribute(element, "aria-hidden", ariaHidden);
      });
      document.body.style.overflow = previousOverflow;
      const opener = openerRef.current;
      openerRef.current = null;
      window.requestAnimationFrame(() => {
        if (!openRef.current && opener?.isConnected) {
          opener.focus({ preventScroll: true });
        }
      });
    };
  }, [open]);

  useEffect(() => {
    if (!open || status !== "success") return undefined;
    const frame = window.requestAnimationFrame(() => {
      successActionRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, status]);

  function resetReport() {
    setSummary("");
    setDescription("");
    setSteps("");
    setExpectedBehavior("");
    setImpact("unsure");
    setClientReportId(createClientReportId());
    setStatus("idle");
    setMessage("");
  }

  function requestClose() {
    if (status === "success") resetReport();
    onClose();
  }

  useEffect(() => {
    if (!open) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (status !== "submitting") requestClose();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = dialogRef.current;
      const controls = getFocusableControls(dialog);
      if (!controls.length) {
        event.preventDefault();
        dialog?.focus({ preventScroll: true });
        return;
      }
      const first = controls[0];
      const last = controls.at(-1);
      const activeElement = document.activeElement;
      if (!dialog?.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (event.shiftKey && (activeElement === first || !controls.includes(activeElement))) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && (activeElement === last || !controls.includes(activeElement))) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose, open, status]);

  if (!open || typeof document === "undefined") return null;

  function clearAndClose() {
    resetReport();
    onClose();
  }

  async function submitReport(event) {
    event.preventDefault();
    setStatus("submitting");
    setMessage("");

    try {
      const response = await fetch("/api/bug-reports", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surface,
          summary,
          description,
          steps,
          expectedBehavior,
          impact,
          clientReportId,
          context: frozenContextRef.current ?? context,
          website: "",
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error ?? "The report could not be saved.");

      setStatus("success");
      setMessage(`Thank you. ${reportReference(result?.report?.number)} is in the review list.`);
    } catch (error) {
      setStatus("error");
      setMessage(error?.message ?? "The report could not be saved. Please try again.");
    }
  }

  const isBusy = status === "submitting";
  const isReefbound = surface === "reefbound";

  const dialog = (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-[260] flex items-start justify-center overflow-y-auto bg-slate-950/85 p-3 backdrop-blur-sm sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <section className="my-auto w-full max-w-2xl rounded-3xl border border-cyan-200/30 bg-slate-950 p-5 text-slate-100 shadow-2xl sm:p-7">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
              {isReefbound ? "Reefbound" : "SeaPals Simulator"}
            </p>
            <h2 id={titleId} className="mt-1 text-2xl font-black text-white">Report a bug</h2>
            <p id={descriptionId} className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
              Tell us what went wrong. Helpful game details are attached, but your name, email, and save file are not.
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={isBusy}
            aria-label="Close bug report"
            className="grid min-h-11 min-w-11 place-items-center rounded-full border border-white/15 bg-white/5 text-xl font-black hover:bg-white/10 disabled:opacity-40"
          >
            ×
          </button>
        </header>

        {status === "success" ? (
          <div className="mt-6 rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-5" role="status">
            <strong className="text-lg text-emerald-200">Report received</strong>
            <p className="mt-2 text-sm leading-6 text-emerald-50">{message}</p>
            <button ref={successActionRef} type="button" onClick={clearAndClose} className="mt-5 rounded-full bg-emerald-400 px-6 py-3 font-black text-slate-950 hover:bg-emerald-300">
              Return to the game
            </button>
          </div>
        ) : (
          <form className="mt-6 space-y-5" onSubmit={submitReport}>
            <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-50">
              <strong>Keep personal information out of the report.</strong> Do not enter a name, email, school, address, or phone number. Players under 13 should ask a grown-up to help submit it.
              {" "}<a href="/privacy#collection" target="_blank" rel="noreferrer" className="font-black underline">Privacy</a>
              {" · "}<a href="/terms" target="_blank" rel="noreferrer" className="font-black underline">Terms</a>
            </div>

            <label className="block">
              <span className="text-sm font-black text-white">Short summary</span>
              <input
                ref={summaryRef}
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                required
                minLength={4}
                maxLength={160}
                disabled={isBusy}
                placeholder="Creature School stayed in play at 0 HP"
                className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
              />
            </label>

            <label className="block">
              <span className="text-sm font-black text-white">What happened?</span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
                minLength={10}
                maxLength={4000}
                rows={4}
                disabled={isBusy}
                placeholder="Describe what you saw and what you were doing when it happened."
                className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20"
              />
            </label>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-black text-white">Steps to repeat it <span className="font-semibold text-slate-400">(optional)</span></span>
                <textarea value={steps} onChange={(event) => setSteps(event.target.value)} maxLength={4000} rows={3} disabled={isBusy} className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20" />
              </label>
              <label className="block">
                <span className="text-sm font-black text-white">What should have happened? <span className="font-semibold text-slate-400">(optional)</span></span>
                <textarea value={expectedBehavior} onChange={(event) => setExpectedBehavior(event.target.value)} maxLength={2000} rows={3} disabled={isBusy} className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20" />
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-black text-white">How did it affect play?</span>
              <select value={impact} onChange={(event) => setImpact(event.target.value)} disabled={isBusy} className="mt-2 min-h-12 w-full rounded-xl border border-white/15 bg-slate-900 px-4 py-3 text-white outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-300/20">
                {BUG_REPORT_IMPACT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>

            {message ? (
              <p className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm font-bold text-rose-100" role="alert">{message}</p>
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={requestClose} disabled={isBusy} className="min-h-12 rounded-full border border-white/15 px-6 py-3 font-black text-slate-200 hover:bg-white/10 disabled:opacity-40">Cancel</button>
              <button type="submit" disabled={isBusy} className="min-h-12 rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 px-7 py-3 font-black text-slate-950 hover:brightness-110 disabled:cursor-wait disabled:opacity-60">
                {isBusy ? "Sending report…" : "Send bug report"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );

  return (
    createPortal(dialog, document.body)
  );
}
