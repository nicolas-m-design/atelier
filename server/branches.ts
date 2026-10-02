/**
 * The one piece of Atelier that runs outside the browser: the dev server
 * answers `/__atelier/branches/<project id>` with that project's local
 * branches. It runs two git commands that only read, in the folder the
 * registry names, and nothing else. It exists only under `npm run dev`.
 */
import { execFile } from "node:child_process";
import { dirname } from "node:path";
import type { Plugin } from "vite";
import { BRANCHES_PATH, REFS_FORMAT, listBranches, parseRefs, parseWorktrees, type BranchReport } from "../src/branches.ts";
import { REGISTRY, type Project } from "../src/registry.ts";

/** Runs git in a folder and returns what it printed. */
export type Git = (repo: string, args: string[]) => Promise<string>;

const git: Git = (repo, args) => new Promise((resolve, reject) => {
  execFile("git", args, {
    cwd: repo, timeout: 3000, maxBuffer: 1024 * 1024,
    // Stay inside the named folder (never a repository above it), take no locks, and keep git's messages in English.
    env: { ...process.env, GIT_CEILING_DIRECTORIES: dirname(repo), GIT_OPTIONAL_LOCKS: "0", LC_ALL: "C" },
  }, (error, stdout, stderr) => { if (error) reject(new Error(stderr || error.message)); else resolve(stdout); });
});

export async function readBranches(repo: string, run: Git = git): Promise<BranchReport> {
  try {
    const [refs, worktrees] = await Promise.all([
      run(repo, ["for-each-ref", "refs/heads", "--count=200", "--sort=-committerdate", `--format=${REFS_FORMAT}`]),
      run(repo, ["worktree", "list", "--porcelain", "-z"]),
    ]);
    return listBranches(parseRefs(refs), parseWorktrees(worktrees));
  } catch (error) {
    return /not a git repository/i.test(String(error)) ? { state: "not-a-repository" } : { state: "failed" };
  }
}

export interface BranchRequest {
  method: string | undefined;
  /** The address after `BRANCHES_PATH`, such as `/palier`. */
  path: string;
  /** The browser's `Sec-Fetch-Site` header. A page cannot set it itself. */
  site: string | undefined;
}

/**
 * Decides what a request gets. Only Atelier's own page may ask: a framed
 * preview is another origin, and is refused before git runs. The address
 * carries a registered id, never a folder.
 */
export async function answer(request: BranchRequest, projects: readonly Project[], read: (repo: string) => Promise<BranchReport>): Promise<{ status: number; body: BranchReport | { error: string } }> {
  if (request.method !== "GET") return { status: 405, body: { error: "Only GET is answered." } };
  if (request.site !== "same-origin") return { status: 403, body: { error: "Only Atelier's own page may ask." } };
  const project = projects.find((entry) => request.path === `/${entry.id}`);
  if (!project) return { status: 404, body: { error: "No such project." } };
  if (!project.repo) return { status: 200, body: { state: "unregistered" } };
  return { status: 200, body: await read(project.repo) };
}

export function branches(projects: readonly Project[] = REGISTRY): Plugin {
  // Requests that arrive while git is running share its answer.
  const running = new Map<string, Promise<BranchReport>>();
  const read = (repo: string) => {
    let report = running.get(repo);
    if (!report) {
      report = readBranches(repo).finally(() => running.delete(repo));
      running.set(repo, report);
    }
    return report;
  };
  return {
    name: "atelier-branches",
    configureServer(server) {
      server.middlewares.use(BRANCHES_PATH, (request, response) => {
        const site = request.headers["sec-fetch-site"];
        void answer({ method: request.method, path: (request.url ?? "").split("?")[0] ?? "", site: typeof site === "string" ? site : undefined }, projects, read).then(({ status, body }) => {
          response.statusCode = status;
          response.setHeader("Content-Type", "application/json");
          response.setHeader("Cache-Control", "no-store");
          response.end(JSON.stringify(body));
        });
      });
    },
  };
}
