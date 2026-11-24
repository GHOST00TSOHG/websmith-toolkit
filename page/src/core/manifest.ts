// The toolkit manifest: its types and the one place where untrusted JSON becomes trusted data.
import { err, ok, type Result } from "./result.ts";

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };
export type ItemId = Brand<string, "ItemId">;

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export function asItemId(value: string): Result<ItemId> {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the brand is minted only after the pattern check
  return ID_PATTERN.test(value) ? ok(value as ItemId) : err(`bad item id: ${value}`);
}

export type OrbState =
  | "working" | "searching" | "solving" | "listening" | "connecting"
  | "weaving" | "composing" | "breathing" | "shaping";
export const ORB_STATES: readonly OrbState[] = [
  "working", "searching", "solving", "listening", "connecting", "weaving", "composing", "breathing", "shaping",
];

export type KitTopic = "playbook" | "lottie" | "audio" | "qa" | "html-render" | "preset" | "demo-film";
export const KIT_TOPICS: readonly KitTopic[] = ["playbook", "lottie", "audio", "qa", "html-render", "preset", "demo-film"];

/** Which shelf a card sits on: the core toolkit or one of the learning kits. */
export type Group = "core" | "vfx" | "web-ui" | "animation" | "bots" | "paper";
export const GROUPS: readonly Group[] = ["core", "web-ui", "animation", "vfx", "paper", "bots"];
export const GROUP_LABEL: Readonly<Record<Group, string>> = {
  core: "Core", "web-ui": "Web UI", animation: "Animation", vfx: "VFX", paper: "Paper world", bots: "Bots",
};

export type MotionPart =
  | { readonly part: "move"; readonly name: string }
  | { readonly part: "transition"; readonly name: string }
  | { readonly part: "kit"; readonly topic: KitTopic };

export interface OrbPreset {
  readonly code: OrbState;
  readonly name: string;
  readonly what: string;
  readonly useWhen: string;
}

export interface ItemBase {
  readonly id: ItemId;
  readonly title: string;
  readonly oneLiner: string;
  readonly tags: readonly string[];
  readonly group: Group;
  readonly related: readonly ItemId[];
  readonly addedAt: string;
  readonly updatedAt: string;
  readonly sourcePath: string;
}

export type Item = ItemBase &
  (
    | { readonly kind: "skill"; readonly sections: readonly string[]; readonly snippet: string | null }
    | { readonly kind: "animation"; readonly version: string; readonly presets: readonly OrbPreset[] }
    | { readonly kind: "motion"; readonly motion: MotionPart; readonly note: string }
    | { readonly kind: "installer"; readonly script: string; readonly writesTo: string; readonly platform: "macos-arm64" | "any" }
    | { readonly kind: "kit"; readonly skills: readonly ItemId[] }
  );

export type ItemKind = Item["kind"];
export const ITEM_KINDS: readonly ItemKind[] = ["skill", "kit", "animation", "motion", "installer"];

export interface ToolkitManifest {
  readonly schema: 1;
  readonly toolkit: { readonly sha: string; readonly headDate: string; readonly repoUrl: string | null };
  readonly items: readonly Item[];
}

