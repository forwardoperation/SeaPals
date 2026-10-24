import { sanitizeBugReportContext } from "./bugReports.mjs";

export const BUG_REPORT_SUBMISSION_TIMEOUT_MS = 30_000;

export async function submitBugReport(payload, {
  fetchImpl = globalThis.fetch,
  timeoutMs = BUG_REPORT_SUBMISSION_TIMEOUT_MS,
} = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl("/api/bug-reports", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        ...payload,
        context: sanitizeBugReportContext(payload.context),
      }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error(result?.error ?? "The report could not be saved. Please try again.");
    const reportNumber = Number(result?.report?.number);
    if (result?.saved !== true || !Number.isSafeInteger(reportNumber) || reportNumber < 1) {
      throw new Error("The report receipt could not be confirmed. Please try again.");
    }
    return result;
  } catch (error) {
    if (timedOut) {
      throw new Error("The report took too long to send. Your text is still here; please try again.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
