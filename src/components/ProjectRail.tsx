import type { Project } from "../projects";
import type { Status } from "../status";
import { STATUS_DOT, statusLine } from "./StatusCard";

/** The narrow project switcher. Each project keeps its own canvas view. */
export function ProjectRail({ projects, statuses, active, onSelect }: { projects: readonly Project[]; statuses: Record<string, Status>; active: string; onSelect(id: string): void }) {
  return (
    <nav aria-label="Projects" className="z-20 flex w-14 shrink-0 flex-col items-center gap-2 border-r border-black/10 bg-[#f1f1f0] py-3.5">
      {projects.map((project) => {
        const status = statuses[project.id] ?? { state: "checking" };
        const current = project.id === active;
        return (
          <button key={project.id} type="button" onClick={() => onSelect(project.id)} aria-current={current ? "true" : undefined}
            aria-label={`${project.name}. ${statusLine(project, status)}`} title={`${project.name} · ${statusLine(project, status)}`}
            className={`relative flex size-9 items-center justify-center rounded-[10px] text-ui-body font-semibold outline-offset-2 focus-visible:outline-2 focus-visible:outline-neutral-700 ${current ? "bg-neutral-900 text-white" : "bg-white text-muted shadow-[0_1px_2px_#0000000f] hover:text-foreground"}`}>
            {project.name.slice(0, 1)}
            <span aria-hidden className={`absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-[#f1f1f0] ${STATUS_DOT[status.state]} ${status.state === "empty" ? "!bg-[#f1f1f0]" : ""}`} />
          </button>
        );
      })}
    </nav>
  );
}
