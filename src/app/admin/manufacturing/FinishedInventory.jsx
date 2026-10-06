"use client";
import { useState } from "react";

export default function FinishedInventory({
  stock,
  movements,
  busy,
  onOperation,
  selected,
}) {
  const [mode, setMode] = useState("build_stock"),
    [product, setProduct] = useState("reef-dive-pack"),
    [quantity, setQuantity] = useState("1"),
    [reason, setReason] = useState("");
  const field =
    "mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2";
  return (
    <details
      open={!selected}
      className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <summary className="cursor-pointer text-lg font-black">
        Finished inventory
      </summary>
      <p className="my-3 text-sm text-slate-600">
        Ready-to-sell sealed packs, decks, and kits. Paid orders reserve
        available stock and print the shortfall. Checkout production-capacity
        limits remain separate.
      </p>
      <div className="grid gap-5 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2">Product</th>
                <th className="p-2">On hand</th>
                <th className="p-2">Reserved</th>
                <th className="p-2">Available</th>
                <th className="p-2">Build queue</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((s) => (
                <tr key={s.product_id} className="border-b border-slate-100">
                  <th className="p-2 font-medium">{s.product_name}</th>
                  <td className="p-2">{s.on_hand}</td>
                  <td className="p-2">{s.reserved}</td>
                  <td className="p-2 font-bold">{s.available}</td>
                  <td className="p-2">{s.planned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <form
          className="space-y-3 rounded-xl bg-slate-50 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const saved = await onOperation(
              mode === "build_stock"
                ? {
                    action: mode,
                    items: [{ productId: product, quantity: Number(quantity) }],
                  }
                : {
                    action: mode,
                    productId: product,
                    quantity: Number(quantity),
                    reason,
                  },
            );
            if (saved) setReason("");
          }}
        >
          <h3 className="font-bold">Manage finished stock</h3>
          <label className="block text-sm">
            Action
            <select
              className={field}
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                setQuantity("1");
              }}
              disabled={busy}
            >
              <option value="build_stock">Build stock without an order</option>
              <option value="adjust_stock">Record a stock change</option>
            </select>
          </label>
          <label className="block text-sm">
            Finished product
            <select
              className={field}
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              disabled={busy}
            >
              {stock.map((s) => (
                <option key={s.product_id} value={s.product_id}>
                  {s.product_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            {mode === "build_stock"
              ? "Units to build"
              : "Quantity change (+ / −)"}
            <input
              className={field}
              type="number"
              min={mode === "build_stock" ? 1 : -10000}
              max={mode === "build_stock" ? 100 : 10000}
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
              disabled={busy}
            />
          </label>
          {mode === "adjust_stock" ? (
            <>
              <label className="block text-sm">
                Reason
                <input
                  className={field}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  maxLength={500}
                  disabled={busy}
                  placeholder="Initial count, damaged pack, event sale…"
                />
              </label>
              <p className="text-xs text-slate-600">
                Enter a change, not a new total. Add only finished, checked
                products. Reserved stock cannot be removed.
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-600">
              Creates a workshop job using the same printers and finishing
              checklist. It adds stock after you confirm QC and receive the
              completed batch.
            </p>
          )}
          <button
            className="w-full rounded-xl bg-cyan-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
            disabled={busy || !stock.length}
          >
            {mode === "build_stock"
              ? "Create stock build"
              : "Record stock change"}
          </button>
        </form>
      </div>
      {!!movements.length && (
        <details className="mt-4">
          <summary className="cursor-pointer font-bold">
            Recent stock changes
          </summary>
          <ul className="mt-3 space-y-2 text-sm">
            {movements.map((m) => (
              <li key={m.id}>
                {new Date(m.created_at).toLocaleString()} ·{" "}
                {stock.find((s) => s.product_id === m.product_id)
                  ?.product_name ?? m.product_id}{" "}
                · on hand {m.on_hand_delta > 0 ? "+" : ""}
                {m.on_hand_delta}, reserved {m.reserved_delta > 0 ? "+" : ""}
                {m.reserved_delta} · {m.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </details>
  );
}
