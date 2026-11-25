// Unit tests for the one-time setup link (src/core/setup-link.ts). Plain Node through tsx, no browser.
// Run by `npm run check`. Fake values only.
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, type Settings, type Webhook } from "../src/core/migrate.ts";
import { applySetup, decodeSetup, handleSetupLink, readSetupFragment, validateSetup, type SetupEnv } from "../src/core/setup-link.ts";

const tests: [string, () => void][] = [];
const test = (name: string, fn: () => void): void => {
  tests.push([name, fn]);
};

const encode = (value: unknown): string => Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
const GOOD = { webhook: "https://bot.example.test/hook", key: "test-key-not-real" };
const BEFORE: Settings = { ...DEFAULT_SETTINGS, name: "Sam", theme: "light", firstRunDone: true };

/** A fake location and history; records every replaceState URL. */
function fakeEnv(hash: string): SetupEnv & { replaced: string[]; reads: () => number } {
  const replaced: string[] = [];
  let currentHash = hash;
  let hashReads = 0;
  return {
    replaced,
    reads: () => hashReads,
    location: {
      get hash() {
        hashReads += 1;
        return currentHash;
      },
      pathname: "/websmith-toolkit/",
      search: "?seed=7",
    },
    history: {
      replaceState(_data: unknown, _unused: string, url: string) {
        replaced.push(url);
        currentHash = "";
      },
    },
  };
}

/** Runs the link against fake settings, the way main.ts saves through updateSettings. */
function run(hash: string): { outcome: string; saved: Settings; env: ReturnType<typeof fakeEnv> } {
  const env = fakeEnv(hash);
  let saved = BEFORE;
  const outcome = handleSetupLink(env, (hook: Webhook) => {
    saved = applySetup(saved, hook);
  });
  return { outcome, saved, env };
}

test("a valid link is saved and the other settings are kept", () => {
  const { outcome, saved } = run(`#setup=${encode(GOOD)}`);
  assert.equal(outcome, "connected");
  assert.deepEqual(saved.webhook, { url: GOOD.webhook, key: GOOD.key });
  assert.equal(saved.name, "Sam");
  assert.equal(saved.theme, "light");
  assert.equal(saved.firstRunDone, true);
});

test("the fragment is cleared for a valid link", () => {
  const { env } = run(`#setup=${encode(GOOD)}`);
  assert.deepEqual(env.replaced, ["/websmith-toolkit/?seed=7"]);
  assert.equal(env.location.hash, "");
});

test("the fragment is cleared for an invalid link, and nothing is saved", () => {
  for (const hash of ["#setup=", "#setup=%%%", `#setup=${encode({ webhook: "http://bot.example.test/hook", key: "k" })}`]) {
    const { outcome, saved, env } = run(hash);
    assert.equal(outcome, "failed", hash);
    assert.deepEqual(env.replaced, ["/websmith-toolkit/?seed=7"], hash);
    assert.equal(saved, BEFORE, hash);
  }
});

test("no setup fragment: nothing is touched", () => {
  for (const hash of ["", "#filter=skill"]) {
    const { outcome, saved, env } = run(hash);
    assert.equal(outcome, "none");
    assert.deepEqual(env.replaced, []);
    assert.equal(saved, BEFORE);
  }
  assert.equal(readSetupFragment("#filter=skill"), null);
});

test("bad base64 and bad JSON are rejected", () => {
  assert.equal(decodeSetup("not base64!").ok, false);
  assert.equal(decodeSetup("").ok, false);
  assert.equal(decodeSetup(Buffer.from("{not json", "utf8").toString("base64url")).ok, false);
  assert.equal(decodeSetup("A".repeat(5000)).ok, false);
  assert.deepEqual(decodeSetup(encode(GOOD)), { ok: true, value: GOOD });
});

test("only https, or http for localhost and 127.0.0.1", () => {
  assert.equal(validateSetup({ ...GOOD, webhook: "http://bot.example.test/hook" }).ok, false);
  assert.equal(validateSetup({ ...GOOD, webhook: "ftp://bot.example.test/hook" }).ok, false);
  assert.equal(validateSetup({ ...GOOD, webhook: "javascript:alert(1)" }).ok, false);
  assert.equal(validateSetup({ ...GOOD, webhook: "http://localhost:8787/hook" }).ok, true);
  assert.equal(validateSetup({ ...GOOD, webhook: "http://127.0.0.1:8787/hook" }).ok, true);
  assert.equal(validateSetup(GOOD).ok, true);
});

test("the key must be a sane non-empty string, and nothing else is accepted", () => {
  assert.equal(validateSetup({ ...GOOD, key: "" }).ok, false);
  assert.equal(validateSetup({ ...GOOD, key: "k".repeat(600) }).ok, false);
  assert.equal(validateSetup({ ...GOOD, key: 42 }).ok, false);
  assert.equal(validateSetup({ webhook: GOOD.webhook }).ok, false);
  assert.equal(validateSetup({ ...GOOD, extra: 1 }).ok, false);
  assert.equal(validateSetup([GOOD.webhook, GOOD.key]).ok, false);
  assert.equal(validateSetup(null).ok, false);
});

test("errors never carry the link's contents", () => {
  const secret = { webhook: "http://bot.example.test/hook", key: "test-key-not-real" };
  const result = validateSetup(secret);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.includes("test-key"), false);
});

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
  } catch (error) {
    failed += 1;
    process.stderr.write(`FAIL ${name}\n${String(error)}\n`);
  }
}
if (failed > 0) process.exit(1);
process.stdout.write(`setup link tests ok (${tests.length})\n`);
