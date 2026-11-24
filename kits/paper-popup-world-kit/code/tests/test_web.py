"""Browser + logic tests. Run from code/:  python -m pytest -q
Needs Node (for the logic tests) and Playwright + Chrome (set CHROME_PATH) for the
rendering tests; each part skips if its tool is missing.
"""
from __future__ import annotations

import functools
import http.server
import os
import py_compile
import shutil
import subprocess
import threading
from pathlib import Path

import pytest

CODE = Path(__file__).resolve().parents[1]
WEB = CODE / "web"


def test_js_logic_with_node():
    if not shutil.which("node"):
        pytest.skip("node not installed")
    r = subprocess.run(["node", "--test", "tests/popup.test.mjs"], cwd=CODE, capture_output=True, text=True)
    assert r.returncode == 0, r.stdout[-2000:]


def test_blender_script_compiles():
    py_compile.compile(str(CODE / "blender" / "paper_popup_scene.py"), doraise=True)


pw = pytest.importorskip("playwright.sync_api")
CHROME = os.environ.get("CHROME_PATH", "/usr/bin/google-chrome")


@pytest.fixture(scope="module")
def base():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(WEB))
    h.log_message = lambda *a, **k: None
    s = http.server.ThreadingHTTPServer(("127.0.0.1", 0), h)
    threading.Thread(target=s.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{s.server_address[1]}/index.html"
    s.shutdown()


@pytest.fixture(scope="module")
def browser():
    if not Path(CHROME).exists():
        pytest.skip("no Chrome")
    with pw.sync_playwright() as p:
        b = p.chromium.launch(executable_path=CHROME,
                              args=["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        yield b
        b.close()


def open_at(browser, base, t, **ctx):
    c = browser.new_context(viewport={"width": 640, "height": 400}, **ctx)
    pg = c.new_page()
    pg.errors = []
    pg.on("pageerror", lambda e: pg.errors.append(str(e)))
    pg.goto(f"{base}?t={t}")
    pg.wait_for_function("window.__ready !== undefined", timeout=90000)
    return c, pg


def test_props_pop_as_the_walker_moves(browser, base):
    c, early = open_at(browser, base, 1)
    n_early = early.evaluate("window.__world.state.popped")
    assert early.errors == []
    c.close()
    c, later = open_at(browser, base, 10)
    n_later = later.evaluate("window.__world.state.popped")
    assert 0 < n_early < n_later, (n_early, n_later)
    assert later.evaluate("window.__world.state.confetti") > 0
    c.close()


def test_frame_is_rendered(browser, base):
    c, pg = open_at(browser, base, 6)
    stats = pg.evaluate("""() => {
      const cv = document.getElementById('c'), g = cv.getContext('webgl2');
      const px = new Uint8Array(cv.width * cv.height * 4);
      g.readPixels(0, 0, cv.width, cv.height, g.RGBA, g.UNSIGNED_BYTE, px);
      let red = 0, n = px.length / 4, sum = 0;
      for (let i = 0; i < px.length; i += 4) { sum += px[i] + px[i+1] + px[i+2];
        if (px[i] > 170 && px[i+1] < 90 && px[i+2] < 100) red++; }
      return { red: red / n, mean: sum / (3 * n) };
    }""")
    assert 60 < stats["mean"] < 250          # not black, not blown out
    assert stats["red"] > 0.002              # the red roof / gate made it on screen
    c.close()


def test_reduced_motion_has_no_confetti(browser, base):
    c, pg = open_at(browser, base, 6, reduced_motion="reduce")
    assert pg.evaluate("window.__world.state.popped") > 0
    assert pg.evaluate("window.__world.state.confetti") == 0
    c.close()


def test_fallback_without_webgl(browser, base):
    c = browser.new_context()
    pg = c.new_page()
    pg.add_init_script("HTMLCanvasElement.prototype.getContext = () => null;")
    pg.goto(base)
    pg.wait_for_function("window.__ready !== undefined", timeout=30000)
    assert pg.evaluate("window.__ready") == "fallback" and pg.is_visible(".fallback")
    c.close()
