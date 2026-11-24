"""2D Gaussian splatting renderer: the core idea of 3DGS, in two dimensions.

A scene is a set of anisotropic Gaussians (mean, scale, rotation, color, opacity).
Rendering = sort by depth, then alpha-composite each Gaussian front to back:
    C = sum_i c_i * a_i * prod_{j<i} (1 - a_j),   a_i = opacity_i * exp(-0.5 d^T S^-1 d)
3DGS does the same after projecting 3D Gaussians to screen-space 2D ones (via the
Jacobian of the projection), and *optimizes* all parameters by gradient descent
against photos. Because every step is differentiable, so is the whole image.
"""
from __future__ import annotations

import numpy as np

Array = np.ndarray


def covariance_2d(scale: Array, theta: Array) -> Array:
    """Sigma = R S S^T R^T: always symmetric positive-definite by construction.
    (That's why 3DGS optimizes scale + rotation instead of the matrix itself.)"""
    c, s = np.cos(theta), np.sin(theta)
    R = np.stack([np.stack([c, -s], -1), np.stack([s, c], -1)], -2)
    S = np.zeros_like(R)
    S[..., 0, 0] = scale[..., 0]; S[..., 1, 1] = scale[..., 1]
    M = R @ S
    return M @ np.swapaxes(M, -1, -2)


def render(means: Array, scales: Array, thetas: Array, colors: Array, opacity: Array,
           depth: Array, size: tuple[int, int], background=(0.0, 0.0, 0.0),
           cutoff: float = 3.0) -> Array:
    """Front-to-back compositing with early termination. Linear-light float output."""
    w, h = size
    img = np.zeros((h, w, 3))
    T = np.ones((h, w))                                   # transmittance per pixel
    cov = covariance_2d(np.asarray(scales, float), np.asarray(thetas, float))
    inv = np.linalg.inv(cov)
    for i in np.argsort(depth):                           # nearest first
        r = cutoff * np.sqrt(np.linalg.eigvalsh(cov[i]).max())   # 3-sigma bounding box
        x0, x1 = int(max(0, means[i, 0] - r)), int(min(w, means[i, 0] + r + 1))
        y0, y1 = int(max(0, means[i, 1] - r)), int(min(h, means[i, 1] + r + 1))
        if x0 >= x1 or y0 >= y1:
            continue
        yy, xx = np.mgrid[y0:y1, x0:x1]
        dx = xx + 0.5 - means[i, 0]; dy = yy + 0.5 - means[i, 1]
        q = inv[i, 0, 0] * dx * dx + 2 * inv[i, 0, 1] * dx * dy + inv[i, 1, 1] * dy * dy
        a = np.minimum(0.99, opacity[i] * np.exp(-0.5 * q))
        a[a < 1 / 255] = 0
        Tl = T[y0:y1, x0:x1]
        img[y0:y1, x0:x1] += (Tl * a)[..., None] * colors[i]
        T[y0:y1, x0:x1] = Tl * (1 - a)
    return img + T[..., None] * np.asarray(background, float)
