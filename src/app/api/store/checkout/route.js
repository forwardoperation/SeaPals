import { NextResponse } from "next/server";
import { getStoreConfiguration } from "@/lib/store/catalog";
import { CartValidationError, quoteCart } from "@/lib/store/cart.mjs";
import {
  attachCheckoutSessionToOrder,
  createPendingStoreOrder,
  markStoreOrderCheckoutFailed,
} from "@/lib/store/orders";
import {
  createStripeCheckoutSession,
  StripeApiError,
} from "@/lib/store/stripe.mjs";

export const runtime = "nodejs";

function getSiteUrl(request) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const url = new URL(configured || request.url);
  const isLocalHttp =
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);

  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new Error("The store URL must use HTTPS.");
  }

  return url.origin;
}

function requestOriginIsAllowed(request, siteUrl) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(siteUrl).origin;
  } catch {
    return false;
  }
}

function json(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request) {
  let siteUrl;
  try {
    siteUrl = getSiteUrl(request);
  } catch {
    return json({ error: "The store URL is not configured correctly." }, 503);
  }

  if (!requestOriginIsAllowed(request, siteUrl)) {
    return json({ error: "This checkout request was not allowed." }, 403);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 20_000) {
    return json({ error: "That cart is too large." }, 413);
  }

  let rawPayload;
  try {
    rawPayload = await request.text();
  } catch {
    return json({ error: "Your cart could not be read." }, 400);
  }

  if (rawPayload.length > 20_000) {
    return json({ error: "That cart is too large." }, 413);
  }

  let payload;
  try {
    payload = JSON.parse(rawPayload);
  } catch {
    return json({ error: "Your cart could not be read." }, 400);
  }

  const configuration = getStoreConfiguration();
  if (!configuration.checkoutEnabled) {
    return json(
      {
        error:
          "Checkout is still in preview mode. Please check back when ordering opens.",
      },
      503
    );
  }

  let quote;
  try {
    quote = quoteCart(payload?.items, configuration.products, {
      shippingCents: configuration.shippingCents,
    });
  } catch (error) {
    if (error instanceof CartValidationError) {
      return json({ error: error.message, code: error.code }, 400);
    }
    throw error;
  }

  let order;
  try {
    order = await createPendingStoreOrder({
      quote,
      currency: configuration.currency,
    });

    const session = await createStripeCheckoutSession({
      order,
      quote,
      configuration,
      siteUrl,
    });

    if (!session?.id || !session?.url) {
      throw new StripeApiError("Stripe did not return a checkout link.");
    }

    try {
      await attachCheckoutSessionToOrder(order.id, session.id);
    } catch (error) {
      // The signed webhook also carries the internal order id and can reconcile
      // this field. Do not strand a valid customer checkout for a transient write.
      console.error("Store checkout reference write failed", error);
    }

    return json({ url: session.url, orderNumber: order.orderNumber });
  } catch (error) {
    if (order?.id) {
      await markStoreOrderCheckoutFailed(
        order.id,
        error?.code || "Checkout session creation failed."
      );
    }

    console.error("Store checkout failed", error);
    const status = error instanceof StripeApiError ? error.status : 503;
    return json(
      {
        error:
          status === 400
            ? "Checkout could not be prepared for that cart."
            : "Checkout is temporarily unavailable. Please try again shortly.",
      },
      status
    );
  }
}
