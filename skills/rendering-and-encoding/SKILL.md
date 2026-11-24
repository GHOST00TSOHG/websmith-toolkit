---
name: rendering-and-encoding
description: Turning animation data into frames and video files: frame loops, anti-aliasing by supersampling, motion blur, linear vs sRGB color, ffmpeg encoding (H.264, CRF, pix_fmt, GIF palettes), frame rates and performance. Use when producing images, GIFs or videos from code.
---

# Rendering and Encoding

## The frame loop
`frame i` → time `t = i / fps` → `draw(t)` → image. Always drive drawing by
*time*, never by frame count. Then fps, motion blur and slow motion are free
(`render.frames`).

## Anti-aliasing
Pillow draws hard pixel edges. Supersample: draw at 3–4× size and downsample with
`LANCZOS` (`render_frame(ss=3)`). Cost scales with ss², so use 2–3 for previews
and 4 for finals. Alternatives: skia-python or cairo, which have native AA and
are faster for complex vector scenes.

## Motion blur
Average several sub-frame renders across the shutter interval
(`render_motion_blurred`). Shutter 0.5 (180°) looks like film. **Average in linear
light**: decode sRGB (≈ value^2.2), average, re-encode. Averaging sRGB values
directly makes blurred highlights too dark. 4–8 samples is plenty for most motion.

## Color
- Images are stored in sRGB (gamma-encoded). Blending, blurring, lighting and
  resizing are physically correct only in linear space.
- Keep a consistent palette; test contrast at small sizes.

## Encoding with ffmpeg (`write_mp4`)
- Pipe raw frames to ffmpeg's stdin, with no temporary PNGs needed.
- `-c:v libx264 -pix_fmt yuv420p` = plays everywhere. yuv420p requires even
  width and height.
- `-crf 18–23`: lower = better and larger. `-preset veryfast` for iteration,
  `slow` for final delivery.
- `-movflags +faststart` so web players start before the download finishes.
- Image sequence to video: `ffmpeg -framerate 24 -i f_%04d.png -c:v libx264 -pix_fmt yuv420p out.mp4`

## GIFs (`write_gif`)
- 256 colors max: build one **shared palette** from sample frames to avoid
  flicker; dithering off for flat art, on for gradients.
- Best quality uses ffmpeg's two-pass `palettegen` / `paletteuse` filters.
- Keep them small: 10–15 fps, short loops, modest resolution.

## Frame rates
24 = film/animation feel, 30 = video, 60 = UI and games. Animating "on twos"
(new pose every 2 frames at 24 fps) gives a stylized hand-drawn look: quantize
time with `t = floor(t * 12) / 12`.

## Performance
- Profile first; drawing usually dominates.
- Parallelize frames: they're independent, so use
  `concurrent.futures.ProcessPoolExecutor().map(render_index, range(n))`.
- Vectorize per-pixel effects with numpy instead of Python loops.
- For real-time or GPU work: moderngl (OpenGL shaders) or pygame for interactive previews.

## Exercise
Add a `write_mp4` option for ProRes (`-c:v prores_ks -profile:v 3`) and parallel
frame rendering; measure the speedup on `rope_and_arm.py`.

Part of `kits/animation-skills-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
