import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { authenticated, mutationOriginAllowed, uuid, assetKey, PRIVATE_HEADERS } from "./integration.mjs";

// Execute the real route with local dependencies; no Supabase, object storage,
// artwork download, or printer can be reached by this harness.
const routeSource = (await readFile(new URL("../../app/api/admin/manufacturing/preview/route.js", import.meta.url), "utf8"))
  .replace(/^import .+;\r?\n/gm, "").replace(/^export const runtime.+;\r?\n/m, "").replace("export async function GET", "async function GET");
const orderId = "7ec4e9fa-5aa0-4088-bd7c-f8b2734baf14", token = "preview-test-staff-token-at-least-24-characters";
const sha = "a".repeat(64), asset = { sha256: sha, path: `manufacturing/sha256/${sha}.png`, width: 2550, height: 3300 };
function harness({ prepared = true, missingAsset = false } = {}) {
  const calls = [];
  const plan = { sheetId: "sheet1", side: "fronts", releaseId: "saved-release", requiredAssetIds: ["saved-page"], layers: [] };
  const dependencies = {
    authenticated: (request, _env, role) => authenticated(request, { STORE_ADMIN_TOKEN: token }, role), mutationOriginAllowed, uuid, assetKey, PRIVATE_HEADERS,
    buildPagePreview(manifest, release, sheet, side) { calls.push(["plan", release.releaseId, sheet, side]); return { ...plan, side }; },
    json: (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { ...PRIVATE_HEADERS, "Content-Type": "application/json" } }),
    service: () => ({
      row: async id => { calls.push(["row", id]); return prepared ? { manifest_text: "saved", release_id: "saved-release" } : null; },
      release: async id => { calls.push(["release", id]); return { releaseId: id, assets: { "saved-page": asset } }; },
      unpack: () => ({ manifest: { sheets: [{ sheetId: "sheet1" }] } }),
    }),
    bucket: async () => ({ get: async key => { calls.push(["asset", key]); return missingAsset ? null : { body: new Uint8Array([137, 80, 78, 71]), size: 4 }; } }),
  };
  const GET = new Function(...Object.keys(dependencies), `${routeSource}; return GET;`)(...Object.values(dependencies));
  const request = (query = "", headers = { "x-admin-token": token }) => new Request(`https://searealm.com/api/admin/manufacturing/preview?orderId=${orderId}&sheetId=sheet1&side=fronts${query}`, { headers });
  return { GET, request, calls, plan };
}

test("private page previews require staff authentication and same-origin requests before reading saved work", async () => {
  const h = harness();
  for (const headers of [{}, { "x-admin-token": "wrong" }, { "x-admin-token": token, origin: "https://outside.example" }]) {
    const response = await h.GET(h.request("", headers));
    assert.equal(response.status, 401); assert.equal(response.headers.get("cache-control"), PRIVATE_HEADERS["Cache-Control"]);
  }
  assert.deepEqual(h.calls, []);
});

test("private page preview metadata uses the saved release without retrieving or exposing private object URLs", async () => {
  const h = harness(), response = await h.GET(h.request());
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { plan: h.plan });
  assert.deepEqual(h.calls, [["row", orderId], ["release", "saved-release"], ["plan", "saved-release", "sheet1", "fronts"]]);
  for (const [key, value] of Object.entries(PRIVATE_HEADERS)) assert.equal(response.headers.get(key), value);
});

test("private preview streams only assets in the chosen saved page with no-store headers", async () => {
  const h = harness();
  const denied = await h.GET(h.request("&assetId=unrelated-card"));
  assert.equal(denied.status, 404); assert.ok(!h.calls.some(call => call[0] === "asset"));
  const response = await h.GET(h.request("&assetId=saved-page"));
  assert.equal(response.status, 200); assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("content-length"), "4");
  for (const [key, value] of Object.entries(PRIVATE_HEADERS)) assert.equal(response.headers.get(key), value);
  assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [137, 80, 78, 71]);
  assert.deepEqual(h.calls.at(-1), ["asset", assetKey(asset)]);
});

test("private previews reject missing jobs, sheets, assets, and malformed inputs without fetching unrelated artwork", async () => {
  const missingJob = harness({ prepared: false }); assert.equal((await missingJob.GET(missingJob.request())).status, 404);
  const missingAsset = harness({ missingAsset: true }); assert.equal((await missingAsset.GET(missingAsset.request("&assetId=saved-page"))).status, 404);
  const h = harness(), req = h.request(); const url = new URL(req.url); url.searchParams.set("sheetId", "missing");
  assert.equal((await h.GET(new Request(url, { headers: req.headers }))).status, 404);
  assert.ok(!h.calls.some(call => call[0] === "plan" || call[0] === "asset"));
  for (const [key, value] of [["orderId", "invalid"], ["sheetId", ""], ["side", "ticket"]]) {
    const bad = new URL(req.url); bad.searchParams.set(key, value);
    assert.equal((await h.GET(new Request(bad, { headers: req.headers }))).status, 400);
  }
});
