// First run, Settings and Find my login. Everything stays on this device; the only network call is the
// owner's own webhook (mocked here with test values, never a real key).
import { expect, test, type Page } from "@playwright/test";

test.use({ colorScheme: "dark" });
const BOT = "https://bot.example.test/hook";

async function mockBot(page: Page, data: unknown): Promise<string[]> {
  const bodies: string[] = [];
  await page.route(BOT, async (route) => {
    bodies.push(route.request().postData() ?? "");
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ v: 1, ok: true, data }) });
  });
  return bodies;
}

test("the first-run sheet asks for a name and theme; Skip keeps the neutral greeting @subpath", async ({ page }) => {
  await page.goto("./?firstrun=1");
  const sheet = page.getByRole("dialog", { name: "Welcome" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel("Your name")).toBeFocused();
  await sheet.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hi there");
  await page.reload();
  await expect(page.getByRole("dialog", { name: "Welcome" })).toBeHidden();
});

test("Done saves the name for the greeting, and the sheet reopens from Settings", async ({ page }) => {
  await page.goto("./?firstrun=1");
  const sheet = page.getByRole("dialog", { name: "Welcome" });
  await sheet.getByLabel("Your name").fill("Robin");
  await sheet.getByLabel("Light").check();
  await sheet.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hi, Robin");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.locator("#settings-open").click();
  await page.getByRole("button", { name: "First-time setup" }).click();
  await expect(page.getByRole("dialog", { name: "Welcome" }).getByLabel("Your name")).toHaveValue("Robin");
});

test("the webhook must be https (http only for localhost) and is never put in the URL", async ({ page }) => {
  await page.goto("./");
  await page.locator("#settings-open").click();
  await page.getByText("Connect your bot").click();
  await page.getByLabel("Webhook address").fill("http://bot.example.test/hook");
  await page.getByLabel("Key").fill("test-key-not-real");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/https:\/\//)).toBeVisible();
  await page.getByLabel("Webhook address").fill(BOT);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved on this device.")).toBeVisible();
  expect(page.url()).not.toContain("test-key");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("ws.settings") ?? "{}").webhook);
  expect(stored).toEqual({ url: BOT, key: "test-key-not-real" });
});

test("Find my login is opt-in: nothing is sent or ticked before the tap", async ({ page }) => {
  const bodies = await mockBot(page, { claude: "signed-in", codex: "signed-in" });
  await page.addInitScript((url) => {
    localStorage.setItem("ws.settings", JSON.stringify({ schemaVersion: 2, firstRunDone: true, webhook: { url, key: "test-key-not-real" } }));
  }, BOT);
  await page.goto("./");
  await page.locator("#settings-open").click();
  await expect(page.locator(".sheet input:checked")).toHaveCount(0);
  expect(bodies).toHaveLength(0);
  await page.getByRole("button", { name: "Find my login" }).click();
  await expect(page.getByText("Found Claude, connect?")).toBeVisible();
  await expect(page.getByText("Found Codex, connect?")).toBeVisible();
  expect(bodies).toHaveLength(1);
  expect(JSON.parse(bodies[0] ?? "{}")).toMatchObject({ v: 1, op: "find-my-login" });
  expect(bodies[0]).not.toContain("test-key"); // the key is only in the Authorization header
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("ws.settings") ?? "{}").agents)).toEqual([]);
  await page.getByRole("button", { name: "Connect", exact: true }).first().click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("ws.settings") ?? "{}").agents)).toEqual(["claude"]);
});

test("with nothing signed in, it asks about Terminal, No has focus, and Yes only shows a command", async ({ page }) => {
  await page.goto("./");
  await page.locator("#settings-open").click();
  await page.getByRole("button", { name: "Find my login" }).click();
  await expect(page.getByText(/find-my-login helper/)).toBeVisible(); // no webhook: the message for the bot
  await page.getByLabel("Your bot's reply").fill('{"claude":"signed-out","codex":"not-installed"}');
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByText("Connect through Terminal?")).toBeVisible();
  await expect(page.getByRole("button", { name: "No", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await page.getByRole("button", { name: "Codex", exact: true }).click();
  await expect(page.getByText("codex login")).toBeVisible();
});

test("a pasted reply that is not the helper line is refused", async ({ page }) => {
  await page.goto("./");
  await page.locator("#settings-open").click();
  await page.getByRole("button", { name: "Find my login" }).click();
  await page.getByLabel("Your bot's reply").fill('{"claude":"<img src=x>"}');
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.getByText("That is not the Find my login line.")).toBeVisible();
});

test("Clear my data removes only this page's keys, after a confirm, and starts fresh", async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded") !== null) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("ws.settings", JSON.stringify({ schemaVersion: 2, name: "Robin", firstRunDone: true }));
    localStorage.setItem("another.site", "keep me");
  });
  await page.goto("./");
  await page.locator("#settings-open").click();
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Clear my data" }).click();
  await page.waitForLoadState("load");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hi there");
  expect(await page.evaluate(() => localStorage.getItem("another.site"))).toBe("keep me");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("ws.settings") ?? "{}").firstRunDone)).toBe(false);
});

test("the footer carries the privacy note", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("#privacy-note")).toHaveText(/stays on this device.*only talks to the webhook you paste.*No analytics, no cookies, no tracking/);
});
