import { printSidesForSheet } from "../../../lib/manufacturing/sheetKinds.mjs";

// Stock tickets are obsolete print targets, including saved jobs that still
// carry a historical ticket status. Card-side errors remain visible.
export const isStockBuild = (detail) =>
  detail?.job_kind === "stock" || detail?.manifest?.jobKind === "stock";

export const requiresWorkTicket = (detail) =>
  !isStockBuild(detail) && detail?.state?.ticket?.ticket !== "not_required";

export function printStatuses(detail) {
  const statuses = Object.values(detail?.state?.sheets ?? {}).flatMap((sheet) => printSidesForSheet(sheet).map((side) => sheet[side]));
  if (requiresWorkTicket(detail) && detail?.state?.ticket)
    statuses.push(detail.state.ticket.ticket);
  return statuses;
}
