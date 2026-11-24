// Licence gate: every package in package-lock.json must carry an allowed licence (docs/PLAN.md section 2.4).
// MPL-2.0 is allowed only for dev-only tools that are never shipped: axe-core (tests, owner decision D6) and
// lightningcss (Vite's CSS minifier, a build tool). Nothing MPL-licensed is in dist/.
import { existsSync, readFileSync } from "node:fs";

const ALLOWED = new Set([
  "MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "OFL-1.1", "CC0-1.0", "0BSD", "BlueOak-1.0.0", "CC-BY-4.0", "Python-2.0",
]);
const DEV_ONLY = new Set(["MPL-2.0"]);

interface Entry {
  readonly license?: string;
  readonly dev?: boolean;
}
const lock: unknown = JSON.parse(readFileSync("package-lock.json", "utf8"));
const packages: unknown = typeof lock === "object" && lock !== null ? Reflect.get(lock, "packages") : null;
if (typeof packages !== "object" || packages === null) throw new Error("package-lock.json has no packages");

function allowedExpression(expression: string): boolean {
  // "(MIT OR CC0-1.0)" is fine when any one option is allowed; "A AND B" needs both.
  return expression
    .replace(/[()]/g, "")
    .split(/\s+OR\s+/)
    .some((option) => option.split(/\s+AND\s+/).every((id) => ALLOWED.has(id.trim())));
}

const problems: string[] = [];
let count = 0;
for (const [path, raw] of Object.entries(packages)) {
  if (path === "") continue;
  const entry: Entry = typeof raw === "object" && raw !== null ? { license: Reflect.get(raw, "license"), dev: Reflect.get(raw, "dev") === true } : {};
  const name = path.replace(/^.*node_modules\//, "");
  count += 1;
  const license = entry.license ?? "UNKNOWN";
  if (allowedExpression(license)) continue;
  if (DEV_ONLY.has(license) && entry.dev === true) continue;
  problems.push(`${name}: ${license}${entry.dev === true ? " (dev)" : ""}`);
}
// Shipped third-party code and fonts (they are in dist/): each keeps its licence next to it, and each
// licence is one that can be redistributed inside this MIT repository.
const SHIPPED: readonly { path: string; licence: string; mustSay: RegExp }[] = [
  { path: "src/vendor/thinking-orbs/LICENSE", licence: "MIT", mustSay: /^MIT License/ },
  { path: "src/assets/fonts/OFL-space-grotesk.txt", licence: "OFL-1.1", mustSay: /SIL Open Font License, Version 1\.1/ },
  { path: "src/assets/fonts/OFL-jetbrains-mono.txt", licence: "OFL-1.1", mustSay: /SIL Open Font License, Version 1\.1/ },
];
for (const s of SHIPPED) {
  const text = existsSync(s.path) ? readFileSync(s.path, "utf8") : null;
  if (text === null) problems.push(`${s.path} is missing (${s.licence} needs its licence shipped with the code)`);
  else if (!s.mustSay.test(text)) problems.push(`${s.path} is not the expected ${s.licence} text`);
}
if (!/^MIT License/.test(readFileSync("../LICENSE", "utf8"))) problems.push("the repository LICENSE is no longer MIT; re-check every licence above");
// The page has no runtime npm dependencies: everything in package.json is a build or test tool.
const pkg: unknown = JSON.parse(readFileSync("package.json", "utf8"));
if (typeof pkg === "object" && pkg !== null && Reflect.get(pkg, "dependencies") !== undefined) {
  problems.push("package.json has runtime dependencies; add their licences to the credits and to this check");
}

if (problems.length > 0) {
  console.error(`licence gate failed:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`licences ok (${count} packages; shipped: ThinkingOrbs MIT, two OFL fonts; repo MIT)`);
