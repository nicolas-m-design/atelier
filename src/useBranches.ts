import { canRefresh, observeVisibility } from "./lifecycle";
import { useEffect, useState } from "react";
import { BRANCHES_PATH, parseReport, type BranchReport } from "./branches";

async function fetchBranches(id: string): Promise<BranchReport> {
  const response = await fetch(`${BRANCHES_PATH}/${encodeURIComponent(id)}`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
  // Without the dev server's endpoint, the address answers 200 with Atelier's own page.
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error("no branch endpoint");
  return parseReport(await response.json());
}

/**
 * Reads a project's local branches while the list is open: when it opens and
 * each time the window regains focus. A read that fails keeps the last list
 * and says so, instead of emptying it.
 */
export function useBranches(id: string, open: boolean): { report: BranchReport | null; failed: boolean } {
  const [report, setReport] = useState<BranchReport | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    let current = true, sequence = 0;
    const read = () => {
      const ticket = ++sequence;
      void fetchBranches(id).then(
        (next) => { if (current && ticket === sequence) { setReport(next); setFailed(false); } },
        () => { if (current && ticket === sequence) setFailed(true); },
      );
    };
    read();
    const wake = () => { if (canRefresh()) read(); };
    const timer = setInterval(wake, 10_000);
    const unobserve = observeVisibility(wake);
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    return () => { current = false; clearInterval(timer); unobserve(); window.removeEventListener("focus", wake); document.removeEventListener("visibilitychange", wake); };
  }, [id, open]);

  return { report, failed };
}
