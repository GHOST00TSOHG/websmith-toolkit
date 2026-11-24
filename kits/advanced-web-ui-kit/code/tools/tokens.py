"""Design Tokens (DTCG format 2025.10) -> CSS custom properties.

Supports: nested groups, $type inheritance from groups, aliases "{group.token}"
(with cycle detection), color objects {colorSpace, components, alpha}, dimension
and duration objects {value, unit}, cubicBezier, fontFamily, fontWeight, number,
shadow and typography composites. Themes: give a light and a dark file; tokens
that differ are emitted as light-dark(a, b) so one stylesheet serves both.

Usage:  python -m tools.tokens site/tokens/base.tokens.json \
            --light site/tokens/light.tokens.json --dark site/tokens/dark.tokens.json \
            -o site/tokens.css
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any

from .color import OKLCH, gamut_map, oklch_to_srgb, rgb_to_hex, srgb_to_oklch

ALIAS = re.compile(r"^\{([^{}]+)\}$")


class TokenError(ValueError):
    pass


def flatten(tree: dict, path: tuple[str, ...] = (), inherited_type: str | None = None,
            out: dict | None = None) -> dict[str, dict]:
    """Walk groups; every node with $value is a token. Returns {"a.b.c": {...}}."""
    out = {} if out is None else out
    group_type = tree.get("$type", inherited_type)
    for key, node in tree.items():
        if key.startswith("$") or not isinstance(node, dict):
            continue
        if "$value" in node:
            out[".".join(path + (key,))] = {"$type": node.get("$type", group_type),
                                           "$value": node["$value"],
                                           "$description": node.get("$description")}
        else:
            flatten(node, path + (key,), group_type, out)
    return out


def resolve(tokens: dict[str, dict]) -> dict[str, dict]:
    """Replace aliases with the referenced token's value (and type), recursively."""
    resolved: dict[str, dict] = {}

    def get(name: str, stack: tuple[str, ...]) -> dict:
        if name in resolved:
            return resolved[name]
        if name in stack:
            raise TokenError("alias cycle: " + " -> ".join(stack + (name,)))
        if name not in tokens:
            raise TokenError(f"unknown alias {{{name}}}" + (f" in {stack[-1]}" if stack else ""))
        tok = dict(tokens[name])
        tok["$value"] = deep(tok["$value"], stack + (name,))
        if isinstance(tokens[name]["$value"], str) and (m := ALIAS.match(tokens[name]["$value"])):
            tok["$type"] = tok["$type"] or get(m.group(1), stack + (name,))["$type"]
            tok["alias"] = m.group(1)
        resolved[name] = tok
        return tok

    def deep(v: Any, stack: tuple[str, ...]) -> Any:
        if isinstance(v, str) and (m := ALIAS.match(v)):
            return get(m.group(1), stack)["$value"]
        if isinstance(v, dict):
            return {k: deep(x, stack) for k, x in v.items()}
        if isinstance(v, list):
            return [deep(x, stack) for x in v]
        return v

    for name in tokens:
        get(name, ())
    return resolved


def css_value(tok: dict) -> str:
    t, v = tok["$type"], tok["$value"]
    if t == "color":
        return color_css(v)
    if t in ("dimension", "duration"):
        return f"{v['value']}{v['unit']}" if isinstance(v, dict) else str(v)
    if t == "cubicBezier":
        return "cubic-bezier({})".format(", ".join(f"{x:g}" for x in v))
    if t == "fontFamily":
        fams = v if isinstance(v, list) else [v]
        return ", ".join(f'"{f}"' if " " in f else f for f in fams)
    if t in ("fontWeight", "number"):
        return str(v)
    if t == "shadow":
        layers = v if isinstance(v, list) else [v]
        return ", ".join(
            ("inset " if s.get("inset") else "")
            + " ".join(css_value({"$type": "dimension", "$value": s[k]})
                       for k in ("offsetX", "offsetY", "blur", "spread"))
            + " " + color_css(s["color"]) for s in layers)
    if t == "typography":
        return "{} {}/{} {}".format(v["fontWeight"],
                                    css_value({"$type": "dimension", "$value": v["fontSize"]}),
                                    v.get("lineHeight", 1.5),
                                    css_value({"$type": "fontFamily", "$value": v["fontFamily"]}))
    raise TokenError(f"unsupported $type {t!r}")


def color_css(v: Any) -> str:
    if isinstance(v, str):
        return v
    space, comp = v["colorSpace"], v["components"]
    alpha = v.get("alpha", 1)
    if space == "oklch":
        col = gamut_map(OKLCH(comp[0], comp[1], comp[2]))
        return col.css(alpha)
    if space == "srgb":
        return srgb_to_oklch(*comp).css(alpha)   # normalize everything to oklch()
    raise TokenError(f"unsupported colorSpace {space!r}")


def hex_fallback(v: Any) -> str | None:
    if isinstance(v, dict) and v.get("colorSpace") == "oklch":
        c = v["components"]
        return rgb_to_hex(oklch_to_srgb(gamut_map(OKLCH(c[0], c[1], c[2]))))
    return None


def var_name(path: str) -> str:
    return "--" + path.replace(".", "-")


def build_css(base: dict, light: dict | None = None, dark: dict | None = None) -> str:
    merged_l = {**flatten(base), **(flatten(light) if light else {})}
    merged_d = {**flatten(base), **(flatten(dark) if dark else {})}
    rl, rd = resolve(merged_l), resolve(merged_d)
    lines = ["/* Generated from DTCG 2025.10 tokens by tools/tokens.py. Do not edit. */",
             ":root {", "  color-scheme: light dark;"]
    for name in sorted(rl):
        a, b = css_value(rl[name]), css_value(rd[name])
        alias = rl[name].get("alias")
        if alias and rd[name].get("alias") == alias:       # keep the reference live
            value = f"var({var_name(alias)})"
        else:
            value = a if a == b else f"light-dark({a}, {b})"
        lines.append(f"  {var_name(name)}: {value};")
    lines.append("}")
    return "\n".join(lines) + "\n"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("base"); ap.add_argument("--light"); ap.add_argument("--dark")
    ap.add_argument("-o", "--out", required=True)
    a = ap.parse_args()
    load = lambda p: json.loads(Path(p).read_text()) if p else None
    Path(a.out).write_text(build_css(load(a.base), load(a.light), load(a.dark)))
    print(f"wrote {a.out}")


if __name__ == "__main__":
    main()
