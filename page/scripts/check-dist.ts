// Checks on the built site in dist/ (run after `npm run build`: `npm run check:dist`, `npm test`, and the
// Pages workflow).
//   - size budgets (gzip) from docs/PLAN.md section 7
//   - launch gate: no forbidden files, secrets, home paths, emails or third-party hosts (prints every file)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const DIST = "dist";
const KB = 1024;
const problems: string[] = [];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const gz = (path: string): number => gzipSync(readFileSync(path)).length;
const files = walk(DIST);
const html = readFileSync(join(DIST, "index.html"), "utf8");

// ---- initial load: the HTML, its stylesheet, the entry script and anything it preloads
const initialRefs = [...html.matchAll(/(?:src|href)="\.\/(assets\/[^"]+\.(?:js|css|woff2))"/g)].map((m) => m[1] ?? "");
const initial = new Set(initialRefs.map((r) => join(DIST, r)));
const sizeOf = (paths: Iterable<string>, ext: string): number =>
  [...paths].filter((p) => p.endsWith(ext)).reduce((sum, p) => sum + (ext === ".woff2" ? statSync(p).size : gz(p)), 0);

const initialJs = sizeOf(initial, ".js");
const initialCss = sizeOf(initial, ".css");
const initialFont = sizeOf(initial, ".woff2");
const htmlSize = gz(join(DIST, "index.html"));
const total = initialJs + initialCss + initialFont + htmlSize;

const limit = (label: string, value: number, max: number): void => {
  const line = `${label.padEnd(22)} ${(value / KB).toFixed(1).padStart(6)} KB (limit ${max} KB)`;
  console.log(value > max * KB ? `FAIL ${line}` : `ok   ${line}`);
  if (value > max * KB) problems.push(`${label} is over its budget`);
};
limit("initial JS (gzip)", initialJs, 60);
limit("initial CSS (gzip)", initialCss, 20);
limit("HTML (gzip)", htmlSize, 45);
limit("critical font", initialFont, 35);
limit("initial total", total, 160);

// ---- lazy chunks: everything else is loaded on demand
for (const path of files.filter((f) => f.endsWith(".js") && !initial.has(f) && f.includes("assets"))) {
  const size = gz(path);
  const name = path.replace(`${DIST}/assets/`, "");
  const max = 30;
  console.log(`${size > max * KB ? "FAIL" : "ok  "} lazy ${name.padEnd(34)} ${(size / KB).toFixed(1).padStart(6)} KB (limit ${max} KB)`);
  if (size > max * KB) problems.push(`lazy chunk ${name} is over ${max} KB`);
}

// ---- launch gate: everything in dist/ is public the moment Pages is on.
// 1. No files that must never ship: env files, local overrides, keys and certificates, source maps,
//    notes and markdown (HANDOFF, briefs, PLAN, any *.md).
const FORBIDDEN_FILES: readonly [RegExp, string][] = [
  [/(^|\/)\.env/i, "an env file"],
  [/\.local(\.|$)/i, "a local-only file"],
  [/\.(pem|key|p12|pfx|crt|cer|keystore)$/i, "a key or certificate"],
  [/\.map$/i, "a source map"],
  [/\.(md|markdown)$/i, "a markdown or notes file"],
  [/(^|\/)(HANDOFF|brief|PLAN|notes?|TODO|LAUNCH)[^/]*$/i, "a notes file"],
];
// 2. No key-like strings, home paths or email addresses in any text file.
const SECRETS: readonly [RegExp, string][] = [
  [/(?<![A-Za-z0-9])sk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/, "an API key (sk-)"],
  [/\bgh[opsur]_[A-Za-z0-9]{20,}/, "a GitHub token"],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/, "a GitHub token"],
  [/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/, "an AWS key"],
  [/\bxox[abposr]-[A-Za-z0-9-]{10,}/, "a Slack token"],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/, "a Bearer token"],
  [/\b(?:CLOUDFLARE|CF)_[A-Z_]*(?:TOKEN|KEY)\b\s*[:=]\s*["']?[A-Za-z0-9_-]{20,}/, "a Cloudflare token"],
  [/\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/, "a JWT"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a private key"],
  [/(?:\/Users\/|\/home\/)[A-Za-z0-9._-]+|[A-Za-z]:\\Users\\/, "an absolute home path"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/, "an email address"],
];
// 3. No URL host other than the toolkit's own GitHub repository (XML namespace names are not requests).
const siteConfig: unknown = JSON.parse(readFileSync("content/site.config.json", "utf8"));
const repoUrl: unknown = typeof siteConfig === "object" && siteConfig !== null ? Reflect.get(siteConfig, "toolkitRepoUrl") : null;
const NAMESPACES = ["http://www.w3.org/2000/svg", "http://www.w3.org/1999/xlink", "http://www.w3.org/1999/xhtml"];
const urlAllowed = (url: string): boolean =>
  NAMESPACES.includes(url) || (typeof repoUrl === "string" && repoUrl !== "" && (url === repoUrl || url.startsWith(`${repoUrl}/`)));
// The CSP is checked on its own: 'self', https: (the owner's own webhook, wherever it lives) and loopback
// for local testing. No named third-party host may appear in it.
const CSP = /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/;
const BINARY = /\.(png|jpe?g|webp|gif|ico|woff2?)$/i;

const rel = (path: string): string => path.slice(DIST.length + 1);
console.log(`\nlaunch-gate scan of ${files.length} files in ${DIST}/:`);
for (const path of files) {
  const name = rel(path);
  console.log(`  ${name}`);
  for (const [pattern, what] of FORBIDDEN_FILES) if (pattern.test(name)) problems.push(`${name} is ${what}; it must not ship`);
  if (BINARY.test(name)) continue;
  let text = readFileSync(path, "utf8");
  const csp = CSP.exec(text);
  if (csp !== null) {
    const sources = (csp[1] ?? "").split(/[\s;]+/).filter((s) => /[.:]/.test(s) && !s.startsWith("'"));
    for (const s of sources) if (!["https:", "data:", "blob:", "http://localhost:*", "http://127.0.0.1:*"].includes(s)) problems.push(`${name}: CSP names ${s}`);
    text = text.replace(csp[0], "");
  }
  for (const [pattern, what] of SECRETS) {
    const m = pattern.exec(text);
    if (m !== null) problems.push(`${name} contains ${what}: ${m[0].slice(0, 12)}…`);
  }
  for (const m of text.matchAll(/https?:\/\/[^\s"'`)<>\\]+/g)) {
    if (!urlAllowed(m[0])) problems.push(`${name} mentions ${m[0]}`);
  }
}

if (problems.length > 0) {
  console.error(`\n${problems.join("\n")}`);
  process.exit(1);
}
console.log("dist checks ok");
