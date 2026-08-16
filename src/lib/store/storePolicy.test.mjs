import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [terms, storefront, launchInput, operations, legalConfig] =
  await Promise.all(
    [
      "../../app/terms/page.jsx",
      "../../app/store/Storefront.jsx",
      "../../../docs/store-launch-owner-input.md",
      "../../../docs/store-inventory-operations.md",
      "../legalPrivacy.mjs",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );

test("the public checkout and purchase terms publish the approved customer policy", () => {
  assert.match(storefront, /mailto:maker@seapalstcg\.com/);
  assert.match(storefront, /within two hours to request cancellation/);
  assert.match(
    storefront,
    /Unopened items may\s+be returned within 30 days after delivery or pickup/,
  );
  assert.match(storefront, /href="\/terms#purchases"/);

  assert.match(terms, /within two hours after\s+purchase/);
  assert.match(
    terms,
    /request a return for an unopened item within 30 calendar\s+days after carrier tracking shows delivery or, for local pickup,\s+after the order is picked up/i,
  );
  assert.match(terms, /purchaser pays return postage/);
  assert.match(terms, /Opened or played products are final sale/);
  assert.match(terms, /damaged, defective, missing, or incorrect/);
  assert.match(terms, /within 14 calendar days after delivery or pickup/);
  assert.match(terms, /Once carrier loss is\s+confirmed/);
  assert.match(terms, /replace the affected order[\s\S]*or refund it/);
  assert.match(terms, /within five business days/);
  assert.match(terms, /original payment\s+method/);
  assert.match(terms, /bank or card issuer may take additional time/);
  assert.match(terms, /SEAPALS_OPERATOR\.privacyEmail/);
});

test("owner record and operating procedure match the published policy", () => {
  for (const source of [launchInput, operations]) {
    assert.match(source, /maker@seapalstcg\.com/);
    assert.match(source, /two\s+hours after purchase/);
    assert.match(source, /30 calendar days/);
    assert.match(source, /damaged,\s+defective,\s+missing,\s+or incorrect/);
    assert.match(source, /14 calendar days/);
    assert.match(source, /five business days/);
    assert.match(source, /carrier loss\s+is\s+confirmed/);
  }

  assert.match(launchInput, /Published return\/refund\/cancellation wording approved: \*\*yes\*\*/);
  assert.match(launchInput, /Date: \*\*2026-08-15\*\*/);
  assert.match(operations, /refund does not automatically put returned units/i);
});

test("the legal document effective date reflects policy approval", () => {
  assert.match(legalConfig, /LEGAL_EFFECTIVE_DATE_ISO = "2026-08-15"/);
  assert.match(legalConfig, /LEGAL_EFFECTIVE_DATE_LABEL = "August 15, 2026"/);
});
