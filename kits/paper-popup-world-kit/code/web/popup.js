// Proximity-triggered pop-up logic: pure functions + a small state machine.
// No rendering here, so it runs in the browser and in Node tests alike.

/** Damped-spring step response: 0 -> 1 with overshoot (zeta < 1) and settle.
 *  t in seconds; freq in Hz; zeta = damping ratio. Exact closed form, so it is
 *  frame-rate independent (unlike integrating a spring per frame). */
export function springStep(t, freq = 2.2, zeta = 0.42) {
  if (t <= 0) return 0;
  const w = 2 * Math.PI * freq;
  if (zeta >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);       // critically damped
  const wd = w * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + (zeta * w / wd) * Math.sin(wd * t));
}

/** Pose of a pop-up item for "progress" p (raw spring output, may overshoot 1).
 *  Pop-up book feel = the piece *folds up from lying flat* around its base
 *  hinge (rotation), while scaling up slightly and squashing on landing. */
export function popPose(p, { foldFrom = -Math.PI / 2, minScale = 0.35 } = {}) {
  const fold = foldFrom * (1 - p);                    // -90deg (flat) -> 0 (upright), overshoots past 0
  const s = minScale + (1 - minScale) * Math.min(Math.max(p, 0), 1.25);
  const squash = 1 + 0.18 * Math.sin(Math.min(Math.max(p, 0), 1) * Math.PI) * (p > 0.85 ? 1 : 0);
  return { fold, scaleXZ: s * squash, scaleY: s / squash, visible: p > 0.001 };
}

/** One item's trigger with hysteresis: appears when the player comes within
 *  `enter`, and (if reversible) folds away only after the player is beyond `exit`.
 *  The gap between enter and exit stops flicker when standing on the boundary. */
export class PopupItem {
  constructor({ id, x, z, enter = 3.2, exit = 4.5, delay = 0, once = true }) {
    Object.assign(this, { id, x, z, enter, exit, delay, once });
    this.state = "hidden";        // hidden -> rising -> shown (-> falling -> hidden if !once)
    this.t0 = 0;                  // time the current transition started
  }

  update(px, pz, now) {
    const d = Math.hypot(px - this.x, pz - this.z);
    if (this.state === "hidden" && d < this.enter) {
      this.state = "rising"; this.t0 = now + this.delay; return "popped";
    }
    if (!this.once && (this.state === "shown" || this.state === "rising") && d > this.exit) {
      this.state = "falling"; this.t0 = now; return "folded";
    }
    if (this.state === "falling" && d < this.enter) { this.state = "rising"; this.t0 = now; return "popped"; }
    if (this.state === "rising" && now - this.t0 > 2.5) this.state = "shown";
    if (this.state === "falling" && now - this.t0 > 0.6) this.state = "hidden";
    return null;
  }

  /** Spring progress at time `now` (0 = flat/hidden, ~1 = upright). */
  progress(now, reducedMotion = false) {
    const t = now - this.t0;
    if (this.state === "hidden") return 0;
    if (this.state === "falling") return Math.max(0, 1 - t / 0.6) ** 2;
    if (t < 0) return 0;                                    // staggered delay not reached yet
    if (reducedMotion) return Math.min(1, t / 0.25);       // quick fade-in, no bounce
    return springStep(t);
  }
}

/** Uniform grid so each frame only tests items near the player: O(nearby) instead
 *  of O(all). Matters once a world has thousands of pop-up pieces. */
export class SpatialHash {
  constructor(cell = 4) { this.cell = cell; this.map = new Map(); }
  key(x, z) { return `${Math.floor(x / this.cell)},${Math.floor(z / this.cell)}`; }
  insert(item) {
    const k = this.key(item.x, item.z);
    if (!this.map.has(k)) this.map.set(k, []);
    this.map.get(k).push(item);
  }
  near(x, z, radius) {
    const out = [], c = this.cell, r = Math.ceil(radius / c);
    const cx = Math.floor(x / c), cz = Math.floor(z / c);
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
      const list = this.map.get(`${cx + i},${cz + j}`);
      if (list) out.push(...list);
    }
    return out;
  }
}

/** Centripetal-ish Catmull-Rom through waypoints (closed loop), for the walk path. */
export function pathPoint(pts, u) {
  const n = pts.length, x = ((u % 1) + 1) % 1 * n, i = Math.floor(x), t = x - i;
  const P = (k) => pts[((i + k) % n + n) % n];
  const [p0, p1, p2, p3] = [P(-1), P(0), P(1), P(2)];
  const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t ** 3);
  return [cr(p0[0], p1[0], p2[0], p3[0]), cr(p0[1], p1[1], p2[1], p3[1])];
}
