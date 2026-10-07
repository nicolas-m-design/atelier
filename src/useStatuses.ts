import { canRefresh, observeVisibility } from "./lifecycle";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Project } from "./projects";
import { checkProject, type Status } from "./status";

const targetKey = (project: Project) => JSON.stringify([project.id, project.origin]);

const ONLINE_INTERVAL = 10_000;
const WAITING_INTERVAL = 3_000;

/**
 * Checks every registered project's preview: on start, on a timer (faster
 * while something is down), when the window regains focus, and on request.
 */
export function useStatuses(projects: readonly Project[]): { statuses: Record<string, Status>; recheck: () => void } {
  const [statuses, setStatuses] = useState<Record<string, Status>>(() =>
    Object.fromEntries(projects.map((project) => [targetKey(project), project.origin ? { state: "checking" } : { state: "empty" }] as const)));
  const run = useRef(0);

  const recheck = useCallback(() => {
    const current = ++run.current;
    for (const project of projects) {
      if (!project.origin) continue;
      void checkProject(project.origin).then((status) => {
        if (current !== run.current) return;
        // Keep the same object while nothing changed, so previews do not re-render on every check.
        setStatuses((previous) => JSON.stringify(previous[targetKey(project)]) === JSON.stringify(status) ? previous : { ...previous, [targetKey(project)]: status });
      });
    }
  }, [projects]);

  const settled = projects.every((project) => !project.origin || statuses[targetKey(project)]?.state === "online");
  useEffect(() => {
    recheck();
    const timer = setInterval(() => { if (canRefresh()) recheck(); }, settled ? ONLINE_INTERVAL : WAITING_INTERVAL);
    const wake = () => { if (canRefresh()) recheck(); };
    const unobserve = observeVisibility(wake);
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      ++run.current;
      clearInterval(timer);
      unobserve();
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [recheck, settled]);

  return { statuses: Object.fromEntries(projects.map(project => [project.id, statuses[targetKey(project)] ?? { state: "checking" }])), recheck };
}
