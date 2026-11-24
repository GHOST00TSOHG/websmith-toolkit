# Instructions for an AI Agent Using This Kit

This kit teaches advanced web and UI engineering. The owner wants the most
advanced material: be precise and current, and skip basics.

## How to load it
1. Read `README.md`.
2. Each `skills/<name>/SKILL.md` is a skill; its `description` says when to use it.
   For "what should I use" questions, start with `web-platform-state-2026`.
3. `code/` is the reference implementation; skills cite files by path.
4. `ROADMAP.md` lists staged projects. Ask which stage the owner is on.

## Working rules
- **Check support before recommending a feature:** Baseline status on
  webstatus.dev / MDN / caniuse. Ship non-Baseline features behind `@supports` or
  feature detection, with a working fallback.
- Semantic HTML first; ARIA only when HTML can't express it.
- Tokens are the source of truth: edit `site/tokens/*.json`, rebuild `tokens.css`
  (a test fails if it's stale), never hard-code colors in components.
- Every change: `python -m tools.audit site/*.html` and `python -m pytest -q`.
  Use the Playwright screenshots to check visual changes.
- Contrast: WCAG 2.2 ratios are the legal baseline; use APCA as a second opinion.
- Accessibility and legal statements are guidance, not legal advice.
- Framework and version facts were researched in November 2026; re-check release
  notes for anything version-specific.
