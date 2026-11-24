# Paper Pop-Up World Kit

How to make the **paper pop-up world** animation style: a papercraft diorama
where houses, trees, gates and decorations **fold up out of the ground like a
pop-up book** as a character walks past, with paper confetti, soft contact
shadows and a tilt-shift "miniature" camera.

Skills are in agent-skill format (`skills/*/SKILL.md`). Working code covers the web
(real time) and Blender (rendered video).

**AI agents: read `AGENT_INSTRUCTIONS.md` first.**

## Skills
| Skill | Covers |
|---|---|
| `style-breakdown` | What the style is, its ingredients, reference works, sources (start here) |
| `proximity-popup-system` | Distance triggers, hysteresis, fold-up hinge pose, spring timing, stagger, spatial hash |
| `papercraft-look` | Paper shading, cut edges, thickness, torn layered ground, contact shadows, palette |
| `diorama-camera-and-tilt-shift` | High angle, long lens, follow camera, tilt-shift blur |
| `paper-particles-and-secondary-motion` | Paper confetti physics, squash, walk bounce, sway |
| `building-it-in-blender` | Full Blender recipe + Geometry Nodes alternative |
| `building-it-for-the-web` | The WebGL2 implementation, porting to three.js / R3F, performance, accessibility |

## Code
| Path | What it is | Tested |
|---|---|---|
| `code/web/popup.js` | Engine-agnostic pop-up logic (spring, pose, triggers, spatial hash, path) | 8 Node tests |
| `code/web/world.js` + `index.html` | The full effect in WebGL2, no libraries | Playwright + Chrome |
| `code/blender/paper_popup_scene.py` | Builds and keyframes the scene in Blender from Python | syntax only* |
| `code/demo/paper_popup_demo.mp4` | 12-second capture of the web version | n/a |

*Blender wasn't available where this kit was built. Run the script in your Blender first.

## Quick start
```bash
cd code
python3 -m http.server -d web 8000                      # open http://localhost:8000
node --test tests/popup.test.mjs                        # logic tests
python3 -m pytest -q                                    # all tests (needs playwright + Chrome)
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python blender/paper_popup_scene.py -- out/paper_popup_
```
Open `index.html?t=8` to jump to a moment (used for tests and stills).
