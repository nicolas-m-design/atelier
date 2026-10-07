import { createServer, request as httpRequest } from "node:http";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createPreviewService } from "../server/previewService";
import { createPreviewRunner, type PreviewState } from "../server/previews";
import { listener } from "../server/handler";
import { serve } from "../server/serve";
import { parsePreviewSnapshot, newerPreview, type PreviewSnapshot } from "../src/previews";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => { for (const fn of cleanup.splice(0).reverse()) await fn(); });
const manifest = { atelier: 1 as const, name: "Fixture", frame: { width: 800, height: 600 }, groups: [], links: [] };
const recipe = { dir: ".", requires: ["package.json"], prepare: [], start: ["node", "server.mjs", "{port}"], env: { PRIVATE_VALUE: "never-send-this" } };
async function port() {
  const socket = createServer(); await new Promise<void>(resolve => socket.listen(0, "127.0.0.1", resolve));
  const value = (socket.address() as { port: number }).port;
  await new Promise<void>(resolve => socket.close(() => resolve())); return value;
}
const jsonRequest = (at: number, method = "GET", data?: unknown, headers: Record<string, string> = {}, raw?: string) => new Promise<{ status: number; body: any }>((resolve, reject) => {
  const req = httpRequest({ hostname: "127.0.0.1", port: at, path: "/__atelier/previews", method, headers: { host: `localhost:${at}`, "sec-fetch-site": "same-origin", ...(method === "POST" ? { origin: `http://localhost:${at}`, "content-type": "application/json" } : {}), ...headers } }, response => {
    let text = ""; response.on("data", chunk => text += chunk); response.on("end", () => resolve({ status: response.statusCode!, body: JSON.parse(text) }));
  });
  req.once("error", reject); req.end(raw ?? (data === undefined ? undefined : JSON.stringify(data)));
});

async function api() {
  const at = await port();
  let state: PreviewState = { revision: 0, active: null, candidate: null, error: null, errorProjectId: null };
  const runner = {
    start: vi.fn(async (input) => { state = { ...state, revision: state.revision + 1, active: { id: "run", ...input, commit: "a".repeat(40), origin: "http://127.0.0.1:4567", directory: "/private/cache", manifest } }; return state.active!; }),
    stop: vi.fn(async () => { state = { ...state, active: null, revision: state.revision + 1 }; }), cancel: vi.fn(async () => {}),
    dispose: vi.fn(async () => {}), cleanLeftovers: vi.fn(async () => []), getState: () => state,
  } as Awaited<ReturnType<typeof createPreviewRunner>>;
  const read = vi.fn(async () => JSON.stringify({ projects: [{ id: "fixture", name: "Fixture", repo: "/fixture", preview: recipe }] }));
  const service = createPreviewService({ file: "/registry", atelierPort: at, read, createRunner: async () => runner });
  const endpoints = listener({ file: "/registry", read, previews: service });
  const server = createServer((req, res) => endpoints(req, res, () => { res.writeHead(404); res.end(); }));
  await new Promise<void>(resolve => server.listen(at, "127.0.0.1", resolve));
  cleanup.push(async () => { await service.dispose(); await new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }); });
  return { at, read, runner };
}

