"""Paper pop-up world in Blender: a character walks a path and props fold up out of
the ground (with spring overshoot) as it passes. Keyframes are computed from the
path, so the timing is exact and the result renders anywhere (EEVEE or Cycles).

It builds: a paper material (procedural fibres + edge darkening), layered ground
sheets, props, a walker following a curve, pop-up keyframes per prop, confetti
bursts, and a tilt-shift-style camera (long lens + shallow depth of field).

Written for Blender 5.x and NOT tested where this kit was made (no Blender there).
If a line errors, check https://docs.blender.org/api/current/ for the renamed
property, then fix it.

Run (macOS path shown; use your Blender's path elsewhere):
  /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
      --python paper_popup_scene.py -- out/paper_popup_
Without --background, Blender opens with the scene ready to play (spacebar).
"""
import math
import random
import sys

import bpy
from mathutils import Vector

out = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "//paper_popup_"
random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
FPS, SECONDS = 24, 10
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 1, FPS * SECONDS


# --------------------------------------------------------------- paper material
def paper_material(name, rgb):
    """Base color x (fibre noise) x (edge darkening from Geometry > Pointiness-like
    AO trick) with high roughness and a hint of subsurface: matte, soft paper."""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; N, L = nt.nodes, nt.links
    bsdf = N["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.85
    fibres = N.new("ShaderNodeTexNoise"); fibres.inputs["Scale"].default_value = 180.0
    fibres.inputs["Detail"].default_value = 8.0
    grain = N.new("ShaderNodeMapRange")
    grain.inputs["To Min"].default_value = 0.9; grain.inputs["To Max"].default_value = 1.0
    L.new(fibres.outputs["Fac"], grain.inputs["Value"])
    ao = N.new("ShaderNodeAmbientOcclusion"); ao.inputs["Distance"].default_value = 0.08   # darker creases/edges
    tint = N.new("ShaderNodeMix"); tint.data_type = "RGBA"; tint.blend_type = "MULTIPLY"
    tint.inputs["Factor"].default_value = 1.0
    tint.inputs["A"].default_value = (*rgb, 1)
    L.new(grain.outputs["Result"], tint.inputs["B"])
    edge = N.new("ShaderNodeMix"); edge.data_type = "RGBA"; edge.blend_type = "MULTIPLY"
    edge.inputs["Factor"].default_value = 0.6
    L.new(tint.outputs["Result"], edge.inputs["A"]); L.new(ao.outputs["AO"], edge.inputs["B"])
    L.new(edge.outputs["Result"], bsdf.inputs["Base Color"])
    bump = N.new("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.04
    L.new(fibres.outputs["Fac"], bump.inputs["Height"]); L.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return m


PAL = {k: tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)) for k, h in {
    "red": "#e2343f", "cream": "#f4e6cf", "pink": "#f2b8c6", "blue": "#8fa6c9",
    "wood": "#9b6b4a", "yellow": "#f5c84c", "black": "#202024", "white": "#fbf6ee"}.items()}
MAT = {k: paper_material(f"Paper_{k}", v) for k, v in PAL.items()}


def solidify(obj, t=0.015):
    """Real paper has thickness: a thin Solidify gives visible cut edges."""
    mod = obj.modifiers.new("Paper thickness", "SOLIDIFY"); mod.thickness = t; mod.offset = 0


