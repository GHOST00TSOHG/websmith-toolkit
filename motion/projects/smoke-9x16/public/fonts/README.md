# Bundled fonts (offline, deterministic renders)

No render may fetch a font from the network. Every face used by a project lives here and is loaded in
`src/lib/tokens.ts` with `@remotion/fonts` `loadFont` + `staticFile('fonts/...')`.

| family | file(s) | weights | license | source |
|---|---|---|---|---|
| Inter 4.1 | `Inter-{Regular,SemiBold,ExtraBold,Black}.woff2` | 400, 600, 800, 900 | SIL OFL 1.1 (`OFL-Inter.txt`) | https://github.com/rsms/inter/releases/tag/v4.1 (`extras/woff-hinted`) |
| Jost | `jost-300-500.woff2` (variable, 11.9 KB) | 300–500 | SIL OFL 1.1 (`OFL-Jost.txt`), by Owen Earl / indestructible type* | https://github.com/indestructible-type/Jost (basic-Latin subset, weights 300–500) |

Notes
- The Jost file is a basic-Latin subset (11.9 KB). Check any accented or special character with a still before
  using it (missing glyphs fall back to Inter).
- Add a family: drop the woff2 + its licence here, add a `loadFont` call in `tokens.ts`, list it in this table.
