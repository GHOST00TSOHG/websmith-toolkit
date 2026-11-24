# Animation Skills Kit: Advanced Computer Animation with Python

Advanced, code-first computer animation: the principles, the math, procedural and
physics-based motion, rendering/encoding, and 3D automation in Blender. Skills are
in agent-skill format, so your AI agent can load them.

**AI agents: read `AGENT_INSTRUCTIONS.md` first.**

## Skills (`skills/*/SKILL.md`)

| Skill | What it teaches |
|---|---|
| `animation-principles` | The classic principles turned into parameters and code; diagnosing bad motion |
| `interpolation-and-easing-math` | Easing, cubic-bezier solving, splines, arc length, quaternions/slerp, frame-rate independence |
| `procedural-and-physics-animation` | Integrators, fixed timestep, springs, Verlet/PBD, IK, noise, particles, boids |
| `rendering-and-encoding` | Supersampling, motion blur in linear light, ffmpeg/H.264, GIF palettes, parallel rendering |
| `blender-python-scripting` | bpy keyframes, F-curves, drivers, procedural generation, rigging, headless rendering |

## Code (`code/`)

| File | Contents |
|---|---|
| `anim/easing.py` | 13 easing curves + CSS-style `cubic_bezier` solver |
| `anim/curves.py` | centripetal Catmull-Rom, arc-length paths, quaternion slerp |
| `anim/timeline.py` | keyframe `Track` (any value type) with per-segment easing and velocity |
| `anim/physics.py` | damped `Spring`, `VerletRope`, `fabrik` IK, `Noise1D` + fBm |
| `anim/render.py` | supersampled frames, linear-light motion blur, MP4 (ffmpeg) and GIF writers |
| `demos/bouncing_ball.py` | squash & stretch, anticipation, easing, decaying bounces, motion blur |
| `demos/rope_and_arm.py` | spline path, IK arm, spring follower, rope with noise wind, fixed-timestep sim |
| `blender/procedural_bounce.py` | bpy scene build, keyframes, F-curve edits, headless render (untested here) |
| `tests/test_anim.py` | 25 tests covering the math and physics |
| `out/` | pre-rendered demo MP4s and GIFs |

## Quick start
```bash
cd code
pip install numpy pillow pytest   # plus ffmpeg on your PATH for MP4 output
python -m pytest -q               # 25 tests should pass
python -m demos.bouncing_ball     # writes out/bouncing_ball.mp4 and .gif
python -m demos.rope_and_arm
```
Then follow `ROADMAP.md`.
