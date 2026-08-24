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
import { PUBLIC_SUPPORT_EMAIL } from "./siteIdentity.mjs";

test("legal operator details are publishable and internally consistent", () => {
  assert.equal(SEAPALS_OPERATOR.legalName, "Sea Realm, LLC");
  assert.equal(SEAPALS_OPERATOR.privacyEmail, PUBLIC_SUPPORT_EMAIL);
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

test("legal notices disclose Reefbound cloud-save data and account rights", async () => {
  const [privacy, terms, setup] = await Promise.all(
    [
      "../app/privacy/page.jsx",
      "../app/terms/page.jsx",
      "../../docs/adventure-account-setup.md",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

  for (const source of [privacy, terms, setup]) {
    assert.match(source, /Supabase/);
    assert.match(source, /player(?:-entered)? player and\s+best-friend names/i);
    assert.match(source, /progress/);
    assert.match(source, /settings/);
    assert.match(source, /decks/);
    assert.match(source, /export/);
    assert.match(source, /correction/);
    assert.match(source, /delet/i);
  }

  assert.match(privacy, /cross-device/);
  assert.match(privacy, /Reefbound cloud saves/);
  assert.match(privacy, /up to 30 days/);
  assert.match(privacy, /provider&apos;s backup\s+schedule/);
  assert.match(terms, /conflicting copies/);
  assert.match(setup, /Child-privacy launch gate/);
  assert.match(setup, /supabase\/adventure-saves\.sql/);
  assert.match(setup, /\/api\/adventure\/saves/);
  assert.match(setup, /row-level security/i);
  assert.match(
    setup,
    /Do not enable the account requirement or cloud-save synchronization publicly/,
  );
  assert.match(setup, /authenticated export and correction\s+workflow/);
});

test("purchase terms separate production timing from carrier delivery", async () => {
  const terms = await readFile(
    new URL("../app/terms/page.jsx", import.meta.url),
    "utf8"
  );

  assert.match(terms, /Production timing is separate from carrier transit/);
  assert.match(terms, /within five business days after payment/);
  assert.match(terms, /one-business-day production/);
  assert.match(terms, /does not promise one-business-day\s+delivery/);
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
  assert.match(files[1], /PUBLIC_SUPPORT_EMAIL/);
  assert.match(files[2], /Stripe/);
  assert.match(files[3], /12 months/);
  assert.match(files[4], /publicly/);
});
