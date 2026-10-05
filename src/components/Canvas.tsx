import { useEffect, useImperativeHandle, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type Ref } from "react";
import { LogOut, Maximize, Minus, Plus } from "lucide-react";
import { centerOn, clampZoom, distanceFromCenter, isNear, MAX_ZOOM, MIN_ZOOM, project, zoomAt, type Camera, type Point, type Size } from "../camera";
import { retainFrames, TYPE, type Board } from "../layout";
import { Frame } from "./Frame";
import { bindCanvasInput } from "../canvasInput";

/** Live previews held at once. Palier has five; the cap is for larger projects. */
const MAX_LIVE_FRAMES = 12;
/** A screen's label, in board pixels, so focusing a screen keeps its title in view. */
const LABEL_HEIGHT = TYPE.screenTitle.line + TYPE.screenCaption.gap + TYPE.screenCaption.line + TYPE.labelGap;
/** Group headings never open larger than Palier's own canvas drew them. */
const OVERVIEW_ZOOM = { min: 0.27, max: 0.36 };

export interface CanvasHandle {
  focusScreen(id: string): void;
  focusGroup(id: string): void;
  focus(): void;
}

interface Props {
  ref?: Ref<CanvasHandle>;
  label: string;
  origin: string | null;
  board: Board;
  /** The project is reachable: frames may load. */
  live: boolean;
  /** Changes when every preview should start again from its route. */
  reloads: number;
  initialCamera?: Camera;
  selected: string | null;
  interactive: string | null;
  onSelect(id: string | null): void;
  onInteractive(id: string | null): void;
  onCamera(camera: Camera): void;
  viewportControl?: ReactNode;
  children?: ReactNode;
}

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((id) => b.has(id));

