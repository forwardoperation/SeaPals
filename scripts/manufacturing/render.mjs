import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PNG } from "pngjs";
import { preflightPrintAssets } from "../../src/lib/manufacturing/printPlan.mjs";
import { sha256 } from "../../src/lib/manufacturing/integration.mjs";
import { validFixedSheetPositions } from "../../src/lib/manufacturing/sourceGeometry.mjs";

const POINT = 72 / 300,
  LETTER = [612, 792],
  CUTTER_LAYOUT = "figma-cutter-nine-up-v2";
const ink = rgb(0.06, 0.19, 0.25),
  muted = rgb(0.27, 0.36, 0.4);
const safeText = (value) =>
  String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "");
export function staffUrl(siteOrigin, orderId) {
  const base = new URL(siteOrigin);
  if (
    base.protocol !== "https:" &&
    !(
      base.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(base.hostname)
    )
  )
    throw new Error("The staff site must use HTTPS.");
  return new URL(
    `/admin/manufacturing?order=${encodeURIComponent(orderId)}`,
    base.origin,
  ).href;
}
export async function verifiedPng(file, asset) {
  const bytes = await readFile(file);
  if (sha256(bytes) !== asset.sha256)
    throw new Error(
      "Private artwork checksum does not match the pinned release.",
    );
  const png = PNG.sync.read(bytes, { checkCRC: true });
  if (png.width !== asset.width || png.height !== asset.height)
    throw new Error("Private artwork dimensions changed.");
  return bytes;
}
async function save(document, file) {
  await writeFile(file, await document.save(), { flush: true });
  return file;
}
export function backPositionForGlue(position, pageWidth = 2550) {
  // With top edges aligned and printed faces outward, turning the backing
  // sheet over a vertical edge reverses its column positions, not the artwork.
  return { ...position, x: pageWidth - position.x - position.width };
}
function drawCard(page, image, position) {
  page.drawImage(image, {
    x: position.x * POINT,
    y: LETTER[1] - (position.y + position.height) * POINT,
    width: position.width * POINT,
    height: position.height * POINT,
  });
}
function cropCard(original, position) {
  // Raster crops use the nearest exported pixel on each edge. Placement keeps
  // the exact Figma dimensions, including fractional pixel coordinates.
  const x = Math.round(position.x),
    y = Math.round(position.y),
    width = Math.round(position.x + position.width) - x,
    height = Math.round(position.y + position.height) - y;
  if (
    ![x, y, width, height].every(Number.isSafeInteger) ||
    x < 0 ||
    y < 0 ||
    width <= 0 ||
    height <= 0 ||
    x + width > original.width ||
    y + height > original.height
  )
    throw new Error("The saved card crop is outside its private artwork.");
  const crop = new PNG({ width, height });
  PNG.bitblt(original, crop, x, y, width, height, 0, 0);
  return PNG.sync.write(crop);
}
function cutterPositions(positions, name) {
  if (
    !Array.isArray(positions) ||
    positions.length !== 9 ||
    positions.some(
      (p) =>
        ![p.x, p.y, p.width, p.height].every(Number.isFinite) ||
        p.x < 0 ||
        p.y < 0 ||
        p.width <= 0 ||
        p.height <= 0 ||
        p.x + p.width > 2550 ||
        p.y + p.height > 3300,
    )
  )
    throw new Error(`The saved ${name} needs nine valid Letter card positions.`);
  return positions;
}
function marginLabel(page, font, text) {
  // Outside the nine-card rectangle, including on the scaled back template.
  page.drawRectangle({
    x: 35,
    y: 18,
    width: 542,
    height: 12,
    color: rgb(1, 1, 1),
  });
  page.drawText(safeText(text).slice(0, 120), {
    x: 38,
    y: 21,
    size: 6,
    font,
    color: muted,
  });
}
export async function renderJob({
  manifest,
  release,
  order = {},
  assetFiles,
  outputDir,
  siteOrigin,
}) {
  const check = preflightPrintAssets(manifest, release);
  if (!check.ready) throw new Error(check.errors.join("; "));
  await mkdir(outputDir, { recursive: true });
  const bytes = new Map();
  // Verify the entire order before preparing any printer submission.
  for (const id of check.requiredAssetIds)
    bytes.set(id, await verifiedPng(assetFiles[id], release.assets[id]));
  const jobs = [];
  const ticketFile = await renderTicket({
    manifest,
    order,
    siteOrigin,
    file: path.join(outputDir, "work-ticket.pdf"),
  });
  jobs.push({ sheetId: "work-ticket", side: "ticket", file: ticketFile });
  for (const sheet of manifest.sheets) {
    for (const side of ["fronts", "backs"]) {
      const doc = await PDFDocument.create(),
        page = doc.addPage(LETTER),
        font = await doc.embedFont(StandardFonts.Helvetica);
      if (manifest.layout.version === CUTTER_LAYOUT) {
        if (side === "fronts" && sheet.fronts.assetId) {
          const savedPositions = release.assets[sheet.fronts.assetId].positions;
          if (!validFixedSheetPositions(savedPositions, sheet.fronts.assetId))
            throw new Error("The saved fixed sheet needs valid source card positions.");
          const original = PNG.sync.read(bytes.get(sheet.fronts.assetId)),
            sourcePositions = savedPositions.toSorted((a, b) =>
              Math.abs(a.y - b.y) < 1 ? a.x - b.x : a.y - b.y,
            ),
            positions = cutterPositions(manifest.layout.positions, "front template");
          for (const [index, sourcePosition] of sourcePositions.entries()) {
            const image = await doc.embedPng(
              cropCard(original, sourcePosition),
            );
            drawCard(page, image, positions[index]);
          }
        } else if (side === "fronts") {
          const positions = cutterPositions(
            sheet.slots.map((slot) => ({
              ...slot,
              width: slot.width ?? manifest.layout.cardWidth,
              height: slot.height ?? manifest.layout.cardHeight,
            })),
            "booster front",
          );
          for (const position of positions) {
            const image = await doc.embedPng(bytes.get(position.printingId));
            drawCard(page, image, position);
          }
        } else {
          const original = PNG.sync.read(bytes.get(sheet.backs.assetId)),
            image = await doc.embedPng(
              cropCard(original, { x: 150, y: 75, width: 750, height: 1050 }),
            );
          for (const position of cutterPositions(
            sheet.backs.template.positions,
            "rear template",
          ))
            // The cutter's rear template already defines the correct offsets.
            // Do not apply the legacy 96% transform or mirror these positions.
            drawCard(page, image, position);
        }
      } else if (side === "fronts" && sheet.fronts.assetId) {
        const image = await doc.embedPng(bytes.get(sheet.fronts.assetId));
        page.drawImage(image, { x: 0, y: 0, width: 612, height: 792 });
      } else if (side === "fronts") {
        for (const slot of sheet.slots) {
          const image = await doc.embedPng(bytes.get(slot.printingId));
          page.drawImage(image, {
            x: slot.x * POINT,
            y: 792 - (slot.y + manifest.layout.cardHeight) * POINT,
            width: manifest.layout.cardWidth * POINT,
            height: manifest.layout.cardHeight * POINT,
          });
        }
      } else if (
        sheet.fronts.assetId &&
        release.assets[sheet.fronts.assetId].positions
      ) {
        // Fixed sheets (especially Conditions) may use slightly different gaps.
        // Crop the first identical laser back and impose it at the saved front positions.
        const original = PNG.sync.read(bytes.get(sheet.backs.assetId)),
          crop = new PNG({ width: 750, height: 1050 });
        PNG.bitblt(original, crop, 150, 75, 750, 1050, 0, 0);
        const image = await doc.embedPng(PNG.sync.write(crop));
        for (const frontPosition of release.assets[sheet.fronts.assetId]
          .positions) {
          const p = backPositionForGlue(frontPosition);
          page.drawImage(image, {
            x: p.x * POINT,
            y: 792 - (p.y + p.height) * POINT,
            width: p.width * POINT,
            height: p.height * POINT,
          });
        }
      } else {
        const image = await doc.embedPng(bytes.get(sheet.backs.assetId)),
          t = sheet.backs.template;
        page.drawImage(image, {
          x: t.translateX * POINT,
          y: 792 - (t.translateY + 3300 * t.contentScale) * POINT,
          width: 612 * t.contentScale,
          height: 792 * t.contentScale,
        });
      }
      if (manifest.layout.version !== CUTTER_LAYOUT)
        marginLabel(
          page,
          font,
          `${sheet.sheetId} / ${sheet.set ?? sheet.productId ?? ""} / ${side.toUpperCase()} / ${manifest.manifestHash.slice(0, 12)}`,
        );
      const file = path.join(outputDir, `${sheet.sheetId}-${side}.pdf`);
      await save(doc, file);
      jobs.push({ sheetId: sheet.sheetId, side, file });
    }
  }
  return jobs;
}
export async function renderTicket({ manifest, order, siteOrigin, file }) {
  const doc = await PDFDocument.create(),
    font = await doc.embedFont(StandardFonts.Helvetica),
    bold = await doc.embedFont(StandardFonts.HelveticaBold),
    cutterLayout = manifest.layout.version === CUTTER_LAYOUT;
  const url = staffUrl(siteOrigin, manifest.order.orderId);
  const qr = await doc.embedPng(
    await QRCode.toBuffer(url, {
      type: "png",
      errorCorrectionLevel: "M",
      margin: 4,
      width: 600,
    }),
  );
  let page, y;
  function newPage() {
    page = doc.addPage(LETTER);
    y = 722;
    page.drawText("SEA REALM / WORK ORDER", {
      x: 42,
      y: 750,
      size: 11,
      font: bold,
      color: ink,
    });
    const title = safeText(manifest.order.orderNumber),
      titleSize = Math.min(24, 350 / bold.widthOfTextAtSize(title, 1));
    page.drawText(title, {
      x: 42,
      y: 720,
      size: titleSize,
      font: bold,
      color: ink,
    });
    page.drawImage(qr, { x: 462, y: 663, width: 108, height: 108 });
    page.drawText("Scan for staff checklist", {
      x: 459,
      y: 654,
      size: 8,
      font,
      color: muted,
    });
    y = 683;
    marginLabel(
      page,
      font,
      `STAFF COPY | ${manifest.manifestHash.slice(0, 16)} | Page ${doc.getPageCount()} | Letter / Actual size`,
    );
  }
  function line(text, { heading = false, gap = 17 } = {}) {
    const max = 80,
      words = safeText(text).split(/\s+/);
    let current = "";
    const lines = [];
    for (const word of words) {
      if ((current + " " + word).length > max) {
        lines.push(current);
        current = word;
      } else current += (current ? " " : "") + word;
    }
    if (current) lines.push(current);
    for (const item of lines) {
      if (y < 54) newPage();
      page.drawText(item, {
        x: 42,
        y,
        size: heading ? 11 : 9,
        font: heading ? bold : font,
        color: heading ? ink : muted,
      });
      y -= gap;
    }
  }
  newPage();
  if (manifest.jobKind === "stock")
    line("STOCK BUILD - no customer order or buyer notifications", {
      heading: true,
    });
  line(`Due: ${order.production_due_date ?? "See order dashboard"}`);
  line(
    `${order.production_option_name ?? "Standard production"} / ${order.fulfillment_method ?? "Fulfillment per order"}`,
  );
  y = Math.min(y, 628);
  line("ORDER CONTENTS", { heading: true, gap: 23 });
  for (const item of manifest.order.items) {
    const name =
      order.store_order_items?.find((i) => i.product_id === item.productId)
        ?.product_name ?? item.productId;
    line(`${item.quantity} x ${name}`);
  }
  if (manifest.inventoryPlan) {
    y -= 10;
    line("FINISHED STOCK / BUILD SHORTFALL", { heading: true, gap: 23 });
    for (const item of manifest.inventoryPlan)
      line(
        `[ ] ${item.productId}: pick ${item.fromStock} from stock; make ${item.toMake}`,
      );
    line(
      "Keep each reserved finished product intact. Only the shortfall gets new card sheets.",
    );
  }
  if (cutterLayout && manifest.sheets.length) {
    y -= 10;
    line("PRINT SHEET ORDER", { heading: true, gap: 23 });
    for (const [index, sheet] of manifest.sheets.entries())
      line(
        `${index + 1}. ${sheet.sheetId} : ${sheet.set ? `${{ reef: "Reef", deep: "Deep", ocean: "Oceanic" }[sheet.set]} Dive Pack` : sheet.productId} / front + back`,
      );
    line(
      "Card pages have no printed job labels. Keep both printer stacks in this order and match each front with the corresponding back.",
    );
  } else if (manifest.packs.length) {
    y -= 10;
    line("PACK SHEET MAP", { heading: true, gap: 23 });
    for (const pack of manifest.packs)
      line(
        `${pack.packId} : ${{ reef: "Reef", deep: "Deep", ocean: "Oceanic" }[pack.set]} Dive Pack / 9 cards`,
      );
  }
  y -= 12;
  line("PRINT AND ASSEMBLY", { heading: true, gap: 23 });
  line(
    `${manifest.sheets.length} front sheet(s) on Epson + ${manifest.sheets.length} separate back sheet(s) on Canon.`,
  );
  line(
    cutterLayout
      ? "Use Actual size (100%). Follow the sheet order above, glue pairs, allow to dry, then cut."
      : "Match the sheet IDs, check alignment, glue pairs, allow to dry, then cut.",
  );
  line(
    "Confirm each physical print in the staff checklist. Printer acceptance alone is not confirmation.",
  );
  line(
    "Apply holo stickers at your preferred assembly stage; confirm every sticker before quality check.",
  );
  if (manifest.sheets.some((s) => s.productId))
    line(
      "Fixed deck frames include their Figma reference inserts. Check the 60-card deck contents separately.",
    );
  y -= 12;
  line(`HOLO STICKERS: ${manifest.holoChecklist.length}`, {
    heading: true,
    gap: 23,
  });
  for (const holo of manifest.holoChecklist)
    line(
      `[ ] ${holo.packId}: ${holo.name} (${holo.printingId}), row ${holo.row}, column ${holo.column}`,
    );
  if (!manifest.holoChecklist.length)
    line("No holo stickers required for these selected printings.");
  y -= 12;
  if (manifest.accessoryChecklist?.length) {
    line("PICK ACCESSORIES", { heading: true, gap: 23 });
    for (const item of manifest.accessoryChecklist)
      line(`[ ] ${item.quantity} total: ${item.name}`);
    y -= 12;
  }
  line("FINAL CHECK", { heading: true, gap: 23 });
  line("[ ] Correct sheets and contents  [ ] Glue dry and edges clean");
  line("[ ] Every holo sticker applied  [ ] Accessories included  [ ] Packed");
  line(
    manifest.jobKind === "stock"
      ? "Confirm quality check, then receive the completed batch into inventory in the staff checklist."
      : "Buyer updates are sent after confirmed milestones. The QR opens a staff sign-in page.",
  );
  y -= 12;
  line(`Artwork release: ${manifest.artworkRelease}`);
  line(
    `Booster policy: ${manifest.policy.commons} common / ${manifest.policy.uncommons} uncommon / 1 rare slot; ${manifest.policy.holoBasisPoints / 100}% holo.`,
  );
  return save(doc, file);
}
