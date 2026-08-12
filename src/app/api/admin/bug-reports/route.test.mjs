import assert from "node:assert/strict";
import test from "node:test";
import { createAdminBugReportHandlers } from "./handler.mjs";

const ORIGIN = "https://seapalstcg.com";
const TOKEN = "bug-admin-token-that-is-at-least-32-characters";
const REPORT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const EXPECTED_UPDATED_AT = "2026-08-12T12:00:00.000Z";

function adminRequest(path, {
  method = "GET",
  token = TOKEN,
  body,
} = {}) {
  return new Request(`${ORIGIN}${path ?? "/api/admin/bug-reports"}`, {
    method,
    headers: {
      ...(token === null ? {} : { "x-admin-token": token }),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test("admin bug routes fail closed for missing, wrong, and weak configured tokens", async () => {
  let storageCalls = 0;
  const createAdmin = () => {
    storageCalls += 1;
    throw new Error("storage must not be reached");
  };
  const handlers = createAdminBugReportHandlers({
    createAdmin,
    getConfiguredToken: () => TOKEN,
    logger: { error() {} },
  });

  for (const token of [null, "wrong-token"]) {
    const response = await handlers.GET(adminRequest(undefined, { token }));
    assert.equal(response.status, 401);
    assert.match(response.headers.get("cache-control"), /no-store/);
  }

  const weakTokenHandlers = createAdminBugReportHandlers({
    createAdmin,
    getConfiguredToken: () => "too-short",
    logger: { error() {} },
  });
  const weakTokenResponse = await weakTokenHandlers.GET(adminRequest(undefined, {
    token: "too-short",
  }));
  assert.equal(weakTokenResponse.status, 401);
  assert.equal(storageCalls, 0);
});

test("admin GET returns a private bounded report list", async () => {
  let requestedLimit = null;
  const reports = [{ id: REPORT_ID, priority: "high" }];
  const query = {
    select() { return this; },
    order(field, options) {
      assert.equal(field, "submitted_at");
      assert.deepEqual(options, { ascending: false });
      return this;
    },
    async limit(value) {
      requestedLimit = value;
      return { data: reports, error: null };
    },
  };
  const handlers = createAdminBugReportHandlers({
    createAdmin: () => ({
      from(table) {
        assert.equal(table, "bug_reports");
        return query;
      },
    }),
    getConfiguredToken: () => TOKEN,
    logger: { error() {} },
  });

  const response = await handlers.GET(adminRequest());

  assert.equal(response.status, 200);
  assert.equal(requestedLimit, 500);
  assert.match(response.headers.get("cache-control"), /private/);
  assert.deepEqual(await response.json(), { reports });
});

test("admin PATCH returns 409 when optimistic concurrency finds a stale report", async () => {
  const equalityFilters = [];
  let savedUpdate = null;
  const query = {
    update(value) {
      savedUpdate = value;
      return this;
    },
    eq(field, value) {
      equalityFilters.push([field, value]);
      return this;
    },
    select() {
      return this;
    },
    async maybeSingle() {
      return { data: null, error: null };
    },
  };
  const handlers = createAdminBugReportHandlers({
    createAdmin: () => ({
      from(table) {
        assert.equal(table, "bug_reports");
        return query;
      },
    }),
    getConfiguredToken: () => TOKEN,
    now: () => new Date("2026-08-12T13:00:00.000Z"),
    logger: { error() {} },
  });

  const response = await handlers.PATCH(adminRequest(undefined, {
    method: "PATCH",
    body: {
      id: REPORT_ID,
      expectedUpdatedAt: EXPECTED_UPDATED_AT,
      priority: "high",
    },
  }));

  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /changed in another review session/i);
  assert.deepEqual(equalityFilters, [
    ["id", REPORT_ID],
    ["updated_at", EXPECTED_UPDATED_AT],
  ]);
  assert.deepEqual(savedUpdate, {
    priority: "high",
    updated_at: "2026-08-12T13:00:00.000Z",
  });
});
