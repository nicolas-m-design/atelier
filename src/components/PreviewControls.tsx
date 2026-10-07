import { useEffect, useRef } from "react";
import { ExternalLink, GitBranch, Play, Square, X } from "lucide-react";
import type { Project } from "../projects";
import type { BranchReport } from "../branches";
import type { PreviewSession } from "../usePreviews";

interface Props {
  project: Project;
  session: PreviewSession;
  report: BranchReport | null;
  branchesFailed: boolean;
  choice: string;
  onChoice(branch: string): void;
  workingLive: boolean;
}
export function PreviewControls({ project, session, report, branchesFailed, choice, onChoice, workingLive }: Props) {
  const { state, act } = session;
  const selector = useRef<HTMLSelectElement>(null);
  const active = state?.active?.projectId === project.id ? state.active : null;
  useEffect(() => { if (active) selector.current?.focus({ preventScroll: true }); }, [active?.id]);
  const candidate = state?.candidate?.projectId === project.id ? state.candidate : null;
  const busy = session.pending || !!state?.candidate;
  const branches = report?.state === "listed" ? report.branches : [];
  const branch = branches.find(b => b.name === choice);
  const updated = active?.branch === choice && branch && !active.commit.startsWith(branch.hash);
  const branchProblem = branchesFailed || report?.state === "failed" ? "Branches could not be refreshed. Refocus Atelier to retry."
    : report?.state === "unregistered" ? "Register a repository folder to preview branches."
    : report?.state === "not-a-repository" ? "The registered folder is not a Git repository."
    : report?.state === "listed" && !branches.length ? "No committed local branches yet." : null;
  const error = session.error?.projectId === project.id ? session.error.text : state?.errorProjectId === project.id ? state.error : null;
  const label = updated ? "Update preview" : active?.branch === choice ? "Restart preview" : "Start preview";
  const phase = candidate?.phase === "starting" ? "Starting" : candidate?.phase === "resolving" ? "Reading branch" : "Preparing";
  const canStart = !!choice && !!branch && project.canPreview && state?.supported && session.connected && !busy && !branchesFailed;
  return (
    <section aria-label="Branch preview" className="preview-controls shrink-0 border-t border-black/[0.07] px-4 py-3">
      <div className="flex items-center gap-2">
        <GitBranch size={14} className="shrink-0 text-muted" aria-hidden />
        <select ref={selector} aria-label="Preview source" value={choice} onChange={event => onChoice(event.target.value)} disabled={session.pending || !!candidate}
          className="min-w-0 flex-1 rounded-[5px] bg-transparent px-1 py-2 outline-none focus-visible:bg-neutral-200" title={choice || "Working preview"}>
          <option value="">Working preview</option>
          {choice && !branches.some(b => b.name === choice) && <option value={choice}>{choice} (unavailable)</option>}
          {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
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
      {choice && !project.canPreview && <p className="mt-2 text-pretty text-muted">Branch previews need a recipe in your project list.</p>}
      {state && !state.supported && <p className="mt-2 text-muted">Branch previews require macOS.</p>}
      {!session.connected && <p className="mt-2 text-muted">Preview controls are reconnecting…</p>}
      {branchProblem && <p className="mt-2 text-muted">{branchProblem}</p>}
      {report?.state === "listed" && report.branches.length >= 200 && <p className="mt-2 text-muted">Showing the 200 most recently updated branches.</p>}
      {choice && state?.active && !active && <p className="mt-2 text-pretty text-muted">Replaces the preview for {state.active.projectId} when ready.</p>}
      {state?.candidate && !candidate && <p className="mt-2 text-pretty text-muted">Preparing {state.candidate.projectId}. Cancel there before starting another preview.</p>}
      {error && <p role="alert" className="mt-2 break-words text-red-700">{error}</p>}
    </section>
  );
}
