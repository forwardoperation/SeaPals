// The OpenNext worker is generated during `npm run cloudflare:build`.
// @ts-ignore
import openNextWorker from "./.open-next/worker.js";
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
  fetch: openNextWorker.fetch,

  async scheduled(controller, environment) {
    if (controller?.cron !== STORE_NOTIFICATION_CRON) {
      controller?.noRetry?.();
      return;
    }

    try {
      const summary = await drainMerchantPurchaseNotifications({ environment });
      console.log("Store merchant notification cron completed", summary);
    } catch (error) {
      console.error(
        "Store merchant notification cron failed",
        safeErrorCode(error),
        error?.summary ?? null
      );
      throw error;
    }
  },
};
