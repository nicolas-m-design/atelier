import { parseManifest, type Manifest } from "./manifest.ts";

export const PREVIEWS_PATH = "/__atelier/previews";
export interface ActivePreview {
  id: string; projectId: string; branch: string; commit: string; origin: string; manifest: Manifest;
}
export interface PreviewSnapshot {
  instance: string;
  supported: boolean;
  revision: number;
  active: ActivePreview | null;
  candidate: { id: string; projectId: string; branch: string; phase: string } | null;
  error: string | null;
  errorProjectId: string | null;
}
export type PreviewAction = { action: "start"; projectId: string; branch: string } | { action: "stop" | "cancel"; projectId: string; runId: string };
const record = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const text = (x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length <= 1024;
export function parsePreviewSnapshot(value: unknown): PreviewSnapshot {
  if (!record(value) || !text(value.instance) || typeof value.supported !== "boolean" || !Number.isSafeInteger(value.revision)
    || (value.revision as number) < 0 || !(value.error === null || text(value.error)) || !(value.errorProjectId === null || text(value.errorProjectId))) throw new Error("Invalid preview state.");
  let active: ActivePreview | null = null;
  if (value.active !== null) {
    const a = value.active;
    if (!record(a) || !text(a.id) || !text(a.projectId) || !text(a.branch) || typeof a.commit !== "string" || !/^[a-f0-9]{40,64}$/.test(a.commit)
      || typeof a.origin !== "string" || !/^http:\/\/127\.0\.0\.1:\d+$/.test(a.origin)) throw new Error("Invalid active preview.");
    active = { id: a.id, projectId: a.projectId, branch: a.branch, commit: a.commit, origin: a.origin, manifest: parseManifest(a.manifest) };
  }
  let candidate: PreviewSnapshot["candidate"] = null;
  if (value.candidate !== null) {
    const c = value.candidate;
    if (!record(c) || !text(c.id) || !text(c.projectId) || !text(c.branch) || !text(c.phase)) throw new Error("Invalid candidate preview.");
    candidate = { id: c.id, projectId: c.projectId, branch: c.branch, phase: c.phase };
  }
  return { instance: value.instance, supported: value.supported, revision: value.revision as number, active, candidate, error: value.error as string | null, errorProjectId: value.errorProjectId as string | null };
}

/** Reject an older poll; instance changes allow a restarted server's revision to start at zero. */
export function newerPreview(previous: PreviewSnapshot | null, next: PreviewSnapshot): PreviewSnapshot {
  return previous?.instance === next.instance && previous.revision >= next.revision ? previous : next;
}
