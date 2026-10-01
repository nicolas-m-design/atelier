import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, RotateCcw } from "lucide-react";
import { fitPage, type Size } from "../camera";
import type { ManifestLink } from "../manifest";

interface Props {
  link: ManifestLink;
  /** The page's full address, or null while the project is not reachable. */
  src: string | null;
  /** Controls that belong before the title, such as the sidebar toggle. */
  leading?: ReactNode;
  /** Shown in place of the page while there is no address to load. */
  children?: ReactNode;
}

/**
 * One of a project's linked pages, such as its UI library, shown whole in place
 * of the canvas. Unlike a preview it is not a fixed frame: it fills the room
 * there is and is always interactive. Atelier's controls stay in the bar above it.
 */
export function Page({ link, src, leading, children }: Props) {
  const area = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size | null>(null);
  const [reloads, setReloads] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setLoaded(false); }, [src, reloads]);

  const fit = size && fitPage(size, link.width);

  return (
    <section aria-label={link.title} className="absolute inset-0 z-10 flex flex-col bg-[#e8e8e8]">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-black/10 bg-[#fafafa] pr-3 pl-4">
        {leading}
        <h2 className="truncate text-[13px] font-medium">{link.title}</h2>
        {src && (
          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            <button type="button" className="tool" onClick={() => setReloads((n) => n + 1)} aria-label={`Reload ${link.title}`} title="Reload from its starting route"><RotateCcw size={14} aria-hidden /></button>
            <a className="tool" href={src} target="_blank" rel="noreferrer" aria-label={`Open ${link.title} in a new tab`} title="Open in a new tab"><ArrowUpRight size={15} aria-hidden /></a>
          </div>
        )}
      </header>
      <div ref={area} className="relative min-h-0 flex-1 overflow-hidden">
        {src && fit && (
          <>
            {!loaded && <p className="absolute inset-0 flex items-center justify-center text-[12px] text-neutral-500">Loading…</p>}
            <iframe key={reloads} title={link.title} src={src} onLoad={() => setLoaded(true)}
              className="block origin-top-left border-0"
              // With room to spare the page is left untransformed, exactly as the browser would lay it out alone.
              style={{ width: fit.width, height: fit.height, transform: fit.scale === 1 ? undefined : `scale(${fit.scale})`, opacity: loaded ? 1 : 0 }} />
          </>
        )}
        {!src && children}
      </div>
    </section>
  );
}
