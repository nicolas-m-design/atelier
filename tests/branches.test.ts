import { describe, expect, it, vi } from "vitest";
import { answer, readBranches, type Git } from "../server/branches";
import { age, folderName, listBranches, parseRefs, parseReport, parseWorktrees, type BranchReport } from "../src/branches";

// What git printed for Palier on 2026-10-01, NUL bytes included.
const REFS = [
  "refs/heads/codex/cal-sans-wordmark\x0077f3da4\x001790891401\x00Fix the Google Calendar logo's rendering in Safari",
  "refs/heads/claude/atelier-connector\x003444240\x001790891112\x00Hide the library's workspace navigation when framed",
  "refs/heads/codex/ui-refinements\x008701321\x001790878327\x00Strengthen neutral emphasis on the action-list header",
  "refs/heads/main\x00c552d0d\x001790878054\x00Merge current main with the repetition review reconciliation",
  "",
].join("\n");
const WORKTREES =
  "worktree /Users/nico/Sites/palier\x00HEAD 77f3da4bb2cf10f3b0b894cdd7cc16f45e4ffabf\x00branch refs/heads/codex/cal-sans-wordmark\x00\x00" +
  "worktree /Users/nico/Sites/palier-atelier\x00HEAD 34442401923de8956dca16eafee46174a433f752\x00branch refs/heads/claude/atelier-connector\x00\x00";

const listed = (report: BranchReport) => {
  if (report.state !== "listed") throw new Error(`expected a list, got ${report.state}`);
  return report;
};

describe("local branches", () => {
  it("lists branches with the main line first and each checkout on its own branch", () => {
    const { branches, detached } = listed(listBranches(parseRefs(REFS), parseWorktrees(WORKTREES)));
    expect(branches.map((branch) => branch.name)).toEqual(["main", "codex/cal-sans-wordmark", "claude/atelier-connector", "codex/ui-refinements"]);
    expect(branches[0]).toEqual({ name: "main", hash: "c552d0d", committed: 1790878054, subject: "Merge current main with the repetition review reconciliation" });
    expect(branches[1]?.checkout).toEqual({ path: "/Users/nico/Sites/palier", missing: false });
    expect(branches[2]?.checkout).toEqual({ path: "/Users/nico/Sites/palier-atelier", missing: false });
    expect(branches[3]).not.toHaveProperty("checkout");
    expect(detached).toEqual([]);
  });

  it("keeps a subject's own tabs and spaces, and skips lines that are not branches", () => {
    const refs = parseRefs("refs/heads/a b\x00abc1234\x0010\x00Tabs\tand  spaces\nrefs/tags/v1\x00abc1234\x0010\x00A tag\nnonsense\nrefs/heads/empty\x00abc1234\x0010\x00\n");
    expect(refs).toEqual([
      { name: "a b", hash: "abc1234", committed: 10, subject: "Tabs\tand  spaces" },
      { name: "empty", hash: "abc1234", committed: 10, subject: "" },
    ]);
  });

  it("shows a detached checkout by itself, even when a branch shares its commit", () => {
    const worktrees = parseWorktrees("worktree /repo\x00HEAD aaaaaaa1111\x00branch refs/heads/main\x00\x00worktree /repo-try\x00HEAD aaaaaaa1111\x00detached\x00\x00");
    const { branches, detached } = listed(listBranches(parseRefs("refs/heads/main\x00aaaaaaa\x0010\x00First"), worktrees));
    expect(branches[0]?.checkout?.path).toBe("/repo");
    expect(detached).toEqual([{ path: "/repo-try", hash: "aaaaaaa", missing: false }]);
  });

  it("marks a worktree whose folder is gone, and ignores a bare entry", () => {
    const worktrees = parseWorktrees("worktree /repo.git\x00bare\x00\x00worktree /gone\x00HEAD bbbbbbb2222\x00branch refs/heads/old\x00prunable gitdir file points to non-existent location\x00\x00");
    expect(worktrees.map((entry) => [entry.path, entry.bare, entry.missing])).toEqual([["/repo.git", true, false], ["/gone", false, true]]);
    const { branches, detached } = listed(listBranches(parseRefs("refs/heads/old\x00bbbbbbb\x0010\x00Old"), worktrees));
    expect(branches[0]?.checkout).toEqual({ path: "/gone", missing: true });
    expect(detached).toEqual([]);
  });

  it("lists nothing for a repository without a commit", () => {
    const worktrees = parseWorktrees("worktree /new\x00HEAD 0000000000000000000000000000000000000000\x00branch refs/heads/main\x00\x00");
    expect(listBranches(parseRefs(""), worktrees)).toEqual({ state: "listed", branches: [], detached: [] });
  });

  it("gives an age in one short unit", () => {
    const at = (seconds: number) => age(1000, 1000 + seconds);
    expect([at(-5), at(59), at(60), at(7199), at(7200), at(3 * 86400), at(15 * 86400), at(90 * 86400), at(800 * 86400)])
      .toEqual(["now", "now", "1 min", "1 h", "2 h", "3 d", "2 wk", "3 mo", "2 y"]);
    expect(folderName("/Users/nico/Sites/palier-atelier/")).toBe("palier-atelier");
  });

  it("accepts its own reports in the browser and rejects anything else", () => {
    const report = listBranches(parseRefs(REFS), parseWorktrees(WORKTREES + "worktree /x\x00HEAD ccccccc3333\x00detached\x00\x00"));
    expect(parseReport(JSON.parse(JSON.stringify(report)))).toEqual(report);
    expect(parseReport({ state: "not-a-repository", extra: 1 })).toEqual({ state: "not-a-repository" });
    for (const bad of [null, "<!doctype html>", [], {}, { state: "listed" }, { state: "listed", branches: [{ name: "x" }], detached: [] }, { state: "listed", branches: [], detached: [{ path: "/x", missing: false }] }]) {
      expect(() => parseReport(bad)).toThrow("not a branch report");
    }
  });
});

