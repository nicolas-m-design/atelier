import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, LogOut, MousePointerClick, RotateCcw } from "lucide-react";
import { project, type Camera } from "../camera";
import { TYPE, type BoardScreen } from "../layout";

interface Props {
  screen: BoardScreen;
  camera: Camera;
  /** The preview's full address, or null while the project is not reachable. */
  src: string | null;
  /** Near enough to the viewport to hold a live preview. */
  mounted: boolean;
  /** The project-wide reload count; a change reloads this preview with the rest. */
  reloads: number;
  selected: boolean;
  interactive: boolean;
  onSelect(): void;
  onEnter(): void;
  onExit(): void;
}

/** Caps keep labels readable without letting them tower over a frame at high zoom. */
const scaled = (size: number, zoom: number, cap: number) => Math.min(size * zoom, cap);

/**
 * One screen on the board. The preview is the project's own page in an iframe;
 * everything Atelier adds (label, outline, controls) sits outside that iframe.
 */
export function Frame({ screen, camera, src, mounted, reloads, selected, interactive, onSelect, onEnter, onExit }: Props) {
  const [own, setOwn] = useState(0);
  const rect = project(screen.rect, camera);
  const { zoom } = camera;
  const titleSize = scaled(TYPE.screenTitle.size, zoom, 15);
  const captionSize = scaled(TYPE.screenCaption.size, zoom, 12);

  return (
    <div className="absolute" style={{ left: rect.x, top: rect.y, width: rect.width }} data-frame={screen.id} data-state={interactive ? "interactive" : selected ? "selected" : "idle"}>
      <div className="absolute right-0 bottom-full left-0 flex items-end justify-between gap-3" style={{ marginBottom: TYPE.labelGap * zoom }}>
        <div className="min-w-0">
          <h3 className="truncate font-medium text-neutral-800" style={{ fontSize: titleSize, lineHeight: 1.4 }}>{screen.title}</h3>
          {screen.caption && <p className="truncate text-neutral-600" style={{ marginTop: TYPE.screenCaption.gap * zoom, fontSize: captionSize, lineHeight: 1.45 }}>{screen.caption}</p>}
        </div>
        {src && (selected || interactive) && (
          <div className="pointer-events-auto flex shrink-0 items-center gap-0.5 rounded-lg border border-black/[0.08] bg-white p-0.5 shadow-[0_2px_8px_#00000008]">
            {interactive
              ? <button type="button" onClick={onExit} className="flex h-[30px] items-center gap-1.5 rounded-[5px] bg-neutral-900 px-2.5 text-[12px] font-medium whitespace-nowrap text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-700"><LogOut size={14} aria-hidden />Exit preview</button>
              : <button type="button" className="tool" onClick={onEnter} aria-label={`Interact with ${screen.title}`} title="Interact (double-click or Enter)"><MousePointerClick size={15} aria-hidden /></button>}
            <button type="button" className="tool" onClick={() => setOwn((n) => n + 1)} aria-label={`Reload ${screen.title}`} title="Reload from its starting route"><RotateCcw size={14} aria-hidden /></button>
            <a className="tool" href={src} target="_blank" rel="noreferrer" aria-label={`Open ${screen.title} in a new tab`} title="Open in a new tab"><ArrowUpRight size={15} aria-hidden /></a>
          </div>
        )}
      </div>
      <div className={`relative bg-white shadow-[0_2px_6px_#00000006] ${interactive ? "outline-2 outline-offset-4 outline-neutral-900" : selected ? "outline-2 outline-offset-4 outline-neutral-400" : ""}`} style={{ height: rect.height }}>
        {src && mounted
          ? <Preview key={`${reloads}:${own}`} screen={screen} src={src} zoom={zoom} interactive={interactive} />
          : <Placeholder label={src ? null : "Preview unavailable"} wide={rect.width >= 180} muted={!src} />}
        {!interactive && (
          <button type="button" aria-pressed={selected}
            aria-label={src ? `${screen.title}${screen.caption ? `, ${screen.caption}` : ""}. ${selected ? "Press Enter to interact." : "Select."}` : `${screen.title}. Preview unavailable.`}
            // A keyboard activation has no click count: Enter on a selected frame enters it.
            onClick={(event) => { if (selected && event.detail === 0 && src) onEnter(); else onSelect(); }}
            onDoubleClick={() => { if (src) onEnter(); }}
            className="pointer-events-auto absolute inset-0 block outline-offset-4 hover:outline-2 hover:outline-neutral-400 focus-visible:outline-2 focus-visible:outline-neutral-700" />
        )}
      </div>
    </div>
  );
}

function Preview({ screen, src, zoom, interactive }: { screen: BoardScreen; src: string; zoom: number; interactive: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  // Entering a preview hands it the keyboard too.
  useEffect(() => { if (interactive) frame.current?.focus({ preventScroll: true }); }, [interactive]);
  return (
    <div className="absolute inset-0 overflow-hidden">
      {!loaded && <Placeholder label="Loading…" wide muted={false} />}
      <iframe
        ref={frame}
        title={screen.title} src={src} onLoad={() => setLoaded(true)}
        // Until entered, the preview takes no pointer, wheel or keyboard input: those belong to the canvas.
        inert={!interactive} tabIndex={interactive ? 0 : -1}
        className="block origin-top-left border-0"
        // At actual size the preview is left untransformed, exactly as the browser would lay it out alone.
        style={{ width: screen.rect.width, height: screen.rect.height, transform: zoom === 1 ? undefined : `scale(${zoom})`, pointerEvents: interactive ? "auto" : "none", opacity: loaded ? 1 : 0 }} />
    </div>
  );
}

function Placeholder({ label, wide, muted }: { label: string | null; wide: boolean; muted: boolean }) {
  return (
    <div className={`absolute inset-0 flex items-center justify-center ${muted ? "border border-dashed border-neutral-300 bg-neutral-100" : ""}`}>
      {label && wide && <span className="text-[12px] text-neutral-500">{label}</span>}
    </div>
  );
}
