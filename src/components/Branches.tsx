import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Folder, FolderX } from "lucide-react";
import { age, folderName, type Checkout } from "../branches";
import type { Project } from "../projects";
import type { Store } from "../storage";
import { useBranches } from "../useBranches";

/**
 * The local branches of a project's repository, at the foot of the sidebar.
 * A list to read, not to act on: Canvagent cannot tell which branch a preview
 * is serving, and never checks one out.
 */
export function Branches({ project, store }: { project: Project; store: Store }) {
  const [open, setOpen] = useState(() => store.get().branches);
  const { report, failed } = useBranches(project.id, open);
  const toggle = () => { setOpen(!open); store.update((saved) => { saved.branches = !open; }); };
  const Chevron = open ? ChevronDown : ChevronRight;
  const now = Date.now() / 1000;

  return (
    <section aria-label={`${project.name} local branches`} className="mt-auto shrink-0 border-t border-black/[0.07] px-3 py-2 text-[12px]">
      <button type="button" onClick={toggle} aria-expanded={open} title="Branches in the project's repository. Canvagent cannot tell which one a preview is serving."
        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left font-medium outline-offset-2 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-neutral-700">
        <Chevron size={12} className="shrink-0 text-neutral-400" aria-hidden />Local branches
        {open && failed && report && <span className="ml-auto text-[11px] font-normal text-neutral-400">Not refreshed</span>}
      </button>
      {open && (
        !report ? <Note>{failed ? "Not available. The list needs Canvagent's own dev server (npm run dev)." : "Reading…"}</Note>
        : report.state === "unregistered" ? <Note>No folder is registered for {project.name}.</Note>
        : report.state === "not-a-repository" ? <Note>{project.name} is not a Git repository.</Note>
        : report.state === "failed" ? <Note>Git could not be read in {project.name}'s folder.</Note>
        : report.branches.length + report.detached.length === 0 ? <Note>No commits yet.</Note>
        : (
          <ul className="max-h-[min(248px,36dvh)] overflow-y-auto pb-1">
            {report.branches.map((branch) => (
              <li key={branch.name} className="px-2 py-1.5" title={[branch.name, `${branch.hash} · ${branch.subject}`, branch.checkout && where(branch.checkout)].filter(Boolean).join("\n")}>
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-neutral-800">{branch.name}</span>
                  <time dateTime={new Date(branch.committed * 1000).toISOString()} className="shrink-0 text-[11px] text-neutral-400 tabular-nums">{age(branch.committed, now)}</time>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-4 text-neutral-400">
                  {branch.checkout && <CheckoutMark checkout={branch.checkout} />}
                  <span className="truncate">{branch.subject}</span>
                </div>
              </li>
            ))}
            {report.detached.map((checkout) => (
              <li key={checkout.path} className="px-2 py-1.5" title={where(checkout)}>
                <div className="truncate text-neutral-800">Detached at {checkout.hash}</div>
                <div className="mt-0.5 flex items-center text-[11px] leading-4 text-neutral-400"><CheckoutMark checkout={checkout} /></div>
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
}

const where = (checkout: Checkout) => checkout.missing ? `Checked out in ${checkout.path}, which is missing` : `Checked out in ${checkout.path}`;

/** The folder a branch is checked out in. Only such a branch can be behind a preview. */
function CheckoutMark({ checkout }: { checkout: Checkout }) {
  const Icon = checkout.missing ? FolderX : Folder;
  return (
    <span className="flex shrink-0 items-center gap-1 text-neutral-600">
      <Icon size={11} aria-hidden /><span className="sr-only">Checked out in </span>{folderName(checkout.path)}{checkout.missing && " (missing)"}
    </span>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="px-2 pt-0.5 pb-2 leading-relaxed text-neutral-500">{children}</p>;
}
