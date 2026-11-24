// Copies self-hosted assets into the source tree (run by hand; the results are committed).
//   fonts: Space Grotesk and JetBrains Mono, variable woff2, Latin subset, OFL-1.1 (D13)
import { copyFileSync, mkdirSync } from "node:fs";

const FONTS = "src/assets/fonts";
mkdirSync(FONTS, { recursive: true });

const pairs: readonly (readonly [string, string])[] = [
  ["node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2", `${FONTS}/space-grotesk-latin-wght-normal.woff2`],
  ["node_modules/@fontsource-variable/space-grotesk/LICENSE", `${FONTS}/OFL-space-grotesk.txt`],
  ["node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2", `${FONTS}/jetbrains-mono-latin-wght-normal.woff2`],
  ["node_modules/@fontsource-variable/jetbrains-mono/LICENSE", `${FONTS}/OFL-jetbrains-mono.txt`],
];
for (const [from, to] of pairs) {
  copyFileSync(from, to);
  console.log(`copied ${to}`);
}
