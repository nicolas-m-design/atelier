/**
 * A project's local branches, as the sidebar lists them. Atelier's dev server
 * runs git (`server/branches.ts`); everything here is plain text handling, so
 * it never touches a repository and can be checked without one.
 */

/** Where the dev server answers, followed by `/<project id>`. */
export const BRANCHES_PATH = "/__atelier/branches";

/** One branch per line, fields separated by NUL: a commit subject may hold any other character. */
export const REFS_FORMAT = "%(refname)%00%(objectname:short)%00%(committerdate:unix)%00%(contents:subject)";

export interface Checkout {
  path: string;
  /** Git still lists this worktree, but its folder is gone. */
  missing: boolean;
}

export interface Branch {
  name: string;
  hash: string;
  subject: string;
  /** When its last commit was made, in Unix seconds. */
  committed: number;
  /** The worktree it is checked out in, if any. A preview can only be served from one of these. */
  checkout?: Checkout;
}

/** A worktree on no branch. It is listed by itself, never under a branch that happens to share its commit. */
export interface Detached extends Checkout {
  hash: string;
}

export type BranchReport =
  /** No branches means a repository without a commit yet. */
  | { state: "listed"; branches: Branch[]; detached: Detached[] }
  /** The registry names no folder for this project. */
  | { state: "unregistered" }
  | { state: "not-a-repository" }
  /** Git could not be run, or did not finish. */
  | { state: "failed" };

export type Ref = Omit<Branch, "checkout">;

export interface Worktree {
  path: string;
  head: string;
  /** The full ref, such as `refs/heads/main`, or null when detached or bare. */
  branch: string | null;
  bare: boolean;
  missing: boolean;
}

const HEADS = "refs/heads/";

/** Reads `git for-each-ref refs/heads --format=REFS_FORMAT`, skipping any line that is not a branch. */
export function parseRefs(output: string): Ref[] {
  return output.split("\n").flatMap((line): Ref[] => {
    const [ref, hash, committed, subject] = line.split("\0");
    if (!ref?.startsWith(HEADS) || !hash || !committed || !/^\d+$/.test(committed)) return [];
    return [{ name: ref.slice(HEADS.length), hash, subject: subject ?? "", committed: Number(committed) }];
  });
}

/** Reads `git worktree list --porcelain -z`: NUL-ended lines, and an empty line between worktrees. */
export function parseWorktrees(output: string): Worktree[] {
  return output.split("\0\0").flatMap((record): Worktree[] => {
    const fields = new Map(record.split("\0").filter(Boolean).map((line) => {
      const space = line.indexOf(" ");
      return space < 0 ? [line, ""] as const : [line.slice(0, space), line.slice(space + 1)] as const;
    }));
    const path = fields.get("worktree");
    if (!path) return [];
    return [{ path, head: fields.get("HEAD") ?? "", branch: fields.get("branch") ?? null, bare: fields.has("bare"), missing: fields.has("prunable") }];
  });
}

const MAINLINE = new Set(["main", "master"]);

/** Joins branches to the worktrees that hold them. The main line comes first; the rest keep git's order. */
export function listBranches(refs: readonly Ref[], worktrees: readonly Worktree[]): BranchReport {
  const branches = refs.map((ref): Branch => {
    const worktree = worktrees.find((entry) => entry.branch === HEADS + ref.name);
    return worktree ? { ...ref, checkout: { path: worktree.path, missing: worktree.missing } } : { ...ref };
  });
  const detached = worktrees
    .filter((entry) => entry.branch === null && !entry.bare && entry.head)
    .map((entry): Detached => ({ path: entry.path, missing: entry.missing, hash: entry.head.slice(0, 7) }));
  return { state: "listed", branches: [...branches.filter((branch) => MAINLINE.has(branch.name)), ...branches.filter((branch) => !MAINLINE.has(branch.name))], detached };
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isCheckout = (value: unknown): value is Checkout => isRecord(value) && typeof value.path === "string" && typeof value.missing === "boolean";

/** Checks what the browser received. Anything else, such as the page Vite serves for an unknown address, throws. */
export function parseReport(input: unknown): BranchReport {
  if (!isRecord(input)) throw new Error("not a branch report");
  if (input.state === "unregistered" || input.state === "not-a-repository" || input.state === "failed") return { state: input.state };
  if (input.state !== "listed" || !Array.isArray(input.branches) || !Array.isArray(input.detached)) throw new Error("not a branch report");
  return {
    state: "listed",
    branches: input.branches.map((branch: unknown): Branch => {
      if (!isRecord(branch) || typeof branch.name !== "string" || typeof branch.hash !== "string" || typeof branch.subject !== "string" || typeof branch.committed !== "number") throw new Error("not a branch report");
      const entry: Branch = { name: branch.name, hash: branch.hash, subject: branch.subject, committed: branch.committed };
      if (isCheckout(branch.checkout)) entry.checkout = { path: branch.checkout.path, missing: branch.checkout.missing };
      return entry;
    }),
    detached: input.detached.map((entry: unknown): Detached => {
      if (!isRecord(entry) || !isCheckout(entry) || typeof entry.hash !== "string") throw new Error("not a branch report");
      return { path: entry.path, missing: entry.missing, hash: entry.hash };
    }),
  };
}

const UNITS: readonly [seconds: number, label: string][] = [[365 * 86400, "y"], [30 * 86400, "mo"], [7 * 86400, "wk"], [86400, "d"], [3600, "h"], [60, "min"]];

/** How long ago a commit was made, in one short unit: "2 h", "3 d". */
export function age(committed: number, now: number): string {
  const seconds = Math.max(0, now - committed);
  for (const [size, label] of UNITS) if (seconds >= size) return `${Math.floor(seconds / size)} ${label}`;
  return "now";
}

/** A folder's own name, for a narrow sidebar. */
export const folderName = (path: string) => path.replace(/\/+$/, "").split("/").pop() || path;
