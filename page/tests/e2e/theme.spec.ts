import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("a saved theme is applied before first paint, with no flash @subpath", async ({ page }) => {
  await page.goto("./");
  await page.evaluate(() => {
    const record: unknown = JSON.parse(localStorage.getItem("ws.settings") ?? "{}");
    localStorage.setItem("ws.settings", JSON.stringify({ ...Object(record), theme: "light" }));
  });
  // Record the theme the moment the document element exists, before any module runs.
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      Reflect.set(window, "__themeAtDcl", document.documentElement.dataset["theme"]);
    });
  });
  await page.reload();
  expect(await page.evaluate(() => Reflect.get(window, "__themeAtDcl"))).toBe("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
  expect(bg).toBe("rgb(234, 242, 252)");
});

test("an old ws.v1 theme from before the update still applies on the first load", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();
  await page.addInitScript(() => {
    if (localStorage.getItem("ws.settings") === null) localStorage.setItem("ws.v1.theme", "light");
  });
  await page.goto("./");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("ws.settings") ?? "{}").theme)).toBe("light");
  expect(await page.evaluate(() => localStorage.getItem("ws.v1.theme"))).toBeNull();
  await context.close();
});

test("dark is the default without a saved choice or system preference", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto("./");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await context.close();
});

test("the self-hosted fonts load", async ({ page }) => {
  await page.goto("./");
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return [document.fonts.check('600 20px "Space Grotesk"'), document.fonts.check('14px "JetBrains Mono"')];
  });
  expect(loaded).toEqual([true, true]);
});

for (const theme of ["dark", "light"] as const) {
  test(`axe finds no accessibility violations in the ${theme} theme`, async ({ page }) => {
    await page.goto("./");
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
    await page.waitForTimeout(700); // let the backdrop cross-fade finish
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
}
