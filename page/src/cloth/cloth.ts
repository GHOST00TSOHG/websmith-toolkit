// The silk banner: a big woven Websmith banner hanging from a rod, alive in the wind (procedural-and-
// physics-animation, procedural-fx-patterns, motion-and-interaction-design).
// Physics: position-based cloth. Verlet points on a grid with structural, shear and bend constraints, the
// top row pinned to the rod, stepped at a fixed 120 Hz. Wind is aerodynamic (each quad is pushed along its
// normal by how squarely it faces the wind), from travelling noise, gusts that roll across as a wave, and
// the page's own scroll: scrolling blows through the cloth. A tap punches it with a ripple of light;
// a drag or a passing mouse brushes it.
// Light: WebGL2 shot silk. Warp and weft threads have different colours, so the colour shifts with the
// angle of each fold; a Kajiya-Kay sheen runs along whichever thread rides on top; a second light rims the
// folds; light shines through the back; the Websmith mark is woven in and glows on dark.
// Budget: ONE WebGL context on the page (this one), DPR capped at 2, no MSAA on phones, no allocation in
// the step or draw loops, paused off screen. Reduced motion: one still frame of the settled drape.
import { h } from "../core/dom.ts";
import { addTicker } from "../engine/loop.ts";
import { prefersReducedMotion } from "../engine/motion.ts";
import { perfEnabled } from "../engine/perf.ts";
import { watchVisible } from "../engine/visibility.ts";
import { currentTheme, onThemeChange } from "../theme/theme.ts";

const DT = 1 / 120;
const FOCAL = 1400;
const GRAVITY = 980;
const DAMP = 0.993;
const ITER = 4;

// --- noise -------------------------------------------------------------------------------------------
const PERM = new Uint8Array(512);
{
  let s = 0x9e3779b9;
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i -= 1) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    const t = p[i] ?? 0;
    p[i] = p[j] ?? 0;
    p[j] = t;
  }
  for (let i = 0; i < 512; i += 1) PERM[i] = p[i & 255] ?? 0;
}
const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
const grad = (hash: number, x: number, y: number): number => ((hash & 1) === 0 ? x : -x) + ((hash & 2) === 0 ? y : -y);
/** 2D gradient noise in about [-1, 1], quintic fade (C2 smooth). */
function noise2(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const X = xi & 255;
  const Y = yi & 255;
  const a = PERM[X + (PERM[Y] ?? 0)] ?? 0;
  const b = PERM[X + 1 + (PERM[Y] ?? 0)] ?? 0;
  const c = PERM[X + (PERM[Y + 1] ?? 0)] ?? 0;
  const d = PERM[X + 1 + (PERM[Y + 1] ?? 0)] ?? 0;
  const u = fade(xf);
  const v = fade(yf);
  const l1 = grad(a, xf, yf) + (grad(b, xf - 1, yf) - grad(a, xf, yf)) * u;
  const l2 = grad(c, xf, yf - 1) + (grad(d, xf - 1, yf - 1) - grad(c, xf, yf - 1)) * u;
  return l1 + (l2 - l1) * v;
}
const fbm = (x: number, y: number): number => noise2(x, y) * 0.6 + noise2(x * 2.03 + 17, y * 2.03) * 0.28 + noise2(x * 4.1 + 41, y * 4.1) * 0.12;

