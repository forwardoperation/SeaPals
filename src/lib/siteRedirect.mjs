const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const REDIRECT_METHODS = new Set(["GET", "HEAD"]);
const PASSTHROUGH_PATHS = Object.freeze(["/api", "/auth"]);
const TEMPORARY_REDIRECT_POLICY = Object.freeze({
  status: 302,
  cacheControl: "no-store",
});
const PERMANENT_REDIRECT_POLICY = Object.freeze({
  status: 301,
  cacheControl: "public, max-age=3600",
});

function enabled(value) {
  return TRUE_VALUES.has(String(value ?? "").trim().toLowerCase());
}

function httpsOrigin(value) {
  const url = new URL(String(value ?? "").trim());
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    return null;
  }
  return url.origin;
}

function requestHttpsOrigin(url) {
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    return null;
  }

  const normalized = new URL(url.origin);
  normalized.protocol = "https:";
  return normalized.origin;
}

function configuredLegacyOrigins(value) {
  const origins = new Set();

  for (const entry of String(value ?? "").split(",")) {
    const candidate = entry.trim();
    if (!candidate) continue;

    try {
      const origin = httpsOrigin(candidate);
      if (!origin) return null;
      origins.add(origin);
    } catch {
      return null;
    }
  }

  return origins;
}

function isPassthroughPath(pathname) {
  return PASSTHROUGH_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function legacySiteRedirectPolicy(environment = {}) {
  return enabled(environment.SITE_LEGACY_REDIRECT_PERMANENT)
    ? PERMANENT_REDIRECT_POLICY
    : TEMPORARY_REDIRECT_POLICY;
}

/**
 * Returns a path- and query-preserving canonical URL for safe browser reads.
 * API and auth routes deliberately remain available on the legacy hostname so
 * Stripe retries and callback codes are not redirected. Auth cookies and PKCE
 * state still cannot cross between the two unrelated root domains.
 */
export function legacySiteRedirectLocation(request, environment = {}) {
  if (!enabled(environment.SITE_LEGACY_REDIRECT_ENABLED)) return null;
  if (!REDIRECT_METHODS.has(String(request?.method ?? "GET").toUpperCase())) {
    return null;
  }

  let requestUrl;
  let canonicalOrigin;
  let legacyOrigins;
  let sourceHttpsOrigin;
  try {
    requestUrl = new URL(request.url);
    canonicalOrigin = httpsOrigin(environment.SITE_URL);
    legacyOrigins = configuredLegacyOrigins(environment.SITE_LEGACY_ORIGINS);
    sourceHttpsOrigin = requestHttpsOrigin(requestUrl);
  } catch {
    return null;
  }

  if (
    !canonicalOrigin ||
    !legacyOrigins ||
    !sourceHttpsOrigin ||
    legacyOrigins.has(canonicalOrigin) ||
    (canonicalOrigin === sourceHttpsOrigin && requestUrl.protocol === "https:") ||
    (canonicalOrigin !== sourceHttpsOrigin &&
      !legacyOrigins.has(sourceHttpsOrigin)) ||
    isPassthroughPath(requestUrl.pathname)
  ) {
    return null;
  }

  const redirectUrl = new URL(canonicalOrigin);
  redirectUrl.pathname = requestUrl.pathname;
  redirectUrl.search = requestUrl.search;
  return redirectUrl.toString();
}
