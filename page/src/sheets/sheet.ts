// A sheet: a native modal <dialog> (top layer, so opening it never shifts the page), built on first use.
// Plain DOM on purpose: no blur, filters, canvases or animation (iPhone GPU budget). Its CSS is in this
// lazy chunk, so the first load does not pay for it. Escape and a tap on the backdrop close it.
import "./sheets.css";
import { h, svg } from "../core/dom.ts";

export interface Sheet {
  readonly dialog: HTMLDialogElement;
  readonly body: HTMLElement;
}

export function makeSheet(id: string, title: string): Sheet {
  const existing = document.getElementById(id);
  if (existing instanceof HTMLDialogElement) {
    const body = existing.querySelector<HTMLElement>(".sheet-body");
    if (body !== null) return { dialog: existing, body };
  }
  const icon = svg("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "aria-hidden": "true" });
  icon.append(svg("path", { d: "M6 6l12 12M18 6 6 18" }));
  const close = h("button", { class: "icon-btn sheet-close", attrs: { type: "button", "aria-label": "Close" } }, [icon]);
  const heading = h("h2", { text: title, attrs: { id: `${id}-title` } });
  const body = h("div", { class: "sheet-body" });
  const dialog = h("dialog", { class: "sheet", attrs: { id, "aria-labelledby": `${id}-title` } }, [
    h("div", { class: "sheet-head" }, [heading, close]),
    body,
  ]);
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close(); // a tap on the backdrop
  });
  document.body.append(dialog);
  return { dialog, body };
}

export function section(title: string, children: readonly Node[]): HTMLElement {
  return h("section", { class: "sheet-section" }, [h("h3", { text: title }), ...children]);
}

/** A labelled field. `type: "password"` keeps the key hidden on screen. */
export function field(id: string, label: string, input: { type: string; value?: string; autocomplete?: string; inputmode?: string }): {
  wrap: HTMLElement;
  input: HTMLInputElement;
} {
  const el = h("input", {
    class: "field",
    attrs: { id, type: input.type, autocomplete: input.autocomplete ?? "off", spellcheck: "false", autocapitalize: "off", ...(input.inputmode !== undefined ? { inputmode: input.inputmode } : {}) },
  });
  el.value = input.value ?? "";
  return { wrap: h("div", { class: "sheet-field" }, [h("label", { text: label, attrs: { for: id } }), el]), input: el };
}

export function button(text: string, kind: "primary" | "ghost" | "danger" = "ghost"): HTMLButtonElement {
  return h("button", { class: `btn btn-small${kind === "primary" ? " btn-primary" : kind === "danger" ? " btn-danger" : ""}`, text, attrs: { type: "button" } });
}

export function status(): HTMLElement {
  return h("p", { class: "sheet-status", attrs: { role: "status", "aria-live": "polite" } });
}
