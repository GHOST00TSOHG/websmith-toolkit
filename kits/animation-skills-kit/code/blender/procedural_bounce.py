"""Blender Python (bpy) example: build, keyframe and render a bouncing ball scene.

Run headless (no UI):
    blender --background --factory-startup --python procedural_bounce.py -- out/ball_

Written for Blender 4.x. Not tested in this kit's environment (Blender isn't
installed there); the bpy API changes between versions, so check errors against
https://docs.blender.org/api/current/ if something has moved.
"""
import math
import sys

import bpy

out_prefix = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "//render_"

# ---- clean scene --------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.frame_start, scene.frame_end = 1, 96
scene.render.fps = 24

# ---- objects --------------------------------------------------------------
bpy.ops.mesh.primitive_plane_add(size=20)
bpy.ops.mesh.primitive_uv_sphere_add(radius=1, location=(0, 0, 1), segments=48, ring_count=24)
ball = bpy.context.active_object
bpy.ops.object.shade_smooth()

mat = bpy.data.materials.new("BallOrange")
mat.use_nodes = True
mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (1.0, 0.35, 0.08, 1)
ball.data.materials.append(mat)

bpy.ops.object.light_add(type="SUN", location=(5, -5, 10))
bpy.context.active_object.data.energy = 3
bpy.ops.object.camera_add(location=(0, -16, 4), rotation=(math.radians(82), 0, 0))
scene.camera = bpy.context.active_object

# ---- keyframes: decaying bounces with squash & stretch ---------------------
frame, height, x = 1, 6.0, -6.0
while height > 0.2 and frame < scene.frame_end:
    hop = max(4, int(12 * math.sqrt(height / 6.0)))
    # top of arc
    ball.location = (x, 0, 1 + height); ball.scale = (1, 1, 1)
    ball.keyframe_insert("location", frame=frame); ball.keyframe_insert("scale", frame=frame)
    # contact: squash (volume roughly preserved: x*y*z ~ 1)
    frame += hop; x += 1.2
    ball.location = (x, 0, 0.75); ball.scale = (1.15, 1.15, 0.75)
    ball.keyframe_insert("location", frame=frame); ball.keyframe_insert("scale", frame=frame)
    frame += hop; x += 1.2
    height *= 0.5

# ---- edit the F-curves: gravity-like timing ---------------------------------
# Falling should accelerate, leaving the ground should decelerate. Set each key's
# interpolation; contact keys get sharp handles so the bounce "hits".
for fc in ball.animation_data.action.fcurves:
    for kp in fc.keyframe_points:
        kp.interpolation = "QUAD"
        kp.easing = "AUTO"
    if fc.data_path == "location" and fc.array_index == 2:
        for kp in fc.keyframe_points:
            if kp.co[1] < 0.8:  # contact keys
                kp.handle_left_type = kp.handle_right_type = "VECTOR"

# ---- render settings ----------------------------------------------------------
scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in {
    e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items
} else "BLENDER_EEVEE"
scene.render.resolution_x, scene.render.resolution_y = 640, 360
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = out_prefix
bpy.ops.render.render(animation=True)
# Then encode:  ffmpeg -framerate 24 -i out/ball_%04d.png -c:v libx264 -pix_fmt yuv420p ball.mp4
