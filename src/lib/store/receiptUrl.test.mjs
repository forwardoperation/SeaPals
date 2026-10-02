import assert from "node:assert/strict";
import test from "node:test";
import { stripeReceiptUrl } from "./receiptUrl.mjs";

test("receipt URLs retain the full Stripe token beyond 80 characters", () => {
  const receipt = `https://pay.stripe.com/receipts/payment/${"a".repeat(140)}?s=ap`;
  assert.equal(stripeReceiptUrl({ payment_intent: { latest_charge: { receipt_url: receipt } } }), receipt);
});

test("receipt links reject non-Stripe hosts, unsafe protocols, and credentials", () => {
  for (const receipt_url of ["https://stripe.com.evil.example/receipt", "http://pay.stripe.com/a", "javascript:alert(1)", "https://user:pass@pay.stripe.com/a", "not a URL"]) {
    assert.equal(stripeReceiptUrl({ receipt_url }), null);
  }
  assert.equal(stripeReceiptUrl(null), null);
});
