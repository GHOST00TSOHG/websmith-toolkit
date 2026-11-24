// Paper pop-up world: WebGL2, no libraries.
// Pipeline per frame:
//   update walker + proximity triggers -> spawn confetti
//   pass 1: draw scene (paper shader) into an offscreen framebuffer (+ depth)
//   pass 2: tilt-shift blur + warm grade + vignette to the screen
import { PopupItem, SpatialHash, popPose, pathPoint } from "./popup.js";

// ---------------------------------------------------------------- math
const M = {
  mul(a, b) { const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0;
      for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; },
  ident() { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); },
  trans(x, y, z) { const m = M.ident(); m[12] = x; m[13] = y; m[14] = z; return m; },
  scale(x, y, z) { return new Float32Array([x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1]); },
  rotX(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]); },
  rotY(a) { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]); },
  persp(fov, asp, n, f) { const t = 1 / Math.tan(fov / 2);
    return new Float32Array([t / asp,0,0,0, 0,t,0,0, 0,0,(f + n) / (n - f),-1, 0,0,2 * f * n / (n - f),0]); },
  lookAt(e, c, u) {
    const sub = (a, b) => a.map((x, i) => x - b[i]), nrm = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
    const cr = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
    const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
    const z = nrm(sub(e, c)), x = nrm(cr(u, z)), y = cr(z, x);
    return new Float32Array([x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0, -dot(x,e),-dot(y,e),-dot(z,e),1]); },
};
const hex = (h) => [1, 3, 5].map((i) => ((parseInt(h.slice(i, i + 2), 16) / 255) ** 2.2)); // sRGB -> linear

// ------------------------------------------------------- geometry builder
// Every face gets uv in 0..1 so the shader can darken paper edges and add a
// crisp cut-line: that's most of the "papercraft" read.
class Geo {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.flat = false; }  // flat: no cut-edge lines
  quad(a, b, c, d, col) {                       // counter-clockwise a,b,c,d
    const e1 = b.map((v, i) => v - a[i]), e2 = d.map((v, i) => v - a[i]);
    const n = [e1[1]*e2[2]-e1[2]*e2[1], e1[2]*e2[0]-e1[0]*e2[2], e1[0]*e2[1]-e1[1]*e2[0]];
    const l = Math.hypot(...n) || 1; const nn = n.map((x) => x / l);
    const uvs = [[0,0],[1,0],[1,1],[0,1]], P = [a, b, c, d];
    for (const i of [0, 1, 2, 0, 2, 3]) { this.p.push(...P[i]); this.n.push(...nn); this.uv.push(...(this.flat ? [0.5, 0.5] : uvs[i])); this.c.push(...col); }
  }
  tri(a, b, c, col) {
    const e1 = b.map((v, i) => v - a[i]), e2 = c.map((v, i) => v - a[i]);
    const n = [e1[1]*e2[2]-e1[2]*e2[1], e1[2]*e2[0]-e1[0]*e2[2], e1[0]*e2[1]-e1[1]*e2[0]];
    const l = Math.hypot(...n) || 1;
    for (const [P, uv] of [[a,[0,0]],[b,[1,0]],[c,[0.5,1]]]) { this.p.push(...P); this.n.push(...n.map((x) => x / l)); this.uv.push(...(this.flat ? [0.5, 0.5] : uv)); this.c.push(...col); }
  }
  box(cx, cy, cz, sx, sy, sz, col) {            // cy = bottom of the box
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy, y1 = cy + sy, z0 = cz - sz / 2, z1 = cz + sz / 2;
    const shade = (k) => col.map((v) => v * k);
    this.quad([x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0], col);            // top
    this.quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1], shade(0.97));    // front +z
    this.quad([x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0], shade(0.97));    // back
    this.quad([x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1], shade(0.93));    // +x
    this.quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0], shade(0.93));    // -x
  }
  roof(cx, cy, cz, sx, h, sz, col, gable) {     // triangular prism along x
    const x0 = cx - sx / 2, x1 = cx + sx / 2, z0 = cz - sz / 2, z1 = cz + sz / 2, y1 = cy + h;
    this.quad([x0,cy,z1],[x1,cy,z1],[x1,y1,cz],[x0,y1,cz], col);
    this.quad([x1,cy,z0],[x0,cy,z0],[x0,y1,cz],[x1,y1,cz], col.map((v) => v * 0.85));
    this.tri([x1,cy,z1],[x1,cy,z0],[x1,y1,cz], gable); this.tri([x0,cy,z0],[x0,cy,z1],[x0,y1,cz], gable);
  }
  card(cx, cy, cz, r, col, sides = 9, rot = 0) {  // flat cut-out disc standing up (tree canopy)
    const pts = []; for (let i = 0; i < sides; i++) { const a = rot + (i / sides) * Math.PI * 2;
      const rr = r * (0.82 + 0.18 * Math.sin(i * 2.3 + cx)); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
    for (let i = 0; i < sides; i++) { const a = pts[i], b = pts[(i + 1) % sides];
      this.tri([cx, cy, cz], [a[0], a[1], cz], [b[0], b[1], cz], col);
      this.tri([cx, cy, cz - 0.02], [b[0], b[1], cz - 0.02], [a[0], a[1], cz - 0.02], col.map((v) => v * 0.8)); }
  }
}

