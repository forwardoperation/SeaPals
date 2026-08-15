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

  return url.origin;
}

export function requestOriginIsAllowed(request, siteUrl) {
  const origin = request?.headers?.get?.("origin");
  if (!origin) return false;

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") return false;

  try {
    return new URL(origin).origin === new URL(siteUrl).origin;
  } catch {
    return false;
  }
}
