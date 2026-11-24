"""Run from code/:  python -m pytest -q"""
from __future__ import annotations

import numpy as np
import pytest

from vfx import post
from vfx.fluids import Smoke2D
from vfx.motion import MotionDatabase, inertialize
from vfx.procedural import Perlin2D, gray_scott
from vfx.sdf import (calc_normal, camera_rays, raymarch, repeat, sd_box, sd_sphere, smin)
from vfx.splats import covariance_2d, render
from vfx.xpbd import XPBDCloth


# ---- fluids --------------------------------------------------------------------
def _div(u, v):
    return 0.5 * (np.roll(u, -1, 1) - np.roll(u, 1, 1) + np.roll(v, -1, 0) - np.roll(v, 1, 0))


def test_projection_reduces_divergence() -> None:
    from scipy.ndimage import gaussian_filter
    sim = Smoke2D(48, 48, pressure_iters=200)
    rng = np.random.default_rng(0)
    sim.u = gaussian_filter(rng.normal(size=(48, 48)), 3) * 10
    sim.v = gaussian_filter(rng.normal(size=(48, 48)), 3) * 10
    before = np.abs(_div(*sim._with_walls(sim.u, sim.v))[3:-3, 3:-3]).mean()
    sim.project()
    after = np.abs(_div(sim.u, sim.v)[3:-3, 3:-3]).mean()
    assert after < 0.15 * before


def test_maccormack_is_bounded_and_sharper() -> None:
    sim = Smoke2D(64, 64)
    f = np.zeros((64, 64)); f[20:40, 20:40] = 1.0
    sim.u[:] = 0.7; sim.v[:] = 0.3
    a, b = f.copy(), f.copy()
    for _ in range(20):
        a = sim.advect(a, 1.0); b = sim.advect_maccormack(b, 1.0)
    assert b.min() >= -1e-9 and b.max() <= 1 + 1e-9        # limiter keeps it bounded
    assert np.abs(np.diff(b, axis=1)).max() > np.abs(np.diff(a, axis=1)).max()  # less blur


def test_hot_smoke_rises() -> None:
    sim = Smoke2D(40, 60)
    sim.emit(20, 8, 4, density=1, heat=1)
    y0 = (sim.rho * sim.Y).sum() / sim.rho.sum()
    for _ in range(20):
        sim.step(0.5)
    assert (sim.rho * sim.Y).sum() / sim.rho.sum() > y0 + 3


# ---- XPBD ------------------------------------------------------------------------
def test_coloring_has_no_shared_particles() -> None:
    cloth = XPBDCloth(8, 6)
    for a, b, _, _ in cloth.colors:
        ids = np.concatenate([a, b])
        assert len(ids) == len(np.unique(ids))


def test_cloth_hangs_without_stretching() -> None:
    cloth = XPBDCloth(10, 10, spacing=0.1)
    for _ in range(20):                                   # first third of the pendulum swing
        cloth.step(1 / 60, substeps=20)
    assert cloth.stretch_error() < 0.03
    assert cloth.x[-cloth.w:, 1].mean() < 2.0 - 0.3      # far edge swung down
    assert np.allclose(cloth.x[: cloth.w, 1], 2.0)       # pinned row held


def test_cloth_collides_with_sphere() -> None:
    cloth = XPBDCloth(12, 12, spacing=0.08, pin_top=False)
    c = np.array([0.0, 1.0, 0.44]); r = 0.4
    for _ in range(90):
        x = cloth.step(1 / 60, substeps=10, sphere=(c, r))
    assert (np.linalg.norm(x - c, axis=1) >= r * 0.99).all()


# ---- SDF ---------------------------------------------------------------------------
def test_sdf_primitives_and_smin() -> None:
    p = np.array([[2.0, 0, 0], [0, 0, 0]])
    assert np.allclose(sd_sphere(p, 1.0), [1, -1])
    assert np.allclose(sd_box(np.array([[2.0, 0, 0]]), [1, 1, 1]), [1])
    a, b = np.array([1.0]), np.array([1.0])
    assert smin(a, b, 0.5)[0] < 1.0                     # smooth blend digs below min
    assert smin(np.array([0.0]), np.array([5.0]), 0.5)[0] == pytest.approx(0.0)


def test_repeat_handles_zero_period() -> None:
    p = np.array([[4.4, 7.0, -4.4]])
    assert np.allclose(repeat(p, [3.0, 0, 3.0]), [[1.4, 7.0, -1.4]])


