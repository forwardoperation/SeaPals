import {
  authenticated,
  mutationOriginAllowed,
  uuid,
  validateRelease,
  assetKey,
  pngDimensions,
  sha256,
} from "@/lib/manufacturing/integration.mjs";
import { service, json, body, bucket } from "@/lib/manufacturing/server";
export const runtime = "nodejs";
function auth(request) {
  return (
    authenticated(request, process.env, "operator") &&
    mutationOriginAllowed(request)
  );
}
export async function GET(request) {
  if (!auth(request)) return json({ error: "Unauthorized." }, 401);
  try {
    const id = new URL(request.url).searchParams.get("orderId");
    if (id && !uuid(id)) return json({ error: "Invalid order ID." }, 400);
    if (!id) {
      const s = service();
      const [orders, inventory] = await Promise.all([s.list(), s.inventory()]);
      return json({
        orders,
        ...inventory,
        enabled: process.env.MANUFACTURING_ENABLED === "true",
      });
    }
    return json(await service().detail(id));
  } catch {
    return json(
      {
        error:
          "Could not load manufacturing. Check that manufacturing.sql and manufacturing-inventory.sql have been applied.",
      },
      503,
    );
  }
}
export async function POST(request) {
  if (!auth(request)) return json({ error: "Unauthorized." }, 401);
  try {
    const payload = await body(request),
      s = service();
    if (payload.action === "build_stock")
      return json(await s.createStock(payload.id, payload.items));
    if (payload.action === "adjust_stock")
      return json(
        await s.adjustStock(
          payload.id,
          payload.productId,
          payload.quantity,
          payload.reason,
        ),
      );
    if (payload.action === "publish") {
      const release = validateRelease(payload.release),
        storage = await bucket();
      for (const asset of Object.values(release.assets)) {
        const stored = await storage.head(assetKey(asset));
        if (
          !stored ||
          stored.customMetadata?.sha256 !== asset.sha256 ||
          Number(stored.customMetadata?.width) !== asset.width ||
          Number(stored.customMetadata?.height) !== asset.height
        )
          throw new Error(
            "An artwork file has not been uploaded or its dimensions differ.",
          );
      }
      await s.rpc("publish", {
        p_id: release.releaseId,
        p_manifest: JSON.stringify(release),
      });
      return json({ published: release.releaseId });
    }
    if (!uuid(payload.orderId)) throw new Error("Invalid order ID.");
    if (payload.action === "retry")
      return json({
        queued: await s.rpc("retry", { p_order: payload.orderId }),
      });
    if (payload.action === "event")
      return json(await s.event(payload.orderId, payload.event, "operator"));
    throw new Error("Unknown operation.");
  } catch (error) {
    return json({ error: error.message }, 409);
  }
}
export async function PUT(request) {
  if (!auth(request)) return json({ error: "Unauthorized." }, 401);
  try {
    if (request.headers.get("content-type") !== "image/png")
      return json({ error: "PNG required." }, 415);
    const reader = request.body.getReader(),
      chunks = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 30_000_000) {
        await reader.cancel();
        return json({ error: "PNG exceeds 30 MB." }, 413);
      }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks),
      dimensions = pngDimensions(bytes),
      hash = sha256(bytes);
    if (dimensions.width > 3300 || dimensions.height > 4200)
      throw new Error("Export exceeds the print dimensions limit.");
    const storage = await bucket(),
      key = assetKey({ sha256: hash });
    if (!(await storage.head(key)))
      await storage.put(key, bytes, {
        httpMetadata: {
          contentType: "image/png",
          cacheControl: "private, no-store",
        },
        customMetadata: {
          sha256: hash,
          width: String(dimensions.width),
          height: String(dimensions.height),
        },
      });
    return json({ path: key, sha256: hash, ...dimensions });
  } catch {
    return json(
      {
        error:
          "Private artwork upload failed. Check private storage and the PNG export.",
      },
      503,
    );
  }
}
