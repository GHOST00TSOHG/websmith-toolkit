"""Run from code/:  python -m pytest -q"""
from __future__ import annotations

import numpy as np
import pytest

from anim import easing
from anim.curves import ArcLengthPath, catmull_rom, quat_from_axis_angle, slerp
from anim.physics import Noise1D, Spring, VerletRope, fabrik
from anim.render import render_frame, render_motion_blurred
from anim.timeline import Track


@pytest.mark.parametrize("name", sorted(easing.EASES))
def test_easing_endpoints(name: str) -> None:
    f = easing.EASES[name]
    assert f(0.0) == pytest.approx(0, abs=1e-9)
    assert f(1.0) == pytest.approx(1, abs=1e-9)


def test_back_easing_anticipates_and_overshoots() -> None:
    assert min(easing.in_back(u / 100) for u in range(101)) < 0
    assert max(easing.out_back(u / 100) for u in range(101)) > 1


def test_cubic_bezier_matches_linear_and_is_monotonic() -> None:
    lin = easing.cubic_bezier(0.25, 0.25, 0.75, 0.75)
    assert all(lin(u / 20) == pytest.approx(u / 20, abs=1e-5) for u in range(21))
    ease = easing.cubic_bezier(0.25, 0.1, 0.25, 1.0)  # CSS "ease"
    vals = [ease(u / 50) for u in range(51)]
    assert vals == sorted(vals)
    with pytest.raises(ValueError):
        easing.cubic_bezier(1.5, 0, 0, 1)


def test_track_sampling_and_easing() -> None:
    tr = Track().add(0, 0.0).add(1, 10.0, easing.in_quad)
    assert tr.sample(-1) == 0 and tr.sample(2) == 10
    assert tr.sample(0.5) == pytest.approx(2.5)
    assert tr.velocity(0.5) == pytest.approx(10.0, rel=1e-3)
    vec = Track().add(0, np.array([0.0, 0.0])).add(2, np.array([4.0, 2.0]))
    assert np.allclose(vec.sample(1), [2, 1])


def test_catmull_rom_passes_through_points() -> None:
    P = np.array([[0, 0], [10, 5], [20, 0], [30, 8]], float)
    for k, p in enumerate(P):
        assert np.allclose(catmull_rom(P, k / (len(P) - 1)), p, atol=1e-6)


def test_arc_length_gives_even_spacing() -> None:
    P = np.array([[0, 0], [1, 0], [100, 0]], float)  # very uneven segments
    path = ArcLengthPath(lambda u: catmull_rom(P, u), samples=2000)
    pts = np.array([path.at(d) for d in np.linspace(0, 1, 11)])
    steps = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    assert steps.std() / steps.mean() < 0.02


def test_slerp_unit_and_endpoints() -> None:
    q0 = quat_from_axis_angle([0, 0, 1], 0.0)
    q1 = quat_from_axis_angle([0, 0, 1], np.pi / 2)
    for u in np.linspace(0, 1, 9):
        assert np.linalg.norm(slerp(q0, q1, u)) == pytest.approx(1)
    assert np.allclose(slerp(q0, q1, 1), q1)
    mid = slerp(q0, q1, 0.5)
    assert np.allclose(mid, quat_from_axis_angle([0, 0, 1], np.pi / 4))


@pytest.mark.parametrize("zeta,overshoots", [(0.2, True), (1.0, False)])
def test_spring_settles(zeta: float, overshoots: bool) -> None:
    s = Spring(0.0, frequency=2, damping=zeta)
    xs = [float(s.step(1.0, 1 / 240)) for _ in range(240 * 4)]
    assert xs[-1] == pytest.approx(1.0, abs=1e-2)
    assert (max(xs) > 1.01) is overshoots


def test_rope_keeps_segment_lengths() -> None:
    rope = VerletRope([0, 0], n=8, seg=10)
    for i in range(600):
        p = rope.step(np.array([np.sin(i / 30) * 40, 0]), 1 / 240)
    seg = np.linalg.norm(np.diff(p, axis=0), axis=1)
    assert np.allclose(seg, 10, rtol=0.05)


def test_fabrik_reaches_and_preserves_lengths() -> None:
    j = np.array([[0, 0], [0, 10], [0, 20], [0, 30]], float)
    out = fabrik(j, [15, 15])
    assert np.linalg.norm(out[-1] - [15, 15]) < 1e-2
    assert np.allclose(np.linalg.norm(np.diff(out, axis=0), axis=1), 10)
    far = fabrik(j, [100, 0])  # unreachable: straight line toward target
    assert np.allclose(far[-1], [30, 0])


def test_noise_is_smooth_bounded_deterministic() -> None:
    n1, n2 = Noise1D(3), Noise1D(3)
    xs = np.linspace(0, 20, 2001)
    v = np.array([n1(x) for x in xs])
    assert np.array_equal(v, [n2(x) for x in xs])
    assert np.abs(v).max() <= 1.0 and np.abs(np.diff(v)).max() < 0.05
    assert n1(5.0) == pytest.approx(0.0, abs=1e-12)  # zero at integer lattice points


def test_render_and_motion_blur_shapes() -> None:
    def draw(d, t, s):
        d.ellipse([(10 + 100 * t) * s, 10 * s, (20 + 100 * t) * s, 20 * s], fill=(255, 255, 255))
    a = render_frame(draw, 0.5, (100, 40))
    b = render_motion_blurred(draw, 0.5, 24, (100, 40), samples=6, shutter=1.0)
    assert a.size == b.size == (100, 40)
    # Blur spreads the ball horizontally: more lit columns, lower peak
    lit = lambda im: int((np.asarray(im)[..., 0].max(axis=0) > 40).sum())
    assert lit(b) > lit(a)
