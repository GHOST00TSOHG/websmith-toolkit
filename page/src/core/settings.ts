// The one owner of what this page stores on the visitor's device: the `ws.settings` record in localStorage.
// Nothing is sent anywhere. On first use it migrates the old `ws.v1.*` keys (src/core/migrate.ts).
// Every change is announced with a `ws:settings` event on document, also when another tab changed it.
import { DEFAULT_SETTINGS, LEGACY_PREFIX, migrate, parseSettings, SETTINGS_KEY, type Settings } from "./migrate.ts";

export type { Settings };

/** The keys this page stores: the record, and the old ws.v1.* keys until they are migrated. A GitHub Pages
 *  origin is shared by every Pages site of the same account, so "Clear my data" removes exactly these. */
const isOwnKey = (key: string): boolean => key === SETTINGS_KEY || key.startsWith(LEGACY_PREFIX);
/** Reserved for a future local log; never created today. Deleted by "Clear my data" in case it exists. */
const OWN_DATABASES = ["websmith-page"];

let cache: Settings | null = null;
let storageWorks = true;

function snapshot(): Map<string, string> {
  const snap = new Map<string, string>();
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key === null || !isOwnKey(key)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) snap.set(key, value);
  }
  return snap;
}

function load(): Settings {
  try {
    const plan = migrate(snapshot());
    if (plan.write) {
      const text = JSON.stringify(plan.settings);
      localStorage.setItem(SETTINGS_KEY, text);
      // Old keys go only once the new record is safely stored.
      if (localStorage.getItem(SETTINGS_KEY) === text) for (const key of plan.remove) localStorage.removeItem(key);
    } else {
      for (const key of plan.remove) localStorage.removeItem(key);
    }
    storageWorks = true;
    return plan.settings;
  } catch {
    storageWorks = false; // storage blocked (some private modes): the page works, nothing is remembered
    return cache ?? DEFAULT_SETTINGS;
  }
}

export function settings(): Settings {
  cache ??= load();
  return cache;
}

/** False when the browser blocks storage: then nothing can be remembered, so nothing is asked up front. */
export function canRemember(): boolean {
  settings();
  return storageWorks;
}

/** `external`: the change came from another tab (this tab's own changes are already on screen). */
const announce = (external: boolean): void => {
  document.dispatchEvent(new CustomEvent("ws:settings", { detail: { external } }));
};

export function isExternalChange(event: Event): boolean {
  return event instanceof CustomEvent && Reflect.get(Object(event.detail), "external") === true;
}

/** Applies a change on top of the latest stored record (another tab may have written since). */
export function updateSettings(patch: Partial<Omit<Settings, "schemaVersion">>): Settings {
  const before = cache;
  cache = null;
  const fresh = settings();
  // Blocked storage reloads as defaults: build on this visit's values instead, so nothing set earlier is lost.
  const next: Settings = { ...(storageWorks ? fresh : (before ?? fresh)), ...patch };
  cache = next;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  } catch {
    storageWorks = false; // the change holds for this visit only
  }
  announce(false);
  return next;
}

/** Removes every key this page stored on this device, then the caller reloads into the first run. */
export async function clearMyData(): Promise<void> {
  try {
    const own: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key !== null && isOwnKey(key)) own.push(key);
    }
    for (const key of own) localStorage.removeItem(key);
  } catch {
    // storage blocked: nothing was stored
  }
  if (typeof indexedDB !== "undefined") {
    await Promise.all(
      OWN_DATABASES.map(
        (name) =>
          new Promise<void>((resolve) => {
            const req = indexedDB.deleteDatabase(name);
            req.onsuccess = req.onerror = req.onblocked = (): void => resolve();
          }),
      ),
    );
  }
  cache = null;
}

// Another tab changed the record: drop the cache and tell this tab.
window.addEventListener("storage", (event) => {
  if (event.key !== null && event.key !== SETTINGS_KEY) return;
  const parsed = event.newValue === null ? null : parseSettings(safeParse(event.newValue));
  cache = parsed ?? null;
  announce(true);
});

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
