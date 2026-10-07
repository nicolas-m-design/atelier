import { useEffect, useMemo, useRef, useState } from "react";
import type { Project } from "../projects";
import type { Status } from "../status";
import { createStore, type Store } from "../storage";
import type { PreviewSession } from "../usePreviews";
import { useBranches } from "../useBranches";
import { DEFAULT_DEVICE, DEFAULT_VIEWPORT, type Device, type ViewportMode } from "../viewports";
import { Workspace } from "./Workspace";
import { PreviewControls, type PreviewProps } from "./PreviewControls";

interface Props { project: Project; status: Status; store: Store; sidebar: boolean; onSidebar(open: boolean): void; onRetry(): void; session: PreviewSession }
/** Device/Size and the draft branch choice outlive each inner workspace/run. */
export function ProjectWorkspace({ project, status, store, session, ...props }: Props) {
  const run = session.state?.active?.projectId === project.id ? session.state.active : null;
  const [device, setDevice] = useState<Device>(DEFAULT_DEVICE);
  const [viewportMode, setViewportMode] = useState<ViewportMode>(DEFAULT_VIEWPORT);
  const [choice, setChoice] = useState(run?.branch ?? "");
  const selection = useRef<{ selected: string | null; page: string | null }>({ selected: null, page: null });
  const previousRun = useRef(run?.id);
  useEffect(() => {
    if (previousRun.current !== run?.id) { previousRun.current = run?.id; if (run) setChoice(run.branch); }
  }, [run?.id, run?.branch]);
  const targetStore = useMemo(() => {
    if (!run) return store;
    const transient = createStore(null);
    const screens = run.manifest.groups.flatMap(group => group.screens);
    const selected = screens.some(screen => screen.id === selection.current.selected) ? selection.current.selected : screens[0]?.id ?? null;
    transient.updateProject(project.id, { ...selection.current, selected, manifest: run.manifest });
    return transient;
    // Run identity is the lifetime boundary; polling the same manifest does not reset views.
  }, [run?.id, project.id, store]);
  const { report, failed } = useBranches(project.id, true);
  const effectiveProject = run ? { ...project, origin: run.origin, start: undefined } : project;
  const effectiveStatus: Status = run ? { state: "online", manifest: run.manifest } : status;
  const sourceLabel = run ? `${run.branch} · ${run.commit.slice(0, 7)}` : "Working preview";
  const preview: PreviewProps = { project, session, report, branchesFailed: failed, choice, onChoice: setChoice, workingLive: status.state === "online" };
  return <Workspace key={run?.id ?? `working:${project.origin}`} {...props} project={effectiveProject} status={effectiveStatus} store={targetStore}
    focusInitialSelection={!!run} device={device} viewportMode={viewportMode} onDevice={setDevice} onViewport={setViewportMode} sourceLabel={sourceLabel}
    onSelection={(selected, page) => { selection.current = { selected, page }; }}
    previewControls={<PreviewControls {...preview} />} branchStart={project.canPreview && session.state?.supported !== false ? preview : null} />;
}