// ------------------------------------------------------------ the props
const C = { red: hex("#e2343f"), cream: hex("#f4e6cf"), pink: hex("#f2b8c6"), rose: hex("#d97a93"),
  blue: hex("#8fa6c9"), navy: hex("#4a5d86"), wood: hex("#9b6b4a"), yellow: hex("#f5c84c"),
  white: hex("#fbf6ee"), black: hex("#202024"), green: hex("#6fa86b"), lav: hex("#b9a7d9") };

const PROPS = {
  house(g) { g.box(0, 0, 0, 1.4, 0.9, 1.1, C.cream); g.roof(0, 0.9, 0, 1.6, 0.6, 1.3, C.red, C.white);
    g.box(0.35, 0.25, 0.56, 0.3, 0.3, 0.02, C.yellow); g.box(-0.3, 0, 0.56, 0.26, 0.5, 0.02, C.wood); },
  tree(g, tint = C.pink) { g.box(0, 0, 0, 0.14, 0.8, 0.14, C.wood);
    g.card(0, 1.05, 0.05, 0.55, tint); g.card(-0.25, 0.85, 0.12, 0.35, tint.map((v) => v * 0.9), 8, 1); },
  blueTree(g) { PROPS.tree(g, C.blue); },
  gate(g) { g.box(-0.9, 0, 0, 0.22, 1.5, 0.22, C.blue); g.box(0.9, 0, 0, 0.22, 1.5, 0.22, C.pink);
    g.box(0, 1.5, 0, 2.3, 0.28, 0.4, C.red); g.box(0, 1.78, 0, 0.5, 0.18, 0.2, C.yellow); },
  easel(g) { g.box(-0.25, 0, 0, 0.06, 1.0, 0.06, C.wood); g.box(0.25, 0, 0, 0.06, 1.0, 0.06, C.wood);
    g.box(0, 0.45, 0.04, 0.7, 0.55, 0.04, C.white); g.box(0, 0.55, 0.07, 0.5, 0.3, 0.01, C.lav); },
  pot(g) { g.box(0, 0, 0, 0.35, 0.3, 0.35, C.navy); g.card(0, 0.55, 0, 0.28, C.rose, 7); },
  tv(g) { g.box(0, 0, 0, 0.7, 0.6, 0.5, C.cream); g.box(0, 0.12, 0.26, 0.5, 0.35, 0.02, C.black);
    g.box(0, 0.2, 0.275, 0.3, 0.18, 0.01, C.rose); },
  arch(g) { const n = 8, R = 1.1;                 // octagonal ring standing up
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, b = ((i + 1) / n) * Math.PI * 2;
      const p = (t, r) => [Math.cos(t) * r, 1.4 + Math.sin(t) * r];
      const [ao, bo, bi, ai] = [p(a, R), p(b, R), p(b, R * 0.62), p(a, R * 0.62)];
      g.quad([...ao.slice(0,1), ao[1], 0.15], [bo[0], bo[1], 0.15], [bi[0], bi[1], 0.15], [ai[0], ai[1], 0.15], C.red); }
    g.box(0, 0, 0, 0.5, 0.35, 0.5, C.white); },
  flowers(g) { for (let i = 0; i < 5; i++) g.card(-0.4 + i * 0.2, 0.25 + (i % 2) * 0.08, 0, 0.12, [C.yellow, C.red, C.rose][i % 3], 6); },
};