type Obj = Readonly<Record<string, unknown>>;
function isObj(x: unknown): x is Obj {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function str(o: Obj, key: string): Result<string> {
  const v = o[key];
  return typeof v === "string" ? ok(v) : err(`${key}: expected a string`);
}

function strList(o: Obj, key: string): Result<readonly string[]> {
  const v = o[key];
  if (!Array.isArray(v)) return err(`${key}: expected a list`);
  const out: string[] = [];
  for (const entry of v) {
    if (typeof entry !== "string") return err(`${key}: expected strings`);
    out.push(entry);
  }
  return ok(out);
}

function oneOf<T extends string>(value: string, allowed: readonly T[]): T | null {
  return allowed.find((a) => a === value) ?? null;
}

function parseMotion(x: unknown): Result<MotionPart> {
  if (!isObj(x)) return err("motion: expected an object");
  const part = str(x, "part");
  if (!part.ok) return part;
  switch (part.value) {
    case "move":
    case "transition": {
      const name = str(x, "name");
      if (!name.ok) return name;
      return ok(part.value === "move" ? { part: "move", name: name.value } : { part: "transition", name: name.value });
    }
    case "kit": {
      const topic = str(x, "topic");
      if (!topic.ok) return topic;
      const known = oneOf(topic.value, KIT_TOPICS);
      return known === null ? err(`motion.topic: unknown ${topic.value}`) : ok({ part: "kit", topic: known });
    }
    default:
      return err(`motion.part: unknown ${part.value}`);
  }
}

function parsePresets(x: unknown): Result<readonly OrbPreset[]> {
  if (!Array.isArray(x)) return err("presets: expected a list");
  const out: OrbPreset[] = [];
  for (const entry of x) {
    if (!isObj(entry)) return err("presets: expected objects");
    const code = str(entry, "code");
    const name = str(entry, "name");
    const what = str(entry, "what");
    const useWhen = str(entry, "useWhen");
    if (!code.ok) return code;
    if (!name.ok) return name;
    if (!what.ok) return what;
    if (!useWhen.ok) return useWhen;
    const state = oneOf(code.value, ORB_STATES);
    if (state === null) return err(`presets.code: unknown ${code.value}`);
    out.push({ code: state, name: name.value, what: what.value, useWhen: useWhen.value });
  }
  return ok(out);
}

function parseItem(x: unknown): Result<Item> {
  if (!isObj(x)) return err("item: expected an object");
  const idText = str(x, "id");
  const kindText = str(x, "kind");
  const title = str(x, "title");
  const oneLiner = str(x, "oneLiner");
  const addedAt = str(x, "addedAt");
  const updatedAt = str(x, "updatedAt");
  const sourcePath = str(x, "sourcePath");
  const tags = strList(x, "tags");
  const relatedText = strList(x, "related");
  const groupText = str(x, "group");
  if (!groupText.ok) return groupText;
  const group = oneOf(groupText.value, GROUPS);
  if (group === null) return err(`group: unknown ${groupText.value}`);
  if (!idText.ok) return idText;
  if (!kindText.ok) return kindText;
  if (!title.ok) return title;
  if (!oneLiner.ok) return oneLiner;
  if (!addedAt.ok) return addedAt;
  if (!updatedAt.ok) return updatedAt;
  if (!sourcePath.ok) return sourcePath;
  if (!tags.ok) return tags;
  if (!relatedText.ok) return relatedText;
  const id = asItemId(idText.value);
  if (!id.ok) return id;
  const related: ItemId[] = [];
  for (const r of relatedText.value) {
    const rid = asItemId(r);
    if (!rid.ok) return rid;
    related.push(rid.value);
  }
  const base: ItemBase = {
    id: id.value,
    title: title.value,
    oneLiner: oneLiner.value,
    tags: tags.value,
    group,
    related,
    addedAt: addedAt.value,
    updatedAt: updatedAt.value,
    sourcePath: sourcePath.value,
  };
  const kind = oneOf(kindText.value, ITEM_KINDS);
  if (kind === null) return err(`item.kind: unknown ${kindText.value}`);
  switch (kind) {
    case "skill": {
      const sections = strList(x, "sections");
      if (!sections.ok) return sections;
      const snippet = x["snippet"];
      if (snippet !== null && typeof snippet !== "string") return err("snippet: expected a string or null");
      return ok({ ...base, kind, sections: sections.value, snippet });
    }
    case "animation": {
      const version = str(x, "version");
      const presets = parsePresets(x["presets"]);
      if (!version.ok) return version;
      if (!presets.ok) return presets;
      return ok({ ...base, kind, version: version.value, presets: presets.value });
    }
    case "motion": {
      const motion = parseMotion(x["motion"]);
      const note = str(x, "note");
      if (!motion.ok) return motion;
      if (!note.ok) return note;
      return ok({ ...base, kind, motion: motion.value, note: note.value });
    }
    case "installer": {
      const script = str(x, "script");
      const writesTo = str(x, "writesTo");
      const platform = str(x, "platform");
      if (!script.ok) return script;
      if (!writesTo.ok) return writesTo;
      if (!platform.ok) return platform;
      const p = oneOf(platform.value, ["macos-arm64", "any"] as const);
      if (p === null) return err(`platform: unknown ${platform.value}`);
      return ok({ ...base, kind, script: script.value, writesTo: writesTo.value, platform: p });
    }
    case "kit": {
      const skillText = strList(x, "skills");
      if (!skillText.ok) return skillText;
      const skills: ItemId[] = [];
      for (const s of skillText.value) {
        const sid = asItemId(s);
        if (!sid.ok) return sid;
        skills.push(sid.value);
      }
      return ok({ ...base, kind, skills });
    }
    default: {
      const _exhaustive: never = kind;
      return err(`unreachable ${String(_exhaustive)}`);
    }
  }
}

/** Parse the manifest JSON once, at the boundary. Everything after this trusts the types. */
export function parseManifest(raw: unknown): Result<ToolkitManifest> {
  if (!isObj(raw)) return err("manifest: expected an object");
  if (raw["schema"] !== 1) return err("manifest: unsupported schema");
  const toolkit = raw["toolkit"];
  if (!isObj(toolkit)) return err("toolkit: expected an object");
  const sha = str(toolkit, "sha");
  const headDate = str(toolkit, "headDate");
  if (!sha.ok) return sha;
  if (!headDate.ok) return headDate;
  const repoUrl = toolkit["repoUrl"];
  if (repoUrl !== null && typeof repoUrl !== "string") return err("repoUrl: expected a string or null");
  const rawItems = raw["items"];
  if (!Array.isArray(rawItems)) return err("items: expected a list");
  const items: Item[] = [];
  const seen = new Set<string>();
  for (const entry of rawItems) {
    const item = parseItem(entry);
    if (!item.ok) return err(`items: ${item.error}`);
    if (seen.has(item.value.id)) return err(`items: duplicate id ${item.value.id}`);
    seen.add(item.value.id);
    items.push(item.value);
  }
  for (const item of items) {
    for (const r of item.related) if (!seen.has(r)) return err(`${item.id}: related id ${r} does not exist`);
    if (item.kind === "kit") for (const s of item.skills) if (!seen.has(s)) return err(`${item.id}: skill ${s} does not exist`);
  }
  return ok({ schema: 1, toolkit: { sha: sha.value, headDate: headDate.value, repoUrl }, items });
}
