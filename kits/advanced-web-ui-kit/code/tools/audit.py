"""Static accessibility + performance linter for HTML files (no browser needed).

Catches common WCAG 2.2 failures and page-weight/CLS mistakes before you ship.
It does NOT replace testing with a browser engine (axe-core), a keyboard, and a
screen reader: automated tools find roughly a third of real issues.

Usage:  python -m tools.audit site/*.html
"""
from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
        "source", "track", "wbr"}
VAGUE_LINKS = {"click here", "here", "read more", "more", "link", "this"}


@dataclass
class Issue:
    rule: str
    severity: str  # "error" | "warn"
    message: str
    line: int


@dataclass
class _El:
    tag: str
    attrs: dict
    line: int
    text: list[str] = field(default_factory=list)


class Auditor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.issues: list[Issue] = []
        self.stack: list[_El] = []
        self.ids: dict[str, int] = {}
        self.labels_for: set[str] = set()
        self.inputs: list[_El] = []
        self.headings: list[tuple[int, int]] = []
        self.html_lang = None
        self.has_viewport = self.has_title = self.has_main = False
        self.in_head = False

    def err(self, rule, msg, line, sev="error"):
        self.issues.append(Issue(rule, sev, msg, line))

    # ---- parsing -------------------------------------------------------------
    def handle_starttag(self, tag, attrs_list):
        a = {k: (v if v is not None else "") for k, v in attrs_list}
        line = self.getpos()[0]
        el = _El(tag, a, line)
        if "id" in a:
            if a["id"] in self.ids:
                self.err("duplicate-id", f'id "{a["id"]}" also used on line {self.ids[a["id"]]}', line)
            self.ids[a["id"]] = line
        if (ti := a.get("tabindex")) and ti.lstrip("-").isdigit() and int(ti) > 0:
            self.err("positive-tabindex", "tabindex > 0 breaks natural focus order", line)
        if a.get("aria-hidden") == "true" and tag in ("button", "a", "input", "select", "textarea"):
            self.err("aria-hidden-focusable", f"<{tag}> is focusable but aria-hidden", line)
        getattr(self, f"_open_{tag}", lambda el: None)(el)
        if tag not in VOID:
            self.stack.append(el)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i].tag == tag:
                el = self.stack.pop(i)
                text = " ".join("".join(el.text).split())
                if self.stack:
                    self.stack[-1].text.append(" " + "".join(el.text) + " ")
                closer = getattr(self, f"_close_{tag}", None)
                if closer:
                    closer(el, text)
                return

    def handle_data(self, data):
        if self.stack:
            self.stack[-1].text.append(data)

    # ---- element rules ---------------------------------------------------------
    def _open_html(self, el):
        self.html_lang = el.attrs.get("lang")

    def _open_head(self, el):
        self.in_head = True

    def _close_head(self, el, text):
        self.in_head = False

    def _open_meta(self, el):
        if el.attrs.get("name") == "viewport":
            self.has_viewport = True
            c = el.attrs.get("content", "")
            if "user-scalable=no" in c.replace(" ", "") or re.search(r"maximum-scale=1(\.0)?\b", c):
                self.err("no-zoom", "viewport blocks zoom (WCAG 1.4.4)", el.line)

    def _close_title(self, el, text):
        self.has_title = bool(text)

    def _open_main(self, el):
        self.has_main = True

    def _open_img(self, el):
        if "alt" not in el.attrs and el.attrs.get("role") != "presentation":
            self.err("img-alt", "img needs alt (use alt=\"\" if decorative)", el.line)
        if not ("width" in el.attrs and "height" in el.attrs):
            self.err("img-dimensions", "img without width/height causes layout shift (CLS)",
                     el.line, "warn")
        if el.attrs.get("loading") != "lazy" and el.attrs.get("fetchpriority") != "high":
            self.err("img-loading", "set loading=\"lazy\" (below the fold) or "
                     "fetchpriority=\"high\" (LCP image)", el.line, "warn")

    def _open_script(self, el):
        if self.in_head and "src" in el.attrs and not ({"defer", "async"} & el.attrs.keys()) \
                and el.attrs.get("type") != "module":
            self.err("render-blocking-script", "script in <head> without defer/async/module",
                     el.line)

    def _open_video(self, el):
        if "autoplay" in el.attrs and "muted" not in el.attrs:
            self.err("autoplay-audio", "autoplaying media with sound (WCAG 1.4.2)", el.line)

    def _open_input(self, el):
        if el.attrs.get("type") not in ("hidden", "submit", "button", "reset", "image"):
            el.wrapped = any(a.tag == "label" for a in self.stack)   # implicit <label>
            self.inputs.append(el)

    _open_select = _open_textarea = _open_input

    def _open_label(self, el):
        if "for" in el.attrs:
            self.labels_for.add(el.attrs["for"])

    def _close_button(self, el, text):
        if not (text or el.attrs.get("aria-label") or el.attrs.get("aria-labelledby")
                or el.attrs.get("title")):
            self.err("button-name", "button has no accessible name", el.line)

    def _close_a(self, el, text):
        if "href" not in el.attrs:
            return
        if not (text or el.attrs.get("aria-label")):
            self.err("link-name", "link has no accessible name", el.line)
        elif text.lower() in VAGUE_LINKS:
            self.err("link-purpose", f'vague link text "{text}" (WCAG 2.4.4)', el.line, "warn")
        if el.attrs.get("target") == "_blank" and "noopener" not in el.attrs.get("rel", "") \
                and "noreferrer" not in el.attrs.get("rel", ""):
            self.err("target-blank", 'target="_blank" without rel="noopener"', el.line, "warn")

    def _heading(level):
        def close(self, el, text):
            self.headings.append((level, el.line))
            if not text:
                self.err("empty-heading", f"<h{level}> is empty", el.line)
        return close

    _close_h1, _close_h2, _close_h3 = _heading(1), _heading(2), _heading(3)
    _close_h4, _close_h5, _close_h6 = _heading(4), _heading(5), _heading(6)

    # ---- document rules --------------------------------------------------------
    def finish(self) -> list[Issue]:
        if not self.html_lang:
            self.err("html-lang", "<html> needs a lang attribute (WCAG 3.1.1)", 1)
        if not self.has_title:
            self.err("document-title", "missing or empty <title> (WCAG 2.4.2)", 1)
        if not self.has_viewport:
            self.err("viewport", "missing <meta name=\"viewport\">", 1, "warn")
        if not self.has_main:
            self.err("landmark-main", "no <main> landmark", 1, "warn")
        for el in self.inputs:
            named = (getattr(el, "wrapped", False) or el.attrs.get("id") in self.labels_for
                     or el.attrs.get("aria-label")
                     or el.attrs.get("aria-labelledby") or el.attrs.get("title"))
            if not named:
                self.err("form-label", f"<{el.tag}> has no label", el.line)
        h1s = [h for h in self.headings if h[0] == 1]
        if len(h1s) != 1:
            self.err("single-h1", f"expected exactly one <h1>, found {len(h1s)}", 1, "warn")
        prev = 0
        for level, line in self.headings:
            if prev and level > prev + 1:
                self.err("heading-order", f"heading jumps from h{prev} to h{level}", line, "warn")
            prev = level
        return self.issues


def audit_html(html: str) -> list[Issue]:
    a = Auditor()
    a.feed(html)
    a.close()
    return a.finish()


def main(paths: list[str]) -> int:
    errors = 0
    for p in paths:
        for i in audit_html(Path(p).read_text()):
            print(f"{p}:{i.line}: {i.severity}: [{i.rule}] {i.message}")
            errors += i.severity == "error"
    print(f"{errors} error(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
