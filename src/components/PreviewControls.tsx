import { useEffect, useRef, type ReactNode } from "react";
import { ExternalLink, GitBranch, Play, Square, X } from "lucide-react";
import type { Project } from "../projects";
import type { Branch, BranchReport } from "../branches";
import type { PreviewSession } from "../usePreviews";

export interface PreviewProps {
  project: Project;
  session: PreviewSession;
  report: BranchReport | null;
  branchesFailed: boolean;
  choice: string;
  onChoice(branch: string): void;
  workingLive: boolean;
}

/** What the sidebar controls and the not-running card both read from the one preview state. */
function draft({ project, session, report, branchesFailed, choice }: PreviewProps) {
  const { state } = session;
  const active = state?.active?.projectId === project.id ? state.active : null;
  const candidate = state?.candidate?.projectId === project.id ? state.candidate : null;
  const busy = session.pending || !!state?.candidate;
  const branches = report?.state === "listed" ? report.branches : [];
  const branch = branches.find(b => b.name === choice);
  const branchProblem = branchesFailed || report?.state === "failed" ? "Branches could not be refreshed. Refocus Atelier to retry."
    : report?.state === "unregistered" ? "Register a repository folder to preview branches."
    : report?.state === "not-a-repository" ? "The registered folder is not a Git repository."
    : report?.state === "listed" && !branches.length ? "No committed local branches yet." : null;
  const notes = [
    choice && !project.canPreview && "Branch previews need a recipe in your project list.",
    state && !state.supported && "Branch previews require macOS.",
    !session.connected && "Preview controls are reconnecting…",
    branchProblem,
    branches.length >= 200 && "Showing the 200 most recently updated branches.",
    choice && state?.active && !active && `Replaces the preview for ${state.active.projectId} when ready.`,
    state?.candidate && !candidate && `Preparing ${state.candidate.projectId}. Cancel there before starting another preview.`,
  ].filter((note): note is string => !!note);
  const error = session.error?.projectId === project.id ? session.error.text : state?.errorProjectId === project.id ? state.error : null;
  const phase = candidate?.phase === "starting" ? "Starting" : candidate?.phase === "resolving" ? "Reading branch" : "Preparing";
  const canStart = !!choice && !!branch && project.canPreview && state?.supported && session.connected && !busy && !branchesFailed;
  return { active, candidate, busy, branches, branch, notes, error, phase, canStart };
}

