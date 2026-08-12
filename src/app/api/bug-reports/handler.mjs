import { validateBugReportSubmission } from "../../../lib/bugReports.mjs";
import { isTrustedSameOriginMutation } from "../../../lib/sameOriginMutation.mjs";

export const BUG_REPORT_MAX_REQUEST_BYTES = 32_000;

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export function createBugReportPostHandler({
  createAdmin,
  isTrustedMutation = isTrustedSameOriginMutation,
  logger = console,
} = {}) {
  if (typeof createAdmin !== "function") {
    throw new TypeError("createAdmin must be provided.");
  }

  return async function handleBugReportPost(request) {
    if (!isTrustedMutation(request)) {
      return json({ error: "Bug reports must be sent from SeaPals." }, 403);
    }

    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return json({ error: "Bug reports must use JSON." }, 415);
    }

    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(contentLength) && contentLength > BUG_REPORT_MAX_REQUEST_BYTES) {
      return json({ error: "That bug report is too large." }, 413);
    }

    let rawPayload;
    try {
      rawPayload = await request.text();
    } catch {
      return json({ error: "That bug report could not be read." }, 400);
    }

    if (new TextEncoder().encode(rawPayload).byteLength > BUG_REPORT_MAX_REQUEST_BYTES) {
      return json({ error: "That bug report is too large." }, 413);
    }

    let payload;
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      return json({ error: "That bug report could not be read." }, 400);
    }

    const validation = validateBugReportSubmission(payload);
    if (!validation.ok) return json({ error: validation.error }, 422);

    const report = validation.value;
    try {
      const supabase = createAdmin();
      const { data, error } = await supabase
        .from("bug_reports")
        .insert({
          client_report_id: report.clientReportId,
          surface: report.surface,
          summary: report.summary,
          description: report.description,
          steps: report.steps,
          expected_behavior: report.expectedBehavior,
          impact: report.impact,
          context: report.context,
        })
        .select("report_number")
        .single();

      if (!error) {
        return json({
          saved: true,
          report: { number: data.report_number },
        }, 201);
      }

      if (error.code === "23505") {
        const duplicate = await supabase
          .from("bug_reports")
          .select("report_number")
          .eq("client_report_id", report.clientReportId)
          .maybeSingle();
        if (!duplicate.error && duplicate.data) {
          return json({
            saved: true,
            duplicate: true,
            report: { number: duplicate.data.report_number },
          });
        }
      }

      logger?.error?.("Bug report insert failed", error);
      return json({ error: "The report could not be saved. Please try again." }, 502);
    } catch (error) {
      logger?.error?.("Bug report storage failed", error);
      return json({ error: "Bug reporting is temporarily unavailable." }, 500);
    }
  };
}