function buildCat(g) {                           // voxel cat: black and white blocks
  const v = 0.12, B = C.black, W = C.white;
  const vox = (x, y, z, col) => g.box(x * v, y * v, z * v, v, v, v, col);
  for (let x = -1; x <= 1; x++) for (let z = -2; z <= 1; z++) for (let y = 1; y <= 2; y++) vox(x, y, z, (x === 1 && y === 2) ? W : B);
  for (let x = -1; x <= 1; x++) for (let y = 3; y <= 4; y++) for (let z = 1; z <= 2; z++) vox(x, y, z, x >= 0 ? W : B);
  vox(-1, 5, 2, B); vox(1, 5, 2, W);                                     // ears
  for (const [x, z] of [[-1,-2],[1,-2],[-1,1],[1,1]]) vox(x, 0, z, B);   // legs
  vox(0, 3, -3, B); vox(0, 4, -3, B);                                     // tail
}

function buildGround(g, path) {
  // Layered paper sheets with jittered (torn) edges: pink land, blue river, cream path.
  const N = 64, jit = (i, s) => 1 + 0.05 * Math.sin(i * 7.1 + s) + 0.03 * Math.sin(i * 17.3 + s * 2);
  g.flat = true;
  const sheet = (cx, cz, r, y, col, seed) => {          // darker under-layer peeks out = paper thickness/shadow
    disc(cx + 0.06, cz + 0.08, r * 1.015, y - 0.004, col.map((v) => v * 0.72), seed); disc(cx, cz, r, y, col, seed); };
  const disc = (cx, cz, r, y, col, seed) => { for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, b = ((i + 1) / N) * Math.PI * 2;
    g.tri([cx, y, cz], [cx + Math.cos(b) * r * jit(i + 1, seed), y, cz + Math.sin(b) * r * jit(i + 1, seed)],
          [cx + Math.cos(a) * r * jit(i, seed), y, cz + Math.sin(a) * r * jit(i, seed)], col); } };
  disc(0, 0, 30, 0, C.pink, 1);
  sheet(-6, 4, 7, 0.014, C.blue, 3); sheet(7, -5, 6, 0.014, C.blue, 5);
  sheet(0, -9, 4.2, 0.026, C.cream, 7);                                   // plaza
  const S = 200, w = 0.85;                                                // path ribbon
  for (let i = 0; i < S; i++) {
    const a = pathPoint(path, i / S), b = pathPoint(path, (i + 1) / S);
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
    const wa = w * jit(i, 9), wb = w * jit(i + 1, 9), ea = wa + 0.07, eb = wb + 0.07, dk = C.cream.map((v) => v * 0.72);
    g.quad([a[0] - nx * ea, 0.024, a[1] - nz * ea], [a[0] + nx * ea, 0.024, a[1] + nz * ea],
           [b[0] + nx * eb, 0.024, b[1] + nz * eb], [b[0] - nx * eb, 0.024, b[1] - nz * eb], dk);
    g.quad([a[0] - nx * wa, 0.03, a[1] - nz * wa], [a[0] + nx * wa, 0.03, a[1] + nz * wa],
           [b[0] + nx * wb, 0.03, b[1] + nz * wb], [b[0] - nx * wb, 0.03, b[1] - nz * wb], C.cream);
  }
}

// ---------------------------------------------------------------- shaders
const SCENE_VS = `#version 300 es
in vec3 aPos; in vec3 aNor; in vec2 aUV; in vec3 aCol;
uniform mat4 uVP, uModel;
out vec3 vNor, vCol, vWorld; out vec2 vUV;
void main(){ vec4 w = uModel * vec4(aPos,1.0); vWorld = w.xyz;
  vNor = mat3(uModel) * aNor; vCol = aCol; vUV = aUV; gl_Position = uVP * w; }`;

const SCENE_FS = `#version 300 es
precision highp float;
in vec3 vNor, vCol, vWorld; in vec2 vUV;
uniform vec3 uSun; uniform float uAlpha;
out vec4 o;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
void main(){
  vec3 n = normalize(vNor); if (!gl_FrontFacing) n = -n;   // paper is two-sided
  // paper fibres: fine grain + stretched fibres + soft blotches (world-space, so it doesn't swim)
  vec2 q = vWorld.xz * 1.0 + vWorld.y;
  float grain = vn(q * 90.0) * 0.5 + vn(q * 37.0 + 3.1) * 0.5;
  float fiber = vn(vec2(q.x * 160.0, q.y * 12.0));
  float blot = vn(q * 3.0);
  vec3 col = vCol * (0.9 + 0.1 * grain) * (0.95 + 0.05 * fiber) * (0.95 + 0.07 * blot);
  // cut-edge darkening near face borders (the 'papercraft' tell)
  float e = min(min(vUV.x, 1.0 - vUV.x), min(vUV.y, 1.0 - vUV.y));
  col *= mix(0.8, 1.0, smoothstep(0.0, 0.06, e));
  // soft studio light: wrapped diffuse (paper scatters light) + sky/ground ambient
  float wrap = clamp((dot(n, uSun) + 0.35) / 1.35, 0.0, 1.0);
  vec3 amb = mix(vec3(0.55,0.45,0.5), vec3(0.75,0.78,0.9), n.y * 0.5 + 0.5);
  vec3 lit = col * (amb * 0.55 + vec3(1.05,0.97,0.9) * wrap * 0.8);
  o = vec4(lit, uAlpha);
}`;

