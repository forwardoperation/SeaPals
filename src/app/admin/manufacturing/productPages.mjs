import { fixedSheetAssets } from "../../../lib/manufacturing/recipes.mjs";

export const MAX_PAGE_REPRINT_TARGETS = 1000;
export const productPageCount = (productId) => fixedSheetAssets(productId).length;
export const pageReprintRetryKey = (productId) => `seapals-manufacturing-page-reprint:${productId}`;

export function pageReprintSelectionError(targets) {
  return targets.length > MAX_PAGE_REPRINT_TARGETS
    ? "Select no more than 1,000 print sides per request. Fronts and backs count separately."
    : "";
}

export function selectedPageTargets(pages, selectedIds, side) {
  if (!["fronts", "backs", "both"].includes(side)) throw new Error("Choose the front, back, or both sides.");
  const selected = new Set(selectedIds);
  if (!selected.size) return [];
  const available = new Set(pages.map((page) => page.sheetId));
  if ([...selected].some((id) => !available.has(id))) throw new Error("The selected pages changed. Refresh this print run.");
  return pages.filter((page) => selected.has(page.sheetId)).flatMap((page) =>
    (side === "both" ? ["fronts", "backs"] : [side]).map((printSide) => ({ sheetId: page.sheetId, side: printSide })),
  );
}

export function pageReprintBlockedReason(job, now = Date.now()) {
  if (!job) return "Choose a saved print run.";
  if (job.reprintBlockedReason) return job.reprintBlockedReason;
  if (job.hold || job.phase === "blocked") return "This print run is on hold. Open it in the workshop to resolve the issue.";
  if (job.received) return "This stock build has received products. Open the workshop run to review its stock history.";
  if (!job.printRequestedAt) return "Send this run to the printers from the workshop before requesting replacement pages.";
  if (Date.parse(job.leasedUntil ?? "") > now) return "This run is printing. Wait for its current print attempt to finish.";
  const statuses = (job.pages ?? []).flatMap((page) => [page.frontsStatus, page.backsStatus]);
  if (statuses.includes("submitting")) return "A print attempt needs to finish or be reviewed in the workshop first.";
  if (statuses.includes("queued")) return "This run already has pages waiting for the printers. Wait for them to finish before reprinting.";
  return "";
}

export function readPageReprintRetry(value, productId) {
  try {
    const saved = JSON.parse(value), uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
    if (!uuid.test(saved?.id ?? "") || !uuid.test(saved?.orderId ?? "") || saved.productId !== productId ||
        !Number.isSafeInteger(saved.revision) || saved.revision < 0 || typeof saved.reason !== "string" ||
        !saved.reason.trim() || saved.reason.length > 500 || !Array.isArray(saved.targets) ||
        !saved.targets.length || saved.targets.length > MAX_PAGE_REPRINT_TARGETS) return null;
    const unique = new Set();
    for (const target of saved.targets) {
      if (typeof target?.sheetId !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(target.sheetId) || !["fronts", "backs"].includes(target.side)) return null;
      const key = `${target.sheetId}:${target.side}`;
      if (unique.has(key)) return null;
      unique.add(key);
    }
    return saved;
  } catch { return null; }
}

export function pageReprintWasRejected(error, firstAttempt) {
  // The endpoint reports rolled-back validation/revision failures as 409.
  // A retry after an unknown outcome must keep its original id and revision.
  return error?.status === 409 || (firstAttempt && [400, 401, 403, 404, 422].includes(error?.status));
}

export function pageReprintButtonLabel(targets) {
  const count = targets.length;
  const sides = new Set(targets.map((target) => target.side));
  const noun = sides.size === 1 ? (sides.has("fronts") ? "front" : "back") : "page";
  return count ? `Reprint ${count} ${noun}${count === 1 ? "" : "s"}` : "Select pages to reprint";
}
