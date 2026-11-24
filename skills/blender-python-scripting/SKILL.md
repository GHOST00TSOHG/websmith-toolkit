---
name: blender-python-scripting
description: Automating 3D animation in Blender with Python (bpy): scene setup, keyframes and F-curves, drivers, procedural generation, rigging basics, headless command-line rendering and batch pipelines. Use for any 3D animation or Blender automation task.
---

# Blender Python Scripting (bpy)

Blender is free, and its entire feature set is scriptable in Python. Example:
`code/blender/procedural_bounce.py` (written for Blender 4.x; untested in this kit's
environment, and the API shifts between versions, so check the official API docs).

## Running scripts
- In the UI: Scripting workspace → Text Editor → Run Script. The Info panel shows
  the Python equivalent of every UI action you perform, which is the fastest way to
  learn the API.
- Headless: `blender --background scene.blend --python script.py -- your args`.
  Arguments after `--` are yours (`sys.argv`).
- Blender ships its own Python; install extra packages into *that* interpreter.

## Core data model
- `bpy.data`: all data blocks (objects, meshes, materials, actions). Prefer it
  over `bpy.ops` in scripts: faster, and no dependence on UI context.
- `bpy.context`: current selection/scene. `bpy.ops`: operators (UI actions).
- Object ≠ mesh: objects hold transforms and point to data (mesh, light, camera).

## Keyframes and F-curves
```python
obj.location = (0, 0, 3)
obj.keyframe_insert(data_path="location", frame=1)
fc = obj.animation_data.action.fcurves.find("location", index=2)
for kp in fc.keyframe_points:
    kp.interpolation = "BEZIER"           # or CONSTANT, LINEAR, QUAD, BACK, ELASTIC...
    kp.handle_left_type = "AUTO_CLAMPED"  # VECTOR = sharp corner (impacts)
fc.modifiers.new("NOISE")                 # procedural wiggle on top of keys
```
Recent versions are introducing "layered actions", so F-curve access paths may
change. Check the docs for your version.

## Drivers: procedural relationships
`fc = obj.driver_add("rotation_euler", 2); fc.driver.expression = "frame * 0.1"`.
Drivers can read other properties (a slider controls many bones). Use them for
wheels that rotate with distance, eye blinks driven by a single control, etc.

## Procedural generation
Generate geometry with `bmesh` or by building meshes from vertex/face lists
(`mesh.from_pydata(verts, [], faces)`). For non-destructive procedural modeling and
motion, **Geometry Nodes** can be created and wired from Python too.

## Rigging basics
Armature → bones → pose bones. Constraints (`IK`, `Copy Rotation`, `Damped
Track`) do the work; animate controls rather than deform bones. Automate rig
building with scripts to keep rigs consistent across characters.

## Rendering
- Eevee: fast, real-time-ish. Cycles: path-traced, physically accurate, slower;
  use denoising and GPU (`cycles.device = 'GPU'`).
- Render image sequences (PNG/EXR) rather than video directly: a crash only loses
  one frame, and you encode with ffmpeg afterwards.
- Batch pipeline: one script generates many variations (colors, camera angles)
  and renders each, which is ideal for automating with a bot.

## Exercise
Extend `procedural_bounce.py`: add a camera that follows the ball with a damped
track constraint, and a second ball that starts 6 frames later (overlap).

Part of `kits/animation-skills-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
