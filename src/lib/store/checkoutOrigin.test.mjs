import assert from "node:assert/strict";
import test from "node:test";

import {
  getAllowedStoreRequestOrigin,
  getStoreCheckoutAllowedOrigins,
  getStoreSiteUrl,
  requestOriginIsAllowed,
} from "./checkoutOrigin.mjs";

const DUAL_DOMAIN_ENVIRONMENT = {
  STORE_CHECKOUT_ALLOWED_ORIGINS:
    "https://seapalstcg.com, https://searealm.com",
};

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
  assert.throws(
    () =>
      getStoreSiteUrl(
        request("https://seapals-preview.workers.dev/api/store/checkout"),
        {},
      ),
    /SITE_URL/,
  );
});

test("checkout allowlist always includes the canonical site origin", () => {
  assert.deepEqual(
    [
      ...getStoreCheckoutAllowedOrigins(
        "https://seapalstcg.com",
        DUAL_DOMAIN_ENVIRONMENT,
      ),
    ],
    ["https://seapalstcg.com", "https://searealm.com"],
  );
});

test("dual-domain checkout returns each matching initiating origin", () => {
  const siteUrl = "https://seapalstcg.com";

  assert.equal(
    getAllowedStoreRequestOrigin(
      request("https://seapalstcg.com/api/store/checkout", {
        Origin: "https://seapalstcg.com",
        "Sec-Fetch-Site": "same-origin",
      }),
      siteUrl,
      DUAL_DOMAIN_ENVIRONMENT,
    ),
    "https://seapalstcg.com",
  );
  assert.equal(
    getAllowedStoreRequestOrigin(
      request("https://searealm.com/api/store/checkout", {
        Origin: "https://searealm.com",
      }),
      siteUrl,
      DUAL_DOMAIN_ENVIRONMENT,
    ),
    "https://searealm.com",
  );
});

test("allowlisted origins cannot submit to the other hostname", () => {
  const siteUrl = "https://seapalstcg.com";

  assert.equal(
    requestOriginIsAllowed(
      request("https://seapalstcg.com/api/store/checkout", {
        Origin: "https://searealm.com",
        "Sec-Fetch-Site": "same-origin",
      }),
      siteUrl,
      DUAL_DOMAIN_ENVIRONMENT,
    ),
    false,
  );
  assert.equal(
    requestOriginIsAllowed(
      request("https://searealm.com/api/store/checkout", {
        Origin: "https://seapalstcg.com",
        "Sec-Fetch-Site": "same-origin",
      }),
      siteUrl,
      DUAL_DOMAIN_ENVIRONMENT,
    ),
    false,
  );
});

test("checkout mutations reject missing, unlisted, and malformed origins", () => {
  const siteUrl = "https://seapalstcg.com";
  const rejectedRequests = [
    request("https://seapalstcg.com/api/store/checkout"),
    request("https://seapalstcg.com/api/store/checkout", {
      Origin: "https://attacker.example",
      "Sec-Fetch-Site": "cross-site",
    }),
    request("https://seapalstcg.com/api/store/checkout", {
      Origin: "https://seapalstcg.com",
      "Sec-Fetch-Site": "same-site",
    }),
    request("https://seapalstcg.com/api/store/checkout", {
      Origin: "not a URL",
    }),
    request("https://seapals.workers.dev/api/store/checkout", {
      Origin: "https://seapals.workers.dev",
      "Sec-Fetch-Site": "same-origin",
    }),
    request("https://seapalstcg.com/api/store/checkout", {
      Origin: "https://owner:secret@seapalstcg.com",
    }),
    request("http://seapalstcg.com/api/store/checkout", {
      Origin: "http://seapalstcg.com",
    }),
  ];

  for (const candidate of rejectedRequests) {
    assert.equal(
      requestOriginIsAllowed(
        candidate,
        siteUrl,
        DUAL_DOMAIN_ENVIRONMENT,
      ),
      false,
    );
  }
});

test("invalid checkout allowlist configuration fails closed", () => {
  const environment = {
    STORE_CHECKOUT_ALLOWED_ORIGINS: "https://searealm.com,not a URL",
  };

  assert.throws(
    () => getStoreCheckoutAllowedOrigins("https://seapalstcg.com", environment),
    TypeError,
  );
  assert.throws(
    () =>
      getAllowedStoreRequestOrigin(
        request("https://searealm.com/api/store/checkout", {
          Origin: "https://searealm.com",
        }),
        "https://seapalstcg.com",
        environment,
      ),
    TypeError,
  );
  assert.throws(
    () =>
      getStoreCheckoutAllowedOrigins("https://seapalstcg.com", {
        STORE_CHECKOUT_ALLOWED_ORIGINS: "https://searealm.com/store?typo=1",
      }),
    /path, query, or fragment/,
  );
});

test("matching localhost HTTP origins remain available for development", () => {
  assert.equal(
    getAllowedStoreRequestOrigin(
      request("http://localhost:3000/api/store/checkout", {
        Origin: "http://localhost:3000",
        "Sec-Fetch-Site": "same-origin",
      }),
      "http://localhost:3000",
      {},
    ),
    "http://localhost:3000",
  );
});