describe.skipIf(process.platform !== "darwin")("preview API boundary", () => {
  it("rejects cross-origin, absent metadata, wrong Host/method/type and oversized bodies before launching", async () => {
    const { at, read, runner } = await api();
    for (const headers of ([{ "sec-fetch-site": "same-site" }, { "sec-fetch-site": "cross-site" }, { "sec-fetch-site": "" }, { origin: `http://localhost:${at + 1}` }, { origin: "" }, { host: `foreign.test:${at}`, origin: `http://foreign.test:${at}` }] as Record<string, string>[])) {
      expect((await jsonRequest(at, "POST", {}, headers)).status).toBe(403);
    }
    expect((await jsonRequest(at, "PUT")).status).toBe(405);
    expect((await jsonRequest(at, "POST", {}, { "content-type": "text/plain" })).status).toBe(415);
    expect((await jsonRequest(at, "POST", undefined, {}, "x".repeat(5000))).status).toBe(400);
    expect(read).not.toHaveBeenCalled(); expect(runner.start).not.toHaveBeenCalled();
  });
  it("resolves recipes server-side, omits environment/paths and rejects stale revisions and arbitrary inputs", async () => {
    const { at, runner } = await api();
    const initial = parsePreviewSnapshot((await jsonRequest(at)).body);
    const action = { instance: initial.instance, revision: initial.revision, action: "start", projectId: "fixture", branch: "feature/nested" };
    for (const extra of [{ repo: "/elsewhere" }, { command: "rm" }, { port: 3100 }, { recipe }]) expect((await jsonRequest(at, "POST", { ...action, ...extra })).status).toBe(400);
    const response = await jsonRequest(at, "POST", action);
    expect(response.status).toBe(202);
    expect(runner.start).toHaveBeenCalledExactlyOnceWith({ projectId: "fixture", branch: "feature/nested", repo: "/fixture", recipe });
    expect(JSON.stringify(response.body)).not.toMatch(/never-send-this|private\/cache|PRIVATE_VALUE/);
    expect(parsePreviewSnapshot(response.body).active?.branch).toBe("feature/nested");
    expect((await jsonRequest(at, "POST", action)).status).toBe(409);
    const state = parsePreviewSnapshot((await jsonRequest(at)).body);
    expect((await jsonRequest(at, "POST", { action: "stop", runId: state.active!.id, projectId: "other", instance: state.instance, revision: state.revision })).status).toBe(409);
    expect(runner.stop).not.toHaveBeenCalled();
    expect((await jsonRequest(at, "POST", { action: "stop", runId: "retired-run", projectId: "fixture", instance: state.instance, revision: 0 })).status).toBe(409);
    const stopped = await jsonRequest(at, "POST", { action: "stop", runId: state.active!.id, projectId: "fixture", instance: state.instance, revision: 0 });
    expect(stopped.status).toBe(202); expect(stopped.body.active).toBeNull();
  });
  it("exposes only recipe capability in the project list", async () => {
    const { at } = await api();
    const response = await fetch(`http://127.0.0.1:${at}/__atelier/projects`, { headers: { "sec-fetch-site": "same-origin" } });
    const text = await response.text();
    expect(text).not.toMatch(/PRIVATE_VALUE|never-send-this|requires|prepare/);
    expect(JSON.parse(text).projects[0].canPreview).toBe(true);
  });
});

it("ignores older and unchanged revisions but accepts a restarted server", () => {
  const previous: PreviewSnapshot = { instance: "one", supported: true, revision: 9, active: null, candidate: null, error: null, errorProjectId: null };
  expect(newerPreview(previous, { ...previous, revision: 8 })).toBe(previous);
  expect(newerPreview(previous, { ...previous })).toBe(previous);
  expect(newerPreview(previous, { ...previous, instance: "two", revision: 0 }).instance).toBe("two");
});