// --- shaders -----------------------------------------------------------------------------------------
const VS = `#version 300 es
in vec3 aPos; in vec3 aNrm; in vec3 aTan; in vec2 aUV;
uniform vec2 uSize; uniform vec2 uCenter; uniform float uF;
out vec2 vUV; out vec3 vN; out vec3 vT; out float vZ;
void main() {
  float s = uF / (uF - aPos.z);
  vec2 p = uCenter + (aPos.xy - uCenter) * s;
  gl_Position = vec4(p.x / uSize.x * 2.0 - 1.0, 1.0 - p.y / uSize.y * 2.0, 0.0, 1.0);
  vUV = aUV; vN = aNrm; vT = aTan; vZ = aPos.z;
}`;
const FS = `#version 300 es
precision highp float;
in vec2 vUV; in vec3 vN; in vec3 vT; in float vZ;
uniform sampler2D uMark; uniform vec2 uThreads;
uniform vec3 uWarp; uniform vec3 uWeft; uniform vec3 uAccent; uniform vec3 uSheen; uniform vec3 uBack;
uniform vec4 uRipple; uniform float uAspect; uniform float uDark; uniform float uTime; uniform vec2 uLight;
out vec4 o;
const float PI = 3.14159265;
// Kajiya-Kay: a thread of direction t is brightest where the half vector is perpendicular to it.
float kk(vec3 t, vec3 hv, float e) { float th = dot(t, hv); return pow(sqrt(max(0.0, 1.0 - th * th)), e); }
void main() {
  vec2 g = vUV * uThreads;
  vec2 c = floor(g);
  vec2 f = fract(g);
  float par = mod(c.x + c.y, 2.0);
  // A fine plain weave, faded out where threads get smaller than a pixel (no moire): silk is smooth.
  float aa = clamp(1.25 - max(fwidth(g.x), fwidth(g.y)) * 3.2, 0.0, 1.0);
  float weftH = sin(PI * f.y);
  float warpH = sin(PI * f.x);
  float hgt = mix(0.8, mix(warpH, weftH, par), aa * 0.4);
  bool back = !gl_FrontFacing;
  vec3 n = normalize(vN);
  if (back) n = -n;
  vec3 t = normalize(vT - n * dot(vT, n));
  vec3 b = normalize(cross(n, t));
  vec2 tilt = mix(vec2(-cos(PI * f.x), 0.0), vec2(0.0, -cos(PI * f.y)), par) * 0.12 * aa;
  vec3 nt = normalize(n + t * tilt.x + b * tilt.y);
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 L1 = normalize(vec3(uLight, 0.75));
  vec3 L2 = normalize(vec3(0.85, 0.3, 0.38));
  float ndv = clamp(dot(nt, V), 0.0, 1.0);
  // Shot silk: facing folds show the deep warp, folds turning away flare into the bright weft.
  float shot = smoothstep(0.0, 0.85, pow(1.0 - ndv, 1.1));
  vec3 base = mix(uWarp, uWeft, shot);
  // The woven mark and a faint blueprint grid (red channel: mark, green: grid).
  vec4 m = texture(uMark, vUV);
  float mark = m.r * (back ? 0.1 : 1.0);
  float gridl = m.g * (back ? 0.1 : 1.0);
  base = mix(base, uAccent, mark * 0.9 + gridl * 0.35);
  base *= 0.85 + 0.15 * hgt;
  float d1 = max(0.0, 0.35 + 0.65 * dot(nt, L1));
  d1 = d1 * d1;
  float d2 = max(0.0, dot(nt, L2));
  vec3 H1 = normalize(L1 + V);
  vec3 H2 = normalize(L2 + V);
  // Sheen runs along whichever thread rides on top; a broad lobe plus a sharp one.
  // Up close each thread has its own lobe; from arm's length the eye averages warp and weft.
  float s1t = kk(t, H1, 90.0) * 1.1 + kk(t, H1, 14.0) * 0.35;
  float s1b = kk(b, H1, 90.0) * 1.1 + kk(b, H1, 14.0) * 0.35;
  float s2t = kk(t, H2, 60.0) * 0.8;
  float s2b = kk(b, H2, 60.0) * 0.8;
  float own = aa * 0.5;
  float s1 = mix(0.5 * (s1t + s1b), par > 0.5 ? s1t : s1b, own);
  float s2 = mix(0.5 * (s2t + s2b), par > 0.5 ? s2t : s2b, own);
  float sheen = (s1 * d1 + s2 * d2) * (0.7 + 0.3 * hgt);
  // Folds pushed back from the rod sit in shadow.
  float occl = mix(0.55, 1.0, smoothstep(-220.0, 60.0, vZ));
  vec3 col = base * (0.08 + mix(0.62, 0.95, uDark) * d1 + 0.3 * d2) * occl;
  col += uSheen * sheen * mix(0.3, 0.75, uDark) * occl;
  if (back) col += uBack * 0.45 * max(0.0, dot(-n, L1));
  col += mix(uWeft, uSheen, 0.5) * pow(1.0 - ndv, 4.0) * mix(0.12, 0.35, uDark);
  col += uAccent * (mark + gridl * 0.25) * uDark * (0.35 + 0.5 * sheen);
  // A slow pass of light across the cloth now and then.
  float sweep = vUV.x * 0.8 + vUV.y * 0.45 - mod(uTime * 0.11, 3.2) + 0.6;
  col += uSheen * exp(-sweep * sweep * 10.0) * (0.05 + 0.35 * sheen);
  // Ripple of light from a touch: a bright ring and a softer echo inside it.
  vec2 dd = (vUV - uRipple.xy) * vec2(uAspect, 1.0);
  float rr = length(dd);
  float R = uRipple.z * 0.62;
  float ring = exp(-pow((rr - R) * 15.0, 2.0)) + 0.45 * exp(-pow((rr - R * 0.55) * 22.0, 2.0));
  col += mix(uSheen, uAccent, 0.6) * ring * uRipple.w * 0.9;
  float hem = smoothstep(0.985, 1.0, vUV.y) + smoothstep(0.01, 0.0, vUV.x) + smoothstep(0.99, 1.0, vUV.x);
  col *= 1.0 - 0.3 * clamp(hem, 0.0, 1.0);
  o = vec4(col, 1.0);
}`;

type RGB = [number, number, number];
interface Palette {
  warp: RGB;
  weft: RGB;
  accent: RGB;
  sheen: RGB;
  back: RGB;
  dark: boolean;
}
const hex = (s: string): RGB => [
  Number.parseInt(s.slice(1, 3), 16) / 255,
  Number.parseInt(s.slice(3, 5), 16) / 255,
  Number.parseInt(s.slice(5, 7), 16) / 255,
];
const palette = (): Palette =>
  currentTheme() === "light"
    ? { warp: hex("#8fb0f0"), weft: hex("#eaf2ff"), accent: hex("#1747c9"), sheen: hex("#ffffff"), back: hex("#7fa4f5"), dark: false }
    : { warp: hex("#06134a"), weft: hex("#1aa6f0"), accent: hex("#4de3ff"), sheen: hex("#8fe6ff"), back: hex("#2f6bff"), dark: true };

export interface ClothHandle {
  readonly mode: "webgl2" | "canvas2d";
}

