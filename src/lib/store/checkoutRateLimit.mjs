export const STORE_CHECKOUT_PATH = "/api/store/checkout";

const JSON_HEADERS = Object.freeze({
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
});

function jsonError(status, error, extraHeaders = {}) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function isCheckoutPost(request) {
  if (request?.method !== "POST") return false;
  try {
    return new URL(request.url).pathname === STORE_CHECKOUT_PATH;
  } catch {
    return false;
  }
}

async function checkoutActorKey(request) {
  const address = request.headers.get("CF-Connecting-IP")?.trim() || "unknown";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(address)
  );
  const hexadecimal = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  return `checkout:${hexadecimal}`;
}

/**
 * Returns a blocking response for a rejected checkout attempt, or null when
 * the request should continue to the OpenNext application.
 */
export async function enforceStoreCheckoutRateLimit({ request, environment }) {
  if (!isCheckoutPost(request)) return null;

  const limiter = environment?.STORE_CHECKOUT_RATE_LIMITER;
  if (!limiter || typeof limiter.limit !== "function") {
    return jsonError(
      503,
      "Checkout is temporarily unavailable. Please try again shortly."
    );
  }

  try {
    const outcome = await limiter.limit({ key: await checkoutActorKey(request) });
    if (outcome?.success === true) return null;
    return jsonError(429, "Too many checkout attempts. Please try again shortly.", {
      "Retry-After": "60",
    });
  } catch {
    return jsonError(
      503,
      "Checkout is temporarily unavailable. Please try again shortly."
    );
  }
}
