import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  LEGAL_EFFECTIVE_DATE_ISO,
  PRIVACY_PROVIDER_NAMES,
  PRIVACY_RETENTION_SCHEDULE,
  SEAPALS_OPERATOR,
  operatorMailingAddress,
} from "./legalPrivacy.mjs";

test("legal operator details are publishable and internally consistent", () => {
  assert.equal(SEAPALS_OPERATOR.legalName, "Sea Realm, LLC");
  assert.equal(SEAPALS_OPERATOR.privacyEmail, "maker@seapalstcg.com");
  assert.match(operatorMailingAddress(), /PO Box 11/);
  assert.match(operatorMailingAddress(), /Elverson, PA 19520/);
  assert.match(LEGAL_EFFECTIVE_DATE_ISO, /^\d{4}-\d{2}-\d{2}$/);
});

test("the privacy inventory names every configured outside service", () => {
  assert.deepEqual(PRIVACY_PROVIDER_NAMES, [
    "Cloudflare",
    "Google",
    "Kit",
    "Resend",
    "Stripe",
    "Supabase",
  ]);
});

test("every retention category has a finite published period", () => {
  assert.ok(PRIVACY_RETENTION_SCHEDULE.length >= 8);

  for (const entry of PRIVACY_RETENTION_SCHEDULE) {
    assert.ok(entry.category);
    assert.ok(entry.period);
    assert.ok(entry.detail);
    assert.doesNotMatch(entry.period, /\bindefinite(?:ly)?\b/i);
  }
});

test("legal links and direct notices are present at collection points", async () => {
  const files = await Promise.all(
    [
      "../app/page.jsx",
      "../app/adventure/AdventureAuthGate.jsx",
      "../app/store/Storefront.jsx",
      "../app/surveys/page.jsx",
      "../app/tournaments/[slug]/enter/page.jsx",
      "../components/feedback/BugReportDialog.jsx",
      "../components/layout/SiteFooter.jsx",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  for (const source of files) {
    assert.match(source, /\/privacy/);
    assert.match(source, /\/terms/);
  }

  assert.match(files[0], /Sea Realm,\s*LLC/);
  assert.match(files[1], /Supabase/);
  assert.match(files[1], /maker@seapalstcg\.com/);
  assert.match(files[2], /Stripe/);
  assert.match(files[3], /12 months/);
  assert.match(files[4], /publicly/);
});
