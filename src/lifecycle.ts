/** Native window occlusion supplements document.hidden, which WebKit may keep
 * false for a covered window. Browser mode needs no host or bridge. */
let hostVisible = true;
export const canRefresh = (): boolean => !document.hidden && hostVisible;
export function observeVisibility(wake: () => void): () => void {
  const change = (event: Event) => {
    const visible = (event as CustomEvent<unknown>).detail;
    if (typeof visible !== "boolean") return;
    const resumed = !hostVisible && visible;
    hostVisible = visible;
    if (resumed) wake();
  };
  window.addEventListener("atelier:visibility", change);
  return () => window.removeEventListener("atelier:visibility", change);
}
