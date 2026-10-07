/** macOS preview coordinator. Registry and HTTP concerns live in previewService. */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, lstat, readFile, readdir, realpath, rm } from "node:fs/promises";
import { connect } from "node:net";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import { parseManifest, type Manifest } from "../src/manifest.ts";

export type PreviewCommand = [string, ...string[]];
export interface PreviewRecipe {
  dir: string;
  requires: string[];
  prepare: PreviewCommand[];
  start: PreviewCommand;
  env: Record<string, string>;
}
export interface PreviewRequest { projectId: string; repo: string; branch: string; recipe: PreviewRecipe }
export interface PreviewRun {
  id: string; projectId: string; branch: string; commit: string; origin: string;
  directory: string; manifest: Manifest;
}
export interface PreviewState {
  revision: number;
  active: PreviewRun | null;
  candidate: { id: string; projectId: string; branch: string; phase: string } | null;
  error: string | null;
  errorProjectId: string | null;
}
export interface PreviewOptions {
  atelierPort: number;
  /** Tests may isolate the cache; production uses the machine cache. */
  cacheRoot?: string;
  /** Vite bundles its config; its child still runs this explicit source file. */
  guardianPath?: string;
  prepareTimeoutMs?: number;
  startupTimeoutMs?: number;
}
export interface GuardianInput extends PreviewRequest {
  id: string; directory: string; prepareTimeoutMs: number; startupTimeoutMs: number;
}
export type GuardianEvent = { phase: string } | { ready: PreviewRun } | { error: string };
export const sleep = (ms: number) => new Promise<void>(done => setTimeout(done, ms));
export const message = (error: unknown) => error instanceof Error ? error.message : String(error);
export const RUN_ID = /^[a-f0-9]{24}$/;
export const leasePath = (id: string) => `/tmp/atelier-preview-${id}.sock`;
export const inside = (root: string, path: string) => {
  const rel = relative(root, path);
  return !isAbsolute(rel) && rel !== ".." && !rel.startsWith("../");
};

/** Recipes are privileged machine configuration, never inferred from a branch. */
export function validateRecipe(recipe: PreviewRecipe): PreviewRecipe {
  const path = (s: unknown) => typeof s === "string" && !s.includes("\0") && !isAbsolute(s) && !s.split("/").includes("..");
  const command = (c: unknown) => Array.isArray(c) && c.length > 0 && typeof c[0] === "string" && c[0].length > 0 && c.every(s => typeof s === "string" && !s.includes("\0"));
  if (!recipe || !path(recipe.dir) || !recipe.dir || !Array.isArray(recipe.requires) || !recipe.requires.every(s => path(s) && s.length > 0)
    || !Array.isArray(recipe.prepare) || !recipe.prepare.every(command) || !command(recipe.start)
    || !recipe.start.slice(1).some(s => s.includes("{port}"))
    || !recipe.env || typeof recipe.env !== "object" || Array.isArray(recipe.env)
    || Object.entries(recipe.env).some(([k, v]) => !/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) || /^(GIT_|NODE_OPTIONS$|NODE_PATH$|DYLD_|LD_)/.test(k) || typeof v !== "string" || v.includes("\0"))) {
    throw new Error("Invalid preview recipe; start arguments must include {port}.");
  }
  return structuredClone(recipe);
}

/** Finder-safe tool paths; do not inherit shell secrets or Git/Node routing. */
export function previewEnvironment(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    HOME: homedir(), TMPDIR: process.env.TMPDIR || "/tmp", LC_ALL: "C",
    PATH: [dirname(process.execPath), "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(delimiter),
    ...extra,
  };
}

async function leased(id: string): Promise<boolean> {
  return new Promise(resolve => {
    const socket = connect(leasePath(id));
    const done = (live: boolean) => { socket.destroy(); resolve(live); };
    socket.once("connect", () => done(true));
    socket.once("error", (e: NodeJS.ErrnoException) => done(e.code !== "ENOENT" && e.code !== "ECONNREFUSED"));
    socket.setTimeout(500, () => done(true)); // Uncertain ownership is never permission to delete.
  });
}