it.skipIf(process.platform !== "darwin")("closing the packaged server disposes a live preview, with the same recipe/API as the Mac helper", async () => {
  const folder = await mkdtemp(join(tmpdir(), "atelier-api-lifecycle-"));
  cleanup.push(() => rm(folder, { recursive: true, force: true }));
  const repo = join(folder, "repo"); await mkdir(repo);
  await writeFile(join(repo, "server.mjs"), `import {createServer} from 'node:http'; createServer((q,r)=>{r.setHeader('content-type','application/json');r.end(${JSON.stringify(JSON.stringify(manifest))})}).listen(Number(process.argv[2]),'127.0.0.1');`);
  const git = (...args: string[]) => execFileSync("/usr/bin/git", args, { cwd: repo, stdio: "pipe" });
  git("init", "-q", "-b", "main"); git("add", "."); git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "Fixture");
  const file = join(folder, "projects.json");
  await writeFile(file, JSON.stringify({ projects: [{ id: "fixture", repo, preview: { ...recipe, requires: ["server.mjs"], start: [process.execPath, "server.mjs", "{port}"] } }] }));
  const at = await port();
  const close = await serve({ root: folder, file, port: at }); cleanup.push(close);
  const state = (await jsonRequest(at)).body;
  expect((await jsonRequest(at, "POST", { action: "start", projectId: "fixture", branch: "main", instance: state.instance, revision: state.revision })).status).toBe(202);
  let current = state;
  const deadline = Date.now() + 6000;
  while (!current.active && Date.now() < deadline) { await new Promise(r => setTimeout(r, 50)); current = (await jsonRequest(at)).body; }
  expect(current.active?.manifest.name).toBe("Fixture");
  const origin = current.active.origin;
  await close();
  await expect(fetch(origin)).rejects.toThrow();
}, 10000);


it.skipIf(process.platform !== "darwin")("Vite restart disposes the old preview and creates a fresh service instance", async () => {
  const { createServer: createViteServer } = await import("vite");
  const { atelierServer } = await import("../server/vite");
  const folder = await mkdtemp(join(tmpdir(), "atelier-vite-lifecycle-"));
  cleanup.push(() => rm(folder, { recursive: true, force: true }));
  const repo = join(folder, "repo"); await mkdir(repo);
  await writeFile(join(repo, "server.mjs"), `import {createServer} from 'node:http'; createServer((q,r)=>{r.setHeader('content-type','application/json');r.end(${JSON.stringify(JSON.stringify(manifest))})}).listen(Number(process.argv[2]),'127.0.0.1');`);
  const git = (...args: string[]) => execFileSync("/usr/bin/git", args, { cwd: repo, stdio: "pipe" });
  git("init", "-q", "-b", "main"); git("add", "."); git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "commit", "-qm", "Fixture");
  const file = join(folder, "projects.json");
  await writeFile(file, JSON.stringify({ projects: [{ id: "fixture", repo, preview: { ...recipe, requires: ["server.mjs"], start: [process.execPath, "server.mjs", "{port}"] } }] }));
  const previous = process.env.ATELIER_PROJECTS;
  process.env.ATELIER_PROJECTS = file;
  cleanup.push(async () => { if (previous === undefined) delete process.env.ATELIER_PROJECTS; else process.env.ATELIER_PROJECTS = previous; });
  const at = await port();
  const server = await createViteServer({ configFile: false, root: process.cwd(), cacheDir: join(folder, "vite-cache"), optimizeDeps: { noDiscovery: true, include: [] }, plugins: [atelierServer()], server: { port: at, host: "127.0.0.1", strictPort: true }, logLevel: "silent" });
  cleanup.push(() => server.close()); await server.listen();
  const state = (await jsonRequest(at)).body;
  expect((await jsonRequest(at, "POST", { action: "start", projectId: "fixture", branch: "main", instance: state.instance, revision: state.revision })).status).toBe(202);
  let current = state;
  const deadline = Date.now() + 6000;
  while (!current.active && Date.now() < deadline) { await new Promise(r => setTimeout(r, 50)); current = (await jsonRequest(at)).body; }
  expect(current.active?.manifest.name).toBe("Fixture");
  await server.restart();
  const stoppedBy = Date.now() + 4000;
  while (await fetch(current.active.origin).then(() => true, () => false)) {
    if (Date.now() > stoppedBy) throw new Error("Old preview survived Vite restart");
    await new Promise(r => setTimeout(r, 30));
  }
  const next = (await jsonRequest(at)).body;
  expect(next.instance).not.toBe(state.instance); expect(next.active).toBeNull();
}, 15000);
