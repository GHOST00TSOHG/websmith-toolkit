// Unit tests for the settings migration (src/core/migrate.ts). Plain Node through tsx, no browser.
// Run by `npm run check`.
import assert from "node:assert/strict";
import { DEFAULT_SETTINGS, migrate, parseWebhookKey, parseWebhookUrl, SETTINGS_KEY, type MigrationPlan } from "../src/core/migrate.ts";

const tests: [string, () => void][] = [];
const test = (name: string, fn: () => void): void => {
  tests.push([name, fn]);
};

type Store = Map<string, string>;
/** What src/core/settings.ts does with a plan: write the record, then drop the migrated legacy keys. */
function apply(store: Store, plan: MigrationPlan): Store {
  const next = new Map(store);
  if (plan.write) next.set(SETTINGS_KEY, JSON.stringify(plan.settings));
  for (const key of plan.remove) next.delete(key);
  return next;
}

const LEGACY: Store = new Map([
  ["ws.v1.profile", JSON.stringify({ v: 1, name: "  Sam   Lee " })],
  ["ws.v1.theme", "light"],
  ["ws.v1.seen", "1"],
  ["ws.v1.lastSync", "2026-11-24T18:05:00.000Z"],
  ["ws.v1.toolkitSha", "5af91de50a80"],
  ["ws.v1.agent", "claude"],
  ["ws.v1.webhook", JSON.stringify({ url: "https://bot.example.test/hook", key: "test-key-123" })],
]);

test("a first visit gets the defaults and the first-run sheet", () => {
  const plan = migrate(new Map());
  assert.equal(plan.write, true);
  assert.deepEqual(plan.settings, DEFAULT_SETTINGS);
  assert.deepEqual(plan.remove, []);
});

test("every old ws.v1 value is carried over, nothing lost", () => {
  const plan = migrate(LEGACY);
  assert.equal(plan.write, true);
  assert.deepEqual(plan.settings, {
    schemaVersion: 2,
    name: "Sam Lee",
    theme: "light",
    webhook: { url: "https://bot.example.test/hook", key: "test-key-123" },
    agents: ["claude"],
    firstRunDone: true,
    seen: true,
    lastSync: "2026-11-24T18:05:00.000Z",
    toolkitSha: "5af91de50a80",
  });
  assert.deepEqual([...plan.remove].sort(), [...LEGACY.keys()].sort());
});

test("it runs once: a second pass changes nothing", () => {
  const once = apply(LEGACY, migrate(LEGACY));
  const again = migrate(once);
  assert.equal(again.write, false);
  assert.deepEqual(again.remove, []);
  assert.deepEqual(apply(once, again), once);
  assert.deepEqual([...once.keys()], [SETTINGS_KEY]);
});

test("a plain name key and a webhook URL with a separate key are understood", () => {
  const plan = migrate(new Map([["ws.v1.name", "Ana"], ["ws.v1.webhook", "https://bot.example.test/h"], ["ws.v1.key", "k-1"]]));
  assert.equal(plan.settings.name, "Ana");
  assert.deepEqual(plan.settings.webhook, { url: "https://bot.example.test/h", key: "k-1" });
});

test("broken values are ignored, good ones next to them are kept", () => {
  const plan = migrate(new Map([
    ["ws.v1.profile", "{not json"],
    ["ws.v1.theme", "purple"],
    ["ws.v1.lastSync", "yesterday-ish"],
    ["ws.v1.agent", "<script>"],
    ["ws.v1.webhook", JSON.stringify({ url: "http://evil.example.test/", key: "k" })],
    ["ws.v1.toolkitSha", "abc123"],
  ]));
  assert.equal(plan.settings.name, null);
  assert.equal(plan.settings.theme, "system");
  assert.equal(plan.settings.lastSync, null);
  assert.deepEqual(plan.settings.agents, []);
  assert.equal(plan.settings.webhook, null, "plain http to another machine is refused");
  assert.equal(plan.settings.toolkitSha, "abc123");
  assert.equal(plan.settings.firstRunDone, true);
});

test("unknown keys are left alone", () => {
  const store: Store = new Map([["ws.v1.somethingNew", "x"], ["other.app", "y"]]);
  const plan = migrate(store);
  assert.deepEqual(plan.remove, []);
  assert.equal(plan.settings.firstRunDone, false);
  const after = apply(store, plan);
  assert.equal(after.get("ws.v1.somethingNew"), "x");
  assert.equal(after.get("other.app"), "y");
});

test("a broken record counts as missing and is rebuilt from the old keys", () => {
  const plan = migrate(new Map([[SETTINGS_KEY, "{oops"], ["ws.v1.theme", "dark"]]));
  assert.equal(plan.write, true);
  assert.equal(plan.settings.theme, "dark");
});

test("a stored record wins; a late old key only fills an empty field", () => {
  const stored = { ...DEFAULT_SETTINGS, name: "Kim", theme: "dark", firstRunDone: true };
  const plan = migrate(new Map([[SETTINGS_KEY, JSON.stringify(stored)], ["ws.v1.theme", "light"], ["ws.v1.lastSync", "2026-11-20T10:00:00.000Z"]]));
  assert.equal(plan.settings.name, "Kim");
  assert.equal(plan.settings.theme, "dark");
  assert.equal(plan.settings.lastSync, "2026-11-20T10:00:00.000Z");
  assert.deepEqual([...plan.remove].sort(), ["ws.v1.lastSync", "ws.v1.theme"]);
});

test("a record from a newer page version is used but never overwritten", () => {
  const newer = JSON.stringify({ ...DEFAULT_SETTINGS, schemaVersion: 9, name: "Lee", futureField: [1, 2] });
  const plan = migrate(new Map([[SETTINGS_KEY, newer]]));
  assert.equal(plan.write, false);
  assert.equal(plan.settings.name, "Lee");
});

test("a bad field in the record falls back alone", () => {
  const plan = migrate(new Map([[SETTINGS_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, theme: 7, name: "Jo", agents: ["codex", "nope", "codex"] })]]));
  assert.equal(plan.settings.theme, "system");
  assert.equal(plan.settings.name, "Jo");
  assert.deepEqual(plan.settings.agents, ["codex"]);
});

test("webhook addresses: https only, http just for localhost, no name or password", () => {
  assert.equal(parseWebhookUrl("https://bot.example.test/hook").ok, true);
  assert.equal(parseWebhookUrl("http://localhost:8787/hook").ok, true);
  assert.equal(parseWebhookUrl("http://127.0.0.1:8787/hook").ok, true);
  assert.equal(parseWebhookUrl("http://bot.example.test/hook").ok, false);
  assert.equal(parseWebhookUrl("https://user:pass@127.0.0.1/").ok, false);
  assert.equal(parseWebhookUrl("javascript:alert(1)").ok, false);
  assert.equal(parseWebhookUrl("").ok, false);
  assert.equal(parseWebhookKey("abc def").ok, false);
  assert.equal(parseWebhookKey(" abc ").ok, true);
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
process.stdout.write(`migration tests ok (${tests.length})\n`);
