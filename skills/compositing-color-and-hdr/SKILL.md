---
name: compositing-color-and-hdr
description: Scene-linear HDR compositing and color management: linear vs display encoding, ACES 2.0 and OpenColorIO, tonemapping, bloom, lens effects, grain, EXR and AOVs, premultiplied alpha, deep compositing and integrating CG into live action. Use for any final image, comp, color pipeline decision, or when renders look washed out, clipped or "CG".
---

# Compositing, Color and HDR

Reference: `code/vfx/post.py` (used by all four demos).

## The rule
**Do light math in scene-linear floats; encode for the display last.**
Adding lights, blurring, motion blur, exposure and defocus are only physically
right on linear values that are not clamped at 1.0. sRGB/gamma encoding and
tonemapping come at the very end (`to_display`).

## Color management
- **ACES 2.0** is current: new output transforms with better consistency across
  SDR/HDR and better invertibility. Use it through **OpenColorIO** configs
  (ACES 2.0 CG/Studio configs). Blender 5.0 includes an ACES 2.0 view transform;
  FFmpeg now supports OCIO.
- Working space: ACEScg (linear, wide gamut) for rendering and comp; textures
  converted from sRGB on input; display transform on view/output.
- `tonemap_aces_fitted` in this kit approximates the *old* ACES 1 look. It's fine
  for learning, but use OCIO for real deliveries. AgX (Blender's default) handles
  saturated highlights more gracefully.

## Look-building stack (in order)
1. Render passes in linear EXR (half float, multi-part).
2. Rebuild beauty from AOVs (diffuse, specular, emission, volume, SSS...) so each
   can be tweaked.
3. Integration: match black levels, grain and defocus to the plate; light wrap;
   edge treatment; shadow catchers.
4. Lens: **bloom/glare** (multi-scale, energy-preserving), chromatic aberration,
   vignette, distortion (match the real lens grid).
5. Display transform (OCIO), then grade.
6. Grain last-ish, matched per channel to the plate; apply in display space or
   simulate in linear depending on the pipeline.

## Alpha and merging
- Use **premultiplied alpha** everywhere: over = `A + B*(1-αA)`. Unpremultiply
  only for color corrections, then re-premultiply.
- Additive for light (fire, sparks, glows): no alpha needed in HDR.
- **Deep compositing** stores multiple samples per pixel with depth, so volumetrics
  and particles merge correctly without holdout renders.

## Diagnosing "CG look"
Clipped highlights (use a filmic/ACES view), no bloom on hot sources, perfect
black levels, no grain, perfectly sharp edges, no lens imperfections, and
saturation hitting 100% in highlights.

## Exercises
1. Add an anamorphic streak to `bloom` (blur only horizontally on the
   brightest threshold).
2. Implement `over()` with premultiplied alpha and comp the cloth demo over a photo.
3. Install OpenColorIO's Python bindings and replace `to_display` with an ACES 2.0
   output transform.

Part of `kits/advanced-vfx-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
