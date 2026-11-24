// Repo checks that run in `npm run check`.
//  - SCOPE 37: no reference videos or study files are tracked.
//  - SCOPE 36: no CDN or third-party URL in shipped source files.
//  - Coding rules: no console.* in src/.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const tracked = execFileSync("git", ["ls-files", "-co", "--exclude-standard"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => f.length > 0);

const problems: string[] = [];

const VIDEO = /\.(mp4|mov|webm|mkv|avi|m4v)$/i;
const STUDY = /(^|\/)(study|reference|refs?)[-_./]/i;
for (const f of tracked) {
  if (VIDEO.test(f)) problems.push(`video file in repo: ${f}`);
  if (STUDY.test(f) && !f.startsWith("docs/")) problems.push(`study or reference file in repo: ${f}`);
}

// Namespace strings and licence text are fine. Anything else is an external URL.
const ALLOWED_HOSTS = [
  "www.w3.org",
  "github.com/GHOST00TSOHG/websmith-toolkit",
  "creativecommons.org",
  "scripts.sil.org",
  "openfontlicense.org",
  "opensource.org",
];
const SHIPPED = /^(src|public|index\.html|404\.html)/;
const SKIP_EXTERNAL = /^src\/(vendor|generated)\//;
for (const f of tracked) {
  if (!SHIPPED.test(f) || !/\.(ts|css|html|svg|webmanifest|js)$/.test(f) || SKIP_EXTERNAL.test(f)) continue;
  const text = readFileSync(f, "utf8");
  for (const m of text.matchAll(/https?:\/\/([^\s"'`)<>]+)/g)) {
    const url = m[1] ?? "";
    if (/^(localhost|127\.0\.0\.1)/.test(url)) continue;
    if (!ALLOWED_HOSTS.some((h) => url.startsWith(h))) problems.push(`external URL in ${f}: ${m[0]}`);
  }
  if (f.startsWith("src/") && /\bconsole\.(log|info|debug|warn|error)\b/.test(text) && !SKIP_EXTERNAL.test(f)) {
    problems.push(`console call in ${f}`);
  }
}

// The list's descriptions are checked against the toolkit itself by `build-manifest.ts --check`.

// Public repo: no absolute home paths and no email addresses in any tracked text file of the page.
const PERSONAL: readonly [RegExp, string][] = [
  [/(?:\/Users\/|\/home\/)[A-Za-z0-9._-]+|[A-Za-z]:\\Users\\/, "an absolute home path"],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/, "an email address"],
];
for (const f of tracked) {
  if (f === "package-lock.json" || /\.(png|woff2?|jpe?g|ico)$/i.test(f) || f.startsWith("node_modules/")) continue;
  const text = readFileSync(f, "utf8");
  for (const [pattern, what] of PERSONAL) {
    const m = pattern.exec(text);
    if (m !== null && f !== "scripts/check-repo.ts" && f !== "scripts/check-dist.ts") problems.push(`${what} in ${f}: ${m[0].slice(0, 16)}…`);
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`repo checks ok (${tracked.length} files)`);
