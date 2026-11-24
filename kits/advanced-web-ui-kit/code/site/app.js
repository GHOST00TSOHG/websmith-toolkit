// Progressive enhancement: the page works without this file. Each feature checks
// for support and adds behaviour on top of semantic HTML.

// ---- Theme toggle with a circular view-transition reveal ------------------------
const root = document.documentElement;
const saved = (() => { try { return localStorage.getItem("theme"); } catch { return null; } })();
if (saved) root.dataset.theme = saved;

const toggle = document.querySelector("#theme-toggle");
toggle?.addEventListener("click", async (event) => {
  const isDark = matchMedia("(prefers-color-scheme: dark)").matches;
  const current = root.dataset.theme ?? (isDark ? "dark" : "light");
  const next = current === "dark" ? "light" : "dark";
  const apply = () => {
    root.dataset.theme = next;
    toggle.setAttribute("aria-pressed", String(next === "dark"));
    try { localStorage.setItem("theme", next); } catch {}
  };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!document.startViewTransition || reduce) return apply();

  const transition = document.startViewTransition(apply);
  await transition.ready;
  const { clientX: x = innerWidth / 2, clientY: y = 0 } = event;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.animate(
    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
    { duration: 500, easing: "cubic-bezier(0.2, 0, 0, 1)", pseudoElement: "::view-transition-new(root)" },
  );
});

// ---- <ui-tabs>: accessible tabs as a light-DOM custom element --------------------
// ARIA Authoring Practices pattern: roving tabindex, arrow keys move focus AND
// select (automatic activation), Home/End jump. Works with plain HTML inside.
class UITabs extends HTMLElement {
  connectedCallback() {
    this.tabs = [...this.querySelectorAll('[role="tab"]')];
    this.panels = this.tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));
    this.addEventListener("click", (e) => {
      const tab = e.target.closest('[role="tab"]');
      if (tab) this.select(this.tabs.indexOf(tab));
    });
    this.addEventListener("keydown", (e) => {
      const i = this.tabs.indexOf(document.activeElement);
      if (i < 0) return;
      const n = this.tabs.length;
      const next = { ArrowRight: (i + 1) % n, ArrowLeft: (i - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
      if (next === undefined) return;
      e.preventDefault();
      this.select(next, true);
    });
    this.select(Math.max(0, this.tabs.findIndex((t) => t.getAttribute("aria-selected") === "true")));
  }
  select(index, focus = false) {
    this.tabs.forEach((tab, i) => {
      const on = i === index;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      this.panels[i].hidden = !on;
    });
    if (focus) this.tabs[index].focus();
    this.dispatchEvent(new CustomEvent("tabchange", { detail: { index }, bubbles: true }));
  }
}
customElements.define("ui-tabs", UITabs);

// ---- Dialog: native <dialog>; closedby="any" adds light-dismiss where supported --
const dialog = document.querySelector("#signup");
document.querySelector("#open-signup")?.addEventListener("click", () => dialog.showModal());
dialog?.addEventListener("close", () => {
  if (dialog.returnValue === "submit") {
    document.querySelector("#status").textContent = "Thanks, you're on the list.";
  }
});

// ---- Live region for selection count (uses :has() styling + JS announcement) ----
const picks = document.querySelectorAll(".pick input");
const status = document.querySelector("#picked");
picks.forEach((p) => p.addEventListener("change", () => {
  const n = [...picks].filter((x) => x.checked).length;
  status.textContent = `${n} palette${n === 1 ? "" : "s"} selected`;
}));
