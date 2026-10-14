// Read-only display state. A successful submission means Windows accepted the
// print job; only the operator can confirm the paper actually printed correctly.
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
    sent: statuses.filter((status) => ["submitted", "confirmed"].includes(status)).length,
    checked: statuses.filter((status) => status === "confirmed").length,
  };
  const feedback = (title, description, attention = false) => ({
    title,
    description,
    attention,
    ...counts,
  });
  if (detail.phase === "complete" || state?.packed || detail.inventory_posted_at)
    return feedback("Job complete", "Printing and manufacturing checks are complete.");
  if (detail.phase === "blocked" || state?.hold)
    return feedback("Paused — needs attention", detail.issue || "Resolve the manufacturing hold before continuing.", true);
  if (statuses.includes("needs_review"))
    return feedback("Print outcome needs review", "Check the physical pages and printer queue before confirming or authorizing a reprint.", true);
  if (!detail.print_requested_at)
    return feedback("Awaiting Send to printers", "Review this job, then send it when the printers and paper are ready.");
  if (statuses.includes("submitting")) {
    if (new Date(detail.leased_until ?? 0).getTime() <= now)
      return feedback("Interrupted print attempt — check paper", "The print helper's lease expired during submission. Review the attempt below before printing again.", true);
    return feedback("Sending pages to printers", "The local print helper is submitting pages to Windows. Paper still needs to be checked.");
  }
  if (counts.total && counts.checked === counts.total)
    return feedback("All printed pages checked", "Continue gluing, cutting, applying holo stickers, and the remaining manufacturing checks.");
  if (counts.total && counts.sent === counts.total)
    return feedback("Sent to printers — check paper", "Windows accepted all print jobs. Check the physical pages, then use Paper checked below.");
  if (!enabled)
    return feedback("Waiting for printing to be activated", "The request is saved. Pending pages will wait until printing is enabled.");
  if (new Date(detail.leased_until ?? 0).getTime() > now)
    return feedback(
      detail.manifest ? "Preparing pages for the printers" : "Preparing card selection and print pages",
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
