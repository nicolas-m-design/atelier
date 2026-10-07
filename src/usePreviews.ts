import { useCallback, useEffect, useRef, useState } from "react";
import { canRefresh, observeVisibility } from "./lifecycle";
import { newerPreview, parsePreviewSnapshot, PREVIEWS_PATH, type PreviewAction, type PreviewSnapshot } from "./previews";

export function usePreviews() {
  const [state, setState] = useState<PreviewSnapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ projectId: string; text: string } | null>(null);
  const current = useRef(state); current.current = state;
  const sequence = useRef(0), writing = useRef(false);
  const refresh = useCallback(async () => {
    if (writing.current) return;
    const ticket = ++sequence.current;
    try {
      const response = await fetch(PREVIEWS_PATH, { cache: "no-store", signal: AbortSignal.timeout(4000) });
      if (!response.ok) throw new Error();
      const next = parsePreviewSnapshot(await response.json());
      if (ticket !== sequence.current) return;
      setState(previous => newerPreview(previous, next)); setConnected(true);
    } catch { if (ticket === sequence.current) setConnected(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const wake = () => { if (canRefresh()) void refresh(); };
    const timer = setInterval(wake, 1000);
    const unobserve = observeVisibility(wake);
    window.addEventListener("focus", wake); document.addEventListener("visibilitychange", wake);
    return () => { ++sequence.current; clearInterval(timer); unobserve(); window.removeEventListener("focus", wake); document.removeEventListener("visibilitychange", wake); };
  }, [refresh]);
  const act = useCallback(async (action: PreviewAction) => {
    const snapshot = current.current;
    if (!snapshot || writing.current) return;
    writing.current = true; ++sequence.current; setPending(true); setError(null);
    try {
      const response = await fetch(PREVIEWS_PATH, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...action, instance: snapshot.instance, revision: snapshot.revision }), signal: AbortSignal.timeout(8000),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "The preview action failed.");
      const next = parsePreviewSnapshot(body);
      setState(previous => newerPreview(previous, next)); setConnected(true);
    } catch (error) { setError({ projectId: action.projectId, text: error instanceof Error ? error.message : "The preview action failed." }); }
    finally { writing.current = false; setPending(false); void refresh(); }
  }, [refresh]);
  return { state, connected, pending, error, act, refresh };
}
export type PreviewSession = ReturnType<typeof usePreviews>;
