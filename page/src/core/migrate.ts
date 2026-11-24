// The personal settings record and its migration. Pure: no DOM, no storage. Tested by scripts/test-migrate.ts
// (part of `npm run check`).
//
// Everything a visitor sets lives in ONE localStorage record, `ws.settings`, with a `schemaVersion`. Before
// it existed (schema 1), the page kept separate `ws.v1.*` keys. `migrate` folds those into the record once:
// it never loses a value it understands, ignores broken values, leaves unknown keys alone, and running it
// again changes nothing.
import { err, ok, type Result } from "./result.ts";

export const SETTINGS_KEY = "ws.settings";
export const LEGACY_PREFIX = "ws.v1.";
export const SCHEMA_VERSION = 2;

declare const brand: unique symbol;
/** An https URL (or http on this machine, for testing) with no user name or password in it. */
export type WebhookUrl = string & { readonly [brand]: "WebhookUrl" };
export type WebhookKey = string & { readonly [brand]: "WebhookKey" };

export type ThemeChoice = "dark" | "light" | "system";
export const THEME_CHOICES: readonly ThemeChoice[] = ["dark", "light", "system"];

/** AI tools the owner chose to connect. "chatgpt" and "gemini" come from the old agent picker. */
export type AgentId = "claude" | "codex" | "chatgpt" | "gemini";
export const AGENT_IDS: readonly AgentId[] = ["claude", "codex", "chatgpt", "gemini"];

export interface Webhook {
  readonly url: WebhookUrl;
  readonly key: WebhookKey;
}

export interface Settings {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly name: string | null;
  readonly theme: ThemeChoice;
  readonly webhook: Webhook | null;
  readonly agents: readonly AgentId[];
  /** The first-run sheet was finished or skipped. */
  readonly firstRunDone: boolean;
  /** The page was opened before (the opening plays short). */
  readonly seen: boolean;
  readonly lastSync: string | null;
  readonly toolkitSha: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  schemaVersion: SCHEMA_VERSION,
  name: null,
  theme: "system",
  webhook: null,
  agents: [],
  firstRunDone: false,
  seen: false,
  lastSync: null,
  toolkitSha: null,
};

// ---- small parsers for untrusted values

const MAX_NAME = 24;

/** Trims, collapses spaces, drops control characters, caps the length. Empty means no name. */
export function cleanName(input: string): string | null {
  // eslint-disable-next-line no-control-regex -- control characters are exactly what is being removed
  const text = input.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, MAX_NAME).trim();
  return text === "" ? null : text;
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function parseWebhookUrl(input: string): Result<WebhookUrl> {
  const text = input.trim();
  if (text === "") return err("Paste your webhook address.");
  if (text.length > 2048) return err("That address is too long.");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return err("That is not a web address.");
  }
  if (url.username !== "" || url.password !== "") return err("Remove the name and password from the address. The key goes in its own field.");
  const local = LOOPBACK.has(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return err("Use an https:// address (http only works for localhost).");
  url.hash = "";
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minted only after the checks above
  return ok(url.href as WebhookUrl);
}

export function parseWebhookKey(input: string): Result<WebhookKey> {
  const text = input.trim();
  if (text === "") return err("Paste your key.");
  if (text.length > 512) return err("That key is too long.");
  // eslint-disable-next-line no-control-regex -- control characters and spaces never belong in a key
  if (/[\s\u0000-\u001f\u007f]/.test(text)) return err("A key has no spaces or line breaks.");
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minted only after the checks above
  return ok(text as WebhookKey);
}

type Obj = Readonly<Record<string, unknown>>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | null => allowed.find((a) => a === value) ?? null;
const isoDate = (value: unknown): string | null =>
  typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value)) ? value : null;
const shortText = (value: unknown, max: number): string | null =>
  typeof value === "string" && value !== "" && value.length <= max ? value : null;

function parseJson(text: string | undefined): unknown {
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined; // broken value: ignored
  }
}

function parseWebhook(x: unknown): Webhook | null {
  if (!isObj(x)) return null;
  const url = typeof x["url"] === "string" ? parseWebhookUrl(x["url"]) : null;
  const key = typeof x["key"] === "string" ? parseWebhookKey(x["key"]) : null;
  return url?.ok === true && key?.ok === true ? { url: url.value, key: key.value } : null;
}

function parseAgents(x: unknown): AgentId[] {
  if (!Array.isArray(x)) return [];
  const out: AgentId[] = [];
  for (const entry of x) {
    const id = oneOf(entry, AGENT_IDS);
    if (id !== null && !out.includes(id)) out.push(id);
  }
  return out;
}

