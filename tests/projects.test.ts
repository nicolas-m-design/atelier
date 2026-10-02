import { describe, expect, it, vi } from "vitest";
import { createHandler } from "../server/handler";
import { projectsFile, readProjects, type Read } from "../server/projects";
import type { BranchReport } from "../src/branches";
import { parseProject, parseProjectList, withOverrides } from "../src/projects";

const FILE = "/home/someone/.config/agent-atelier/projects.json";

/** A disk holding only the files named; anything else is missing, as the real one would say. */
function disk(files: Record<string, unknown>): Read {
  return async (path) => {
    if (!(path in files)) throw Object.assign(new Error(`ENOENT: no such file, open '${path}'`), { code: "ENOENT" });
    const content = files[path];
    return typeof content === "string" ? content : JSON.stringify(content);
  };
}

describe("project list file", () => {
  it("is found with the user's settings, unless another file is named", () => {
    expect(projectsFile({ XDG_CONFIG_HOME: "/cfg" })).toBe("/cfg/agent-atelier/projects.json");
    expect(projectsFile({ ATELIER_PROJECTS: "/elsewhere/list.json", XDG_CONFIG_HOME: "/cfg" })).toBe("/elsewhere/list.json");
    expect(projectsFile({})).toMatch(/\/\.config\/agent-atelier\/projects\.json$/);
  });

  it("is an empty list without a problem when it does not exist yet", async () => {
    expect(await readProjects(FILE, disk({}))).toEqual({ file: FILE, projects: [], problems: [] });
  });

  it("says why when it cannot be used at all", async () => {
    expect((await readProjects(FILE, disk({ [FILE]: "{ not json" }))).problems).toEqual(["The project list is not valid JSON."]);
    expect((await readProjects(FILE, disk({ [FILE]: { projects: "palier" } }))).problems).toEqual(['The project list needs a "projects" list.']);
    expect((await readProjects(FILE, disk({ [FILE]: [] }))).problems).toHaveLength(1);
    const denied = await readProjects(FILE, async () => { throw Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" }); });
    expect(denied.projects).toEqual([]);
    expect(denied.problems[0]).toMatch(/could not be read: EACCES/);
  });

  it("takes what a folder entry leaves out from the project's own package.json", async () => {
    const list = await readProjects(FILE, disk({
      [FILE]: { projects: ["/repos/palier"] },
      "/repos/palier/package.json": { name: "palier", atelier: { origin: "http://localhost:3100", start: "npm run dev" } },
    }));
    expect(list.problems).toEqual([]);
    expect(list.projects).toEqual([{ id: "palier", name: "Palier", origin: "http://localhost:3100", repo: "/repos/palier", start: { cwd: "/repos/palier", command: "npm run dev" } }]);
  });

  it("lets the entry decide over the package.json, and works without the field", async () => {
    const list = await readProjects(FILE, disk({
      [FILE]: { projects: [
        { repo: "/repos/palier", origin: "http://localhost:3101/", name: "Palier (worktree)" },
        { repo: "/repos/marvin", origin: "http://localhost:3210", start: "npm run dev" },
        { repo: "/repos/scoped" },
        { id: "remote", origin: "http://192.168.1.20:4000" },
      ] },
      "/repos/palier/package.json": { name: "palier", atelier: { origin: "http://localhost:3100", start: "npm run dev" } },
      "/repos/marvin/package.json": { name: "marvin" },
      "/repos/scoped/package.json": { name: "@studio/design-agency" },
    }));
    expect(list.problems).toEqual([]);
    expect(list.projects).toEqual([
      { id: "palier", name: "Palier (worktree)", origin: "http://localhost:3101", repo: "/repos/palier", start: { cwd: "/repos/palier", command: "npm run dev" } },
      { id: "marvin", name: "Marvin", origin: "http://localhost:3210", repo: "/repos/marvin", start: { cwd: "/repos/marvin", command: "npm run dev" } },
      { id: "design-agency", name: "Design-agency", origin: null, repo: "/repos/scoped" },
      { id: "remote", name: "Remote", origin: "http://192.168.1.20:4000" },
    ]);
  });

  it("skips an entry it cannot use, says which and why, and keeps the rest", async () => {
    const list = await readProjects(FILE, disk({
      [FILE]: { projects: [
        "/repos/palier",
        "/repos/palier",
        "relative/folder",
        "/repos/unnamed",
        { id: "Bad Id", origin: "http://localhost:1" },
        { id: "path", origin: "http://localhost:1/preview" },
        { id: "script", origin: "javascript:alert(1)" },
        { id: "loose", start: "npm run dev" },
        42,
      ] },
      "/repos/palier/package.json": { name: "palier" },
    }));
    expect(list.projects.map((project) => project.id)).toEqual(["palier"]);
    expect(list.problems).toEqual([
      'Entry 2: the id "palier" is used twice.',
      "Entry 3: the repo must be an absolute folder.",
      "Entry 4: it needs an id, or a repo whose package.json has a name.",
      "Entry 5: the id must be lowercase letters, digits and hyphens.",
      "Entry 6: the origin must be an address such as http://localhost:3000, with no path.",
      "Entry 7: the origin must be an address such as http://localhost:3000, with no path.",
      "Entry 8: the start command must be text, and needs a repo to run in.",
      "Entry 9: an entry must be a folder or an object.",
    ]);
  });
});

describe("project list in the page", () => {
  const palier = { id: "palier", name: "Palier", origin: "http://localhost:3100", repo: "/repos/palier", start: { cwd: "/repos/palier", command: "npm run dev" } };

  it("checks what the server sent", () => {
    expect(parseProjectList({ file: FILE, projects: [palier], problems: ["Entry 2: x.", 3] })).toEqual({ file: FILE, projects: [palier], problems: ["Entry 2: x."] });
    expect(() => parseProjectList({ projects: [palier] })).toThrow();
    expect(() => parseProjectList({ file: FILE, projects: [{ ...palier, origin: "//evil.example" }] })).toThrow(/origin/);
    expect(() => parseProject({ ...palier, start: "npm run dev" })).toThrow(/start/);
    expect(parseProject({ id: "bare", name: "Bare" })).toEqual({ id: "bare", name: "Bare", origin: null });
  });

  it("points a project at another address, without the folder and command of the listed one", () => {
    const others = [palier, { id: "design-agency", name: "Design agency", origin: null }];
    expect(withOverrides(others, {})).toEqual(others);
    expect(withOverrides(others, { VITE_ORIGIN_PALIER: "http://localhost:3101/", VITE_ORIGIN_DESIGN_AGENCY: "http://localhost:3300", VITE_ORIGIN_MARVIN: "http://localhost:1" })).toEqual([
      { id: "palier", name: "Palier", origin: "http://localhost:3101" },
      { id: "design-agency", name: "Design agency", origin: "http://localhost:3300" },
    ]);
  });
});

describe("server endpoints", () => {
  const read = disk({ [FILE]: { projects: [{ repo: "/repos/palier", origin: "http://localhost:3100" }, { id: "loose", origin: null }] }, "/repos/palier/package.json": { name: "palier" } });
  const git = vi.fn(async (_repo: string): Promise<BranchReport> => ({ state: "listed", branches: [], detached: [] }));
  const handle = createHandler({ file: FILE, env: { VITE_ORIGIN_PALIER: "http://localhost:3101" }, read, git });
  const ask = (url: string, request: { method?: string; site?: string } = {}) => handle({ method: "GET", site: "same-origin", url, ...request });

  it("leaves every other address to the page's own server", async () => {
    for (const url of ["/", "/src/main.tsx", "/atelier.json", "/__atelier", "/__atelier/", "/__atelier/branches", "/__atelier/projects/palier", "/__atelier/other"]) {
      expect(await ask(url), url).toBeNull();
    }
  });

  it("answers the project list, with address overrides applied", async () => {
    const result = await ask("/__atelier/projects?now");
    expect(result).toEqual({ status: 200, body: { file: FILE, problems: [], projects: [{ id: "palier", name: "Palier", origin: "http://localhost:3101" }, { id: "loose", name: "Loose", origin: null }] } });
  });

  it("reads branches in the listed folder, even for an overridden project", async () => {
    git.mockClear();
    expect(await ask("/__atelier/branches/palier")).toEqual({ status: 200, body: { state: "listed", branches: [], detached: [] } });
    expect(git).toHaveBeenCalledExactlyOnceWith("/repos/palier");
    expect(await ask("/__atelier/branches/loose")).toEqual({ status: 200, body: { state: "unregistered" } });
    expect((await ask("/__atelier/branches/unknown"))?.status).toBe(404);
  });

  it("refuses other pages and other methods before reading anything", async () => {
    const untouched = vi.fn(read);
    const guarded = createHandler({ file: FILE, read: untouched, git });
    git.mockClear();
    for (const url of ["/__atelier/projects", "/__atelier/branches/palier"]) {
      expect((await guarded({ method: "GET", site: "cross-site", url }))?.status).toBe(403);
      expect((await guarded({ method: "GET", site: undefined, url }))?.status).toBe(403);
      expect((await guarded({ method: "POST", site: "same-origin", url }))?.status).toBe(405);
    }
    expect(untouched).not.toHaveBeenCalled();
    expect(git).not.toHaveBeenCalled();
  });
});
