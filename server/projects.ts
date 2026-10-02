/**
 * Reads the project list from a file on this machine, so that no project's
 * name or folder is part of Atelier's own code. Each entry is a project's
 * folder, or an object naming it; what the entry leaves out is taken from the
 * `atelier` field of that folder's `package.json`. Nothing here writes.
 */
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { parseProject, type Project, type ProjectList } from "../src/projects.ts";

/** Reads a text file. Replaced in tests. */
export type Read = (path: string) => Promise<string>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const reason = (error: unknown) => error instanceof Error ? error.message : String(error);

/** `ATELIER_PROJECTS` names another file; otherwise the list lives with the user's other settings. */
export function projectsFile(env: Record<string, string | undefined> = process.env): string {
  return env.ATELIER_PROJECTS || join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "agent-atelier", "projects.json");
}

/** What a project says about itself: its package name, and the `atelier` field of its `package.json`. */
async function declared(repo: string, read: Read): Promise<Record<string, unknown>> {
  let manifest: unknown;
  try { manifest = JSON.parse(await read(join(repo, "package.json"))); } catch { return {}; }
  if (!isRecord(manifest)) return {};
  const field = isRecord(manifest.atelier) ? manifest.atelier : {};
  // A scoped package's id is its own name, without the scope.
  return { id: typeof manifest.name === "string" ? manifest.name.replace(/^@[^/]+\//, "") : undefined, name: field.name, origin: field.origin, start: field.start };
}

async function resolveEntry(entry: unknown, read: Read): Promise<Project> {
  const given = typeof entry === "string" ? { repo: entry } : entry;
  if (!isRecord(given)) throw new Error("an entry must be a folder or an object");
  const repo = given.repo;
  if (repo !== undefined && (typeof repo !== "string" || !isAbsolute(repo))) throw new Error("the repo must be an absolute folder");
  const own = repo ? await declared(repo, read) : {};
  const id = given.id ?? own.id;
  if (typeof id !== "string") throw new Error("it needs an id, or a repo whose package.json has a name");
  const start = given.start ?? own.start;
  if (start !== undefined && (typeof start !== "string" || !repo)) throw new Error("the start command must be text, and needs a repo to run in");
  return parseProject({
    id,
    name: given.name ?? own.name ?? id.slice(0, 1).toUpperCase() + id.slice(1),
    origin: given.origin ?? own.origin,
    repo,
    start: start === undefined ? undefined : { cwd: repo, command: start },
  });
}

/**
 * The list, with a reason for each entry that could not be used. A missing
 * file is an empty list, not a problem: nothing has been added yet.
 */
export async function readProjects(file: string, read: Read = (path) => readFile(path, "utf8")): Promise<ProjectList> {
  const none = (...problems: string[]): ProjectList => ({ file, projects: [], problems });
  let text: string;
  try { text = await read(file); } catch (error) {
    return (error as NodeJS.ErrnoException | null)?.code === "ENOENT" ? none() : none(`The project list could not be read: ${reason(error)}.`);
  }
  let data: unknown;
  try { data = JSON.parse(text); } catch { return none("The project list is not valid JSON."); }
  if (!isRecord(data) || !Array.isArray(data.projects)) return none('The project list needs a "projects" list.');

  const projects: Project[] = [];
  const problems: string[] = [];
  for (const [index, entry] of data.projects.entries()) {
    try {
      const project = await resolveEntry(entry, read);
      if (projects.some((other) => other.id === project.id)) throw new Error(`the id "${project.id}" is used twice`);
      projects.push(project);
    } catch (error) {
      problems.push(`Entry ${index + 1}: ${reason(error)}.`);
    }
  }
  return { file, projects, problems };
}
