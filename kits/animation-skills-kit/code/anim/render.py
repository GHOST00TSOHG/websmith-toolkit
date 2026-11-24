"""Frame rendering and encoding.

- Supersampled anti-aliasing: draw at k x resolution, downsample with a good filter.
- Motion blur: average several sub-frame renders across the shutter interval,
  in linear light (gamma-decoded) so bright edges blur correctly.
- Encoding: pipe raw RGB frames into ffmpeg (MP4/H.264) or build a GIF.
"""
from __future__ import annotations

import shutil
import subprocess
from collections.abc import Callable, Iterable
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

DrawFn = Callable[[ImageDraw.ImageDraw, float, float], None]  # (draw, t, scale)


def render_frame(draw_fn: DrawFn, t: float, size: tuple[int, int],
                 bg=(18, 18, 28), ss: int = 3) -> Image.Image:
    W, H = size
    img = Image.new("RGB", (W * ss, H * ss), bg)
    draw_fn(ImageDraw.Draw(img), t, ss)
    return img.resize((W, H), Image.LANCZOS)


def _to_linear(a: np.ndarray) -> np.ndarray:
    return (a / 255.0) ** 2.2


def _to_srgb(a: np.ndarray) -> np.ndarray:
    return np.clip(a ** (1 / 2.2) * 255 + 0.5, 0, 255).astype(np.uint8)


def render_motion_blurred(draw_fn: DrawFn, t: float, fps: float, size, samples: int = 6,
                          shutter: float = 0.5, **kw) -> Image.Image:
    """shutter=0.5 is the film-standard 180-degree shutter."""
    if samples <= 1:
        return render_frame(draw_fn, t, size, **kw)
    span = shutter / fps
    acc = None
    for k in range(samples):
        sub = t - span / 2 + span * (k + 0.5) / samples
        lin = _to_linear(np.asarray(render_frame(draw_fn, sub, size, **kw), np.float64))
        acc = lin if acc is None else acc + lin
    return Image.fromarray(_to_srgb(acc / samples))


def frames(draw_fn: DrawFn, duration: float, fps: int, size, blur_samples: int = 1,
           **kw) -> Iterable[Image.Image]:
    for i in range(round(duration * fps)):
        yield render_motion_blurred(draw_fn, i / fps, fps, size, blur_samples, **kw)


def write_mp4(images: Iterable[Image.Image], path: str | Path, fps: int, crf: int = 20) -> Path:
    """H.264 + yuv420p plays everywhere. Width and height must be even."""
    if not shutil.which("ffmpeg"):
        raise RuntimeError("ffmpeg not found on PATH")
    it = iter(images)
    first = next(it)
    w, h = first.size
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
           "-s", f"{w}x{h}", "-r", str(fps), "-i", "-", "-c:v", "libx264",
           "-preset", "veryfast", "-crf", str(crf), "-pix_fmt", "yuv420p",
           "-movflags", "+faststart", str(path)]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    assert proc.stdin
    proc.stdin.write(first.convert("RGB").tobytes())
    for im in it:
        proc.stdin.write(im.convert("RGB").tobytes())
    proc.stdin.close()
    if proc.wait() != 0:
        raise RuntimeError("ffmpeg failed")
    return Path(path)


def write_gif(images: Iterable[Image.Image], path: str | Path, fps: int,
              colors: int = 128) -> Path:
    """Shared adaptive palette across all frames avoids per-frame color flicker."""
    ims = [im.convert("RGB") for im in images]
    strip = Image.new("RGB", (ims[0].width, ims[0].height * min(len(ims), 8)))
    for k, im in enumerate(ims[:: max(1, len(ims) // 8)][:8]):
        strip.paste(im, (0, k * ims[0].height))
    pal = strip.quantize(colors, method=Image.Quantize.MEDIANCUT)
    q = [im.quantize(palette=pal, dither=Image.Dither.NONE) for im in ims]
    q[0].save(path, save_all=True, append_images=q[1:], duration=round(1000 / fps),
              loop=0, optimize=True, disposal=1)
    return Path(path)
