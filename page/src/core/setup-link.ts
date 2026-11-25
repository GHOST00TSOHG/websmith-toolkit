// The one-time setup link the owner's bot sends: PAGE_URL#setup=<base64url JSON {"webhook","key"}>.
// Small pure steps (read, decode, validate, apply) plus one wrapper with location and history injected,
// so Node tests run it without a browser. The fragment is removed before it is decoded, valid or not;
// its contents are never stored as text, logged or put into an error message.
import { parseWebhookKey, parseWebhookUrl, type Settings, type Webhook } from "./migrate.ts";
import { err, ok, type Result } from "./result.ts";

const PREFIX = "#setup=";
const MAX_PAYLOAD = 4096;

/** The payload of a `#setup=` fragment, or null when the hash is something else (e.g. list filters). */
export function readSetupFragment(hash: string): string | null {
  return hash.startsWith(PREFIX) ? hash.slice(PREFIX.length) : null;
}

/** base64url text to JSON. Errors are fixed words, never the input. */
export function decodeSetup(payload: string): Result<unknown> {
  if (payload === "" || payload.length > MAX_PAYLOAD || !/^[A-Za-z0-9_-]+={0,2}$/.test(payload)) return err("bad encoding");
  const b64 = payload.replace(/=+$/, "").replace(/-/g, "+").replace(/_/g, "/");
  try {
    const bytes = Uint8Array.from(atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return ok(value);
  } catch {
    return err("bad encoding");
  }
}

/** Exactly {"webhook": string, "key": string}; the same rules as the Settings fields. */
export function validateSetup(raw: unknown): Result<Webhook> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return err("not an object");
  const keys = Object.keys(raw);
  if (keys.length !== 2 || !keys.includes("webhook") || !keys.includes("key")) return err("wrong fields");
  const webhook: unknown = Reflect.get(raw, "webhook");
  const key: unknown = Reflect.get(raw, "key");
  if (typeof webhook !== "string" || typeof key !== "string") return err("wrong types");
  const u = parseWebhookUrl(webhook);
  if (!u.ok) return err("bad webhook");
  const k = parseWebhookKey(key);
  if (!k.ok) return err("bad key");
  return ok({ url: u.value, key: k.value });
}

/** The settings with the bot connected; every other field is kept. */
export function applySetup(current: Settings, hook: Webhook): Settings {
  return { ...current, webhook: hook };
}

export interface SetupEnv {
  readonly location: { readonly hash: string; readonly pathname: string; readonly search: string };
  readonly history: { replaceState(data: unknown, unused: string, url: string): void };
}

export type SetupOutcome = "none" | "connected" | "failed";

/** Clears any `#setup=` fragment first, then decodes, validates and hands the webhook to `save`. */
export function handleSetupLink(env: SetupEnv, save: (hook: Webhook) => void): SetupOutcome {
  const payload = readSetupFragment(env.location.hash);
  if (payload === null) return "none";
  env.history.replaceState(null, "", env.location.pathname + env.location.search);
  const decoded = decodeSetup(payload);
  const hook = decoded.ok ? validateSetup(decoded.value) : decoded;
  if (!hook.ok) return "failed";
  try {
    save(hook.value);
  } catch {
    return "failed";
  }
  return "connected";
}

export const SETUP_NOTICE: Readonly<Record<Exclude<SetupOutcome, "none">, string>> = {
  connected: "Your bot is connected.",
  failed: "That setup link didn't work.",
};
