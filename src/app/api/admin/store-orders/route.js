import { NextResponse } from "next/server";
import {
  listStoreOrders,
  updateStoreOrderFulfillment,
} from "@/lib/store/orders";
import { isStoreFulfillmentStatus } from "@/lib/store/fulfillmentStatus.mjs";

export const runtime = "nodejs";

function constantTimeTokenEqual(first, second) {
  const a = String(first ?? "");
  const b = String(second ?? "");
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return difference === 0;
}
function isAuthorized(request) {
  const configuredToken = process.env.STORE_ADMIN_TOKEN?.trim();
  const providedToken = request.headers.get("x-admin-token")?.trim();
  return Boolean(
    configuredToken &&
      providedToken &&
      constantTimeTokenEqual(configuredToken, providedToken)
  );
}

function cleanText(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function cleanTrackingUrl(value) {
  const text = cleanText(value, 1000);
  if (!text) return "";

  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function json(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function GET(request) {
  if (!isAuthorized(request)) {
    return json({ error: "Unauthorized." }, 401);
  }

  try {
    const orders = await listStoreOrders();
    return json({ orders });
  } catch (error) {
    console.error("Admin order load failed", error);
    return json({ error: "Orders could not be loaded." }, 500);
  }
}

export async function PATCH(request) {
  if (!isAuthorized(request)) {
    return json({ error: "Unauthorized." }, 401);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid fulfillment update." }, 400);
  }

  const id = cleanText(payload?.id, 80);
  const fulfillmentStatus = cleanText(payload?.fulfillmentStatus, 40);
  const trackingNumber = cleanText(payload?.trackingNumber, 200);
  const trackingUrl = cleanTrackingUrl(payload?.trackingUrl);
  const internalNotes = cleanText(payload?.internalNotes, 2000);

  if (
    !/^[0-9a-f-]{36}$/i.test(id) ||
    !isStoreFulfillmentStatus(fulfillmentStatus) ||
    trackingUrl === null
  ) {
    return json({ error: "Invalid fulfillment update." }, 400);
  }

  try {
    const order = await updateStoreOrderFulfillment({
      id,
      fulfillmentStatus,
      trackingNumber,
      trackingUrl,
      internalNotes,
    });
    return json({ saved: true, order });
  } catch (error) {
    console.error("Admin fulfillment update failed", error);
    return json({ error: "The fulfillment update could not be saved." }, 500);
  }
}
