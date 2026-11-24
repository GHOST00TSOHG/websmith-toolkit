import { expect, test, type Page } from "@playwright/test";

interface PerfStats {
  frames: number;
  running: boolean;
  tickers: number;
}

const readStats = (page: Page) =>
  page.evaluate((): PerfStats => {
    const perf: unknown = Reflect.get(window, "__perf");
    const stats = typeof perf === "object" && perf !== null ? Reflect.get(perf, "stats") : null;
    if (typeof stats !== "object" || stats === null) throw new Error("no __perf");
    return { frames: Number(Reflect.get(stats, "frames")), running: Boolean(Reflect.get(stats, "running")), tickers: Number(Reflect.get(stats, "tickers")) };
  });

test.use({ reducedMotion: "reduce" });

test("with reduced motion everything settles and the loop sleeps completely", async ({ page }) => {
  await page.goto("./?perf=1");
  await expect(page.locator("canvas.orb-canvas")).toHaveCount(1); // the lazy hero has joined the loop
  await expect(page.locator("html")).toHaveClass(/settled/, { timeout: 15000 }); // every staged layer has mounted
  await expect.poll(async () => (await readStats(page)).running, { timeout: 15000 }).toBe(false);
  await page.waitForTimeout(500); // late observers report once; let them finish
  await expect.poll(async () => (await readStats(page)).running, { timeout: 15000 }).toBe(false);
  const idle = (await readStats(page)).frames;
  await page.waitForTimeout(400);
  expect((await readStats(page)).frames).toBe(idle); // asleep: no frames at all
  await page.mouse.wheel(0, 900);
  await expect.poll(async () => (await readStats(page)).running, { timeout: 15000 }).toBe(false);
});

test("a hidden tab stops the loop and a visible one resumes it", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "no-preference" });
  const page = await context.newPage();
  await page.goto("./?perf=1");
  await expect(page.locator("canvas.orb-canvas")).toHaveCount(1);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(100);
  await page.mouse.move(300, 200);
  await page.mouse.move(700, 400);
  const before = (await readStats(page)).frames;
  await page.waitForTimeout(300);
  expect((await readStats(page)).frames).toBe(before);

  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(async () => (await readStats(page)).frames, { timeout: 3000 }).toBeGreaterThan(before);
  await context.close();
});
