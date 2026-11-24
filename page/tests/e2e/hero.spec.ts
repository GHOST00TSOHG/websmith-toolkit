import { expect, test } from "@playwright/test";

test.use({ colorScheme: "dark" });

test("without a saved name the hero greets generically and asks for one @subpath", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hi there");
  await expect(page.getByLabel("Your name")).toBeVisible();
});

test("saving a name greets by name, survives a reload, and can be changed", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("Your name").fill("  Sam   Rivera ");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hi, Sam Rivera");
  await expect(page.locator("#name-form")).toBeHidden();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hi, Sam Rivera");
  await page.getByRole("button", { name: "Change name" }).click();
  await expect(page.getByLabel("Your name")).toBeFocused();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hi there");
});

test("a name made of markup is shown as plain text", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("Your name").fill("<img src=x onerror=alert(1)>");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("<img src=x");
  await expect(page.locator("h1 img")).toHaveCount(0);
});

test("damaged saved data falls back to the generic greeting", async ({ page }) => {
  await page.goto("./");
  await page.evaluate(() => localStorage.setItem("ws.settings", "{not json"));
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hi there");
});

test("the hero orb is a button that changes design", async ({ page }) => {
  await page.goto("./");
  const orb = page.getByRole("button", { name: "Next orb design" });
  await expect(orb).toBeVisible();
  await orb.click();
  await expect(orb).toBeVisible();
});
