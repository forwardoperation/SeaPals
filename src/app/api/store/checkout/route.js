import { NextResponse } from "next/server";
import {
  defaultStoreProductionOptionId,
  storeProductionOptionDefinitions,
} from "@/data/store/production";
import { getStoreConfiguration } from "@/lib/store/catalog";
import { CartValidationError, quoteCart } from "@/lib/store/cart.mjs";
import { normalizeCheckoutRequestId } from "@/lib/store/checkoutRequest.mjs";
import {
  getStoreSiteUrl,
  requestOriginIsAllowed,
} from "@/lib/store/checkoutOrigin.mjs";
import {
  attachCheckoutSessionToOrder,
  createPendingStoreOrder,
  markStoreOrderCheckoutFailed,
  OrderStoreError,
} from "@/lib/store/orders";
import {
  assertStripeCheckoutConfiguration,
  createStripeCheckoutSession,
  expireStripeCheckoutSession,
  StripeApiError,
} from "@/lib/store/stripe.mjs";

export const runtime = "nodejs";

function json(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request) {
  let siteUrl;
  try {
    siteUrl = getStoreSiteUrl(request);
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

  try {
    assertStripeCheckoutConfiguration(configuration);
  } catch (error) {
    console.error("Store checkout configuration blocked", error);
    return json(
      { error: "Checkout is temporarily unavailable. Please try again shortly." },
      503
    );
  }

  let quote;
  const checkoutRequestId = normalizeCheckoutRequestId(
    payload?.checkoutRequestId
  );
  if (!checkoutRequestId) {
    return json(
      {
        error: "Checkout could not be prepared for that cart.",
        code: "invalid_checkout_request_id",
      },
      400
    );
  }

  try {
    const configuredProductionOptions = Array.isArray(
      configuration.productionOptions
    )
      ? configuration.productionOptions
      : storeProductionOptionDefinitions;
    const requestedProductionOptionId = String(
      payload?.productionOptionId ??
        configuration.defaultProductionOptionId ??
        defaultStoreProductionOptionId
    )
      .trim()
      .toLowerCase();
    const productionOption = configuredProductionOptions.find(
      (option) => option.id === requestedProductionOptionId
    );
    if (!productionOption) {
      throw new CartValidationError(
        "Choose an available production option.",
        "invalid_production_option"
      );
    }

    const requestedFulfillmentOptionId = String(
      payload?.fulfillmentOptionId ??
        configuration.defaultShippingOptionId ??
        ""
    )
      .trim()
      .toLowerCase();
    const fulfillmentOption = configuration.shippingOptions.find(
      (option) => option.id === requestedFulfillmentOptionId
    );
    if (!fulfillmentOption) {
      throw new CartValidationError(
        "Choose an available shipping or pickup option.",
        "invalid_shipping_option"
      );
    }

    quote = quoteCart(payload?.items, configuration.products, {
      fulfillmentOption,
      productionOption,
    });
  } catch (error) {
    if (error instanceof CartValidationError) {
      return json({ error: error.message, code: error.code }, 400);
    }
    throw error;
  }

  let order;
  let session;
  let stripeCreateAttempted = false;
  try {
    order = await createPendingStoreOrder({
      quote,
      currency: configuration.currency,
      paymentLivemode: configuration.paymentMode === "live",
      checkoutRequestId,
    });

    if (order.checkoutUrl) {
      return json({ url: order.checkoutUrl, orderNumber: order.orderNumber });
    }

    stripeCreateAttempted = true;
    session = await createStripeCheckoutSession({
      order,
      quote,
      configuration,
      siteUrl,
    });

    if (!session?.id || !session?.url) {
      throw new StripeApiError("Stripe did not return a checkout link.");
    }

    await attachCheckoutSessionToOrder(order.id, session);

    return json({ url: session.url, orderNumber: order.orderNumber });
  } catch (error) {
    let inventoryReleaseFailed = false;
    let sessionTerminal =
      !stripeCreateAttempted ||
      (error instanceof StripeApiError && error.outcomeUnknown === false);
    if (session?.id) {
      try {
        const expiredSession = await expireStripeCheckoutSession(session.id);
        sessionTerminal = expiredSession?.status === "expired";
      } catch (expirationError) {
        console.error("Store checkout session expiration failed", expirationError);
      }
    }

    // Never release stock while a known Stripe Session might still accept
    // payment. A signed terminal webhook or an operator reconciliation must
    // release that hold instead.
    if (order?.id && sessionTerminal) {
      try {
        await markStoreOrderCheckoutFailed(
          order.id,
          session?.id
            ? "Stripe session expired after attach failure"
            : "Checkout session creation failed"
        );
      } catch (releaseError) {
        inventoryReleaseFailed = true;
        console.error("Store checkout inventory release failed", releaseError);
      }
    }

    console.error("Store checkout failed", error);
    const status = inventoryReleaseFailed
      ? 503
      : error instanceof StripeApiError || error instanceof OrderStoreError
        ? error.status
        : 503;
    return json(
      {
        error:
          error instanceof OrderStoreError &&
          error.code === "inventory_unavailable"
            ? "One or more items just sold out. Please update your cart and try again."
            : error instanceof OrderStoreError &&
                error.code === "expedited_capacity_unavailable"
              ? "Expedited production is full for the next business day. Choose Standard production or try again."
            : status === 400
            ? "Checkout could not be prepared for that cart."
            : "Checkout is temporarily unavailable. Please try again shortly.",
        ...(error instanceof OrderStoreError &&
        ["inventory_unavailable", "expedited_capacity_unavailable"].includes(
          error.code
        )
          ? { code: error.code }
          : status >= 500 && order?.id && !sessionTerminal
            ? { code: "retry_same_request" }
            : {}),
      },
      status
    );
  }
}
