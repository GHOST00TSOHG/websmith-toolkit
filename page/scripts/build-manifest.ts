// Reads the toolkit from the repository root (this page lives in page/ inside the toolkit repo) and writes
// src/generated/toolkit.manifest.json (git-ignored, rebuilt by every build) and content/seen.json (the
// committed ledger of dates for items that share one file).
//   tsx scripts/build-manifest.ts           write both files (run by `npm run build` and `npm run manifest`)
//   tsx scripts/build-manifest.ts --check   validate only, write nothing (run by `npm run check`)
// Every item needs one plain-English line in content/descriptions.json (15 words or fewer). A missing,
// long, empty or orphaned line fails both modes.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GROUPS, KIT_TOPICS, parseManifest, type Group, type KitTopic } from "../src/core/manifest.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const OUT = "src/generated/toolkit.manifest.json";
const LEDGER = "content/seen.json";
const MAX_LINE = 100;
const MAX_WORDS = 15;
const TOOLKIT_PATHS = ["skills", "kits", "animations", "install", "motion", "README.md"];
const checkOnly = process.argv.includes("--check");

function git(...args: string[]): string {
  return execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8" }).trim();
}
function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}
function json(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}
function hash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}
function fail(message: string): never {
  console.error(`manifest: ${message}`);
  process.exit(1);
}

if (!existsSync(join(ROOT, "skills"))) fail("no toolkit one folder up (expected skills/, kits/, motion/ next to page/)");
if (git("rev-parse", "--is-shallow-repository") === "true") fail("the clone is shallow, so dates would be wrong (CI: fetch-depth 0)");
// The toolkit's own last change, not the repo HEAD: a page-only commit must not look like a toolkit update.
const sha = git("log", "-1", "--format=%H", "--", ...TOOLKIT_PATHS);
const headDate = git("log", "-1", "--format=%cI", "--", ...TOOLKIT_PATHS);
if (sha === "" || headDate === "") fail("no git history for the toolkit folders");

function gitDates(path: string): { addedAt: string; updatedAt: string } {
  const dates = git("log", "--format=%cI", "--", path).split("\n").filter((d) => d.length > 0);
  // A file that is not committed yet (added in the commit being prepared) counts as changed at the toolkit head.
  return { addedAt: dates[dates.length - 1] ?? headDate, updatedAt: dates[0] ?? headDate };
}

// ---- inputs written by hand
const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
function recordOfStrings(x: unknown, label: string): Record<string, string> {
  if (!isRecord(x)) return fail(`${label} must be an object`);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(x)) {
    if (typeof v !== "string") return fail(`${label}.${k} must be a string`);
    out[k] = v;
  }
  return out;
}
function recordOfLists(x: unknown, label: string): Record<string, string[]> {
  if (!isRecord(x)) return fail(`${label} must be an object`);
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(x)) {
    if (!Array.isArray(v) || v.some((e) => typeof e !== "string")) return fail(`${label}.${k} must be a list of strings`);
    out[k] = v.map(String);
  }
  return out;
}
const descriptions = recordOfStrings(json("content/descriptions.json"), "descriptions");
const metaRaw = json("content/meta.json");
if (!isRecord(metaRaw)) fail("meta.json must be an object");
const tagTable = recordOfLists(metaRaw["tags"] ?? {}, "meta.tags"); // optional extra search words per item
const relations = recordOfLists(json("content/relations.json"), "relations");
const repoConfig = json("content/site.config.json");
const repoUrl = isRecord(repoConfig) && typeof repoConfig["toolkitRepoUrl"] === "string" && repoConfig["toolkitRepoUrl"] !== "" ? repoConfig["toolkitRepoUrl"] : null;

