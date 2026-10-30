"use client";
import { useEffect, useState, useRef } from "react";
import { isPrintSubmitted, workflowReadiness } from "@/lib/manufacturing/readiness.mjs";
import FinishedInventory from "./FinishedInventory";
import StockReceiving from "./StockReceiving";
import { RECEIPT_RETRY_KEY, readReceiptRetry, receiptWasRejected } from "./receiving.mjs";
import { createRefreshGuard, formatManufacturingMessage, printFeedback } from "./printFeedback.mjs";
import { reprintReadiness, sheetDisplayLabel } from "./sheetRecovery.mjs";

const TOKEN_KEY = "seapals-store-admin-token";
const STOCK_RETRY_KEY = "seapals-manufacturing-stock-retry";
const panel = "min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm [overflow-wrap:anywhere]";
const button =
  "rounded-xl bg-cyan-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-40";
const labels = {
  queued: "Waiting for printer",
  submitting: "Sending to printer",
  submitted: "Sent to printer",
  needs_review: "Print outcome needs review",
  confirmed: "Printed and checked",
};
export default function ManufacturingDashboard() {
  const [token, setToken] = useState(""),
    [rows, setRows] = useState([]),
    [selected, setSelected] = useState(""),
    [detail, setDetail] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [enabled, setEnabled] = useState(false),
    [loggedIn, setLoggedIn] = useState(false),
    [reprint, setReprint] = useState(null),
    [reason, setReason] = useState(""),
    [manualId, setManualId] = useState("");
  const [stock, setStock] = useState([]),
    [movements, setMovements] = useState([]),
    [barcodes, setBarcodes] = useState([]);
  const pendingReceipt = useRef(null);
  const [receiptRetry, setReceiptRetry] = useState(null);
  const [lastReceipt, setLastReceipt] = useState(null);
  const pendingStock = useRef(null);
  const [stockRetry, setStockRetry] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null),
    [refreshError, setRefreshError] = useState("");
  const reads = useRef(null);
  if (!reads.current) reads.current = createRefreshGuard();
  const busyRef = useRef(false),
    tokenRef = useRef(""),
    selectedRef = useRef(""),
    authVersion = useRef(0),
    refreshRef = useRef(null);
  function setWorking(value) {
    busyRef.current = value;
    setBusy(value);
  }
  function invalidateSession() {
    authVersion.current += 1;
    reads.current.invalidate();
    setWorking(false);
    setLoggedIn(false);
    setRows([]);
    setStock([]);
    setMovements([]);
    setBarcodes([]);
    setDetail(null);
    setReprint(null);
    setLastUpdated(null);
    setRefreshError("");
  }
  useEffect(() => {
    tokenRef.current = sessionStorage.getItem(TOKEN_KEY) ?? "";
    selectedRef.current = new URLSearchParams(location.search).get("order") ?? "";
    setToken(tokenRef.current);
    setSelected(selectedRef.current);
    try {
      const pending = JSON.parse(sessionStorage.getItem(STOCK_RETRY_KEY));
      if (pending?.id && pending.payload) {
        pendingStock.current = pending;
        setStockRetry(pending);
      }
    } catch {}
    const receipt = readReceiptRetry(sessionStorage.getItem(RECEIPT_RETRY_KEY));
    if (receipt) {
      pendingReceipt.current = receipt;
      setReceiptRetry(receipt);
    }
  }, []);
  async function request(payload, id, { signal, credential = tokenRef.current } = {}) {
    const r = await fetch(
      `/api/admin/manufacturing${id ? `?orderId=${encodeURIComponent(id)}` : ""}`,
      {
        method: payload ? "POST" : "GET",
        headers: {
          "x-admin-token": credential,
          ...(payload ? { "Content-Type": "application/json" } : {}),
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        cache: "no-store",
        signal,
      },
    );
    const data = await r.json();
    if (!r.ok) {
      const error = new Error(data.error ?? "Request failed.");
      error.status = r.status;
      throw error;
    }
    return data;
  }
  async function load(id = selectedRef.current, { background = false } = {}) {
    if (background && busyRef.current) return;
    const read = reads.current.begin({ replace: !background });
    if (!read) return;
    const credential = tokenRef.current;
    const version = authVersion.current;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      read.abort();
    }, 20000);
    if (!background) {
      setWorking(true);
      setError("");
      if (id !== selectedRef.current) {
        setDetail(null);
        setReprint(null);
      }
      selectedRef.current = id;
      setSelected(id);
      history.replaceState(null, "", id ? `?order=${encodeURIComponent(id)}` : location.pathname);
    }
    const isCurrent = () => read.isCurrent() && version === authVersion.current;
    try {
      const [list, nextDetail] = await Promise.all([
        request(null, null, { signal: read.signal, credential }),
        id ? request(null, id, { signal: read.signal, credential }) : null,
      ]);
      if (!isCurrent()) return;
      setRows(list.orders);
      setStock(list.stock ?? []);
      setMovements(list.movements ?? []);
      setBarcodes(list.barcodes ?? []);
      setEnabled(list.enabled);
      setDetail(nextDetail);
      setLoggedIn(true);
      setLastUpdated(new Date());
      setRefreshError("");
      sessionStorage.setItem(TOKEN_KEY, credential);
    } catch (e) {
      if (!isCurrent() || (e.name === "AbortError" && !timedOut)) return;
      if (e.status === 401) {
        invalidateSession();
        setError("Staff authentication expired. Open the queue again with your staff token.");
      } else if (background) {
        setRefreshError("Live refresh could not connect. Showing the last update; retrying automatically.");
      } else setError(timedOut ? "The queue refresh timed out. Please try again." : e.message);
    } finally {
      clearTimeout(timeout);
      if (isCurrent() && !background) setWorking(false);
      // Also cancels the companion GET if either half of the refresh failed.
      if (read.isCurrent()) reads.current.invalidate();
    }
  }
  refreshRef.current = load;
  useEffect(() => {
    if (!loggedIn) return;
    let stopped = false;
    let running = false;
    let timer;
    async function tick() {
      clearTimeout(timer);
      if (stopped || running || document.visibilityState !== "visible") return;
      running = true;
      try {
        await refreshRef.current(undefined, { background: true });
      } finally {
        running = false;
        if (!stopped && document.visibilityState === "visible")
          timer = setTimeout(tick, 5000);
      }
    }
    function visibilityChanged() {
      clearTimeout(timer);
      if (document.visibilityState === "visible") tick();
      else if (!busyRef.current) reads.current.invalidate();
    }
    timer = setTimeout(tick, 5000);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibilityChanged);
      reads.current.invalidate();
    };
  }, [loggedIn]);
  useEffect(() => () => {
    authVersion.current += 1;
    reads.current.invalidate();
  }, []);
  function beginMutation() {
    if (busyRef.current) return null;
    reads.current.invalidate();
    setWorking(true);
    setError("");
    const version = authVersion.current;
    return {
      credential: tokenRef.current,
      isCurrent: () => version === authVersion.current,
    };
  }
  async function update(type, fields = {}) {
    if (!detail?.state) return;
    if (type === "reprint") {
      const recovery = reprintReadiness(detail);
      if (recovery.blocked) {
        setError(recovery.message);
        return;
      }
    }
    const mutation = beginMutation();
    if (!mutation) return;
    try {
      await request({
        action: "event",
        orderId: selected,
        event: {
          id: crypto.randomUUID(),
          type,
          expectedRevision: detail.revision,
          ...fields,
        },
      }, null, mutation);
      if (!mutation.isCurrent()) return;
      setReprint(null);
      setReason("");
      await load(selected);
    } catch (e) {
      if (!mutation.isCurrent()) return false;
      setError(`${e.message} Refresh before trying again.`);
      setWorking(false);
    }
  }
  async function retry(id) {
    const mutation = beginMutation();
    if (!mutation) return;
    try {
      await request({ action: "retry", orderId: id }, null, mutation);
      if (!mutation.isCurrent()) return;
      await load(id);
    } catch (e) {
      if (!mutation.isCurrent()) return false;
      setError(e.message);
      setWorking(false);
    }
  }
  async function sendToPrinters() {
    if (!detail || detail.print_requested_at) return;
    const mutation = beginMutation();
    if (!mutation) return;
    try {
      await request({ action: "send_to_printers", orderId: selected }, null, mutation);
      if (!mutation.isCurrent()) return;
      await load(selected);
    } catch (e) {
      if (!mutation.isCurrent()) return false;
      setError(
        `${e.message} Refresh to check the queue. Retrying Send to printers will not create another print request.`,
      );
      setWorking(false);
    }
  }
  async function stockOperation(payload) {
    if (busyRef.current) return false;
    const fingerprint = JSON.stringify(payload);
    if (
      pendingStock.current &&
      pendingStock.current.fingerprint !== fingerprint
    ) {
      setError(
        "A stock action still needs a response. Retry the saved action, or check the stock history before discarding its retry.",
      );
      return false;
    }
    const mutation = beginMutation();
    if (!mutation) return false;
    if (!pendingStock.current)
      pendingStock.current = { fingerprint, payload, id: crypto.randomUUID() };
    sessionStorage.setItem(
      STOCK_RETRY_KEY,
      JSON.stringify(pendingStock.current),
    );
    setStockRetry(pendingStock.current);
    try {
      const result = await request({ ...payload, id: pendingStock.current.id }, null, mutation);
      if (!mutation.isCurrent()) return false;
      pendingStock.current = null;
      sessionStorage.removeItem(STOCK_RETRY_KEY);
      setStockRetry(null);
      await load(result.order_id ?? selected);
      return true;
    } catch (e) {
      if (!mutation.isCurrent()) return false;
      setError(
        `${e.message} Retry the same stock change if the connection failed.`,
      );
      setWorking(false);
      return false;
    }
  }
  async function setProductBarcode({ barcode, productId }) {
    const mutation = beginMutation();
    if (!mutation) return false;
    try {
      await request({ action: "set_product_barcode", barcode, productId }, null, mutation);
      if (!mutation.isCurrent()) return false;
      await load(selectedRef.current);
      return true;
    } catch (e) {
      if (!mutation.isCurrent()) return false;
      setError(e.message);
      setWorking(false);
      return false;
    }
  }
  async function receiveStock(payload) {
    if (pendingReceipt.current && JSON.stringify(pendingReceipt.current.payload) !== JSON.stringify(payload)) {
      setError("Resolve the saved receipt before receiving more products.");
      return false;
    }
    const mutation = beginMutation();
    if (!mutation) return false;
    const isFirstAttempt = !pendingReceipt.current;
    const saved = pendingReceipt.current ?? { id: crypto.randomUUID(), payload };
    try {
      // Persist before sending. If saving fails, no inventory request is made.
      sessionStorage.setItem(RECEIPT_RETRY_KEY, JSON.stringify(saved));
    } catch {
      setError("The browser could not save the receipt for safe retries. Enable session storage before receiving products.");
      setWorking(false);
      return false;
    }
    pendingReceipt.current = saved;
    setReceiptRetry(saved);
    try {
      await request({ ...saved.payload, id: saved.id }, null, mutation);
      if (!mutation.isCurrent()) return false;
      sessionStorage.removeItem(RECEIPT_RETRY_KEY);
      pendingReceipt.current = null;
      setReceiptRetry(null);
      setLastReceipt({ orderId: saved.payload.orderId, id: saved.id });
      await load(saved.payload.orderId);
      return true;
    } catch (e) {
      if (!mutation.isCurrent()) return false;
      if (receiptWasRejected(e, isFirstAttempt)) {
        try {
          sessionStorage.removeItem(RECEIPT_RETRY_KEY);
        } catch {
          setError(`${e.message} The browser could not clear the saved receipt. Keep retrying that saved receipt after restoring session storage.`);
          setWorking(false);
          return false;
        }
        pendingReceipt.current = null;
        setReceiptRetry(null);
        setError(`${e.message} The receipt was rejected; review the counts before trying again.`);
      } else {
        setError(`${e.message} The receipt may have succeeded. Retry the saved receipt to check its outcome without adding it twice.`);
      }
      setWorking(false);
      return false;
    }
  }
  const feedback = printFeedback(detail, enabled);
  const recovery = reprintReadiness(detail);
  const state = detail?.state,
    manifest = detail?.manifest,
    ready = state ? workflowReadiness(state) : null,
    inventoryPlan =
      detail?.inventory_plan ??
      manifest?.inventoryPlan ??
      (detail?.job_kind === "stock"
        ? detail.stock_request?.map((item) => ({
            ...item,
            fromStock: 0,
            toMake: item.quantity,
          }))
        : null),
    sendUnavailable =
      detail?.phase === "blocked" ||
      detail?.phase === "complete" ||
      state?.hold ||
      state?.packed ||
      !!detail?.inventory_released_at ||
      !!detail?.inventory_consumed_at ||
      !!detail?.inventory_posted_at ||
      (detail?.job_kind !== "stock" &&
        (detail?.order.payment_status !== "paid" ||
          !["unfulfilled", "in_production", "packing"].includes(
            detail?.order.fulfillment_status,
          )));
  function printControl(sheetId, side, status) {
    return (
      <div className="rounded-xl bg-slate-50 p-3" key={side}>
        <p className="font-bold capitalize">
          {side === "ticket"
            ? "Canon work ticket"
            : side === "fronts"
              ? "Epson fronts"
              : "Canon backs"}
        </p>
        <p
          className={`my-2 text-sm ${status === "needs_review" ? "text-amber-800" : "text-slate-600"}`}
        >
          {status === "queued" && !detail.print_requested_at
            ? "Waiting for Send to printers"
            : (labels[status] ?? status)}
        </p>
        <div className="flex flex-wrap gap-2">
          {status === "submitting" && !recovery.active && (
              <button
                className={button}
                disabled={busy}
                onClick={() =>
                  update("submission_uncertain", { sheetId, side })
                }
              >
                Review interrupted attempt
              </button>
            )}
          {status === "needs_review" && (
            <button
              className={button}
              disabled={
                busy ||
                recovery.active ||
                state.hold ||
                (side !== "ticket" && !!detail.inventory_posted_at)
              }
              onClick={() => update("confirm_printed", { sheetId, side })}
            >
              Page printed successfully
            </button>
          )}
          {["submitted", "needs_review", "confirmed"].includes(status) && (
            <button
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:opacity-40"
              disabled={
                busy ||
                recovery.blocked ||
                state.hold ||
                (side !== "ticket" && !!detail.inventory_posted_at)
              }
              onClick={() => {
                setReprint({ sheetId, side });
                setReason("");
              }}
            >
              {side === "fronts" ? "Reprint this front" : side === "backs" ? "Reprint this back" : "Reprint work ticket"}
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <main className="mx-auto min-w-0 max-w-6xl space-y-6 px-4 py-10 text-slate-900 [overflow-wrap:anywhere]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {receiptRetry && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-900">
              <p>A packaged-product receipt is awaiting confirmation. Its counts are locked until the saved request is resolved.</p>
              <p className="mt-1 break-all text-xs">Stock build {receiptRetry.payload.orderId} · {receiptRetry.payload.items.reduce((n, item) => n + item.quantity, 0)} products</p>
              <button className={`${button} mt-3`} disabled={busy || !loggedIn} onClick={() => receiveStock(receiptRetry.payload)}>Retry saved receipt</button>
            </div>
          )}
          {stockRetry && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
              <p>
                A stock action is awaiting confirmation. Its saved ID prevents a
                retry from adding stock twice.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  className={button}
                  disabled={busy}
                  onClick={() => stockOperation(stockRetry.payload)}
                >
                  Retry saved stock action
                </button>
                <button
                  className="rounded-xl border px-3 py-2"
                  disabled={busy}
                  onClick={() => {
                    pendingStock.current = null;
                    sessionStorage.removeItem(STOCK_RETRY_KEY);
                    setStockRetry(null);
                  }}
                >
                  Discard retry after checking stock history
                </button>
              </div>
            </div>
          )}
          <p className="text-sm font-bold uppercase tracking-widest text-cyan-100">
            Sea Realm workshop
          </p>
          <h1 className="mt-2 text-3xl font-black text-white">Manufacturing</h1>
          <p className="mt-2 text-cyan-50">
            Print, finish, and pack each order.
          </p>
        </div>
        <a
          className="text-sm font-bold text-cyan-100 underline hover:text-white"
          href="/admin/orders"
        >
          Orders & shipping
        </a>
      </div>
      <form
        className={`${panel} flex flex-wrap items-end gap-3`}
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
      >
        <label className="min-w-0 basis-64 flex-1 text-sm font-bold">
          Staff token
          <input
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => {
              invalidateSession();
              tokenRef.current = e.target.value;
              setToken(e.target.value);
            }}
            className="mt-2 block w-full rounded-lg border border-slate-300 p-3"
          />
        </label>
        <button className={button} disabled={busy || !token}>
          Open / refresh queue
        </button>
        {loggedIn && (
          <button
            type="button"
            className="p-3 text-sm underline"
            onClick={() => {
              sessionStorage.removeItem(TOKEN_KEY);
              invalidateSession();
              tokenRef.current = "";
              setToken("");
            }}
          >
            Sign out
          </button>
        )}
      </form>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
          {formatManufacturingMessage(error)}
        </p>
      )}
      {loggedIn && !enabled && (
        <p className="rounded-xl bg-amber-50 p-4 text-amber-900">
          Printing is not activated yet. You can send a job to the print queue;
          it will wait there until printing is activated.
        </p>
      )}
      {loggedIn && (
        <div className="min-w-0">
          <p className={`mb-3 text-sm ${refreshError ? "text-amber-100" : "text-cyan-100"}`}>
            {refreshError || "Live updates every 5 seconds while this page is visible."}
            {lastUpdated && ` Last updated ${lastUpdated.toLocaleTimeString()}.`}
          </p>
          <FinishedInventory
            stock={stock}
            movements={movements}
            barcodes={barcodes}
            busy={busy}
            onOperation={stockOperation}
            onSetBarcode={setProductBarcode}
            selected={selected}
          />
          <div className="grid min-w-0 grid-cols-1 items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className={`${panel} space-y-3`}>
              <h2 className="font-black">Workshop queue</h2>
              {rows.length === 0 && (
                <p className="text-sm text-slate-600">
                  New paid orders will appear here.
                </p>
              )}
              {rows.map((row) => (
                <button
                  key={row.order_id}
                  disabled={busy}
                  onClick={() => load(row.order_id)}
                  className={`block min-w-0 w-full rounded-xl border p-3 text-left ${selected === row.order_id ? "border-cyan-700 bg-cyan-50" : "border-slate-200"}`}
                >
                  <span className="block [overflow-wrap:anywhere] font-bold">
                    {row.display_number ?? row.store_orders?.order_number}
                  </span>
                  <span className="text-sm capitalize">
                    {selected === row.order_id && feedback
                      ? feedback.title
                      : row.phase === "queued"
                      ? row.print_requested_at
                        ? "Waiting for local print helper"
                        : "Awaiting send"
                      : row.phase.replaceAll("_", " ")}
                  </span>
                  {row.job_kind === "stock" && (
                    <span className="ml-2 text-xs font-bold">STOCK BUILD</span>
                  )}
                  {row.job_kind !== "stock" &&
                    !row.store_orders?.payment_livemode && (
                      <span className="ml-2 text-xs font-bold">TEST</span>
                    )}
                  <span className="block text-xs text-slate-500">
                    Due {row.store_orders?.production_due_date ?? "—"}
                  </span>
                </button>
              ))}
              <form
                className="border-t pt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  retry(manualId);
                }}
              >
                <label className="text-xs font-bold">
                  Add an older paid order by ID
                  <input
                    className="my-2 w-full rounded-lg border p-2 font-normal"
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value)}
                    placeholder="Order UUID"
                    required
                  />
                </label>
                <button className={button} disabled={busy}>
                  Add order to workshop
                </button>
                <p className="mt-2 text-xs text-slate-600">
                  Review its stock plan, then choose Send to printers.
                </p>
              </form>
            </aside>
            <section className="min-w-0 space-y-4" aria-label="Selected order">
              {!detail && (
                <div className={panel}>
                  Select an order or scan its work ticket.
                </div>
              )}
              {detail && (
                <div className={panel}>
                  <h2 className="[overflow-wrap:anywhere] text-2xl font-black">
                    {detail.order.order_number}
                  </h2>
                  <p className="mt-1 text-sm capitalize">
                    {detail.order.payment_status} ·{" "}
                    {detail.order.fulfillment_method} · Due{" "}
                    {detail.order.production_due_date ?? "not set"}
                  </p>
                  <ul className="my-4 space-y-1">
                    {detail.order.store_order_items.map((item, index) => (
                      <li key={index}>
                        {item.quantity} × {item.product_name}
                      </li>
                    ))}
                  </ul>
                  <div className="my-4 rounded-xl border border-cyan-200 bg-cyan-50 p-4">
                    {detail.print_requested_at ? (
                      <div role="status" aria-live="polite" aria-atomic="true">
                        <p className={`font-bold ${feedback.attention ? "text-amber-900" : ""}`}>
                          {feedback.title}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {feedback.description}
                        </p>
                        {!!feedback.total && (
                          <p className="mt-2 text-sm font-bold">
                            {feedback.sent}/{feedback.total} print jobs sent
                          </p>
                        )}
                        <p className="mt-2 text-xs text-slate-500">
                          Requested {new Date(detail.print_requested_at).toLocaleString()}
                        </p>
                      </div>
                    ) : (
                      <>
                        <h3 className="font-bold">Review and send this job</h3>
                        <p className="my-2 text-sm text-slate-600">
                          {detail.job_kind === "stock"
                            ? "Print the fronts, backs, and work ticket for this stock build."
                            : "Use reserved finished stock and print only the shortfall, plus a work ticket."}
                          {" "}Any new booster gets 5 commons, 3 uncommons, and
                          1 rare or holo rare from its set. Its cards are saved
                          once and stay the same for reprints.
                        </p>
                        {inventoryPlan && (
                          <p className="mb-3 text-sm font-bold text-cyan-950">
                            {inventoryPlan.reduce((n, p) => n + p.fromStock, 0)}
                            {" "}finished products from stock ·{" "}
                            {inventoryPlan.reduce((n, p) => n + p.toMake, 0)} to
                            make
                          </p>
                        )}
                        <button
                          className={button}
                          disabled={busy || sendUnavailable}
                          onClick={sendToPrinters}
                        >
                          Send to printers
                        </button>
                        {sendUnavailable && (
                          <p className="mt-2 text-sm text-amber-800">
                            {detail.phase === "complete" ||
                            state?.packed ||
                            detail.inventory_posted_at ||
                            detail.inventory_consumed_at
                              ? "This job is already complete."
                              : "Resolve the hold or order issue before sending this job."}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                  {manifest?.sheets.length > 0 && detail.print_requested_at && (
                    <div className="my-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                      <p className="font-bold">Blank or damaged sheet?</p>
                      <p className="mt-1">
                        Find its sheet number below and choose Reprint this front or Reprint this back.
                        Only that side is queued again, using the same saved cards, artwork, and positions.
                        You do not need to recreate the page. Check the physical output and printer queue first.
                      </p>
                      {recovery.message && (
                        <p className="mt-2 font-bold text-amber-900" role="status">{recovery.message}</p>
                      )}
                    </div>
                  )}
                  {detail.issue && (
                    <p className="my-3 rounded-lg bg-amber-50 p-3 text-amber-900">
                      {formatManufacturingMessage(detail.issue)}
                    </p>
                  )}
                  {detail.phase === "blocked" && !state?.hold && (
                    <button
                      disabled={busy}
                      className={button}
                      onClick={() => retry(selected)}
                    >
                      Retry preparation with saved contents
                    </button>
                  )}
                  {state && (
                    <button
                      disabled={busy}
                      className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold"
                      onClick={() =>
                        update(state.hold ? "release_hold" : "hold")
                      }
                    >
                      {state.hold
                        ? "Release manufacturing hold"
                        : "Hold manufacturing"}
                    </button>
                  )}
                  {state?.hold && (
                    <p className="mt-3 text-sm text-amber-800">
                      Held. A sheet already sent to a printer may still finish.
                    </p>
                  )}
                  {manifest && (
                    <p className="mt-3 text-xs text-slate-500">
                      Artwork {manifest.artworkRelease} · Manifest{" "}
                      {manifest.manifestHash.slice(0, 12)}
                    </p>
                  )}
                </div>
              )}
              {state?.ticket && (
                <div className={panel}>
                  {printControl("work-ticket", "ticket", state.ticket.ticket)}
                </div>
              )}
              {inventoryPlan && (
                <div className={panel}>
                  <h3 className="font-bold">
                    Stock to pick and products to make
                  </h3>
                  <ul className="mt-3 space-y-3">
                    {inventoryPlan.map((p) => (
                      <li key={p.productId}>
                        <p className="text-sm">
                          {detail.order.store_order_items.find(
                            (i) => i.product_id === p.productId,
                          )?.product_name ?? p.productId}
                          : <strong>{p.fromStock} from stock</strong> ·{" "}
                          {p.toMake} to make
                        </p>
                        {p.fromStock > 0 && state && (
                          <button
                            className={`${button} mt-2`}
                            disabled={
                              busy ||
                              state.hold ||
                              state.stock?.[p.productId] ||
                              !!detail.inventory_released_at
                            }
                            onClick={() =>
                              update("stock_picked", { productId: p.productId })
                            }
                          >
                            {state.stock?.[p.productId]
                              ? "Stock picked ✓"
                              : `Confirm ${p.fromStock} picked`}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {detail.inventory_released_at && (
                    <p className="mt-3 text-sm text-amber-800">
                      The stock reservation was released. Review this order
                      before continuing.
                    </p>
                  )}
                </div>
              )}
              {detail && !inventoryPlan && (
                <p className={`${panel} text-sm text-slate-600`}>
                  Stock allocation is pending. Sending this job will reserve
                  available finished products and print the remaining quantity.
                </p>
              )}
              {detail?.job_kind === "stock" && (
                <StockReceiving key={detail.order_id} detail={detail} stock={stock} barcodes={barcodes} busy={busy} pendingReceipt={receiptRetry} lastReceipt={lastReceipt} onReceive={receiveStock} onSetBarcode={setProductBarcode} />
              )}
              {manifest?.sheets.map((sheet) => (
                <article key={sheet.sheetId} className={panel}>
                  <h3 className="break-words font-black">{sheetDisplayLabel(manifest, sheet.sheetId)}</h3>
                  <p className="mt-1 text-sm capitalize text-slate-600">
                    {sheet.set
                      ? `${sheet.set === "ocean" ? "Oceanic" : sheet.set} Dive Pack · 9 cards`
                      : sheet.productId === "blue-water" ? "Drop Off deck" : sheet.productId?.replaceAll("-", " ")}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {["fronts", "backs"].map((side) =>
                      printControl(
                        sheet.sheetId,
                        side,
                        state.sheets[sheet.sheetId][side],
                      ),
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      className={button}
                      disabled={
                        busy ||
                        state.hold ||
                        state.sheets[sheet.sheetId].glued ||
                        !isPrintSubmitted(state.sheets[sheet.sheetId].fronts) ||
                        !isPrintSubmitted(state.sheets[sheet.sheetId].backs)
                      }
                      onClick={() =>
                        update("glued", { sheetId: sheet.sheetId })
                      }
                    >
                      {state.sheets[sheet.sheetId].glued
                        ? "Glued ✓"
                        : "Confirm glued"}
                    </button>
                    <button
                      className={button}
                      disabled={
                        busy ||
                        state.hold ||
                        !state.sheets[sheet.sheetId].glued ||
                        state.sheets[sheet.sheetId].cut
                      }
                      onClick={() => update("cut", { sheetId: sheet.sheetId })}
                    >
                      {state.sheets[sheet.sheetId].cut
                        ? "Cut ✓"
                        : "Confirm dry and cut"}
                    </button>
                  </div>
                  {manifest.holoChecklist
                    .filter((h) => h.sheetId === sheet.sheetId)
                    .map((holo) => (
                      <div
                        key={holo.id}
                        className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4"
                      >
                        <p className="font-bold">{manifest.holoHandling === "pull-finished" ? "Pull finished holo" : "Holo sticker"}: {holo.name}</p>
                        <p className="my-2 text-sm">
                          Row {holo.row}, column {holo.column} ·{" "}
                          {manifest.holoHandling === "pull-finished"
                            ? `${holo.set === "ocean" ? "Oceanic" : holo.set} ${holo.collectorNumber}/${holo.setTotal}`
                            : holo.printingId}
                        </p>
                        <button
                          className={button}
                          disabled={
                            busy ||
                            state.hold ||
                            state.holos[holo.id] ||
                            !isPrintSubmitted(state.sheets[sheet.sheetId].fronts)
                          }
                          onClick={() =>
                            update(manifest.holoHandling === "pull-finished" ? "holo_pulled" : "holo_applied", { holoId: holo.id })
                          }
                        >
                          {state.holos[holo.id]
                            ? manifest.holoHandling === "pull-finished" ? "Finished holo pulled ✓" : "Sticker applied ✓"
                            : manifest.holoHandling === "pull-finished" ? "Confirm finished holo pulled" : "Confirm sticker applied"}
                        </button>
                      </div>
                    ))}
                </article>
              ))}
              {manifest?.accessoryChecklist?.length > 0 && (
                <div className={panel}>
                  <h3 className="font-black">Accessories</h3>
                  {manifest.accessoryChecklist.map((item) => (
                    <div
                      key={item.id}
                      className="mt-3 flex flex-wrap items-center justify-between gap-3"
                    >
                      <span>
                        {item.quantity} total — {item.name}
                      </span>
                      <button
                        className={button}
                        disabled={
                          busy || state.hold || state.accessories[item.id]
                        }
                        onClick={() =>
                          update("accessory_picked", { accessoryId: item.id })
                        }
                      >
                        {state.accessories[item.id]
                          ? "Picked ✓"
                          : "Confirm picked"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {state && (
                <div className={panel}>
                  <h3 className="font-black">Quality check & packing</h3>
                  <p className="my-3 text-sm">
                    {ready.holosRemaining} {manifest.holoHandling === "pull-finished" ? "finished holos to pull" : "holo stickers"} and{" "}
                    {ready.accessoriesRemaining} accessory groups and{" "}
                    {ready.stockRemaining} finished-stock picks remaining. Check
                    card counts, alignment, glue, and cut edges.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      className={button}
                      disabled={
                        busy || !ready.canQualityCheck || state.qualityChecked
                      }
                      onClick={() => update("quality_checked")}
                    >
                      {state.qualityChecked
                        ? "Quality checked ✓"
                        : "Pass quality check"}
                    </button>
                    <button
                      className={button}
                      disabled={busy || !ready.canPack || state.packed}
                      onClick={() => update("packed")}
                    >
                      {state.packed ? "Packed ✓" : "Confirm packed"}
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">
                    {detail.job_kind === "stock"
                      ? "This confirms packaging only. Scan packaged products in Receive packaged products above to add actual finished quantities to inventory. Partial receipts are allowed."
                      : "Production and packing updates follow these confirmations. Record shipment or pickup readiness in Orders & shipping."}
                  </p>
                </div>
              )}
              {detail?.notifications?.length > 0 && (
                <div className={panel}>
                  <h3 className="font-bold">Buyer updates</h3>
                  <ul className="mt-3 space-y-2 text-sm">
                    {detail.notifications.map((n) => (
                      <li
                        key={n.milestone}
                        className={
                          n.status === "review" ? "text-amber-800" : ""
                        }
                      >
                        {n.milestone.replaceAll("_", " ")}: {n.status}
                        {n.status === "review"
                          ? " — inspect delivery history before resending"
                          : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {state?.events.length > 0 && (
                <details className={panel}>
                  <summary className="font-bold">Recent activity</summary>
                  <ol className="mt-3 space-y-2 text-sm">
                    {state.events
                      .slice(-20)
                      .reverse()
                      .map((e) => (
                        <li key={e.id}>
                          #{e.expectedRevision + 1}{" "}
                          {e.recordedAt
                            ? new Date(e.recordedAt).toLocaleString()
                            : ""}{" "}
                          {e.actor}: {e.type.replaceAll("_", " ")}{" "}
                          {e.side ?? ""} {e.reason ? `— ${e.reason}` : ""}
                        </li>
                      ))}
                  </ol>
                </details>
              )}
            </section>
          </div>
        </div>
      )}
      {reprint && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reprint-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
        >
          <form
            className={`${panel} w-full max-w-lg`}
            onSubmit={(e) => {
              e.preventDefault();
              update("reprint", { ...reprint, reason });
            }}
          >
            <h2 id="reprint-title" className="text-xl font-black">
              Authorize one reprint
            </h2>
            <p className="my-3 text-sm">
              Check the physical output and printer queue first. This will queue only the{" "}
              {reprint.side === "fronts" ? "Epson front" : reprint.side === "backs" ? "Canon back" : "Canon work ticket"}{" "}
              for {sheetDisplayLabel(manifest, reprint.sheetId)}.
              The saved card choices, artwork, and positions stay the same.
            </p>
            {recovery.message && (
              <p className="mb-3 text-sm font-bold text-amber-900" role="status">{recovery.message}</p>
            )}
            <label className="text-sm font-bold">
              Reason
              <textarea
                autoFocus
                required
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-2 w-full rounded-lg border p-3"
              />
            </label>
            <div className="mt-4 flex gap-3">
              <button className={button} disabled={busy || recovery.blocked || !reason.trim()}>
                Authorize reprint
              </button>
              <button
                type="button"
                className="p-3 underline"
                onClick={() => setReprint(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
