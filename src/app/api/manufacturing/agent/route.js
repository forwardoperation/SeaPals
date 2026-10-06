import {
  authenticated,
  mutationOriginAllowed,
  uuid,
  assetKey,
  PRIVATE_HEADERS,
  productionPhase,
} from "@/lib/manufacturing/integration.mjs";
import { preflightPrintAssets } from "@/lib/manufacturing/printPlan.mjs";
import { service, json, body, bucket } from "@/lib/manufacturing/server";
export const runtime = "nodejs";
function auth(request) {
  return (
    authenticated(request, process.env, "agent") &&
    mutationOriginAllowed(request)
  );
}
export async function POST(request) {
  if (!auth(request)) return json({ error: "Unauthorized." }, 401);
  try {
    const payload = await body(request),
      s = service();
    if (!uuid(payload.leaseToken)) throw new Error("Invalid agent lease.");
    if (payload.action === "claim") {
      if (process.env.MANUFACTURING_ENABLED !== "true")
        return json({ disabled: true });
      return json({
        job: await s.claim(
          payload.leaseToken,
          process.env.MANUFACTURING_ALLOW_TEST_ORDERS === "true",
        ),
      });
    }
    if (!uuid(payload.orderId)) throw new Error("Invalid order ID.");
    if (payload.action === "heartbeat")
      return json({
        renewed: await s.rpc("heartbeat", {
          p_order: payload.orderId,
          p_token: payload.leaseToken,
        }),
      });
    if (payload.action === "settle") {
      const r = await s.row(payload.orderId);
      if (!r.state) throw new Error("Order is not prepared.");
      const phase = productionPhase(r.state);
      if (["queued", "active"].includes(phase))
        throw new Error("Print attempts remain unfinished.");
      if (!r.lease_token && r.phase === phase) return json({ phase });
      await s.rpc("settle", {
        p_order: payload.orderId,
        p_token: payload.leaseToken,
        p_expected: r.revision,
        p_phase: phase,
      });
      return json({ phase });
    }
    if (payload.action === "event") {
      if (
        payload.event?.type === "submission_started" &&
        process.env.MANUFACTURING_ENABLED !== "true"
      )
        throw new Error("Printing is disabled.");
      return json(
        await s.event(
          payload.orderId,
          payload.event,
          "agent",
          payload.leaseToken,
        ),
      );
    }
    if (payload.action === "block")
      return json({
        blocked: await s.rpc("block", {
          p_order: payload.orderId,
          p_token: payload.leaseToken,
          p_issue: String(payload.issue ?? "Agent needs review").slice(0, 500),
        }),
      });
    throw new Error("Unknown operation.");
  } catch (error) {
    return json({ error: error.message }, 409);
  }
}
export async function GET(request) {
  if (!auth(request)) return json({ error: "Unauthorized." }, 401);
  try {
    const q = new URL(request.url).searchParams,
      orderId = q.get("orderId"),
      token = q.get("leaseToken"),
      id = q.get("assetId");
    if (!uuid(orderId) || !uuid(token)) throw new Error("Invalid lease.");
    const s = service(),
      r = await s.row(orderId);
    if (
      r.lease_token !== token ||
      new Date(r.leased_until) <= new Date() ||
      !r.manifest_text
    )
      return json({ error: "Lease expired." }, 409);
    const release = await s.release(r.release_id);
    if (
      !preflightPrintAssets(
        JSON.parse(r.manifest_text),
        release,
      ).requiredAssetIds.includes(id)
    )
      return json({ error: "Unknown asset." }, 404);
    const object = await (await bucket()).get(assetKey(release.assets[id]));
    if (!object) return json({ error: "Private artwork missing." }, 404);
    return new Response(object.body, {
      headers: {
        ...PRIVATE_HEADERS,
        "Content-Type": "image/png",
        "Content-Length": String(object.size),
      },
    });
  } catch {
    return json({ error: "Private artwork unavailable." }, 503);
  }
}
