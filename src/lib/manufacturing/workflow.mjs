import { contentHash } from "./boosters.mjs";
import { verifyManifest } from "./printPlan.mjs";
import { workflowReadiness } from "./readiness.mjs";
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
        {
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
    ticket: { ticket: "queued" },
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

export function applyManufacturingEvent(original, manifest, event) {
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
  if (event.expectedRevision !== original.revision)
    throw new Error("Production state changed. Reload before updating.");
  const state = structuredClone(original);
  const sheet =
    event.side === "ticket" ? state.ticket : state.sheets[event.sheetId];
  const side = event.side;
  const printAction = [
    "submission_started",
    "submission_succeeded",
    "submission_uncertain",
    "confirm_printed",
    "reprint",
  ].includes(event.type);
  if (printAction && (!sheet || !["fronts", "backs", "ticket"].includes(side)))
    throw new Error("A known sheet and print side are required.");
  const agentActions = [
    "submission_started",
    "submission_succeeded",
    "submission_uncertain",
  ];
  if (event.role === "agent" && !agentActions.includes(event.type))
    throw new Error("Only an operator can confirm physical work.");
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
      sheet[side] = "queued";
      if (side === "ticket") break;
      sheet.glued = false;
      sheet.cut = false;
      state.qualityChecked = false;
      state.packed = false;
      if (side === "fronts") {
        for (const item of manifest.holoChecklist.filter(
          (item) => item.sheetId === event.sheetId,
        ))
          state.holos[item.id] = false;
      }
      break;
    case "holo_applied": {
      const item = manifest.holoChecklist.find(
        (item) => item.id === event.holoId,
      );
      if (!item || state.sheets[item.sheetId].fronts !== "confirmed")
        throw new Error(
          "Confirm the matching front sheet before applying a holo sticker.",
        );
      state.holos[item.id] = true;
      break;
    }
    case "glued":
      if (!sheet || sheet.fronts !== "confirmed" || sheet.backs !== "confirmed")
        throw new Error(
          "Both matching sheets must be confirmed printed before gluing.",
        );
      sheet.glued = true;
      break;
    case "cut":
      if (!sheet?.glued)
        throw new Error("Confirm the sheet pair was glued before cutting.");
      sheet.cut = true;
      break;
    case "quality_checked":
      if (!workflowReadiness(state).canQualityCheck)
        throw new Error(
          "Complete printing, finishing, every holo sticker, accessories, and reserved stock picks first.",
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
      if (!workflowReadiness(state).canPack)
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
    fingerprint,
    recordedAt: new Date().toISOString(),
  });
  return state;
}
