"""Scene-linear HDR compositing: additive particle splatting, bloom, tonemapping,
lens effects, grain, display encoding.

Golden rule: do all light math (adding, blurring, exposure) on LINEAR, unclamped
float buffers; tonemap and encode to the display ONLY at the very end.
"""
from __future__ import annotations

import numpy as np
from scipy.ndimage import gaussian_filter, map_coordinates

Array = np.ndarray


def srgb_to_linear(c: Array) -> Array:
    c = np.asarray(c, float)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(c: Array) -> Array:
    c = np.clip(c, 0, None)
    return np.where(c <= 0.0031308, 12.92 * c, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def splat_points(buf: Array, xy: Array, color: Array, weight: Array | float = 1.0) -> Array:
    """Additively deposit points with bilinear weights (sub-pixel accurate, no aliasing)."""
    h, w, _ = buf.shape
    x, y = xy[:, 0], xy[:, 1]
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int)
    fx, fy = x - x0, y - y0
    col = np.broadcast_to(np.asarray(color, float), (len(x), 3)) * np.reshape(weight, (-1, 1))
    for dx, dy, wt in ((0, 0, (1 - fx) * (1 - fy)), (1, 0, fx * (1 - fy)),
                       (0, 1, (1 - fx) * fy), (1, 1, fx * fy)):
        xi, yi = x0 + dx, y0 + dy
        ok = (xi >= 0) & (xi < w) & (yi >= 0) & (yi < h)
        np.add.at(buf, (yi[ok], xi[ok]), col[ok] * wt[ok, None])
    return buf


def bloom(hdr: Array, threshold: float = 1.0, radii=(2, 6, 16, 40),
          weights=(0.5, 0.3, 0.15, 0.08)) -> Array:
    """Multi-scale bloom: soft-knee threshold, sum of Gaussians at growing radii
    (approximates a camera lens's long-tailed glow)."""
    lum = hdr.mean(-1, keepdims=True)
    knee = 0.5 * threshold
    soft = np.clip(lum - threshold + knee, 0, 2 * knee) ** 2 / (4 * knee + 1e-6)
    contrib = np.maximum(soft, lum - threshold) / np.maximum(lum, 1e-6)
    bright = hdr * contrib
    glow = sum(wt * gaussian_filter(bright, sigma=(r, r, 0)) for r, wt in zip(radii, weights))
    return hdr + glow


def tonemap_aces_fitted(x: Array) -> Array:
    """Narkowicz's curve fit of the ACES 1.x RRT+ODT (sRGB). Cheap filmic look.
    Not ACES 2.0: for real pipelines use OpenColorIO with the ACES 2.0 configs."""
    a, b, c, d, e = 2.51, 0.03, 2.43, 0.59, 0.14
    return np.clip((x * (a * x + b)) / (x * (c * x + d) + e), 0, 1)


def tonemap_agx_like(x: Array) -> Array:
    """A gentle log-sigmoid that desaturates highlights toward white, in the spirit
    of AgX / Blender's default view (not the exact transform)."""
    lx = np.log2(np.maximum(x, 1e-6) / 0.18)
    t = np.clip((lx + 10) / 16.5, 0, 1)
    return np.clip(t ** 2 * (3 - 2 * t) * 1.02 - 0.01, 0, 1)


def chromatic_aberration(img: Array, strength: float = 0.004) -> Array:
    """Scale R and B channels radially by slightly different amounts (lateral CA)."""
    h, w, _ = img.shape
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    cx, cy = (w - 1) / 2, (h - 1) / 2
    out = img.copy()
    for ch, s in ((0, 1 + strength), (2, 1 - strength)):
        out[..., ch] = map_coordinates(img[..., ch], [cy + (yy - cy) / s, cx + (xx - cx) / s],
                                       order=1, mode="nearest")
    return out


def vignette(img: Array, amount: float = 0.35) -> Array:
    h, w, _ = img.shape
    yy, xx = np.mgrid[0:h, 0:w]
    r2 = ((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2
    return img * (1 - amount * np.clip(r2 / 2, 0, 1))[..., None]


def film_grain(img: Array, rng: np.random.Generator, amount: float = 0.02) -> Array:
    """Grain is stronger in midtones, weaker in deep shadows/highlights, like film."""
    lum = img.mean(-1, keepdims=True)
    return img + rng.normal(0, amount, img.shape[:2])[..., None] * (4 * lum * (1 - lum))


def to_display(hdr: Array, exposure: float = 0.0, look: str = "aces",
               rng: np.random.Generator | None = None) -> Array:
    """HDR linear -> 8-bit sRGB display image."""
    x = hdr * 2.0 ** exposure
    x = tonemap_aces_fitted(x) if look == "aces" else tonemap_agx_like(x)
    x = linear_to_srgb(x)
    if rng is not None:
        x = film_grain(x, rng)
    return (np.clip(x, 0, 1) * 255 + 0.5).astype(np.uint8)
