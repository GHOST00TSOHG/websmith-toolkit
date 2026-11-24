// The hero greeting ("Hi, <name>") and its one-field name prompt.
import { cleanName, readProfile, writeProfile } from "../core/profile.ts";

export interface Greeting {
  /** Called with the current name (or null) whenever it changes, so the ASCII hero can redraw. */
  onChange(listener: (name: string | null) => void): void;
  readonly name: string | null;
}

export const greetingFor = (name: string | null): string => (name === null ? "Hi there" : `Hi, ${name}`);

export function mountGreeting(): Greeting {
  const title = document.getElementById("hero-title");
  const form = document.getElementById("name-form");
  const input = document.getElementById("name-input");
  const toggle = document.getElementById("name-change");
  if (title === null || !(form instanceof HTMLFormElement) || !(input instanceof HTMLInputElement) || !(toggle instanceof HTMLButtonElement)) {
    throw new Error("hero markup missing");
  }
  const listeners: ((name: string | null) => void)[] = [];
  let name = readProfile().name;

  const paint = (): void => {
    title.textContent = greetingFor(name);
    form.hidden = name !== null;
    toggle.hidden = name === null;
    input.value = name ?? "";
    for (const listener of listeners) listener(name);
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    name = cleanName(input.value);
    writeProfile({ name });
    paint();
    if (name !== null) toggle.focus();
  });

  toggle.addEventListener("click", () => {
    name = null;
    form.hidden = false;
    toggle.hidden = true;
    title.textContent = greetingFor(null);
    input.value = "";
    input.focus();
    for (const listener of listeners) listener(null);
  });

  // The name changed elsewhere (the first-run sheet, Settings, another tab). Other settings changes
  // (a sync time) leave a half-typed name alone.
  let stored = name;
  document.addEventListener("ws:settings", () => {
    const next = readProfile().name;
    if (next === stored) return;
    stored = name = next;
    paint();
  });

  paint();
  return {
    onChange(listener) {
      listeners.push(listener);
    },
    get name() {
      return name;
    },
  };
}
