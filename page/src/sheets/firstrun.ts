// The first-run sheet: name (for "Hi, <name>"), theme, and an optional way into Find my login. Shown once,
// the first time someone opens the page on this device; reopened from Settings. Skip (or Escape) keeps
// the neutral greeting. Everything is kept only on this device.
import { h } from "../core/dom.ts";
import { cleanName, THEME_CHOICES, type ThemeChoice } from "../core/migrate.ts";
import { settings, updateSettings } from "../core/settings.ts";
import { setThemeChoice } from "../theme/theme.ts";
import { button, field, makeSheet, section } from "./sheet.ts";

const THEME_LABEL: Readonly<Record<ThemeChoice, string>> = { dark: "Dark", light: "Light", system: "System" };

let built: { dialog: HTMLDialogElement; name: HTMLInputElement; radios: HTMLInputElement[] } | null = null;

export function openFirstRun(): void {
  built ??= build();
  const { dialog, name, radios } = built;
  const now = settings();
  name.value = now.name ?? "";
  for (const r of radios) r.checked = r.value === now.theme;
  if (!dialog.open) dialog.showModal();
  name.focus();
}

function build(): { dialog: HTMLDialogElement; name: HTMLInputElement; radios: HTMLInputElement[] } {
  const { dialog, body } = makeSheet("firstrun-sheet", "Welcome");
  const name = field("firstrun-name", "Your name", { type: "text", autocomplete: "given-name" });
  name.input.maxLength = 24;

  const radios = THEME_CHOICES.map((choice) => {
    const input = h("input", { attrs: { type: "radio", name: "firstrun-theme", value: choice } });
    input.addEventListener("change", () => {
      if (input.checked) setThemeChoice(choice);
    });
    return { input, label: h("label", { class: "sheet-choice" }, [input, THEME_LABEL[choice]]) };
  });
  const theme = h("fieldset", {}, [h("legend", { text: "Theme" }), h("div", { class: "sheet-choices" }, radios.map((r) => r.label))]);

  const find = button("Find my login");
  const skip = button("Skip");
  const done = button("Done", "primary");

  // Closing the sheet in any way counts as finished: it is not forced on the next visit.
  dialog.addEventListener("close", () => {
    if (!settings().firstRunDone) updateSettings({ firstRunDone: true });
  });
  skip.addEventListener("click", () => dialog.close());
  done.addEventListener("click", () => {
    updateSettings({ name: cleanName(name.input.value), firstRunDone: true });
    dialog.close();
  });
  name.input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") done.click();
  });
  // Optional: Find my login lives in Settings, where its consent text is. Nothing runs until tapped there.
  find.addEventListener("click", () => {
    updateSettings({ name: cleanName(name.input.value), firstRunDone: true });
    dialog.close();
    void import("./settings.ts").then((m) => m.openSettings("find"));
  });

  body.append(
    section("You", [name.wrap, theme]),
    section("Find my login", [h("div", { class: "sheet-row" }, [find])]),
    h("div", { class: "sheet-row sheet-row-end" }, [skip, done]),
  );
  return { dialog, name: name.input, radios: radios.map((r) => r.input) };
}