// ---- learning kits: kits/README.md lists each kit and its skills; everything else is the core toolkit
const kitOf = new Map<string, Group>();
const kitTable: { dir: string; group: Group; skills: string[] }[] = [];
if (existsSync(join(ROOT, "kits/README.md"))) {
  for (const m of read("kits/README.md").matchAll(/^\| `((?:advanced-)?([a-z-]+?)-kit)` \| .+? \| (.+?) \|$/gm)) {
    const name = m[2] === "bot-learning" ? "bots" : m[2] === "animation-skills" ? "animation" : m[2] === "paper-popup-world" ? "paper" : (m[2] ?? "");
    const group = GROUPS.find((g) => g === name) ?? fail(`kits/README.md names an unknown kit: ${m[1] ?? ""}`);
    const skills = [...(m[3] ?? "").matchAll(/`([a-z0-9-]+)`/g)].map((s) => `skill-${s[1] ?? ""}`);
    for (const id of skills) kitOf.set(id, group);
    kitTable.push({ dir: m[1] ?? "", group, skills });
  }
}

// ---- draft items (raw objects; parseManifest validates the final shape)
interface Draft {
  id: string;
  kind: string;
  title: string;
  sourcePath: string;
  hash: string;
  fileBacked: boolean;
  group: Group;
  extra: Record<string, unknown>;
}
const drafts: Draft[] = [];

function humanize(name: string): string {
  const spaced = name.replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

// Skills: first heading, section titles, first code fence.
for (const dir of readdirSync(join(ROOT, "skills")).sort()) {
  const path = `skills/${dir}/SKILL.md`;
  if (!existsSync(join(ROOT, path))) continue;
  const text = read(path);
  const heading = /^# (.+)$/m.exec(text);
  const sections = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1] ?? "");
  const fence = /```[a-z]*\n([\s\S]*?)```/.exec(text);
  const snippet = fence?.[1]?.trim().slice(0, 600) ?? null;
  const id = `skill-${dir}`;
  drafts.push({
    id, kind: "skill", title: heading?.[1] ?? dir, sourcePath: path, hash: hash(text), fileBacked: true, group: kitOf.get(id) ?? "core",
    extra: { sections, snippet },
  });
}