/** Reads a stored record field by field. A broken field falls back to its default; others are kept. */
export function parseSettings(raw: unknown): Settings | null {
  if (!isObj(raw) || typeof raw["schemaVersion"] !== "number") return null;
  return {
    schemaVersion: SCHEMA_VERSION,
    name: typeof raw["name"] === "string" ? cleanName(raw["name"]) : null,
    theme: oneOf(raw["theme"], THEME_CHOICES) ?? DEFAULT_SETTINGS.theme,
    webhook: parseWebhook(raw["webhook"]),
    agents: parseAgents(raw["agents"]),
    firstRunDone: raw["firstRunDone"] === true,
    seen: raw["seen"] === true,
    lastSync: isoDate(raw["lastSync"]),
    toolkitSha: shortText(raw["toolkitSha"], 64),
  };
}

// ---- the legacy ws.v1.* keys (schema 1)

/** Every legacy key this migration understands. Other ws.v1.* keys are left untouched. */
export const LEGACY_KEYS = ["profile", "name", "theme", "seen", "lastSync", "toolkitSha", "agent", "webhook", "key", "webhookKey"].map(
  (k) => LEGACY_PREFIX + k,
);

type Snapshot = ReadonlyMap<string, string>;

/** The settings the legacy keys describe (only the fields they actually hold) and whether any were present. */
export function fromLegacy(snap: Snapshot): { readonly found: boolean; readonly values: Partial<Settings> } {
  const get = (k: string): string | undefined => snap.get(LEGACY_PREFIX + k);
  const found = LEGACY_KEYS.some((k) => snap.has(k));
  const values: { -readonly [K in keyof Settings]?: Settings[K] } = {};

  const profile = parseJson(get("profile"));
  const profileName = isObj(profile) && typeof profile["name"] === "string" ? cleanName(profile["name"]) : null;
  const plainName = get("name");
  const name = profileName ?? (plainName !== undefined ? cleanName(plainName) : null);
  if (name !== null) values.name = name;

  const theme = oneOf(get("theme"), ["dark", "light"] as const);
  if (theme !== null) values.theme = theme;

  if (get("seen") !== undefined) values.seen = true;

  const lastSync = isoDate(get("lastSync"));
  if (lastSync !== null) values.lastSync = lastSync;

  const sha = shortText(get("toolkitSha"), 64);
  if (sha !== null) values.toolkitSha = sha;

  const agent = oneOf(get("agent"), AGENT_IDS);
  if (agent !== null) values.agents = [agent];

  // The webhook was planned as JSON { url, key }; also accept a plain URL with the key in its own key.
  const hookRaw = get("webhook");
  const hookJson = parseJson(hookRaw);
  const looseKey = get("key") ?? get("webhookKey");
  const webhook =
    parseWebhook(hookJson) ??
    (hookRaw !== undefined && looseKey !== undefined
      ? parseWebhook({ url: typeof hookJson === "string" ? hookJson : hookRaw, key: looseKey })
      : null);
  if (webhook !== null) values.webhook = webhook;

  return { found, values };
}

export interface MigrationPlan {
  readonly settings: Settings;
  /** Write `settings` to SETTINGS_KEY (it is new or changed). */
  readonly write: boolean;
  /** Legacy keys to remove, only after the write has been confirmed. */
  readonly remove: readonly string[];
}

function sameSettings(a: Settings, b: Settings): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Decides what to store, from a snapshot of every `ws.*` key. Idempotent: applying the plan and
 * migrating again gives `write: false` and nothing to remove.
 *  - A valid `ws.settings` wins. Legacy keys only fill fields it has empty (an old tab may still write them).
 *  - Without one, the legacy keys become the record. A visitor who had any of them has used the page
 *    before, so the first-run sheet is not forced on them (they can open it from Settings).
 *  - A broken `ws.settings` counts as missing; broken legacy values are skipped.
 */
export function migrate(snap: Snapshot): MigrationPlan {
  const storedText = snap.get(SETTINGS_KEY);
  const stored = parseSettings(parseJson(storedText));
  const legacy = fromLegacy(snap);
  const remove = LEGACY_KEYS.filter((k) => snap.has(k));

  if (stored !== null) {
    // A record from a newer version of the page: use what we understand, but never overwrite it.
    const version: unknown = Reflect.get(parseJson(storedText) ?? {}, "schemaVersion");
    if (typeof version === "number" && version > SCHEMA_VERSION) return { settings: stored, write: false, remove: [] };
    const v = legacy.values;
    const filled: Settings = {
      ...stored,
      name: stored.name ?? v.name ?? null,
      webhook: stored.webhook ?? v.webhook ?? null,
      agents: stored.agents.length > 0 ? stored.agents : (v.agents ?? []),
      seen: stored.seen || (v.seen ?? false),
      lastSync: stored.lastSync ?? v.lastSync ?? null,
      toolkitSha: stored.toolkitSha ?? v.toolkitSha ?? null,
    };
    const rawUnchanged = storedText === JSON.stringify(filled);
    return { settings: filled, write: !rawUnchanged || !sameSettings(filled, stored), remove };
  }

  const settings: Settings = { ...DEFAULT_SETTINGS, ...legacy.values, firstRunDone: legacy.found, schemaVersion: SCHEMA_VERSION };
  return { settings, write: true, remove };
}
