import { expect, test, type Page } from "@playwright/test";

test.use({ colorScheme: "dark", viewport: { width: 1280, height: 800 } });

async function measure(page: Page, url: string): Promise<{ lcp: number; cls: number }> {
  await page.addInitScript(() => {
    const vitals = { lcp: 0, cls: 0 };
    Reflect.set(window, "__vitals", vitals);
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) vitals.lcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!Reflect.get(entry, "hadRecentInput")) vitals.cls += Number(Reflect.get(entry, "value"));
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(url);
  await page.waitForTimeout(4500); // the whole intro plays out
  return page.evaluate(() => {
    const v: unknown = Reflect.get(window, "__vitals");
    return { lcp: Number(Reflect.get(Object(v), "lcp")), cls: Number(Reflect.get(Object(v), "cls")) };
  });
}

test("the page paints its content quickly and does not jump around (Chromium)", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "layout-shift and LCP observers are Chromium-only");
  const quiet = await measure(page, "./?intro=off");
  expect(quiet.lcp).toBeGreaterThan(0);
  expect(quiet.lcp).toBeLessThan(2500);
  expect(quiet.cls).toBeLessThan(0.1);
});

test("the intro does not delay the content or shift the layout (Chromium)", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "layout-shift and LCP observers are Chromium-only");
  const intro = await measure(page, "./?intro=full&seed=2");
  expect(intro.lcp).toBeLessThan(2500);
  expect(intro.cls).toBeLessThan(0.1);
});