// Learning kits: one item per kit folder named in kits/README.md, listing its skills.
for (const kit of kitTable) {
  const path = `kits/${kit.dir}/README.md`;
  if (!existsSync(join(ROOT, path))) fail(`kits/README.md names ${kit.dir}, but ${path} is missing`);
  const text = read(path);
  const heading = /^# (.+)$/m.exec(text)?.[1] ?? kit.dir;
  drafts.push({
    id: `learn-${kit.dir}`, kind: "kit", title: heading.replace(/\s*[:(].*$/, "").trim(), sourcePath: `kits/${kit.dir}`, hash: hash(text),
    fileBacked: true, group: kit.group, extra: { skills: kit.skills },
  });
}

// Animation: the nine presets from the README table.
{
  const readme = read("animations/thinking-orbs/README.md");
  const pkg = json(join(ROOT, "animations/thinking-orbs/vendor/thinking-orbs-0.3.2/package.json"));
  const version = isRecord(pkg) && typeof pkg["version"] === "string" ? pkg["version"] : fail("orbs version missing");
  const presets = [...readme.matchAll(/^\| ([A-Z][a-z]+) \| `([a-z]+)` \/ `\.[a-z]+` \| (.+?) \| (.+?) \|$/gm)].map((m) => ({
    code: m[2] ?? "", name: m[1] ?? "", what: m[3] ?? "", useWhen: m[4] ?? "",
  }));
  if (presets.length !== 9) fail(`expected 9 ThinkingOrbs presets, found ${presets.length}`);
  drafts.push({
    id: "anim-thinking-orbs", kind: "animation", title: "ThinkingOrbs", sourcePath: "animations/thinking-orbs", hash: hash(readme),
    fileBacked: true, group: "core", extra: { version, presets },
  });
}

// Motion: moves and transitions live inside WEB.md, so they use the ledger for dates.
{
  const web = read("motion/WEB.md");
  const movesStart = web.indexOf("## 2 Moves");
  const transStart = web.indexOf("## 3 Transitions");
  if (movesStart < 0 || transStart < 0) fail("WEB.md sections moved");
  const movesText = web.slice(movesStart, transStart);
  const parts = movesText.split(/^(?=\*\*[A-Za-z]+\*\*)/m).filter((p) => p.startsWith("**"));
  if (parts.length !== 11) fail(`expected 11 moves, found ${parts.length}`);
  for (const block of parts) {
    const m = /^\*\*([A-Za-z]+)\*\*:?[ \t]*(.*)$/m.exec(block);
    const name = m?.[1] ?? fail("move name");
    const note = (m?.[2] ?? "").replace(/^[(:\s]+|[)\s]+$/g, "");
    drafts.push({
      id: `move-${name.toLowerCase()}`, kind: "motion", title: humanize(name), sourcePath: "motion/WEB.md", hash: hash(block), fileBacked: false,
      group: "core", extra: { motion: { part: "move", name }, note },
    });
  }
  const rows = web.slice(transStart).split("\n").filter((l) => /^\| [a-zA-Z]+ \|/.test(l) && !l.startsWith("| transition |"));
  if (rows.length !== 11) fail(`expected 11 transitions, found ${rows.length}`);
  for (const row of rows) {
    const cells = row.split("|").map((c) => c.trim());
    const name = cells[1] ?? fail("transition name");
    drafts.push({
      id: `transition-${name.toLowerCase()}`, kind: "motion", title: humanize(name), sourcePath: "motion/WEB.md", hash: hash(row), fileBacked: false,
      group: "core", extra: { motion: { part: "transition", name }, note: "" },
    });
  }
}

// Motion kit parts: each one is file-backed.
const KIT: readonly { topic: KitTopic; title: string; path: string; note: string }[] = [
  { topic: "playbook", title: "Motion playbook", path: "motion/PLAYBOOK.md", note: "Single source of truth for the motion kit." },
  { topic: "lottie", title: "Lottie icon library", path: "motion/lottie/library/INDEX.md", note: "Animated icons and emoji, MIT and CC BY 4.0." },
  { topic: "audio", title: "Soundtrack generator", path: "motion/audio/generate.py", note: "Generates a royalty-free soundtrack." },
  { topic: "qa", title: "Film QA checks", path: "motion/scripts/qa.sh", note: "Blocking automated checks before a film is shared." },
  { topic: "html-render", title: "HTML render fallback", path: "motion/html-render", note: "Renders a page animation to video." },
  { topic: "preset", title: "Starter preset", path: "motion/presets/starter", note: "A starting scene for a new film." },
  { topic: "demo-film", title: "Demo film", path: "motion/projects/demo", note: "A finished sample project." },
];
if (KIT.length !== KIT_TOPICS.length) fail("kit table out of sync with KIT_TOPICS");
function hashPath(path: string): string {
  const full = join(ROOT, path);
  if (!statSync(full).isDirectory()) return hash(readFileSync(full, "utf8"));
  return hash(git("ls-files", "-s", "--", path)); // the tracked blob ids of every file in the folder
}
for (const k of KIT) {
  drafts.push({
    id: `kit-${k.topic}`, kind: "motion", title: k.title, sourcePath: k.path, hash: hashPath(k.path), fileBacked: true,
    group: "core", extra: { motion: { part: "kit", topic: k.topic }, note: k.note },
  });
}

// Installers: scripts and the Xcode checklist; "writes to" comes from the README table.
{
  const readme = read("README.md");
  const rows = new Map<string, string>();
  for (const m of readme.matchAll(/^\| `install\/([^`]+)` \| .+? \| (.+?) \|$/gm)) rows.set(m[1] ?? "", (m[2] ?? "").replace(/`/g, ""));
  for (const file of readdirSync(join(ROOT, "install")).sort()) {
    const path = `install/${file}`;
    const text = read(path);
    const writesTo = rows.get(file) ?? fail(`README has no installer row for ${file}`);
    const base = file.replace(/\.(sh|md)$/, "");
    const title = file.endsWith(".md") ? (/^# (.+)$/m.exec(text)?.[1] ?? base) : humanizeInstaller(base);
    drafts.push({
      id: `install-${base}`, kind: "installer", title, sourcePath: path, hash: hash(text), fileBacked: true,
      group: "core", extra: { script: file, writesTo, platform: "macos-arm64" },
    });
  }
}
function humanizeInstaller(base: string): string {
  return base === "colmap-brush" ? "COLMAP and Brush" : base === "beanfx" ? "beanfx plugin" : base === "rust" ? "Rust (rustup)" : base;
}

