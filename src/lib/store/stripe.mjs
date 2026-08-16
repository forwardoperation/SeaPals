import {
  defaultStoreProductionOptionId,
  storeProductionOptionDefinitions,
} from "../../data/store/production.js";

const STRIPE_API_BASE = "https://api.stripe.com/v1";
const STRIPE_API_VERSION = "2026-07-29.dahlia";
const STRIPE_CHECKOUT_INTEGRATION_IDENTIFIER = "seapals_store_web_kvqzrmta";
const STRIPE_REQUEST_TIMEOUT_MS = 15_000;
const encoder = new TextEncoder();

export class StripeApiError extends Error {
  constructor(
    message,
    { status = 502, code = "stripe_error", outcomeUnknown = false } = {}
  ) {
    super(message);
    this.name = "StripeApiError";
    this.status = status;
    this.code = code;
    this.outcomeUnknown = outcomeUnknown;
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

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body?.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(STRIPE_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new StripeApiError("Stripe did not confirm the request outcome.", {
      status: 503,
      code: "stripe_outcome_unknown",
      outcomeUnknown: method !== "GET",
      cause: error,
    });
  }

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
        outcomeUnknown:
          method !== "GET" &&
          (response.status >= 500 || [409, 429].includes(response.status)),
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
  { automaticTaxEnabled, manualTaxRateId }
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
  if (manualTaxRateId) {
    form.set(`${prefix}[tax_rates][0]`, manualTaxRateId);
  }
}

function getCheckoutTaxConfiguration(configuration, fulfillmentOption) {
  if (fulfillmentOption?.fulfillmentMethod !== "pickup") {
    return {
      automaticTaxEnabled: Boolean(configuration.automaticTaxEnabled),
      manualTaxRateId: null,
    };
  }

  const pickupTaxRateId = String(
    configuration.pickupTaxRateId ?? ""
  ).trim();
  if (
    configuration.pickupTaxConfirmed !== true ||
    !/^txr_[A-Za-z0-9_]+$/.test(pickupTaxRateId)
  ) {
    throw new StripeApiError(
      "Scheduled pickup tax sourcing is not configured.",
      {
        status: 503,
        code: "pickup_tax_not_configured",
      }
    );
  }

  // Pickup is performed in Elverson, so it uses an owner-confirmed fixed,
  // exclusive PA Tax Rate instead of customer-address-based automatic tax.
  return {
    automaticTaxEnabled: false,
    manualTaxRateId: pickupTaxRateId,
  };
}

function getQuotedProductionOption(quote) {
  const optionId = String(
    quote?.productionOptionId ??
      quote?.productionOption?.id ??
      defaultStoreProductionOptionId
  )
    .trim()
    .toLowerCase();
  const definition = storeProductionOptionDefinitions.find(
    (option) => option.id === optionId
  );

  if (!definition) {
    throw new StripeApiError("The production option is not valid.", {
      status: 503,
      code: "production_option_invalid",
    });
  }

  const productionCents = Number(
    quote?.productionCents ??
      quote?.productionOption?.amountCents ??
      definition.amountCents
  );
  const maxBusinessDays = Number(
    quote?.productionMaxBusinessDays ??
      quote?.productionOption?.maxBusinessDays ??
      definition.maxBusinessDays
  );
  const displayName = String(
    quote?.productionOptionName ??
      quote?.productionOption?.displayName ??
      definition.displayName
  ).trim();

  if (
    productionCents !== definition.amountCents ||
    maxBusinessDays !== definition.maxBusinessDays ||
    displayName !== definition.displayName
  ) {
    throw new StripeApiError("The production option is not valid.", {
      status: 503,
      code: "production_option_invalid",
    });
  }

  return definition;
}

function appendProductionLineItem(
  form,
  productionOption,
  index,
  currency,
  configuration,
  fulfillmentOption,
  taxConfiguration
) {
  if (!productionOption.expedited) return;

  const prefix = `line_items[${index}]`;
  form.set(`${prefix}[quantity]`, "1");
  form.set(`${prefix}[price_data][currency]`, currency);
  form.set(
    `${prefix}[price_data][unit_amount]`,
    String(productionOption.amountCents)
  );
  form.set(
    `${prefix}[price_data][product_data][name]`,
    "Expedited production"
  );
  form.set(
    `${prefix}[price_data][product_data][description]`,
    fulfillmentOption?.fulfillmentMethod === "pickup"
      ? "Build and mark ready for pickup within 1 business day."
      : "Build and dispatch within 1 business day; carrier transit time not included."
  );
  form.set(
    `${prefix}[price_data][product_data][metadata][production_option_id]`,
    productionOption.id
  );

  if (taxConfiguration.manualTaxRateId) {
    form.set(`${prefix}[tax_rates][0]`, taxConfiguration.manualTaxRateId);
  } else if (taxConfiguration.automaticTaxEnabled) {
    const configuredTaxCode = String(
      configuration.productionTaxCode ??
        process.env[productionOption.taxCodeEnvKey] ??
        productionOption.defaultTaxCode ??
        ""
    ).trim();
    if (!/^txcd_[0-9]+$/.test(configuredTaxCode)) {
      throw new StripeApiError(
        "A validated production tax code is required when automatic tax is enabled.",
        {
          status: 503,
          code: "production_tax_code_required",
        }
      );
    }
    form.set(
      `${prefix}[price_data][product_data][tax_code]`,
      configuredTaxCode
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

function appendShippingEstimate(form, shippingOption, productionOption) {
  if (
    shippingOption.fulfillmentMethod !== "shipping" ||
    !shippingOption.deliveryEstimateMinDays ||
    !shippingOption.deliveryEstimateMaxDays ||
    !Number.isSafeInteger(productionOption?.maxBusinessDays) ||
    productionOption.maxBusinessDays < 1
  ) {
    return;
  }

  const minimumBusinessDays =
    productionOption.maxBusinessDays + shippingOption.deliveryEstimateMinDays;
  const maximumBusinessDays =
    productionOption.maxBusinessDays + shippingOption.deliveryEstimateMaxDays;
  const prefix = "shipping_options[0][shipping_rate_data][delivery_estimate]";
  form.set(`${prefix}[minimum][unit]`, "business_day");
  form.set(
    `${prefix}[minimum][value]`,
    String(minimumBusinessDays)
  );
  form.set(`${prefix}[maximum][unit]`, "business_day");
  form.set(
    `${prefix}[maximum][value]`,
    String(maximumBusinessDays)
  );
}

export function assertStripeCheckoutConfiguration(configuration) {
  if (configuration?.allowPromotionCodes === true) {
    throw new StripeApiError(
      "Promotion codes are disabled until discounted Stripe totals can be reconciled with the order ledger.",
      {
        status: 503,
        code: "promotion_codes_not_supported",
      }
    );
  }
}

function getStripeCheckoutExpiration(order, nowMilliseconds = Date.now()) {
  const expirationMilliseconds = Date.parse(
    order?.inventoryReservationExpiresAt ?? ""
  );
  const remainingMilliseconds = expirationMilliseconds - nowMilliseconds;

  if (
    !Number.isFinite(expirationMilliseconds) ||
    remainingMilliseconds < 30 * 60 * 1000 ||
    remainingMilliseconds > 24 * 60 * 60 * 1000
  ) {
    throw new StripeApiError(
      "The inventory reservation deadline is not valid for Stripe Checkout.",
      {
        status: 503,
        code: "inventory_reservation_deadline_invalid",
      }
    );
  }

  return Math.floor(expirationMilliseconds / 1000);
}

export async function createStripeCheckoutSession({
  order,
  quote,
  configuration,
  siteUrl,
}) {
  assertStripeCheckoutConfiguration(configuration);

  const form = new URLSearchParams();
  const currency = String(configuration.currency || "usd").toLowerCase();
  const checkoutExpiration = getStripeCheckoutExpiration(order);
  const productionOption = getQuotedProductionOption(quote);
  const fulfillmentOption = quote.fulfillmentOption ?? {
    id: "standard",
    displayName: "Standard Shipping & Handling",
    fulfillmentMethod: "shipping",
    pickupLocation: null,
    amountCents: quote.shippingCents,
    deliveryEstimateMinDays: configuration.shippingEstimateMinDays ?? null,
    deliveryEstimateMaxDays: configuration.shippingEstimateMaxDays ?? null,
  };
  const taxConfiguration = getCheckoutTaxConfiguration(
    configuration,
    fulfillmentOption
  );

  form.set("mode", "payment");
  form.set("expires_at", String(checkoutExpiration));
  form.set(
    "integration_identifier",
    STRIPE_CHECKOUT_INTEGRATION_IDENTIFIER
  );
  form.set("client_reference_id", order.id);
  form.set("success_url", `${siteUrl}/store/success?session_id={CHECKOUT_SESSION_ID}`);
  form.set("cancel_url", `${siteUrl}/store/cancel`);
  form.set("customer_creation", "always");
  form.set("billing_address_collection", "auto");
  form.set(
    "automatic_tax[enabled]",
    String(taxConfiguration.automaticTaxEnabled)
  );
  form.set("allow_promotion_codes", String(configuration.allowPromotionCodes));
  form.set("phone_number_collection[enabled]", String(configuration.collectPhone));
  form.set("invoice_creation[enabled]", "false");
  // Launch inventory holds assume synchronous payment methods. Configure a
  // dedicated Stripe payment-method configuration that excludes delayed
  // methods before enabling checkout.
  if (!/^pmc_[A-Za-z0-9_]+$/.test(String(configuration.paymentMethodConfiguration ?? ""))) {
    throw new StripeApiError(
      "A synchronous Stripe payment-method configuration is required for inventory reservations.",
      {
        status: 503,
        code: "payment_method_configuration_required",
      }
    );
  }
  form.set(
    "payment_method_configuration",
    configuration.paymentMethodConfiguration
  );
  form.set("metadata[order_id]", order.id);
  form.set("metadata[order_number]", order.orderNumber);
  form.set("metadata[inventory_reservation]", "v1");
  form.set("metadata[production_option_id]", productionOption.id);
  form.set("metadata[production_option_name]", productionOption.displayName);
  form.set(
    "metadata[production_max_business_days]",
    String(productionOption.maxBusinessDays)
  );
  form.set("metadata[production_cents]", String(productionOption.amountCents));
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
  form.set("payment_intent_data[metadata][inventory_reservation]", "v1");
  form.set(
    "payment_intent_data[metadata][production_option_id]",
    productionOption.id
  );
  form.set(
    "payment_intent_data[metadata][production_option_name]",
    productionOption.displayName
  );
  form.set(
    "payment_intent_data[metadata][production_max_business_days]",
    String(productionOption.maxBusinessDays)
  );
  form.set(
    "payment_intent_data[metadata][production_cents]",
    String(productionOption.amountCents)
  );
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
      `Scheduled pickup in ${fulfillmentOption.pickupLocation} is free. We will email after your order is built to arrange a pickup time.`
    );
  }

  quote.items.forEach((item, index) =>
    appendCheckoutLineItem(form, item, index, currency, taxConfiguration)
  );
  appendProductionLineItem(
    form,
    productionOption,
    quote.items.length,
    currency,
    configuration,
    fulfillmentOption,
    taxConfiguration
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
  appendShippingEstimate(form, fulfillmentOption, productionOption);

  const session = await stripeRequest("/checkout/sessions", {
    method: "POST",
    body: form,
    idempotencyKey: `seapals-checkout-${order.id}`,
  });

  if (
    typeof session?.id !== "string" ||
    !/^cs_[A-Za-z0-9_]+$/.test(session.id) ||
    typeof session?.url !== "string"
  ) {
    throw new StripeApiError(
      "Stripe did not return a valid checkout reference.",
      {
        status: 503,
        code: "stripe_outcome_unknown",
        outcomeUnknown: true,
      }
    );
  }

  return session;
}

export async function retrieveStripeCheckoutSession(
  sessionId,
  { secretKey } = {}
) {
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
    secretKey,
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

function stripeMetadataText(metadata, key) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 200)
    : null;
}

export async function retrieveStripePaymentOwnership({
  chargeId,
  paymentIntentId,
}) {
  let resolvedChargeId = /^ch_[A-Za-z0-9_]+$/.test(String(chargeId ?? ""))
    ? chargeId
    : null;
  let resolvedPaymentIntentId =
    /^pi_[A-Za-z0-9_]+$/.test(String(paymentIntentId ?? ""))
      ? paymentIntentId
      : null;
  let chargeMetadata = null;
  let paymentIntentMetadata = null;

  if (resolvedChargeId) {
    const charge = await stripeRequest(
      `/charges/${encodeURIComponent(resolvedChargeId)}`
    );
    if (charge?.id !== resolvedChargeId) {
      throw new StripeApiError("Stripe returned an invalid Charge reference.");
    }

    chargeMetadata = charge.metadata;
    const chargePaymentIntentId =
      typeof charge.payment_intent === "object"
        ? charge.payment_intent?.id
        : charge.payment_intent;
    if (/^pi_[A-Za-z0-9_]+$/.test(String(chargePaymentIntentId ?? ""))) {
      resolvedPaymentIntentId = chargePaymentIntentId;
    }
  }

  if (
    resolvedPaymentIntentId &&
    !stripeMetadataText(chargeMetadata, "order_id")
  ) {
    const paymentIntent = await stripeRequest(
      `/payment_intents/${encodeURIComponent(resolvedPaymentIntentId)}`
    );
    if (paymentIntent?.id !== resolvedPaymentIntentId) {
      throw new StripeApiError(
        "Stripe returned an invalid Payment Intent reference."
      );
    }
    paymentIntentMetadata = paymentIntent.metadata;
  }

  return {
    chargeId: resolvedChargeId,
    paymentIntentId: resolvedPaymentIntentId,
    orderId:
      stripeMetadataText(chargeMetadata, "order_id") ??
      stripeMetadataText(paymentIntentMetadata, "order_id"),
    orderNumber:
      stripeMetadataText(chargeMetadata, "order_number") ??
      stripeMetadataText(paymentIntentMetadata, "order_number"),
  };
}

export async function expireStripeCheckoutSession(
  sessionId,
  { secretKey, idempotencyKey } = {}
) {
  if (!/^cs_[A-Za-z0-9_]+$/.test(String(sessionId ?? ""))) return null;

  return stripeRequest(
    `/checkout/sessions/${encodeURIComponent(sessionId)}/expire`,
    {
      method: "POST",
      body: new URLSearchParams(),
      idempotencyKey,
      secretKey,
    }
  );
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
