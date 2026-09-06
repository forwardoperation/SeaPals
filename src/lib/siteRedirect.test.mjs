import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalSiteRedirectLocation,
  canonicalSiteRedirectPolicy,
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

test("canonical redirect upgrades HTTP and removes www in one hop", () => {
  const environment = { SITE_URL: "https://seapalstcg.com" };

  for (const candidate of [
    request("http://seapalstcg.com/decks/reef?source=http&card=1"),
    request("https://www.seapalstcg.com/decks/reef?source=www&card=1"),
    request("http://www.seapalstcg.com/decks/reef?source=both&card=1"),
  ]) {
    const expectedQuery = new URL(candidate.url).search;
    assert.equal(
      canonicalSiteRedirectLocation(candidate, environment),
      `https://seapalstcg.com/decks/reef${expectedQuery}`,
    );
  }
});

test("canonical redirect is permanent and preserves mutation methods", () => {
  assert.deepEqual(canonicalSiteRedirectPolicy(), {
    status: 308,
    cacheControl: "public, max-age=3600",
  });
  assert.equal(
    canonicalSiteRedirectLocation(
      request("http://seapalstcg.com/api/store/checkout", "POST"),
      { SITE_URL: "https://seapalstcg.com" },
    ),
    "https://seapalstcg.com/api/store/checkout",
  );
});

test("canonical redirect is inert for canonical HTTPS and unrelated hosts", () => {
  const environment = { SITE_URL: "https://seapalstcg.com" };

  for (const candidate of [
    request("https://seapalstcg.com/store"),
    request("https://preview.example/store"),
    request("http://seapals.example.workers.dev/store"),
    request("ftp://seapalstcg.com/store"),
    request("https://owner:secret@www.seapalstcg.com/store"),
  ]) {
    assert.equal(
      canonicalSiteRedirectLocation(candidate, environment),
      null,
    );
  }

  assert.equal(
    canonicalSiteRedirectLocation(request("http://seapalstcg.com/store"), {
      SITE_URL: "http://seapalstcg.com",
    }),
    null,
  );
});

test("Cloudflare routes send the apex and www alias through canonical handling", () => {
  const wranglerConfig = readFileSync(
    new URL("../../wrangler.jsonc", import.meta.url),
    "utf8",
  );
  const workerSource = readFileSync(
    new URL("../../custom-worker.mjs", import.meta.url),
    "utf8",
  );

  assert.match(
    wranglerConfig,
    /"pattern": "seapalstcg\.com"[\s\S]{0,80}"custom_domain": true/,
  );
  assert.match(
    wranglerConfig,
    /"pattern": "www\.seapalstcg\.com\/\*"[\s\S]{0,120}"zone_name": "seapalstcg\.com"/,
  );
  assert.match(wranglerConfig, /"workers_dev": true/);
  assert.match(wranglerConfig, /"preview_urls": true/);
  assert.ok(
    workerSource.indexOf("canonicalSiteRedirectLocation(") <
      workerSource.indexOf("legacySiteRedirectLocation("),
    "canonical redirects must run before cross-domain cutover redirects",
  );
});

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
