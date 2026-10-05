/**
 * A project's local branches, read for `/__atelier/branches/<project id>`
 * (`server/handler.ts`). It runs two git commands that only read, in the
 * folder the project list names, and nothing else.
 */
import { execFile, type ChildProcess } from "node:child_process";
import { dirname } from "node:path";
import { REFS_FORMAT, listBranches, parseRefs, parseWorktrees, type BranchReport } from "../src/branches.ts";
import type { Project } from "../src/projects.ts";
import { refusal, type Answer, type EndpointRequest } from "./request.ts";

const running = new Set<ChildProcess>();

/** Used only when the owning Mac helper exits. Never touches another server's processes. */
export async function cancelBranchReads(): Promise<void> {
  await Promise.all([...running].map(child => new Promise<void>(resolve => {
    const force = setTimeout(() => child.kill("SIGKILL"), 500);
    child.once("close", () => { clearTimeout(force); resolve(); });
    child.kill("SIGTERM");
  })));
}

/** Runs git in a folder and returns what it printed. */
export type Git = (repo: string, args: string[]) => Promise<string>;

const git: Git = (repo, args) => new Promise((resolve, reject) => {
  const child = execFile("git", args, {
    cwd: repo, timeout: 3000, maxBuffer: 1024 * 1024,
    // Stay inside the named folder (never a repository above it), take no locks, and keep git's messages in English.
    env: { ...process.env, GIT_CEILING_DIRECTORIES: dirname(repo), GIT_OPTIONAL_LOCKS: "0", LC_ALL: "C" },
  }, (error, stdout, stderr) => { running.delete(child); if (error) reject(new Error(stderr || error.message)); else resolve(stdout); });
  running.add(child);
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

/**
 * Decides what a request gets. Only Atelier's own page may ask: a framed
 * preview is another origin, and is refused before git runs. The address
 * carries a listed id, never a folder.
 */
export async function answer(request: EndpointRequest, projects: readonly Project[], read: (repo: string) => Promise<BranchReport>): Promise<Answer<BranchReport>> {
  const refused = refusal(request);
  if (refused) return refused;
  const project = projects.find((entry) => request.path === `/${entry.id}`);
  if (!project) return { status: 404, body: { error: "No such project." } };
  if (!project.repo) return { status: 200, body: { state: "unregistered" } };
  return { status: 200, body: await read(project.repo) };
}
