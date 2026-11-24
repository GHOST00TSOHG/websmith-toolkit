// The page's only network call: a POST to the webhook the owner pasted, with their key as a Bearer token.
// The key goes in the Authorization header only: never in the URL, the body or any log.
// Protocol (docs/PLAN.md 5.2): -> { v: 1, op, requestId, ...fields }  <- { v: 1, ok: true, data } | { v: 1, ok: false, error }
import type { Webhook } from "../core/migrate.ts";
import { err, ok, type Result } from "../core/result.ts";

export type BotOp =
  | { readonly op: "find-my-login" }
  | { readonly op: "connect-agent"; readonly agent: "claude" | "codex" };

const TIMEOUT_MS = 20_000;

export async function callBot(hook: Webhook, request: BotOp): Promise<Result<unknown>> {
  const abort = new AbortController();
  const timer = window.setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(hook.url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${hook.key}` },
      body: JSON.stringify({ v: 1, requestId: crypto.randomUUID(), ...request }),
      signal: abort.signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) return err("Your bot did not accept the key.");
    if (!res.ok) return err(`Your bot answered with an error (${res.status}).`);
    const body: unknown = await res.json().catch(() => undefined);
    if (body === undefined) return err("Your bot's answer was not readable.");
    return unwrap(body);
  } catch {
    return err(abort.signal.aborted ? "Your bot did not answer in time." : "Could not reach your bot. Check the address, and that it allows this page.");
  } finally {
    window.clearTimeout(timer);
  }
}

/** Accepts the protocol envelope or a bare data object. */
function unwrap(body: unknown): Result<unknown> {
  if (typeof body !== "object" || body === null) return err("Your bot's answer was not readable.");
  const okFlag: unknown = Reflect.get(body, "ok");
  if (okFlag === false) {
    const message: unknown = Reflect.get(Object(Reflect.get(body, "error")), "message");
    return err(typeof message === "string" && message.length < 200 ? `Your bot said: ${message}` : "Your bot said no.");
  }
  return ok(okFlag === true ? Reflect.get(body, "data") : body);
}

// ---- Find my login: the helper's one-line JSON, passed back by the bot.

export type LoginState = "signed-in" | "signed-out" | "not-installed";
export const LOGIN_STATES: readonly LoginState[] = ["signed-in", "signed-out", "not-installed"];
export type LoginTool = "claude" | "codex";
export const LOGIN_TOOLS: readonly LoginTool[] = ["claude", "codex"];
export type LoginReport = Readonly<Record<LoginTool, LoginState>>;

/** Parses the helper's line, e.g. {"claude":"signed-in","codex":"not-installed"}. Extra fields are ignored. */
export function parseLoginReport(raw: unknown): Result<LoginReport> {
  let value = raw;
  if (typeof value === "string") {
    if (value.length > 400) return err("That reply is too long to be the Find my login line.");
    try {
      value = JSON.parse(value.trim());
    } catch {
      return err("That is not the Find my login line.");
    }
  }
  if (typeof value !== "object" || value === null) return err("That is not the Find my login line.");
  const claude: unknown = Reflect.get(value, "claude");
  const codex: unknown = Reflect.get(value, "codex");
  const c1 = LOGIN_STATES.find((s) => s === claude);
  const c2 = LOGIN_STATES.find((s) => s === codex);
  if (c1 === undefined || c2 === undefined) return err("That is not the Find my login line.");
  return ok({ claude: c1, codex: c2 });
}
