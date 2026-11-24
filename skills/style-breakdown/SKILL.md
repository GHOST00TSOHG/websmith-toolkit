---
name: style-breakdown
description: Identifies and breaks down the "paper pop-up world" animation style (papercraft diorama with props that fold up out of the ground as a character walks past, confetti bursts and a tilt-shift miniature camera), its reference works, and the component techniques. Use first when asked to recreate, extend or explain this style.
---

# Style Breakdown: Paper Pop-Up World

## What it is
A **papercraft diorama** with **proximity-triggered pop-up props**. A small
character (here a blocky black-and-white voxel cat) walks along a path through a
world that looks built from cut and folded paper. As it approaches, houses, trees,
gates, signs and decorations **fold up out of the flat ground like a pop-up book
page**, overshoot slightly, settle, and release a burst of **paper confetti**. The
camera trails the character from a high three-quarter angle with strong top and
bottom blur, so the scene reads as a **tiny physical model** (the tilt-shift effect).

Names you'll see for it: papercraft / paper-cut style, pop-up book effect,
diorama, "world builds itself as you walk", proximity reveal, tilt-shift miniature.

## The six ingredients (and which skill covers each)
| Ingredient | What makes it read | Skill |
|---|---|---|
| Paper look | Matte paper with fibre grain, darker cut edges, visible thickness, flat pastel colors, soft light | `papercraft-look` |
| Layered ground | Flat paper sheets (land, water, path) stacked with torn edges and tiny drop shadows | `papercraft-look` |
| Pop-up reveal | Distance trigger → piece rotates up from flat around its base hinge with a spring overshoot, staggered | `proximity-popup-system` |
| Juice | Confetti burst, squash on landing, contact shadow growing in | `paper-particles-and-secondary-motion` |
| Miniature camera | High angle, long lens / narrow FOV, tilt-shift blur bands, smooth follow | `diorama-camera-and-tilt-shift` |
| Character | Simple readable silhouette (voxel or paper cut-out), bouncy walk | `building-it-for-the-web`, `building-it-in-blender` |

## How the original was probably made (be honest about uncertainty)
From the video alone you can't tell whether it was a real-time engine scene
(three.js, Unity, Godot), a Blender render, or partly AI-generated video. The
recipe in this kit recreates the *look and behaviour* in both real time (web) and
offline (Blender) and works whichever way the original was made.

## Reference works in the same family
- *Paper Cut Mansion*: everything is drawn on real paper, then "cut out" into
  planes in Blender and "folded" into 3D parts, mimicking real papercraft.
- Blender Studio's *DOGWALK* game: a papercraft environment look-dev'd in Godot,
  with torn-paper pathways, ripped edges and paper trees.
- Paper Mario, Tearaway, The Collage Atlas (drawn on paper, scanned, arranged as a
  papercraft theatre), and game-jam projects using a custom paper shader with
  creases on the edges.

## Sources
- Paper Cut Mansion deep dive: https://gamedeveloper.com/art/deep-dive-how-paper-cut-mansion-was-made
- Blender Studio, DOGWALK papercraft environment: https://studio.blender.org/projects/dogwalk/3db3f7ad5c56f6/
- Blender Studio devlog, papercraft woods: https://studio.blender.org/blog/devlog-papercraft-woods/
- Proximity behaviours (scale/opacity/move on approach): https://vvveary.itch.io/proximity-wordl

Part of `kits/paper-popup-world-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
