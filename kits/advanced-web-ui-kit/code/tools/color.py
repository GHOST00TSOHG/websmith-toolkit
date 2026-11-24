"""Color science for UI: OKLCH <-> sRGB, gamut mapping, WCAG 2.x contrast, APCA,
and accessible tonal palette generation.

Why OKLCH: equal steps in L look equally different to humans, and hue stays
stable as lightness changes, unlike HSL, where "50% lightness" yellow and blue
look wildly different. CSS supports oklch() natively in all modern browsers.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

# ---- sRGB transfer --------------------------------------------------------------


def srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def linear_to_srgb(c: float) -> float:
    return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055


# ---- OKLab (Björn Ottosson, 2020) ------------------------------------------------


def linear_srgb_to_oklab(r: float, g: float, b: float) -> tuple[float, float, float]:
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l_, m_, s_ = (math.copysign(abs(v) ** (1 / 3), v) for v in (l, m, s))
    return (0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
            1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
            0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_)


def oklab_to_linear_srgb(L: float, a: float, b: float) -> tuple[float, float, float]:
    l_ = L + 0.3963377774 * a + 0.2158037573 * b
    m_ = L - 0.1055613458 * a - 0.0638541728 * b
    s_ = L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    return (4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
            -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
            -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)


@dataclass(frozen=True)
class OKLCH:
    l: float  # 0..1
    c: float  # 0..~0.37
    h: float  # degrees

    def css(self, alpha: float | None = None) -> str:
        a = "" if alpha is None or alpha >= 1 else f" / {alpha:g}"
        return f"oklch({self.l * 100:.2f}% {self.c:.4f} {self.h % 360:.2f}{a})"


def oklch_to_srgb(col: OKLCH) -> tuple[float, float, float]:
    """Gamma-encoded sRGB in 0..1, possibly out of gamut (check with in_gamut)."""
    a = col.c * math.cos(math.radians(col.h)); b = col.c * math.sin(math.radians(col.h))
    return tuple(linear_to_srgb(v) if v >= 0 else -linear_to_srgb(-v)
                 for v in oklab_to_linear_srgb(col.l, a, b))  # type: ignore[return-value]


def srgb_to_oklch(r: float, g: float, b: float) -> OKLCH:
    L, a, bb = linear_srgb_to_oklab(*(srgb_to_linear(v) for v in (r, g, b)))
    c = math.hypot(a, bb)
    h = math.degrees(math.atan2(bb, a)) % 360 if c > 1e-6 else 0.0
    return OKLCH(L, c, h)


def in_gamut(rgb, eps: float = 1e-6) -> bool:
    return all(-eps <= v <= 1 + eps for v in rgb)


def gamut_map(col: OKLCH) -> OKLCH:
    """Reduce chroma (keep lightness + hue) until it fits sRGB, as CSS Color 4
    recommends in spirit (binary search on chroma)."""
    if in_gamut(oklch_to_srgb(col)):
        return col
    lo, hi = 0.0, col.c
    for _ in range(30):
        mid = (lo + hi) / 2
        if in_gamut(oklch_to_srgb(OKLCH(col.l, mid, col.h))):
            lo = mid
        else:
            hi = mid
    return OKLCH(col.l, lo, col.h)


def hex_to_rgb(h: str) -> tuple[float, float, float]:
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))  # type: ignore[return-value]


def rgb_to_hex(rgb) -> str:
    return "#" + "".join(f"{round(min(max(v, 0), 1) * 255):02x}" for v in rgb)


# ---- contrast -----------------------------------------------------------------------


def relative_luminance(rgb) -> float:
    r, g, b = (srgb_to_linear(min(max(v, 0.0), 1.0)) for v in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def wcag_contrast(fg, bg) -> float:
    """WCAG 2.x contrast ratio, 1..21. AA: 4.5 body text, 3 large text / UI parts."""
    l1, l2 = sorted((relative_luminance(fg), relative_luminance(bg)), reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)


def apca_lc(text_rgb, bg_rgb) -> float:
    """APCA lightness contrast Lc (0.0.98G-4g constants). Polarity-aware: positive
    = dark text on light bg. |Lc| 75+ body text, 60 for larger text, 45 headlines.
    APCA is a candidate method for WCAG 3; WCAG 2.2 (the legal baseline) uses the ratio."""
    def y(rgb):
        r, g, b = (min(max(v, 0.0), 1.0) for v in rgb)
        return 0.2126729 * r ** 2.4 + 0.7151522 * g ** 2.4 + 0.0721750 * b ** 2.4

    def clamp(v):
        return v if v > 0.022 else v + (0.022 - v) ** 1.414

    yt, yb = clamp(y(text_rgb)), clamp(y(bg_rgb))
    if abs(yb - yt) < 0.0005:
        return 0.0
    if yb > yt:
        s = (yb ** 0.56 - yt ** 0.57) * 1.14
        return 0.0 if s < 0.1 else (s - 0.027) * 100
    s = (yb ** 0.65 - yt ** 0.62) * 1.14
    return 0.0 if s > -0.1 else (s + 0.027) * 100


# ---- palettes ------------------------------------------------------------------------

STEPS = (50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950)
LIGHTNESS = (0.97, 0.93, 0.87, 0.79, 0.70, 0.62, 0.54, 0.46, 0.38, 0.30, 0.23)


def tonal_palette(hue: float, chroma: float = 0.16) -> dict[int, OKLCH]:
    """Perceptually even tonal scale at constant hue. Chroma tapers at the
    extremes (very light/dark colors can't hold much chroma in sRGB), then each
    step is gamut-mapped."""
    out = {}
    for step, L in zip(STEPS, LIGHTNESS):
        taper = math.sin(math.pi * min(max((L - 0.12) / 0.88, 0), 1)) ** 0.6
        out[step] = gamut_map(OKLCH(L, chroma * taper, hue))
    return out


def accessible_pairs(palette: dict[int, OKLCH], min_ratio: float = 4.5) -> list[tuple[int, int, float]]:
    """All (text step, background step) pairs meeting a WCAG ratio."""
    rgb = {k: oklch_to_srgb(v) for k, v in palette.items()}
    return [(a, b, wcag_contrast(rgb[a], rgb[b])) for a in rgb for b in rgb
            if a != b and wcag_contrast(rgb[a], rgb[b]) >= min_ratio]


def palette_tokens(name: str, hue: float, chroma: float = 0.16) -> dict:
    """A tonal palette as a DTCG 2025.10 color group (oklch components)."""
    group: dict = {"$type": "color"}
    for step, col in tonal_palette(hue, chroma).items():
        group[str(step)] = {"$value": {"colorSpace": "oklch",
                                       "components": [round(col.l, 4), round(col.c, 4), round(col.h, 2)]}}
    return {name: group}


if __name__ == "__main__":  # python -m tools.color brand 285 0.17 > brand.json
    import json
    import sys
    n, h = sys.argv[1], float(sys.argv[2])
    c = float(sys.argv[3]) if len(sys.argv) > 3 else 0.16
    print(json.dumps(palette_tokens(n, h, c), indent=2))
