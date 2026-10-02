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
    let current = true;
    const read = () => {
      void fetchBranches(id).then(
        (next) => { if (current) { setReport(next); setFailed(false); } },
        () => { if (current) setFailed(true); },
      );
    };
    read();
    window.addEventListener("focus", read);
    return () => { current = false; window.removeEventListener("focus", read); };
  }, [id, open]);

  return { report, failed };
}
