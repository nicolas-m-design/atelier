/**
 * What Atelier remembers in this browser: the open project, and each project's
 * own canvas position, zoom, selection and last good manifest. Preview frames
 * never read this; their state comes from their route alone.
 */
import { isCamera, type Camera } from "./camera";
import { parseManifest, type Manifest } from "./manifest";

export const STORAGE_KEY = "atelier:v1";

export interface ProjectView {
  camera?: Camera;
  selected?: string | null;
  /** The last manifest the project served, so its scenarios stay listed while it is stopped. */
  manifest?: Manifest;
}

export interface Saved {
  active: string | null;
  sidebar: boolean;
  projects: Record<string, ProjectView>;
}

export const EMPTY: Saved = { active: null, sidebar: true, projects: {} };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Reads saved state, dropping anything malformed instead of failing. */
export function parseSaved(raw: string | null): Saved {
  if (!raw) return structuredClone(EMPTY);
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return structuredClone(EMPTY); }
  if (!isRecord(data)) return structuredClone(EMPTY);
  const projects: Record<string, ProjectView> = {};
  for (const [id, value] of Object.entries(isRecord(data.projects) ? data.projects : {})) {
    if (!isRecord(value)) continue;
    const view: ProjectView = {};
    if (isCamera(value.camera)) view.camera = { x: value.camera.x, y: value.camera.y, zoom: value.camera.zoom };
    if (typeof value.selected === "string" || value.selected === null) view.selected = value.selected;
    try { if (value.manifest !== undefined) view.manifest = parseManifest(value.manifest); } catch { /* a stale or damaged copy is not worth keeping */ }
    projects[id] = view;
  }
  return {
    active: typeof data.active === "string" ? data.active : null,
    sidebar: typeof data.sidebar === "boolean" ? data.sidebar : true,
    projects,
  };
}

export interface Store {
  get(): Saved;
  update(change: (saved: Saved) => void): void;
  updateProject(id: string, patch: ProjectView): void;
  /** Write now; used before the page goes away. */
  flush(): void;
}

/** Keeps state in memory and writes it shortly after the last change. */
export function createStore(storage: Pick<Storage, "getItem" | "setItem"> | null, delay = 250): Store {
  let saved = parseSaved(read());
  let timer: ReturnType<typeof setTimeout> | null = null;

  function read() {
    try { return storage?.getItem(STORAGE_KEY) ?? null; } catch { return null; }
  }
  function flush() {
    if (timer) clearTimeout(timer);
    timer = null;
    try { storage?.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch { /* private mode or a full quota: carry on unsaved */ }
  }
  function update(change: (saved: Saved) => void) {
    change(saved);
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, delay);
  }
  return {
    get: () => saved,
    update,
    updateProject: (id, patch) => update((state) => { state.projects[id] = { ...state.projects[id], ...patch }; }),
    flush,
  };
}

export function browserStorage(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}
