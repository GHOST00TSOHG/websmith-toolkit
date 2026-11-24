---
name: accessibility-engineering
description: Engineering accessible interfaces to WCAG 2.2 AA (the EU's EN 301 549 v4.1.1 baseline): semantic HTML, ARIA patterns, keyboard and focus management, target size, contrast, motion, forms, testing with automated tools, keyboards and screen readers. Use for any UI work, audits, or compliance questions.
---

# Accessibility Engineering

Reference: `code/tools/audit.py` (static linter), `tests/test_site_e2e.py`
(keyboard, modal and reduced-motion tests in a real browser).

## Legal context (late 2026)
The European Accessibility Act has applied to private businesses since June 2025.
EN 301 549 v4.1.1 (Sept 2026) adopts **WCAG 2.2 AA**. In the US, the ADA and Section 508
rely on WCAG too. Build to WCAG 2.2 AA by default. (Not legal advice; check
your jurisdiction.)

## WCAG 2.2 additions to know
Focus Not Obscured (sticky headers mustn't cover focused items: use
`scroll-padding-top`), Focus Appearance (AAA), Dragging Movements (offer a
non-drag alternative), **Target Size minimum 24×24 CSS px** (the kit uses 44),
Consistent Help, Redundant Entry, and Accessible Authentication (no cognitive tests;
allow paste and password managers).

## Rules of thumb
1. **Native HTML first:** `<button>`, `<a href>`, `<dialog>`, `<details>`,
   `popover`, form labels. The first rule of ARIA is not to use ARIA when HTML has it.
2. **Every control has a name, role and state** (`aria-pressed`,
   `aria-expanded`, `aria-selected`, `aria-current="page"`).
3. **Keyboard:** everything is operable; focus is visible (`:focus-visible`
   with 3:1 contrast); order follows DOM; no positive tabindex. Composite widgets
   use roving tabindex (`<ui-tabs>` in `app.js`).
4. **Focus management:** modals trap focus and return it on close (native
   dialog does both); route changes move focus to the new heading or `<main>`.
5. **Announcements:** `role="status"` / `aria-live="polite"` for async results.
6. **Motion:** honor `prefers-reduced-motion`; no flashing above 3/sec.
7. **Zoom & reflow:** never block zoom; layouts work at 320px wide and 400% zoom.
8. **Contrast:** 4.5:1 text, 3:1 large text and UI parts (verified in tests).

## Testing stack
- Static: `python -m tools.audit` (this kit), eslint-plugin-jsx-a11y.
- Engine: axe-core (`@axe-core/playwright`), Lighthouse.
- Manual (essential): keyboard-only pass; screen readers NVDA + Firefox/Chrome,
  VoiceOver + Safari (macOS/iOS), TalkBack + Chrome. Automated tools find only
  about a third of issues.

## Exercises
1. Add axe-core to the Playwright suite and fail on serious violations.
2. Build an accessible combobox (APG pattern) and test it with VoiceOver.
3. Add a "skip to results" link and focus management for a filter form.

Part of `kits/advanced-web-ui-kit`. Code paths in this skill (such as `code/...`) are relative to that folder.
