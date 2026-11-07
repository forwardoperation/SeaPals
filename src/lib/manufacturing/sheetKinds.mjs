// Historical manifests omit kind and remain paired card sheets.
export const isFlyerSheet = (sheet) => sheet?.kind === "flyer";
export const printSidesForSheet = (sheet) => isFlyerSheet(sheet) ? ["fronts"] : ["fronts", "backs"];
