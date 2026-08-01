const STRIPE_API_BASE = "https://api.stripe.com/v1";
const STRIPE_API_VERSION = "2026-07-29.dahlia";
const STRIPE_CHECKOUT_INTEGRATION_IDENTIFIER = "seapals_store_web_kvqzrmta";
const STRIPE_REQUEST_TIMEOUT_MS = 15_000;
const encoder = new TextEncoder();

export class StripeApiError extends Error {
  constructor(message, { status = 502, code = "stripe_error" } = {}) {
    super(message);
    this.name = "StripeApiError";
    this.status = status;
    this.code = code;
  }
}

function getStripeSecretKey(secretKey) {
  const key = secretKey || process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new StripeApiError("Stripe is not configured.", {
      status: 503,
      code: "stripe_not_configured",
    });
  }
  return key;
}

async function stripeRequest(
  path,
  { method = "GET", body, query, idempotencyKey, secretKey } = {}
) {
  const key = getStripeSecretKey(secretKey);
  const url = new URL(`${STRIPE_API_BASE}${path}`);

  if (query) {
    for (const [name, value] of query.entries()) {
      url.searchParams.append(name, value);
    }
  }

  const headers = {
    Authorization: `Bearer ${key}`,
    "Stripe-Version": STRIPE_API_VERSION,
  };

  if (body) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body?.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(STRIPE_REQUEST_TIMEOUT_MS),
  });

  let payload;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new StripeApiError(
      payload?.error?.message || "Stripe could not prepare checkout.",
      {
        status: response.status >= 500 ? 502 : 400,
        code: payload?.error?.code || "stripe_request_failed",
      }
    );
  }

  return payload;
}

function appendCheckoutLineItem(
  form,
  item,
  index,
  currency,
  { automaticTaxEnabled }
) {
  const prefix = `line_items[${index}]`;
  form.set(`${prefix}[quantity]`, String(item.quantity));
  form.set(`${prefix}[price_data][currency]`, currency);
  form.set(
    `${prefix}[price_data][unit_amount]`,
    String(item.unitAmountCents)
  );
  form.set(
    `${prefix}[price_data][product_data][name]`,
    `SeaPals — ${item.name}`
  );
  form.set(
    `${prefix}[price_data][product_data][description]`,
    item.checkoutDescription || item.description
  );
  form.set(
    `${prefix}[price_data][product_data][metadata][product_id]`,
    item.productId
  );
  form.set(`${prefix}[price_data][product_data][metadata][sku]`, item.sku);
  if (item.category) {
    form.set(
      `${prefix}[price_data][product_data][metadata][category]`,
      item.category
    );
  }

  if (automaticTaxEnabled && item.taxCode) {
    form.set(
      `${prefix}[price_data][product_data][tax_code]`,
      item.taxCode
    );
    form.set(`${prefix}[price_data][tax_behavior]`, "exclusive");
  }
}

function appendShippingOption(
  form,
  shippingOption,
  currency,
  { automaticTaxEnabled, shippingTaxCode }
) {
  if (shippingOption.fulfillmentMethod !== "shipping") return;

  const prefix = "shipping_options[0][shipping_rate_data]";
  form.set(`${prefix}[type]`, "fixed_amount");
  form.set(`${prefix}[display_name]`, shippingOption.displayName);
  form.set(
    `${prefix}[metadata][fulfillment_option_id]`,
    shippingOption.id
  );
  form.set(`${prefix}[metadata][fulfillment_method]`, "shipping");
  form.set(
    `${prefix}[fixed_amount][amount]`,
    String(shippingOption.amountCents)
  );
  form.set(`${prefix}[fixed_amount][currency]`, currency);
  if (automaticTaxEnabled) {
    if (!/^txcd_[0-9]+$/.test(String(shippingTaxCode ?? ""))) {
      throw new StripeApiError(
        "A validated shipping tax code is required when automatic tax is enabled."
      );
    }
    form.set(`${prefix}[tax_behavior]`, "exclusive");
    form.set(`${prefix}[tax_code]`, shippingTaxCode);
  }
}

function appendShippingEstimate(form, shippingOption) {
  if (
    shippingOption.fulfillmentMethod !== "shipping" ||
    !shippingOption.deliveryEstimateMinDays ||
    !shippingOption.deliveryEstimateMaxDays
  ) {
    return;
  }

  const prefix = "shipping_options[0][shipping_rate_data][delivery_estimate]";
  form.set(`${prefix}[minimum][unit]`, "business_day");
  form.set(
    `${prefix}[minimum][value]`,
    String(shippingOption.deliveryEstimateMinDays)
  );
  form.set(`${prefix}[maximum][unit]`, "business_day");
  form.set(
    `${prefix}[maximum][value]`,
    String(shippingOption.deliveryEstimateMaxDays)
  );
}

