# Instructions for an AI Agent Using This Kit

This kit teaches production-level animation and VFX. The owner wants the most
advanced material: be technical, give the math, and skip basics.

## How to load it
1. Read `README.md`.
2. Each `skills/<name>/SKILL.md` is a skill; its `description` says when to use it.
   Start with `vfx-state-of-the-art-2026` when asked "what should I use or learn".
3. `code/vfx/` is the reference implementation; skills cite files by name.
4. `ROADMAP.md` lists staged projects. Ask which stage the owner is on.
5. Companion kit (if present): the Animation Skills Kit (principles, easing,
   IK, Blender basics).

## Working rules
- **Facts about tools go stale.** The state-of-the-art skill was researched in
  November 2026 and lists its sources. For version-specific claims, check the
  vendor's current docs before relying on them.
- Light math in scene-linear float; display transform last.
- Simulations: fixed substeps, seeded randomness, cache results; test invariants
  (divergence, constraint error, energy) rather than exact pixels.
- Run `python -m pytest -q` in `code/` after changes; add a test for each new
  solver feature.
- Preview small and fast; render finals in parallel.
- For generative AI work, remind the owner about model licences and rights to
  references, likenesses and footage.
