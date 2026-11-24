import { expect, test } from "@playwright/test";

test("the toggle is a real switch input with a tap target of at least 44px", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  const input = page.locator(".daynight-input");
  await expect(input).toHaveAttribute("type", "checkbox");
  await expect(input).toHaveAttribute("switch", "");
  await expect(input).toHaveAttribute("role", "switch");
  const target = await page.locator("label.daynight").boundingBox();
  expect(target?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(target?.width ?? 0).toBeGreaterThanOrEqual(44);
  await expect(page.locator(".dn-stars i")).toHaveCount(7);
  await expect(page.locator(".dn-rays line")).toHaveCount(8);
  expect(errors).toEqual([]);
});