// ---- checks on the hand-written files
const ids = new Set(drafts.map((d) => d.id));
const problems: string[] = [];
for (const d of drafts) {
  const line = descriptions[d.id];
  if (line === undefined) problems.push(`no plain-English line for ${d.id} in content/descriptions.json`);
  else if (line.trim() === "") problems.push(`line for ${d.id} is empty`);
  else if (line.length > MAX_LINE) problems.push(`line for ${d.id} is ${line.length} characters (max ${MAX_LINE})`);
  else if (line.trim().split(/\s+/).length > MAX_WORDS) problems.push(`line for ${d.id} is over ${MAX_WORDS} words`);
}
for (const id of Object.keys(descriptions)) if (!ids.has(id)) problems.push(`descriptions.json has an entry for an item that no longer exists: ${id}`);
for (const id of Object.keys(tagTable)) if (!ids.has(id)) problems.push(`meta.tags has an unknown id: ${id}`);
for (const [from, to] of Object.entries(relations)) {
  if (!ids.has(from)) problems.push(`relations has an unknown id: ${from}`);
  for (const t of to) if (!ids.has(t)) problems.push(`relations: ${from} points at unknown ${t}`);
}
for (const kit of kitTable) for (const s of kit.skills) if (!ids.has(s)) problems.push(`kits/README.md lists ${s} under ${kit.dir}, but there is no such skill`);
if (problems.length > 0) fail(`\n  ${problems.join("\n  ")}`);

// ---- ledger and dates
type Ledger = Record<string, { hash: string; addedAt: string; updatedAt: string }>;
const oldLedgerRaw = existsSync(LEDGER) ? json(LEDGER) : { items: {} };
const oldLedger: Ledger = {};
if (isRecord(oldLedgerRaw) && isRecord(oldLedgerRaw["items"])) {
  for (const [id, v] of Object.entries(oldLedgerRaw["items"])) {
    if (isRecord(v) && typeof v["hash"] === "string" && typeof v["addedAt"] === "string" && typeof v["updatedAt"] === "string") {
      oldLedger[id] = { hash: v["hash"], addedAt: v["addedAt"], updatedAt: v["updatedAt"] };
    }
  }
}
const newLedger: Ledger = {};
const rereads: string[] = [];
const items = drafts.map((d) => {
  const before = oldLedger[d.id];
  let addedAt: string;
  let updatedAt: string;
  if (d.fileBacked) {
    ({ addedAt, updatedAt } = gitDates(d.sourcePath));
  } else {
    addedAt = before?.addedAt ?? headDate;
    updatedAt = before === undefined || before.hash === d.hash ? (before?.updatedAt ?? headDate) : headDate;
  }
  if (before !== undefined && before.hash !== d.hash) rereads.push(d.id);
  newLedger[d.id] = { hash: d.hash, addedAt, updatedAt };
  return {
    id: d.id, kind: d.kind, title: d.title, oneLiner: descriptions[d.id], tags: tagTable[d.id] ?? [], group: d.group, related: relations[d.id] ?? [],
    addedAt, updatedAt, sourcePath: d.sourcePath, ...d.extra,
  };
});
if (!checkOnly) for (const id of rereads) console.warn(`manifest: the source of ${id} changed; re-read its plain-English line.`);

const manifestRaw = { schema: 1, toolkit: { sha, headDate, repoUrl }, items };
const parsed = parseManifest(manifestRaw);
if (!parsed.ok) fail(`generated manifest is invalid: ${parsed.error}`);

const counts = new Map<string, number>();
for (const it of items) counts.set(it.kind, (counts.get(it.kind) ?? 0) + 1);
const summary = `${items.length} items from toolkit ${sha.slice(0, 7)}: ${[...counts].map(([k, n]) => `${n} ${k}`).join(", ")}`;
if (checkOnly) {
  console.log(`manifest: ok, ${summary}; every item has a plain-English line.`);
} else {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(manifestRaw, null, 2)}\n`);
  writeFileSync(LEDGER, `${JSON.stringify({ items: newLedger }, null, 2)}\n`);
  console.log(`manifest: wrote ${summary}`);
}
