import assert from "node:assert/strict";
import test from "node:test";

import { getSecurityHeaders } from "./securityHeaders.mjs";

function headerMap(environment) {
  return new Map(
    getSecurityHeaders(environment).map(({ key, value }) => [key, value]),
  );
}

test("security headers protect content, referrers, permissions, and framing", () => {
  const headers = headerMap({ NODE_ENV: "development" });

  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(
    headers.get("Referrer-Policy"),
    "strict-origin-when-cross-origin",
  );
  assert.equal(
    headers.get("Permissions-Policy"),
    "camera=(), geolocation=(), microphone=()",
  );
  assert.equal(headers.get("X-Frame-Options"), "DENY");
  assert.equal(headers.has("Content-Security-Policy"), false);
});

test("HSTS is emitted only for production builds", () => {
  assert.equal(
    headerMap({ NODE_ENV: "production" }).get("Strict-Transport-Security"),
    "max-age=31536000",
  );
  assert.equal(
    headerMap({ NODE_ENV: "development" }).has("Strict-Transport-Security"),
    false,
  );
  assert.equal(
    headerMap({ NODE_ENV: "test" }).has("Strict-Transport-Security"),
    false,
  );
});
