// The day/night switch: a real <input type="checkbox" switch> (the user's own tap gives the iOS haptic
// tick) under a drawn sky. Night: the knob glides right, the sun sinks and is eclipsed into a moon, and
// stars come out. The page follows with a circular reveal from the knob.
import { h, svg } from "../core/dom.ts";
import { EASE, T4 } from "../engine/motion.ts";
import { currentTheme, onThemeChange, setTheme } from "./theme.ts";

export function mountToggle(slot: HTMLElement): void {
  const input = h("input", { class: "daynight-input", attrs: { type: "checkbox", switch: "", role: "switch", "aria-label": "Dark mode" } });
  const icon = svg("svg", { class: "dn-icon", viewBox: "0 0 32 32", "aria-hidden": "true" });
  const mask = svg("mask", { id: "dn-eclipse" });
  mask.append(svg("rect", { width: "32", height: "32", fill: "#fff" }), svg("circle", { class: "dn-bite", cx: "22", cy: "10", r: "7.5", fill: "#000" }));
  const defs = svg("defs");
  defs.append(mask);
  const rays = svg("g", { class: "dn-rays" });
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    rays.append(svg("line", {
      x1: (16 + Math.cos(a) * 10.5).toFixed(2), y1: (16 + Math.sin(a) * 10.5).toFixed(2),
      x2: (16 + Math.cos(a) * 13.5).toFixed(2), y2: (16 + Math.sin(a) * 13.5).toFixed(2),
    }));
  }
  const body = svg("g", { class: "dn-body" });
  const disc = svg("circle", { class: "dn-disc", cx: "16", cy: "16", r: "7.5", mask: "url(#dn-eclipse)" });
  const craters = svg("g", { class: "dn-craters" });
  craters.append(svg("circle", { cx: "12.5", cy: "18", r: "1.4" }), svg("circle", { cx: "15", cy: "21.5", r: "0.9" }), svg("circle", { cx: "11", cy: "13.5", r: "0.8" }));
  body.append(disc, craters);
  icon.append(defs, rays, body);

  const stars = h("span", { class: "dn-stars" }, Array.from({ length: 7 }, () => h("i")));
  const knob = h("span", { class: "daynight-knob" }, [icon]);
  const track = h("span", { class: "daynight-track", attrs: { "aria-hidden": "true" } }, [stars, h("span", { class: "dn-cloud" }), knob]);
  const label = h("label", { class: "daynight" }, [input, track]);
  slot.replaceChildren(label);

  const sync = (): void => {
    input.checked = currentTheme() === "dark";
  };
  sync();
  onThemeChange(sync);

  input.addEventListener("change", () => {
    const next = input.checked ? "dark" : "light";
    // The sun dips below the knob's horizon on the way to night, and the moon rises out of it on the way back.
    body.animate(
      next === "dark"
        ? [{ transform: "translateY(0)" }, { transform: "translateY(9px)", offset: 0.42 }, { transform: "translateY(0)" }]
        : [{ transform: "translateY(0)" }, { transform: "translateY(-9px)", offset: 0.42 }, { transform: "translateY(0)" }],
      { duration: T4, easing: EASE },
    );
    const box = knob.getBoundingClientRect();
    setTheme(next, { x: box.left + box.width / 2 + (next === "dark" ? 30 : -30), y: box.top + box.height / 2 });
  });
}
