import { contentHash } from "./boosters.mjs";
import { verifyManifest } from "./printPlan.mjs";
import { fixedSheetAssets } from "./recipes.mjs";
import { isFlyerSheet, printSidesForSheet } from "./sheetKinds.mjs";
import { isPrintSubmitted, workflowReadiness } from "./readiness.mjs";
export { workflowReadiness } from "./readiness.mjs";

export function createManufacturingState(manifest) {
  verifyManifest(manifest);
  return {
    manifestHash: manifest.manifestHash,
    revision: 0,
    hold: false,
    sheets: Object.fromEntries(
      manifest.sheets.map((sheet) => [
        sheet.sheetId,
        isFlyerSheet(sheet) ? { kind: "flyer", fronts: "queued", backs: "not_required" } : {
          fronts: "queued",
          backs: "queued",
          glued: false,
          cut: false,
        },
      ]),
    ),
    holos: Object.fromEntries(
      manifest.holoChecklist.map((item) => [item.id, false]),
    ),
    ticket: { ticket: manifest.jobKind === "stock" ? "not_required" : "queued" },
    accessories: Object.fromEntries(
      (manifest.accessoryChecklist ?? []).map((item) => [item.id, false]),
    ),
    stock: Object.fromEntries(
      (manifest.inventoryPlan ?? [])
        .filter((p) => p.fromStock > 0)
        .map((p) => [p.productId, false]),
    ),
    qualityChecked: false,
    packed: false,
    events: [],
  };
}

// One batch is one operator event and one revision. The first real target stays
// on the event so the existing database reprint/received-stock guard still applies.
export function normalizedPageReprint(input) {
  if (input.type !== "reprint" || typeof input.productId !== "string" ||
      fixedSheetAssets(input.productId).length < 2 || !Array.isArray(input.targets) ||
      !input.targets.length || input.targets.length > 1000)
    throw new Error("Choose pages from one multi-page product.");
  const seen = new Set();
  const targets = input.targets.map(target => {
    if (!target || typeof target.sheetId !== "string" ||
        !/^[A-Za-z0-9_-]{1,200}$/.test(target.sheetId) ||
        !["fronts", "backs"].includes(target.side))
      throw new Error("Choose a saved page and its front or back.");
    const key = target.sheetId + ":" + target.side;
    if (seen.has(key)) throw new Error("A print side can be selected only once.");
    seen.add(key);
    return { sheetId: target.sheetId, side: target.side };
  });
  return { productId: input.productId, targets, ...targets[0] };
}

