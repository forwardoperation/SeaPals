import { fixedSheetLabel } from "../../../lib/manufacturing/recipes.mjs";

// A sheet number follows the saved manifest order, which is also the order
// each printer receives its pages. Never rewrite the saved sheet identity.
export function sheetDisplayLabel(manifest, sheetId) {
  if (sheetId === "work-ticket") return "Work ticket";
  const sheets = manifest?.sheets ?? [];
  const index = sheets.findIndex((sheet) => sheet.sheetId === sheetId);
  if (index < 0) return sheetId;
  const assetId = sheets[index].fronts?.assetId;
  return `Sheet ${index + 1} of ${sheets.length}${assetId ? ` · ${fixedSheetLabel(assetId)}` : ""}`;
}

// Operator reprints change the same revision the print helper acknowledges.
// Wait for its lease to end, then reconcile any interrupted attempt first.
export function reprintReadiness(detail, now = Date.now()) {
  const active = new Date(detail?.leased_until ?? 0).getTime() > now;
  const states = detail?.state;
  const submitting = states?.ticket?.ticket === "submitting" ||
    Object.values(states?.sheets ?? {}).some((sheet) =>
      sheet.fronts === "submitting" || sheet.backs === "submitting");
  const interrupted = !active && submitting;
  return {
    active,
    interrupted,
    blocked: active || interrupted,
    message: active
      ? "Wait for the current print attempt to finish before reprinting a sheet."
      : interrupted
        ? "An interrupted attempt needs review. Check the printer queue, then use Review interrupted attempt on that page before reprinting."
        : "",
  };
}
