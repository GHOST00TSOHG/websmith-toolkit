import { expect, test } from "@playwright/test";

// With no saved choice the page follows the system, so these tests start from a dark system.
test.use({ colorScheme: "dark" });

test("clicking the toggle flips the theme, remembers it, and reveals the page @subpath", async ({ page }) => {
  await page.goto("./");
  const toggle = page.getByRole("switch", { name: "Dark mode" });
  await expect(toggle).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page.locator("label.daynight").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(toggle).not.toBeChecked();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("ws.settings") ?? "{}").theme)).toBe("light");
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe("rgb(234, 242, 252)");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#eaf2fc");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("switch", { name: "Dark mode" })).not.toBeChecked();
});

test("the Space key flips the theme from the keyboard", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("switch", { name: "Dark mode" }).focus();
  await page.keyboard.press("Space");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.keyboard.press("Space");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("the knob glides with the spring curve instead of snapping", async ({ page }) => {
  await page.goto("./");
  const knob = page.locator(".daynight-knob");
  const timing = await knob.evaluate((el) => getComputedStyle(el).transitionTimingFunction);
  expect(timing).toContain("linear(");
  const before = await knob.evaluate((el) => el.getBoundingClientRect().left);
  await page.locator("label.daynight").click();
  await expect.poll(() => knob.evaluate((el) => el.getBoundingClientRect().left)).toBeLessThan(before - 20);
});

test("with reduced motion the theme cross-fades without a reveal", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark", reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto("./");
  await page.locator("label.daynight").click();
  await expect(page.locator("html")).toHaveClass(/theme-fading/);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await context.close();
});
