# Instructions for an AI Agent Using This Kit

This folder teaches advanced computer animation with Python. The owner wants
advanced material, so skip beginner explanations unless asked.

## How to load it
1. Read `README.md`.
2. Treat each `skills/<name>/SKILL.md` as a skill; its `description` says when it
   applies. Load the relevant one before answering or coding in that area.
3. `code/anim/` is the reference implementation that the skills cite by file name.
4. `ROADMAP.md` lists staged projects. Ask the owner which stage they are on.

## Working rules
- Drive animation by **time**, not frame number. Keep simulation on a fixed timestep,
  decoupled from rendering.
- Seed all randomness so renders and tests are reproducible.
- Run `python -m pytest -q` in `code/` after changes; add a test for new math.
- When critiquing motion, name the principle involved (see `animation-principles`)
  and suggest a parameter change before suggesting new code.
- Render previews small and fast (ss=2, blur off); finals with ss=3–4 and blur on.
- The Blender script is untested in this kit; verify against the owner's Blender
  version and the official API docs.
