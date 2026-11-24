// D17: every list row, chip and control has a visible hover and press response. Each one is hovered and pressed
// for real, and its computed look (transform, shadow, colours, filter) must change.
import { expect, test, type Locator, type Page } from "@playwright/test";

test.use({ colorScheme: "dark", viewport: { width: 1280, height: 900 } });

const look = (target: Locator) =>
  target.evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.transform, s.scale, s.translate, s.boxShadow, s.borderTopColor, s.backgroundColor, s.color, s.filter].join("|");
  });

async function reacts(page: Page, target: Locator, what: string, press = true): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  await page.mouse.move(2, 2);
  await page.waitForTimeout(80);
  const rest = await look(target);
  await target.hover();
  await page.waitForTimeout(170);
  const hovered = await look(target);
  expect(hovered, `${what}: hover changes its look`).not.toBe(rest);
  if (press) {
    await page.mouse.down();
    await page.waitForTimeout(120);
    const pressed = await look(target);
    await page.mouse.move(2, 2); // let go elsewhere so nothing is clicked
    await page.mouse.up();
    expect(pressed, `${what}: press changes its look`).not.toBe(hovered);
  }
}

test("every list row gets a flat fill on hover and on press", async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto("./");
  const rows = page.locator(".row-line");
  const count = await rows.count();
  expect(count).toBeGreaterThan(40);
  for (let i = 0; i < count; i += 1) await reacts(page, rows.nth(i), `row ${(await rows.nth(i).locator(".row-name").textContent()) ?? i}`);
});

test("every filter chip reacts to hover and press", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("./");
  const chips = page.locator("#toolbar label.chip");
  const count = await chips.count();
  expect(count).toBeGreaterThan(8);
  for (let i = 0; i < count; i += 1) await reacts(page, chips.nth(i), `chip ${(await chips.nth(i).textContent()) ?? i}`);
});

test("the page controls react: toggle, brand, Shut down, search, name form", async ({ page }) => {
  await page.goto("./");
  // The knob itself ignores the pointer (the real switch input sits on top), so hover the control and read the knob.
  const knob = page.locator(".daynight-knob");
  await page.mouse.move(2, 2);
  await page.waitForTimeout(80);
  const knobRest = await look(knob);
  await page.locator("label.daynight").hover();
  await page.waitForTimeout(170);
  const knobHover = await look(knob);
  expect(knobHover, "toggle: hover changes its look").not.toBe(knobRest);
  await page.mouse.down();
  await page.waitForTimeout(120);
  expect(Number(await knob.evaluate((el) => getComputedStyle(el).scale))).toBeLessThan(0.98); // squeezing toward 0.95
  await page.mouse.move(2, 2);
  await page.mouse.up();
  await reacts(page, page.locator("a.brand"), "brand link");
  await reacts(page, page.getByRole("button", { name: "Shut down" }), "Shut down");
  await reacts(page, page.getByRole("button", { name: "Save" }), "Save name");
  await reacts(page, page.getByRole("searchbox"), "search", false);
  await page.getByRole("searchbox").fill("zzz");
  await reacts(page, page.getByRole("button", { name: "Clear" }), "Clear filters");
  await reacts(page, page.getByRole("button", { name: "Connect your AI agent" }), "Connect your AI agent");
});

test("Wake reacts", async ({ page }) => {
  await page.goto("./?intro=off");
  await page.getByRole("button", { name: "Shut down" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-stage", "down", { timeout: 6000 });
  await reacts(page, page.getByRole("button", { name: "Wake" }), "Wake");
});
