// "Websmith connected": the corner status. A glowing dot, the word, and the time of the last sync.
// When the toolkit changed since the last visit, the dot sends out a few pulses.
//
// The time is the real last sync, kept in this browser: recorded when the page loads and checks the
// toolkit it carries, and when an agent is connected. (Until R5 it was the toolkit's last commit time,
// baked into the HTML at build time, so it never moved.) Shown in the visitor's local time and updated
// whenever a sync happens, here or in another tab.
import { settings, updateSettings } from "../core/settings.ts";

/** Record a sync now (or at a given time); the settings change repaints the status. */
export function recordSync(at: Date = new Date()): void {
  updateSettings({ lastSync: at.toISOString() });
}

/** "1:05 PM" today, "Nov 22, 1:05 PM" on another day, in the visitor's locale and time zone. */
export function formatSyncTime(at: Date, now: Date = new Date()): string {
  const clock = at.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (at.toDateString() === now.toDateString()) return clock;
  return `${at.toLocaleDateString([], { month: "short", day: "numeric" })}, ${clock}`;
}

export function mountSyncStatus(): void {
  const box = document.getElementById("sync-status");
  const time = document.getElementById("sync-time");
  if (box === null || !(time instanceof HTMLTimeElement)) return;
  const paint = (): void => {
    const at = Date.parse(settings().lastSync ?? "");
    if (!Number.isFinite(at)) return;
    const d = new Date(at);
    time.dateTime = d.toISOString();
    time.textContent = formatSyncTime(d);
  };
  // Any settings change, here or in another tab (a sync is one of them).
  document.addEventListener("ws:settings", paint);
  // "Today" vs a date can change while the tab sits in the background.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) paint();
  });
  recordSync(); // this load checked the toolkit it carries: that is a sync
  const sha = time.dataset["sha"] ?? "";
  if (settings().toolkitSha !== sha) {
    updateSettings({ toolkitSha: sha });
    pulse(box);
  }
  document.addEventListener("ws:toolkit-pulse", () => pulse(box));
  // Out of the reading path: near the top and at the very end it shows in full; while you scroll, or
  // while cards are under it, it fades away completely. A tap while it shows keeps it for a few seconds.
  // Scroll work is batched into one rAF; the page height is cached (read on resize, not per scroll).
  let scrolling = false;
  let pinnedUntil = 0;
  let rest = 0;
  let queued = false;
  let pageH = document.documentElement.scrollHeight;
  let tucked: boolean | null = null;
  const update = (): void => {
    queued = false;
    const y = window.scrollY;
    const nearEnd = y + window.innerHeight > pageH - 140;
    const open = performance.now() < pinnedUntil || (!scrolling && (y < 80 || nearEnd));
    if (tucked !== !open) {
      tucked = !open;
      box.classList.toggle("tucked", tucked);
    }
  };
  const queue = (): void => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  window.addEventListener(
    "scroll",
    () => {
      scrolling = true;
      queue();
      window.clearTimeout(rest);
      rest = window.setTimeout(() => {
        scrolling = false;
        pageH = document.documentElement.scrollHeight;
        queue();
      }, 900);
    },
    { passive: true },
  );
  window.addEventListener("resize", () => {
    pageH = document.documentElement.scrollHeight;
    queue();
  });
  box.addEventListener("click", () => {
    pinnedUntil = performance.now() + 4000;
    queue();
    window.setTimeout(queue, 4100);
  });
  update();
}

function pulse(box: HTMLElement): void {
  box.classList.remove("pulsing");
  void box.offsetWidth; // restart the animation
  box.classList.add("pulsing");
  window.setTimeout(() => box.classList.remove("pulsing"), 3600);
}
