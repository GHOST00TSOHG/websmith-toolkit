// R5: the Connected pill shows the real time of the last sync, in the visitor's local time, and moves when
// a new sync happens. It used to show the toolkit's last commit time, baked into the HTML at build time.
import { expect, test } from "@playwright/test";

test.use({ timezoneId: "America/New_York", locale: "en-US", colorScheme: "dark" });

/** What another tab does when it syncs: rewrites the settings record; this tab gets a storage event. */
function syncFromAnotherTab(at: string): void {
  const record: unknown = JSON.parse(localStorage.getItem("ws.settings") ?? "{}");
  localStorage.setItem("ws.settings", JSON.stringify({ ...Object(record), lastSync: at }));
  window.dispatchEvent(new StorageEvent("storage", { key: "ws.settings" }));
}

test("the HTML carries no baked-in sync time @subpath", async ({ request }) => {
  const html = await (await request.get("./")).text();
  expect(html).toMatch(/<time class="sync-time label" id="sync-time" data-sha="[0-9a-f]+"><\/time>/);
});

test("the pill shows this load's sync time, not a stale one, and a bot reply updates it @subpath", async ({ page }) => {
  // The owner's bot, mocked: it answers Find my login. The key is a test value, never a real one.
  await page.route("https://bot.example.test/hook", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ v: 1, ok: true, data: { claude: "signed-in", codex: "not-installed" } }) }),
  );
  // A stale value from an earlier visit, kept in the old ws.v1 key (migrated on load).
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seeded") === null) {
      sessionStorage.setItem("seeded", "1");
      localStorage.setItem("ws.v1.lastSync", "2026-11-24T12:27:50.000Z");
    }
  });
  await page.clock.install({ time: new Date("2026-11-24T18:05:00Z") }); // 1:05 PM in New York
  await page.goto("./?intro=off");
  const time = page.locator("#sync-time");
  await expect(time).toHaveText("1:05 PM");
  await expect(time).toHaveAttribute("datetime", /^2026-11-24T18:05:00\.\d{3}Z$/);

  await page.clock.runFor(7 * 60_000); // seven minutes later
  await page.locator("#settings-open").click();
  await page.getByText("Connect your bot").click();
  await page.getByLabel("Webhook address").fill("https://bot.example.test/hook");
  await page.getByLabel("Key").fill("test-key-not-real");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Find my login" }).click();
  await expect(page.getByText("Found Claude, connect?")).toBeVisible();
  await expect(time).toHaveText("1:12 PM");
  await page.keyboard.press("Escape");

  // Another tab syncing updates this one too.
  await page.evaluate(syncFromAnotherTab, "2026-11-24T18:30:00.000Z");
  await expect(time).toHaveText("1:30 PM");
});

test("a sync on another day shows the date too", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-24T18:05:00Z") });
  await page.goto("./?intro=off");
  await page.evaluate(syncFromAnotherTab, "2026-11-22T17:09:00.000Z");
  await expect(page.locator("#sync-time")).toHaveText("Nov 22, 12:09 PM");
});
