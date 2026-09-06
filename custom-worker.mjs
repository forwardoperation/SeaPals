// The OpenNext worker is generated during `npm run cloudflare:build`.
// @ts-ignore
import openNextWorker from "./.open-next/worker.js";
import {
  canonicalSiteRedirectLocation,
  canonicalSiteRedirectPolicy,
  legacySiteRedirectLocation,
  legacySiteRedirectPolicy,
} from "./src/lib/siteRedirect.mjs";
import { enforceStoreCheckoutRateLimit } from "./src/lib/store/checkoutRateLimit.mjs";
import { reconcileOverdueInventoryReservations } from "./src/lib/store/inventoryReservationReconciler.mjs";
import { drainFulfillmentDueNotifications } from "./src/lib/store/fulfillmentDueNotificationDrain.mjs";
import { drainMerchantPurchaseNotifications } from "./src/lib/store/merchantOrderNotificationDrain.mjs";
import { drainPaQuarterlyReportEmail } from "./src/lib/store/paQuarterlyReportDrain.mjs";

export {
  BucketCachePurge,
  DOQueueHandler,
  DOShardedTagCache,
} from "./.open-next/worker.js";

export const STORE_NOTIFICATION_CRON = "*/5 * * * *";

function redirectResponse(location, policy) {
  return new Response(null, {
    status: policy.status,
    headers: {
      "Cache-Control": policy.cacheControl,
      Location: location,
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Strict-Transport-Security": "max-age=31536000",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function safeErrorCode(error) {
  const code = typeof error?.code === "string" ? error.code : "unknown";
  return /^[A-Za-z0-9_-]{1,100}$/.test(code) ? code : "unknown";
}

export default {
  async fetch(request, environment, context) {
    const canonicalRedirectLocation = canonicalSiteRedirectLocation(
      request,
      environment,
    );
    if (canonicalRedirectLocation) {
      return redirectResponse(
        canonicalRedirectLocation,
        canonicalSiteRedirectPolicy(),
      );
    }

    const redirectLocation = legacySiteRedirectLocation(request, environment);
    if (redirectLocation) {
      return redirectResponse(
        redirectLocation,
        legacySiteRedirectPolicy(environment),
      );
    }

    const blockedResponse = await enforceStoreCheckoutRateLimit({
      request,
      environment,
    });
    if (blockedResponse) {
      const log = JSON.stringify({
        message: "Store checkout request blocked",
        status: blockedResponse.status,
        path: "/api/store/checkout",
      });
      if (blockedResponse.status >= 500) console.error(log);
      else console.warn(log);
      return blockedResponse;
    }

    return openNextWorker.fetch(request, environment, context);
  },

  async scheduled(controller, environment) {
    if (controller?.cron !== STORE_NOTIFICATION_CRON) {
      controller?.noRetry?.();
      return;
    }

    const [
      notificationResult,
      dueReminderResult,
      reservationResult,
      paQuarterlyReportResult,
    ] =
      await Promise.allSettled([
        drainMerchantPurchaseNotifications({ environment }),
        drainFulfillmentDueNotifications({
          environment,
          now: new Date(controller.scheduledTime),
          currentTime: () => new Date(),
        }),
        reconcileOverdueInventoryReservations({ environment }),
        drainPaQuarterlyReportEmail({
          environment,
          now: new Date(controller.scheduledTime),
        }),
      ]);

    if (notificationResult.status === "fulfilled") {
      console.log(
        JSON.stringify({
          message: "Store merchant notification cron completed",
          ...notificationResult.value,
        })
      );
    } else {
      console.error(
        JSON.stringify({
          message: "Store merchant notification cron failed",
          code: safeErrorCode(notificationResult.reason),
          summary: notificationResult.reason?.summary ?? null,
        })
      );
    }

    if (dueReminderResult.status === "fulfilled") {
      console.log(
        JSON.stringify({
          message: "Store fulfillment reminder cron completed",
          ...dueReminderResult.value,
        })
      );
    } else {
      console.error(
        JSON.stringify({
          message: "Store fulfillment reminder cron failed",
          code: safeErrorCode(dueReminderResult.reason),
          summary: dueReminderResult.reason?.summary ?? null,
        })
      );
    }

    if (reservationResult.status === "fulfilled") {
      console.log(
        JSON.stringify({
          message: "Store inventory reconciliation cron completed",
          ...reservationResult.value,
        })
      );
    } else {
      console.error(
        JSON.stringify({
          message: "Store inventory reconciliation cron failed",
          code: safeErrorCode(reservationResult.reason),
          summary: reservationResult.reason?.summary ?? null,
        })
      );
    }

    if (paQuarterlyReportResult.status === "fulfilled") {
      console.log(
        JSON.stringify({
          message: "PA quarterly sales-tax report cron completed",
          ...paQuarterlyReportResult.value,
        })
      );
    } else {
      console.error(
        JSON.stringify({
          message: "PA quarterly sales-tax report cron failed",
          code: safeErrorCode(paQuarterlyReportResult.reason),
        })
      );
    }

    if (
      notificationResult.status === "rejected" ||
      dueReminderResult.status === "rejected" ||
      reservationResult.status === "rejected" ||
      paQuarterlyReportResult.status === "rejected"
    ) {
      throw (
        notificationResult.status === "rejected"
          ? notificationResult.reason
          : dueReminderResult.status === "rejected"
            ? dueReminderResult.reason
            : reservationResult.status === "rejected"
              ? reservationResult.reason
              : paQuarterlyReportResult.reason
      );
    }
  },
};
