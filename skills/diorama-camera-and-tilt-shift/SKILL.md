---
name: diorama-camera-and-tilt-shift
description: Camera work that makes a scene read as a tiny physical model: high three-quarter angle, long lens / narrow field of view, tilt-shift blur bands or shallow depth of field, smooth critically damped follow, framing and look-ahead. Use for diorama, miniature, toy or papercraft scenes in real time or offline.
---

# Diorama Camera & Tilt-Shift

Reference: camera + `POST_FS` pass in `code/web/world.js`; camera setup in
`code/blender/paper_popup_scene.py`.

## Why it reads as "miniature"
Our brains judge scale from depth of field. Real tiny models photographed up
close have a **very shallow focus band**, so a large scene rendered with
strong blur above and below a focus band looks like a tabletop model. That's the
tilt-shift effect.

## Camera recipe
- **High three-quarter angle** (≈ 35–50° down), offset sideways so paths
  run diagonally through the frame.
- **Narrow FOV / long lens** (web: ≈ 30–35° vertical FOV; Blender: 70–100 mm).
  Flatter perspective reads as toy-like.
- **Follow smoothly:** move the camera toward its target with frame-rate
  independent damping, `k = 1 − exp(−rate × dt)`, or a critically damped spring.
  Never hard-lock to the character. Add slight **look-ahead** in the walking
  direction for reveals.
- Keep the character slightly below centre so the world it walks *into* gets space.

## Tilt-shift in real time (screen-space)
Render the scene to an offscreen texture, then blur each pixel by an amount
that grows with its distance from a horizontal **focus band**:
```
d = max(|uv.y − focus| − band, 0);   radius = clamp(d × 3, 0, 1) × maxBlur
color = average of ~24 golden-angle disc samples within radius
```
Cheap and convincing for top-down dioramas. Upgrade to depth-based bokeh (circle of
confusion from the depth buffer) when objects stand tall in the blurred zone.
Finish with a gentle filmic tonemap, warm grade, vignette and fine grain.

## Offline (Blender)
Real depth of field: focus object = character, f-stop 1.2–2.0, long lens. Or
render normally and apply a gradient-masked Defocus/Blur in the compositor for
classic tilt-shift. Blur is the miniature cue; don't overdo the band width.

## Pitfalls
- Too much blur hides the pop-up moments. Keep the focus band around the
  character and the next props.
- A wide FOV breaks the illusion (distortion reads as a big space).
- Camera jitter from per-frame lerps at variable frame rates: use exp-based damping.

## Exercises
1. Swap the screen-space blur for depth-based bokeh and compare on the tall gate.
2. Add look-ahead: offset the target by the character's velocity × 0.5 s.
3. Make a "photo mode" that animates the focus band to frame a newly popped prop.

Part of `kits/paper-popup-world-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