async function removeLeftover(namespace: string, id: string): Promise<boolean> {
  if (!RUN_ID.test(id)) return false;
  const directory = join(namespace, id);
  const info = await lstat(directory).catch(() => null);
  if (!info?.isDirectory() || info.isSymbolicLink()) return false;
  const marker = join(directory, "owner.json");
  const meta = await lstat(marker).catch(() => null);
  if (!meta?.isFile() || meta.isSymbolicLink()) return false;
  const text = await readFile(marker, "utf8").catch(() => null);
  if (text !== JSON.stringify({ atelierPreview: 1, id }) || await leased(id)) return false;
  // A dying guardian still accepts lease connections until it kills its group.
  await sleep(100);
  if (await leased(id) || (await realpath(directory).catch(() => null)) !== join(namespace, id)) return false;
  await rm(directory, { recursive: true, force: true });
  await rm(leasePath(id), { force: true });
  return true;
}

interface Owned {
  id: string;
  request: PreviewRequest;
  stop(): Promise<void>;
  ready: Promise<PreviewRun>;
}

export async function createPreviewRunner(options: PreviewOptions) {
  if (process.platform !== "darwin") throw new Error("Managed previews currently require macOS.");
  if (!Number.isInteger(options.atelierPort) || options.atelierPort < 1 || options.atelierPort > 65535) throw new Error("Invalid Atelier port.");
  for (const timeout of [options.prepareTimeoutMs, options.startupTimeoutMs]) {
    if (timeout !== undefined && (!Number.isFinite(timeout) || timeout < 100 || timeout > 600_000)) throw new Error("Preview timeout must be between 100 and 600000 ms.");
  }
  const root = options.cacheRoot ?? join(homedir(), ".cache", "agent-atelier", "previews");
  await mkdir(root, { recursive: true, mode: 0o700 });
  const canonicalRoot = await realpath(root);
  const namespace = join(canonicalRoot, String(options.atelierPort));
  await mkdir(namespace, { recursive: true, mode: 0o700 });
  if ((await lstat(namespace)).isSymbolicLink()) throw new Error("Preview cache namespace cannot be a symlink.");
  const cleanLeftovers = async () => {
    const removed: string[] = [];
    for (const id of await readdir(namespace)) if (await removeLeftover(namespace, id)) removed.push(id);
    return removed;
  };
  await cleanLeftovers();
  let state: PreviewState = { revision: 0, active: null, candidate: null, error: null, errorProjectId: null };
  let active: Owned | null = null;
  let candidate: Owned | null = null;
  let disposed = false;
  let generation = 0;
  let tail: Promise<unknown> = Promise.resolve();
  let pending: { key: string; result: Promise<PreviewRun> } | null = null;
  const update = (patch: Partial<PreviewState>) => { state = { ...state, ...patch, revision: state.revision + 1 }; };
  const enqueue = <T,>(fn: () => Promise<T>): Promise<T> => {
    const result = tail.then(fn);
    tail = result.catch(() => {});
    return result;
  };

  function launch(request: PreviewRequest): Owned {
    const id = randomBytes(12).toString("hex");
    const directory = join(namespace, id);
    const guardianFile = options.guardianPath ?? fileURLToPath(new URL(import.meta.url.endsWith(".ts") ? "./previewGuardian.ts" : "./previewGuardian.js", import.meta.url));
    const child = spawn(process.execPath, [...(guardianFile.endsWith(".ts") ? ["--experimental-strip-types"] : []), guardianFile], {
      detached: true, env: previewEnvironment(), stdio: ["pipe", "pipe", "pipe", "pipe"],
    });
    let closed = false, stopping = false, settled = false, buffer = "";
    let resolveReady!: (run: PreviewRun) => void, rejectReady!: (error: Error) => void;
    const ready = new Promise<PreviewRun>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    // stderr/stdout are deliberately drained, not exposed: installs can print credentials.
    child.stdout!.resume(); child.stderr!.resume();
    const fail = (reason: string) => { if (!settled) { settled = true; rejectReady(new Error(reason)); } };
    const exit = new Promise<void>(resolve => {
      child.once("close", () => {
        closed = true;
        fail(stopping ? "Preview cancelled." : "Preview guardian exited before readiness.");
        if (active?.id === id) { active = null; update({ active: null, error: "The preview process stopped.", errorProjectId: request.projectId }); }
        resolve();
      });
    });
    child.once("error", () => fail("Could not start the preview guardian."));
    child.stdin!.on("error", () => fail("The preview guardian pipe closed."));
    const control = child.stdio[3] as import("node:stream").Readable;
    control.setEncoding("utf8");
    control.on("data", (chunk: string) => {
      buffer += chunk;
      if (buffer.length > 1024 * 1024) { fail("Invalid guardian response."); child.stdin!.end(); return; }
      let line: number;
      while ((line = buffer.indexOf("\n")) !== -1) {
        const text = buffer.slice(0, line); buffer = buffer.slice(line + 1);
        try {
          const event = JSON.parse(text) as GuardianEvent;
          if ("error" in event) fail(event.error);
          else if ("phase" in event && candidate?.id === id) update({ candidate: { id, projectId: request.projectId, branch: request.branch, phase: event.phase } });
          else if ("ready" in event && !settled && !stopping) {
            const run = event.ready;
            if (run.id !== id || run.directory !== directory || !/^[a-f0-9]{40,64}$/.test(run.commit)) throw new Error("Invalid run.");
            run.manifest = parseManifest(run.manifest);
            settled = true; resolveReady(run);
          }
        } catch { fail("Invalid guardian response."); child.stdin!.end(); }
      }
    });
    const input: GuardianInput = { ...request, id, directory, prepareTimeoutMs: options.prepareTimeoutMs ?? 180_000, startupTimeoutMs: options.startupTimeoutMs ?? 60_000 };
    child.stdin!.write(JSON.stringify(input) + "\n");
    let stopped: Promise<void> | null = null;
    const stop = () => stopped ??= (async () => {
      stopping = true;
      fail("Preview cancelled.");
      if (!closed) { child.stdin!.end(); await exit; }
      await removeLeftover(namespace, id);
    })();
    return { id, request, ready, stop };
  }

  function start(input: PreviewRequest): Promise<PreviewRun> {
    if (disposed) return Promise.reject(new Error("Preview runner is disposed."));
    let request: PreviewRequest;
    try {
      if (!input.projectId || !isAbsolute(input.repo) || !input.branch || input.branch.includes("\0")) throw new Error("Invalid preview request.");
      request = { ...input, recipe: validateRecipe(input.recipe) };
    } catch (error) { return Promise.reject(error); }
    const key = JSON.stringify(request);
    if (pending?.key === key) return pending.result;
    const token = ++generation;
    // Release an in-flight preparation without waiting for the operation queue.
    void candidate?.stop().catch(() => { /* The queued operation reports cleanup errors. */ });
    const result = enqueue(async () => {
      if (disposed || generation !== token) throw new Error("Preview cancelled.");
      const owned = launch(request); candidate = owned;
      update({ candidate: { id: owned.id, projectId: request.projectId, branch: request.branch, phase: "resolving" }, error: null, errorProjectId: null });
      try {
        const run = await owned.ready;
        if (disposed || generation !== token) throw new Error("Preview cancelled.");
        const previous = active;
        active = owned; candidate = null;
        update({ active: run, candidate: null, error: null, errorProjectId: null });
        await previous?.stop().catch(() => update({ error: "The previous preview stopped, but its cache could not be removed.", errorProjectId: request.projectId }));
        return structuredClone(run);
      } catch (error) {
        await owned.stop();
        if (candidate === owned) candidate = null;
        update({ candidate: null, error: message(error), errorProjectId: request.projectId });
        throw error;
      }
    });
    pending = { key, result };
    void result.finally(() => { if (pending?.result === result) pending = null; }).catch(() => {});
    return result;
  }
  async function cancel() {
    ++generation;
    await candidate?.stop();
    await tail;
    if (state.error === "Preview cancelled.") update({ error: null, errorProjectId: null });
  }
  async function stop() {
    await cancel();
    const previous = active; active = null;
    update({ active: null, error: null, errorProjectId: null });
    await previous?.stop();
  }
  return {
    start, cancel, stop, cleanLeftovers,
    getState: () => structuredClone(state),
    async dispose() { disposed = true; await stop(); },
  };
}
