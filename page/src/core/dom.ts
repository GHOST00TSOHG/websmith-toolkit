// Tiny element factory. Text always goes through textContent, never innerHTML.
export interface ElementSpec {
  readonly class?: string;
  readonly text?: string;
  readonly attrs?: Readonly<Record<string, string>>;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  spec: ElementSpec = {},
  children: readonly (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (spec.class !== undefined) el.className = spec.class;
  if (spec.text !== undefined) el.textContent = spec.text;
  if (spec.attrs !== undefined) for (const [k, v] of Object.entries(spec.attrs)) el.setAttribute(k, v);
  for (const child of children) el.append(child);
  return el;
}

const SVG_NS = "http://www.w3.org/2000/svg";
export function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Readonly<Record<string, string>> = {}): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/** Finds an element or throws: for markup this app itself ships. */
export function must<T extends Element>(root: ParentNode, selector: string, guard: (el: Element) => el is T): T {
  const el = root.querySelector(selector);
  if (el === null || !guard(el)) throw new Error(`missing element: ${selector}`);
  return el;
}

export const isHTMLElement = (el: Element): el is HTMLElement => el instanceof HTMLElement;
export const isInput = (el: Element): el is HTMLInputElement => el instanceof HTMLInputElement;