export async function createStripeCheckoutSession({
  order,
  quote,
  configuration,
  siteUrl,
}) {
  const form = new URLSearchParams();
  const currency = String(configuration.currency || "usd").toLowerCase();
  const fulfillmentOption = quote.fulfillmentOption ?? {
    id: "standard",
    displayName: "Standard Shipping & Handling",
    fulfillmentMethod: "shipping",
    pickupLocation: null,
    amountCents: quote.shippingCents,
    deliveryEstimateMinDays: configuration.shippingEstimateMinDays ?? null,
    deliveryEstimateMaxDays: configuration.shippingEstimateMaxDays ?? null,
  };

  form.set("mode", "payment");
  form.set(
    "integration_identifier",
    STRIPE_CHECKOUT_INTEGRATION_IDENTIFIER
  );
  form.set("client_reference_id", order.id);
  form.set("success_url", `${siteUrl}/store/success?session_id={CHECKOUT_SESSION_ID}`);
  form.set("cancel_url", `${siteUrl}/store/cancel`);
  form.set("customer_creation", "always");
  form.set("billing_address_collection", "auto");
  form.set("automatic_tax[enabled]", String(configuration.automaticTaxEnabled));
  form.set("allow_promotion_codes", String(configuration.allowPromotionCodes));
  form.set("phone_number_collection[enabled]", String(configuration.collectPhone));
  form.set("invoice_creation[enabled]", "false");
  form.set("metadata[order_id]", order.id);
  form.set("metadata[order_number]", order.orderNumber);
  form.set("metadata[fulfillment_option_id]", fulfillmentOption.id);
  form.set(
    "metadata[fulfillment_option_name]",
    fulfillmentOption.displayName
  );
  form.set(
    "metadata[fulfillment_method]",
    fulfillmentOption.fulfillmentMethod
  );
  form.set("payment_intent_data[metadata][order_id]", order.id);
  form.set("payment_intent_data[metadata][order_number]", order.orderNumber);
  form.set(
    "payment_intent_data[metadata][fulfillment_option_id]",
    fulfillmentOption.id
  );
  form.set(
    "payment_intent_data[metadata][fulfillment_option_name]",
    fulfillmentOption.displayName
  );
  form.set(
    "payment_intent_data[metadata][fulfillment_method]",
    fulfillmentOption.fulfillmentMethod
  );
  form.set("payment_intent_data[description]", `SeaPals order ${order.orderNumber}`);
  if (fulfillmentOption.pickupLocation) {
    form.set("metadata[pickup_location]", fulfillmentOption.pickupLocation);
    form.set(
      "payment_intent_data[metadata][pickup_location]",
      fulfillmentOption.pickupLocation
    );
    form.set(
      "custom_text[submit][message]",
      `Local pickup in ${fulfillmentOption.pickupLocation}. We will email when your order is ready.`
    );
  }

  quote.items.forEach((item, index) =>
    appendCheckoutLineItem(form, item, index, currency, configuration)
  );

  if (fulfillmentOption.fulfillmentMethod === "shipping") {
    configuration.allowedCountries.forEach((country, index) => {
      form.set(
        `shipping_address_collection[allowed_countries][${index}]`,
        country
      );
    });
  }
  appendShippingOption(form, fulfillmentOption, currency, configuration);
  appendShippingEstimate(form, fulfillmentOption);

  return stripeRequest("/checkout/sessions", {
    method: "POST",
    body: form,
    idempotencyKey: `seapals-checkout-${order.id}`,
  });
}

export async function retrieveStripeCheckoutSession(sessionId) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(String(sessionId ?? ""))) {
    throw new StripeApiError("That checkout reference is invalid.", {
      status: 400,
      code: "invalid_session_id",
    });
  }

  const query = new URLSearchParams();
  query.append("expand[]", "payment_intent.latest_charge");

  return stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    query,
  });
}

export async function retrieveStripePaymentReceiptDetails(paymentIntentId) {
  if (!/^pi_[A-Za-z0-9_]+$/.test(String(paymentIntentId ?? ""))) {
    return null;
  }

  const query = new URLSearchParams();
  query.append("expand[]", "latest_charge");

  const paymentIntent = await stripeRequest(
    `/payment_intents/${encodeURIComponent(paymentIntentId)}`,
    { query }
  );

  const charge = paymentIntent?.latest_charge;
  if (!charge || typeof charge !== "object") return null;

  return {
    chargeId:
      typeof charge.id === "string" && charge.id.startsWith("ch_")
        ? charge.id
        : null,
    receiptNumber:
      typeof charge.receipt_number === "string"
        ? charge.receipt_number.slice(0, 100)
        : null,
    receiptUrl:
      typeof charge.receipt_url === "string" ? charge.receipt_url : null,
  };
}

export async function retrieveStripePaymentReceipt(paymentIntentId) {
  const details = await retrieveStripePaymentReceiptDetails(paymentIntentId);
  return details?.receiptUrl ?? null;
}

export async function expireStripeCheckoutSession(sessionId) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(String(sessionId ?? ""))) return null;

  try {
    return await stripeRequest(
      `/checkout/sessions/${encodeURIComponent(sessionId)}/expire`,
      { method: "POST", body: new URLSearchParams() }
    );
  } catch {
    return null;
  }
}

export function parseStripeSignatureHeader(header) {
  const values = new Map();

  for (const part of String(header ?? "").split(",")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex < 1) continue;

    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (!key || !value) continue;

    const existing = values.get(key) ?? [];
    existing.push(value);
    values.set(key, existing);
  }

  return {
    timestamp: Number(values.get("t")?.[0]),
    signatures: values.get("v1") ?? [],
  };
}

function bytesToHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(first, second) {
  const a = String(first);
  const b = String(second);
  if (a.length !== b.length) return false;

  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

export async function computeStripeWebhookSignature(payload, timestamp, secret) {
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await globalThis.crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${payload}`)
  );
  return bytesToHex(signature);
}

export async function verifyStripeWebhookSignature(
  payload,
  header,
  secret,
  { toleranceSeconds = 300, nowMilliseconds = Date.now() } = {}
) {
  if (!payload || !header || !secret) return false;

  const { timestamp, signatures } = parseStripeSignatureHeader(header);
  if (!Number.isFinite(timestamp) || !signatures.length) return false;

  const ageSeconds = Math.abs(Math.floor(nowMilliseconds / 1000) - timestamp);
  if (toleranceSeconds > 0 && ageSeconds > toleranceSeconds) return false;

  const expected = await computeStripeWebhookSignature(
    payload,
    timestamp,
    secret
  );
  return signatures.some((signature) => constantTimeEqual(signature, expected));
}
