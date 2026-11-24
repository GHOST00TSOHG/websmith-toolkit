// Theme state. One owner: the data-theme attribute on <html> (first set by boot.js before paint).
// A change spreads from the toggle as a circular reveal (View Transitions), or cross-fades where that API
// is missing or the user prefers less motion.
import type { ThemeChoice } from "../core/migrate.ts";
import { isExternalChange, settings, updateSettings } from "../core/settings.ts";
import { EASE, prefersReducedMotion, T4 } from "../engine/motion.ts";

export type Theme = "dark" | "light";

const listeners = new Set<(theme: Theme) => void>();
let fadeTimer = 0;

export function parseTheme(value: unknown): Theme | null {
  return value === "dark" || value === "light" ? value : null;
}

export function currentTheme(): Theme {
  return parseTheme(document.documentElement.dataset["theme"]) ?? "dark";
}

export function onThemeChange(listener: (theme: Theme) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let activeReveal: ViewTransition | null = null;

function apply(next: Theme): void {
  document.documentElement.dataset["theme"] = next;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next === "dark" ? "#040914" : "#eaf2fc");
  for (const listener of listeners) listener(next);
}

const systemTheme = (): Theme => (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");

/** The theme a choice shows right now ("system" follows the device). */
export function resolveTheme(choice: ThemeChoice): Theme {
  switch (choice) {
    case "dark":
    case "light":
      return choice;
    case "system":
      return systemTheme();
    default: {
      const _exhaustive: never = choice;
      return _exhaustive;
    }
  }
}

/** Remembers a choice from the first-run sheet (dark, light or system) and cross-fades to it. */
export function setThemeChoice(choice: ThemeChoice): void {
  updateSettings({ theme: choice });
  show(resolveTheme(choice));
}

/** Applies a theme, remembers it, and tells listeners. `from` is where the reveal starts (the toggle). */
export function setTheme(next: Theme, from?: { x: number; y: number }): void {
  if (next === currentTheme()) return;
  updateSettings({ theme: next });
  show(next, from);
}

function show(next: Theme, from?: { x: number; y: number }): void {
  if (next === currentTheme()) return;
  const root = document.documentElement;
  // A flip during a running reveal finishes that reveal and swaps plainly: overlapping view transitions
  // crash the renderer, and a second snapshot of the whole page is memory a phone cannot spare.
  if (activeReveal !== null) {
    activeReveal.skipTransition();
    activeReveal = null;
    root.classList.remove("theme-reveal");
    apply(next);
    return;
  }
  if (from !== undefined && typeof document.startViewTransition === "function" && !prefersReducedMotion()) {
    const r = Math.hypot(Math.max(from.x, window.innerWidth - from.x), Math.max(from.y, window.innerHeight - from.y));
    root.classList.add("theme-reveal");
    const vt = document.startViewTransition(() => apply(next));
    activeReveal = vt;
    void vt.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${from.x}px ${from.y}px)`, `circle(${r}px at ${from.x}px ${from.y}px)`] },
        { duration: T4, easing: EASE, pseudoElement: "::view-transition-new(root)" },
      );
    });
    void vt.finished.finally(() => {
      if (activeReveal === vt) activeReveal = null;
      root.classList.remove("theme-reveal");
    });
    return;
  }
  root.classList.add("theme-fading");
  window.clearTimeout(fadeTimer);
  fadeTimer = window.setTimeout(() => root.classList.remove("theme-fading"), T4);
  apply(next);
}

/** With "system" chosen, follow the device theme as it changes; follow a choice made in another tab too. */
export function followSystemTheme(): void {
  const query = matchMedia("(prefers-color-scheme: light)");
  query.addEventListener("change", () => {
    if (settings().theme === "system") apply(systemTheme());
  });
  document.addEventListener("ws:settings", (event) => {
    if (isExternalChange(event)) show(resolveTheme(settings().theme));
  });
}