def add_box(name, size, loc, mat, parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(MAT[mat])
    if parent: o.parent = parent
    return o


def prop(kind, x, y):
    """Each prop is an Empty (the hinge at ground level) with paper parts as children.
    Animating the Empty's rotation/scale folds the whole piece up like a pop-up page."""
    hinge = bpy.data.objects.new(f"{kind}_hinge", None); scene.collection.objects.link(hinge)
    hinge.location = (x, y, 0); hinge.empty_display_size = 0.3
    if kind == "house":
        add_box("walls", (1.4, 1.1, 0.9), (0, 0, 0.45), "cream", hinge)
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=1.05, depth=0.6, location=(0, 0, 1.2))
        roof = bpy.context.active_object; roof.rotation_euler.z = math.radians(45)
        roof.data.materials.append(MAT["red"]); roof.parent = hinge
    elif kind == "tree":
        add_box("trunk", (0.14, 0.14, 0.8), (0, 0, 0.4), "wood", hinge)
        bpy.ops.mesh.primitive_circle_add(vertices=9, radius=0.55, fill_type="NGON", location=(0, 0.05, 1.05),
                                          rotation=(math.radians(90), 0, 0))
        c = bpy.context.active_object; c.data.materials.append(MAT["pink"]); c.parent = hinge; solidify(c)
    elif kind == "gate":
        add_box("post_l", (0.22, 0.22, 1.5), (-0.9, 0, 0.75), "blue", hinge)
        add_box("post_r", (0.22, 0.22, 1.5), (0.9, 0, 0.75), "pink", hinge)
        add_box("beam", (2.3, 0.4, 0.28), (0, 0, 1.64), "red", hinge)
    return hinge


# ------------------------------------------------------------------ ground sheets
def sheet(name, radius, z, mat, loc=(0, 0)):
    bpy.ops.mesh.primitive_circle_add(vertices=64, radius=radius, fill_type="NGON", location=(*loc, z))
    o = bpy.context.active_object; o.name = name; o.data.materials.append(MAT[mat])
    for v in o.data.vertices:                                   # torn edge: jitter the rim
        if v.co.length > radius * 0.5:
            v.co *= 1 + random.uniform(-0.04, 0.04)
    solidify(o, 0.02)
    return o

sheet("land", 30, 0, "pink"); sheet("river", 7, 0.02, "blue", (-6, 4)); sheet("plaza", 4.2, 0.04, "cream", (0, -9))

# --------------------------------------------------------------- walker + path
pts = [(0, 10), (1.5, 6), (0.5, 2), (-1, -2), (0, -6), (0.5, -10)]
curve = bpy.data.curves.new("WalkPath", "CURVE"); curve.dimensions = "3D"
spl = curve.splines.new("POLY"); spl.points.add(len(pts) - 1)
for p, (x, y) in zip(spl.points, pts):
    p.co = (x, y, 0.05, 1)
path_obj = bpy.data.objects.new("WalkPath", curve); scene.collection.objects.link(path_obj)

walker = add_box("cat", (0.36, 0.5, 0.36), (0, 0, 0.18), "black")
follow = walker.constraints.new("FOLLOW_PATH"); follow.target = path_obj
follow.use_curve_follow = True; follow.forward_axis = "FORWARD_Y"
curve.use_path = True; curve.path_duration = scene.frame_end
curve.eval_time = 0; curve.keyframe_insert("eval_time", frame=1)
curve.eval_time = scene.frame_end; curve.keyframe_insert("eval_time", frame=scene.frame_end)
for fc in curve.animation_data.action.fcurves:
    for k in fc.keyframe_points:
        k.interpolation = "LINEAR"                          # constant walking speed


def walker_xy(frame):
    """Position along the polyline at a frame (matches the linear eval_time above)."""
    seg = [(Vector(pts[i]), Vector(pts[i + 1])) for i in range(len(pts) - 1)]
    total = sum((b - a).length for a, b in seg)
    d = (frame - 1) / (scene.frame_end - 1) * total
    for a, b in seg:
        L = (b - a).length
        if d <= L:
            return a.lerp(b, d / L)
        d -= L
    return Vector(pts[-1])


# ------------------------------------------------------------ props + pop-up keys
LAYOUT = [("house", 2.4, 7.2), ("tree", -1.7, 7.8), ("gate", 0.8, 3.4), ("tree", 3.0, 2.0),
          ("tree", -2.8, -1.5), ("house", 2.6, -4.0), ("tree", -2.6, -8.6), ("gate", 0.3, -8.0)]
TRIGGER = 3.4                                              # metres


def spring(t, freq=2.2, zeta=0.42):
    if t <= 0:
        return 0.0
    w = 2 * math.pi * freq; wd = w * math.sqrt(1 - zeta * zeta)
    return 1 - math.exp(-zeta * w * t) * (math.cos(wd * t) + zeta * w / wd * math.sin(wd * t))


