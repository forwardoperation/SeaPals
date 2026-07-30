import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_KIT_FORM_ID,
  NewsletterSubscriptionError,
  normalizeNewsletterEmail,
  normalizeNewsletterFirstName,
  subscribeToNewsletter,
} from "./newsletter.js";

function isNewsletterError(code, status) {
  return (error) => {
    assert.ok(error instanceof NewsletterSubscriptionError);
    assert.equal(error.code, code);
    if (status === undefined) {
      assert.equal("status" in error, false);
    } else {
      assert.equal(error.status, status);
    }
    return true;
  };
}

test("newsletter subscriptions require explicit consent without making a request", async () => {
  let requestCount = 0;
  const fetchImpl = async () => {
    requestCount += 1;
    return new Response(null, { status: 204 });
  };

  await assert.rejects(
    subscribeToNewsletter({
      consent: false,
      email: "player@example.com",
      fetchImpl,
    }),
    isNewsletterError("CONSENT_REQUIRED"),
  );
  await assert.rejects(
    subscribeToNewsletter({
      email: "player@example.com",
      fetchImpl,
    }),
    isNewsletterError("CONSENT_REQUIRED"),
  );
  assert.equal(requestCount, 0);
});

test("posts normalized subscriber fields to the default Kit form", async () => {
  let request;
  const result = await subscribeToNewsletter({
    consent: true,
    email: "  ALICE.Example+Crew@Example.COM  ",
    firstName: "  Alice \n  Example  ",
    env: {},
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return new Response(null, { status: 204 });
    },
  });

  assert.equal(
    request.url,
    `https://app.kit.com/forms/${DEFAULT_KIT_FORM_ID}/subscriptions`,
  );
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.redirect, "manual");
  assert.equal(request.options.cache, "no-store");
  assert.match(
    request.options.headers["Content-Type"],
    /^application\/x-www-form-urlencoded/,
  );

  const body = new URLSearchParams(request.options.body);
  assert.equal(body.get("email_address"), "alice.example+crew@example.com");
  assert.equal(body.get("fields[first_name]"), "Alice Example");
  assert.deepEqual(result, {
    ok: true,
    accepted: true,
    status: 204,
    confirmation: "response",
  });
  assert.equal(Object.isFrozen(result), true);
});

test("uses KIT_FORM_ID from the injected environment and omits an empty first name", async () => {
  let request;
  const result = await subscribeToNewsletter({
    consent: true,
    email: "crew@example.org",
    firstName: " \t ",
    env: { KIT_FORM_ID: " 123456 " },
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return new Response(null, {
        status: 303,
        headers: { Location: "https://app.kit.com/confirm" },
      });
    },
  });

  assert.equal(
    request.url,
    "https://app.kit.com/forms/123456/subscriptions",
  );
  const body = new URLSearchParams(request.options.body);
  assert.equal(body.get("email_address"), "crew@example.org");
  assert.equal(body.has("fields[first_name]"), false);
  assert.deepEqual(result, {
    ok: true,
    accepted: true,
    status: 303,
    confirmation: "redirect",
  });
});

test("normalizes valid fields and rejects malformed subscriber input", () => {
  assert.equal(
    normalizeNewsletterEmail("  Crew.Member+reef@Example.Co.UK "),
    "crew.member+reef@example.co.uk",
  );
  assert.equal(normalizeNewsletterFirstName(undefined), null);
  assert.equal(normalizeNewsletterFirstName("  Zoë   Anne "), "Zoë Anne");

  const invalidEmails = [
    "",
    "missing-at.example.com",
    "two@@example.com",
    ".leading@example.com",
    "trailing.@example.com",
    "double..dot@example.com",
    "space in@example.com",
    "name@example",
    "name@-example.com",
  ];
  for (const email of invalidEmails) {
    assert.throws(
      () => normalizeNewsletterEmail(email),
      isNewsletterError("INVALID_EMAIL"),
    );
  }

  assert.throws(
    () => normalizeNewsletterEmail({ address: "crew@example.com" }),
    isNewsletterError("INVALID_EMAIL"),
  );
  assert.throws(
    () => normalizeNewsletterFirstName("A".repeat(101)),
    isNewsletterError("INVALID_FIRST_NAME"),
  );
  assert.throws(
    () => normalizeNewsletterFirstName({ name: "Alice" }),
    isNewsletterError("INVALID_FIRST_NAME"),
  );
});

test("rejects an invalid form id before making a request", async () => {
  let requestCount = 0;

  await assert.rejects(
    subscribeToNewsletter({
      consent: true,
      email: "crew@example.com",
      env: { KIT_FORM_ID: "../../other-host" },
      fetchImpl: async () => {
        requestCount += 1;
        return new Response(null, { status: 204 });
      },
    }),
    isNewsletterError("INVALID_FORM_ID"),
  );

  assert.equal(requestCount, 0);
});

test("accepts only confirmation redirects and never follows them", async () => {
  for (const status of [302, 303]) {
    let redirectMode;
    const result = await subscribeToNewsletter({
      consent: true,
      email: "crew@example.com",
      fetchImpl: async (_url, options) => {
        redirectMode = options.redirect;
        return new Response(null, {
          status,
          headers: { Location: "https://unexpected.example/thank-you" },
        });
      },
    });

    assert.equal(redirectMode, "manual");
    assert.equal(result.confirmation, "redirect");
    assert.equal(result.status, status);
  }

  for (const status of [301, 307, 308]) {
    await assert.rejects(
      subscribeToNewsletter({
        consent: true,
        email: "crew@example.com",
        fetchImpl: async () =>
          new Response(null, {
            status,
            headers: { Location: "https://unexpected.example/repost" },
          }),
      }),
      isNewsletterError("UNSAFE_REDIRECT", status),
    );
  }
});

test("sanitizes provider and transport failures without exposing PII", async () => {
  const privateEmail = "private-player@example.com";
  let providerError;
  try {
    await subscribeToNewsletter({
      consent: true,
      email: privateEmail,
      fetchImpl: async () =>
        new Response(`Rejected subscriber ${privateEmail}`, { status: 422 }),
    });
  } catch (error) {
    providerError = error;
  }

  assert.ok(providerError instanceof NewsletterSubscriptionError);
  assert.equal(providerError.code, "UPSTREAM_REJECTED");
  assert.equal(providerError.status, 422);
  assert.doesNotMatch(String(providerError), /private-player|example\.com/i);
  assert.doesNotMatch(JSON.stringify(providerError), /private-player|example\.com/i);

  await assert.rejects(
    subscribeToNewsletter({
      consent: true,
      email: privateEmail,
      fetchImpl: async () => {
        throw new Error(`Network failed for ${privateEmail}`);
      },
    }),
    (error) => {
      assert.ok(error instanceof NewsletterSubscriptionError);
      assert.equal(error.code, "TRANSPORT_UNAVAILABLE");
      assert.doesNotMatch(String(error), /private-player|example\.com/i);
      assert.equal("cause" in error, false);
      return true;
    },
  );
});

test("refuses to submit from a browser runtime", async () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  let requestCount = 0;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {},
    writable: true,
  });

  try {
    await assert.rejects(
      subscribeToNewsletter({
        consent: true,
        email: "crew@example.com",
        fetchImpl: async () => {
          requestCount += 1;
          return new Response(null, { status: 204 });
        },
      }),
      isNewsletterError("SERVER_ONLY"),
    );
  } finally {
    if (previousWindow) {
      Object.defineProperty(globalThis, "window", previousWindow);
    } else {
      delete globalThis.window;
    }
  }

  assert.equal(requestCount, 0);
});
