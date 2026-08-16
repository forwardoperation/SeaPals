import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  enforceStoreCheckoutRateLimit,
  STORE_CHECKOUT_PATH,
} from "./checkoutRateLimit.mjs";

function checkoutRequest(address = "203.0.113.10") {
  return new Request(`https://seapalstcg.com${STORE_CHECKOUT_PATH}`, {
    method: "POST",
    headers: { "CF-Connecting-IP": address },
  });
}

test("only POST requests to the exact checkout route consume a rate-limit token", async () => {
  let calls = 0;
  const environment = {
    STORE_CHECKOUT_RATE_LIMITER: {
      async limit() {
        calls += 1;
        return { success: true };
      },
    },
  };

  assert.equal(
    await enforceStoreCheckoutRateLimit({
      request: new Request(`https://seapalstcg.com${STORE_CHECKOUT_PATH}`),
      environment,
    }),
    null
  );
  assert.equal(
    await enforceStoreCheckoutRateLimit({
      request: new Request("https://seapalstcg.com/api/store/webhook", {
        method: "POST",
      }),
      environment,
    }),
    null
  );
  assert.equal(calls, 0);

  assert.equal(
    await enforceStoreCheckoutRateLimit({
      request: checkoutRequest(),
      environment,
    }),
    null
  );
  assert.equal(calls, 1);
});

test("checkout rate-limit keys are stable hashes and never expose the source address", async () => {
  const keys = [];
  const environment = {
    STORE_CHECKOUT_RATE_LIMITER: {
      async limit({ key }) {
        keys.push(key);
        return { success: true };
      },
    },
  };

  await enforceStoreCheckoutRateLimit({ request: checkoutRequest(), environment });
  await enforceStoreCheckoutRateLimit({ request: checkoutRequest(), environment });
  await enforceStoreCheckoutRateLimit({
    request: checkoutRequest("203.0.113.11"),
    environment,
  });

  assert.match(keys[0], /^checkout:[0-9a-f]{64}$/);
  assert.equal(keys[0], keys[1]);
  assert.notEqual(keys[0], keys[2]);
  assert.doesNotMatch(keys.join(" "), /203\.0\.113\./);
});

test("an exhausted checkout limit returns a private 429 response", async () => {
  const response = await enforceStoreCheckoutRateLimit({
    request: checkoutRequest(),
    environment: {
      STORE_CHECKOUT_RATE_LIMITER: {
        async limit() {
          return { success: false };
        },
      },
    },
  });

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("retry-after"), "60");
  assert.deepEqual(await response.json(), {
    error: "Too many checkout attempts. Please try again shortly.",
  });
});

test("checkout fails closed when its rate-limit binding is missing or errors", async () => {
  const missing = await enforceStoreCheckoutRateLimit({
    request: checkoutRequest(),
    environment: {},
  });
  const failed = await enforceStoreCheckoutRateLimit({
    request: checkoutRequest(),
    environment: {
      STORE_CHECKOUT_RATE_LIMITER: {
        async limit() {
          throw new Error("provider detail must not escape");
        },
      },
    },
  });

  for (const response of [missing, failed]) {
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), {
      error: "Checkout is temporarily unavailable. Please try again shortly.",
    });
  }
});

test("the production Worker binds and applies the exact checkout limit", () => {
  const worker = readFileSync(
    new URL("../../../custom-worker.mjs", import.meta.url),
    "utf8"
  );
  const wrangler = readFileSync(
    new URL("../../../wrangler.jsonc", import.meta.url),
    "utf8"
  );

  assert.match(
    worker,
    /enforceStoreCheckoutRateLimit\(\{\s*request,\s*environment,?\s*\}\)/
  );
  assert.ok(
    worker.indexOf("enforceStoreCheckoutRateLimit") <
      worker.indexOf("openNextWorker.fetch(request, environment, context)")
  );
  assert.match(wrangler, /"name": "STORE_CHECKOUT_RATE_LIMITER"/);
  assert.match(wrangler, /"namespace_id": "2026081501"/);
  assert.match(
    wrangler,
    /"simple": \{\s*"limit": 10,\s*"period": 60\s*\}/
  );
  assert.match(
    wrangler,
    /"observability": \{[\s\S]*"enabled": true,[\s\S]*"head_sampling_rate": 1/
  );
});
