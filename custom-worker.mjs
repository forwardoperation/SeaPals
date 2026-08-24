// The OpenNext worker is generated during `npm run cloudflare:build`.
// @ts-ignore
import openNextWorker from "./.open-next/worker.js";
import {
  legacySiteRedirectLocation,
  legacySiteRedirectPolicy,
} from "./src/lib/siteRedirect.mjs";
import { enforceStoreCheckoutRateLimit } from "./src/lib/store/checkoutRateLimit.mjs";
import { reconcileOverdueInventoryReservations } from "./src/lib/store/inventoryReservationReconciler.mjs";
import { drainMerchantPurchaseNotifications } from "./src/lib/store/merchantOrderNotificationDrain.mjs";

export {
  BucketCachePurge,
  DOQueueHandler,
  DOShardedTagCache,
} from "./.open-next/worker.js";

export const STORE_NOTIFICATION_CRON = "*/5 * * * *";

function safeErrorCode(error) {
  const code = typeof error?.code === "string" ? error.code : "unknown";
  return /^[A-Za-z0-9_-]{1,100}$/.test(code) ? code : "unknown";
}

export default {
  async fetch(request, environment, context) {
    const redirectLocation = legacySiteRedirectLocation(request, environment);
    if (redirectLocation) {
      const redirectPolicy = legacySiteRedirectPolicy(environment);
      return new Response(null, {
        status: redirectPolicy.status,
        headers: {
          "Cache-Control": redirectPolicy.cacheControl,
          Location: redirectLocation,
          "Referrer-Policy": "strict-origin-when-cross-origin",
          "Strict-Transport-Security": "max-age=31536000",
          "X-Content-Type-Options": "nosniff",
        },
      });
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

    const [notificationResult, reservationResult] = await Promise.allSettled([
      drainMerchantPurchaseNotifications({ environment }),
      reconcileOverdueInventoryReservations({ environment }),
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

    if (
      notificationResult.status === "rejected" ||
      reservationResult.status === "rejected"
    ) {
      throw (
        notificationResult.status === "rejected"
          ? notificationResult.reason
          : reservationResult.reason
      );
    }
  },
};
