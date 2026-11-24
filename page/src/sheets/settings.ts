// Settings: the owner's own Websmith webhook (address and key, kept only on this device), Find my login,
// the first-run sheet again, the privacy note, and Clear my data. Lazy: loaded on the first tap.
import { h } from "../core/dom.ts";
import { parseWebhookKey, parseWebhookUrl } from "../core/migrate.ts";
import { clearMyData, settings, updateSettings } from "../core/settings.ts";
import { mountFindLogin } from "./findlogin.ts";
import { button, field, makeSheet, section, status } from "./sheet.ts";

export const PRIVACY_TEXT =
  "Your data stays on this device. This page only talks to the webhook you paste. No analytics, no cookies, no tracking.";
export const STORED_TEXT =
  "Saved in this browser only: your name, theme, webhook address and key, the AI tools you connected, the last sync time, the toolkit version you last saw, and whether setup is done.";

let built: { dialog: HTMLDialogElement; find: HTMLElement; url: HTMLInputElement } | null = null;

export function openSettings(focus: "start" | "find" = "start"): void {
  built ??= build();
  const { dialog, find, url } = built;
  if (!dialog.open) dialog.showModal();
  if (focus === "find") {
    find.scrollIntoView({ block: "start" });
    find.querySelector("button")?.focus();
  } else {
    url.focus();
  }
}

function build(): { dialog: HTMLDialogElement; find: HTMLElement; url: HTMLInputElement } {
  const { dialog, body } = makeSheet("settings-sheet", "Settings");
  const hook = settings().webhook;

  // ---- the owner's own bot
  const url = field("hook-url", "Webhook address", { type: "url", value: hook?.url ?? "", inputmode: "url" });
  const key = field("hook-key", "Key", { type: "password", value: hook?.key ?? "", autocomplete: "off" });
  const save = button("Save", "primary");
  const remove = button("Remove");
  const hookNote = status();
  remove.hidden = hook === null;
  const say = (text: string, tone: "info" | "error" = "info"): void => {
    hookNote.textContent = text;
    hookNote.dataset["tone"] = tone;
  };
  save.addEventListener("click", () => {
    const u = parseWebhookUrl(url.input.value);
    if (!u.ok) {
      say(u.error, "error");
      url.input.focus();
      return;
    }
    const k = parseWebhookKey(key.input.value);
    if (!k.ok) {
      say(k.error, "error");
      key.input.focus();
      return;
    }
    updateSettings({ webhook: { url: u.value, key: k.value } });
    url.input.value = u.value;
    remove.hidden = false;
    // The page's network policy was narrowed to the saved bot at load; a new address needs a reload.
    const narrowed = document.querySelector<HTMLMetaElement>("meta[data-narrow]")?.dataset["narrow"];
    if (narrowed !== undefined && narrowed !== new URL(u.value).origin) {
      say("Saved on this device. Reloading to use the new address…");
      window.setTimeout(() => location.reload(), 600);
      return;
    }
    say("Saved on this device.");
  });
  remove.addEventListener("click", () => {
    updateSettings({ webhook: null });
    url.input.value = "";
    key.input.value = "";
    remove.hidden = true;
    say("Removed from this device.");
  });

  // ---- Find my login
  const find = section("Find my login", [mountFindLogin()]);

  // ---- this device
  const setup = button("First-time setup");
  setup.addEventListener("click", () => {
    dialog.close();
    void import("./firstrun.ts").then((m) => m.openFirstRun());
  });
  const clear = button("Clear my data", "danger");
  clear.addEventListener("click", () => {
    if (!window.confirm("Remove everything this page saved on this device (name, theme, webhook address and key)? The page then starts fresh.")) return;
    void clearMyData().then(() => location.reload());
  });

  body.append(
    section("Your Websmith bot", [url.wrap, key.wrap, h("div", { class: "sheet-row" }, [save, remove]), hookNote]),
    find,
    section("This device", [
      h("p", { class: "sheet-note", text: PRIVACY_TEXT }),
      h("p", { class: "sheet-note", text: STORED_TEXT }),
      h("div", { class: "sheet-row" }, [setup, clear]),
    ]),
  );
  return { dialog, find, url: url.input };
}
