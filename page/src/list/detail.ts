// A row's name button opens and closes its details (what is inside, and the Source link) right under it.
export function mountRowDetails(list: HTMLElement): void {
  list.addEventListener("click", (event) => {
    const button = event.target instanceof Element ? event.target.closest("button.row-open") : null;
    if (!(button instanceof HTMLButtonElement)) return;
    const more = document.getElementById(button.getAttribute("aria-controls") ?? "");
    if (more === null) return;
    const open = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(open));
    more.hidden = !open;
  });
}
