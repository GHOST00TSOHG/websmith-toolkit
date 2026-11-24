---
name: building-it-in-blender
description: Recreating the paper pop-up world in Blender for rendered animation: paper shader nodes, Solidify thickness, layered torn ground sheets, hinge Empties for fold-up props, a walker on a Follow Path curve, keyframing spring pop-ups from path distance, confetti, and a tilt-shift camera, plus a Geometry Nodes alternative. Use when producing this effect as a rendered video in Blender.
---

# Building It in Blender

Reference: `code/blender/paper_popup_scene.py` builds the whole scene from
Python. It's written for Blender 5.x but untested in the kit's build environment,
so run it in your version and fix any renamed API names first.

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python code/blender/paper_popup_scene.py -- out/paper_popup_
ffmpeg -framerate 24 -i out/paper_popup_%04d.png -c:v libx264 -pix_fmt yuv420p paper_popup.mp4
```
Drop `--background` to open the scene and scrub the timeline instead of rendering.

## How the script works
1. **Paper material:** Principled BSDF, roughness 0.85, base colour × fibre
   noise (90–100%) × AO (darkens creases and edges), with a tiny fibre bump.
2. **Ground:** flat circle sheets with jittered rims (torn), a 2 cm Solidify, at
   slightly different heights.
3. **Props:** parts parented to an **Empty at ground level (the hinge)**.
   Animating the Empty's X rotation (−90° → 0°) and scale folds the whole prop up.
4. **Walker:** a Follow Path constraint on a curve, with `eval_time` keyed linearly for constant speed.
5. **Triggers → keyframes:** for each prop, find the first frame the walker is
   within the trigger radius, then **sample the spring curve every frame for 2 s**
   into rotation and scale keys. Exact, repeatable timing.
6. **Confetti:** small planes keyed along drag-damped ballistic arcs, hidden until the pop frame.
7. **Camera:** parented to the walker, Track To constraint, 85 mm lens, f/1.4
   depth of field focused on the walker (the miniature look); AgX view transform; EEVEE.

## Geometry Nodes alternative (procedural, no keyframes per prop)
Scatter or place props as instances; compute each instance's distance to the
walker (Object Info → position → Distance); turn distance into a progress value
over time with a **Simulation Zone** (latching "triggered" once distance < radius
and accumulating time since trigger); evaluate the spring as a float curve or
math nodes; drive instance rotation about its base and scale. Scales to thousands of props.

## Production tips
- Model props as real papercraft: flat parts, folds, no bevels. Unfold UVs so a
  printed texture would actually fold correctly.
- Use EEVEE for fast iteration (soft shadows, AO); Cycles for final quality.
- Render image sequences; add tilt-shift in the compositor if not using camera DOF.

## Exercises
1. Run the script, render 10 s, and compare timing with the web demo.
2. Replace the cube cat with a voxel cat (array of cubes) or a paper cut-out character with a walk cycle.
3. Convert the per-prop keyframes to the Geometry Nodes simulation approach.

Part of `kits/paper-popup-world-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
