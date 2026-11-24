// The hero orb: one big ThinkingOrb (vendored thinking-orbs engine, MIT, Jakub Antalik). The engine gives
// each frame's dots (position, depth, ink); we draw them as light: every dot is a pre-rendered glow
// sprite, front dots hot white-cyan, back dots deep blue, added together on dark. Every few seconds, or on
// a tap, it morphs to the next of the nine designs: the old dots spin out of a vortex and fade while the
// new ones spin in and settle, with a flash of light at the crossing. A mouse nearby pushes the dots away.
// Cost: one canvas (DPR capped at 2), three small sprites, no allocation in the draw loop beyond the
// engine's own frame arrays; it sleeps off screen. Reduced motion: a still orb; a tap swaps the design.
import { h } from "../core/dom.ts";
import { ORB_STATES } from "../core/manifest.ts";
import { addTicker } from "../engine/loop.ts";
import { EASE, ease, prefersReducedMotion } from "../engine/motion.ts";
import { perfEnabled } from "../engine/perf.ts";
import { watchVisible } from "../engine/visibility.ts";
import { onThemeChange } from "../theme/theme.ts";
import { MODE_FRAMES, resolvePreset, type OrbFrame } from "../vendor/thinking-orbs/engine.es.js";

const HOLD = 6.5; // seconds on each design
const MORPH = 1.25; // seconds for the swirl from one to the next
const TINTS = 4; // depth bands, one sprite each

interface Sprite {
  readonly img: HTMLCanvasElement;
  /** Radius of the sprite's visible glow relative to the dot radius. */
  readonly k: number;
}

function makeSprites(dark: boolean, dpr: number): Sprite[] {
  // Back to front: deep blue to hot white. On light paper: ink blue, darker in front.
  const darkStops: [string, string][] = [
    ["rgba(80,120,255,1)", "rgba(47,91,224,0)"],
    ["rgba(60,190,255,1)", "rgba(56,120,255,0)"],
    ["rgba(110,235,255,1)", "rgba(56,216,255,0)"],
    ["rgba(220,252,255,1)", "rgba(77,227,255,0)"],
  ];
  const lightStops: [string, string][] = [
    ["rgba(90,130,230,1)", "rgba(90,130,230,0)"],
    ["rgba(40,95,220,1)", "rgba(40,95,220,0)"],
    ["rgba(18,70,200,1)", "rgba(18,70,200,0)"],
    ["rgba(8,40,150,1)", "rgba(8,40,150,0)"],
  ];
  const stops = dark ? darkStops : lightStops;
  const R = 24;
  return stops.map(([inner, outer]) => {
    const c = document.createElement("canvas");
    c.width = c.height = Math.round(R * 2 * dpr);
    const g = c.getContext("2d");
    if (g !== null) {
      g.scale(dpr, dpr);
      const grad = g.createRadialGradient(R, R, 0, R, R, R);
      grad.addColorStop(0, dark ? "rgba(255,255,255,1)" : inner);
      grad.addColorStop(dark ? 0.08 : 0.2, inner);
      // A crisp core (the dot itself) inside a thin, quickly fading halo: light, not haze.
      grad.addColorStop(dark ? 0.15 : 0.28, inner);
      grad.addColorStop(dark ? 0.22 : 0.34, inner.replace(/,1\)$/, dark ? ",0.32)" : ",0.18)"));
      grad.addColorStop(0.5, inner.replace(/,1\)$/, dark ? ",0.07)" : ",0.03)"));
      grad.addColorStop(1, outer);
      g.fillStyle = grad;
      g.fillRect(0, 0, R * 2, R * 2);
    }
    // The core edge sits at about 0.2 of the sprite radius: a dot of radius r needs a sprite of r / 0.2.
    return { img: c, k: dark ? 1 / 0.2 : 1 / 0.33 };
  });
}

