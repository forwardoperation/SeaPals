import assert from "node:assert/strict";
import test from "node:test";

import { isTrustedSameOriginMutation } from "./sameOriginMutation.mjs";

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

test("accepts an exact same-origin browser mutation", () => {
  assert.equal(
    isTrustedSameOriginMutation(
      request("https://seapalstcg.com/api/adventure/auth-intent", {
        Origin: "https://seapalstcg.com",
        "Sec-Fetch-Site": "same-origin",
      }),
    ),
    true,
  );
});

test("rejects missing, cross-origin, and cross-site mutation evidence", () => {
  assert.equal(
    isTrustedSameOriginMutation(
      request("https://seapalstcg.com/api/adventure/auth-intent"),
    ),
    false,
  );
  assert.equal(
    isTrustedSameOriginMutation(
      request("https://seapalstcg.com/api/adventure/auth-intent", {
        Origin: "https://attacker.example",
        "Sec-Fetch-Site": "cross-site",
      }),
    ),
    false,
  );
  assert.equal(
    isTrustedSameOriginMutation(
      request("https://seapalstcg.com/api/adventure/auth-intent", {
        Origin: "https://seapalstcg.com",
        "Sec-Fetch-Site": "same-site",
      }),
    ),
    false,
  );
});

test("fails closed on malformed request URLs and origins", () => {
  assert.equal(
    isTrustedSameOriginMutation(
      request("not a URL", { Origin: "https://seapalstcg.com" }),
    ),
    false,
  );
  assert.equal(
    isTrustedSameOriginMutation(
      request("https://seapalstcg.com/api/adventure/auth-intent", {
        Origin: "not a URL",
      }),
    ),
    false,
  );
});
