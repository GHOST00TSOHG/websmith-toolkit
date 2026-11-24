// The iPhone GPU budget, in Chromium emulating an iPhone 15 (DPR 3). At load and after a full scroll:
// at most one live WebGL context, under 20 composited layers, under 40 MB of estimated backing store.
// Headless Chromium reports no layer tree, so layers are counted from the page: every visible element
// with a compositing trigger (fixed or sticky position, a GPU canvas, backdrop-filter, will-change, a 3D
// transform, a running transform or opacity animation, a scroller), plus the root. Each layer's backing
// store is width x height x DPR^2 x 4, clipped to the viewport (big layers are tiled and only backed near
// the screen). Canvas backing stores are counted at their real pixel size and added on top.
import { devices, expect, test, type Page } from "@playwright/test";

interface GpuNumbers {
  webglLive: number;
  webglMade: number;
  canvases: number;
  canvasPixels: number;
  layers: number;
  layerList: string[];
  mb: number;
}

const iphone = { ...devices["iPhone 15"], defaultBrowserType: undefined };
const DPR = iphone.deviceScaleFactor;

async function instrumentGpu(page: Page): Promise<() => Promise<GpuNumbers>> {
  await page.addInitScript(() => {
    const made: HTMLCanvasElement[] = [];
    const gl: { canvas: HTMLCanvasElement; lost: boolean }[] = [];
    const orig = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value(this: HTMLCanvasElement, type: string, attrs?: unknown) {
        const ctx: unknown = Reflect.apply(orig, this, [type, attrs]);
        if (ctx !== null && !made.includes(this)) made.push(this);
        if (ctx !== null && (type === "webgl" || type === "webgl2") && !gl.some((r) => r.canvas === this)) {
          const rec = { canvas: this, lost: false };
          gl.push(rec);
          this.addEventListener("webglcontextlost", () => {
            rec.lost = true;
          });
        }
        return ctx;
      },
    });
    Reflect.set(window, "__gpu", (dpr: number) => {
      const vw = innerWidth;
      const vh = innerHeight;
      const layers: { what: string; w: number; h: number }[] = [{ what: "root", w: vw, h: vh }];
      const animated = new Set<Element>();
      for (const a of document.getAnimations()) {
        const fx = a.effect;
        if (a.playState !== "running" || !(fx instanceof KeyframeEffect) || fx.target === null) continue;
        const props = fx.getKeyframes().flatMap((k) => Object.keys(k));
        if (props.some((p) => p === "transform" || p === "opacity" || p === "translate" || p === "scale" || p === "rotate" || p === "filter")) animated.add(fx.target);
      }
      for (const el of document.querySelectorAll("body *")) {
        const s = getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden") continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const near = r.bottom > -vh && r.top < vh * 2;
        let why = "";
        if (el instanceof HTMLCanvasElement && (s.position === "fixed" || near) && (gl.some((g) => g.canvas === el && !g.lost) || el.width * el.height >= 256 * 256)) why = "canvas";
        else if (s.position === "fixed") why = "fixed";
        else if (s.position === "sticky") why = "sticky";
        else if (s.backdropFilter !== "none" && s.backdropFilter !== "" && near) why = "backdrop-filter";
        else if (/transform|opacity/.test(s.willChange) && near) why = "will-change";
        else if (/matrix3d|translateZ|translate3d/.test(s.transform) && near) why = "3d";
        else if (animated.has(el) && near) why = "animation";
        else if ((s.overflowY === "auto" || s.overflowY === "scroll" || s.overflowX === "auto" || s.overflowX === "scroll") && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) && near) why = "scroller";
        if (why === "") continue;
        const name = `${why}:${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${typeof el.className === "string" && el.className ? `.${el.className.split(" ")[0]}` : ""}`;
        // A canvas layer shows the canvas's own backing store, which is counted below at its real size.
        layers.push({ what: name, w: why === "canvas" ? 0 : Math.min(r.width, vw), h: why === "canvas" ? 0 : Math.min(r.height, vh) });
      }
      const layerBytes = layers.reduce((sum, l) => sum + l.w * l.h * dpr * dpr * 4, 0);
      const canvasPixels = made.reduce((sum, c) => sum + c.width * c.height, 0);
      return {
        webglMade: gl.length,
        webglLive: gl.filter((r) => !r.lost && r.canvas.isConnected && r.canvas.width > 0).length,
        canvases: made.filter((c) => c.width * c.height > 0).length,
        canvasPixels,
        layers: layers.length,
        layerList: layers.map((l) => l.what),
        mb: (layerBytes + canvasPixels * 4) / 2 ** 20,
      };
    });
  });
  return async () => {
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const raw: unknown = await page.evaluate((dpr) => {
      const fn: unknown = Reflect.get(window, "__gpu");
      return typeof fn === "function" ? Reflect.apply(fn, window, [dpr]) : null;
    }, DPR);
    if (typeof raw !== "object" || raw === null) throw new Error("no __gpu");
    const n = (k: string): number => Number(Reflect.get(raw, k));
    const list: unknown = Reflect.get(raw, "layerList");
    return {
      webglLive: n("webglLive"), webglMade: n("webglMade"), canvases: n("canvases"), canvasPixels: n("canvasPixels"),
      layers: n("layers"), layerList: Array.isArray(list) ? list.map(String) : [], mb: n("mb"),
    };
  };
}

const within = (what: string, n: GpuNumbers): void => {
  console.log(`${what}: ${JSON.stringify({ ...n, mb: Number(n.mb.toFixed(1)) })}`);
  expect(n.webglLive, `${what}: live WebGL contexts`).toBeLessThanOrEqual(1);
  expect(n.layers, `${what}: composited layers (${n.layerList.join(", ")})`).toBeLessThan(20);
  expect(n.mb, `${what}: estimated MB`).toBeLessThan(40);
};

for (const intro of ["off", "full"] as const) {
  test(`iPhone budget at load and after a full scroll (intro ${intro})`, async ({ browser, browserName }) => {
    test.skip(browserName !== "chromium", "measured in Chromium's iPhone emulation");
    test.setTimeout(90_000);
    const context = await browser.newContext({ ...iphone, colorScheme: "dark", baseURL: test.info().project.use.baseURL ?? "" });
    const page = await context.newPage();
    const read = await instrumentGpu(page);
    await page.goto(`./?intro=${intro}&seed=5`);
    if (intro === "full") {
      await page.waitForTimeout(700);
      within("mid-opening", await read());
    }
    await expect(page.locator("html")).toHaveClass(/settled/, { timeout: 20_000 });
    await page.waitForTimeout(800);
    within("at load", await read());
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += 600) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(100);
      if (y > 0 && y % 3000 < 600) within(`scrolling at ${y}px`, await read());
    }
    await page.waitForTimeout(600);
    within("after a full scroll", await read());
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);
    within("back at the top", await read());
    await context.close();
  });
}
