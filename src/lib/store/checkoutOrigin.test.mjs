import assert from "node:assert/strict";
import test from "node:test";

import {
  getStoreSiteUrl,
  requestOriginIsAllowed,
} from "./checkoutOrigin.mjs";

function request(url, headers = {}) {
  const values = new Headers(headers);
  return {
    url,
    headers: {
      get(name) {
        return values.get(name);
      },
    },
  };
}

test("SITE_URL takes precedence over the legacy public site URL", () => {
  assert.equal(
    getStoreSiteUrl(request("https://request.example/api/store/checkout"), {
      SITE_URL: " https://seapalstcg.com/store ",
      NEXT_PUBLIC_SITE_URL: "https://legacy.example",
    }),
    "https://seapalstcg.com",
  );
});

test("checkout origin resolution retains legacy and local fallbacks", () => {
  assert.equal(
    getStoreSiteUrl(request("https://request.example/api/store/checkout"), {
      SITE_URL: " ",
      NEXT_PUBLIC_SITE_URL: "https://legacy.example/path",
    }),
    "https://legacy.example",
  );
  assert.equal(
    getStoreSiteUrl(request("http://localhost:3000/api/store/checkout"), {}),
    "http://localhost:3000",
  );
});

test("checkout origin resolution rejects unsafe URLs", () => {
  assert.throws(
    () =>
      getStoreSiteUrl(request("http://store.example/api/store/checkout"), {}),
    /HTTPS/,
  );
  assert.throws(
    () =>
      getStoreSiteUrl(request("https://request.example/api/store/checkout"), {
        SITE_URL: "https://owner:secret@store.example",
      }),
    /credentials/,
  );
  assert.throws(
    () =>
      getStoreSiteUrl(request("https://request.example/api/store/checkout"), {
        SITE_URL: "not a URL",
      }),
    TypeError,
  );
});

test("checkout mutations require exact same-origin browser evidence", () => {
  const siteUrl = "https://seapalstcg.com";

  assert.equal(
    requestOriginIsAllowed(
      request("https://seapalstcg.com/api/store/checkout", {
        Origin: "https://seapalstcg.com",
        "Sec-Fetch-Site": "same-origin",
      }),
      siteUrl,
    ),
    true,
  );
  assert.equal(
    requestOriginIsAllowed(
      request("https://seapalstcg.com/api/store/checkout", {
        Origin: "https://seapalstcg.com",
      }),
      siteUrl,
    ),
    true,
  );
});

test("checkout mutations reject missing, cross-origin, and malformed origins", () => {
  const siteUrl = "https://seapalstcg.com";

  assert.equal(
    requestOriginIsAllowed(
      request("https://seapalstcg.com/api/store/checkout"),
      siteUrl,
    ),
    false,
  );
  assert.equal(
    requestOriginIsAllowed(
      request("https://seapalstcg.com/api/store/checkout", {
        Origin: "https://attacker.example",
        "Sec-Fetch-Site": "cross-site",
      }),
      siteUrl,
    ),
    false,
  );
  assert.equal(
    requestOriginIsAllowed(
      request("https://seapalstcg.com/api/store/checkout", {
        Origin: "https://seapalstcg.com",
        "Sec-Fetch-Site": "same-site",
      }),
      siteUrl,
    ),
    false,
  );
  assert.equal(
    requestOriginIsAllowed(
      request("https://seapalstcg.com/api/store/checkout", {
        Origin: "not a URL",
      }),
      siteUrl,
    ),
    false,
  );
});
