import assert from "node:assert/strict";
import test from "node:test";

import {
  CANONICAL_SITE_HOSTNAME,
  CANONICAL_SITE_ORIGIN,
  PUBLIC_SUPPORT_EMAIL,
  SEAPALS_LEGACY_SITE_ORIGIN,
  SEAREALM_SITE_ORIGIN,
} from "./siteIdentity.mjs";

test("site identity keeps canonical, migration, and support identities explicit", () => {
  assert.equal(CANONICAL_SITE_ORIGIN, SEAPALS_LEGACY_SITE_ORIGIN);
  assert.equal(CANONICAL_SITE_HOSTNAME, "seapalstcg.com");
  assert.equal(SEAREALM_SITE_ORIGIN, "https://searealm.com");
  assert.notEqual(SEAREALM_SITE_ORIGIN, SEAPALS_LEGACY_SITE_ORIGIN);
  assert.equal(PUBLIC_SUPPORT_EMAIL, "maker@seapalstcg.com");
});

test("public site origins are normalized HTTPS origins without paths", () => {
  for (const origin of [SEAPALS_LEGACY_SITE_ORIGIN, SEAREALM_SITE_ORIGIN]) {
    const url = new URL(origin);
    assert.equal(url.protocol, "https:");
    assert.equal(url.origin, origin);
    assert.equal(url.pathname, "/");
    assert.equal(url.search, "");
    assert.equal(url.hash, "");
  }
});
