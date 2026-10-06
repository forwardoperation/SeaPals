import { createHash, timingSafeEqual } from "node:crypto";
import {
  createManufacturingManifest,
  preflightPrintAssets,
  verifyManifest,
  assertRequestMatchesManifest,
  productionItemsForPlan,
  validateOrderRequest,
} from "./printPlan.mjs";
import {
  applyManufacturingEvent,
  createManufacturingState,
} from "./workflow.mjs";
import { validateBoosterPool } from "./boosters.mjs";
import { BOOSTER_PRODUCTS, fixedSheetAssets } from "./recipes.mjs";

export const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
export const uuid = (value) =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export function authenticated(request, env, role) {
  const expected =
    role === "agent" ? env.MANUFACTURING_AGENT_TOKEN : env.STORE_ADMIN_TOKEN;
  const supplied =
    role === "agent"
      ? request.headers.get("authorization")?.replace(/^Bearer /, "")
      : request.headers.get("x-admin-token");
  if (!expected || !supplied || expected.length < 24) return false;
  const a = Buffer.from(expected),
    b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function mutationOriginAllowed(request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
export function normalizedEvent(input, role) {
  if (
    !input ||
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 0
  )
    throw new Error("A revision is required.");
  const event = {
    id: input.id,
    type: input.type,
    actor: role === "agent" ? "local-print-agent" : "staff",
    role,
    expectedRevision: input.expectedRevision,
  };
  for (const key of [
    "sheetId",
    "side",
    "holoId",
    "accessoryId",
    "productId",
    "reason",
  ])
    if (input[key] !== undefined)
      event[key] = String(input[key]).slice(0, key === "reason" ? 500 : 200);
  return event;
}
export function productionPhase(state, leaseActive = false) {
  const statuses = [
    state.ticket?.ticket,
    ...Object.values(state.sheets).flatMap((s) => [s.fronts, s.backs]),
  ];
  if (statuses.includes("submitting")) return "active";
  if (state.hold) return "blocked";
  if (statuses.includes("queued")) return leaseActive ? "active" : "queued";
  if (statuses.includes("needs_review")) return "awaiting_operator";
  if (state.packed) return "complete";
  return "awaiting_operator";
}
export function requireOrderArtwork(items, release) {
  const ids = new Set();
  for (const item of items) {
    const set = BOOSTER_PRODUCTS[item.productId];
    if (set)
      for (const card of release.catalog.filter((c) => c.set === set))
        ids.add(card.printingId);
    else for (const id of fixedSheetAssets(item.productId)) ids.add(id);
  }
  if (ids.size) ids.add("standard-back-sheet");
  const missing = [...ids].filter((id) => !release.assets?.[id]);
  if (missing.length)
    throw new Error(
      `Artwork is incomplete for this order: ${missing.slice(0, 8).join(", ")}. No booster draw was created. Publish the complete set and retry preparation.`,
    );
}
export function assetKey(asset) {
  if (!/^[a-f0-9]{64}$/.test(asset?.sha256 ?? ""))
    throw new Error("Invalid private artwork checksum.");
  return `manufacturing/sha256/${asset.sha256}.png`;
}
export function pngDimensions(bytes) {
  const b = Buffer.from(bytes);
  if (
    b.length < 33 ||
    b.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
    b.subarray(12, 16).toString() !== "IHDR"
  )
    throw new Error("A PNG export is required.");
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}
export function validateRelease(release) {
  if (
    !/^[A-Za-z0-9._-]{1,100}$/.test(release?.releaseId ?? "") ||
    !release.figmaVersion ||
    !Array.isArray(release.catalog)
  )
    throw new Error("A versioned artwork release and catalog are required.");
  for (const set of ["reef", "deep", "ocean"])
    validateBoosterPool(release.catalog, set);
  for (const [id, asset] of Object.entries(release.assets ?? {})) {
    if (!/^[A-Za-z0-9_-]{1,150}$/.test(id) || asset.path !== assetKey(asset))
      throw new Error("Invalid private asset entry.");
    if (id === "standard-back-sheet" || id.startsWith("sheet-")) {
      if (asset.width !== 2550 || asset.height !== 3300)
        throw new Error(`Incorrect Letter sheet dimensions: ${id}`);
      if (
        id.startsWith("sheet-") &&
        (!Array.isArray(asset.positions) ||
          asset.positions.length !== 9 ||
          asset.positions.some(
            (p) =>
              ![p.x, p.y, p.width, p.height].every(Number.isFinite) ||
              Math.abs(p.width - 720) > 1 ||
              Math.abs(p.height - 1008) > 1 ||
              p.x < 0 ||
              p.y < 0 ||
              p.x + p.width > 2550 ||
              p.y + p.height > 3300,
          ))
      )
        throw new Error(`Missing or invalid Figma card positions: ${id}`);
    } else if (
      asset.width < 720 ||
      asset.height < 1008 ||
      asset.width > 3000 ||
      asset.height > 4200 ||
      Math.abs(asset.width / asset.height - 5 / 7) > 0.003
    )
      throw new Error(`Incorrect card dimensions: ${id}`);
  }
  return release;
}

export function manufacturingService(db) {
  async function result(query) {
    const { data, error } = await query;
    if (error)
      throw new Error(
        error.code === "P0001"
          ? error.message
          : "Manufacturing storage rejected the request. Reload and check the migration or agent lease.",
      );
    return data;
  }
  const rpc = (name, args) => result(db.rpc(`manufacturing_${name}`, args));
  const row = (orderId) =>
    result(
      db
        .from("manufacturing_orders")
        .select("*")
        .eq("order_id", orderId)
        .single(),
    );
  const customerOrder = (orderId) =>
    result(
      db
        .from("store_orders")
        .select(
          "id,order_number,payment_status,payment_livemode,fulfillment_status,fulfillment_method,pickup_location,production_due_date,production_option_name,tracking_number,tracking_url,customer_email,store_order_items(product_id,product_name,quantity)",
        )
        .eq("id", orderId)
        .single(),
    );
  async function order(orderId, job) {
    const r = job ?? (await row(orderId));
    if (r.job_kind !== "stock") return customerOrder(orderId);
    const products = await result(
      db.from("manufacturing_stock").select("product_id,product_name"),
    );
    return {
      id: r.order_id,
      order_number: r.display_number,
      payment_status: "stock build",
      payment_livemode: true,
      fulfillment_status: r.phase,
      fulfillment_method: "inventory",
      production_due_date: null,
      store_order_items: r.stock_request.map((i) => ({
        product_id: i.productId,
        product_name:
          products.find((p) => p.product_id === i.productId)?.product_name ??
          i.productId,
        quantity: i.quantity,
      })),
    };
  }
  async function release(id) {
    const r = await result(
      db
        .from("manufacturing_releases")
        .select("manifest_text")
        .eq("id", id)
        .single(),
    );
    return validateRelease(JSON.parse(r.manifest_text));
  }
  function unpack(r) {
    return {
      ...r,
      manifest: r.manifest_text
        ? verifyManifest(JSON.parse(r.manifest_text))
        : null,
      manifest_text: undefined,
    };
  }
  async function claim(token, allowTest = false) {
    let r = await rpc("claim", { p_token: token, p_allow_test: allowTest });
    if (!r) return null;
    try {
      const o = await order(r.order_id, r);
      const art = r.release_id
        ? await release(r.release_id)
        : { releaseId: "stock-only", catalog: [], assets: {} };
      if (!r.manifest_text) {
        requireOrderArtwork(
          productionItemsForPlan(
            o.store_order_items.map((i) => ({
              productId: i.product_id,
              quantity: i.quantity,
            })),
            r.inventory_plan,
          ),
          art,
        );
        const manifest = createManufacturingManifest({
          request: {
            orderId: o.id,
            orderNumber: o.order_number,
            items: o.store_order_items.map((i) => ({
              productId: i.product_id,
              quantity: i.quantity,
            })),
          },
          catalog: art.catalog,
          artworkRelease: art.releaseId,
          inventoryPlan: r.inventory_plan ?? undefined,
          jobKind: r.job_kind ?? "order",
        });
        r = await rpc("save_manifest", {
          p_order: o.id,
          p_token: token,
          p_manifest: JSON.stringify(manifest),
          p_state: createManufacturingState(manifest),
        });
      }
      const unpacked = unpack(r);
      assertRequestMatchesManifest(
        {
          orderId: o.id,
          orderNumber: o.order_number,
          items: o.store_order_items.map((i) => ({
            productId: i.product_id,
            quantity: i.quantity,
          })),
        },
        unpacked.manifest,
      );
      const check = preflightPrintAssets(unpacked.manifest, art);
      if (!check.ready)
        throw new Error(
          `Private artwork incomplete: ${check.errors.slice(0, 5).join("; ")}`,
        );
      // No buyer email or address is required on a workshop PC.
      const { customer_email, ...ticketOrder } = o;
      return { ...unpacked, order: ticketOrder, release: art };
    } catch (error) {
      await rpc("block", {
        p_order: r.order_id,
        p_token: token,
        p_issue: String(error.message).slice(0, 500),
      });
      return { blocked: true, orderId: r.order_id, issue: error.message };
    }
  }
  async function event(orderId, input, role, token = null) {
    const r = await row(orderId);
    if (!r.manifest_text)
      throw new Error("The order has not been prepared yet.");
    const manifest = verifyManifest(JSON.parse(r.manifest_text));
    const e = normalizedEvent(input, role);
    if (r.inventory_posted_at && e.type === "reprint" && e.side !== "ticket")
      throw new Error(
        "This build was received into stock. Adjust damaged stock and create a replacement build.",
      );
    if (
      role === "operator" &&
      e.type === "submission_uncertain" &&
      new Date(r.leased_until) > new Date()
    )
      throw new Error(
        "The print agent is still active. Wait for its lease to expire before reviewing an interrupted attempt.",
      );
    const next = applyManufacturingEvent(r.state, manifest, e);
    if (next === r.state) return unpack(r);
    return unpack(
      await rpc("commit", {
        p_order: orderId,
        p_token: token,
        p_expected: r.revision,
        p_state: next,
        p_event: e,
        p_phase: productionPhase(
          next,
          Boolean(r.lease_token && new Date(r.leased_until) > new Date()),
        ),
      }),
    );
  }
  return {
    rpc,
    row,
    order,
    release,
    claim,
    event,
    unpack,
    async inventory() {
      const [stock, jobs, movements] = await Promise.all([
        result(
          db.from("manufacturing_stock").select("*").order("product_name"),
        ),
        result(
          db
            .from("manufacturing_orders")
            .select("stock_request,phase")
            .eq("job_kind", "stock")
            .is("inventory_posted_at", null),
        ),
        result(
          db
            .from("manufacturing_stock_movements")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(50),
        ),
      ]);
      return {
        stock: stock.map((s) => ({
          ...s,
          available: s.on_hand - s.reserved,
          planned: jobs.reduce(
            (sum, j) =>
              sum +
              (j.stock_request.find((i) => i.productId === s.product_id)
                ?.quantity ?? 0),
            0,
          ),
        })),
        movements,
      };
    },
    async createStock(id, items) {
      if (!uuid(id)) throw new Error("A stock build ID is required.");
      const request = validateOrderRequest({
        orderId: id,
        orderNumber: "STOCK",
        items,
      });
      return unpack(
        await rpc("create_stock_job", { p_id: id, p_items: request.items }),
      );
    },
    async adjustStock(id, productId, quantity, reason) {
      if (
        !uuid(id) ||
        !Number.isSafeInteger(quantity) ||
        quantity === 0 ||
        Math.abs(quantity) > 10000 ||
        typeof reason !== "string" ||
        !reason.trim() ||
        reason.length > 500
      )
        throw new Error("Enter a quantity change and a reason.");
      return rpc("adjust_stock", {
        p_id: id,
        p_product: productId,
        p_quantity: quantity,
        p_reason: reason.trim(),
      });
    },
    async list() {
      return result(
        db
          .from("manufacturing_orders")
          .select(
            "order_id,job_kind,display_number,inventory_plan,inventory_posted_at,phase,revision,issue,release_id,created_at,updated_at,store_orders(order_number,payment_status,fulfillment_status,production_due_date,payment_livemode)",
          )
          .order("created_at", { ascending: false })
          .limit(100),
      );
    },
    async detail(id) {
      const [r, o, notifications] = await Promise.all([
        row(id),
        order(id),
        result(
          db
            .from("manufacturing_notifications")
            .select("milestone,status,created_at,first_attempt_at,sent_at")
            .eq("order_id", id)
            .order("created_at"),
        ),
      ]);
      const { customer_email, ...safeOrder } = o;
      return { ...unpack(r), order: safeOrder, notifications };
    },
  };
}
export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
