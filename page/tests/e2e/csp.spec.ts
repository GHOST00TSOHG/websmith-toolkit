// The spike from docs/PLAN.md section 8.2: can a second, narrower CSP meta tag added at start-up (R3's boot.js
// will do this with the owner's saved webhook origin) really block other origins in both engines?
import { expect, test } from "@playwright/test";

const OTHER_ORIGIN = "http://127.0.0.1:5194/a/b/"; // the sub-path test server stands in for "some other origin"

test("a second CSP meta narrows connect-src to the page's own origin", async ({ page }) => {
  await page.goto("./");
  const allowedBefore = await page.evaluate(async (url) => {
    try {
      await fetch(url, { mode: "no-cors" });
      return true;
    } catch {
      return false;
    }
  }, OTHER_ORIGIN);
  expect(allowedBefore).toBe(true); // the static policy is broad on purpose: the owner's origin is unknown at build time

  const result = await page.evaluate(async (url) => {
    let violated = false;
    document.addEventListener("securitypolicyviolation", () => {
      violated = true;
    });
    const meta = document.createElement("meta");
    meta.httpEquiv = "Content-Security-Policy";
    meta.content = "connect-src 'self'";
    document.head.append(meta);
    let allowed = true;
    try {
      await fetch(url, { mode: "no-cors" });
    } catch {
      allowed = false;
    }
    await new Promise((done) => setTimeout(done, 100)); // the violation event is queued after the fetch fails
    return { allowed, violated };
  }, OTHER_ORIGIN);
  expect(result.allowed).toBe(false);
  expect(result.violated).toBe(true);

  // The page's own files still load.
  const own = await page.evaluate(async () => (await fetch(location.href)).status);
  expect(own).toBe(200);
});

test("the shipped policy has no inline script, no third-party origin and no unsafe-inline", async ({ page }) => {
  await page.goto("./");
  const csp = (await page.locator('meta[http-equiv="Content-Security-Policy"]').first().getAttribute("content")) ?? "";
  expect(csp).toContain("script-src 'self'");
  expect(csp).toContain("style-src 'self'");
  expect(csp).not.toContain("unsafe-inline");
  expect(csp).not.toContain("unsafe-eval");
  expect(await page.locator("script:not([src])").count()).toBe(0);
});
