const EXCLUDED_ANALYTICS_PATHS = Object.freeze([
  "/adventure",
  "/auth",
  "/store/success",
  "/store/cancel",
  "/admin",
]);

function isPathOrDescendant(pathname, excludedPath) {
  return pathname === excludedPath || pathname.startsWith(`${excludedPath}/`);
}

export function excludesAnalytics(pathname) {
  const normalizedPathname =
    typeof pathname === "string" && pathname.startsWith("/") ? pathname : "";

  return EXCLUDED_ANALYTICS_PATHS.some((excludedPath) =>
    isPathOrDescendant(normalizedPathname, excludedPath)
  );
}
