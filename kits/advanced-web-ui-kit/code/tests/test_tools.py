"""Unit tests for color science, token building and the HTML audit.
Run from code/:  python -m pytest -q tests/test_tools.py
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from tools.audit import audit_html
from tools.color import (OKLCH, apca_lc, gamut_map, hex_to_rgb, in_gamut, oklch_to_srgb,
                         rgb_to_hex, srgb_to_oklch, tonal_palette, wcag_contrast)
from tools.tokens import TokenError, build_css, flatten, resolve

SITE = Path(__file__).resolve().parents[1] / "site"


# ---- color -------------------------------------------------------------------
@pytest.mark.parametrize("hexcode", ["#000000", "#ffffff", "#ff0000", "#1e90ff", "#5b3fd1", "#777777"])
def test_oklch_roundtrip(hexcode):
    rgb = hex_to_rgb(hexcode)
    assert rgb_to_hex(oklch_to_srgb(srgb_to_oklch(*rgb))) == hexcode


def test_known_oklch_values():
    white = srgb_to_oklch(1, 1, 1)
    assert white.l == pytest.approx(1.0, abs=1e-3) and white.c < 1e-3
    red = srgb_to_oklch(1, 0, 0)  # reference: oklch(62.8% 0.2577 29.23)
    assert red.l == pytest.approx(0.628, abs=1e-3)
    assert red.c == pytest.approx(0.2577, abs=1e-3)
    assert red.h == pytest.approx(29.23, abs=0.05)


def test_wcag_contrast_reference_values():
    assert wcag_contrast((0, 0, 0), (1, 1, 1)) == pytest.approx(21.0)
    assert wcag_contrast(hex_to_rgb("#777777"), (1, 1, 1)) == pytest.approx(4.48, abs=0.01)


def test_apca_reference_values():
    assert apca_lc((0, 0, 0), (1, 1, 1)) == pytest.approx(106.04, abs=0.01)
    assert apca_lc((1, 1, 1), (0, 0, 0)) == pytest.approx(-107.88, abs=0.01)
    assert apca_lc(hex_to_rgb("#888888"), hex_to_rgb("#888888")) == 0.0


def test_gamut_mapping_keeps_lightness_and_hue():
    wild = OKLCH(0.7, 0.4, 150)                      # far outside sRGB
    assert not in_gamut(oklch_to_srgb(wild))
    m = gamut_map(wild)
    assert in_gamut(oklch_to_srgb(m)) and m.l == wild.l and m.h == wild.h and m.c < wild.c


def test_palette_is_monotonic_and_in_gamut():
    p = tonal_palette(285, 0.18)
    ls = [c.l for c in p.values()]
    assert ls == sorted(ls, reverse=True)
    assert all(in_gamut(oklch_to_srgb(c)) for c in p.values())
    assert wcag_contrast(oklch_to_srgb(p[950]), oklch_to_srgb(p[50])) > 12


# ---- tokens ------------------------------------------------------------------
def test_flatten_inherits_group_type():
    toks = flatten({"space": {"$type": "dimension", "sm": {"$value": {"value": 4, "unit": "px"}}}})
    assert toks["space.sm"]["$type"] == "dimension"


def test_alias_resolution_and_cycles():
    toks = flatten({"a": {"$type": "number", "$value": 2}, "b": {"$value": "{a}"},
                    "c": {"$value": "{b}"}})
    r = resolve(toks)
    assert r["c"]["$value"] == 2 and r["c"]["$type"] == "number"
    with pytest.raises(TokenError, match="cycle"):
        resolve(flatten({"x": {"$value": "{y}"}, "y": {"$value": "{x}"}}))
    with pytest.raises(TokenError, match="unknown alias"):
        resolve(flatten({"x": {"$value": "{nope}"}}))


def test_build_css_light_dark_and_live_aliases():
    base = {"c": {"$type": "color",
                  "w": {"$value": {"colorSpace": "srgb", "components": [1, 1, 1]}},
                  "k": {"$value": {"colorSpace": "srgb", "components": [0, 0, 0]}}},
            "d": {"$type": "duration", "f": {"$value": {"value": 120, "unit": "ms"}}}}
    light = {"s": {"$type": "color", "bg": {"$value": "{c.w}"}, "ink": {"$value": "{c.k}"}}}
    dark = {"s": {"$type": "color", "bg": {"$value": "{c.k}"}, "ink": {"$value": "{c.k}"}}}
    css = build_css(base, light, dark)
    assert "--s-bg: light-dark(oklch(100.00%" in css
    assert "--s-ink: var(--c-k);" in css                 # same alias both themes stays a reference
    assert "--d-f: 120ms;" in css and "color-scheme: light dark" in css


def test_repo_tokens_build_and_meet_contrast():
    load = lambda n: json.loads((SITE / "tokens" / n).read_text())
    css = build_css(load("base.tokens.json"), load("light.tokens.json"), load("dark.tokens.json"))
    assert css == (SITE / "tokens.css").read_text(), "tokens.css is stale: rebuild it"
    base = load("base.tokens.json")["color"]
    rgb = lambda g, s: oklch_to_srgb(OKLCH(*base[g][s]["$value"]["components"]))
    for theme in ("light", "dark"):
        sem = load(f"{theme}.tokens.json")["semantic"]
        ref = lambda k: sem[k]["$value"].strip("{}").split(".")[1:]
        bg = rgb(*ref("bg"))
        assert wcag_contrast(rgb(*ref("text")), bg) >= 7          # AAA body text
        assert wcag_contrast(rgb(*ref("text-muted")), bg) >= 4.5  # AA
        assert wcag_contrast(rgb(*ref("primary")), bg) >= 4.5     # links
        assert wcag_contrast(rgb(*ref("focus")), bg) >= 3         # focus ring (non-text)


# ---- audit -------------------------------------------------------------------
def rules(html):
    return {i.rule for i in audit_html(html)}


def test_audit_flags_common_failures():
    bad = """<html><head><title>x</title><script src="a.js"></script>
      <meta name="viewport" content="width=device-width, user-scalable=no"></head><body>
      <img src="a.png"><button></button><a href="/x">click here</a>
      <input type="text"><h1>A</h1><h3>skip</h3><div tabindex="3"></div>
      <p id="d"></p><p id="d"></p></body></html>"""
    r = rules(bad)
    for rule in ["html-lang", "render-blocking-script", "no-zoom", "img-alt", "img-dimensions",
                 "button-name", "link-purpose", "form-label", "heading-order",
                 "positive-tabindex", "duplicate-id", "landmark-main"]:
        assert rule in r, rule


def test_audit_accepts_good_patterns():
    good = """<html lang="en"><head><title>ok</title>
      <meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main>
      <h1>T</h1><h2>S</h2><img src="a.png" alt="" width="10" height="10" loading="lazy">
      <label>Email <input type="email"></label><label for="n">Name</label><input id="n">
      <button aria-label="Close"><svg aria-hidden="true"></svg></button>
      <button><span>Save</span></button><a href="/docs">Read the docs</a></main></body></html>"""
    assert audit_html(good) == []


def test_site_pages_pass_audit():
    for page in SITE.glob("*.html"):
        errors = [i for i in audit_html(page.read_text()) if i.severity == "error"]
        assert errors == [], (page.name, errors)
