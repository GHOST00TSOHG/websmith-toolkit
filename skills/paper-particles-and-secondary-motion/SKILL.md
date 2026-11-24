---
name: paper-particles-and-secondary-motion
description: The "juice" that makes a pop-up world feel alive: paper confetti bursts (ballistic launch, air drag, flutter, tumbling, settling on the ground), squash and settle, growing contact shadows, walk bounce, idle sway of trees and flags. Use when adding particles or secondary animation to papercraft or toy-like scenes.
---

# Paper Particles & Secondary Motion

Reference: the confetti system and walker bob in `code/web/world.js`;
`confetti_burst()` in `code/blender/paper_popup_scene.py`.

## Paper confetti that behaves like paper
Real paper confetti is light and flat: it shoots up, **slows fast** (drag),
**tumbles**, and **flutters sideways** as it falls, then lies flat on the ground.
```
on pop:  spawn 20–30 squares at the prop, v = (±1.5, +3..6, ±1.5) m/s
each frame:
  v.y -= g × 0.35 × dt            // reduced gravity = light paper
  v   *= exp(-2.2 × dt)           // strong air drag (frame-rate independent)
  x   += sin(t × 6 + i) × small   // flutter
  angle += spin × dt              // tumble
  if y < ground: stick flat, stop; fade/despawn after its life
```
- Colours from the scene palette; sizes 5–8 cm at prop scale; 2–3 s life.
- Respect `prefers-reduced-motion` (no confetti in the kit's demo; the browser test checks it).
- Many particles: use instancing (three.js `InstancedMesh`) instead of
  rebuilding a buffer each frame as the demo does for simplicity.

## Secondary motion checklist
| Element | Motion | How |
|---|---|---|
| Prop landing | Overshoot + squash | spring ζ≈0.4 + brief Y-squash (`popPose`) |
| Contact shadow | Grows in with the pop | shadow radius and alpha × progress |
| Character | Walk bounce + slight tilt | `abs(sin(t × freq))` bob, small roll |
| Trees, flags | Idle sway | low-amplitude noise rotation at the base, per-object phase |
| Water sheet | Slow drift | scroll a subtle texture or ripple the edge outline |
| Dust/sparkles | Rare ambient specks | a few slow particles near the camera's focus band |

## Timing tips
- Fire the confetti at the moment the prop **passes upright**, not at the trigger,
  so the burst coincides with the overshoot peak (offset ≈ 0.15–0.25 s).
- Vary burst sizes by prop importance: big for landmarks, small for flowers.
- Add a sound: a paper "fwip" with ±10% random pitch per pop.

## Exercises
1. Switch confetti to `InstancedMesh` and support 5,000 particles.
2. Add tree sway with per-tree noise phases.
3. Make confetti pile up and fade, and let the character kick nearby pieces.

Part of `kits/paper-popup-world-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
