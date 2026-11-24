// Search, kit and type chips, and the URL hash. One owner of the filter state; the list is a view of it.
// Chips are labels over real switch inputs (the iPhone haptic tick). Changes apply instantly, no motion.
import { isInput } from "../core/dom.ts";
import { parseKind, type RowEntry } from "./model.ts";
import { EMPTY_FILTERS, isFiltering, parseGroup, parseHash, serializeHash, type FilterState } from "./state.ts";

interface Chip {
  readonly el: HTMLLabelElement;
  readonly input: HTMLInputElement;
  readonly filter: string;
  readonly value: string;
}

export function mountFilters(entries: readonly RowEntry[]): void {
  const toolbar = document.getElementById("toolbar");
  const search = document.getElementById("search");
  const count = document.getElementById("result-count");
  const visibleCount = document.getElementById("visible-count");
  const clear = document.getElementById("clear-filters");
  const empty = document.getElementById("empty");
  if (toolbar === null || search === null || !isInput(search) || count === null || visibleCount === null || clear === null || empty === null) {
    throw new Error("filter markup missing");
  }
  const chips: Chip[] = [];
  for (const el of toolbar.querySelectorAll<HTMLLabelElement>("label.chip")) {
    const input = el.querySelector("input");
    if (input === null) continue;
    chips.push({ el, input, filter: el.dataset["filter"] ?? "", value: el.dataset["value"] ?? "" });
  }

  let state: FilterState = parseHash(location.hash);

  const matches = (entry: RowEntry, tokens: readonly string[]): boolean =>
    (state.group === null || entry.group === state.group) &&
    (state.kind === null || entry.kind === state.kind) &&
    tokens.every((t) => entry.haystack.includes(t));

  const render = (): void => {
    const tokens = state.q.toLowerCase().split(/\s+/).filter((t) => t.length > 0);
    let shown = 0;
    for (const entry of entries) {
      const show = matches(entry, tokens);
      entry.el.hidden = !show;
      // Stripes follow the visible rows, so they still alternate while filtering.
      entry.el.classList.toggle("alt", show && shown % 2 === 1);
      if (show) shown += 1;
    }
    for (const c of chips) {
      const on = c.filter === "group" ? state.group === c.value : state.kind === c.value;
      c.input.checked = on;
      c.el.dataset["on"] = String(on);
    }
    if (search.value !== state.q) search.value = state.q;
    visibleCount.textContent = String(shown);
    count.textContent = `Showing ${shown} of ${entries.length} items`;
    clear.hidden = !isFiltering(state);
    empty.hidden = shown > 0;
  };

  const commit = (next: FilterState): void => {
    state = next;
    render();
    history.replaceState(null, "", `${location.pathname}${location.search}${serializeHash(state)}`);
  };

  let typing = 0;
  search.addEventListener("input", () => {
    window.clearTimeout(typing);
    const q = search.value.slice(0, 80);
    typing = window.setTimeout(() => commit({ ...state, q }), 120);
  });
  search.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && search.value !== "") commit({ ...state, q: "" });
  });

  for (const c of chips) {
    c.input.addEventListener("change", () => {
      if (c.filter === "group") {
        const group = parseGroup(c.value);
        commit({ ...state, group: state.group === group ? null : group });
      } else if (c.filter === "kind") {
        const kind = parseKind(c.value);
        commit({ ...state, kind: state.kind === kind ? null : kind });
      }
      // Android has a real vibration API; iPhone gets its tick from the switch itself.
      if ("vibrate" in navigator) navigator.vibrate(8);
    });
  }

  clear.addEventListener("click", () => commit(EMPTY_FILTERS));

  window.addEventListener("hashchange", () => {
    state = parseHash(location.hash);
    render();
  });

  // "/" jumps to the search box, unless the user is already typing somewhere.
  document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
    const active = document.activeElement;
    const busy = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || (active instanceof HTMLElement && active.isContentEditable);
    if (busy) return;
    event.preventDefault();
    search.focus();
  });

  render();
}
