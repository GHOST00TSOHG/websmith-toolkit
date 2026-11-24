// Reads the pre-rendered list rows once, at the boundary, into typed entries. Everything after trusts the types.
import { GROUPS, ITEM_KINDS, type Group, type ItemKind } from "../core/manifest.ts";

export interface RowEntry {
  readonly id: string;
  readonly el: HTMLElement;
  readonly kind: ItemKind;
  readonly group: Group;
  readonly haystack: string;
}

export function parseKind(value: unknown): ItemKind | null {
  return ITEM_KINDS.find((k) => k === value) ?? null;
}

export function readRows(root: ParentNode): RowEntry[] {
  const entries: RowEntry[] = [];
  for (const el of root.querySelectorAll<HTMLElement>("li.row")) {
    const kind = parseKind(el.dataset["kind"]);
    const group = GROUPS.find((g) => g === el.dataset["group"]) ?? null;
    const id = el.dataset["id"];
    if (kind === null || group === null || id === undefined) throw new Error(`malformed row markup: ${el.id}`);
    const text = (selector: string): string => el.querySelector(selector)?.textContent ?? "";
    entries.push({
      id,
      el,
      kind,
      group,
      haystack: `${text(".row-name")} ${text(".row-desc")} ${text(".row-kind")} ${el.dataset["tags"] ?? ""}`.toLowerCase(),
    });
  }
  return entries;
}
