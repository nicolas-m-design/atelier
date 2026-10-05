import { zoomAt, type Camera, type Point } from "./camera";

type Gesture = Event & { scale: number; clientX: number; clientY: number };
type Update = (change: (camera: Camera) => Camera) => void;

/** Browser wheel input and WebKit's cumulative trackpad gesture scale. Only
 * events in Atelier's canvas reach this element; iframe input stays there. */
export function bindCanvasInput(el: HTMLElement, read: () => Camera, update: Update): () => void {
  let gesture: { camera: Camera; point: Point } | null = null;
  const point = (event: { clientX: number; clientY: number }): Point => {
    const bounds = el.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };
  const wheel = (event: WheelEvent) => {
    event.preventDefault();
    if (gesture) return; // Some engines also emit wheel during a gesture.
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientHeight : 1;
    if (event.ctrlKey || event.metaKey) {
      const at = point(event);
      update((c) => zoomAt(c, c.zoom * Math.exp(-event.deltaY * unit * 0.01), at));
    } else {
      update((c) => ({ ...c, x: c.x - (event.shiftKey ? event.deltaY : event.deltaX) * unit, y: c.y - (event.shiftKey ? 0 : event.deltaY) * unit }));
    }
  };
  const start = (event: Event) => {
    const at = point(event as Gesture);
    if (![at.x, at.y].every(Number.isFinite)) return;
    event.preventDefault();
    gesture = { camera: { ...read() }, point: at };
  };
  const change = (event: Event) => {
    if (!gesture) return;
    event.preventDefault();
    const scale = (event as Gesture).scale;
    if (!Number.isFinite(scale) || scale <= 0) return;
    const next = zoomAt(gesture.camera, gesture.camera.zoom * scale, gesture.point);
    update(() => next);
  };
  const end = (event: Event) => { if (gesture) event.preventDefault(); gesture = null; };
  const reset = () => { gesture = null; };
  el.addEventListener("wheel", wheel, { passive: false });
  el.addEventListener("gesturestart", start, { passive: false });
  el.addEventListener("gesturechange", change, { passive: false });
  el.addEventListener("gestureend", end, { passive: false });
  el.ownerDocument.defaultView?.addEventListener("blur", reset);
  return () => {
    el.removeEventListener("wheel", wheel);
    el.removeEventListener("gesturestart", start);
    el.removeEventListener("gesturechange", change);
    el.removeEventListener("gestureend", end);
    el.ownerDocument.defaultView?.removeEventListener("blur", reset);
  };
}
