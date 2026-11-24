"""End-to-end tests in a real browser engine (Playwright + Chrome).

Run from code/:  python -m pytest -q tests/test_site_e2e.py
Set CHROME_PATH if Chrome isn't at /usr/bin/google-chrome; tests skip if no browser.
"""
from __future__ import annotations

import functools
import http.server
import os
import shutil
import threading
from pathlib import Path

import pytest

pw = pytest.importorskip("playwright.sync_api")
SITE = Path(__file__).resolve().parents[1] / "site"
CHROME = os.environ.get("CHROME_PATH", "/usr/bin/google-chrome")


@pytest.fixture(scope="module")
def server():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(SITE))
    handler.log_message = lambda *a, **k: None
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}"
    httpd.shutdown()


@pytest.fixture(scope="module")
def browser():
    if not (Path(CHROME).exists() or shutil.which("google-chrome")):
        pytest.skip("no Chrome available")
    with pw.sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
        yield b
        b.close()


@pytest.fixture
def page(browser, server):
    ctx = browser.new_context(viewport={"width": 1280, "height": 900}, color_scheme="light")
    pg = ctx.new_page()
    pg.errors = []
    pg.on("pageerror", lambda e: pg.errors.append(str(e)))
    pg.on("console", lambda m: m.type == "error" and pg.errors.append(m.text))
    pg.goto(server + "/index.html")
    pg.wait_for_load_state("networkidle")
    yield pg
    ctx.close()


def test_no_console_errors(page):
    assert page.errors == []


def test_tokens_applied_and_theme_toggle(page):
    bg = lambda: page.evaluate("getComputedStyle(document.body).backgroundColor")
    light = bg()
    page.click("#theme-toggle")
    page.wait_for_timeout(700)
    assert page.get_attribute("html", "data-theme") == "dark"
    assert page.get_attribute("#theme-toggle", "aria-pressed") == "true"
    assert bg() != light


def test_tabs_keyboard_pattern(page):
    page.focus("#t1")
    page.keyboard.press("ArrowRight")
    assert page.evaluate("document.activeElement.id") == "t2"
    assert page.get_attribute("#t2", "aria-selected") == "true"
    assert page.is_visible("#p2") and not page.is_visible("#p1")
    page.keyboard.press("End")
    assert page.evaluate("document.activeElement.id") == "t3"
    page.keyboard.press("ArrowRight")                      # wraps around
    assert page.evaluate("document.activeElement.id") == "t1"
    tabindexes = page.eval_on_selector_all('[role="tab"]', "els => els.map(e => e.tabIndex)")
    assert sorted(tabindexes) == [-1, -1, 0]               # roving tabindex


def test_dialog_modal_and_escape(page):
    page.click("#open-signup")
    assert page.is_visible("#signup")
    assert page.evaluate("document.querySelector('#signup').matches(':modal')")
    page.keyboard.press("Escape")
    page.wait_for_timeout(400)
    assert not page.evaluate("document.querySelector('#signup').open")


def test_popover_tooltip_anchored(page):
    page.click("#tip-trigger")
    assert page.evaluate("document.querySelector('#tip').matches(':popover-open')")
    tip = page.locator("#tip").bounding_box(); btn = page.locator("#tip-trigger").bounding_box()
    if page.evaluate("CSS.supports('anchor-name: --a')"):
        assert tip["y"] + tip["height"] <= btn["y"] + 1      # placed above its anchor


def test_container_query_changes_card_layout(page):
    cols = lambda: page.eval_on_selector(".card", "e => getComputedStyle(e).gridTemplateColumns")
    page.set_viewport_size({"width": 1280, "height": 900})
    page.evaluate("document.querySelector('.grid').style.gridTemplateColumns = '1fr'")  # wide card
    wide = cols()
    page.evaluate("document.querySelector('.grid').style.gridTemplateColumns = '18rem'")  # narrow
    narrow = cols()
    assert len(wide.split()) == 2 and len(narrow.split()) == 1


def test_has_selector_styles_selected_card(page):
    shadow = lambda: page.eval_on_selector(".card", "e => getComputedStyle(e).boxShadow")
    before = shadow()
    page.check(".pick input >> nth=0")
    assert shadow() != before
    assert page.text_content("#picked") == "1 palette selected"


def test_reduced_motion_respected(browser, server):
    ctx = browser.new_context(reduced_motion="reduce")
    pg = ctx.new_page(); pg.goto(server + "/index.html")
    dur = pg.eval_on_selector(".button", "e => getComputedStyle(e).transitionDuration")
    assert all(float(d.rstrip("s")) <= 0.001 for d in dur.split(","))
    ctx.close()


def test_lite_page_is_tiny_and_scriptless(server, browser):
    html = (SITE / "lite.html").read_text()
    assert "<script" not in html and len(html.encode()) < 2048
    ctx = browser.new_context(java_script_enabled=False)
    pg = ctx.new_page(); pg.goto(server + "/lite.html")
    assert pg.is_visible("form") and pg.is_visible("#m")
    ctx.close()


def test_screenshots(browser, server, tmp_path_factory):
    out = Path(os.environ.get("SHOT_DIR", tmp_path_factory.mktemp("shots")))
    out.mkdir(parents=True, exist_ok=True)
    for name, opts in {"desktop-light": dict(viewport={"width": 1280, "height": 900}, color_scheme="light"),
                       "desktop-dark": dict(viewport={"width": 1280, "height": 900}, color_scheme="dark"),
                       "mobile": dict(viewport={"width": 390, "height": 844}, color_scheme="light",
                                      device_scale_factor=2, is_mobile=True)}.items():
        ctx = browser.new_context(**opts, reduced_motion="reduce")
        pg = ctx.new_page(); pg.goto(server + "/index.html"); pg.wait_for_load_state("networkidle")
        pg.screenshot(path=str(out / f"{name}.png"), full_page=True)
        ctx.close()
    assert len(list(out.glob("*.png"))) == 3
