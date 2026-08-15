import assert from "node:assert/strict";
import test from "node:test";
import { urlWithoutCheckoutSessionId } from "./successUrl.mjs";

test("removes the Stripe Checkout Session reference from a success URL", () => {
  assert.equal(
    urlWithoutCheckoutSessionId(
      "https://seapalstcg.com/store/success?session_id=cs_live_private"
    ),
    "/store/success"
  );
});

test("preserves unrelated query values and fragments", () => {
  assert.equal(
    urlWithoutCheckoutSessionId(
      "https://seapalstcg.com/store/success?session_id=cs_test_private&source=receipt#status"
    ),
    "/store/success?source=receipt#status"
  );
});

test("does nothing when there is no removable checkout reference", () => {
  assert.equal(
    urlWithoutCheckoutSessionId("https://seapalstcg.com/store/success"),
    null
  );
  assert.equal(urlWithoutCheckoutSessionId("not a URL"), null);
});
