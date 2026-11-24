// Build-time rendering of the toolkit list and filter chips into index.html (a Vite plugin).
// The page reads fine before any script runs. Runtime code only enhances this markup.
import { readFileSync } from "node:fs";
import type { Plugin } from "vite";
import { GROUP_LABEL, GROUPS, ITEM_KINDS, parseManifest, type Item, type ItemKind, type ToolkitManifest } from "../src/core/manifest.ts";

const KIND_LABEL: Readonly<Record<ItemKind, string>> = {
  skill: "Skills",
  kit: "Kits",
  animation: "Animations",
  motion: "Motion",
  installer: "Installers",
};

const esc = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function loadManifest(): ToolkitManifest {
  const parsed = parseManifest(JSON.parse(readFileSync("src/generated/toolkit.manifest.json", "utf8")));
  if (!parsed.ok) throw new Error(`manifest: ${parsed.error}`);
  return parsed.value;
}

function kindLabel(item: Item): string {
  switch (item.kind) {
    case "skill":
      return "Skill";
    case "kit":
      return "Learning kit";
    case "animation":
      return "Animation";
    case "installer":
      return "Installer";
    case "motion":
      switch (item.motion.part) {
        case "move":
          return "Motion move";
        case "transition":
          return "Transition";
        case "kit":
          return "Motion kit";
        default: {
          const _exhaustive: never = item.motion;
          return String(_exhaustive);
        }
      }
    default: {
      const _exhaustive: never = item;
      return String(_exhaustive);
    }
  }
}

function details(manifest: ToolkitManifest, item: Item): string {
  switch (item.kind) {
    case "kit": {
      const names = item.skills.map((id) => `<li>${esc(manifest.items.find((i) => i.id === id)?.title ?? id)}</li>`).join("");
      return `<p class="label">Skills in this kit</p><ul class="detail-list">${names}</ul>`;
    }
    case "skill": {
      const sections = item.sections.map((s) => `<li>${esc(s)}</li>`).join("");
      const code = item.snippet === null ? "" : `<p class="label">How to use</p><pre><code>${esc(item.snippet)}</code></pre>`;
      return `<p class="label">What is inside</p><ul class="detail-list">${sections}</ul>${code}`;
    }
    case "animation": {
      const rows = item.presets.map((p) => `<li><strong>${esc(p.name)}</strong>: ${esc(p.what)}. Use it for ${esc(p.useWhen.toLowerCase())}.</li>`).join("");
      return `<p class="label">Nine designs, two sizes (64 and 20)</p><ul class="detail-list">${rows}</ul>`;
    }
    case "motion":
      return item.note === "" ? `<p class="label">Part of the motion kit</p>` : `<p class="label">About this</p><p>${esc(item.note)}</p>`;
    case "installer":
      return `<p class="label">Script</p><p><code>${esc(item.script)}</code></p><p class="label">Writes to</p><p><code>${esc(item.writesTo)}</code></p><p class="label">Runs on</p><p>Apple Silicon Mac</p>`;
    default: {
      const _exhaustive: never = item;
      return String(_exhaustive);
    }
  }
}

function sourceHref(manifest: ToolkitManifest, item: Item): string | null {
  const repo = manifest.toolkit.repoUrl;
  if (repo === null) return null;
  const isFolder = !/\.[a-z]+$/i.test(item.sourcePath);
  return `${repo}/${isFolder ? "tree" : "blob"}/${manifest.toolkit.sha}/${item.sourcePath}`;
}

/** One small line icon per kind of item, drawn once as a sprite and reused by every row. */
type IconId = "skill" | "animation" | "move" | "transition" | "kit" | "installer";
const ICON_PATHS: Readonly<Record<IconId, string>> = {
  skill: '<path d="M4 2.5h5.5L12 5v8.5H4z" /><path d="M9.5 2.5V5H12M6 8h4M6 10.5h4" />',
  animation: '<circle cx="8" cy="8" r="5.5" stroke-dasharray="1.6 1.9" /><circle cx="8" cy="8" r="1.6" />',
  move: '<path d="M2.5 12.5c3-1 4-8 11-9" /><path d="m11 2.5 2.5 1-1 2.5" />',
  transition: '<rect x="2.5" y="3.5" width="7" height="6" rx="1" /><rect x="6.5" y="6.5" width="7" height="6" rx="1" />',
  kit: '<path d="M2 4.5h4l1.2 1.5H14v7H2z" />',
  installer: '<path d="M8 2.5v7M5 6.5l3 3 3-3" /><path d="M2.5 10.5v3h11v-3" />',
};
function iconOf(item: Item): IconId {
  return item.kind === "motion" ? item.motion.part : item.kind;
}
function iconSprite(): string {
  const symbols = Object.entries(ICON_PATHS).map(([id, d]) => `<symbol id="i-${id}" viewBox="0 0 16 16">${d}</symbol>`).join("");
  return `<svg class="icon-sprite" width="0" height="0" aria-hidden="true" focusable="false"><defs>${symbols}</defs></svg>`;
}