export function mountHeroOrb(host: HTMLElement): void {
  const phone = matchMedia("(pointer: coarse)").matches || window.innerWidth < 760;
  const size = Math.round(Math.min(host.clientWidth || 320, host.clientHeight || 320));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = h("canvas", { class: "orb-canvas", attrs: { "aria-hidden": "true" } });
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const button = h("button", { class: "orb-button", attrs: { type: "button", "aria-label": "Next orb design" } }, [canvas]);
  host.replaceChildren(button);
  host.removeAttribute("aria-hidden"); // the host is now a real control, not decoration
  const ctx = canvas.getContext("2d");
  if (ctx === null) return;

  let dark = document.documentElement.dataset["theme"] !== "light";
  let sprites = makeSprites(dark, dpr);
  onThemeChange((theme) => {
    dark = theme !== "light";
    sprites = makeSprites(dark, dpr);
    ticker.wake();
  });

  // The engine draws into a square of `inner` px; we centre it with room for the glow.
  const inner = size * 0.86;
  const off = (size - inner) / 2;
  const c = size / 2;
  let index = 1; // searching
  let from = -1; // -1: the first design assembles out of nothing
  let morph = prefersReducedMotion() ? 1 : 0; // 0..1 while morphing
  let held = 0;
  let time = 0;
  let flash = 0;
  // Pointer push (mouse only), in canvas px; -1e4 means away.
  let mx = -1e4;
  let my = -1e4;
  let push = 0;

  const frameOf = (state: number, t: number): OrbFrame | null => {
    const name = ORB_STATES[state] ?? "working";
    const { mode, speed, opts } = resolvePreset(name, 64);
    const fn = MODE_FRAMES[mode];
    return fn === undefined ? null : fn(inner, t * speed, opts);
  };

  /** Draws one design. `swirl` (radians) spins it about the centre, `spread` pushes it outward. */
  const paint = (frame: OrbFrame, alpha: number, swirl: number, spread: number): void => {
    if (alpha <= 0.01) return;
    const cs = Math.cos(swirl);
    const sn = Math.sin(swirl);
    for (const l of frame.lines) {
      const a = (l.a ?? 1) * alpha * (1 - Math.min(1, Math.max(0, l.white)));
      if (a < 0.02) continue;
      ctx.globalAlpha = a * (dark ? 0.55 : 0.5);
      ctx.strokeStyle = dark ? "#6fe8ff" : "#1747c9";
      ctx.lineWidth = Math.max(0.6, l.w);
      ctx.beginPath();
      ctx.moveTo(off + l.x1, off + l.y1);
      ctx.lineTo(off + l.x2, off + l.y2);
      ctx.stroke();
    }
    for (const d of frame.dots) {
      const ink = 1 - Math.min(1, Math.max(0, d.white));
      const a = (d.a ?? 1) * alpha;
      if (a < 0.02) continue;
      let x = off + d.x - c;
      let y = off + d.y - c;
      if (swirl !== 0 || spread !== 0) {
        // Outer dots travel further: the vortex shears as it turns.
        const rr = Math.hypot(x, y) / (inner / 2);
        const s = 1 + spread * (0.6 + rr);
        const sw = swirl * (0.7 + rr * 0.6);
        const cw = sw === swirl ? cs : Math.cos(sw);
        const sw2 = sw === swirl ? sn : Math.sin(sw);
        const nx = (x * cw - y * sw2) * s;
        y = (x * sw2 + y * cw) * s;
        x = nx;
      }
      x += c;
      y += c;
      if (push > 0.01) {
        const dx = x - mx;
        const dy = y - my;
        const d2 = dx * dx + dy * dy;
        const R = size * 0.22;
        if (d2 < R * R) {
          const dd = Math.sqrt(d2) || 1;
          const f = (1 - dd / R) ** 2 * push * size * 0.08;
          x += (dx / dd) * f;
          y += (dy / dd) * f;
        }
      }
      const band = Math.min(TINTS - 1, Math.floor(ink * TINTS));
      const sp = sprites[band];
      if (sp === undefined) continue;
      const r = Math.max(0.6, d.r) * sp.k * (1.2 + flash * 0.5);
      // The engine dims dots its scan has not reached; on a hero orb they still need to glow.
      ctx.globalAlpha = Math.min(1, (0.25 + a * 1.2) * (0.6 + 0.4 * ink));
      ctx.drawImage(sp.img, x - r, y - r, r * 2, r * 2);
    }
  };

  const next = (): void => {
    from = index;
    index = (index + 1) % ORB_STATES.length;
    morph = calm ? 1 : 0;
    held = 0;
  };

  const calm = prefersReducedMotion();
  let drawn = 0;
  const ticker = addTicker(42, (dt) => {
    if (!calm) {
      time += dt;
      held += dt;
      if (held > HOLD && morph >= 1) next();
      if (morph < 1) morph = Math.min(1, morph + dt / MORPH);
    }
    push += ((mx > -1e3 ? 1 : 0) - push) * (1 - Math.exp(-dt * 6));
    // The flash peaks where the two designs cross.
    flash = morph < 1 ? Math.sin(Math.PI * morph) ** 2 : 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, size, size);
    ctx.globalCompositeOperation = dark ? "lighter" : "source-over";
    if (morph < 1) {
      const m = ease(morph);
      const out = from < 0 ? null : frameOf(from, time);
      const into = frameOf(index, time);
      if (out !== null) paint(out, 1 - Math.min(1, m * 1.35), m * 2.4, m * 0.55);
      if (into !== null) paint(into, Math.min(1, m * 1.25), -(1 - m) * 2.4, (1 - m) * 0.55);
    } else {
      const f = frameOf(index, time);
      if (f !== null) paint(f, 1, 0, 0);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    drawn += 1;
    return !calm || morph < 1 || push > 0.01;
  });

  button.addEventListener("click", () => {
    next();
    ticker.wake();
    if (calm) return;
    button.animate([{ transform: "scale(1)" }, { transform: "scale(0.93)" }, { transform: "scale(1)" }], { duration: 560, easing: EASE });
  });
  if (!phone) {
    canvas.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" || calm) return;
      const r = canvas.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
      ticker.wake();
    });
    canvas.addEventListener("pointerleave", () => {
      mx = my = -1e4;
    });
  }
  watchVisible(host, (v) => (v ? ticker.wake() : ticker.sleep()), "0px", true);
  if (perfEnabled) {
    Reflect.set(window, "__orb", { state: () => ({ index, morph, drawn, size, dpr }), next: () => button.click() });
  }
}
