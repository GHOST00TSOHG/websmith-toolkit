// Classic script that runs before first paint (built to dist/boot.js, no inline code so the CSP stays strict).
// It sets the saved or system theme so there is no flash of the wrong one, and decides whether the
// opening sweep plays (its veil must be up with the first frame).
// It only reads. The settings record is `ws.settings` (src/core/settings.ts); on the very first load after
// an update the old ws.v1.* keys are still there (main.ts migrates them a moment later), so they are read too.
(() => {
  const root = document.documentElement;
  const read = (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null; // storage can be blocked (private mode)
    }
  };
  let record: { theme?: unknown; seen?: unknown } = {};
  try {
    const parsed: unknown = JSON.parse(read("ws.settings") ?? "null");
    if (typeof parsed === "object" && parsed !== null) record = { theme: Reflect.get(parsed, "theme"), seen: Reflect.get(parsed, "seen") };
  } catch {
    // broken record: defaults
  }
  const saved = record.theme ?? read("ws.v1.theme");
  const theme = saved === "dark" || saved === "light" ? saved : matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  root.dataset["theme"] = theme;
  root.classList.add("js");
  const seen = record.seen === true || read("ws.v1.seen") !== null;

  // The opening. Reduced motion never gets it. Otherwise ?intro=full|quick|off wins; automated browsers
  // get the page as is, first visits the full sweep and returning visitors a quick one. Phones too: the
  // opening is one small canvas over a static veil, and every heavy layer waits until it is gone.
  const asked = new URLSearchParams(location.search).get("intro");
  const intro = matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "off"
    : asked === "full" || asked === "quick" || asked === "off"
      ? asked
      : navigator.webdriver ? "off" : seen ? "quick" : "full";
  root.dataset["intro"] = intro;
  if (intro !== "off") root.classList.add("opening");
})();

export {};
