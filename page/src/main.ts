// Entry point. Modules are wired here; heavy effects load lazily after first paint.
import { mountRowDetails } from "./list/detail.ts";
import { mountFilters } from "./list/filters.ts";
import { readRows } from "./list/model.ts";
import { mountSyncStatus } from "./connect/status.ts";
import { canRemember, settings, updateSettings } from "./core/settings.ts";
import { handleSetupLink, SETUP_NOTICE } from "./core/setup-link.ts";
import { h } from "./core/dom.ts";
import { seedFromLocation } from "./core/rng.ts";
import { mountGreeting } from "./hero/greeting.ts";
import { followSystemTheme } from "./theme/theme.ts";
import { mountToggle } from "./theme/toggle.ts";
import { mountSafety } from "./engine/safety.ts";
import { holdStagesUntil, stage } from "./engine/stage.ts";
import { playOpening } from "./opening/opening.ts";
import { mountPower } from "./power/power.ts";

// A one-time setup link from the owner's bot: cleared from the address first, then saved (before the
// network policy below is narrowed to the saved bot).
const setup = handleSetupLink(window, (webhook) => updateSettings({ webhook }));
const root = document.documentElement;
const seed = seedFromLocation();
mountSafety();
narrowNetworkToBot();
if (setup !== "none") showSetupNotice(SETUP_NOTICE[setup], setup === "failed");
root.dataset["display"] = isInstalled() ? "standalone" : "browser";

// The opening plays first, over a static CSS veil that boot.js turned on before first paint. Every heavy
// stage waits for it to finish, so its canvas is never alive at the same time as theirs.
if (root.classList.contains("opening")) {
  holdStagesUntil(playOpening({ quick: root.dataset["intro"] === "quick", seed }));
} else {
  root.dataset["stage"] = "live";
}
mountPower(seed);
updateSettings({ seen: true }); // also runs the one-time migration of the old ws.v1.* keys

const toggleSlot = document.getElementById("theme-toggle-slot");
if (toggleSlot !== null) mountToggle(toggleSlot);
followSystemTheme();
mountSyncStatus();
markScrolled();


const list = document.getElementById("toolkit-list");
if (list !== null) {
  mountFilters(readRows(list));
  mountRowDetails(list);
}

// Hero: the greeting is plain text; the orb is a lazy stage.
mountGreeting();
const orbHost = document.getElementById("hero-orb");
if (orbHost !== null) {
  let mounted = false;
  const mountOrb = (): void => {
    if (mounted) return;
    mounted = true;
    void import("./hero/orb.ts").then((m) => m.mountHeroOrb(orbHost));
  };
  // With the opening, the orb assembles as the sheet opens from it; without, it is the first stage.
  if (root.classList.contains("opening")) {
    void import("./hero/orb.ts"); // fetch during the sweep, mount at the reveal
    document.addEventListener("ws:reveal", mountOrb, { once: true });
  }
  stage(150, mountOrb);
}
// Settings (the owner's webhook, Find my login, Clear my data) and the first-run sheet load on demand.
// The header button is the way back to Settings in the installed app, which has no browser toolbar.
const openSettings = (): void => {
  void import("./sheets/settings.ts").then((m) => m.openSettings());
};
document.getElementById("connect-open")?.addEventListener("click", openSettings);
document.getElementById("settings-open")?.addEventListener("click", openSettings);
if (needsFirstRun()) stage(250, () => import("./sheets/firstrun.ts").then((m) => m.openFirstRun()));

// The woven banner: its stage comes after the hero; it then loads only near the screen.
const clothStage = document.getElementById("cloth-stage");
if (clothStage !== null) {
  stage(700, () => {
    const io = new IntersectionObserver(
      (records) => {
        if (!records.some((r) => r.isIntersecting)) return;
        io.disconnect();
        void import("./cloth/cloth.ts").then((m) => m.mountCloth(clothStage));
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(clothStage);
  });
}

// Last stage: everything is up.
stage(400, () => root.classList.add("settled"));

/** The first time someone opens the page on this device. Not when storage is blocked (it could never be
 *  remembered, so it would ask every time), and not for automated browsers unless ?firstrun=1. */
function needsFirstRun(): boolean {
  if (settings().firstRunDone || !canRemember()) return false;
  return !navigator.webdriver || new URLSearchParams(location.search).get("firstrun") === "1";
}

/** Opened from the Home Screen (no browser toolbar). */
function isInstalled(): boolean {
  return matchMedia("(display-mode: standalone)").matches || Reflect.get(navigator, "standalone") === true;
}

/** With a bot saved, a second CSP (policies only ever narrow) lets the page talk to that origin alone. */
function narrowNetworkToBot(): void {
  const hook = settings().webhook;
  if (hook === null) return;
  const origin = new URL(hook.url).origin;
  const meta = document.createElement("meta");
  meta.httpEquiv = "Content-Security-Policy";
  meta.content = `connect-src 'self' ${origin}`;
  meta.dataset["narrow"] = origin;
  document.head.append(meta);
}

/** A short plain notice after a setup link, with a button to close it. No animation. */
function showSetupNotice(text: string, failed: boolean): void {
  const close = h("button", { class: "setup-notice-close", text: "Close", attrs: { type: "button" } });
  const notice = h("div", { class: "setup-notice", attrs: { role: "status", "data-tone": failed ? "error" : "info" } }, [
    h("p", { text }),
    close,
  ]);
  close.addEventListener("click", () => notice.remove());
  document.body.append(notice);
}

/** html.scrolled once the page leaves the top: the header's solid band fades in behind the pill. */
function markScrolled(): void {
  let on: boolean | null = null;
  const update = (): void => {
    const next = window.scrollY > 4;
    if (next === on) return;
    on = next;
    root.classList.toggle("scrolled", next);
  };
  window.addEventListener("scroll", update, { passive: true });
  update();
}
