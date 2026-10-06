// Browser-safe summary; mutations and manifest validation stay on the server.
export function workflowReadiness(state) {
  const sheets = Object.values(state.sheets);
  const allPrinted = sheets.every(
    (sheet) => sheet.fronts === "confirmed" && sheet.backs === "confirmed",
  );
  const allGlued = sheets.every((sheet) => sheet.glued);
  const allCut = sheets.every((sheet) => sheet.cut);
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
