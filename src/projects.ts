/**
 * The projects Atelier shows, as plain data. The list is not part of the page:
 * Atelier's server reads it from a file on this machine (`server/projects.ts`)
 * and the page asks for it at `PROJECTS_PATH`. Everything about a project's
 * screens comes from the manifest the project serves itself (docs/connector.md).
 */

export interface Project {
  id: string;
  name: string;
  /** Where the project's preview server answers, or null while it has none. */
  origin: string | null;
  /** How to start the preview by hand. Atelier shows this; it never runs it. */
  start?: { cwd: string; command: string };
  /** The project's main folder, where its local branches are read from. Atelier never writes there. */
  repo?: string;
  /** Only capability is public; executable recipes and environment stay on the server. */
  canPreview?: boolean;
}

/** What the server answers at `PROJECTS_PATH`. */
export interface ProjectList {
  /** The file the list was read from, so the page can say where to add a project. */
  file: string;
  projects: Project[];
  /** Why the file, or one of its entries, could not be used. */
  problems: string[];
}

/** Where Atelier's server answers with the project list. */
export const PROJECTS_PATH = "/__atelier/projects";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 200;
/** An id appears in addresses, saved state and override names, so it stays plain. */
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** A preview address: a scheme, a host and a port, nothing after them. */
export function parseOrigin(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  let url: URL | null = null;
  try { if (typeof value === "string") url = new URL(value); } catch { /* reported below */ }
  if (!url || !/^https?:$/.test(url.protocol) || url.pathname !== "/" || url.search || url.hash) throw new Error("the origin must be an address such as http://localhost:3000, with no path");
  return url.origin;
}

/** Returns a checked project, or throws with the first problem found. */
export function parseProject(input: unknown): Project {
  if (!isRecord(input)) throw new Error("a project must be an object");
  if (typeof input.id !== "string" || !ID.test(input.id)) throw new Error("the id must be lowercase letters, digits and hyphens");
  if (!isText(input.name)) throw new Error("the name must be a short non-empty string");
  const project: Project = { id: input.id, name: input.name, origin: parseOrigin(input.origin) };
  if (input.repo !== undefined) {
    if (typeof input.repo !== "string" || !input.repo) throw new Error("the repo must be a folder");
    project.repo = input.repo;
  }
  if (input.start !== undefined) {
    if (!isRecord(input.start) || typeof input.start.cwd !== "string" || !isText(input.start.command)) throw new Error("the start command must name a folder and a command");
    project.start = { cwd: input.start.cwd, command: input.start.command };
  }
  if (input.canPreview === true) project.canPreview = true;
  return project;
}

/** Checks what the server sent. Atelier's page trusts nothing it did not check. */
export function parseProjectList(input: unknown): ProjectList {
  if (!isRecord(input) || typeof input.file !== "string" || !Array.isArray(input.projects)) throw new Error("not a project list");
  return {
    file: input.file,
    projects: input.projects.map(parseProject),
    problems: Array.isArray(input.problems) ? input.problems.filter((problem): problem is string => typeof problem === "string") : [],
  };
}

/** Looks up another preview address for a project, by its id. Anything but a non-empty string means none. */
export type Overrides = (id: string) => unknown;

/** The dev server's lookup: `VITE_ORIGIN_<ID>` in `.env.local`, with hyphens in the id written as underscores. */
export const envOverrides = (env: Record<string, unknown>): Overrides => (id) => env[`VITE_ORIGIN_${id.toUpperCase().replaceAll("-", "_")}`];

/**
 * Points a project at another address, such as a worktree's preview. The
 * start command and the folder belong to the listed address, so an overridden
 * project shows neither. An override that is not an address is reported and
 * the listed one kept.
 */
export function withOverrides(list: ProjectList, override: Overrides): ProjectList {
  const problems = [...list.problems];
  const projects = list.projects.map((entry) => {
    const address = override(entry.id);
    if (typeof address !== "string" || !address) return entry;
    try {
      return { id: entry.id, name: entry.name, origin: parseOrigin(address), ...(entry.canPreview ? { canPreview: true } : {}) };
    } catch {
      problems.push(`The address override for "${entry.id}" is not an address such as http://localhost:3000; the listed one is used.`);
      return entry;
    }
  });
  return { ...list, projects, problems };
}
