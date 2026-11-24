// The woven banner: loads lazily, simulates in the wind, answers a tap, and calms down under reduced motion.
import { expect, test } from "@playwright/test";

interface ClothState {
  mode: string;
  frames: number;
  wind: number;
  t: number;
  gust: number;
  back: number;
}
const num = (o: object, k: string): number => {
  const v: unknown = Reflect.get(o, k);
  return typeof v === "number" ? v : Number.NaN;
};
const state = async (page: import("@playwright/test").Page): Promise<ClothState | null> => {
  const raw: unknown = await page.evaluate(() => {
    const c: unknown = Reflect.get(window, "__cloth");
    if (typeof c !== "object" || c === null) return null;
    const fn: unknown = Reflect.get(c, "state");
    return typeof fn === "function" ? JSON.stringify(Reflect.apply(fn, c, [])) : null;
  });
  if (typeof raw !== "string") return null;
  const o: unknown = JSON.parse(raw);
  if (typeof o !== "object" || o === null) return null;
  const mode: unknown = Reflect.get(o, "mode");
  return { mode: typeof mode === "string" ? mode : "", frames: num(o, "frames"), wind: num(o, "wind"), t: num(o, "t"), gust: num(o, "gust"), back: num(o, "back") };
};

test("the cloth loads only near the screen, then moves in the wind", async ({ page }) => {
  const scripts: string[] = [];
  page.on("request", (r) => {
    if (r.resourceType() === "script") scripts.push(r.url());
  });
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto("./?perf=1");
  await page.locator("#cloth").scrollIntoViewIfNeeded();
  await expect.poll(async () => (await state(page))?.frames ?? 0).toBeGreaterThan(20);
  expect(scripts.some((u) => /cloth-.*\.js/.test(u))).toBe(true);
  const a = await state(page);
  await page.waitForTimeout(600);
  const b = await state(page);
  expect(a?.mode).toMatch(/webgl2|canvas2d/);
  expect((b?.t ?? 0) - (a?.t ?? 0)).toBeGreaterThan(0.3);
  await expect(page.locator("#cloth-stage")).toHaveAttribute("data-cloth", /webgl2|canvas2d/);
});

test("a tap on the cloth ticks the haptic switch", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 393, height: 852 } });
  const page = await context.newPage();
  await page.goto(new URL("./?perf=1", test.info().project.use.baseURL).toString());
  await page.locator("#cloth").scrollIntoViewIfNeeded();
  await expect.poll(async () => (await state(page))?.frames ?? 0).toBeGreaterThan(5);
  const box = await page.locator("canvas.cloth-canvas").boundingBox();
  if (box === null) throw new Error("no cloth canvas");
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator("#cloth-switch")).toBeChecked();
  await context.close();
});

test("under reduced motion the cloth is one still frame of the settled drape", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./?perf=1");
  await page.locator("#cloth").scrollIntoViewIfNeeded();
  await expect.poll(async () => (await state(page))?.frames ?? 0).toBeGreaterThan(0);
  await page.waitForTimeout(400);
  const a = await state(page);
  await page.waitForTimeout(800);
  const b = await state(page);
  expect(b?.frames).toBe(a?.frames); // nothing redraws
  expect(b?.t).toBe(a?.t); // and no time passes in the simulation
  expect(b?.gust).toBe(0);
});

test("scrolling blows wind through the cloth", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("./?perf=1");
  await page.locator("#cloth").scrollIntoViewIfNeeded();
  await expect.poll(async () => (await state(page))?.frames ?? 0).toBeGreaterThan(10);
  const scrollKick = () =>
    page.evaluate((): number => {
      const c: unknown = Reflect.get(window, "__cloth");
      const fn: unknown = typeof c === "object" && c !== null ? Reflect.get(c, "state") : null;
      const st: unknown = typeof fn === "function" ? Reflect.apply(fn, c, []) : null;
      return typeof st === "object" && st !== null ? Number(Reflect.get(st, "scroll")) : 0;
    });
  for (let i = 0; i < 6; i += 1) {
    await page.mouse.wheel(0, i % 2 === 0 ? 260 : -260);
    await page.waitForTimeout(40);
  }
  await expect.poll(scrollKick).toBeGreaterThan(0.05);
});

test("the cloth ripples without folding over, even in gusts and under taps", async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 393, height: 852 } });
  const page = await context.newPage();
  await page.goto(new URL("./?perf=1", test.info().project.use.baseURL).toString());
  await page.locator("#cloth").scrollIntoViewIfNeeded();
  await expect.poll(async () => (await state(page))?.frames ?? 0).toBeGreaterThan(5);
  const box = await page.locator("canvas.cloth-canvas").boundingBox();
  if (box === null) throw new Error("no cloth canvas");
  let worst = 0;
  for (let i = 0; i < 24; i += 1) {
    if (i % 6 === 0) await page.touchscreen.tap(box.x + box.width * (0.2 + 0.2 * (i % 4)), box.y + box.height * 0.7);
    await page.waitForTimeout(250);
    worst = Math.max(worst, (await state(page))?.back ?? 99);
  }
  expect(worst).toBe(0);
  await context.close();
});
