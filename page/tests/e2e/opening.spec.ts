// The opening: one sweep on one canvas over a static veil, then the page. Skippable, freed when done,
// never under reduced motion, and every heavy layer waits for it.
import { expect, test } from "@playwright/test";

test.use({ colorScheme: "dark", viewport: { width: 1280, height: 800 } });

test("the opening sweeps, reveals the page and frees its canvas @subpath", async ({ page }) => {
  await page.goto("./?intro=full&seed=2");
  await expect(page.locator("html")).toHaveAttribute("data-stage", "opening");
  await expect(page.locator("canvas.opening-canvas")).toHaveCount(1);
  // While it runs it is the only canvas: the orb and the cloth wait their turn.
  expect(await page.locator("canvas").count()).toBe(1);
  await expect(page.locator("html")).toHaveAttribute("data-stage", "live", { timeout: 6000 });
  await expect(page.locator("canvas.opening-canvas")).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveClass(/opening/);
  await expect(page.locator(".opening-veil")).toBeHidden();
  await expect(page.locator("canvas.orb-canvas")).toHaveCount(1, { timeout: 6000 }); // the staged layers follow
});

test("a tap skips straight to the reveal", async ({ page }) => {
  await page.goto("./?intro=full&seed=2");
  await expect(page.locator("canvas.opening-canvas")).toHaveCount(1);
  await page.mouse.click(40, 600);
  await expect(page.locator("canvas.opening-canvas")).toHaveCount(0, { timeout: 1500 });
  await expect(page.locator("html")).toHaveAttribute("data-stage", "live");
});

test("reduced motion never gets the opening, even when asked for", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", baseURL: test.info().project.use.baseURL ?? "" });
  const page = await context.newPage();
  await page.goto("./?intro=full");
  await expect(page.locator("html")).toHaveAttribute("data-intro", "off");
  await expect(page.locator("html")).not.toHaveClass(/opening/);
  await expect(page.locator(".opening-veil")).toBeHidden();
  await page.waitForTimeout(300);
  await expect(page.locator("canvas.opening-canvas")).toHaveCount(0);
  await context.close();
});

test("Wake plays the opening again", async ({ page }) => {
  await page.goto("./?intro=off");
  await page.getByRole("button", { name: "Shut down" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-stage", "down");
  await page.getByRole("button", { name: "Wake" }).click();
  await expect(page.locator("canvas.opening-canvas")).toHaveCount(1);
  await expect(page.locator("html")).toHaveAttribute("data-stage", "live", { timeout: 5000 });
  await expect(page.locator("canvas.opening-canvas")).toHaveCount(0);
});

test("if the page script never runs, the veil steps aside on its own", async ({ page }) => {
  await page.route(/assets\/index-[^/]*\.js$/, (route) => route.abort());
  await page.goto("./?intro=full");
  await expect(page.locator("html")).toHaveClass(/opening/); // boot.js put the veil up
  await expect(page.locator(".opening-veil")).toBeVisible();
  await expect(page.locator(".opening-veil")).toBeHidden({ timeout: 7000 });
});