const POST_VS = `#version 300 es
in vec2 aP; out vec2 vUV; void main(){ vUV = aP * 0.5 + 0.5; gl_Position = vec4(aP, 0, 1); }`;

// Tilt-shift: blur radius grows with distance from a horizontal focus band,
// so the scene reads as a tiny physical model. Then warm grade, vignette, grain.
const POST_FS = `#version 300 es
precision highp float;
in vec2 vUV; uniform sampler2D uTex; uniform vec2 uRes; uniform float uFocus, uBand, uMaxBlur, uTime;
out vec4 o;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
void main(){
  float d = max(abs(vUV.y - uFocus) - uBand, 0.0);
  float r = clamp(d * 3.0, 0.0, 1.0) * uMaxBlur;
  vec3 acc = texture(uTex, vUV).rgb; float wsum = 1.0;
  for (int i = 0; i < 24; i++) {                    // golden-angle disc samples
    float fi = float(i) + 0.5, a = fi * 2.39996, rr = sqrt(fi / 24.0) * r;
    vec2 off = vec2(cos(a), sin(a)) * rr / uRes;
    acc += texture(uTex, vUV + off).rgb; wsum += 1.0;
  }
  vec3 c = acc / wsum;
  c = aces(c * 1.1);
  c = pow(c, vec3(1.0/2.2));
  c *= vec3(1.03, 1.0, 0.96);                                       // warm grade
  vec2 v = vUV - 0.5; c *= 1.0 - 0.35 * dot(v, v) * 1.6;           // vignette
  c += (fract(sin(dot(vUV * uRes + uTime, vec2(12.9898,78.233))) * 43758.5453) - 0.5) * 0.025;  // grain
  o = vec4(c, 1.0);
}`;

