import { authenticated, mutationOriginAllowed, uuid, assetKey, PRIVATE_HEADERS } from "@/lib/manufacturing/integration.mjs";
import { printSidesForSheet } from "@/lib/manufacturing/sheetKinds.mjs";
import { buildPagePreview } from "@/lib/manufacturing/pagePreview.mjs";
import { service, json, bucket } from "@/lib/manufacturing/server";
export const runtime = "nodejs";
export async function GET(request) {
  if (!authenticated(request, process.env, "operator") || !mutationOriginAllowed(request))
    return json({ error: "Unauthorized." }, 401);
  try {
    const q = new URL(request.url).searchParams, orderId = q.get("orderId"),
      sheetId = q.get("sheetId"), side = q.get("side"), assetId = q.get("assetId");
    if (!uuid(orderId) || !sheetId || sheetId.length > 200 || !["fronts", "backs"].includes(side))
      return json({ error: "Choose a saved page and its front or back." }, 400);
    const s = service(), row = await s.row(orderId);
    if (!row?.manifest_text || !row.release_id) return json({ error: "This job has no saved print pages." }, 404);
    const release = await s.release(row.release_id), manifest = s.unpack(row).manifest;
    const sheet = manifest.sheets.find(sheet => sheet.sheetId === sheetId);
    if (!sheet) return json({ error: "This job has no such saved page." }, 404);
    if (!printSidesForSheet(sheet).includes(side)) return json({ error: "This flyer prints on Epson only." }, 400);
    const plan = buildPagePreview(manifest, release, sheetId, side);
    if (!assetId) return json({ plan });
    if (!plan.requiredAssetIds.includes(assetId)) return json({ error: "This artwork is not part of the selected page." }, 404);
    const object = await (await bucket()).get(assetKey(release.assets[assetId]));
    if (!object) return json({ error: "Private artwork is missing." }, 404);
    return new Response(object.body, { headers: { ...PRIVATE_HEADERS, "Content-Type": "image/png", "Content-Length": String(object.size) } });
  } catch (error) {
    return json({ error: "Could not load this saved page preview." }, error.status === 409 ? 409 : 503);
  }
}
