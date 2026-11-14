import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    // Playwright creates its own temporary profile. Never attach to a user's
    // running Chrome, CDP port, cookies, tabs, or profile directory.
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "phone", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "tablet", use: { viewport: { width: 1024, height: 768 }, hasTouch: true } },
  ],
});
