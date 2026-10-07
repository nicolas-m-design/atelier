import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, writeFile, readFile, rm, mkdir, readdir, access, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { createPreviewRunner, type PreviewRecipe, type PreviewRun } from "../server/previews.ts";

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => { for (const fn of cleanups.splice(0).reverse()) await fn(); });
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until<T>(fn: () => Promise<T | false> | T | false, timeout = 8000): Promise<T> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { const value = await fn(); if (value !== false) return value; await wait(30); }
  throw new Error("Test condition timed out.");
}
const gone = (pid: number) => { try { process.kill(pid, 0); return false; } catch { return true; } };
const exists = (path: string) => access(path).then(() => true, () => false);
const manifest = { atelier: 1, name: "Fixture", frame: { width: 800, height: 600 }, groups: [{ id: "g", title: "Screens", screens: [{ id: "home", title: "Home", route: "/" }] }] };

async function fixture() {
  const folder = await mkdtemp(join(tmpdir(), "atelier-preview-test-"));
  cleanups.push(() => rm(folder, { recursive: true, force: true }));
  const repo = join(folder, "repo"); await mkdir(repo);
  const git = (...args: string[]) => execFileSync("/usr/bin/git", args, { cwd: repo, env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" }, encoding: "utf8" }).trim();
  git("init", "-q", "-b", "main"); git("config", "user.email", "fixture@example.invalid"); git("config", "user.name", "Fixture");
  await writeFile(join(repo, "package.json"), '{"type":"module"}');
  await writeFile(join(repo, "version.txt"), "committed");
  await writeFile(join(repo, "server.mjs"), `
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const port = Number(process.argv[2]);
if (process.env.PORT_FILE) writeFileSync(process.env.PORT_FILE, String(port));
if (process.env.FOREIGN_PORT_FILE) {
  writeFileSync(process.env.FOREIGN_PORT_FILE, String(port));
  setInterval(() => {}, 1000);
} else if (!process.env.IS_CHILD) {
  const child = spawn(process.execPath, [import.meta.filename, String(port)], { env: {...process.env, IS_CHILD: '1'}, stdio: 'ignore' });
  writeFileSync('wrapper.pid', String(process.pid));
  child.on('exit', () => process.exit(1));
  if (process.env.IGNORE_TERM) process.on('SIGTERM', () => {});
} else {
  writeFileSync('server.pid', String(process.pid));
  if (process.env.IGNORE_TERM) process.on('SIGTERM', () => {});
  createServer((req,res) => {
    if (req.url === '/atelier.json') {
      if (process.env.NO_MANIFEST) { res.writeHead(404); res.end(); }
      else { res.setHeader('content-type','application/json'); setTimeout(() => res.end(JSON.stringify(${JSON.stringify(manifest)})), Number(process.env.MANIFEST_DELAY || 0)); }
    } else res.end(readFileSync('version.txt'));
  }).listen(port, '127.0.0.1');
}
`);
  git("add", "."); git("commit", "-qm", "Fixture");
  const commit = git("rev-parse", "HEAD");
  await writeFile(join(repo, "version.txt"), "dirty working copy");
  const recipe: PreviewRecipe = {
    dir: ".", requires: ["package.json", "server.mjs"],
    prepare: [[process.execPath, "-e", "require('fs').writeFileSync('generated.txt','prepared'); require('fs').writeFileSync('package.json','{}');"]],
    start: [process.execPath, "server.mjs", "{port}"], env: { IGNORE_TERM: "1" },
  };
  const options = { atelierPort: 3299, cacheRoot: join(folder, "cache"), startupTimeoutMs: 1400, prepareTimeoutMs: 3000 };
  const runner = await createPreviewRunner(options);
  cleanups.push(() => runner.dispose());
  const request = { projectId: "fixture", repo, branch: "main", recipe };
  return { folder, repo, git, commit, recipe, options, runner, request };
}

// These tests execute real Git, process groups, lsof and HTTP on macOS.
describe.skipIf(process.platform !== "darwin")("managed preview processes", () => {
  it("cold-starts a committed export, deduplicates requests, replaces it and removes rewritten files", async () => {
    const f = await fixture();
    const worktrees = f.git("worktree", "list", "--porcelain");
    const firstPromise = f.runner.start(f.request);
    expect(f.runner.start(f.request)).toBe(firstPromise);
    const first = await firstPromise;
    expect(first.commit).toBe(f.commit);
    expect(first.manifest.name).toBe("Fixture");
    expect(await (await fetch(first.origin)).text()).toBe("committed");
    expect(await exists(join(first.directory, "source", ".git"))).toBe(false);
    expect(await readFile(join(first.directory, "source", "generated.txt"), "utf8")).toBe("prepared");
    expect(await readFile(join(f.repo, "version.txt"), "utf8")).toBe("dirty working copy");
    expect(f.git("worktree", "list", "--porcelain")).toBe(worktrees);
    const pids = await Promise.all(["wrapper.pid", "server.pid"].map(name => readFile(join(first.directory, "source", name), "utf8").then(Number)));
    const second = await f.runner.start(f.request);
    expect(second.id).not.toBe(first.id);
    expect(f.runner.getState().active?.id).toBe(second.id);
    await until(() => pids.every(gone));
    expect(await exists(first.directory)).toBe(false);
    await f.runner.stop();
    expect(await exists(second.directory)).toBe(false);
    expect(f.runner.getState().active).toBeNull();
  }, 15000);

  it("preserves the previous run after missing manifest or required files", async () => {
    const f = await fixture();
    const first = await f.runner.start(f.request);
    await expect(f.runner.start({ ...f.request, recipe: { ...f.recipe, env: { NO_MANIFEST: "1" } } })).rejects.toThrow(/Manifest answered 404/);
    expect(f.runner.getState().active?.id).toBe(first.id);
    expect((await fetch(first.origin)).status).toBe(200);
    await expect(f.runner.start({ ...f.request, recipe: { ...f.recipe, requires: ["absent.json"] } })).rejects.toThrow(/Required preview file/);
    expect((await readdir(join(f.options.cacheRoot, "3299"))).length).toBe(1);
    expect(f.runner.getState().active?.id).toBe(first.id);
  }, 15000);

  it("requires {port}, contains paths and refuses npm without a local package", async () => {
    const f = await fixture();
    await expect(f.runner.start({ ...f.request, recipe: { ...f.recipe, start: ["npm", "run", "dev"] } })).rejects.toThrow(/port/);
    await expect(f.runner.start({ ...f.request, recipe: { ...f.recipe, dir: "../" } })).rejects.toThrow(/recipe/);
    await mkdir(join(f.repo, "empty")); await writeFile(join(f.repo, "empty", "keep"), "");
    f.git("add", "empty"); f.git("commit", "-qm", "Empty app");
    await expect(f.runner.start({ ...f.request, recipe: { ...f.recipe, dir: "empty", requires: [], prepare: [["npm", "install"]] } })).rejects.toThrow(/npm requires package.json/);
  }, 10000);

  it("rejects external symlinks before preparation", async () => {
    const f = await fixture();
    await symlink(f.folder, join(f.repo, "outside"));
    f.git("add", "outside"); f.git("commit", "-qm", "External symlink");
    await expect(f.runner.start(f.request)).rejects.toThrow(/symlink outside/);
  });

  it("cancels a hung preparation and kills descendants ignoring TERM", async () => {
    const f = await fixture();
    const pidFile = join(f.folder, "preparing.pid");
    const pending = f.runner.start({ ...f.request, recipe: { ...f.recipe, prepare: [[process.execPath, "-e", `require('fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid)); process.on('SIGTERM',()=>{}); setInterval(()=>{},1000)`]] } });
    const rejected = expect(pending).rejects.toThrow(/cancelled/);
    const pid = await until<number>(async () => await readFile(pidFile, "utf8").then(Number, () => false));
    await f.runner.cancel(); await rejected;
    await until(() => gone(pid));
    expect(await readdir(join(f.options.cacheRoot, "3299"))).toEqual([]);
  });

  it("refuses a foreign listener without terminating it", async () => {
    const f = await fixture();
    const file = join(f.folder, "port");
    const pending = f.runner.start({ ...f.request, recipe: { ...f.recipe, env: { FOREIGN_PORT_FILE: file } } });
    const rejected = expect(pending).rejects.toThrow(/foreign listener/);
    const port = await until<number>(async () => await readFile(file, "utf8").then(Number, () => false));
    const foreign = createServer((_, res) => res.end("foreign"));
    await new Promise<void>((resolve, reject) => { foreign.once("error", reject); foreign.listen(port, "127.0.0.1", resolve); });
    cleanups.push(() => new Promise<void>(resolve => foreign.close(() => resolve())));
    await rejected;
    expect(await (await fetch(`http://127.0.0.1:${port}`)).text()).toBe("foreign");
  });



  it("requires every listener, including a foreign IPv6 listener beside its own IPv4 server", async () => {
    const f = await fixture();
    const file = join(f.folder, "dual-port");
    const pending = f.runner.start({ ...f.request, recipe: { ...f.recipe, env: { PORT_FILE: file, MANIFEST_DELAY: "500" } } });
    const rejected = expect(pending).rejects.toThrow(/foreign listener/);
    const port = await until<number>(async () => await readFile(file, "utf8").then(Number, () => false));
    await until(async () => fetch(`http://127.0.0.1:${port}`).then(r => r.ok, () => false));
    const foreign = createServer((_, res) => res.end("foreign ipv6"));
    await new Promise<void>((resolve, reject) => { foreign.once("error", reject); foreign.listen({ port, host: "::1", ipv6Only: true }, resolve); });
    cleanups.push(() => new Promise<void>(resolve => foreign.close(() => resolve())));
    await rejected;
    expect(await (await fetch(`http://[::1]:${port}`)).text()).toBe("foreign ipv6");
  });

  it("times out preparation and removes only owned cache directories", async () => {
    const f = await fixture();
    const runner = await createPreviewRunner({ ...f.options, prepareTimeoutMs: 200 });
    cleanups.push(() => runner.dispose());
    await expect(runner.start({ ...f.request, recipe: { ...f.recipe, prepare: [[process.execPath, "-e", "process.on('SIGTERM',()=>{}); setInterval(()=>{},1000)"]] } })).rejects.toThrow(/timed out/);
    const namespace = join(f.options.cacheRoot, "3299");
    const outside = join(f.folder, "outside"); await mkdir(outside);
    await writeFile(join(outside, "keep"), "keep");
    await symlink(outside, join(namespace, "a".repeat(24)));
    await mkdir(join(namespace, "b".repeat(24)));
    await writeFile(join(namespace, "b".repeat(24), "owner.json"), "not our marker");
    expect(await runner.cleanLeftovers()).toEqual([]);
    expect(await readFile(join(outside, "keep"), "utf8")).toBe("keep");
  });

  it("a newer selection cancels preparation, then becomes the only active run", async () => {
    const f = await fixture();
    const pidFile = join(f.folder, "superseded.pid");
    const old = f.runner.start({ ...f.request, recipe: { ...f.recipe, prepare: [[process.execPath, "-e", `require('fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid)); setInterval(()=>{},1000)`]] } });
    const rejected = expect(old).rejects.toThrow(/cancelled/);
    await until(() => exists(pidFile));
    const run = await f.runner.start(f.request); await rejected;
    expect(f.runner.getState().active?.id).toBe(run.id);
    expect(f.runner.getState().candidate).toBeNull();
    expect(await readdir(join(f.options.cacheRoot, "3299"))).toEqual([run.id]);
  });

  for (const phase of ["preparation", "ready"] as const) {
    it(`guardian cleans up after coordinator SIGKILL during ${phase}; stale export is recoverable`, async () => {
      const f = await fixture();
      const pidFile = join(f.folder, "child.pid");
      const recipe = phase === "ready" ? f.recipe : { ...f.recipe, prepare: [[process.execPath, "-e", `require('fs').writeFileSync(${JSON.stringify(pidFile)},String(process.pid)); process.on('SIGTERM',()=>{}); setInterval(()=>{},1000)`] as [string, ...string[]]] };
      const coordinator = join(f.folder, "coordinator.mjs");
      await writeFile(coordinator, `import {createPreviewRunner} from ${JSON.stringify(pathToFileURL(join(process.cwd(), "server/previews.ts")).href)};\nconst r=await createPreviewRunner(${JSON.stringify(f.options)}); const result=await r.start(${JSON.stringify({ ...f.request, recipe })}); console.log(JSON.stringify(result)); setInterval(()=>{},1000);`);
      const child = spawn(process.execPath, ["--experimental-strip-types", coordinator], { stdio: ["ignore", "pipe", "pipe"] });
      let output = "", errors = "";
      child.stdout.on("data", data => { output += data; }); child.stderr.on("data", data => { errors += data; });
      const exit = new Promise<void>(resolve => child.once("close", () => resolve()));
      cleanups.push(async () => { if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL"); await exit; });
      let pids: number[];
      let run: PreviewRun | undefined;
      if (phase === "ready") {
        run = await until(() => { if (child.exitCode !== null) throw new Error(errors); return output.includes("\n") ? JSON.parse(output.trim()) as PreviewRun : false; });
        pids = await Promise.all(["wrapper.pid", "server.pid"].map(name => readFile(join(run!.directory, "source", name), "utf8").then(Number)));
        const secondRunner = await createPreviewRunner(f.options);
        cleanups.push(() => secondRunner.dispose());
        expect(await secondRunner.cleanLeftovers()).toEqual([]); // Live sibling lease protects its export.
        expect(await exists(run.directory)).toBe(true);
      } else pids = [await until<number>(async () => await readFile(pidFile, "utf8").then(Number, () => false))];
      child.kill("SIGKILL"); await exit;
      await until(() => pids.every(gone));
      const unknown = join(f.options.cacheRoot, "3299", "unknown"); await mkdir(unknown);
      const recovered = await createPreviewRunner(f.options);
      cleanups.push(() => recovered.dispose());
      expect(await readdir(join(f.options.cacheRoot, "3299"))).toEqual(["unknown"]);
      if (run) await expect(fetch(run.origin)).rejects.toThrow();
    }, 12000);
  }
});