// ------------------------------------------------------------- the world
export function createWorld(canvas, { reducedMotion = false } = {}) {
  const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const compile = (vs, fs) => { const p = gl.createProgram();
    for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const sh = gl.createShader(t);
      gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      gl.attachShader(p, sh); }
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); return p; };
  const scene = compile(SCENE_VS, SCENE_FS), post = compile(POST_VS, POST_FS);

  const upload = (g) => { const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    for (const [name, data, size] of [["aPos", g.p, 3], ["aNor", g.n, 3], ["aUV", g.uv, 2], ["aCol", g.c, 3]]) {
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW);
      const loc = gl.getAttribLocation(scene, name); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0); }
    return { vao, count: g.p.length / 3 }; };

  // Walk path and the props placed along it
  const path = [[0, 10], [1.5, 6], [0.5, 2], [-1, -2], [0, -6], [0.5, -10], [-3, -12], [-6, -6], [-5, 2], [-3, 8]];
  const ground = new Geo(); buildGround(ground, path); const groundMesh = upload(ground);
  const catGeo = new Geo(); buildCat(catGeo); const catMesh = upload(catGeo);
  const shGeo = new Geo(); shGeo.flat = true;             // soft contact shadow: a dark disc, drawn translucent
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, b = ((i + 1) / 24) * Math.PI * 2;
    shGeo.tri([0, 0.05, 0], [Math.cos(b), 0.05, Math.sin(b)], [Math.cos(a), 0.05, Math.sin(a)], [0.32, 0.16, 0.22]); }
  const shadowMesh = upload(shGeo);
  const SHADOW_R = { house: 1.1, tree: 0.6, blueTree: 0.6, gate: 1.3, easel: 0.5, pot: 0.35, tv: 0.55, arch: 1.0, flowers: 0.5 };
  const meshes = Object.fromEntries(Object.entries(PROPS).map(([k, f]) => { const g = new Geo(); f(g); return [k, upload(g)]; }));

  const layout = [
    ["house", 2.4, 7.2, -0.3], ["blueTree", -1.7, 7.8, 0], ["tv", 3.2, 4.6, -0.5], ["pot", -1.6, 5.2, 0],
    ["gate", 0.8, 3.4, 0.05], ["tree", 3.0, 2.0, 0], ["easel", -2.2, 1.4, 0.4], ["flowers", 2.2, 0.0, -0.2],
    ["blueTree", -2.8, -1.5, 0], ["tree", 2.4, -3.2, 0], ["pot", -1.8, -4.4, 0], ["tv", 2.6, -6.0, -0.4],
    ["arch", 0.0, -10.2, 0], ["tree", -2.6, -8.6, 0], ["tree", 3.0, -8.4, 0], ["flowers", 1.7, -11.6, 0],
    ["tree", -5.4, -10.6, 0], ["house", -8.2, -7.0, 0.8], ["blueTree", -7.6, -3.0, 0], ["easel", -3.6, -3.2, -0.6],
    ["tree", -7.2, 1.2, 0], ["pot", -3.4, 3.6, 0], ["flowers", -4.6, 6.2, 0.3], ["tree", -1.2, 10.8, 0],
  ];
  const hash = new SpatialHash(4);
  const items = layout.map(([kind, x, z, rot], id) => {
    const it = new PopupItem({ id, x, z, enter: kind === "arch" ? 4.5 : 3.4, delay: (id % 3) * 0.07 });
    Object.assign(it, { kind, rot }); hash.insert(it); return it; });

  // Confetti: little paper squares that tumble and flutter down
  const confetti = [];
  const palette = [C.red, C.yellow, C.rose, C.lav, C.blue, C.white];
  const burst = (x, z, n = 26) => { if (reducedMotion) return;
    for (let i = 0; i < n; i++) confetti.push({ p: [x, 0.6, z], v: [(Math.random() - 0.5) * 3, 3 + Math.random() * 3, (Math.random() - 0.5) * 3],
      a: Math.random() * 6, s: (Math.random() - 0.5) * 12, life: 2.2 + Math.random(), col: palette[i % palette.length] }); };
  const confettiMesh = upload(new Geo());

  // Offscreen target for the tilt-shift pass
  let fbo, tex, depth, W = 0, H = 0;
  const resize = () => { const dpr = Math.min(devicePixelRatio, 2);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (w === W && h === H) return; W = canvas.width = w; H = canvas.height = h;
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    const ext = gl.getExtension("EXT_color_buffer_half_float");
    gl.texImage2D(gl.TEXTURE_2D, 0, ext ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, ext ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    depth = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, depth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth); };
  const quadVAO = gl.createVertexArray(); gl.bindVertexArray(quadVAO);
  const qb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, qb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(gl.getAttribLocation(post, "aP")); gl.vertexAttribPointer(gl.getAttribLocation(post, "aP"), 2, gl.FLOAT, false, 0, 0);

  const U = (p, n) => gl.getUniformLocation(p, n);
  const sun = [0.45, 0.8, 0.4].map((v, _, a) => v / Math.hypot(...a));
  let cam = null, walkU = 0, lastNow = 0, popped = 0;
  const state = { get popped() { return popped; }, get confetti() { return confetti.length; } };

  function frame(now, render = true) {        // render=false: simulate only (fast-forward)
    const dt = Math.min(now - lastNow, 1 / 20); lastNow = now;
    // walker: follow the path (or keyboard input if given)
    walkU += dt * 0.03;
    const p = pathPoint(path, walkU), ahead = pathPoint(path, walkU + 0.003);
    const heading = Math.atan2(ahead[0] - p[0], ahead[1] - p[1]);
    // proximity triggers (only nearby items are tested, via the spatial hash)
    for (const it of hash.near(p[0], p[1], 5)) if (it.update(p[0], p[1], now) === "popped") { popped++; burst(it.x, it.z); }
    // confetti physics: gravity + air drag + flutter (sideways sway while falling)
    const g = new Geo();
    const want = [p[0] + 6.5, 8.5, p[1] + 9.5];
    if (!cam || reducedMotion) cam = want.slice();
    else { const k = 1 - Math.exp(-2.5 * dt); cam = cam.map((v, i) => v + (want[i] - v) * k); }
    for (let i = confetti.length - 1; i >= 0; i--) { const c = confetti[i];
      c.life -= dt; if (c.life <= 0 || c.p[1] < 0.02) { if (c.life <= 0) { confetti.splice(i, 1); continue; } c.p[1] = 0.035; c.v = [0, 0, 0]; }
      c.v[1] -= 9.8 * dt * 0.35; c.v = c.v.map((v) => v * Math.exp(-2.2 * dt));
      c.p = c.p.map((v, k) => v + c.v[k] * dt + (k === 0 ? Math.sin(now * 6 + i) * 0.004 : 0)); c.a += c.s * dt;
      const s = 0.07, ca = Math.cos(c.a) * s, sa = Math.sin(c.a) * s, [x, y, z] = c.p;
      g.quad([x - ca, y - sa, z - sa], [x + sa, y - ca, z + ca], [x + ca, y + sa, z + sa], [x - sa, y + ca, z - ca], c.col); }
    if (!render) return;
    gl.bindVertexArray(confettiMesh.vao);
    for (const [name, data] of [["aPos", g.p], ["aNor", g.n], ["aUV", g.uv], ["aCol", g.c]]) {
      const loc = gl.getAttribLocation(scene, name); const b = gl.getVertexAttrib(loc, gl.VERTEX_ATTRIB_ARRAY_BUFFER_BINDING);
      gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.DYNAMIC_DRAW); }
    confettiMesh.count = g.p.length / 3;

    // camera: high angle, narrow FOV (miniature look), smoothly trailing the walker
    const target = [p[0], 0.4, p[1]];
    resize();
    const vp = M.mul(M.persp(0.55, W / H, 0.5, 80), M.lookAt(cam, target, [0, 1, 0]));

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, W, H);
    gl.clearColor(0.93, 0.82, 0.84, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.useProgram(scene);
    gl.uniformMatrix4fv(U(scene, "uVP"), false, vp); gl.uniform3fv(U(scene, "uSun"), sun); gl.uniform1f(U(scene, "uAlpha"), 1);
    const draw = (mesh, model) => { gl.uniformMatrix4fv(U(scene, "uModel"), false, model); gl.bindVertexArray(mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, mesh.count); };
    draw(groundMesh, M.ident());
    // contact shadows first (blended, no depth write) so pieces feel glued to the paper
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    for (const it of items) { const pr = Math.min(it.progress(now, reducedMotion), 1); if (pr <= 0.001) continue;
      gl.uniform1f(U(scene, "uAlpha"), 0.3 * pr); const r = SHADOW_R[it.kind] * (0.4 + 0.6 * pr);
      draw(shadowMesh, M.mul(M.trans(it.x + 0.12, 0, it.z + 0.1), M.scale(r, 1, r * 0.8))); }
    gl.uniform1f(U(scene, "uAlpha"), 0.35); draw(shadowMesh, M.mul(M.trans(p[0], 0, p[1]), M.scale(0.32, 1, 0.38)));
    gl.disable(gl.BLEND); gl.depthMask(true); gl.uniform1f(U(scene, "uAlpha"), 1);
    for (const it of items) {
      const pose = popPose(it.progress(now, reducedMotion));
      if (!pose.visible) continue;
      // hinge at the base: rotate about X at ground level, so the piece folds UP like a pop-up page
      const model = M.mul(M.mul(M.trans(it.x, 0, it.z), M.rotY(it.rot)), M.mul(M.rotX(pose.fold), M.scale(pose.scaleXZ, pose.scaleY, pose.scaleXZ)));
      draw(meshes[it.kind], model);
    }
    const bob = Math.abs(Math.sin(now * 9)) * 0.06;                         // walk bounce
    draw(catMesh, M.mul(M.trans(p[0], 0.04 + bob, p[1]), M.mul(M.rotY(heading), M.rotX(Math.sin(now * 9) * 0.05))));
    if (confettiMesh.count) draw(confettiMesh, M.ident());

    // post: tilt-shift to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.disable(gl.DEPTH_TEST);
    gl.useProgram(post); gl.bindVertexArray(quadVAO); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(U(post, "uTex"), 0); gl.uniform2f(U(post, "uRes"), W, H); gl.uniform1f(U(post, "uFocus"), 0.48);
    gl.uniform1f(U(post, "uBand"), 0.12); gl.uniform1f(U(post, "uMaxBlur"), reducedMotion ? 4 : 9 * Math.min(devicePixelRatio, 2));
    gl.uniform1f(U(post, "uTime"), now % 10);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  return { frame, state, items };
}
