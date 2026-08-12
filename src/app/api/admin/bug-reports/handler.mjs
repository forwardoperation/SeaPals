import {
  cleanBugReportText,
  validateBugReportAdminPatch,
} from "../../../../lib/bugReports.mjs";

const REPORT_FIELDS = [
  "id",
  "report_number",
  "surface",
  "summary",
  "description",
  "steps",
  "expected_behavior",
  "impact",
  "context",
  "priority",
  "status",
  "approved_for_fix",
  "approved_at",
  "admin_notes",
  "submitted_at",
  "updated_at",
  "resolved_at",
].join(", ");

function constantTimeTokenEqual(first, second) {
  const a = String(first ?? "");
  const b = String(second ?? "");
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);

  for (let index = 0; index < length; index += 1) {
    difference |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export function createAdminBugReportHandlers({
  createAdmin,
  getConfiguredToken = () => process.env.BUG_REPORT_ADMIN_TOKEN,
  now = () => new Date(),
  logger = console,
} = {}) {
  if (typeof createAdmin !== "function") {
    throw new TypeError("createAdmin must be provided.");
  }

  function isAuthorized(request) {
    const configuredToken = getConfiguredToken()?.trim();
    const providedToken = request.headers.get("x-admin-token")?.trim();
    return Boolean(
      configuredToken?.length >= 32
        && providedToken
        && constantTimeTokenEqual(configuredToken, providedToken)
    );
  }

  async function getBugReports(request) {
    if (!isAuthorized(request)) return json({ error: "Unauthorized." }, 401);

    try {
      const supabase = createAdmin();
      const { data, error } = await supabase
        .from("bug_reports")
        .select(REPORT_FIELDS)
        .order("submitted_at", { ascending: false })
        .limit(500);

      if (error) {
        logger?.error?.("Admin bug report load failed", error);
        return json({ error: "Bug reports could not be loaded." }, 502);
      }

      return json({ reports: data ?? [] });
    } catch (error) {
      logger?.error?.("Admin bug report storage failed", error);
      return json({ error: "Bug reports are temporarily unavailable." }, 500);
    }
  }

  async function patchBugReport(request) {
    if (!isAuthorized(request)) return json({ error: "Unauthorized." }, 401);

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ error: "Invalid bug report update." }, 400);
    }

    const id = cleanBugReportText(payload?.id, 80);
    const expectedUpdatedAt = cleanBugReportText(payload?.expectedUpdatedAt, 80);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return json({ error: "Invalid bug report id." }, 400);
    }
    if (!expectedUpdatedAt || !Number.isFinite(Date.parse(expectedUpdatedAt))) {
      return json({ error: "Refresh the list before updating this report." }, 400);
    }

    const validation = validateBugReportAdminPatch(payload, now());
    if (!validation.ok) return json({ error: validation.error }, 400);

    try {
      const supabase = createAdmin();
      const { data, error } = await supabase
        .from("bug_reports")
        .update(validation.value)
        .eq("id", id)
        .eq("updated_at", expectedUpdatedAt)
        .select(REPORT_FIELDS)
        .maybeSingle();

      if (error) {
        logger?.error?.("Admin bug report update failed", error);
        return json({ error: "The bug report update could not be saved." }, 502);
      }
      if (!data) {
        return json({
          error: "This report changed in another review session. Refresh the list before editing it.",
        }, 409);
      }

      return json({ saved: true, report: data });
    } catch (error) {
      logger?.error?.("Admin bug report storage failed", error);
      return json({ error: "The bug report update could not be saved." }, 500);
    }
  }

  return {
    GET: getBugReports,
    PATCH: patchBugReport,
  };
}