export function Canvas({ ref, label, origin, board, live, reloads, initialCamera, selected, interactive, onSelect, onInteractive, onCamera, viewportControl, children }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const [camera, setCamera] = useState<Camera>(initialCamera ?? { x: 56, y: 60, zoom: OVERVIEW_ZOOM.max });
  const latestCamera = useRef(camera);
  latestCamera.current = camera;
  /** False until the camera is either restored or given its opening view. */
  const placed = useRef(Boolean(initialCamera));
  const [size, setSize] = useState<Size | null>(null);
  const [dragging, setDragging] = useState(false);
  const [mounted, setMounted] = useState<ReadonlySet<string>>(new Set());
  const drag = useRef<{ id: number; x: number; y: number; camera: Camera; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const interacting = board.screens.find((screen) => screen.id === interactive);
  const selectedRect = board.screens.find((screen) => screen.id === selected)?.rect;
  const previousSelection = useRef({ id: selected, rect: selectedRect });

  // A viewport change moves subsequent frames too. Keep the selected screen in
  // view, but do not disturb the camera on ordinary manifest polls or selection.
  useEffect(() => {
    const previous = previousSelection.current;
    previousSelection.current = { id: selected, rect: selectedRect };
    if (previous.id !== selected || !previous.rect || !selectedRect) return;
    if (previous.rect.x === selectedRect.x && previous.rect.y === selectedRect.y
      && previous.rect.width === selectedRect.width && previous.rect.height === selectedRect.height) return;
    const el = viewport.current;
    if (!el) return;
    setCamera((camera) => centerOn(
      { ...selectedRect, y: selectedRect.y - LABEL_HEIGHT, height: selectedRect.height + LABEL_HEIGHT },
      { width: el.clientWidth, height: el.clientHeight }, { width: 96, height: 140 }, camera.zoom,
    ));
  }, [selected, selectedRect]);

  const measure = (): Size | null => viewport.current && { width: viewport.current.clientWidth, height: viewport.current.clientHeight };

  function fit() {
    const el = measure();
    if (!el || !board.screens.length) return;
    setCamera(centerOn({ x: 0, y: 0, width: board.width, height: board.height }, el, { width: 96, height: 120 }, 1));
    onSelect(null);
  }

  function focusScreen(id: string) {
    const screen = board.screens.find((screen) => screen.id === id);
    const el = measure();
    if (!screen || !el) return;
    const { rect } = screen;
    setCamera(centerOn({ x: rect.x, y: rect.y - LABEL_HEIGHT, width: rect.width, height: rect.height + LABEL_HEIGHT }, el, { width: 96, height: 140 }, 1));
    onSelect(id);
  }

  function focusGroup(id: string) {
    const group = board.groups.find((group) => group.id === id);
    const el = measure();
    if (!group || !el) return;
    const zoom = clampZoom(Math.min(OVERVIEW_ZOOM.max, (el.width - 112) / group.rect.width));
    setCamera({ x: 56, y: 60 - group.y * zoom, zoom });
    onSelect(group.screens[0]?.id ?? null);
  }

  function zoomBy(factor: number, point?: Point, absolute = false) {
    const el = measure();
    if (!el) return;
    const at = point ?? { x: el.width / 2, y: el.height / 2 };
    setCamera((c) => zoomAt(c, absolute ? factor : c.zoom * factor, at));
  }

  useImperativeHandle(ref, () => ({ focusScreen, focusGroup, focus: () => viewport.current?.focus({ preventScroll: true }) }));

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }));
    observer.observe(el);
    const unbind = bindCanvasInput(el, () => latestCamera.current, setCamera);
    return () => { observer.disconnect(); unbind(); };
  }, []);

  // The opening view, once: the first row at overview size. A restored camera is left alone.
  useEffect(() => {
    if (placed.current || !size || !board.screens.length) return;
    placed.current = true;
    setCamera({ x: 56, y: 60, zoom: clampZoom(Math.max(OVERVIEW_ZOOM.min, Math.min(OVERVIEW_ZOOM.max, (size.width - 112) / board.width))) });
  }, [size, board]);

  useEffect(() => { if (placed.current) onCamera(camera); }, [camera, onCamera]);

  // Load previews selectively: only near the viewport, and only while the project answers.
  useEffect(() => {
    setMounted((previous) => {
      if (!live || !size) return previous.size ? new Set() : previous;
      const margin = Math.max(size.width, size.height) / 2;
      const next = retainFrames(previous, board.screens.map((screen) => {
        const rect = project(screen.rect, camera);
        return { id: screen.id, near: isNear(rect, size, margin), distance: distanceFromCenter(rect, size), keep: screen.id === interactive };
      }), MAX_LIVE_FRAMES);
      return sameSet(previous, next) ? previous : next;
    });
  }, [camera, size, live, board, interactive]);

  function startDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.button !== 1) return;
    if (event.button === 1) event.preventDefault();
    suppressClick.current = false;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, camera, moved: false };
    if (!(event.target as HTMLElement).closest("button, a")) event.currentTarget.focus({ preventScroll: true });
  }

  function moveDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.moved && Math.hypot(dx, dy) < 5) return;
    start.moved = true;
    suppressClick.current = true;
    // Capture keeps the drag on the canvas when it crosses an interactive preview.
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    setCamera({ ...start.camera, x: start.camera.x + dx, y: start.camera.y + dy });
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <div className="relative min-w-0 flex-1">
      <div ref={viewport} role="region" aria-label={label} tabIndex={0}
        className={`relative h-full touch-none overflow-hidden outline-none select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={() => { drag.current = null; setDragging(false); }}
        onDragStart={(event) => event.preventDefault()}
        onClickCapture={(event) => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}
        // A click on the bare canvas leaves the preview first, then clears the selection.
        onClick={(event) => { if (event.target === event.currentTarget) { if (interactive) onInteractive(null); else onSelect(null); } }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (["+", "=", "-", "0", "1", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key)) event.preventDefault();
          if (event.key === "+" || event.key === "=") zoomBy(1.2);
          if (event.key === "-") zoomBy(1 / 1.2);
          if (event.key === "0") fit();
          if (event.key === "1") zoomBy(1, undefined, true);
          if (event.key === "Enter" && selected && live) onInteractive(selected);
          const delta: Record<string, [number, number]> = { ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80] };
          const d = delta[event.key];
          if (d) setCamera((c) => ({ ...c, x: c.x + d[0], y: c.y + d[1] }));
        }}>
        {/* Project positions and type sizes directly: scaling a shared layer can blur annotations. */}
        <div className="pointer-events-none absolute inset-0">
          {board.groups.map((group) => (
            <section key={group.id} aria-label={group.title}>
              <div className="absolute whitespace-nowrap" style={{ left: camera.x + group.x * camera.zoom, top: camera.y + group.y * camera.zoom }}>
                {/* Capped, so headings stay annotations beside actual-size frames; the caps only ever shrink them. */}
                <h2 className="flex items-baseline font-semibold tracking-[-0.02em]" style={{ gap: Math.min(33 * camera.zoom, 12), fontSize: Math.min(TYPE.groupTitle.size * camera.zoom, 26), lineHeight: 1.33 }}>
                  {group.label && <span className="font-medium tracking-normal text-neutral-600">{group.label}</span>}{group.title}
                </h2>
                {group.description && <p className="text-neutral-600" style={{ marginTop: Math.min(TYPE.groupDescription.gap * camera.zoom, 6), fontSize: Math.min(TYPE.groupDescription.size * camera.zoom, 15), lineHeight: 1.41 }}>{group.description}</p>}
              </div>
              {group.screens.map((screen) => (
                <Frame key={screen.id} screen={screen} camera={camera}
                  src={live && origin ? origin + screen.route : null}
                  mounted={mounted.has(screen.id)} reloads={reloads}
                  selected={selected === screen.id} interactive={interactive === screen.id}
                  onSelect={() => { onSelect(screen.id); if (interactive) onInteractive(null); }}
                  onEnter={() => { onSelect(screen.id); onInteractive(screen.id); }}
                  onExit={() => onInteractive(null)} />
              ))}
            </section>
          ))}
        </div>
      </div>
      {children}
      {board.screens.length > 0 && (
        <div className="pointer-events-none absolute right-0 bottom-5 left-0 flex flex-wrap items-center justify-center gap-3 px-5">
          {viewportControl}
          {interacting && (
            <div role="status" className="pointer-events-auto flex h-[38px] items-center gap-3 rounded-lg bg-neutral-900 pr-1 pl-3 text-[12px] text-white shadow-[0_2px_8px_#00000026]">
              <span className="max-w-[40ch] truncate">Interacting with <span className="font-medium">{interacting.title}</span></span>
              <button type="button" onClick={() => onInteractive(null)} className="flex h-[30px] items-center gap-1.5 rounded-[5px] bg-white px-2.5 font-medium text-neutral-900 hover:bg-neutral-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><LogOut size={14} aria-hidden />Exit preview</button>
            </div>
          )}
          <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-black/[0.08] bg-white p-1 shadow-[0_2px_8px_#00000008]">
            <button type="button" className="tool" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.2)} disabled={camera.zoom <= MIN_ZOOM}><Minus size={15} aria-hidden /></button>
            <button type="button" className="h-[30px] w-12 rounded-[5px] text-[11px] tabular-nums hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-700" aria-label="Actual size" title="Actual size (1)" onClick={() => zoomBy(1, undefined, true)}>{Math.round(camera.zoom * 100)}%</button>
            <button type="button" className="tool" aria-label="Zoom in" onClick={() => zoomBy(1.2)} disabled={camera.zoom >= MAX_ZOOM}><Plus size={15} aria-hidden /></button>
            <span className="mx-1 h-4 border-l border-black/10" />
            <button type="button" className="tool" aria-label="Show everything" title="Show everything (0)" onClick={fit}><Maximize size={15} aria-hidden /></button>
          </div>
        </div>
      )}
    </div>
  );
}
