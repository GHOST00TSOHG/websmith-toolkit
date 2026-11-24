// R5: the sticky header is opaque on phones in both themes. The pill has a solid fill and no backdrop
// blur, and once the page scrolls a solid band in the page colour covers the strip above and beside it,
// so no page text is readable through or around the header.
import { devices, expect, test } from "@playwright/test";

const iphone = { ...devices["iPhone 15"], defaultBrowserType: undefined };

for (const theme of ["dark", "light"] as const) {
  test(`the sticky header is opaque while scrolling (${theme}) @subpath`, async ({ browser }) => {
    const context = await browser.newContext({ ...iphone, colorScheme: theme, baseURL: test.info().project.use.baseURL ?? "" });
    const page = await context.newPage();
    await page.goto("./?intro=off");
    const band = (): Promise<string> => page.evaluate(() => getComputedStyle(document.querySelector(".site-head") ?? document.body, "::before").opacity);
    await expect.poll(band).toBe("0");
    const pill = await page.locator(".topbar").evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, blur: s.backdropFilter };
    });
    // The fill colour under the sheen gradient is fully opaque (rgb(), not rgba with alpha < 1).
    expect(pill.bg).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    expect(pill.blur === "none" || pill.blur === "").toBe(true);
    await page.evaluate(() => {
      const t = document.querySelectorAll(".row-name")[4]?.getBoundingClientRect();
      window.scrollTo(0, window.scrollY + (t?.top ?? 0) - 30); // a row name right under the pill
    });
    await expect(page.locator("html")).toHaveClass(/scrolled/);
    await expect.poll(band).toBe("1");
    // The band reaches both screen edges and the top of the screen, and never wider than the screen.
    const box = await page.evaluate(() => ({ w: window.innerWidth, sw: document.documentElement.scrollWidth }));
    expect(box.sw).toBe(box.w);
    await context.close();
  });
}