def test_raymarch_hits_sphere_at_right_distance() -> None:
    ro, rd = camera_rays(9, 9, [0, 0, -5], [0, 0, 0], 30)
    t, hit = raymarch(lambda p: sd_sphere(p, 1.0), ro, rd)
    center = 4 * 9 + 4
    assert hit[center] and t[center] == pytest.approx(4.0, abs=5e-3)
    n = calc_normal(lambda p: sd_sphere(p, 1.0), (ro + rd * t[:, None])[[center]])
    assert np.allclose(n, [[0, 0, -1]], atol=1e-2)


# ---- procedural ------------------------------------------------------------------------
def test_curl_noise_is_divergence_free() -> None:
    n = Perlin2D(1)
    h = 1 / 256
    ys, xs = np.mgrid[0:256, 0:256] * h
    vx, vy = n.curl(xs, ys)
    dvx = np.gradient(vx, h, axis=1); dvy = np.gradient(vy, h, axis=0)
    div = dvx + dvy
    scale = np.abs(dvx).mean() + np.abs(dvy).mean()
    assert np.abs(div[2:-2, 2:-2]).mean() < 0.05 * scale   # terms cancel almost exactly


def test_perlin_range_and_determinism() -> None:
    a = Perlin2D(4)(np.linspace(0, 30, 5000), np.linspace(3, 9, 5000))
    b = Perlin2D(4)(np.linspace(0, 30, 5000), np.linspace(3, 9, 5000))
    assert np.array_equal(a, b) and np.abs(a).max() <= 1.05


def test_gray_scott_makes_pattern() -> None:
    _, V = gray_scott((64, 64), steps=1500)
    assert V.std() > 0.05 and np.isfinite(V).all()


# ---- post ---------------------------------------------------------------------------------
def test_srgb_roundtrip_and_tonemap_bounds() -> None:
    x = np.linspace(0, 1, 101)
    assert np.allclose(post.linear_to_srgb(post.srgb_to_linear(x)), x, atol=1e-6)
    hdr = np.array([0, 0.18, 1, 10, 1000.0])
    tm = post.tonemap_aces_fitted(hdr)
    assert tm.min() >= 0 and tm.max() <= 1 and np.all(np.diff(tm) >= 0)


def test_splat_points_conserves_energy() -> None:
    buf = np.zeros((10, 10, 3))
    post.splat_points(buf, np.array([[4.3, 5.7], [2.5, 2.5]]), [1, 1, 1], 1.0)
    assert buf.sum() == pytest.approx(6.0)


def test_bloom_only_adds_light() -> None:
    img = np.zeros((40, 40, 3)); img[20, 20] = 50
    out = post.bloom(img)
    assert (out >= img - 1e-9).all() and out.sum() > img.sum()


# ---- motion ------------------------------------------------------------------------------
def test_inertialize_boundary_conditions() -> None:
    T = 0.4
    assert inertialize(2.0, -1.0, 0.0, T) == pytest.approx(2.0)
    assert inertialize(2.0, -1.0, T, T) == pytest.approx(0.0, abs=1e-9)
    assert inertialize(2.0, -1.0, 5.0, T) == pytest.approx(0.0, abs=1e-9)
    ts = np.linspace(0, T, 200)
    xs = inertialize(2.0, -1.0, ts, T)
    assert xs.min() >= -1e-6                              # no overshoot past zero
    assert np.allclose(inertialize(0.0, 0.0, ts, T), 0)


def test_motion_matching_finds_nearest() -> None:
    rng = np.random.default_rng(0)
    feats = rng.normal(size=(500, 6))
    db = MotionDatabase(feats)
    i, cost = db.query(feats[123] + 1e-4)
    assert i == 123 and cost < 1e-4
    j, _ = db.query(feats[123], exclude=np.array([123]))
    assert j != 123


# ---- splats ---------------------------------------------------------------------------------
def test_covariance_is_spd() -> None:
    cov = covariance_2d(np.array([[3.0, 1.0]]), np.array([0.7]))
    assert np.allclose(cov, cov.swapaxes(-1, -2))
    assert (np.linalg.eigvalsh(cov) > 0).all()
    assert np.allclose(np.sort(np.linalg.eigvalsh(cov[0])), [1.0, 9.0])


def test_splat_front_to_back_occlusion() -> None:
    means = np.array([[10.0, 10.0], [10.0, 10.0]])
    scales = np.array([[3.0, 3.0], [3.0, 3.0]])
    colors = np.array([[1.0, 0, 0], [0, 0, 1.0]])
    img = render(means, scales, np.zeros(2), colors, np.array([0.99, 0.99]),
                 depth=np.array([1.0, 2.0]), size=(20, 20))
    assert img[10, 10, 0] > 0.95 and img[10, 10, 2] < 0.05   # red (nearer) hides blue
