import { useEffect, useState } from "react";
import { PROJECTS_PATH, parseProjectList, type ProjectList } from "./projects";

export type LoadedProjects =
  | { state: "loading" }
  | ({ state: "ready" } & ProjectList)
  /** Nothing answers at the endpoint: this copy of the page has no server of its own behind it. */
  | { state: "unavailable" };

async function fetchProjects(): Promise<ProjectList> {
  const response = await fetch(PROJECTS_PATH, { cache: "no-store", signal: AbortSignal.timeout(5000) });
  // Without Atelier's server, the address answers 200 with Atelier's own page.
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("no project endpoint");
  return parseProjectList(await response.json());
}

/** Reads the project list once, when the page opens. A change to the file shows after a reload. */
export function useProjects(): LoadedProjects {
  const [loaded, setLoaded] = useState<LoadedProjects>({ state: "loading" });

  useEffect(() => {
    let current = true;
    void fetchProjects().then(
      (list) => {
        if (!current) return;
        // With projects on screen there is no place for these; without any, the page shows them.
        if (list.projects.length > 0) for (const problem of list.problems) console.warn(`Atelier project list: ${problem}`);
        setLoaded({ state: "ready", ...list });
      },
      () => { if (current) setLoaded({ state: "unavailable" }); },
    );
    return () => { current = false; };
  }, []);

  return loaded;
}
