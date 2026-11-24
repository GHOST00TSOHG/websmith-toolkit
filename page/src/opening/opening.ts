// The opening: one dramatic sweep. The page starts under a blueprint sheet (a static CSS veil, painted with
// the first frame). Builder cursors fly out of the brand mark and, together, draw the outline of
// everything on the first screen in one pass: the header pill, the orb's circle, the greeting, the
// buttons, the banner. The outlines flash and fill, then the sheet opens as a ring of light from the orb
// and the real page shows through. Any tap, key or scroll skips straight to the reveal.
// Cost: ONE fixed canvas (DPR capped, smaller on phones), pre-rendered sprites, typed-array sparks, the
// shared loop. The canvas is freed the moment the reveal ends. Never runs under reduced motion.
import { h } from "../core/dom.ts";
import { makeRng } from "../core/rng.ts";
import { addTicker } from "../engine/loop.ts";
import { ease } from "../engine/motion.ts";
import { perfEnabled } from "../engine/perf.ts";
import { perimeter, pointAt, type Box } from "./geometry.ts";
import { makeSprites, SPRITE, TIP_X, TIP_Y } from "./sprites.ts";

/** Everything on the first screen that gets drawn, in reading order. */
const TARGETS = ".topbar, #hero-orb, .hero-title, .name-row > *, .hero-actions > :not([hidden]), #cloth-stage, .section-head, #toolbar, .toolkit-list";
const SPARKS = 160;

/** The greeting is written, not boxed: its glyphs are stroked, revealed left to right under the pen. */
interface Glyphs {
  str: string;
  font: string;
  spacing: string;
  /** Baseline, in viewport px. */
  base: number;
}

interface Shape {
  readonly el: Element;
  readonly box: Box;
  readonly text: Glyphs | null;
  /** Outline length when the sweep was planned (px). */
  readonly len: number;
}

/** One cursor's share of the sweep: a run of outline pieces, each reached by a short flight. */
interface Piece {
  readonly shape: number;
  /** Fractions of the shape's outline, 0..1. */
  readonly u0: number;
  readonly u1: number;
  /** Where this piece starts on the cursor's effort axis, and how long its flight and its stroke are. */
  readonly at: number;
  readonly fly: number;
  readonly draw: number;
}

interface Cursor {
  readonly pieces: Piece[];
  readonly effort: number;
  readonly tool: 0 | 1;
  x: number;
  y: number;
  px: number;
  py: number;
  alpha: number;
}

export interface OpeningOptions {
  /** Shorter timings: returning visitors and Wake. */
  readonly quick: boolean;
  readonly seed: number;
}

let running: Promise<void> | null = null;

/** True while the opening owns the screen. */
export const openingRunning = (): boolean => running !== null;

/** Plays the opening once. Resolves when the page is fully revealed and the canvas is gone. */
export function playOpening(opts: OpeningOptions): Promise<void> {
  if (running !== null) return running;
  running = new Promise<void>((resolve) => run(opts, () => {
    running = null;
    resolve();
  }));
  return running;
}

