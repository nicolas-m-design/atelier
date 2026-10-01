/**
 * Camera maths for the canvas, with no framework. Board coordinates are source
 * pixels: at zoom 1 a 1280 × 720 frame is 1280 × 720 on screen.
 */

export interface Camera { x: number; y: number; zoom: number }
export interface Point { x: number; y: number }
export interface Size { width: number; height: number }
export interface Rect extends Point, Size {}

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 2;

export function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

/** Change zoom while the board point under `point` (viewport pixels) stays put. */
export function zoomAt(camera: Camera, zoom: number, point: Point): Camera {
  const next = clampZoom(zoom);
  return {
    x: point.x - ((point.x - camera.x) * next) / camera.zoom,
    y: point.y - ((point.y - camera.y) * next) / camera.zoom,
    zoom: next,
  };
}

/** Centre a board rectangle in the viewport, no larger than `maxZoom`. */
export function centerOn(rect: Rect, viewport: Size, padding: Size, maxZoom: number): Camera {
  const zoom = clampZoom(Math.min(
    maxZoom,
    (viewport.width - padding.width) / rect.width,
    (viewport.height - padding.height) / rect.height,
  ));
  return {
    x: (viewport.width - rect.width * zoom) / 2 - rect.x * zoom,
    y: (viewport.height - rect.height * zoom) / 2 - rect.y * zoom,
    zoom,
  };
}

/** Board rectangle to viewport pixels. */
export function project(rect: Rect, camera: Camera): Rect {
  return {
    x: camera.x + rect.x * camera.zoom,
    y: camera.y + rect.y * camera.zoom,
    width: rect.width * camera.zoom,
    height: rect.height * camera.zoom,
  };
}

/** Whether a viewport-space rectangle lies within the viewport grown by `margin` on each side. */
export function isNear(rect: Rect, viewport: Size, margin: number): boolean {
  return rect.x < viewport.width + margin && rect.x + rect.width > -margin
    && rect.y < viewport.height + margin && rect.y + rect.height > -margin;
}

/** Distance between a viewport-space rectangle's centre and the viewport's centre. */
export function distanceFromCenter(rect: Rect, viewport: Size): number {
  return Math.hypot(rect.x + rect.width / 2 - viewport.width / 2, rect.y + rect.height / 2 - viewport.height / 2);
}

export function isCamera(value: unknown): value is Camera {
  if (typeof value !== "object" || value === null) return false;
  const { x, y, zoom } = value as Record<string, unknown>;
  return [x, y, zoom].every((n) => typeof n === "number" && Number.isFinite(n)) && (zoom as number) >= MIN_ZOOM && (zoom as number) <= MAX_ZOOM;
}