def confetti_burst(x, y, frame):
    """A few paper squares with Rigid Body would be heavier; simple keyed arcs read fine."""
    for i in range(14):
        bpy.ops.mesh.primitive_plane_add(size=0.08, location=(x, y, 0.5))
        c = bpy.context.active_object
        c.data.materials.append(MAT[random.choice(["red", "yellow", "white", "blue", "pink"])])
        v = Vector((random.uniform(-1.5, 1.5), random.uniform(-1.5, 1.5), random.uniform(2.5, 4)))
        for k in range(0, 30, 3):                          # ballistic arc with drag, keyed every 3 frames
            t = k / FPS
            pos = Vector((x, y, 0.5)) + v * t * math.exp(-0.8 * t) + Vector((0, 0, -2.2 * t * t))
            c.location = (pos.x, pos.y, max(pos.z, 0.06))
            c.rotation_euler = (t * 9 + i, t * 7, t * 5)
            c.keyframe_insert("location", frame=frame + k); c.keyframe_insert("rotation_euler", frame=frame + k)
        c.hide_render = True; c.keyframe_insert("hide_render", frame=frame - 1)
        c.hide_render = False; c.keyframe_insert("hide_render", frame=frame)


for kind, x, y in LAYOUT:
    hinge = prop(kind, x, y)
    # first frame the walker comes within TRIGGER of this prop
    trig = next((f for f in range(1, scene.frame_end + 1) if (walker_xy(f) - Vector((x, y))).length < TRIGGER), None)
    hinge.rotation_euler.x = math.radians(-90); hinge.scale = (0.35, 0.35, 0.35)     # folded flat
    hinge.keyframe_insert("rotation_euler", frame=1); hinge.keyframe_insert("scale", frame=1)
    if trig is None:
        continue
    for k in range(0, 2 * FPS + 1):                        # sample the spring: one key per frame for 2 s
        p = spring(k / FPS)
        hinge.rotation_euler.x = math.radians(-90) * (1 - p)
        s = 0.35 + 0.65 * min(p, 1.25)
        hinge.scale = (s, s, s)
        hinge.keyframe_insert("rotation_euler", frame=trig + k); hinge.keyframe_insert("scale", frame=trig + k)
    confetti_burst(x, y, trig)

# ------------------------------------------------------------ light, camera, look
sun = bpy.data.lights.new("Sun", "SUN"); sun.energy = 3.0; sun.angle = math.radians(12)   # soft-edged shadows
sun_obj = bpy.data.objects.new("Sun", sun); scene.collection.objects.link(sun_obj)
sun_obj.rotation_euler = (math.radians(50), 0, math.radians(30))
world = bpy.data.worlds.new("World"); scene.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.9, 0.75, 0.78, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6

cam_data = bpy.data.cameras.new("Cam"); cam_data.lens = 85            # long lens = flatter, toy-like perspective
cam_data.dof.use_dof = True; cam_data.dof.aperture_fstop = 1.4        # shallow focus = miniature (tilt-shift) feel
cam_data.dof.focus_object = walker
cam = bpy.data.objects.new("Cam", cam_data); scene.collection.objects.link(cam); scene.camera = cam
track = cam.constraints.new("TRACK_TO"); track.target = walker; track.track_axis = "TRACK_NEGATIVE_Z"; track.up_axis = "UP_Y"
cam.parent = walker                                                    # follow the walker...
cam.location = (9, -12, 11)                                            # ...from a high three-quarter angle

scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in {
    e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items} else "BLENDER_EEVEE"
scene.render.resolution_x, scene.render.resolution_y = 1280, 720
try:
    scene.view_settings.view_transform = "AgX"
except TypeError:
    pass
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = out
if "--background" in sys.argv or "-b" in sys.argv:
    bpy.ops.render.render(animation=True)
    # then: ffmpeg -framerate 24 -i out/paper_popup_%04d.png -c:v libx264 -pix_fmt yuv420p paper_popup.mp4
