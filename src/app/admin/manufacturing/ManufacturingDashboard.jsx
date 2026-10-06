"use client";
import { useEffect, useState, useRef } from "react";
import { workflowReadiness } from "@/lib/manufacturing/readiness.mjs";
import FinishedInventory from "./FinishedInventory";

const TOKEN_KEY = "seapals-store-admin-token";
const STOCK_RETRY_KEY = "seapals-manufacturing-stock-retry";
const panel = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const button =
  "rounded-xl bg-cyan-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-40";
const labels = {
  queued: "Waiting for printer",
  submitting: "Submission in progress",
  submitted: "Sent to printer — check paper",
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
    [movements, setMovements] = useState([]);
  const pendingStock = useRef(null);
  const [stockRetry, setStockRetry] = useState(null);
  useEffect(() => {
    setToken(sessionStorage.getItem(TOKEN_KEY) ?? "");
    setSelected(new URLSearchParams(location.search).get("order") ?? "");
    try {
      const pending = JSON.parse(sessionStorage.getItem(STOCK_RETRY_KEY));
      if (pending?.id && pending.payload) {
        pendingStock.current = pending;
        setStockRetry(pending);
      }
    } catch {}
  }, []);
  async function request(payload, id) {
    const r = await fetch(
      `/api/admin/manufacturing${id ? `?orderId=${encodeURIComponent(id)}` : ""}`,
      {
        method: payload ? "POST" : "GET",
        headers: {
          "x-admin-token": token,
          ...(payload ? { "Content-Type": "application/json" } : {}),
        },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
        cache: "no-store",
      },
    );
    const data = await r.json();
    if (!r.ok) throw new Error(data.error ?? "Request failed.");
    return data;
  }
  async function load(id = selected) {
    setBusy(true);
    setError("");
    try {
      const list = await request();
      setRows(list.orders);
      setStock(list.stock ?? []);
      setMovements(list.movements ?? []);
      setEnabled(list.enabled);
      setLoggedIn(true);
      sessionStorage.setItem(TOKEN_KEY, token);
      if (id) {
        const d = await request(null, id);
        setDetail(d);
        setSelected(id);
        history.replaceState(null, "", `?order=${encodeURIComponent(id)}`);
      } else setDetail(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function update(type, fields = {}) {
    if (!detail?.state || busy) return;
    setBusy(true);
    setError("");
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
      });
      setReprint(null);
      setReason("");
      await load(selected);
    } catch (e) {
      setError(`${e.message} Refresh before trying again.`);
      setBusy(false);
    }
  }
  async function retry(id) {
    setBusy(true);
    setError("");
    try {
      await request({ action: "retry", orderId: id });
      await load(id);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  async function stockOperation(payload) {
    if (busy) return false;
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
    setBusy(true);
    setError("");
    if (!pendingStock.current)
      pendingStock.current = { fingerprint, payload, id: crypto.randomUUID() };
    sessionStorage.setItem(
      STOCK_RETRY_KEY,
      JSON.stringify(pendingStock.current),
    );
    setStockRetry(pendingStock.current);
    try {
      const result = await request({ ...payload, id: pendingStock.current.id });
      pendingStock.current = null;
      sessionStorage.removeItem(STOCK_RETRY_KEY);
      setStockRetry(null);
      await load(result.order_id ?? selected);
      return true;
    } catch (e) {
      setError(
        `${e.message} Retry the same stock change if the connection failed.`,
      );
      setBusy(false);
      return false;
    }
  }
  const state = detail?.state,
    manifest = detail?.manifest,
    ready = state ? workflowReadiness(state) : null;
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
          {labels[status] ?? status}
        </p>
        <div className="flex flex-wrap gap-2">
          {status === "submitting" &&
            new Date(detail.leased_until ?? 0) <= new Date() && (
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
          {["submitted", "needs_review"].includes(status) && (
            <button
              className={button}
              disabled={
                busy ||
                state.hold ||
                (side !== "ticket" && !!detail.inventory_posted_at)
              }
              onClick={() => update("confirm_printed", { sheetId, side })}
            >
              Paper checked
            </button>
          )}
          {["submitted", "needs_review", "confirmed"].includes(status) && (
            <button
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              disabled={
                busy ||
                state.hold ||
                (side !== "ticket" && !!detail.inventory_posted_at)
              }
              onClick={() => {
                setReprint({ sheetId, side });
                setReason("");
              }}
            >
              Reprint…
            </button>
          )}
        </div>
      </div>
    );
  }
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-10 text-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
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
          <p className="text-sm font-bold uppercase tracking-widest text-cyan-800">
            Sea Realm workshop
          </p>
          <h1 className="mt-2 text-3xl font-black">Manufacturing</h1>
          <p className="mt-2 text-slate-600">
            Print, finish, and pack each order.
          </p>
        </div>
        <a
          className="text-sm font-bold text-cyan-800 underline"
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
        <label className="flex-1 text-sm font-bold">
          Staff token
          <input
            type="password"
            autoComplete="off"
            value={token}
            onChange={(e) => setToken(e.target.value)}
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
              setToken("");
              setRows([]);
              setDetail(null);
              setLoggedIn(false);
            }}
          >
            Sign out
          </button>
        )}
      </form>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
          {error}
        </p>
      )}
      {loggedIn && !enabled && (
        <p className="rounded-xl bg-amber-50 p-4 text-amber-900">
          Automatic printer submission is disabled. The queue and saved
          checklists remain available.
        </p>
      )}
      {loggedIn && (
        <div>
          <FinishedInventory
            stock={stock}
            movements={movements}
            busy={busy}
            onOperation={stockOperation}
            selected={selected}
          />
          <div className="grid items-start gap-5 lg:grid-cols-[280px_1fr]">
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
                  className={`block w-full rounded-xl border p-3 text-left ${selected === row.order_id ? "border-cyan-700 bg-cyan-50" : "border-slate-200"}`}
                >
                  <span className="block font-bold">
                    {row.display_number ?? row.store_orders?.order_number}
                  </span>
                  <span className="text-sm capitalize">
                    {row.phase.replaceAll("_", " ")}
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
                  Queue order
                </button>
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
                  <h2 className="break-words text-2xl font-black">
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
                  {detail.issue && (
                    <p className="my-3 rounded-lg bg-amber-50 p-3 text-amber-900">
                      {detail.issue}
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
              {manifest?.inventoryPlan && (
                <div className={panel}>
                  <h3 className="font-bold">
                    Stock to pick and products to make
                  </h3>
                  <ul className="mt-3 space-y-3">
                    {manifest.inventoryPlan.map((p) => (
                      <li key={p.productId}>
                        <p className="text-sm">
                          {detail.order.store_order_items.find(
                            (i) => i.product_id === p.productId,
                          )?.product_name ?? p.productId}
                          : <strong>{p.fromStock} from stock</strong> ·{" "}
                          {p.toMake} to make
                        </p>
                        {p.fromStock > 0 && (
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
              {detail?.job_kind === "stock" && (
                <div className={panel}>
                  <h3 className="font-bold">Stock build</h3>
                  <p className="mt-2 text-sm">
                    {detail.inventory_posted_at
                      ? "Completed products have been added to finished inventory."
                      : "Finish and quality-check this batch, then receive it into inventory. This job has no customer or buyer emails."}
                  </p>
                </div>
              )}
              {manifest?.sheets.map((sheet) => (
                <article key={sheet.sheetId} className={panel}>
                  <h3 className="break-words font-black">{sheet.sheetId}</h3>
                  <p className="mt-1 text-sm capitalize text-slate-600">
                    {sheet.set
                      ? `${sheet.set === "ocean" ? "Oceanic" : sheet.set} Dive Pack · 9 cards`
                      : sheet.productId?.replaceAll("-", " ")}
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
                        state.sheets[sheet.sheetId].fronts !== "confirmed" ||
                        state.sheets[sheet.sheetId].backs !== "confirmed"
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
                        <p className="font-bold">Holo sticker: {holo.name}</p>
                        <p className="my-2 text-sm">
                          Row {holo.row}, column {holo.column} ·{" "}
                          {holo.printingId}
                        </p>
                        <button
                          className={button}
                          disabled={
                            busy ||
                            state.hold ||
                            state.holos[holo.id] ||
                            state.sheets[sheet.sheetId].fronts !== "confirmed"
                          }
                          onClick={() =>
                            update("holo_applied", { holoId: holo.id })
                          }
                        >
                          {state.holos[holo.id]
                            ? "Sticker applied ✓"
                            : "Confirm sticker applied"}
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
                    {ready.holosRemaining} holo stickers and{" "}
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
                      {detail.job_kind === "stock"
                        ? state.packed
                          ? "Received into stock ✓"
                          : "Packed — receive into stock"
                        : state.packed
                          ? "Packed ✓"
                          : "Confirm packed"}
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">
                    {detail.job_kind === "stock"
                      ? "Receiving this completed batch adds its finished units to available inventory once."
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
              Check the physical output and printer queue first. This will queue{" "}
              {reprint.side} for {reprint.sheetId}. Card contents stay the same.
            </p>
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
              <button className={button} disabled={busy || !reason.trim()}>
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
