import assert from "node:assert/strict";
import test from "node:test";
import { BUG_REPORT_MAX_REQUEST_BYTES } from "../app/api/bug-reports/handler.mjs";
import { submitBugReport } from "./submitBugReport.mjs";

function reportPayload(overrides = {}) {
  return {
    surface: "simulator",
    summary: "Lost Zone card cannot be retrieved",
    description: "Choosing the card in the Lost Zone does not add it to my hand.",
    clientReportId: "12345678-abcd-4000-8000-123456789abc",
    context: { route: "/simulator", round: 4 },
    ...overrides,
  };
}

test("bug submissions bound diagnostics before the API request limit is applied", async () => {
  const payload = reportPayload({
    context: {
      route: "/simulator",
      accountId: "private-account",
      events: Array.from({ length: 100 }, () => "x".repeat(500)),
    },
  });
  assert.ok(new TextEncoder().encode(JSON.stringify(payload)).byteLength > BUG_REPORT_MAX_REQUEST_BYTES);
  const result = await submitBugReport(payload, {
    async fetchImpl(url, options) {
      assert.equal(url, "/api/bug-reports");
      assert.equal(options.method, "POST");
      assert.equal(options.credentials, "same-origin");
      assert.equal(options.headers["Content-Type"], "application/json");
      assert.ok(new TextEncoder().encode(options.body).byteLength < BUG_REPORT_MAX_REQUEST_BYTES);
      const sent = JSON.parse(options.body);
      assert.deepEqual(sent.context, { route: "/simulator", diagnosticsTruncated: true });
      assert.equal(sent.description, payload.description);
      assert.equal(sent.clientReportId, payload.clientReportId);
      return Response.json({ saved: true, report: { number: 42 } }, { status: 201 });
    },
  });
  assert.equal(result.report.number, 42);
  assert.equal(payload.context.events.length, 100, "sending must not mutate the frozen game snapshot");
});

test("a timed-out bug submission aborts and can retry with the same report id", async () => {
  const payload = reportPayload();
  let firstRequest;
  await assert.rejects(submitBugReport(payload, {
    timeoutMs: 5,
    fetchImpl(url, options) {
      firstRequest = options;
      return new Promise((resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      });
    },
  }), /took too long.*text is still here.*try again/);
  assert.equal(firstRequest.signal.aborted, true);
  const result = await submitBugReport(payload, {
    async fetchImpl(url, options) {
      assert.equal(options.signal.aborted, false);
      assert.equal(JSON.parse(options.body).clientReportId, JSON.parse(firstRequest.body).clientReportId);
      return Response.json({ saved: true, duplicate: true, report: { number: 42 } });
    },
  });
  assert.equal(result.duplicate, true);
  assert.equal(result.report.number, 42);
});

test("bug submission keeps server errors visible without inventing a receipt", async () => {
  await assert.rejects(submitBugReport(reportPayload(), {
    async fetchImpl() {
      return Response.json({ error: "Bug reporting is temporarily unavailable." }, { status: 500 });
    },
  }), /Bug reporting is temporarily unavailable/);

  for (const response of [
    new Response("<html>Temporarily unavailable</html>", { status: 200 }),
    Response.json({ saved: true }),
    Response.json({ saved: true, report: { number: 0 } }),
    Response.json({ saved: false, report: { number: 42 } }),
  ]) {
    await assert.rejects(submitBugReport(reportPayload(), {
      async fetchImpl() { return response; },
    }), /receipt could not be confirmed/);
  }
});
