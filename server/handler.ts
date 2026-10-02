/**
 * Atelier's own endpoints, free of any server framework: the project list and
 * each project's local branches. The dev server mounts this (`server/vite.ts`),
 * and so does the packaged command (`server/serve.ts`).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { BRANCHES_PATH, type BranchReport } from "../src/branches.ts";
import { PROJECTS_PATH, withOverrides, type Overrides, type ProjectList } from "../src/projects.ts";
import { answer, readBranches } from "./branches.ts";
import { readProjects, type Read } from "./projects.ts";
import { refusal, type Answer } from "./request.ts";

export interface ServerOptions {
  /** The file the project list is read from. */
  file: string;
  /** Another preview address for a project, by its id. */
  overrides?: Overrides;
  /** A folder shown as a project for this run although the list does not name it. */
  extra?: string;
  read?: Read;
  git?: (repo: string) => Promise<BranchReport>;
}

type Request = { method: string | undefined; url: string | undefined; site: string | undefined };

/** Answers an address under `/__atelier/`, or returns null for any other, which is not Atelier's to answer. */
export function createHandler({ file, overrides = () => undefined, extra, read, git = readBranches }: ServerOptions): (request: Request) => Promise<Answer<ProjectList | BranchReport> | null> {
  // Requests that arrive while git is running share its answer.
  const running = new Map<string, Promise<BranchReport>>();
  const branches = (repo: string) => {
    let report = running.get(repo);
    if (!report) {
      report = git(repo).finally(() => running.delete(repo));
      running.set(repo, report);
    }
    return report;
  };

  return async ({ method, url, site }) => {
    const path = (url ?? "").split("?")[0] ?? "";
    if (path !== PROJECTS_PATH && !path.startsWith(`${BRANCHES_PATH}/`)) return null;
    const refused = refusal({ method, site });
    if (refused) return refused;
    // The file is read on every request: it is small, and an edit shows on the next one.
    const list = await readProjects(file, read, extra);
    if (path === PROJECTS_PATH) return { status: 200, body: withOverrides(list, overrides) };
    // Branches are read in the listed folder, whatever address the preview is overridden to.
    return answer({ method, site, path: path.slice(BRANCHES_PATH.length) }, list.projects, branches);
  };
}

/** The same handler as a Node request listener. `next` is called for addresses that are not Atelier's. */
export function listener(options: ServerOptions): (request: IncomingMessage, response: ServerResponse, next: () => void) => void {
  const handle = createHandler(options);
  return (request, response, next) => {
    const site = request.headers["sec-fetch-site"];
    void handle({ method: request.method, url: request.url, site: typeof site === "string" ? site : undefined }).then((result) => {
      if (!result) return next();
      response.statusCode = result.status;
      response.setHeader("Content-Type", "application/json");
      response.setHeader("Cache-Control", "no-store");
      response.end(JSON.stringify(result.body));
    }, () => {
      response.statusCode = 500;
      response.end();
    });
  };
}
