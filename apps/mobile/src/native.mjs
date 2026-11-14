import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { App } from "@capacitor/app";
import { MOBILE_STORAGE_KEY, parseStoredValues, createDurableStorage } from "./storage.mjs";

export async function prepareDeviceStorage() {
  const native = Capacitor.isNativePlatform();
  const raw = native
    ? (await Preferences.get({ key: MOBILE_STORAGE_KEY })).value
    : window.localStorage.getItem(MOBILE_STORAGE_KEY);
  const storage = createDurableStorage(parseStoredValues(raw), async (value) => {
    if (native) await Preferences.set({ key: MOBILE_STORAGE_KEY, value });
    else window.localStorage.setItem(MOBILE_STORAGE_KEY, value);
  });
  const save = () => { void storage.flush().catch(() => {}); };
  document.addEventListener("visibilitychange", save);
  window.addEventListener("pagehide", save);
  if (native) await App.addListener("appStateChange", save);
  return storage;
}