/** One row: the name is a real button that opens the row's details (with the Source link) under it. */
function row(manifest: ToolkitManifest, item: Item, index: number): string {
  const href = sourceHref(manifest, item);
  const source = href === null ? "" : `<p><a class="row-source" href="${esc(href)}" target="_blank" rel="noopener noreferrer">Source<span class="sr-only"> for ${esc(item.title)} (opens in a new tab)</span></a></p>`;
  const kindText = item.group === "core" ? kindLabel(item) : `${kindLabel(item)} · ${GROUP_LABEL[item.group]}`;
  return `<li class="row${index % 2 === 1 ? " alt" : ""}" id="item-${item.id}" data-id="${item.id}" data-kind="${item.kind}" data-group="${item.group}" data-tags="${esc(item.tags.join(" "))}">
  <div class="row-line">
    <button class="row-open" type="button" aria-expanded="false" aria-controls="more-${item.id}" aria-describedby="desc-${item.id}"><svg class="row-icon" width="16" height="16" aria-hidden="true" focusable="false"><use href="#i-${iconOf(item)}" /></svg><span class="row-name">${esc(item.title)}</span></button>
    <span class="row-desc" id="desc-${item.id}">${esc(item.oneLiner)}</span>
    <span class="row-kind">${esc(kindText)}</span>
  </div>
  <div class="row-more" id="more-${item.id}" hidden>${details(manifest, item)}${source}</div>
</li>`;
}

function list(manifest: ToolkitManifest): string {
  return `${iconSprite()}
<div class="list-head" aria-hidden="true"><span>Name</span><span>Description</span><span>Kind</span></div>
<ul class="rows" id="rows" aria-labelledby="toolkit-title">
${manifest.items.map((item, i) => row(manifest, item, i)).join("\n")}
</ul>`;
}

/** A filter chip is a label over a real switch input, so a tap on iPhone gives the system haptic tick. */
function chip(filter: string, value: string, text: string, n: number): string {
  return `<label class="chip" data-filter="${filter}" data-value="${esc(value)}"><input class="chip-switch" type="checkbox" switch role="switch" /><span class="chip-text">${esc(text)}</span> <span class="chip-count">${n}</span></label>`;
}

function filters(manifest: ToolkitManifest): string {
  const groups = GROUPS.map((g) => chip("group", g, GROUP_LABEL[g], manifest.items.filter((i) => i.group === g).length));
  const kinds = ITEM_KINDS.map((kind) => chip("kind", kind, KIND_LABEL[kind], manifest.items.filter((i) => i.kind === kind).length));
  return `<div class="toolbar glass" id="toolbar" data-build="bar">
  <div class="search">
    <label class="sr-only" for="search">Search the toolkit</label>
    <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
    <input id="search" class="field search-input" type="search" placeholder="Search" autocomplete="off" spellcheck="false" />
  </div>
  <div class="rail" role="group" aria-label="Filter by kit">
      ${groups.join("\n      ")}
  </div>
  <div class="rail" role="group" aria-label="Filter by type">
      ${kinds.join("\n      ")}
  </div>
  <div class="toolbar-foot">
    <p class="sr-only" id="result-count" role="status" aria-live="polite"></p>
    <button class="btn btn-ghost btn-small" type="button" id="clear-filters" hidden>Clear</button>
  </div>
</div>`;
}

export function prerender(): Plugin {
  return {
    name: "ws-prerender",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const manifest = loadManifest();
        const count = manifest.items.length;
        return html
          .replace("<!--@filters-->", filters(manifest))
          .replace("<!--@list-->", list(manifest))
          .replaceAll("<!--@count-->", String(count))
          .replace("<!--@sha-->", esc(manifest.toolkit.sha.slice(0, 12)));
      },
    },
  };
}
