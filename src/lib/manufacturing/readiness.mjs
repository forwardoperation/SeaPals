import { isFlyerSheet } from "./sheetKinds.mjs";

// Browser-safe summary; mutations and manifest validation stay on the server.
// Successful submission permits finishing; physical quality is checked before packing.
export const isPrintSubmitted = (status) =>
  status === "submitted" || status === "confirmed";

export function workflowReadiness(state) {
  const sheets = Object.values(state.sheets);
  const allPrinted = sheets.every(
    (sheet) => isPrintSubmitted(sheet.fronts) && (isFlyerSheet(sheet) || isPrintSubmitted(sheet.backs)),
  );
  const assembly = sheets.filter(sheet => !isFlyerSheet(sheet));
  const allGlued = assembly.every((sheet) => sheet.glued);
  const allCut = assembly.every((sheet) => sheet.cut);
  const holosRemaining = Object.values(state.holos).filter(
    (done) => !done,
  ).length;
  const accessoriesRemaining = Object.values(state.accessories ?? {}).filter(
    (done) => !done,
  ).length;
  const stockRemaining = Object.values(state.stock ?? {}).filter(
    (done) => !done,
  ).length;
  return {
    allPrinted,
    allGlued,
    allCut,
    holosRemaining,
    accessoriesRemaining,
    stockRemaining,
    canQualityCheck:
      !state.hold &&
      allPrinted &&
      allGlued &&
      allCut &&
      holosRemaining === 0 &&
      accessoriesRemaining === 0 &&
      stockRemaining === 0,
    canPack: !state.hold && state.qualityChecked,
  };
}
