import assert from "node:assert/strict";
import test from "node:test";
import {
  BUG_REPORT_MAX_REQUEST_BYTES,
  createBugReportPostHandler,
} from "./handler.mjs";

const ORIGIN = "https://seapalstcg.com";

function validPayload(overrides = {}) {
  return {
    surface: "simulator",
    summary: "Creature School remains at zero HP",
    description: "The defeated Creature School stays in the opponent ecosystem.",
    steps: "Attack the opposing Creature School until its HP reaches zero.",
    expectedBehavior: "The school should move to the opponent discard pile.",
    impact: "can-continue",
    clientReportId: "12345678-abcd-4000-8000-123456789abc",
    context: { route: "/simulator", round: 4 },
    ...overrides,
  };
}

function postRequest(body, {
  origin = ORIGIN,
  fetchSite = "same-origin",
  contentType = "application/json",
} = {}) {
  return new Request(`${ORIGIN}/api/bug-reports`, {
    method: "POST",
    headers: {
      Origin: origin,
      "Sec-Fetch-Site": fetchSite,
      "Content-Type": contentType,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("public bug reports reject cross-origin requests before storage", async () => {
  let storageCalls = 0;
  const handler = createBugReportPostHandler({
    createAdmin() {
      storageCalls += 1;
      throw new Error("storage must not be reached");
    },
    logger: { error() {} },
  });

  const response = await handler(postRequest(validPayload(), {
    origin: "https://attacker.example",
    fetchSite: "cross-site",
  }));

  assert.equal(response.status, 403);
  assert.equal(storageCalls, 0);
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("public bug reports validate and insert only canonical player fields", async () => {
  let inserted = null;
  const query = {
    insert(value) {
      inserted = value;
      return this;
    },
    select(fields) {
      assert.equal(fields, "report_number");
      return this;
    },
    async single() {
      return { data: { report_number: 42 }, error: null };
    },
  };
  const handler = createBugReportPostHandler({
    createAdmin: () => ({
      from(table) {
        assert.equal(table, "bug_reports");
        return query;
      },
    }),
    logger: { error() {} },
  });

  const response = await handler(postRequest(validPayload({
    priority: "critical",
    status: "fixed",
    approvedForFix: true,
  })));

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    saved: true,
    report: { number: 42 },
  });
  assert.deepEqual(inserted, {
    client_report_id: "12345678-abcd-4000-8000-123456789abc",
    surface: "simulator",
    summary: "Creature School remains at zero HP",
    description: "The defeated Creature School stays in the opponent ecosystem.",
    steps: "Attack the opposing Creature School until its HP reaches zero.",
    expected_behavior: "The school should move to the opponent discard pile.",
    impact: "can-continue",
    context: { route: "/simulator", round: 4 },
  });
});

test("public bug report retries return the original reference without duplicating the report", async () => {
  let tableCalls = 0;
  const insertQuery = {
    insert() { return this; },
    select() { return this; },
    async single() {
      return { data: null, error: { code: "23505" } };
    },
  };
  const duplicateQuery = {
    select(fields) {
      assert.equal(fields, "report_number");
      return this;
    },
    eq(field, value) {
      assert.equal(field, "client_report_id");
      assert.equal(value, "12345678-abcd-4000-8000-123456789abc");
      return this;
    },
    async maybeSingle() {
      return { data: { report_number: 42 }, error: null };
    },
  };
  const handler = createBugReportPostHandler({
    createAdmin: () => ({
      from(table) {
        assert.equal(table, "bug_reports");
        tableCalls += 1;
        return tableCalls === 1 ? insertQuery : duplicateQuery;
      },
    }),
    logger: { error() {} },
  });

  const response = await handler(postRequest(validPayload()));

  assert.equal(response.status, 200);
  assert.equal(tableCalls, 2);
  assert.deepEqual(await response.json(), {
    saved: true,
    duplicate: true,
    report: { number: 42 },
  });
});

test("public bug report request limits count UTF-8 bytes", async () => {
  let storageCalls = 0;
  const handler = createBugReportPostHandler({
    createAdmin() {
      storageCalls += 1;
      throw new Error("storage must not be reached");
    },
    logger: { error() {} },
  });
  const body = JSON.stringify(validPayload({
    description: "🐠".repeat(Math.ceil(BUG_REPORT_MAX_REQUEST_BYTES / 4)),
  }));
  assert.ok(new TextEncoder().encode(body).byteLength > BUG_REPORT_MAX_REQUEST_BYTES);

  const response = await handler(postRequest(body));

  assert.equal(response.status, 413);
  assert.equal(storageCalls, 0);
});
