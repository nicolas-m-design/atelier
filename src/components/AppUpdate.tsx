import { useEffect, useState } from "react";
import { ArrowUpCircle } from "lucide-react";

/** Host-to-page status only. Browser mode has no update control. */
export function AppUpdate() {
  const read = () => document.documentElement.dataset.atelierUpdate;
  const [status, setStatus] = useState(read);
  useEffect(() => {
    const changed = () => setStatus(read());
    window.addEventListener("atelier:update", changed);
    changed();
    return () => window.removeEventListener("atelier:update", changed);
  }, []);
  if (status !== "available" && status !== "updating") return null;
  return <div className="mt-auto shrink-0 border-t border-black/[0.07] p-3 text-[12px] leading-[18px]">
    {status === "updating"
      ? <p role="status" className="flex min-h-10 items-center justify-center gap-2 rounded-md bg-neutral-200 px-3 text-neutral-600"><ArrowUpCircle size={16} aria-hidden />Updating Atelier…</p>
      : <a href="/__atelier/update" className="flex min-h-10 items-center justify-center gap-2 rounded-md bg-neutral-900 px-3 text-white hover:bg-neutral-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-700"><ArrowUpCircle size={16} aria-hidden />Update available</a>}
  </div>;
}
