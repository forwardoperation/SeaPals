// Local-only QA fixture. Never contacts a printer, buyer, or production database.
import http from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { buildPrintingCatalog } from "../../src/lib/manufacturing/boosters.mjs";
import {
  createManufacturingManifest,
  PRINT_LAYOUT,
} from "../../src/lib/manufacturing/printPlan.mjs";
import {
  createManufacturingState,
  applyManufacturingEvent,
} from "../../src/lib/manufacturing/workflow.mjs";
import {
  normalizedEvent,
  productionPhase,
} from "../../src/lib/manufacturing/integration.mjs";
import { renderTicket } from "./render.mjs";
import { PRIVATE_ROOT, REPO_ROOT, atomicJson } from "./orders.mjs";

const orderId = "10000000-0000-4000-8000-000000000001";
export async function previewFixture({
  id = orderId,
  items = [{ productId: "deep-dive-pack", quantity: 1 }],
  inventoryPlan,
  jobKind = "order",
} = {}) {
  const load = async (name) =>
    JSON.parse(await readFile(path.join(REPO_ROOT, "src/data", name), "utf8"));
  const catalog = buildPrintingCatalog(
    await load("gallery-set-list.json"),
    await load("gallery-images.json"),
  );
  const manifest = createManufacturingManifest({
    request: {
      orderId: id,
      orderNumber:
        jobKind === "stock" ? `STOCK-DEMO-${id.slice(0, 8)}` : "DEMO-1001",
      items,
    },
    catalog,
    artworkRelease: "preview-only",
    randomIndex: () => 0,
    inventoryPlan,
    jobKind,
  });
  let state = createManufacturingState(manifest);
  for (const target of [
    { sheetId: "work-ticket", side: "ticket" },
    ...manifest.sheets.flatMap((s) =>
      ["fronts", "backs"].map((side) => ({ sheetId: s.sheetId, side })),
    ),
  ]) {
    for (const type of ["submission_started", "submission_succeeded"])
      state = applyManufacturingEvent(
        state,
        manifest,
        normalizedEvent(
          {
            id: crypto.randomUUID(),
            type,
            expectedRevision: state.revision,
            ...target,
          },
          "agent",
        ),
      );
  }
  return {
    order_id: id,
    job_kind: jobKind,
    display_number: manifest.order.orderNumber,
    manifest,
    state,
    revision: state.revision,
    phase: "awaiting_operator",
    release_id: "preview-only",
    order: {
      id,
      order_number: manifest.order.orderNumber,
      payment_status: jobKind === "stock" ? "stock build" : "paid",
      payment_livemode: jobKind === "stock",
      fulfillment_method: jobKind === "stock" ? "inventory" : "shipping",
      fulfillment_status: "awaiting_operator",
      production_due_date: jobKind === "stock" ? null : "2026-10-12",
      production_option_name: "Standard production",
      store_order_items: items.map((i) => ({
        product_id: i.productId,
        product_name: i.productId.replaceAll("-", " "),
        quantity: i.quantity,
      })),
    },
  };
}
async function calibration(file) {
  const doc = await PDFDocument.create(),
    font = await doc.embedFont(StandardFonts.Helvetica);
  for (const side of ["EPSON FRONT", "CANON BACK"]) {
    const p = doc.addPage([612, 792]);
    p.drawText(`SEA REALM / ${side} ALIGNMENT`, {
      x: 38,
      y: 772,
      size: 11,
      font,
    });
    p.drawText(
      "Letter / Actual size / Simplex / Measure the 1-inch square before gluing",
      { x: 38, y: 16, size: 8, font },
    );
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 3; col++) {
        const x = (PRINT_LAYOUT.left + col * 720) * 0.24,
          y = 792 - (PRINT_LAYOUT.top + row * 1008 + 1008) * 0.24;
        p.drawRectangle({
          x,
          y,
          width: 720 * 0.24,
          height: 1008 * 0.24,
          borderColor: rgb(0, 0, 0),
          borderWidth: 0.5,
        });
        p.drawText(
          `${row + 1}:${side === "CANON BACK" ? 3 - col : col + 1} / ${side}`,
          {
            x: x + 10,
            y: y + 12,
            size: 9,
            font,
          },
        );
        if (row === 1 && col === 1) {
          p.drawRectangle({
            x: x + 50,
            y: y + 85,
            width: 72,
            height: 72,
            borderColor: rgb(0, 0, 0),
            borderWidth: 0.5,
          });
          p.drawText("1 inch square", { x: x + 53, y: y + 70, size: 8, font });
        }
      }
  }
  await writeFile(file, await doc.save(), { flush: true });
}
async function main() {
  let detail = await previewFixture({
    items: [{ productId: "deep-dive-pack", quantity: 5 }],
    inventoryPlan: [
      { productId: "deep-dive-pack", quantity: 5, fromStock: 3, toMake: 2 },
    ],
  });
  const jobs = new Map([[detail.order_id, detail]]),
    operations = new Set(),
    movements = [];
  const { storeProductDefinitions, storePreparedProductIds } =
    await import("../../src/data/store/products.js");
  const stock = storeProductDefinitions
    .filter((p) => storePreparedProductIds.includes(p.id))
    .map((p) => ({
      product_id: p.id,
      product_name: p.name,
      on_hand: p.id === "deep-dive-pack" ? 3 : 0,
      reserved: p.id === "deep-dive-pack" ? 3 : 0,
    }));
  function record(productId, hand, reserved, reason) {
    const s = stock.find((s) => s.product_id === productId);
    s.on_hand += hand;
    s.reserved += reserved;
    movements.unshift({
      id: crypto.randomUUID(),
      product_id: productId,
      on_hand_delta: hand,
      reserved_delta: reserved,
      reason,
      created_at: new Date().toISOString(),
    });
  }
  const dir = path.join(PRIVATE_ROOT, "preview");
  await mkdir(dir, { recursive: true });
  await renderTicket({
    manifest: detail.manifest,
    order: detail.order,
    siteOrigin: "https://searealm.com",
    file: path.join(dir, "work-ticket.pdf"),
  });
  await calibration(path.join(dir, "alignment-check.pdf"));
  await atomicJson(path.join(dir, "fixture.json"), detail);
  console.log(`Preview PDFs: ${dir}`);
  if (!process.argv.includes("--serve")) return;
  const upstream = "http://127.0.0.1:3127";
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1:3128");
      if (url.pathname === "/api/admin/manufacturing") {
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Cache-Control", "no-store");
        if (req.headers["x-admin-token"] !== "local-preview") {
          res.writeHead(401);
          res.end(
            JSON.stringify({
              error: "Use the local-preview token for this offline demo.",
            }),
          );
          return;
        }
        if (req.method === "POST") {
          let text = "";
          for await (const chunk of req) {
            text += chunk;
            if (text.length > 10000) throw new Error("Too large");
          }
          const payload = JSON.parse(text);
          if (payload.action === "adjust_stock") {
            const s = stock.find((s) => s.product_id === payload.productId);
            if (
              !s ||
              !Number.isSafeInteger(payload.quantity) ||
              !payload.quantity ||
              !payload.reason?.trim()
            )
              throw new Error("Enter a quantity change and reason");
            if (!operations.has(payload.id)) {
              if (s.on_hand + payload.quantity < s.reserved)
                throw new Error("Cannot remove reserved stock");
              record(s.product_id, payload.quantity, 0, payload.reason);
              operations.add(payload.id);
            }
            res.end(JSON.stringify({ recorded: true }));
            return;
          }
          if (payload.action === "build_stock") {
            if (!jobs.has(payload.id))
              jobs.set(
                payload.id,
                await previewFixture({
                  id: payload.id,
                  items: payload.items,
                  jobKind: "stock",
                }),
              );
            res.end(JSON.stringify(jobs.get(payload.id)));
            return;
          }
          detail = jobs.get(payload.orderId);
          if (!detail) throw new Error("Unknown preview job");
          detail.state = applyManufacturingEvent(
            detail.state,
            detail.manifest,
            normalizedEvent(payload.event, "operator"),
          );
          detail.revision = detail.state.revision;
          detail.phase = productionPhase(detail.state);
          if (payload.event.type === "packed" && !detail.previewReceived) {
            if (detail.job_kind === "stock") {
              for (const i of detail.manifest.order.items)
                record(
                  i.productId,
                  i.quantity,
                  0,
                  "Finished stock build received",
                );
              detail.inventory_posted_at = new Date().toISOString();
            } else
              for (const i of detail.manifest.inventoryPlan ?? [])
                if (i.fromStock)
                  record(
                    i.productId,
                    -i.fromStock,
                    -i.fromStock,
                    "Packed for example customer",
                  );
            detail.previewReceived = true;
          }
          res.end(JSON.stringify(detail));
          return;
        }
        res.end(
          JSON.stringify(
            url.searchParams.has("orderId")
              ? jobs.get(url.searchParams.get("orderId"))
              : {
                  enabled: false,
                  orders: [...jobs.values()].map((j) => ({
                    ...j,
                    store_orders: j.job_kind === "stock" ? null : j.order,
                  })),
                  stock: stock.map((s) => ({
                    ...s,
                    available: s.on_hand - s.reserved,
                    planned: [...jobs.values()]
                      .filter(
                        (j) => j.job_kind === "stock" && !j.inventory_posted_at,
                      )
                      .reduce(
                        (n, j) =>
                          n +
                          (j.manifest.order.items.find(
                            (i) => i.productId === s.product_id,
                          )?.quantity ?? 0),
                        0,
                      ),
                  })),
                  movements,
                },
          ),
        );
        return;
      }
      if (req.method !== "GET" || url.pathname.startsWith("/api/")) {
        res.writeHead(403);
        res.end("Preview only");
        return;
      }
      const response = await fetch(upstream + url.pathname + url.search, {
        redirect: "manual",
      });
      res.writeHead(
        response.status,
        Object.fromEntries(
          [...response.headers].filter(
            ([key]) =>
              ![
                "content-encoding",
                "content-length",
                "transfer-encoding",
              ].includes(key),
          ),
        ),
      );
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
  server.listen(3128, "127.0.0.1", () =>
    console.log(
      `Offline workshop demo: http://127.0.0.1:3128/admin/manufacturing?order=${orderId} (token: local-preview)`,
    ),
  );
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
