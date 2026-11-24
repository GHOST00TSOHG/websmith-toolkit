// Run:  node --test tests/   (from code/)
import { test } from "node:test";
import assert from "node:assert/strict";
import { springStep, popPose, PopupItem, SpatialHash, pathPoint } from "../web/popup.js";

test("spring starts at 0, overshoots, settles at 1", () => {
  assert.equal(springStep(0), 0);
  let peak = 0;
  for (let t = 0; t < 3; t += 0.005) peak = Math.max(peak, springStep(t));
  assert.ok(peak > 1.05 && peak < 1.4, `overshoot ${peak}`);
  assert.ok(Math.abs(springStep(4) - 1) < 1e-3);
});

test("critically damped spring never overshoots", () => {
  for (let t = 0; t < 3; t += 0.01) assert.ok(springStep(t, 2, 1) <= 1 + 1e-9);
});

test("pose folds from flat to upright", () => {
  const flat = popPose(0), up = popPose(1);
  assert.ok(Math.abs(flat.fold + Math.PI / 2) < 1e-9 && !flat.visible);
  assert.ok(Math.abs(up.fold) < 1e-9 && up.visible);
  assert.ok(Math.abs(up.scaleXZ * up.scaleY - 1) < 1e-9);   // squash preserves volume-ish
});

test("trigger fires once on enter, with delay", () => {
  const it = new PopupItem({ id: 1, x: 0, z: 0, enter: 3, exit: 5, delay: 0.2 });
  assert.equal(it.update(10, 0, 0), null);
  assert.equal(it.update(2, 0, 1), "popped");
  assert.equal(it.progress(1.1), 0);                // still inside the stagger delay
  assert.ok(it.progress(1.5) > 0);
  assert.equal(it.update(20, 0, 2), null);           // once=true: stays up when you leave
  assert.notEqual(it.state, "hidden");
});

test("reversible item uses hysteresis (no flicker at the boundary)", () => {
  const it = new PopupItem({ id: 1, x: 0, z: 0, enter: 3, exit: 5, once: false });
  it.update(2.9, 0, 0);                              // pops
  for (const d of [3.1, 2.95, 4.0, 4.9]) assert.equal(it.update(d, 0, 1), null);
  assert.equal(it.update(5.1, 0, 2), "folded");
  assert.equal(it.update(3.5, 0, 2.1), null);        // between enter and exit: no re-pop
  assert.equal(it.update(2.5, 0, 2.2), "popped");
});

test("reduced motion: no overshoot", () => {
  const it = new PopupItem({ id: 1, x: 0, z: 0 });
  it.update(0, 0, 0);
  for (let t = 0; t < 2; t += 0.01) assert.ok(it.progress(t, true) <= 1);
});

test("spatial hash returns nearby items only", () => {
  const h = new SpatialHash(4);
  const a = { x: 1, z: 1 }, b = { x: 30, z: 30 };
  h.insert(a); h.insert(b);
  assert.deepEqual(h.near(0, 0, 4), [a]);
  assert.deepEqual(h.near(29, 29, 4), [b]);
});

test("path passes through its waypoints", () => {
  const pts = [[0, 0], [10, 0], [10, 10], [0, 10]];
  pts.forEach((p, i) => {
    const q = pathPoint(pts, i / pts.length);
    assert.ok(Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-9);
  });
});
