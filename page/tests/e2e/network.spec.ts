// SCOPE 36: everything is self-hosted. While the page loads, and the intro plays, the only
// requests are to the page's own origin (the owner's webhook does not exist until R3).
import { expect, test } from "@playwright/test";

test("the page, and its intro only ever talk to their own origin @subpath", async ({ page, baseURL }) => {
  test.setTimeout(90_000);
  const origin = new URL(baseURL ?? "http://127.0.0.1").origin;
  const outside: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith("data:") && !url.startsWith("blob:")) outside.push(url);
  });
  await page.goto("./?intro=full&seed=4");
  await expect(page.locator("html")).toHaveAttribute("data-stage", "live", { timeout: 12000 });
  await page.getByRole("switch", { name: /^Skills/ }).check();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("button", { name: "Connect your AI agent" }).click();
  await page.getByRole("radio", { name: /Claude/ }).click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Shut down" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-stage", "down", { timeout: 8000 });
  expect(outside).toEqual([]);
});
