// Offscreen pausing: tells a callback when an element enters or leaves the viewport.
export interface Visibility {
  readonly visible: boolean;
  dispose(): void;
}

/** `startVisible` says what to assume before the first report (a card the user just pressed Play on is visible). */
export function watchVisible(el: Element, onChange: (visible: boolean) => void, margin = "120px", startVisible = false): Visibility {
  const state = { visible: startVisible };
  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[entries.length - 1];
      if (entry === undefined || entry.isIntersecting === state.visible) return;
      state.visible = entry.isIntersecting;
      onChange(state.visible);
    },
    { rootMargin: margin },
  );
  observer.observe(el);
  return {
    get visible() {
      return state.visible;
    },
    dispose() {
      observer.disconnect();
    },
  };
}
