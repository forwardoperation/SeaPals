const LOCAL_HTTP_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function firstConfiguredUrl(environment) {
  const serverOnlyUrl = String(environment?.SITE_URL ?? "").trim();
  if (serverOnlyUrl) return serverOnlyUrl;

  const legacyPublicUrl = String(
    environment?.NEXT_PUBLIC_SITE_URL ?? "",
  ).trim();
  return legacyPublicUrl || null;
}

export function getStoreSiteUrl(request, environment = process.env) {
  const configuredUrl = firstConfiguredUrl(environment);
  const url = new URL(configuredUrl || request?.url);
  const isLocalHttp =
    url.protocol === "http:" && LOCAL_HTTP_HOSTS.has(url.hostname);

  if (url.username || url.password) {
    throw new Error("The store URL must not contain credentials.");
  }

  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new Error("The store URL must use HTTPS.");
  }
  if (!configuredUrl && !LOCAL_HTTP_HOSTS.has(url.hostname)) {
    throw new Error("SITE_URL must be configured outside local development.");
  }

  return url.origin;
}

function validatedStoreOrigin(value) {
  const url = new URL(String(value ?? "").trim());
  const isLocalHttp =
    url.protocol === "http:" && LOCAL_HTTP_HOSTS.has(url.hostname);

  if (url.username || url.password) {
    throw new Error("A store origin must not contain credentials.");
  }
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new Error("A store origin must use HTTPS.");
  }

  return url.origin;
}

function validatedConfiguredStoreOrigin(value) {
  const normalized = String(value ?? "").trim();
  const url = new URL(normalized);
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("A configured store origin must not contain a path, query, or fragment.");
  }
  return validatedStoreOrigin(normalized);
}

export function getStoreCheckoutAllowedOrigins(
  siteUrl,
  environment = process.env,
) {
  const origins = new Set([validatedConfiguredStoreOrigin(siteUrl)]);
  const configured = String(
    environment?.STORE_CHECKOUT_ALLOWED_ORIGINS ?? "",
  );

  for (const entry of configured.split(",")) {
    const candidate = entry.trim();
    if (candidate) origins.add(validatedConfiguredStoreOrigin(candidate));
  }

  return origins;
}

/**
 * Returns the exact initiating origin after both same-request-origin and
 * deployment allowlist checks. Returning the origin lets Stripe send the
 * browser back to the host that owns its cart and checkout storage.
 */
export function getAllowedStoreRequestOrigin(
  request,
  siteUrl,
  environment = process.env,
) {
  const origin = request?.headers?.get?.("origin");
  if (!origin) return null;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return null;

  const allowedOrigins = getStoreCheckoutAllowedOrigins(siteUrl, environment);

  try {
    const requestOrigin = validatedStoreOrigin(request.url);
    const submittedOrigin = validatedStoreOrigin(origin);
    return requestOrigin === submittedOrigin && allowedOrigins.has(submittedOrigin)
      ? submittedOrigin
      : null;
  } catch {
    return null;
  }
}

export function requestOriginIsAllowed(
  request,
  siteUrl,
  environment = process.env,
) {
  return Boolean(getAllowedStoreRequestOrigin(request, siteUrl, environment));
}
