import { useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { MANIFEST_PATH } from "../manifest";
import type { Project } from "../projects";
import type { Status } from "../status";

const host = (origin: string) => origin.replace(/^https?:\/\//, "");

/** One short line for the sidebar. */
export function statusLine(project: Project, status: Status): string {
  switch (status.state) {
    case "online": return `Live · ${host(project.origin!)}`;
    case "offline": return `Not running · ${host(project.origin!)}`;
    case "unconnected": return `No manifest · ${host(project.origin!)}`;
    case "checking": return "Checking…";
    case "empty": return "No preview yet";
  }
}

export const STATUS_DOT: Record<Status["state"], string> = {
  online: "bg-emerald-500",
  offline: "bg-neutral-400",
  unconnected: "bg-amber-500",
  checking: "bg-neutral-300",
  empty: "border border-neutral-400 bg-transparent",
};

/** Explains why a project shows no live previews, and what to do about it. */
export function StatusCard({ project, status, hasBoard, onRetry }: { project: Project; status: Status; hasBoard: boolean; onRetry(): void }) {
  const [copied, setCopied] = useState(false);
  if (status.state === "online" || status.state === "checking") return null;
  const command = project.start ? `cd ${project.start.cwd} && ${project.start.command}` : null;

  return (
    <div className={`pointer-events-none absolute inset-x-0 flex justify-center px-5 ${hasBoard ? "top-5" : "top-1/2 -translate-y-1/2"}`}>
      <section role="status" className="pointer-events-auto w-full max-w-[440px] rounded-xl border border-black/[0.08] bg-white p-5 shadow-[0_4px_16px_#0000000d]">
        {status.state === "offline" && <>
          <h2 className="text-[14px] font-semibold">{project.name} is not running</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-pretty text-neutral-600">
            Nothing answers at {host(project.origin!)}. Start its preview and this page reconnects by itself.{hasBoard && " The screens below are the last ones it listed."}
          </p>
          {command && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-neutral-100 py-1.5 pr-1.5 pl-3">
              <code className="min-w-0 flex-1 overflow-x-auto text-[12px] whitespace-nowrap text-neutral-800 select-text">{command}</code>
              <button type="button" className="tool" aria-label="Copy the start command" title="Copy"
                onClick={() => { void navigator.clipboard?.writeText(command).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }); }}>
                {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
              </button>
            </div>
          )}
        </>}
        {status.state === "unconnected" && <>
          <h2 className="text-[14px] font-semibold">{project.name} answers, but lists no screens</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-pretty text-neutral-600">
            A server is running at {host(project.origin!)}. {status.reason} The version being served may not include the Atelier connector yet; see docs/connector.md.
          </p>
        </>}
        {status.state === "empty" && <>
          <h2 className="text-[14px] font-semibold">{project.name} has no preview yet</h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-pretty text-neutral-600">
            This project is registered without a preview address. Once its app serves <code className="text-[12px]">{MANIFEST_PATH}</code> (docs/connector.md), add the address in <code className="text-[12px]">src/projects.ts</code> and its screens appear here.
          </p>
        </>}
        {status.state !== "empty" && (
          <button type="button" onClick={onRetry} className="mt-4 flex h-8 items-center gap-2 rounded-lg border border-black/10 px-3 text-[12px] font-medium hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-700"><RefreshCw size={13} aria-hidden />Check again</button>
        )}
      </section>
    </div>
  );
}
