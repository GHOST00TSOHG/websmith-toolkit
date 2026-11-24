# Instructions for an AI Agent Using This Kit

This kit teaches one animation style: a **paper pop-up world** (papercraft
diorama where props fold up as a character walks by). The owner wants to be able
to make it.

## How to load it
1. Read `README.md`, then `skills/style-breakdown/SKILL.md` for the overview.
2. Each `skills/<name>/SKILL.md` is a skill; its `description` says when it applies.
3. `code/web/` is a working real-time version; `code/blender/` builds a
   rendered version; `code/demo/` shows the result.

## Working rules
- **Keep the logic engine-agnostic:** `popup.js` has no rendering code; reuse it
  when porting to three.js or other engines, and keep its Node tests passing
  (`node --test tests/popup.test.mjs`).
- **Blender script is untested** in the build environment. On macOS, Blender is at
  `/Applications/Blender.app/Contents/MacOS/Blender`. Run the script, read any
  error, fix the renamed API name, rerun. Report what changed.
- **Run the full suite** after changes: `python3 -m pytest -q` in `code/`
  (Playwright + Chrome; set `CHROME_PATH` if needed).
- **Feel first:** tune with the table in `proximity-popup-system` (spring
  frequency, damping, stagger) rather than rewriting code.
- **Accessibility:** keep reduced-motion behaviour (no overshoot, no confetti).
- Be honest that the original video's exact production method can't be confirmed;
  this kit recreates the look and behaviour.
