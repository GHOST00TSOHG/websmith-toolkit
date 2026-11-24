// iPhone centering (R5). A box wider than the screen lets iPhone Safari pan the page sideways (body
// overflow-x does not stop it), which shifted every centered thing left. At 393 px the document must be
// exactly as wide as the viewport, a sideways scroll must not move it, and the orb, the banner rod and
// the greeting must sit on the screen's center line.
import { devices, expect, test } from "@playwright/test";

const iphone = { ...devices["iPhone 15"], defaultBrowserType: undefined };

for (const theme of ["dark", "light"] as const) {
  test(`no sideways overflow and a centered hero at 393 px (${theme}) @subpath`, async ({ browser }) => {
    const context = await browser.newContext({ ...iphone, colorScheme: theme, baseURL: test.info().project.use.baseURL ?? "" });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem("ws.v1.profile", JSON.stringify({ v: 1, name: "Sam" })));
    await page.goto("./?intro=off");
    await expect(page.locator("html")).toHaveClass(/settled/, { timeout: 20_000 });
    await expect(page.locator(".hero-orb canvas")).toBeVisible();
    const m = await page.evaluate(() => {
      const center = (sel: string): number => {
        const el = document.querySelector(sel);
        if (el === null) return Number.NaN;
        const r = el.getBoundingClientRect();
        return r.left + r.width / 2;
      };
      window.scrollTo(400, 0);
      const pannedBy = window.scrollX;
      window.scrollTo(0, 0);
      return {
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        pannedBy,
        orb: center(".hero-orb canvas"),
        rod: center(".cloth-rod"),
        title: center(".hero-title"),
        header: center(".topbar"),
      };
    });
    expect(m.innerWidth).toBe(393);
    expect(m.scrollWidth, "document wider than the screen").toBe(m.innerWidth);
    expect(m.pannedBy, "page pans sideways").toBe(0);
    const mid = m.innerWidth / 2;
    for (const k of ["orb", "rod", "title", "header"] as const) {
      expect(Math.abs(m[k] - mid), `${k} center ${m[k]} vs ${mid}`).toBeLessThanOrEqual(1);
    }
    await context.close();
  });
}
