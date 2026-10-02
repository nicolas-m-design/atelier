import type { LoadedProjects } from "../useProjects";

const EXAMPLE = `{
  "projects": [
    { "repo": "/path/to/project", "origin": "http://localhost:3000", "start": "npm run dev" }
  ]
}`;

/** Shown in place of the workspace while there is no project to show, with what to do about it. */
export function NoProjects({ loaded }: { loaded: Exclude<LoadedProjects, { state: "loading" }> }) {
  return (
    <main className="flex h-dvh items-center justify-center px-5">
      <section role="status" className="w-full max-w-[520px] rounded-xl border border-black/[0.08] bg-white p-5 shadow-[0_4px_16px_#0000000d]">
        {loaded.state === "unavailable" ? <>
          <h1 className="text-[14px] font-semibold">The project list is not available</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-pretty text-neutral-600">
            Atelier's own server reads it from a file on this machine, and nothing answered. Start Atelier with <code className="text-[12px]">npm run dev</code> and reload this page.
          </p>
        </> : <>
          <h1 className="text-[14px] font-semibold">No projects yet</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-pretty text-neutral-600">
            Atelier reads its projects from <code className="text-[12px] break-all select-text">{loaded.file}</code>. List each project there, then reload this page:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-neutral-100 px-3 py-2 text-[12px] leading-relaxed text-neutral-800 select-text">{EXAMPLE}</pre>
          {loaded.problems.length > 0 && (
            <ul className="mt-3 space-y-1 text-[13px] leading-relaxed text-pretty text-neutral-800">
              {loaded.problems.map((problem) => <li key={problem}>{problem}</li>)}
            </ul>
          )}
        </>}
      </section>
    </main>
  );
}
