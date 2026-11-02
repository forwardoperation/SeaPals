"use client";
import { useEffect, useRef, useState } from 'react';

export default function PagePreview({ onLoadPagePreview, orderId, sheetId, side }) {
  const canvas = useRef(null), [status, setStatus] = useState('Loading preview…'), [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!orderId || !sheetId) return;
    const controller = new AbortController(), images = new Map();
    let live = true, timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 45000);
    setError(''); setStatus('Loading preview…');
    if (canvas.current) { canvas.current.width = 850; canvas.current.height = 1100; }
    const request = { orderId, sheetId, side, signal: controller.signal };
    async function draw() {
      const { plan } = await onLoadPagePreview(request);
      if (!live) return;
      // One fixed sheet and its background, or one complete rear master.
      // Download only the selected page; nothing is exposed through a public URL.
      await Promise.all(plan.requiredAssetIds.map(async assetId => {
        const blob = await onLoadPagePreview({ ...request, assetId });
        const bytes = await blob.arrayBuffer();
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        const hash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
        if (hash !== plan.assets[assetId].sha256) throw new Error('The saved artwork checksum changed.');
        const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        if (!live) { bitmap.close(); return; }
        if (bitmap.width !== plan.assets[assetId].width || bitmap.height !== plan.assets[assetId].height) {
          bitmap.close(); throw new Error('The saved artwork dimensions changed.');
        }
        images.set(assetId, bitmap);
      }));
      if (!live || !canvas.current) return;
      const ctx = canvas.current.getContext('2d');
      canvas.current.width = 850; canvas.current.height = 1100;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 850, 1100);
      ctx.scale(850 / plan.width, 1100 / plan.height);
      for (const { assetId, position: p, crop } of plan.layers) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation * Math.PI / 180);
        const image = images.get(assetId);
        if (crop) ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, p.width, p.height);
        else ctx.drawImage(image, 0, 0, p.width, p.height);
        ctx.restore();
      }
      for (const image of images.values()) image.close();
      images.clear();
      clearTimeout(timeout);
      setStatus('');
    }
    draw().catch(e => {
      clearTimeout(timeout);
      if (live && (e.name !== 'AbortError' || timedOut)) {
        setError(timedOut ? 'The preview timed out. Please retry.' : e.message || 'Preview unavailable.'); setStatus('');
      }
      live = false; controller.abort();
      for (const image of images.values()) image.close(); images.clear();
    });
    return () => { live = false; clearTimeout(timeout); controller.abort(); for (const image of images.values()) image.close(); images.clear(); };
  }, [orderId, sheetId, side, onLoadPagePreview, retry]);
  return <div className="min-w-0">
    {status && <p role="status" className="mb-2 text-sm text-slate-600">{status}</p>}
    {error && <div role="alert" className="mb-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
      {error} <button type="button" className="ml-2 font-bold underline" onClick={() => setRetry(value => value + 1)}>Retry preview</button>
    </div>}
    <canvas ref={canvas} width={850} height={1100}
      aria-label={`Saved ${side === 'fronts' ? 'Epson front' : 'Canon back'} preview for ${sheetId}`}
      className={`mx-auto block h-auto w-full max-w-[420px] border border-slate-200 bg-white shadow-sm ${status || error ? 'opacity-25' : ''}`} />
    <p className="mt-2 text-center text-xs text-slate-500">Saved print artwork · Letter sheet</p>
  </div>;
}