function BranchOptions({ choice, branches }: { choice: string; branches: Branch[] }) {
  return <>
    {choice && !branches.some(b => b.name === choice) && <option value={choice}>{choice} (unavailable)</option>}
    {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
  </>;
}

export function PreviewControls(props: PreviewProps) {
  const { project, session, choice, onChoice, workingLive } = props;
  const { act } = session;
  const { active, candidate, busy, branches, branch, notes, error, phase, canStart } = draft(props);
  const selector = useRef<HTMLSelectElement>(null);
  useEffect(() => { if (active) selector.current?.focus({ preventScroll: true }); }, [active?.id]);
  const updated = active?.branch === choice && branch && !active.commit.startsWith(branch.hash);
  const label = updated ? "Update preview" : active?.branch === choice ? "Restart preview" : "Start preview";
  return (
    <section aria-label="Branch preview" className="preview-controls shrink-0 border-t border-black/[0.07] px-4 py-3">
      <div className="flex items-center gap-2">
        <GitBranch size={14} className="shrink-0 text-muted" aria-hidden />
        <select ref={selector} aria-label="Preview source" value={choice} onChange={event => onChoice(event.target.value)} disabled={session.pending || !!candidate}
          className="min-w-0 flex-1 rounded-[5px] bg-transparent px-1 py-2 outline-none focus-visible:bg-neutral-200" title={choice || "Working preview"}>
          <option value="">Working preview</option>
          <BranchOptions choice={choice} branches={branches} />
        </select>
        {project.origin && !active && workingLive && <a href={project.origin} target="_blank" rel="noreferrer" className="preview-icon" aria-label="Open working preview" title="Open working preview"><ExternalLink size={14} aria-hidden /></a>}
      </div>
      {(choice || active || candidate) && <div className="mt-2 flex gap-2">
        {choice ? <button type="button" className="preview-action flex-1" disabled={!canStart} onClick={() => void act({ action: "start", projectId: project.id, branch: choice })}><Play size={13} aria-hidden />{label}</button>
          : active ? <button type="button" className="preview-action flex-1" disabled={busy || !session.connected} onClick={() => void act({ action: "stop", projectId: project.id, runId: active.id })}>Show working preview</button> : null}
        {candidate ? <button type="button" className="preview-action flex-1" disabled={session.pending || !session.connected} onClick={() => void act({ action: "cancel", projectId: project.id, runId: candidate.id })}><X size={13} aria-hidden />Cancel</button>
          : active && choice ? <button type="button" className="preview-action" disabled={busy || !session.connected} onClick={() => void act({ action: "stop", projectId: project.id, runId: active.id })}><Square size={12} aria-hidden />Stop</button> : null}
      </div>}
      <div className="mt-2 text-muted" role="status" aria-live="polite" aria-atomic="true">
        {candidate ? <p className="break-words">{phase} {candidate.branch}…</p>
          : <p className="truncate" title={active ? `${active.branch} · ${active.commit}` : "Working preview"}>{active ? `Viewing ${active.branch} · ${active.commit.slice(0, 7)}` : "Viewing working preview"}</p>}
        {candidate && <p className="mt-1 truncate">Still viewing {active?.branch ?? "working preview"}.</p>}
      </div>
      {notes.map(note => <p key={note} className="mt-2 text-muted">{note}</p>)}
      {error && <p role="alert" className="mt-2 break-words text-red-700">{error}</p>}
    </section>
  );
}

const CARD_ACTION = "flex h-8 items-center gap-2 rounded-lg px-3 text-ui-control font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-700";

/**
 * The same choice and Start action, on the card of a project that is not
 * running. The card is the live region here; the sidebar keeps the alert.
 */
export function BranchStart({ children, ...props }: PreviewProps & { children?: ReactNode }) {
  const { project, session, choice, onChoice } = props;
  const { candidate, branches, notes, error, phase, canStart } = draft(props);
  return <>
    <div className="mt-3 flex items-center gap-2 rounded-lg bg-neutral-100 py-1.5 pr-1.5 pl-3">
      <GitBranch size={14} className="shrink-0 text-muted" aria-hidden />
      <select aria-label="Branch to preview" value={choice} onChange={event => onChoice(event.target.value)} disabled={session.pending || !!candidate}
        className="h-[30px] min-w-0 flex-1 rounded-[5px] bg-transparent px-1 text-ui-control text-foreground outline-none focus-visible:bg-neutral-200" title={choice || undefined}>
        <option value="" disabled>Choose a branch</option>
        <BranchOptions choice={choice} branches={branches} />
      </select>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      {/* Start stays in place while preparing, so a second click never lands on Cancel. */}
      <button type="button" className={`${CARD_ACTION} bg-neutral-900 text-white enabled:hover:bg-neutral-700 disabled:bg-neutral-100 disabled:text-muted`} disabled={!canStart} onClick={() => void session.act({ action: "start", projectId: project.id, branch: choice })}><Play size={13} aria-hidden />Start preview</button>
      {candidate && <button type="button" className={`${CARD_ACTION} border border-black/10 hover:bg-neutral-100`} disabled={session.pending || !session.connected} onClick={() => void session.act({ action: "cancel", projectId: project.id, runId: candidate.id })}><X size={13} aria-hidden />Cancel</button>}
      {children}
    </div>
    {candidate && <p className="mt-3 break-words text-ui-control text-muted">{phase} {candidate.branch}…</p>}
    {notes.map(note => <p key={note} className="mt-3 text-ui-control text-muted">{note}</p>)}
    {error && <p className="mt-3 break-words text-ui-control text-red-700">{error}</p>}
  </>;
}