export function applyManufacturingEvent(
  original, manifest, event,
  { currentRevision = event?.expectedRevision } = {},
) {
  verifyManifest(manifest);
  if (original.manifestHash !== manifest.manifestHash)
    throw new Error("State belongs to a different manifest.");
  if (
    !event ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(event.id ?? "") ||
    !event.actor ||
    !["operator", "agent"].includes(event.role)
  )
    throw new Error("Event identity, actor, and role are required.");
  const fingerprint = contentHash(event);
  const prior = original.events.find((entry) => entry.id === event.id);
  if (prior) {
    if (prior.fingerprint !== fingerprint)
      throw new Error("Event ID was reused for a different action.");
    return original;
  }
  // The service may reconcile an agent event across verified unrelated staff
  // progress. Preserve the original event for stable retry fingerprints.
  if (currentRevision !== original.revision)
    throw new Error("Production state changed. Reload before updating.");
  const batch = event.targets === undefined ? null : normalizedPageReprint(event);
  if (batch) {
    if (event.role !== "operator" || event.sheetId !== batch.sheetId || event.side !== batch.side)
      throw new Error("Only an operator can authorize the selected page reprint.");
    const statuses = Object.values(original.sheets).flatMap(s => [s.fronts, s.backs]);
    if (manifest.jobKind !== "stock") statuses.push(original.ticket?.ticket);
    if (statuses.includes("submitting") || statuses.includes("queued"))
      throw new Error("Finish or resolve the current print queue before reprinting selected pages.");
    for (const target of batch.targets) {
      const saved = manifest.sheets.find(s => s.sheetId === target.sheetId);
      if (!saved || !printSidesForSheet(saved).includes(target.side) || saved.productId !== batch.productId ||
          !["submitted", "confirmed", "needs_review"].includes(original.sheets[target.sheetId]?.[target.side]))
        throw new Error("Every selected page must be a previously submitted page of this product.");
    }
  }
  const state = structuredClone(original);
  const sheet =
    event.side === "ticket" ? state.ticket : state.sheets[event.sheetId];
  const side = event.side;
  const manifestSheet = manifest.sheets.find(item => item.sheetId === event.sheetId);
  const printAction = [
    "submission_started",
    "submission_succeeded",
    "submission_uncertain",
    "confirm_printed",
    "reprint",
  ].includes(event.type);
  if (printAction && (!sheet || !["fronts", "backs", "ticket"].includes(side)))
    throw new Error("A known sheet and print side are required.");
  if (printAction && side !== "ticket" && (!manifestSheet || !printSidesForSheet(manifestSheet).includes(side)))
    throw new Error("This page has no requested print side.");
  if (["glued", "cut"].includes(event.type) && isFlyerSheet(manifestSheet))
    throw new Error("Flyers do not require gluing or cutting.");
  const agentActions = [
    "submission_started",
    "submission_succeeded",
    "submission_uncertain",
    "stock_ticket_skipped",
  ];
  if (event.role === "agent" && !agentActions.includes(event.type))
    throw new Error("Only an operator can confirm physical work.");
  if (manifest.jobKind === "stock" && side === "ticket" &&
      ["submission_started", "reprint"].includes(event.type))
    throw new Error("Stock builds do not print work tickets.");
  if (
    state.hold &&
    ![
      "release_hold",
      "hold",
      "submission_uncertain",
      "submission_succeeded",
    ].includes(event.type)
  )
    throw new Error("This order is on hold.");
  switch (event.type) {
    case "stock_ticket_skipped":
      if (event.role !== "agent" || manifest.jobKind !== "stock" ||
          event.sheetId !== "work-ticket" || side !== "ticket" ||
          !["queued", "submitting", "needs_review"].includes(state.ticket?.ticket))
        throw new Error("Only the print agent can retire a pending stock-build ticket.");
      // Retire obsolete paper, not a card page or a successful print receipt.
      // Preserve the old attempt status in the event history, including an
      // unknown physical outcome. The normal printer queue guard still applies.
      state.ticket.ticket = "not_required";
      break;
    case "submission_started":
      if (sheet[side] !== "queued")
        throw new Error(
          "A print was already submitted or needs operator review.",
        );
      sheet[side] = "submitting";
      break;
    case "submission_succeeded":
      if (sheet[side] !== "submitting")
        throw new Error("No matching print submission.");
      sheet[side] = "submitted";
      break;
    case "submission_uncertain":
      if (!["submitting", "submitted"].includes(sheet[side]))
        throw new Error("No print attempt to reconcile.");
      sheet[side] = "needs_review";
      break;
    case "confirm_printed":
      if (!["submitted", "needs_review"].includes(sheet[side]))
        throw new Error("No submitted sheet to confirm.");
      sheet[side] = "confirmed";
      break;
    case "reprint":
      if (!String(event.reason ?? "").trim())
        throw new Error("A reprint reason is required.");
      if (sheet[side] === "submitting")
        throw new Error("Reconcile the active printer attempt first.");
      for (const target of batch?.targets ?? [{ sheetId: event.sheetId, side }]) {
        const page = target.side === "ticket" ? state.ticket : state.sheets[target.sheetId];
        page[target.side] = "queued";
        if (target.side === "ticket") continue;
        if (!isFlyerSheet(manifest.sheets.find(item => item.sheetId === target.sheetId))) {
          page.glued = false;
          page.cut = false;
        }
        state.qualityChecked = false;
        state.packed = false;
        if (target.side === "fronts") {
          for (const item of manifest.holoChecklist.filter(item => item.sheetId === target.sheetId))
            state.holos[item.id] = false;
        }
      }
      break;
    case "holo_applied":
    case "holo_pulled": {
      const pullFinished = manifest.holoHandling === "pull-finished";
      if (event.type !== (pullFinished ? "holo_pulled" : "holo_applied"))
        throw new Error(pullFinished
          ? "This pack requires a finished holo card to be pulled, not a sticker confirmation."
          : "This saved pack requires its original holo sticker confirmation.");
      const item = manifest.holoChecklist.find(
        (item) => item.id === event.holoId,
      );
      if (!item || !isPrintSubmitted(state.sheets[item.sheetId].fronts))
        throw new Error(
          pullFinished
            ? "Send the matching front sheet to the printer and resolve any print issue before confirming the finished holo card was pulled."
            : "Send the matching front sheet to the printer and resolve any print issue before applying a holo sticker.",
        );
      state.holos[item.id] = true;
      break;
    }
    case "glued":
      if (!sheet || !isPrintSubmitted(sheet.fronts) || !isPrintSubmitted(sheet.backs))
        throw new Error(
          "Both matching sheets must be sent to the printers with any print issues resolved before gluing.",
        );
      sheet.glued = true;
      break;
    case "cut":
      if (!sheet?.glued)
        throw new Error("Confirm the sheet pair was glued before cutting.");
      sheet.cut = true;
      break;
    case "quality_checked":
      if (!workflowReadiness(state, manifest).canQualityCheck)
        throw new Error(
          manifest.holoHandling === "pull-finished"
            ? "Complete printing, finishing, accessories, and reserved stock picks first."
            : "Complete printing, finishing, every holo sticker, accessories, and reserved stock picks first.",
        );
      state.qualityChecked = true;
      break;
    case "accessory_picked":
      if (!Object.hasOwn(state.accessories ?? {}, event.accessoryId))
        throw new Error("Unknown accessory.");
      state.accessories[event.accessoryId] = true;
      break;
    case "stock_picked":
      if (!Object.hasOwn(state.stock ?? {}, event.productId))
        throw new Error("Unknown reserved finished product.");
      state.stock[event.productId] = true;
      break;
    case "packed":
      if (!workflowReadiness(state, manifest).canPack)
        throw new Error("Quality check is required before packing.");
      state.packed = true;
      break;
    case "hold":
      state.hold = true;
      break;
    case "release_hold":
      state.hold = false;
      break;
    default:
      throw new Error("Unknown manufacturing event.");
  }
  state.revision++;
  state.events.push({
    ...event,
    ...(event.type === "stock_ticket_skipped"
      ? { previousTicketStatus: original.ticket.ticket } : {}),
    fingerprint,
    appliedRevision: state.revision,
    recordedAt: new Date().toISOString(),
  });
  return state;
}
