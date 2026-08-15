const BASE_SECURITY_HEADERS = Object.freeze([
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=()",
  },
  { key: "X-Frame-Options", value: "DENY" },
]);

const PRODUCTION_SECURITY_HEADERS = Object.freeze([
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000",
  },
]);

export function getSecurityHeaders(environment = process.env) {
  return [
    ...BASE_SECURITY_HEADERS,
    ...(environment.NODE_ENV === "production"
      ? PRODUCTION_SECURITY_HEADERS
      : []),
  ];
}