export function mountCloth(stage: HTMLElement): ClothHandle | null {
  const calm = prefersReducedMotion();
  const phone = matchMedia("(pointer: coarse)").matches || window.innerWidth < 760;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const canvas = h("canvas", { class: "cloth-canvas", attrs: { role: "img", "aria-label": "Websmith banner woven from silk, moving in the wind" } });
  stage.prepend(canvas);
  const gl = canvas.getContext("webgl2", { antialias: !phone, premultipliedAlpha: true, alpha: true, powerPreference: "low-power" });
  const ctx2 = gl === null ? canvas.getContext("2d") : null;
  if (gl === null && ctx2 === null) return null;

  // Haptic tick on iPhone: a real switch input; clicking its label inside the user's own touch ticks.
  const sw = h("input", { class: "cloth-switch", attrs: { type: "checkbox", switch: "", id: "cloth-switch", tabindex: "-1", "aria-hidden": "true" } });
  const swLabel = h("label", { class: "cloth-switch", attrs: { for: "cloth-switch", "aria-hidden": "true" } });
  stage.append(sw, swLabel);

  const NX = phone ? 26 : 38;
  const NY = phone ? 22 : 24;
  const N = NX * NY;
  const pos = new Float32Array(N * 3);
  const prev = new Float32Array(N * 3);
  const nrm = new Float32Array(N * 3);
  const tan = new Float32Array(N * 3);
  const uv = new Float32Array(N * 2);
  const force = new Float32Array(N * 3);
  const restX = new Float32Array(N);
  const restY = new Float32Array(N);
  const idx = (i: number, j: number): number => j * NX + i;
  // Constraints: pairs, rest lengths and stiffness.
  const cons: number[] = [];
  const conK: number[] = [];
  const addCon = (a: number, b: number, k: number): void => {
    cons.push(a, b);
    conK.push(k);
  };
  for (let j = 0; j < NY; j += 1) {
    for (let i = 0; i < NX; i += 1) {
      if (i + 1 < NX) addCon(idx(i, j), idx(i + 1, j), 1);
      if (j + 1 < NY) addCon(idx(i, j), idx(i, j + 1), 1);
      if (i + 1 < NX && j + 1 < NY) {
        addCon(idx(i, j), idx(i + 1, j + 1), 0.7);
        addCon(idx(i + 1, j), idx(i, j + 1), 0.7);
      }
      // Bending: skip-one springs keep the silk from creasing over on itself.
      if (i + 2 < NX) addCon(idx(i, j), idx(i + 2, j), 0.45);
      if (j + 2 < NY) addCon(idx(i, j), idx(i, j + 2), 0.45);
    }
  }
  const C = new Uint16Array(cons);
  const CK = new Float32Array(conK);
  const CL = new Float32Array(CK.length);
  const tris: number[] = [];
  for (let j = 0; j < NY - 1; j += 1) {
    for (let i = 0; i < NX - 1; i += 1) tris.push(idx(i, j), idx(i + 1, j), idx(i, j + 1), idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1));
  }
  const TRI = new Uint16Array(tris);
  // The free bottom corners carry the most whip; a touch more drag there keeps them rippling, not flipping.
  const CORNERS = new Uint16Array([idx(0, NY - 1), idx(NX - 1, NY - 1), idx(1, NY - 1), idx(NX - 2, NY - 1)]);

  let tex: WebGLTexture | null = null;
  let prog: WebGLProgram | null = null;
  let posBuf: WebGLBuffer | null = null;
  let nrmBuf: WebGLBuffer | null = null;
  let tanBuf: WebGLBuffer | null = null;
  let W = 0;
  let H = 0;
  let rodY = 0;
  let clothW = 0;
  let clothH = 0;
  let x0 = 0;
  let threads: [number, number] = [120, 60];
  let pal = palette();

  /** Lays the cloth out under the rod at the current size. */
  const layout = (): void => {
    const r = stage.getBoundingClientRect();
    W = Math.max(1, r.width);
    H = Math.max(1, r.height);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    rodY = H * 0.07;
    clothW = W * (phone ? 0.9 : 0.88);
    clothH = H * 0.8;
    x0 = (W - clothW) / 2;
    for (let j = 0; j < NY; j += 1) {
      for (let i = 0; i < NX; i += 1) {
        const k = idx(i, j);
        const u = i / (NX - 1);
        const v = j / (NY - 1);
        restX[k] = x0 + u * clothW;
        restY[k] = rodY + v * clothH;
        // Start with a little sag so the first frames already hang.
        pos[k * 3] = restX[k] ?? 0;
        pos[k * 3 + 1] = restY[k] ?? 0;
        pos[k * 3 + 2] = -Math.sin(u * Math.PI) * v * 18;
        prev[k * 3] = pos[k * 3] ?? 0;
        prev[k * 3 + 1] = pos[k * 3 + 1] ?? 0;
        prev[k * 3 + 2] = pos[k * 3 + 2] ?? 0;
        uv[k * 2] = u;
        uv[k * 2 + 1] = v;
      }
    }
    for (let c = 0; c < CL.length; c += 1) {
      const a = C[c * 2] ?? 0;
      const b = C[c * 2 + 1] ?? 0;
      CL[c] = Math.hypot((restX[a] ?? 0) - (restX[b] ?? 0), (restY[a] ?? 0) - (restY[b] ?? 0));
    }
    // About one thread every 1.6 css px: fine silk, smooth at arm's length, woven up close.
    threads = [Math.round(clothW / 1.6), Math.round(clothH / 1.6)];
    buildMark();
  };

  // --- the woven mark: red is the mark, green a faint blueprint grid, sampled smoothly --------------------
  const mark = document.createElement("canvas");
  const buildMark = (): void => {
    // About one texel per css px (capped), so the mark's edges stay clean without a big texture.
    const k = Math.min(1.25, 1024 / Math.max(clothW, clothH));
    const tw = Math.max(64, Math.round(clothW * k));
    const th = Math.max(64, Math.round(clothH * k));
    mark.width = tw;
    mark.height = th;
    const m = mark.getContext("2d");
    if (m === null) return;
    m.fillStyle = "#000";
    m.fillRect(0, 0, tw, th);
    m.fillStyle = "rgb(0,110,0)";
    const cell = Math.max(18, Math.round(Math.min(tw, th) / 9));
    for (let x = cell / 2; x < tw; x += cell) m.fillRect(Math.round(x), 0, 1, th);
    for (let y = cell / 2; y < th; y += cell) m.fillRect(0, Math.round(y), tw, 1);
    // A double border band, like a woven selvedge.
    m.fillStyle = "rgb(0,255,0)";
    const inset = Math.round(Math.min(tw, th) * 0.045);
    m.strokeStyle = "rgb(0,255,0)";
    m.lineWidth = 1.5;
    m.strokeRect(inset, inset, tw - inset * 2, th - inset * 2);
    m.lineWidth = 0.8;
    m.strokeRect(inset + 5, inset + 5, tw - inset * 2 - 10, th - inset * 2 - 10);
    // The mark: a hexagon with a plus, and the word. Stacked on tall (phone) banners.
    const tall = th > tw * 0.9;
    const R = tall ? Math.min(tw * 0.16, th * 0.12) : Math.min(th * 0.2, tw * 0.08);
    const word = "Websmith";
    m.font = `600 ${Math.round(R * (tall ? 1.0 : 1.2))}px "Space Grotesk", system-ui, sans-serif`;
    const ww = m.measureText(word).width;
    let cx: number;
    let cy: number;
    let tx: number;
    let ty: number;
    if (tall) {
      cx = tw / 2;
      cy = th * 0.4;
      tx = tw / 2 - ww / 2;
      ty = cy + R * 1.85;
    } else {
      const total = R * 2 + R * 0.7 + ww;
      cx = tw / 2 - total / 2 + R;
      cy = th * 0.47;
      tx = cx + R * 1.7;
      ty = cy + R * 0.06;
    }
    m.strokeStyle = "rgb(255,0,0)";
    m.fillStyle = "rgb(255,0,0)";
    m.lineWidth = Math.max(1, R * 0.13);
    m.lineJoin = "round";
    m.beginPath();
    for (let q = 0; q < 6; q += 1) {
      const a = Math.PI / 6 + (q * Math.PI) / 3;
      const x = cx + Math.cos(a) * R;
      const y = cy + Math.sin(a) * R;
      if (q === 0) m.moveTo(x, y);
      else m.lineTo(x, y);
    }
    m.closePath();
    m.stroke();
    const pl = R * 0.45;
    m.fillRect(cx - pl, cy - m.lineWidth / 2, pl * 2, m.lineWidth);
    m.fillRect(cx - m.lineWidth / 2, cy - pl, m.lineWidth, pl * 2);
    m.textBaseline = "middle";
    m.fillText(word, tx, ty);
    if (gl !== null && tex !== null) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mark);
    }
  };

  // --- GL setup (after the first layout, so the buffers start with real positions and uvs) -------------
  layout();
  const U: Record<string, WebGLUniformLocation | null> = {};
  if (gl !== null) {
    const sh = (type: number, src: string): WebGLShader | null => {
      const s = gl.createShader(type);
      if (s === null) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) === true ? s : null;
    };
    const vs = sh(gl.VERTEX_SHADER, VS);
    const fs = sh(gl.FRAGMENT_SHADER, FS);
    prog = gl.createProgram();
    if (vs !== null && fs !== null && prog !== null) {
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (gl.getProgramParameter(prog, gl.LINK_STATUS) !== true) prog = null;
    } else prog = null;
    const pg = prog;
    if (pg !== null) {
      gl.useProgram(pg);
      // Triangles are wound in screen space (y down), which is clockwise once y flips for clip space.
      gl.frontFace(gl.CW);
      for (const n of ["uSize", "uCenter", "uF", "uMark", "uThreads", "uWarp", "uWeft", "uAccent", "uSheen", "uBack", "uRipple", "uAspect", "uDark", "uTime", "uLight"]) U[n] = gl.getUniformLocation(pg, n);
      const attr = (name: string, data: Float32Array, size: number, usage: number): WebGLBuffer | null => {
        const loc = gl.getAttribLocation(pg, name);
        const b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b);
        gl.bufferData(gl.ARRAY_BUFFER, data, usage);
        if (loc >= 0) {
          gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
        }
        return b;
      };
      posBuf = attr("aPos", pos, 3, gl.DYNAMIC_DRAW);
      nrmBuf = attr("aNrm", nrm, 3, gl.DYNAMIC_DRAW);
      tanBuf = attr("aTan", tan, 3, gl.DYNAMIC_DRAW);
      attr("aUV", uv, 2, gl.STATIC_DRAW);
      const ib = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, TRI, gl.STATIC_DRAW);
      tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
  }
  buildMark();
  const useGL = gl !== null && prog !== null;

  // --- wind ------------------------------------------------------------------------------------------------
  let t = 0;
  let gustAt = 2 + Math.random() * 2.5;
  let gustStart = -99;
  let gustAmp = 0;
  const gustEnv = (): number => {
    const a = t - gustStart;
    if (a < 0) return 0;
    const attack = Math.min(1, a / 0.7);
    return gustAmp * attack * attack * (3 - 2 * attack) * Math.exp(-Math.max(0, a - 0.7) / 1.6);
  };
  let windNow = 0;
  // Scroll blows through the cloth: the page's scroll speed becomes a push that decays.
  let scrollKick = 0;
  let scrollDir = 0;
  let lastY = window.scrollY;
  let lastScrollT = performance.now();
  window.addEventListener(
    "scroll",
    () => {
      if (calm || !visible) return;
      const now = performance.now();
      const dy = window.scrollY - lastY;
      const dtS = Math.max(8, now - lastScrollT) / 1000;
      lastY = window.scrollY;
      lastScrollT = now;
      const v = Math.max(-4000, Math.min(4000, dy / dtS));
      scrollKick = Math.min(1.6, scrollKick + Math.abs(v) / 2600);
      scrollDir = Math.sign(v);
      ticker.wake();
    },
    { passive: true },
  );

  // --- pointer ---------------------------------------------------------------------------------------------
  const ripple = { x: 0.5, y: 0.5, age: 9, strength: 0 };
  const push = (px: number, py: number, vx: number, vy: number, depth: number, radius: number): void => {
    const r2 = radius * radius;
    for (let k = NX; k < N; k += 1) {
      const dx = (pos[k * 3] ?? 0) - px;
      const dy = (pos[k * 3 + 1] ?? 0) - py;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const f = 1 - Math.sqrt(d2) / radius;
      const w = f * f * (3 - 2 * f);
      prev[k * 3] = (prev[k * 3] ?? 0) - vx * w * DT;
      prev[k * 3 + 1] = (prev[k * 3 + 1] ?? 0) - vy * w * DT;
      prev[k * 3 + 2] = (prev[k * 3 + 2] ?? 0) + depth * w * DT;
    }
  };
  let lastP = { x: 0, y: 0, t: 0, on: false };
  const local = (e: PointerEvent): { x: number; y: number } => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const tap = (x: number, y: number, strength: number): void => {
    push(x, y, 0, 0, 900 * strength, (phone ? 110 : 140) * Math.sqrt(strength));
    ripple.x = (x - x0) / clothW;
    ripple.y = (y - rodY) / clothH;
    ripple.age = 0;
    ripple.strength = Math.min(1, strength);
    ticker.wake();
  };
  canvas.addEventListener("pointerdown", (e) => {
    if (calm) return;
    const p = local(e);
    tap(p.x, p.y, 1);
    lastP = { x: p.x, y: p.y, t: e.timeStamp, on: true };
    if (e.pointerType === "touch") {
      swLabel.click();
      if (typeof navigator.vibrate === "function") navigator.vibrate(8);
    }
  });
  canvas.addEventListener("pointermove", (e) => {
    if (calm) return;
    const p = local(e);
    if (lastP.on) {
      const dtm = Math.max(8, e.timeStamp - lastP.t) / 1000;
      const vx = Math.max(-1800, Math.min(1800, (p.x - lastP.x) / dtm));
      const vy = Math.max(-1800, Math.min(1800, (p.y - lastP.y) / dtm));
      const speed = Math.hypot(vx, vy);
      if (speed > 30) push(p.x, p.y, vx * 0.4, vy * 0.4, Math.min(600, speed * 0.45), phone ? 64 : 84);
    }
    lastP = { x: p.x, y: p.y, t: e.timeStamp, on: true };
  });
  canvas.addEventListener("pointerleave", () => {
    lastP.on = false;
  });

  // --- simulation --------------------------------------------------------------------------------------------
  const addForce = (k: number, fx: number, fy: number, fz: number): void => {
    force[k * 3] = (force[k * 3] ?? 0) + fx;
    force[k * 3 + 1] = (force[k * 3 + 1] ?? 0) + fy;
    force[k * 3 + 2] = (force[k * 3 + 2] ?? 0) + fz;
  };
  const step = (): void => {
    t += DT;
    if (!calm && t > gustAt) {
      gustStart = t;
      gustAmp = 0.9 + Math.random() * 1.1;
      gustAt = t + 3 + Math.random() * 4.5;
    }
    scrollKick *= Math.exp(-DT * 1.8);
    const base = calm ? 0.3 : 0.4 + 0.32 * fbm(t * 0.12, 3.7);
    windNow = Math.max(0, base + gustEnv() + scrollKick);
    const strength = windNow * 560;
    const dirX = calm ? 0.2 : 0.42 + 0.38 * noise2(t * 0.07, 9.1);
    const lift = -0.08 - 0.35 * scrollKick * scrollDir;
    force.fill(0);
    for (let j = 0; j < NY - 1; j += 1) {
      const v = j / (NY - 1);
      for (let i = 0; i < NX - 1; i += 1) {
        const a = idx(i, j);
        const b = a + 1;
        const c = a + NX;
        const d = c + 1;
        const e1x = (pos[d * 3] ?? 0) - (pos[a * 3] ?? 0);
        const e1y = (pos[d * 3 + 1] ?? 0) - (pos[a * 3 + 1] ?? 0);
        const e1z = (pos[d * 3 + 2] ?? 0) - (pos[a * 3 + 2] ?? 0);
        const e2x = (pos[c * 3] ?? 0) - (pos[b * 3] ?? 0);
        const e2y = (pos[c * 3 + 1] ?? 0) - (pos[b * 3 + 1] ?? 0);
        const e2z = (pos[c * 3 + 2] ?? 0) - (pos[b * 3 + 2] ?? 0);
        let nx = e1y * e2z - e1z * e2y;
        let ny = e1z * e2x - e1x * e2z;
        let nz = e1x * e2y - e1y * e2x;
        const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= nl;
        ny /= nl;
        nz /= nl;
        const u = i / (NX - 1);
        // The field travels sideways across the cloth, so a gust arrives as a rolling wave; the free
        // bottom flutters more than the top.
        const field = (0.6 + 0.75 * noise2(u * 3.4 - t * 1.2 * (0.6 + dirX), v * 2.4 + t * 0.25)) * (0.75 + 0.6 * v);
        const wx = dirX * strength * field;
        const wy = lift * strength * field;
        const wz = strength * field;
        const dot = (nx * wx + ny * wy + nz * wz) * 0.25;
        const fx = nx * dot;
        const fy = ny * dot;
        const fz = nz * dot;
        addForce(a, fx, fy, fz);
        addForce(b, fx, fy, fz);
        addForce(c, fx, fy, fz);
        addForce(d, fx, fy, fz);
      }
    }
    const dt2 = DT * DT;
    for (let k = NX; k < N; k += 1) {
      for (let ax = 0; ax < 3; ax += 1) {
        const q = k * 3 + ax;
        const x = pos[q] ?? 0;
        const vel = (x - (prev[q] ?? 0)) * DAMP;
        prev[q] = x;
        pos[q] = x + vel + ((force[q] ?? 0) + (ax === 1 ? GRAVITY : 0)) * dt2;
      }
      // Keep the cloth within the depth the camera frames.
      const zq = k * 3 + 2;
      if ((pos[zq] ?? 0) > 170) pos[zq] = 170;
      if ((pos[zq] ?? 0) < -260) pos[zq] = -260;
    }
    for (let it = 0; it < ITER; it += 1) {
      for (let c = 0; c < CL.length; c += 1) {
        const a = C[c * 2] ?? 0;
        const b = C[c * 2 + 1] ?? 0;
        const dx = (pos[b * 3] ?? 0) - (pos[a * 3] ?? 0);
        const dy = (pos[b * 3 + 1] ?? 0) - (pos[a * 3 + 1] ?? 0);
        const dz = (pos[b * 3 + 2] ?? 0) - (pos[a * 3 + 2] ?? 0);
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        const diff = ((len - (CL[c] ?? 0)) / len) * (CK[c] ?? 1);
        const wa = a < NX ? 0 : 1;
        const wb = b < NX ? 0 : 1;
        const ws = wa + wb;
        if (ws === 0) continue;
        const sa = (diff * wa) / ws;
        const sb = (diff * wb) / ws;
        pos[a * 3] = (pos[a * 3] ?? 0) + dx * sa;
        pos[a * 3 + 1] = (pos[a * 3 + 1] ?? 0) + dy * sa;
        pos[a * 3 + 2] = (pos[a * 3 + 2] ?? 0) + dz * sa;
        pos[b * 3] = (pos[b * 3] ?? 0) - dx * sb;
        pos[b * 3 + 1] = (pos[b * 3 + 1] ?? 0) - dy * sb;
        pos[b * 3 + 2] = (pos[b * 3 + 2] ?? 0) - dz * sb;
      }
    }
    unfold();
    untangle();
    for (let n = 0; n < CORNERS.length; n += 1) {
      const k = CORNERS[n] ?? 0;
      for (let ax = 0; ax < 3; ax += 1) {
        const q = k * 3 + ax;
        prev[q] = (prev[q] ?? 0) + ((pos[q] ?? 0) - (prev[q] ?? 0)) * 0.03;
      }
    }
  };

  /** No fold-overs: within a row each point stays to the right of its neighbour, and within a column
   *  below the one above it (by a fraction of the rest spacing). Cheap one-sided constraints. */
  const unfold = (): void => {
    const minDx = (clothW / (NX - 1)) * 0.35;
    const minDy = (clothH / (NY - 1)) * 0.3;
    for (let j = 1; j < NY; j += 1) {
      for (let i = 0; i < NX; i += 1) {
        const k = idx(i, j);
        const up = k - NX;
        const gapY = (pos[k * 3 + 1] ?? 0) - (pos[up * 3 + 1] ?? 0);
        if (gapY < minDy) {
          const fix = minDy - gapY;
          if (j === 1) pos[k * 3 + 1] = (pos[k * 3 + 1] ?? 0) + fix;
          else {
            pos[k * 3 + 1] = (pos[k * 3 + 1] ?? 0) + fix * 0.5;
            pos[up * 3 + 1] = (pos[up * 3 + 1] ?? 0) - fix * 0.5;
          }
        }
        if (i > 0) {
          const left = k - 1;
          const gapX = (pos[k * 3] ?? 0) - (pos[left * 3] ?? 0);
          if (gapX < minDx) {
            const fix = (minDx - gapX) * 0.5;
            pos[k * 3] = (pos[k * 3] ?? 0) + fix;
            pos[left * 3] = (pos[left * 3] ?? 0) - fix;
          }
        }
      }
    }
  };

  /** Any triangle that still flipped (seen through the camera) has its free corners relaxed towards their
   *  neighbours' average: it smooths back out instead of showing its back. Rarely does any work. */
  const px = (k: number): number => W / 2 + ((pos[k * 3] ?? 0) - W / 2) * (FOCAL / (FOCAL - (pos[k * 3 + 2] ?? 0)));
  const py = (k: number): number => rodY + ((pos[k * 3 + 1] ?? 0) - rodY) * (FOCAL / (FOCAL - (pos[k * 3 + 2] ?? 0)));
  const relax = (k: number): void => {
    if (k < NX) return;
    const i = k % NX;
    const j = (k - i) / NX;
    let sx = 0;
    let sy = 0;
    let sz = 0;
    let n = 0;
    const add = (m: number): void => {
      sx += pos[m * 3] ?? 0;
      sy += pos[m * 3 + 1] ?? 0;
      sz += pos[m * 3 + 2] ?? 0;
      n += 1;
    };
    if (i > 0) add(k - 1);
    if (i < NX - 1) add(k + 1);
    if (j > 0) add(k - NX);
    if (j < NY - 1) add(k + NX);
    if (n === 0) return;
    pos[k * 3] = (pos[k * 3] ?? 0) * 0.4 + (sx / n) * 0.6;
    pos[k * 3 + 1] = (pos[k * 3 + 1] ?? 0) * 0.4 + (sy / n) * 0.6;
    pos[k * 3 + 2] = (pos[k * 3 + 2] ?? 0) * 0.4 + (sz / n) * 0.6;
  };
  const untangle = (): void => {
    for (let q = 0; q < TRI.length; q += 3) {
      const a = TRI[q] ?? 0;
      const b = TRI[q + 1] ?? 0;
      const c = TRI[q + 2] ?? 0;
      const area = (px(b) - px(a)) * (py(c) - py(a)) - (py(b) - py(a)) * (px(c) - px(a));
      if (area > 0) continue;
      relax(a);
      relax(b);
      relax(c);
    }
  };

  const addN = (k: number, x: number, y: number, z: number): void => {
    nrm[k * 3] = (nrm[k * 3] ?? 0) + x;
    nrm[k * 3 + 1] = (nrm[k * 3 + 1] ?? 0) + y;
    nrm[k * 3 + 2] = (nrm[k * 3 + 2] ?? 0) + z;
  };
  /** Vertex normals (area weighted) and tangents along the weft (u). */
  const frameVectors = (): void => {
    nrm.fill(0);
    for (let q = 0; q < TRI.length; q += 3) {
      const a = TRI[q] ?? 0;
      const b = TRI[q + 1] ?? 0;
      const c = TRI[q + 2] ?? 0;
      const ux = (pos[b * 3] ?? 0) - (pos[a * 3] ?? 0);
      const uy = (pos[b * 3 + 1] ?? 0) - (pos[a * 3 + 1] ?? 0);
      const uz = (pos[b * 3 + 2] ?? 0) - (pos[a * 3 + 2] ?? 0);
      const vx = (pos[c * 3] ?? 0) - (pos[a * 3] ?? 0);
      const vy = (pos[c * 3 + 1] ?? 0) - (pos[a * 3 + 1] ?? 0);
      const vz = (pos[c * 3 + 2] ?? 0) - (pos[a * 3 + 2] ?? 0);
      // With screen y pointing down, u x v of a clockwise-on-screen triangle points at the viewer (+z).
      const nx = uy * vz - uz * vy;
      const ny = uz * vx - ux * vz;
      const nz = ux * vy - uy * vx;
      addN(a, nx, ny, nz);
      addN(b, nx, ny, nz);
      addN(c, nx, ny, nz);
    }
    for (let j = 0; j < NY; j += 1) {
      for (let i = 0; i < NX; i += 1) {
        const k = idx(i, j);
        const l = i > 0 ? k - 1 : k;
        const r = i < NX - 1 ? k + 1 : k;
        tan[k * 3] = (pos[r * 3] ?? 0) - (pos[l * 3] ?? 0);
        tan[k * 3 + 1] = (pos[r * 3 + 1] ?? 0) - (pos[l * 3 + 1] ?? 0);
        tan[k * 3 + 2] = (pos[r * 3 + 2] ?? 0) - (pos[l * 3 + 2] ?? 0);
      }
    }
  };

  const draw = (): void => {
    frameVectors();
    if (useGL && gl !== null) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos);
      gl.bindBuffer(gl.ARRAY_BUFFER, nrmBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, nrm);
      gl.bindBuffer(gl.ARRAY_BUFFER, tanBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, tan);
      gl.uniform2f(U["uSize"] ?? null, W, H);
      gl.uniform2f(U["uCenter"] ?? null, W / 2, rodY);
      gl.uniform1f(U["uF"] ?? null, FOCAL);
      gl.uniform1i(U["uMark"] ?? null, 0);
      gl.uniform2f(U["uThreads"] ?? null, threads[0], threads[1]);
      gl.uniform3fv(U["uWarp"] ?? null, pal.warp);
      gl.uniform3fv(U["uWeft"] ?? null, pal.weft);
      gl.uniform3fv(U["uAccent"] ?? null, pal.accent);
      gl.uniform3fv(U["uSheen"] ?? null, pal.sheen);
      gl.uniform3fv(U["uBack"] ?? null, pal.back);
      const rs = ripple.strength * Math.max(0, 1 - ripple.age / 1.6);
      gl.uniform4f(U["uRipple"] ?? null, ripple.x, ripple.y, ripple.age, rs);
      gl.uniform1f(U["uAspect"] ?? null, clothW / Math.max(1, clothH));
      gl.uniform1f(U["uDark"] ?? null, pal.dark ? 1 : 0);
      gl.uniform1f(U["uTime"] ?? null, calm ? 4 : t);
      // The key light drifts slowly, so the sheen wanders even on a calm day.
      gl.uniform2f(U["uLight"] ?? null, -0.55 + 0.22 * Math.sin(t * 0.13), -0.6 + 0.12 * Math.cos(t * 0.09));
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.drawElements(gl.TRIANGLES, TRI.length, gl.UNSIGNED_SHORT, 0);
      return;
    }
    // Canvas 2D fallback: flat-shaded quads in the theme colours.
    const c2 = ctx2;
    if (c2 === null) return;
    c2.setTransform(dpr, 0, 0, dpr, 0, 0);
    c2.clearRect(0, 0, W, H);
    for (let j = 0; j < NY - 1; j += 1) {
      for (let i = 0; i < NX - 1; i += 1) {
        const a = idx(i, j);
        const nz = Math.abs(nrm[a * 3 + 2] ?? 0) / (Math.hypot(nrm[a * 3] ?? 0, nrm[a * 3 + 1] ?? 0, nrm[a * 3 + 2] ?? 0) || 1);
        const l = 0.45 + 0.55 * nz;
        const [r, g, b] = pal.weft;
        c2.fillStyle = `rgb(${Math.round(r * 255 * l)},${Math.round(g * 255 * l)},${Math.round(b * 255 * l)})`;
        c2.beginPath();
        c2.moveTo(px(a), py(a));
        c2.lineTo(px(a + 1), py(a + 1));
        c2.lineTo(px(a + NX + 1), py(a + NX + 1));
        c2.lineTo(px(a + NX), py(a + NX));
        c2.closePath();
        c2.fill();
      }
    }
  };

  let acc = 0;
  let visible = false;
  let frames = 0;
  // Let the cloth settle into its drape before the first frame anyone sees.
  for (let k = 0; k < 240; k += 1) step();
  const ticker = addTicker(60, (dt) => {
    if (!visible) return false;
    if (!calm) {
      acc += Math.min(dt, 1 / 20);
      let n = 0;
      while (acc >= DT && n < 4) {
        step();
        acc -= DT;
        n += 1;
      }
      if (acc >= DT) acc = 0;
      ripple.age += dt;
    }
    draw();
    frames += 1;
    return !calm; // reduced motion: one still frame, then the loop sleeps
  });
  // Losing the GPU context (memory pressure, a backgrounded tab) degrades to a still woven panel for
  // the rest of the visit: no restore loop.
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    visible = false;
    ticker.remove();
    canvas.width = 0;
    canvas.height = 0;
    canvas.remove();
    stage.classList.add("cloth-static");
  }, { once: true });
  watchVisible(stage, (vis) => {
    visible = vis;
    if (vis) ticker.wake();
  }, "80px");
  draw();

  onThemeChange(() => {
    pal = palette();
    draw();
  });
  let resizeTimer = 0;
  new ResizeObserver(() => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      const r = stage.getBoundingClientRect();
      // iOS toolbars change the height a little while scrolling: only a real change re-lays the cloth.
      if (Math.abs(r.width - W) < 1 && Math.abs(r.height - H) < 40) return;
      layout();
      if (useGL && gl !== null) {
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW);
      }
      for (let k = 0; k < 120; k += 1) step();
      draw();
    }, 120);
  }).observe(stage);
  void document.fonts.ready.then(() => {
    buildMark();
    draw();
  });

  /** Test hook: triangles currently showing their back (negative projected area). */
  const backWhere: number[] = [];
  const backCount = (): number => {
    let n = 0;
    backWhere.length = 0;
    for (let q = 0; q < TRI.length; q += 3) {
      const a = TRI[q] ?? 0;
      const b = TRI[q + 1] ?? 0;
      const c = TRI[q + 2] ?? 0;
      const area = (px(b) - px(a)) * (py(c) - py(a)) - (py(b) - py(a)) * (px(c) - px(a));
      if (area < 0) {
        n += 1;
        backWhere.push(a);
      }
    }
    return n;
  };
  const mode = useGL ? "webgl2" : "canvas2d";
  stage.dataset["cloth"] = mode;
  if (perfEnabled) {
    Reflect.set(window, "__cloth", {
      state: () => ({ mode, frames, wind: windNow, t, gust: gustEnv(), scroll: scrollKick, back: backCount(), where: backWhere.map((k) => [k % NX, Math.floor(k / NX)]) }),
      poke: (x: number, y: number) => tap(x, y, 1.2),
    });
  }
  return { mode };
}
