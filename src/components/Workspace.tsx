import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, File, Frame as FrameIcon, Layers, Library, PanelLeftClose, PanelLeftOpen, RefreshCw } from "lucide-react";
import type { Camera } from "../camera";
import { layoutBoard } from "../layout";
import type { Project } from "../projects";
import type { Status } from "../status";
import type { Store } from "../storage";
import { Branches } from "./Branches";
import { Canvas, type CanvasHandle } from "./Canvas";
import { Page } from "./Page";
import { STATUS_DOT, StatusCard, statusLine } from "./StatusCard";

interface Props {
  project: Project;
  status: Status;
  store: Store;
  sidebar: boolean;
  onSidebar(open: boolean): void;
  onRetry(): void;
}

/**
 * One project's sidebar and canvas, and its linked pages when one is open.
 * Mounted per project, so its camera, selection and previews never leak into
 * another project's.
 */
export function Workspace({ project, status, store, sidebar, onSidebar, onRetry }: Props) {
  const canvas = useRef<CanvasHandle>(null);
  const [view] = useState(() => store.get().projects[project.id] ?? {});
  const live = status.state === "online";
  // While the project is stopped, keep listing what it last served.
  const [lastManifest, setLastManifest] = useState(view.manifest);
  const manifest = status.state === "online" ? status.manifest : lastManifest;
  const board = useMemo(() => manifest ? layoutBoard(manifest) : null, [manifest]);
  const [selected, setSelected] = useState<string | null>(view.selected ?? null);
  const [interactive, setInteractive] = useState<string | null>(null);
  const known = (id: string | null) => id !== null && Boolean(board?.screens.some((screen) => screen.id === id));
  const current = known(selected) ? selected : null;
  const entered = live && known(interactive) ? interactive : null;
  // The canvas, or one of the pages the manifest links to. A saved page the project no longer lists falls back to the canvas.
  const [page, setPage] = useState<string | null>(view.page ?? null);
  const links = manifest?.links ?? [];
  const open = links.find((link) => link.id === page) ?? null;

  useEffect(() => {
    if (status.state !== "online") return;
    setLastManifest(status.manifest);
    store.updateProject(project.id, { manifest: status.manifest });
  }, [status, store, project.id]);
  useEffect(() => { if (board) store.updateProject(project.id, { selected: current }); }, [current, board, store, project.id]);
  useEffect(() => { if (manifest) store.updateProject(project.id, { page: open?.id ?? null }); }, [open?.id, manifest, store, project.id]);
  const saveCamera = useCallback((camera: Camera) => store.updateProject(project.id, { camera }), [store, project.id]);

  const exit = useCallback(() => { setInteractive(null); canvas.current?.focus(); }, []);
  const changeInteractive = useCallback((id: string | null) => { if (id === null) exit(); else setInteractive(id); }, [exit]);
  const showPage = (id: string | null) => { setInteractive(null); setPage(id); };
  // Counts the project-wide reloads. Every preview and the open page start again from their route when it changes.
  const [reloads, setReloads] = useState(0);
  const reloadAll = () => { setReloads((n) => n + 1); onRetry(); };
  const showSidebar = <button type="button" onClick={() => onSidebar(true)} aria-label="Show the sidebar" className="tool"><PanelLeftOpen size={17} aria-hidden /></button>;
  const pageItem = (active: boolean) => `flex min-h-10 w-full items-center gap-2.5 rounded-md px-2 text-left font-medium outline-offset-2 focus-visible:outline-2 focus-visible:outline-neutral-700 ${active ? "bg-neutral-200 text-neutral-900" : "text-neutral-600 hover:bg-neutral-100"}`;
  // Escape leaves a preview whenever the keyboard is in Canvagent. Keys pressed inside
  // a preview stay in that page, which is why the Exit controls are always on screen.
  useEffect(() => {
    if (!entered) return;
    const leave = (event: KeyboardEvent) => { if (event.key === "Escape") exit(); };
    window.addEventListener("keydown", leave);
    return () => window.removeEventListener("keydown", leave);
  }, [entered, exit]);

  return (
    <>
      {sidebar && (
        <aside className="z-10 flex w-[248px] shrink-0 flex-col border-r border-black/10 bg-[#fafafa]">
          <div className="flex h-16 shrink-0 items-center justify-between gap-2 pr-3 pl-5">
            <div className="min-w-0">
              <h1 className="truncate text-[15px] leading-5 font-semibold tracking-[-0.01em]">{project.name}</h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-4 text-neutral-500">
                <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${STATUS_DOT[status.state]}`} /><span className="truncate">{statusLine(project, status)}</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              {/* Only while live: there is nothing to reload otherwise, and the longer status lines need the room. */}
              {live && <button type="button" className="tool" onClick={reloadAll} aria-label={`Reload all of ${project.name}'s previews`} title="Reload all previews"><RefreshCw size={15} aria-hidden /></button>}
              <button type="button" className="tool" onClick={() => onSidebar(false)} aria-label="Hide the sidebar"><PanelLeftClose size={16} aria-hidden /></button>
            </div>
          </div>
          {links.length > 0 && (
            <nav aria-label={`${project.name} pages`} className="shrink-0 space-y-1 border-t border-black/[0.07] px-3 py-3 text-[13px]">
              <button type="button" onClick={() => showPage(null)} aria-current={open ? undefined : "page"} className={pageItem(!open)}><Layers size={16} className="shrink-0" aria-hidden />Screens</button>
              {links.map((link) => {
                const Icon = link.id === "library" ? Library : File;
                return <button key={link.id} type="button" onClick={() => showPage(link.id)} aria-current={open?.id === link.id ? "page" : undefined} className={pageItem(open?.id === link.id)}><Icon size={16} className="shrink-0" aria-hidden /><span className="truncate">{link.title}</span></button>;
              })}
            </nav>
          )}
          {/* A linked page brings its own navigation, so the screen list steps aside for it. */}
          <nav aria-label={`${project.name} screens`} hidden={Boolean(open)} className="flex-1 overflow-y-auto border-t border-black/[0.07] px-3 py-4 text-[12px]">
            {board?.groups.map((group) => (
              <div key={group.id} className="mb-5">
                <button type="button" onClick={() => canvas.current?.focusGroup(group.id)} className="mb-1 flex w-full items-center gap-2 rounded-md px-2 py-2 text-left font-medium outline-offset-2 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-neutral-700"><ChevronDown size={12} className="shrink-0 text-neutral-400" aria-hidden />{group.title}</button>
                {group.screens.map(({ id, title }) => (
                  <button key={id} type="button" onClick={() => { setInteractive(null); canvas.current?.focusScreen(id); }} aria-current={current === id ? "true" : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-md py-2 pr-2 pl-6 text-left outline-offset-2 transition-colors focus-visible:outline-2 focus-visible:outline-neutral-700 ${current === id ? "bg-neutral-200 text-neutral-900" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"}`}>
                    <FrameIcon size={14} className="shrink-0 opacity-60" aria-hidden /><span>{title}</span>
                  </button>
                ))}
              </div>
            ))}
            {!board && <p className="px-2 py-2 leading-relaxed text-neutral-500">No screens to list yet.</p>}
          </nav>
          <Branches project={project} store={store} />
        </aside>
      )}
      <div className="relative flex min-w-0 flex-1">
        {!sidebar && !open && <div className="absolute top-4 left-4 z-20 rounded-[5px] bg-white shadow-sm">{showSidebar}</div>}
        {/* The canvas stays mounted under an open page, so its previews and position are there on return. */}
        <div className="flex min-w-0 flex-1" inert={Boolean(open)}>
          <Canvas ref={canvas} label={`${project.name} canvas`} origin={project.origin} board={board ?? EMPTY_BOARD} live={live} reloads={reloads}
            initialCamera={view.camera} selected={current} interactive={entered}
            onSelect={setSelected} onInteractive={changeInteractive} onCamera={saveCamera}>
            <StatusCard project={project} status={status} hasBoard={Boolean(board)} onRetry={onRetry} />
          </Canvas>
        </div>
        {open && (
          <Page key={open.id} link={open} reloads={reloads} src={live && project.origin ? project.origin + open.route : null} leading={sidebar ? null : showSidebar}>
            <StatusCard project={project} status={status} hasBoard={false} onRetry={onRetry} />
          </Page>
        )}
      </div>
    </>
  );
}

const EMPTY_BOARD = { groups: [], screens: [], width: 0, height: 0 };