function run(opts: OpeningOptions, done: () => void): void {
  const root = document.documentElement;
  const phone = matchMedia("(pointer: coarse)").matches || window.innerWidth < 760;
  const dpr = Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 1.75);
  const rng = makeRng(opts.seed + 11);
  const canvas = h("canvas", { class: "opening-canvas", attrs: { "aria-hidden": "true" } });
  const ctxOrNull = canvas.getContext("2d", { alpha: true });
  const finish = (): void => {
    canvas.width = 0;
    canvas.height = 0;
    canvas.remove();
    root.classList.remove("opening", "opening-live");
    root.dataset["stage"] = "live";
    document.dispatchEvent(new Event("ws:reveal"));
    document.dispatchEvent(new Event("ws:opened"));
    done();
  };
  if (ctxOrNull === null) {
    finish();
    return;
  }
  const ctx = ctxOrNull;
  root.classList.add("opening");
  root.dataset["stage"] = "opening";
  document.body.append(canvas);

  // ---- timings (seconds)
  const k = opts.quick ? 0.6 : 1;
  const DRAW = 1.25 * k; // the sweep itself
  const FILL = 0.32 * k; // outlines flash and fill
  const REVEAL = 0.75 * (opts.quick ? 0.75 : 1); // the sheet opens

  // ---- size
  let W = 0;
  let H = 0;
  const grid = { minor: new Path2D(), major: new Path2D() };
  const resize = (): void => {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    grid.minor = new Path2D();
    grid.major = new Path2D();
    for (let x = 0.5; x < W; x += 24) (Math.round(x - 0.5) % 96 === 0 ? grid.major : grid.minor).rect(x, 0, 0, H);
    for (let y = 0.5; y < H; y += 24) (Math.round(y - 0.5) % 96 === 0 ? grid.major : grid.minor).rect(0, y, W, 0);
  };
  resize();
  const onResize = (): void => {
    resize();
    measure();
  };
  window.addEventListener("resize", onResize);

  // ---- look
  const css = getComputedStyle(root);
  const dark = root.dataset["theme"] !== "light";
  const bg = css.getPropertyValue("--bg").trim() || (dark ? "#040914" : "#eaf2fc");
  const line = css.getPropertyValue("--line").trim() || "#4de3ff";
  const soft = dark ? "77,227,255" : "23,71,201";
  const core = dark ? "#eafdff" : line;
  const sprites = makeSprites(dpr, dark);
  const blend: GlobalCompositeOperation = dark ? "lighter" : "source-over";

  // ---- shapes on the first screen
  const shapes: Shape[] = [];
  const isText = (el: Element): boolean => el.classList.contains("hero-title");
  const rectOf = (el: Element): DOMRect => {
    if (isText(el)) {
      // The words, not the full-width block.
      const range = document.createRange();
      range.selectNodeContents(el);
      return range.getBoundingClientRect();
    }
    return el.getBoundingClientRect();
  };
  const glyphsOf = (el: Element, box: Box, out: Glyphs | null): Glyphs => {
    const cs = getComputedStyle(el);
    const g = out ?? { str: "", font: "", spacing: "0px", base: 0 };
    g.str = el.textContent ?? "";
    g.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    g.spacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
    ctx.font = g.font;
    // The text's content box is the font's ascent plus descent, so the baseline sits one ascent down.
    const m = ctx.measureText(g.str);
    const asc = m.fontBoundingBoxAscent;
    const desc = m.fontBoundingBoxDescent;
    g.base = box.y + (Number.isFinite(asc) && asc + desc > 0 ? (box.h * asc) / (asc + desc) : box.h * 0.78);
    return g;
  };
  const radiusOf = (el: Element, r: DOMRect): number => {
    if (el.id === "hero-orb") return Math.min(r.width, r.height) / 2;
    const v = Number.parseFloat(getComputedStyle(el).borderTopLeftRadius);
    return Math.min(Number.isFinite(v) ? v : 0, r.width / 2, r.height / 2);
  };
  const boxOf = (el: Element, out: Box): void => {
    const r = rectOf(el);
    let { left: x, top: y, width: w, height: hh } = r;
    if (el.id === "hero-orb") {
      // The orb's circle, centred in its host.
      const d = Math.min(w, hh);
      x += (w - d) / 2;
      y += (hh - d) / 2;
      w = hh = d;
    }
    out.x = x;
    out.y = y;
    out.w = w;
    out.h = hh;
    out.r = radiusOf(el, new DOMRect(x, y, w, hh));
  };
  for (const el of document.querySelectorAll(TARGETS)) {
    if (el instanceof HTMLElement && el.closest("[hidden]") !== null) continue;
    const box: Box = { x: 0, y: 0, w: 0, h: 0, r: 0 };
    boxOf(el, box);
    if (box.w < 8 || box.h < 8 || box.y > H - 4 || box.y + box.h < 0) continue;
    const text = isText(el) ? glyphsOf(el, box, null) : null;
    shapes.push({ el, box, text, len: text === null ? perimeter(box) : box.w * 1.6 });
  }
  function measure(): void {
    for (const s of shapes) {
      boxOf(s.el, s.box);
      if (s.text !== null) glyphsOf(s.el, s.box, s.text);
    }
  }
  /** Outline length now: the rounded box's perimeter, or for words their width (the pen's run). */
  const lengthOf = (s: Shape): number => (s.text === null ? perimeter(s.box) : s.box.w);
  /** The pen's point at `d` px along a shape. Over words it bobs like handwriting. */
  const pointOn = (s: Shape, d: number, out: { x: number; y: number }): void => {
    if (s.text === null) {
      pointAt(s.box, d, out);
      return;
    }
    out.x = s.box.x + Math.max(0, Math.min(s.box.w, d));
    out.y = s.box.y + s.box.h * (0.5 + 0.22 * Math.sin(d * 0.11));
  };

  // ---- plan: cut the whole outline (every shape, in reading order) into equal runs, one per cursor
  const brand = document.querySelector(".brand svg")?.getBoundingClientRect();
  const homeX = brand === undefined ? 28 : brand.left + brand.width / 2;
  const homeY = brand === undefined ? 28 : brand.top + brand.height / 2;
  const total = shapes.reduce((sum, s) => sum + s.len, 0);
  const count = Math.max(1, Math.min(phone ? 3 : 5, Math.ceil(total / 900)));
  const pt = { x: 0, y: 0 };
  const cursors: Cursor[] = [];
  {
    let shape = 0;
    let along = 0; // px into the current shape
    for (let c = 0; c < count; c += 1) {
      let need = total / count;
      const pieces: Piece[] = [];
      let effort = 0;
      let fromX = homeX;
      let fromY = homeY;
      while (need > 0.5 && shape < shapes.length) {
        const s = shapes[shape];
        if (s === undefined) break;
        const take = Math.min(need, s.len - along);
        pointOn(s, (along / s.len) * lengthOf(s), pt);
        const fly = Math.hypot(pt.x - fromX, pt.y - fromY) * 0.35;
        pieces.push({ shape, u0: along / s.len, u1: (along + take) / s.len, at: effort, fly, draw: take });
        effort += fly + take;
        pointOn(s, ((along + take) / s.len) * lengthOf(s), pt);
        fromX = pt.x;
        fromY = pt.y;
        need -= take;
        along += take;
        if (along >= s.len - 0.5) {
          shape += 1;
          along = 0;
        }
      }
      cursors.push({ pieces, effort: Math.max(1, effort), tool: c % 3 === 2 ? 1 : 0, x: homeX, y: homeY, px: homeX, py: homeY, alpha: 0 });
    }
  }
  /** How much of each shape is drawn, per piece (0..1), written every frame. */
  const drawn = cursors.map((c) => new Float32Array(c.pieces.length));

  // ---- sparks
  const sx = new Float32Array(SPARKS);
  const sy = new Float32Array(SPARKS);
  const svx = new Float32Array(SPARKS);
  const svy = new Float32Array(SPARKS);
  const sl = new Float32Array(SPARKS);
  let sparkAt = 0;
  const emit = (x: number, y: number, n: number, power: number): void => {
    for (let i = 0; i < n; i += 1) {
      const a = rng() * Math.PI * 2;
      const v = (40 + rng() * 140) * power;
      sx[sparkAt] = x;
      sy[sparkAt] = y;
      svx[sparkAt] = Math.cos(a) * v;
      svy[sparkAt] = Math.sin(a) * v - 40;
      sl[sparkAt] = 0.3 + rng() * 0.35;
      sparkAt = (sparkAt + 1) % SPARKS;
    }
  };

  // ---- reveal origin: the orb (the page opens from it), else the middle of the screen
  const orb = document.getElementById("hero-orb")?.getBoundingClientRect();
  const ox = orb !== undefined && orb.width > 0 && orb.bottom > 0 && orb.top < H ? orb.left + orb.width / 2 : W / 2;
  const oy = orb !== undefined && orb.width > 0 && orb.bottom > 0 && orb.top < H ? orb.top + orb.height / 2 : H * 0.45;
  const far = Math.hypot(Math.max(ox, W - ox), Math.max(oy, H - oy)) + 80;

  // ---- skip: any deliberate input jumps to the reveal
  let t = 0;
  let revealAt = DRAW + FILL;
  let revealLen = REVEAL;
  const skip = (): void => {
    if (t >= revealAt) return;
    revealAt = t;
    revealLen = 0.45;
  };
  const inputs = ["pointerdown", "keydown", "wheel", "touchmove"] as const;
  for (const type of inputs) window.addEventListener(type, skip, { passive: true });

  // ---- frame
  const strokeShape = (sh: Shape, from: number, len: number, per: number, alpha: number, widthK: number): void => {
    const b = sh.box;
    if (sh.text !== null) {
      // Words: stroked glyphs, clipped to the part the pen has passed.
      const g = sh.text;
      ctx.save();
      ctx.beginPath();
      ctx.rect(b.x + from - 2, b.y - b.h, len + 4, b.h * 3);
      ctx.clip();
      ctx.setLineDash([]);
      ctx.font = g.font;
      ctx.letterSpacing = g.spacing;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      const passes: [number, number, string][] = phone
        ? [[0.4, 3.2, `rgb(${soft})`], [1, 1.2, core]]
        : [[0.14, 8, `rgb(${soft})`], [0.4, 3.2, `rgb(${soft})`], [1, 1.2, core]];
      for (const [a, w, c] of passes) {
        ctx.globalAlpha = alpha * a;
        ctx.lineWidth = w * widthK;
        ctx.strokeStyle = c;
        ctx.strokeText(g.str, b.x, g.base);
      }
      ctx.restore();
      return;
    }
    ctx.setLineDash(len >= per - 0.5 ? [] : [len, per + 2]);
    ctx.lineDashOffset = -from;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, b.r);
    if (!phone) {
      ctx.globalAlpha = alpha * 0.14;
      ctx.lineWidth = 8 * widthK;
      ctx.strokeStyle = `rgb(${soft})`;
      ctx.stroke();
    }
    ctx.globalAlpha = alpha * 0.4;
    ctx.lineWidth = 3.2 * widthK;
    ctx.strokeStyle = `rgb(${soft})`;
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1.4 * widthK;
    ctx.strokeStyle = core;
    ctx.stroke();
  };

  let frame = 0;
  let ended = false;
  let revealing = false;
  const end = (): void => {
    if (ended) return;
    ended = true;
    for (const type of inputs) window.removeEventListener(type, skip);
    window.removeEventListener("resize", onResize);
    ticker.remove();
    finish();
  };
  const tick = (dtRaw: number): boolean => {
    const dt = Math.min(dtRaw, 1 / 30);
    t += dt;
    frame += 1;
    if (frame % 6 === 0) measure();
    const sweep = Math.min(1, t / DRAW);
    const fill = Math.max(0, Math.min(1, (t - DRAW) / FILL));
    const rv = Math.max(0, Math.min(1, (t - revealAt) / revealLen));
    if (rv > 0 && !revealing) {
      // The page is about to show: the orb mounts now and assembles as the ring opens from it.
      revealing = true;
      document.dispatchEvent(new Event("ws:reveal"));
    }

    // Cursors walk their run: flights then strokes, all finishing together.
    const p = sweep < 1 ? 0.5 - 0.5 * Math.cos(Math.PI * sweep) : 1; // ease in-out along the effort axis
    for (let c = 0; c < cursors.length; c += 1) {
      const cur = cursors[c];
      const marks = drawn[c];
      if (cur === undefined || marks === undefined) continue;
      const e = p * cur.effort;
      cur.px = cur.x;
      cur.py = cur.y;
      let fromX = homeX;
      let fromY = homeY;
      for (let i = 0; i < cur.pieces.length; i += 1) {
        const pc = cur.pieces[i];
        const s = pc === undefined ? undefined : shapes[pc.shape];
        if (pc === undefined || s === undefined) continue;
        const per = lengthOf(s);
        const local = e - pc.at;
        if (local <= 0) {
          marks[i] = 0;
          continue;
        }
        if (local < pc.fly) {
          // In flight to this piece: a gentle arc.
          pointOn(s, pc.u0 * per, pt);
          const u = ease(local / pc.fly);
          const bend = Math.sin(Math.PI * u) * 0.18;
          cur.x = fromX + (pt.x - fromX) * u - (pt.y - fromY) * bend;
          cur.y = fromY + (pt.y - fromY) * u + (pt.x - fromX) * bend;
          marks[i] = 0;
        } else {
          const d = Math.min(1, (local - pc.fly) / Math.max(1, pc.draw));
          marks[i] = d;
          pointOn(s, (pc.u0 + (pc.u1 - pc.u0) * d) * per, pt);
          cur.x = pt.x;
          cur.y = pt.y;
          if (sweep < 1 && d < 1 && rng() < (phone ? 0.45 : 0.8)) emit(pt.x, pt.y, 1, 1);
        }
        pointOn(s, pc.u1 * per, pt);
        fromX = pt.x;
        fromY = pt.y;
      }
      // Fade in on the way out of the mark; leave with the reveal.
      const goal = t < revealAt ? 1 : 0;
      cur.alpha += (goal - cur.alpha) * (1 - Math.exp(-dt * (goal > 0 ? 10 : 14)));
      if (sweep >= 1 && fill > 0 && fill < 0.2 && frame % 3 === 0) emit(cur.x, cur.y, 3, 1.6);
    }

    // Sparks
    const drag = Math.exp(-dt * 3);
    let live = 0;
    for (let i = 0; i < SPARKS; i += 1) {
      const life = sl[i] ?? 0;
      if (life <= 0) continue;
      live += 1;
      sl[i] = life - dt;
      svx[i] = (svx[i] ?? 0) * drag;
      svy[i] = (svy[i] ?? 0) * drag + 120 * dt;
      sx[i] = (sx[i] ?? 0) + (svx[i] ?? 0) * dt;
      sy[i] = (sy[i] ?? 0) + (svy[i] ?? 0) * dt;
    }

    // ---- draw
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    // The blueprint sheet, with a hole that opens from the orb.
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const gridIn = Math.min(1, t / (0.35 * k));
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${soft},${(dark ? 0.07 : 0.09) * gridIn})`;
    ctx.stroke(grid.minor);
    ctx.strokeStyle = `rgba(${soft},${(dark ? 0.16 : 0.18) * gridIn})`;
    ctx.stroke(grid.major);
    if (rv > 0) {
      const R = ease(rv) * far;
      const edge = Math.min(140, R);
      ctx.globalCompositeOperation = "destination-out";
      const hole = ctx.createRadialGradient(ox, oy, Math.max(0, R - edge), ox, oy, R);
      hole.addColorStop(0, "rgba(0,0,0,1)");
      hole.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = hole;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
    }
    if (frame === 1) root.classList.add("opening-live"); // the canvas now carries the sheet; drop the CSS veil

    // Outlines: drawn so far, then all of them flashing and filling, then fading as the page shows.
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalCompositeOperation = blend;
    const flash = fill > 0 ? Math.sin(Math.PI * Math.min(1, fill * 1.4)) : 0;
    const fade = 1 - ease(rv);
    if (fade > 0.01) {
      if (sweep < 1) {
        for (let c = 0; c < cursors.length; c += 1) {
          const cur = cursors[c];
          const marks = drawn[c];
          if (cur === undefined || marks === undefined) continue;
          for (let i = 0; i < cur.pieces.length; i += 1) {
            const pc = cur.pieces[i];
            const d = marks[i] ?? 0;
            const s = pc === undefined ? undefined : shapes[pc.shape];
            if (pc === undefined || s === undefined || d <= 0) continue;
            const per = lengthOf(s);
            strokeShape(s, pc.u0 * per, (pc.u1 - pc.u0) * d * per, per, 1, 1);
          }
        }
      } else {
        for (const s of shapes) {
          const per = lengthOf(s);
          strokeShape(s, 0, per, per, fade, 1 + flash * 0.6);
          if (s.text === null && fill > 0) {
            // Blueprint construction ticks snap out of each corner as the outlines flash.
            const b = s.box;
            const L = 14 * ease(Math.min(1, fill * 2.2));
            ctx.setLineDash([]);
            ctx.globalAlpha = fade * 0.75;
            ctx.lineWidth = 1;
            ctx.strokeStyle = core;
            ctx.beginPath();
            for (const [cx, cy, sx2, sy2] of [[b.x, b.y, -1, -1], [b.x + b.w, b.y, 1, -1], [b.x, b.y + b.h, -1, 1], [b.x + b.w, b.y + b.h, 1, 1]] as const) {
              ctx.moveTo(cx + sx2 * 4, cy);
              ctx.lineTo(cx + sx2 * (4 + L), cy);
              ctx.moveTo(cx, cy + sy2 * 4);
              ctx.lineTo(cx, cy + sy2 * (4 + L));
            }
            ctx.stroke();
          }
          if (fill > 0 && s.text === null) {
            // The fill: a light sweep down through each panel, fading with the reveal.
            const b = s.box;
            const yy = b.y + b.h * ease(fill);
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(b.x, b.y, b.w, b.h, b.r);
            ctx.clip();
            const g = ctx.createLinearGradient(0, b.y, 0, yy);
            g.addColorStop(0, `rgba(${soft},0.02)`);
            g.addColorStop(1, `rgba(${soft},${(dark ? 0.22 : 0.14) * fade})`);
            ctx.globalAlpha = 1;
            ctx.fillStyle = g;
            ctx.fillRect(b.x, b.y, b.w, yy - b.y);
            ctx.restore();
          }
        }
      }
      // Ring of light on the opening edge.
      if (rv > 0 && rv < 1) {
        const R = ease(rv) * far;
        ctx.setLineDash([]);
        ctx.globalAlpha = (1 - rv) * 0.9;
        ctx.lineWidth = 2;
        ctx.strokeStyle = core;
        ctx.beginPath();
        ctx.arc(ox, oy, Math.max(1, R - 40), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = (1 - rv) * 0.3;
        ctx.lineWidth = 14;
        ctx.strokeStyle = `rgb(${soft})`;
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    // Sparks, motion trails and the cursors themselves.
    for (let i = 0; i < SPARKS; i += 1) {
      const life = sl[i] ?? 0;
      if (life <= 0) continue;
      ctx.globalAlpha = Math.min(1, life * 2.6);
      const size = 3 + life * 10;
      ctx.drawImage(sprites.spark, (sx[i] ?? 0) - size / 2, (sy[i] ?? 0) - size / 2, size, size);
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = line;
    for (const cur of cursors) {
      if (cur.alpha < 0.02) continue;
      const moved = Math.hypot(cur.x - cur.px, cur.y - cur.py);
      if (moved > 2) {
        ctx.globalAlpha = cur.alpha * 0.35;
        ctx.beginPath();
        ctx.moveTo(cur.px - (cur.x - cur.px) * 2, cur.py - (cur.y - cur.py) * 2);
        ctx.lineTo(cur.x, cur.y);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = "source-over";
    for (const cur of cursors) {
      if (cur.alpha < 0.02) continue;
      const sprite = sprites.cursors[cur.tool];
      const tilt = Math.max(-0.35, Math.min(0.35, (cur.x - cur.px) * 0.02));
      ctx.globalAlpha = cur.alpha;
      ctx.save();
      ctx.translate(cur.x, cur.y);
      ctx.rotate(tilt);
      ctx.drawImage(sprite, -TIP_X, -TIP_Y, SPRITE, SPRITE);
      ctx.restore();
      if (sweep < 1) {
        // The hot point where the tool meets the line.
        const pulse = 16 + Math.sin(t * 40 + cur.tool) * 4;
        ctx.globalCompositeOperation = blend;
        ctx.drawImage(sprites.spark, cur.x - pulse / 2, cur.y - pulse / 2, pulse, pulse);
        ctx.globalCompositeOperation = "source-over";
      }
    }
    ctx.globalAlpha = 1;

    if (perfEnabled) Reflect.set(window, "__opening", { t, rv, live, sweep, fill });
    // Done once the sheet is open and the last sparks are out (never later than a hard cap).
    if ((rv >= 1 && (live === 0 || t > revealAt + revealLen + 0.6)) || t > 8) {
      end();
      return false;
    }
    return true;
  };
  // Whatever happens, the opening never stays on screen: an error ends it at once.
  const ticker = addTicker(70, (dt) => {
    try {
      return tick(dt);
    } catch {
      end();
      return false;
    }
  });
}
