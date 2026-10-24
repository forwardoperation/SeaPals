"use client";
import { useEffect, useRef, useState } from "react";
import { finalReceiptNeedsPrintReview, receivingLines, receiptPayload, removeScan, scanProduct } from "./receiving.mjs";

const field = "mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2";
const button = "rounded-xl bg-cyan-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-40";

export default function StockReceiving({ detail, stock, barcodes, busy, pendingReceipt, lastReceipt, onReceive, onSetBarcode }) {
  const [barcode, setBarcode] = useState("");
  const [items, setItems] = useState([]);
  const [qualityConfirmed, setQualityConfirmed] = useState(false);
  const [unknown, setUnknown] = useState("");
  const [mappedProduct, setMappedProduct] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const input = useRef(null);
  useEffect(() => {
    if (lastReceipt?.orderId === detail.order_id) {
      setItems([]);
      setQualityConfirmed(false);
    }
  }, [lastReceipt, detail.order_id]);
  const lines = receivingLines(detail, stock);
  const ownRetry = pendingReceipt?.payload.orderId === detail.order_id;
  const displayedItems = ownRetry
    ? pendingReceipt.payload.items.map((item) => ({ ...item, productId: barcodes.find((b) => b.barcode === item.barcode)?.product_id }))
    : items;
  const count = displayedItems.reduce((total, item) => total + item.quantity, 0);
  const statuses = Object.values(detail.state?.sheets ?? {}).flatMap((sheet) => [sheet.fronts, sheet.backs]);
  if (detail.state?.ticket) statuses.push(detail.state.ticket.ticket);
  const leased = new Date(detail.leased_until ?? 0).getTime() > Date.now();
  const unavailable = detail.inventory_posted_at ? "All planned products in this build have been received."
    : detail.state?.hold || detail.phase === "blocked" ? "Resolve the manufacturing hold before receiving products."
    : !detail.manifest || !detail.print_requested_at ? "Send this build to printers and wait for its saved card selection before receiving products."
    : leased || statuses.includes("submitting") ? "Wait for the print helper to finish this attempt before receiving products."
    : "";
  const locked = busy || !!pendingReceipt;
  const stagedByProduct = (productId) => displayedItems.filter((item) => item.productId === productId).reduce((n, item) => n + item.quantity, 0);
  const changedCounts = items.some((item) => {
    const line = lines.find((entry) => entry.productId === item.productId);
    return !line || stagedByProduct(item.productId) > line.remaining;
  });
  const pendingPages = finalReceiptNeedsPrintReview(count, lines, statuses);
  function scan(value = barcode, mappings = barcodes) {
    setError("");
    setMessage("");
    try {
      const result = scanProduct(items, value, mappings, lines);
      if (result.unknown) {
        setUnknown(result.unknown);
        setMappedProduct(lines.find((line) => line.remaining > 0)?.productId ?? "");
      } else {
        setItems(result.items);
        setQualityConfirmed(false);
        setBarcode("");
        setUnknown("");
        setMessage("Added one packaged product to the receipt below.");
        input.current?.focus();
      }
    } catch (e) { setError(e.message); }
  }
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-black">Receive packaged products</h3>
      <p className="mt-2 text-sm text-slate-600">
        Scan each finished pack once, review the counts, then receive only the products that passed inspection.
        Printing and packing confirmations do not add inventory. Damaged or unfinished products stay outstanding for reprinting.
      </p>
      <div className="my-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b"><th className="py-2 pr-3">Product</th><th className="p-2">Planned</th><th className="p-2">Received</th><th className="p-2">Remaining</th></tr></thead>
          <tbody>{lines.map((line) => <tr key={line.productId} className="border-b border-slate-100"><th className="py-2 pr-3 font-medium">{line.name}</th><td className="p-2">{line.planned}</td><td className="p-2">{line.received}</td><td className="p-2">{line.remaining}</td></tr>)}</tbody>
        </table>
      </div>
      {unavailable && <p className="my-3 text-sm text-slate-600">{unavailable}</p>}
      {!detail.inventory_posted_at && <>
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (!locked && !unavailable) scan(); }}>
          <label className="min-w-0 flex-1 text-sm font-bold" htmlFor="receiving-barcode">Product barcode
            <input id="receiving-barcode" ref={input} value={barcode} onChange={(e) => setBarcode(e.target.value)} className={field} autoComplete="off" maxLength={128} disabled={locked || !!unavailable} placeholder="Scan barcode, then Enter" />
          </label>
          <button className={button} disabled={locked || !!unavailable || !barcode.trim()}>Add one product</button>
        </form>
        <p className="mt-2 text-xs text-slate-500">Use a barcode scanner that types the code and Enter, or type the barcode. Shared product barcodes cannot identify a repeated scan of the same physical pack.</p>
        {unknown && <form className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4" onSubmit={async (e) => {
          e.preventDefault();
          if (locked || !mappedProduct) return;
          const saved = await onSetBarcode({ barcode: unknown, productId: mappedProduct });
          if (saved) scan(unknown, [...barcodes, { barcode: unknown, product_id: mappedProduct }]);
        }}>
          <p className="text-sm font-bold">Unknown barcode: <span className="break-all">{unknown}</span></p>
          <label className="block text-sm">Product on this packaging
            <select className={field} value={mappedProduct} onChange={(e) => setMappedProduct(e.target.value)} disabled={locked} required>
              {lines.map((line) => <option key={line.productId} value={line.productId}>{line.name}</option>)}
            </select>
          </label>
          <button className={button} disabled={locked || !mappedProduct}>Save barcode and add one product</button>
          <button type="button" className="ml-3 text-sm underline" disabled={locked} onClick={() => setUnknown("")}>Cancel</button>
        </form>}
        {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="mt-3 text-sm text-cyan-900">{message}</p>}
        {!!count && <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <h4 className="font-bold">Review this receipt: {count} {count === 1 ? "product" : "products"}</h4>
          <ul className="mt-3 space-y-3">{displayedItems.map((item) => <li key={item.barcode} className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span>{item.quantity} × {lines.find((line) => line.productId === item.productId)?.name ?? item.productId ?? "Product"}<span className="block break-all text-xs text-slate-500">Barcode {item.barcode}</span></span>
            <button type="button" className="rounded-lg border border-slate-300 px-3 py-2" disabled={locked} onClick={() => { setItems(removeScan(items, item.barcode)); setQualityConfirmed(false); }}>Remove one</button>
          </li>)}</ul>
          {changedCounts && !ownRetry && <p role="alert" className="mt-3 text-sm text-amber-800">The remaining quantity changed. Remove extra scans before receiving.</p>}
          {pendingPages && !ownRetry && <p role="alert" className="mt-3 text-sm text-amber-800">This receipt would finish the build. Send any queued pages and resolve print outcomes marked for review first. You can still receive a partial quantity of finished products.</p>}
          <label className="my-4 flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={ownRetry || qualityConfirmed} disabled={locked} onChange={(e) => setQualityConfirmed(e.target.checked)} />
            {count === 1 ? "This product is" : `These ${count} products are`} packaged and quality checked. I checked the counts against the physical products.
          </label>
          <button type="button" className={button} disabled={locked || !!unavailable || !qualityConfirmed || changedCounts || pendingPages} onClick={async () => {
            setError("");
            try {
              const received = await onReceive(receiptPayload(detail.order_id, items, qualityConfirmed));
              if (received) { setItems([]); setQualityConfirmed(false); setMessage(`${count} packaged ${count === 1 ? "product" : "products"} received into inventory.`); input.current?.focus(); }
            } catch (e) { setError(e.message); }
          }}>Receive {count} {count === 1 ? "product" : "products"}</button>
        </div>}
      </>}
      {ownRetry && <p role="status" className="mt-3 text-sm text-amber-800">This receipt is awaiting a response. Use Retry saved receipt above; its saved ID prevents the same receipt being added twice.</p>}
    </div>
  );
}
