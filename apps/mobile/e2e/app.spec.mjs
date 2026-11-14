import { test, expect } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  // The installed app serves its bundled files locally even without internet.
  // Restrict this preview in the same way: all external hosts are blocked.
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "127.0.0.1") return route.abort();
    return route.continue();
  });
});

test("home, pack opening, card inspection and settings survive a reload", async ({ page }, testInfo) => {
  const errors = [];
  const networkRequests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => networkRequests.push(request.url()));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Build a reef. Discover an ocean." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Let’s play" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("home.png"), fullPage: true });
  await page.getByRole("button", { name: "Collection", exact: false }).last().click();
  await page.getByRole("button", { name: "Open a pack" }).click();
  await expect(page.getByRole("dialog", { name: "Your discovery pack" })).toBeVisible();
  await expect(page.locator(".pack-reveal-cards img")).toHaveCount(3);
  const pack = await page.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem("searealm.mobile.v1")).values["searealm.collection.v1"]));
  expect(pack.packs.welcome.cardIds).toHaveLength(3);
  await page.screenshot({ path: testInfo.outputPath("pack.png") });
  await page.getByRole("button", { name: "Keep exploring" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Open a pack" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "View your latest pack" })).toBeVisible();
  const restored = await page.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem("searealm.mobile.v1")).values["searealm.collection.v1"]));
  expect(restored).toEqual(pack);
  await page.getByRole("searchbox", { name: "Find a card" }).fill("French Angelfish");
  await page.getByRole("button", { name: /Inspect French Angelfish/i }).click();
  await expect(page.getByRole("dialog", { name: "French Angelfish", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("checkbox", { name: "Reduce motion" }).check();
  await page.getByRole("combobox", { name: "Reading speed" }).selectOption("instant");
  await page.reload();
  await expect(page.getByRole("checkbox", { name: "Reduce motion" })).toBeChecked();
  await expect(page.getByRole("combobox", { name: "Reading speed" })).toHaveValue("instant");
  expect(errors).toEqual([]);
  expect(networkRequests.filter((url) => new URL(url).hostname !== "127.0.0.1" || url.includes("/api/"))).toEqual([]);
  expect(await page.locator("img").evaluateAll((images) => images.every((img) => img.complete && img.naturalWidth > 0))).toBe(true);
});

test("the bundled simulator and guided lessons launch without website services", async ({ page }, testInfo) => {
  const errors = [];
  const apiCalls = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (request.url().includes("/api/")) apiCalls.push(request.url()); });
  await page.goto("/#play");
  await expect(page.getByRole("heading", { name: "Choose your Decks" })).toBeVisible();
  await expect(page.getByText("Completed matches contribute anonymous game statistics.")).toHaveCount(0);
  await page.getByRole("button", { name: "Start Match", exact: true }).click();
  await expect(page.locator(".seapals-game-shell")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("match.png") });
  await page.goto("/#learn");
  await expect(page.getByRole("button", { name: /first reef/i }).first()).toBeVisible();
  await page.getByRole("button", { name: /first reef/i }).first().click();
  await page.getByRole("button", { name: "Start Lesson", exact: true }).click();
  await expect(page.locator(".seapals-embedded-lesson")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("lesson.png") });
  expect(errors).toEqual([]);
  expect(apiCalls).toEqual([]);
});

test("a started match survives a restart without changing its decks or opening coin", async ({ page }) => {
  await page.goto("/#play");
  await page.getByRole("button", { name: "Start Match", exact: true }).click();
  await page.getByRole("button", { name: /^Flip the opening coin/ }).click();
  await page.getByRole("button", { name: "Begin Setup", exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const device = JSON.parse(localStorage.getItem("searealm.mobile.v1"));
    return Boolean(device?.values?.["seapals.simulator-v2.resume.v1"]);
  })).toBe(true);
  const checkpoint = await page.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem("searealm.mobile.v1")).values["seapals.simulator-v2.resume.v1"]));
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Resume your previous game?" })).toBeVisible();
  await page.getByRole("button", { name: "Resume Game", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Resume your previous game?" })).toHaveCount(0);
  const restored = await page.evaluate(() => JSON.parse(JSON.parse(localStorage.getItem("searealm.mobile.v1")).values["seapals.simulator-v2.resume.v1"]));
  expect(restored.state.startingPlayer).toBe(checkpoint.state.startingPlayer);
  expect(restored.state.foundationDeck).toEqual(checkpoint.state.foundationDeck);
  expect(restored.state.palsDeck).toEqual(checkpoint.state.palsDeck);
});

test("completed lesson checkpoints recover exactly one earned pack", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Let’s play" })).toBeVisible();
  // A saved completion with an interrupted reward write must recover on boot.
  // This fixture is confined to the disposable test browser's app storage.
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("searealm.mobile.v1"));
    saved.values["seapals-simulator-v2-lessons-v2"] = JSON.stringify({ version: 4, completedLessonIds: ["first-reef", "not-a-lesson"] });
    localStorage.setItem("searealm.mobile.v1", JSON.stringify(saved));
  });
  await page.goto("/#collection");
  await page.reload();
  await expect(page.getByRole("button", { name: "Open a pack · 2", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Open a pack · 2", exact: true })).toBeVisible();
  const rewards = await page.evaluate(() => Object.keys(JSON.parse(JSON.parse(localStorage.getItem("searealm.mobile.v1")).values["searealm.collection.v1"]).packs));
  expect(rewards.sort()).toEqual(["lesson:first-reef", "welcome"]);
});
