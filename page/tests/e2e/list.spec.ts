import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { parseManifest } from "../../src/core/manifest.ts";

const parsed = parseManifest(JSON.parse(readFileSync("src/generated/toolkit.manifest.json", "utf8")));
if (!parsed.ok) throw new Error(parsed.error);
const manifest = parsed.value;
const kindCount = (kind: string) => manifest.items.filter((i) => i.kind === kind).length;
const groupCount = (group: string) => manifest.items.filter((i) => i.group === group).length;
const visible = "li.row:not([hidden])";

test.use({ colorScheme: "dark" });

test("every toolkit item is one list row with a name, a short description and a kind @subpath", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("li.row")).toHaveCount(manifest.items.length);
  await expect(page.locator("article, .card")).toHaveCount(0);
  for (const kind of ["skill", "kit", "animation", "motion", "installer"]) {
    await expect(page.locator(`li.row[data-kind="${kind}"]`)).toHaveCount(kindCount(kind));
  }
  const descs = await page.locator(".row-desc").allTextContents();
  expect(descs).toEqual(manifest.items.map((i) => i.oneLiner));
  await expect(page.locator(".list-head")).toHaveText(/Name\s*Description\s*Kind/);
});

test("rows are compact on desktop and touch-sized on a phone", async ({ browser }) => {
  const desk = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p1 = await desk.newPage();
  await p1.goto("./");
  const deskHeights = await p1.locator(".row-line").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  expect(Math.max(...deskHeights)).toBeLessThanOrEqual(30);
  await desk.close();
  const phone = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
  const p2 = await phone.newPage();
  await p2.goto("./");
  const phoneHeights = await p2.locator(".row-line").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  expect(Math.min(...phoneHeights)).toBeGreaterThanOrEqual(44);
  await expect(p2.locator(".list-head")).toBeHidden();
  await phone.close();
});

test("the list is in the HTML before any script runs", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("./");
  await expect(page.locator("li.row")).toHaveCount(manifest.items.length);
  await expect(page.locator(".row-name").first()).toBeVisible();
  await context.close();
});

test("nothing in a row moves on hover", async ({ page }) => {
  await page.goto("./");
  const row = page.locator(".row-line").nth(3);
  await row.hover();
  const t = await row.evaluate((el) => [getComputedStyle(el).transform, el.getAnimations({ subtree: true }).length]);
  expect(t).toEqual(["none", 0]);
});

test("typing in search narrows the list and announces the count", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("searchbox", { name: "Search the toolkit" }).fill("orb");
  await expect(page.locator(visible).first()).toBeVisible();
  const n = await page.locator(visible).count();
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThan(manifest.items.length);
  await expect(page.locator("#result-count")).toHaveText(`Showing ${n} of ${manifest.items.length} items`);
  expect(page.url()).toContain("#q=orb");
  await page.getByRole("searchbox").fill("zzzz-nothing");
  await expect(page.locator("#empty")).toBeVisible();
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.locator(visible)).toHaveCount(manifest.items.length);
});

test("kit and type chips filter, and the hash restores them @subpath", async ({ page }) => {
  await page.goto("./");
  const kits = page.getByRole("group", { name: "Filter by kit" });
  await kits.getByRole("switch", { name: /^VFX/ }).check();
  await expect(page.locator(visible)).toHaveCount(groupCount("vfx"));
  await kits.getByRole("switch", { name: /^VFX/ }).uncheck();
  await page.getByRole("group", { name: "Filter by type" }).getByRole("switch", { name: /^Installers/ }).check();
  await expect(page.locator(visible)).toHaveCount(kindCount("installer"));
  await page.goto("./#kit=vfx");
  await expect(page.locator(visible)).toHaveCount(groupCount("vfx"));
  await page.goto("./#kind=bogus&kit=nope&q=<script>");
  await expect(page.getByRole("searchbox")).toHaveValue("<script>");
});

test("a row's button opens its details, by click and by keyboard", async ({ page }) => {
  await page.goto("./");
  const row = page.locator("#item-skill-thinking-orbs");
  const button = row.locator("button.row-open");
  await expect(row.locator(".row-more")).toBeHidden();
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(row.locator(".row-more")).toBeVisible();
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(row.locator(".row-more")).toBeHidden();
});

test("source links point at the toolkit repository at the pinned commit", async ({ page }) => {
  await page.goto("./");
  const href = await page.locator("#item-skill-thinking-orbs .row-source").getAttribute("href");
  expect(href).toBe(`https://github.com/GHOST00TSOHG/websmith-toolkit/blob/${manifest.toolkit.sha}/skills/thinking-orbs/SKILL.md`);
});

for (const theme of ["dark", "light"] as const) {
  test(`axe finds no violations on the list in the ${theme} theme`, async ({ page }) => {
    await page.goto("./");
    await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
    await page.waitForTimeout(700);
    await page.locator("#item-skill-thinking-orbs button.row-open").click();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
}
