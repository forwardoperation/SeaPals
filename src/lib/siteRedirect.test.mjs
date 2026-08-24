import assert from "node:assert/strict";
import test from "node:test";

import {
  legacySiteRedirectLocation,
  legacySiteRedirectPolicy,
} from "./siteRedirect.mjs";

const CUTOVER_ENVIRONMENT = Object.freeze({
  SITE_URL: "https://searealm.com",
  SITE_LEGACY_ORIGINS:
    "https://seapalstcg.com, https://www.seapalstcg.com",
  SITE_LEGACY_REDIRECT_ENABLED: "true",
  SITE_LEGACY_REDIRECT_PERMANENT: "true",
});

function request(url, method = "GET") {
  return { url, method };
}

test("legacy redirect preserves the complete path and query", () => {
  assert.equal(
    legacySiteRedirectLocation(
      request("https://seapalstcg.com/decks/reef?source=old-domain&card=1"),
      CUTOVER_ENVIRONMENT,
    ),
    "https://searealm.com/decks/reef?source=old-domain&card=1",
  );
  assert.equal(
    legacySiteRedirectLocation(
      request("https://www.seapalstcg.com/"),
      CUTOVER_ENVIRONMENT,
    ),
    "https://searealm.com/",
  );
  assert.equal(
    legacySiteRedirectLocation(
      request("https://seapalstcg.com//evil.example/path?source=legacy"),
      CUTOVER_ENVIRONMENT,
    ),
    "https://searealm.com//evil.example/path?source=legacy",
  );
  assert.equal(
    legacySiteRedirectLocation(
      request("https://seapalstcg.com/%5C%5Cevil.example/path"),
      CUTOVER_ENVIRONMENT,
    ),
    "https://searealm.com/%5C%5Cevil.example/path",
  );
  assert.equal(
    legacySiteRedirectLocation(
      request("http://seapalstcg.com/store?source=http"),
      CUTOVER_ENVIRONMENT,
    ),
    "https://searealm.com/store?source=http",
  );
  assert.equal(
    legacySiteRedirectLocation(
      request("http://searealm.com/gallery"),
      CUTOVER_ENVIRONMENT,
    ),
    "https://searealm.com/gallery",
  );
});

test("legacy redirect policy starts rollback-safe before becoming permanent", () => {
  assert.deepEqual(
    legacySiteRedirectPolicy({ SITE_LEGACY_REDIRECT_PERMANENT: "false" }),
    { status: 302, cacheControl: "no-store" },
  );
  assert.deepEqual(legacySiteRedirectPolicy(CUTOVER_ENVIRONMENT), {
    status: 301,
    cacheControl: "public, max-age=3600",
  });
});

test("legacy redirect is inert before cutover and never redirects the canonical host", () => {
  assert.equal(
    legacySiteRedirectLocation(request("https://seapalstcg.com/store"), {
      ...CUTOVER_ENVIRONMENT,
      SITE_LEGACY_REDIRECT_ENABLED: "false",
    }),
    null,
  );
  assert.equal(
    legacySiteRedirectLocation(
      request("https://searealm.com/store"),
      CUTOVER_ENVIRONMENT,
    ),
    null,
  );
  assert.equal(
    legacySiteRedirectLocation(request("https://www.searealm.com/store"), {
      ...CUTOVER_ENVIRONMENT,
      SITE_URL: "https://seapalstcg.com",
    }),
    null,
  );
});

test("legacy redirect leaves mutations, APIs, and auth callbacks untouched", () => {
  for (const candidate of [
    request("https://seapalstcg.com/api/store/webhook"),
    request("https://seapalstcg.com/api/store/checkout", "POST"),
    request("https://seapalstcg.com/auth/callback?code=pkce"),
  ]) {
    assert.equal(
      legacySiteRedirectLocation(candidate, CUTOVER_ENVIRONMENT),
      null,
    );
  }
});

test("legacy redirect fails closed for unlisted hosts and invalid configuration", () => {
  assert.equal(
    legacySiteRedirectLocation(
      request("https://preview.example/store"),
      CUTOVER_ENVIRONMENT,
    ),
    null,
  );
  assert.equal(
    legacySiteRedirectLocation(
      request("https://www.searealm.com/store"),
      CUTOVER_ENVIRONMENT,
    ),
    null,
  );
  assert.equal(
    legacySiteRedirectLocation(request("https://seapalstcg.com/store"), {
      ...CUTOVER_ENVIRONMENT,
      SITE_URL: "http://searealm.com",
    }),
    null,
  );
  assert.equal(
    legacySiteRedirectLocation(request("https://seapalstcg.com/store"), {
      ...CUTOVER_ENVIRONMENT,
      SITE_LEGACY_ORIGINS: "not a URL",
    }),
    null,
  );
});
