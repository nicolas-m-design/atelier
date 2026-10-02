/**
 * The project list, kept in a file on this machine so that no project's name
 * or folder is part of Atelier's own code. Each entry is a project's folder,
 * or an object naming it; what the entry leaves out is taken from the
 * `atelier` field of that folder's `package.json`. Reading never writes; the
 * one thing that does is `addProject`, for the `add` command.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";
import { parseProject, type Project, type ProjectList } from "../src/projects.ts";

/** Reads a text file. Replaced in tests. */
export type Read = (path: string) => Promise<string>;
/** Writes a text file, creating its folder. Replaced in tests. */
export type Write = (path: string, text: string) => Promise<void>;

const readText: Read = (path) => readFile(path, "utf8");
const writeText: Write = async (path, text) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, text); };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const reason = (error: unknown) => error instanceof Error ? error.message : String(error);
const isMissing = (error: unknown) => (error as NodeJS.ErrnoException | null)?.code === "ENOENT";
/** The folder an entry names, whichever way it is written. */
const repoOf = (entry: unknown) => typeof entry === "string" ? entry : isRecord(entry) && typeof entry.repo === "string" ? entry.repo : undefined;

/** `ATELIER_PROJECTS` names another file; otherwise the list lives with the user's other settings. */
export function projectsFile(env: Record<string, string | undefined> = process.env): string {
  return env.ATELIER_PROJECTS || join(env.XDG_CONFIG_HOME || join(homedir(), ".config"), "agent-atelier", "projects.json");
}

async function packageOf(repo: string, read: Read): Promise<Record<string, unknown> | null> {
  try {
    const manifest: unknown = JSON.parse(await read(join(repo, "package.json")));
    return isRecord(manifest) ? manifest : null;
  } catch {
    return null;
  }
}

/** What a project says about itself: its package name, and the `atelier` field of its `package.json`. */
async function declared(repo: string, read: Read): Promise<Record<string, unknown>> {
  const manifest = await packageOf(repo, read);
  if (!manifest) return {};
  const field = isRecord(manifest.atelier) ? manifest.atelier : {};
  // A scoped package's id is its own name, without the scope.
  return { id: typeof manifest.name === "string" ? manifest.name.replace(/^@[^/]+\//, "") : undefined, name: field.name, origin: field.origin, start: field.start };
}

/**
 * Whether a folder is a project that expects to be shown: it describes itself
 * in an `atelier` field, or has this package among its dependencies.
 */
export async function isAtelierProject(folder: string, read: Read = readText): Promise<boolean> {
  const manifest = await packageOf(folder, read);
  if (!manifest) return false;
  const depends = (field: unknown) => isRecord(field) && "agent-atelier" in field;
  return isRecord(manifest.atelier) || depends(manifest.dependencies) || depends(manifest.devDependencies);
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

/** The file's entries. A missing file has none; a file that cannot be used has none and a reason. */
async function readEntries(file: string, read: Read): Promise<{ data: Record<string, unknown> & { projects: unknown[] }; problem?: string }> {
  const none = (problem?: string) => ({ data: { projects: [] }, problem });
  let text: string;
  try { text = await read(file); } catch (error) {
    return isMissing(error) ? none() : none(`The project list could not be read: ${reason(error)}.`);
  }
  let data: unknown;
  try { data = JSON.parse(text); } catch { return none("The project list is not valid JSON."); }
  if (!isRecord(data) || !Array.isArray(data.projects)) return none('The project list needs a "projects" list.');
  return { data: { ...data, projects: data.projects } };
}

/**
 * The list, with a reason for each entry that could not be used. A missing
 * file is an empty list, not a problem: nothing has been added yet. `extra`
 * is a folder shown after the listed ones although the file does not name it.
 */
export async function readProjects(file: string, read: Read = readText, extra?: string): Promise<ProjectList> {
  const { data, problem } = await readEntries(file, read);
  const entries = extra && !data.projects.some((entry) => repoOf(entry) === extra) ? [...data.projects, extra] : data.projects;

  const projects: Project[] = [];
  const problems = problem ? [problem] : [];
  for (const [index, entry] of entries.entries()) {
    try {
      const project = await resolveEntry(entry, read);
      if (projects.some((other) => other.id === project.id)) throw new Error(`the id "${project.id}" is used twice`);
      projects.push(project);
    } catch (error) {
      problems.push(`${index < data.projects.length ? `Entry ${index + 1}` : "This folder"}: ${reason(error)}.`);
    }
  }
  return { file, projects, problems };
}

export interface NewEntry {
  repo: string;
  origin?: string;
  start?: string;
  /** Needed when the folder has no `package.json` to take a name from. */
  id?: string;
  name?: string;
}

/**
 * Appends a project to the file, creating it when it does not exist. Returns
 * null when the folder is already listed. A file that cannot be used is never
 * overwritten, and nothing is written unless the new entry is usable.
 */
export async function addProject(file: string, entry: NewEntry, read: Read = readText, write: Write = writeText): Promise<Project | null> {
  const { data, problem } = await readEntries(file, read);
  if (problem) throw new Error(`${problem} Fix or remove ${file} first; nothing was written.`);
  if (data.projects.some((listed) => repoOf(listed) === entry.repo)) return null;

  // Only these are stored, whatever else the caller's object carries, and only those that were given.
  const { repo, id, name, origin, start } = entry;
  const given = Object.fromEntries(Object.entries({ id, name, origin, start }).filter(([, value]) => value !== undefined));
  if (id === undefined && typeof (await declared(repo, read)).id !== "string") throw new Error(`${repo} has no package.json with a name to take an id from. Give it one with --id. Nothing was written.`);
  let project: Project;
  try { project = await resolveEntry({ repo, ...given }, read); } catch (error) {
    throw new Error(`${repo} cannot be added: ${reason(error)}. Nothing was written.`);
  }
  const listed = await readProjects(file, read);
  if (listed.projects.some((other) => other.id === project.id)) throw new Error(`Another listed project already has the id "${project.id}". Nothing was written.`);

  // A bare folder is enough when the project describes itself; otherwise the entry carries what was given.
  const stored = Object.keys(given).length === 0 ? repo : { repo, ...given };
  await write(file, `${JSON.stringify({ ...data, projects: [...data.projects, stored] }, null, 2)}\n`);
  return project;
}