describe("branch endpoint", () => {
  const projects = [
    { id: "palier", name: "Palier", origin: null, repo: "/repos/palier" },
    { id: "loose", name: "Loose", origin: null },
  ];
  const ask = (request: Partial<Parameters<typeof answer>[0]>, read = vi.fn(async (): Promise<BranchReport> => ({ state: "listed", branches: [], detached: [] }))) =>
    answer({ method: "GET", path: "/palier", site: "same-origin", ...request }, projects, read).then((result) => ({ ...result, read }));

  it("reads the registered folder for Canvagent's own page", async () => {
    const { status, body, read } = await ask({});
    expect(status).toBe(200);
    expect(body).toEqual({ state: "listed", branches: [], detached: [] });
    expect(read).toHaveBeenCalledExactlyOnceWith("/repos/palier");
  });

  it("refuses other pages, other methods and unknown ids before git runs", async () => {
    for (const [request, expected] of [
      [{ site: "same-site" }, 403], [{ site: "cross-site" }, 403], [{ site: "none" }, 403], [{ site: undefined }, 403],
      [{ method: "POST" }, 405], [{ method: undefined }, 405],
      [{ path: "/" }, 404], [{ path: "/palier/" }, 404], [{ path: "/Palier" }, 404], [{ path: "/../palier" }, 404], [{ path: "//repos/palier" }, 404],
    ] as const) {
      const { status, read } = await ask(request);
      expect(status, JSON.stringify(request)).toBe(expected);
      expect(read).not.toHaveBeenCalled();
    }
  });

  it("says so when the registry names no folder, without running git", async () => {
    const { status, body, read } = await ask({ path: "/loose" });
    expect([status, body]).toEqual([200, { state: "unregistered" }]);
    expect(read).not.toHaveBeenCalled();
  });

  it("asks git only to read, and tells a missing repository from a failure", async () => {
    const calls: string[][] = [];
    const git: Git = async (_repo, args) => { calls.push(args); return args[0] === "worktree" ? WORKTREES : REFS; };
    expect(listed(await readBranches("/repos/palier", git)).branches).toHaveLength(4);
    expect(calls.map((args) => args.slice(0, 2).join(" ")).sort()).toEqual(["for-each-ref refs/heads", "worktree list"]);
    expect(await readBranches("/x", async () => { throw new Error("fatal: not a git repository (or any of the parent directories): .git"); })).toEqual({ state: "not-a-repository" });
    expect(await readBranches("/x", async () => { throw new Error("spawn git ENOENT"); })).toEqual({ state: "failed" });
  });
});
