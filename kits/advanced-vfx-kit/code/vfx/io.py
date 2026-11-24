"""Frame output: pipe uint8 RGB frames to ffmpeg (H.264 MP4) and save GIF previews."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image


class VideoWriter:
    """with VideoWriter("out.mp4", fps=24) as vw: vw.write(frame_uint8_hxwx3)"""

    def __init__(self, path: str | Path, fps: int = 24, crf: int = 18, gif: bool = True,
                 gif_every: int = 2, gif_width: int = 240) -> None:
        if not shutil.which("ffmpeg"):
            raise RuntimeError("ffmpeg not found on PATH")
        self.path, self.fps, self.crf = Path(path), fps, crf
        self.proc: subprocess.Popen | None = None
        self.gif = gif; self.gif_every = gif_every; self.gif_width = gif_width
        self.gif_frames: list[Image.Image] = []
        self.n = 0

    def write(self, frame: np.ndarray) -> None:
        h, w, _ = frame.shape
        if self.proc is None:
            self.proc = subprocess.Popen(
                ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                 "-s", f"{w}x{h}", "-r", str(self.fps), "-i", "-", "-c:v", "libx264",
                 "-preset", "veryfast", "-crf", str(self.crf), "-pix_fmt", "yuv420p",
                 "-movflags", "+faststart", str(self.path)], stdin=subprocess.PIPE)
        assert self.proc.stdin
        self.proc.stdin.write(np.ascontiguousarray(frame, np.uint8).tobytes())
        if self.gif and self.n % self.gif_every == 0:
            im = Image.fromarray(frame)
            self.gif_frames.append(im.resize((self.gif_width, round(h * self.gif_width / w)),
                                             Image.LANCZOS))
        self.n += 1

    def __enter__(self) -> "VideoWriter":
        return self

    def __exit__(self, *exc) -> None:
        if self.proc and self.proc.stdin:
            self.proc.stdin.close(); self.proc.wait()
        if self.gif and self.gif_frames:
            pal = self.gif_frames[len(self.gif_frames) // 2].quantize(160, method=Image.Quantize.MEDIANCUT)
            q = [f.quantize(palette=pal, dither=Image.Dither.FLOYDSTEINBERG) for f in self.gif_frames]
            q[0].save(self.path.with_suffix(".gif"), save_all=True, append_images=q[1:],
                      duration=round(1000 * self.gif_every / self.fps), loop=0, optimize=True)
