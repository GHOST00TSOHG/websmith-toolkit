// Filter state and its URL-hash form: #q=orb&kit=vfx&kind=skill
import { GROUPS, type Group, type ItemKind } from "../core/manifest.ts";
import { parseKind } from "./model.ts";

export interface FilterState {
  readonly q: string;
  readonly group: Group | null;
  readonly kind: ItemKind | null;
}

export const EMPTY_FILTERS: FilterState = { q: "", group: null, kind: null };

export function parseGroup(value: unknown): Group | null {
  return GROUPS.find((g) => g === value) ?? null;
}

export function isFiltering(state: FilterState): boolean {
  return state.q !== "" || state.group !== null || state.kind !== null;
}

/** Unknown kits and kinds are dropped: the hash is untrusted input. */
export function parseHash(hash: string): FilterState {
  if (hash.startsWith("#/")) return EMPTY_FILTERS; // reserved for page routes
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return {
    q: (params.get("q") ?? "").slice(0, 80),
    group: parseGroup(params.get("kit")),
    kind: parseKind(params.get("kind")),
  };
}

export function serializeHash(state: FilterState): string {
  const params = new URLSearchParams();
  if (state.q !== "") params.set("q", state.q);
  if (state.group !== null) params.set("kit", state.group);
  if (state.kind !== null) params.set("kind", state.kind);
  const text = params.toString();
  return text === "" ? "" : `#${text}`;
}
