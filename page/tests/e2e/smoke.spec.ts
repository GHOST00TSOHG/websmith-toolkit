import { expect, test } from "@playwright/test";

test("the page loads with its greeting and a strict CSP @subpath", async ({ page }) => {
  const failures: string[] = [];
  page.on("requestfailed", (r) => failures.push(r.url()));
  page.on("response", (r) => {
    if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hi there");
  await expect(page.locator("html.js")).toHaveCount(1);
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(csp).toContain("default-src 'self'");
  expect(failures).toEqual([]);
  expect(errors).toEqual([]);
});
