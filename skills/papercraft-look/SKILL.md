---
name: papercraft-look
description: Making 3D look like cut and folded paper: matte paper shading (fibre grain, blotches, wrapped diffuse), darkened cut edges, visible thickness, two-sided faces, layered ground sheets with torn edges and drop shadows, pastel limited palettes, flat geometry and contact shadows. Use when shading or modeling anything in a papercraft or diorama style.
---

# The Papercraft Look

References: the `SCENE_FS` shader and `Geo` builder in `code/web/world.js`; the
`paper_material()` node setup in `code/blender/paper_popup_scene.py`.

## Shading
- **Matte:** roughness ≈ 0.8–0.9, almost no specular. Paper scatters light, so use
  **wrapped diffuse** (`(N·L + w)/(1 + w)`, w ≈ 0.35), or a touch of subsurface in
  Blender, to soften the terminator.
- **Fibre texture:** layer fine grain (high-frequency noise), stretched fibres
  (anisotropic noise) and soft large blotches, each only ±3–10%. Subtle is the point.
  Compute it in world or object space so it doesn't swim when objects move.
- **Cut edges:** darken colour near face borders (UV distance to edge) or use
  AO/pointiness in Blender. This single cue sells "cut paper" more than anything else.
- **Two-sided:** paper has a back. Disable culling and flip the normal for back
  faces (`gl_FrontFacing`), or give the back a slightly different tint.
- **Thickness:** a thin Solidify (Blender) or a darker duplicate edge strip
  (web) shows the paper's thickness at silhouettes.

## Geometry rules
- **Flat planes and simple folds:** boxes, prisms and flat "card" shapes (tree
  canopies as 7–9-sided cut-outs). No smooth subdivision; flat-shaded faces read as folds.
- **Irregular cut outlines:** jitter the rim vertices of flat shapes a few percent
  so edges look hand-cut or torn.
- **Layered ground:** stack flat sheets (land, water, path, plaza) at tiny
  height offsets. Under each, draw a slightly larger, darker copy offset toward the
  light's shadow side: it reads as paper thickness plus a drop shadow.
- **Contact shadows:** a soft dark disc under each prop that grows in with its
  pop-up progress glues pieces to the ground. Use real shadows offline (a sun with
  a small angle gives soft-edged shadows).

## Colour
- Limited **pastel palette** with one strong accent (here red roofs and gates)
  and a dark accent (the black-and-white character) for focus.
- Coloured paper isn't white-lit: a warm sun with cool sky ambient, then a gentle
  warm grade, keeps it cosy.
- Work in linear light, tonemap and encode at the end; author palette colours as
  sRGB and convert (`hex()` in world.js).

## Hand-made variants
For a truly handmade look, draw textures on real paper, scan them, and cut/fold
the planes in Blender, as in Paper Cut Mansion. Photograph real paper sheets for
albedo and normal maps. Add small wobble to vertices or texture to mimic imperfect gluing.

## Exercises
1. Add a "crease" line across tree canopies (a darker fold line through the middle).
2. Give the back faces a lighter, unprinted paper colour.
3. Replace the procedural fibres with a scanned paper texture (triplanar mapped).

Part of `kits/paper-popup-world-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
