import { isPrintSubmitted } from "../../../lib/manufacturing/readiness.mjs";
import { fixedSheetLabel } from "../../../lib/manufacturing/recipes.mjs";

// Format persisted issues at display time without changing their stored evidence.
export function formatManufacturingMessage(message) {
  return typeof message === "string"
    ? message.replace(/(^|[^\w-])(sheet-blue-water-[1-7])(?![\w-])/g,
      (_, prefix, assetId) => prefix + fixedSheetLabel(assetId))
    : message;
}

// Read-only display state. A successful submission means Windows accepted the
// print job, not that the physical output has passed the final quality check.
export function printFeedback(detail, enabled, now = Date.now()) {
  if (!detail) return null;
  const state = detail.state;
  const statuses = Object.values(state?.sheets ?? {}).flatMap((sheet) => [
    sheet.fronts,
    sheet.backs,
  ]);
  if (state?.ticket) statuses.push(state.ticket.ticket);
  const counts = {
    total: statuses.length,
    sent: statuses.filter(isPrintSubmitted).length,
  };
  const leaseActive = new Date(detail.leased_until ?? 0).getTime() > now;
  const feedback = (title, description, attention = false) => ({
    title,
    description,
    attention,
    ...counts,
  });
  if (detail.inventory_posted_at || (detail.job_kind !== "stock" && (detail.phase === "complete" || state?.packed)))
    return feedback("Job complete", detail.job_kind === "stock"
      ? "All planned products have been received into finished inventory."
      : "Printing and manufacturing checks are complete.");
  if (detail.phase === "blocked" || state?.hold)
    return feedback("Paused — needs attention", formatManufacturingMessage(detail.issue) || "Resolve the manufacturing hold before continuing.", true);
  if (statuses.includes("needs_review"))
    return feedback("Print outcome needs review", "Check the affected page and printer queue. Choose Page printed successfully if it is usable, or reprint that side if it is missing or damaged.", true);
  if (detail.job_kind === "stock" && state?.packed)
    return feedback("Packaged — awaiting stock receipt", "Scan the packaged products and receive the actual finished quantities. Packing alone does not add inventory.");
  if (!detail.print_requested_at)
    return feedback("Awaiting Send to printers", "Review this job, then send it when the printers and paper are ready.");
  if (statuses.includes("submitting")) {
    if (!leaseActive)
      return feedback("Interrupted print attempt — check paper", "The print helper's lease expired during submission. Review the attempt below before printing again.", true);
    return feedback("Sending pages to printers", "The local print helper is sending pages to Windows. Remaining pages continue automatically; no page-by-page confirmations are needed.");
  }
  if (counts.total && counts.sent === counts.total) {
    const finishing = !detail.manifest?.sheets?.length
      ? "Once the work ticket prints, continue picking, quality checks, and packing."
      : detail.manifest?.holoHandling === "pull-finished"
        ? "Once the sheets finish printing, continue gluing, cutting, pulling the listed finished holo cards, and quality checks."
        : "Once the sheets finish printing, continue gluing, cutting, applying holo stickers, and quality checks.";
    return feedback("Sent to printers", "Windows accepted all print jobs. No page-by-page confirmations are needed. " + finishing + " Use the reprint controls for any blank or damaged pages.");
  }
  if (!enabled)
    return feedback("Waiting for printing to be activated", "The request is saved. Pending pages will wait until printing is enabled.");
  if (leaseActive)
    return feedback(
      counts.sent ? "Sending remaining pages to printers"
        : detail.manifest ? "Preparing pages for the printers" : "Preparing card selection and print pages",
      "The local print helper has picked up this job. Its progress will update here automatically.",
    );
  return feedback(
    counts.sent ? "Waiting to send remaining pages" : "Waiting for local print helper",
    "The request is saved. Keep the printer PC awake and signed in with the print helper running.",
  );
}

// A replaced/aborted refresh must never overwrite newer data, even if a fetch
// implementation finishes after abort. Background refreshes never overlap.
export function createRefreshGuard() {
  let active = null;
  function invalidate() {
    active?.controller.abort();
    active = null;
  }
  return {
    invalidate,
    begin({ replace = true } = {}) {
      if (active && !replace) return null;
      invalidate();
      const current = { controller: new AbortController() };
      active = current;
      return {
        signal: current.controller.signal,
        abort: () => current.controller.abort(),
        isCurrent: () => active === current,
        finish() {
          if (active === current) active = null;
        },
      };
    },
  };
}
