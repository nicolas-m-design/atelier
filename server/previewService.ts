/** Shared, same-origin preview API. No commands or paths are accepted from the browser. */
import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { createPreviewRunner, message, type PreviewOptions } from "./previews.ts";
import { readPreviewRecipe, type Read } from "./projects.ts";
import { PREVIEWS_PATH, type PreviewSnapshot } from "../src/previews.ts";
import type { Answer } from "./request.ts";

type Runner = Awaited<ReturnType<typeof createPreviewRunner>>;
interface Options extends PreviewOptions { file: string; read?: Read; createRunner?: typeof createPreviewRunner }
export const allowedPreviewHost = (host: string | undefined, port: number) => [`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`].includes(host ?? "");

export function previewRefusal(request: IncomingMessage, port: number): Answer<never> | null {
  const { method, headers } = request;
  if (!allowedPreviewHost(headers.host, port) || headers["sec-fetch-site"] !== "same-origin") return { status: 403, body: { error: "Only Atelier's own page may ask." } };
  if (method === "GET") return null;
  if (method !== "POST") return { status: 405, body: { error: "Use GET or POST." } };
  if (headers.origin !== `http://${headers.host}`) return { status: 403, body: { error: "The request origin must match Atelier." } };
  if (headers["content-type"]?.split(";")[0]?.trim() !== "application/json") return { status: 415, body: { error: "Use application/json." } };
  return null;
}

function body(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    const finish = (error?: Error) => {
      clearTimeout(timer); request.removeListener("data", data); request.removeListener("end", end); request.removeListener("error", errorEvent); request.removeListener("aborted", abort);
      if (error) { request.resume(); reject(error); }
      else { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch { reject(new Error("Invalid JSON.")); } }
    };
    const data = (chunk: Buffer) => { bytes += chunk.length; if (bytes > 4096) finish(new Error("Request body is too large.")); else chunks.push(chunk); };
    const end = () => finish();
    const abort = () => finish(new Error("Request ended early."));
    const errorEvent = () => finish(new Error("Request could not be read."));
    const timer = setTimeout(() => finish(new Error("Request body timed out.")), 2000);
    request.on("data", data); request.once("end", end); request.once("error", errorEvent); request.once("aborted", abort);
  });
}

export function createPreviewService(options: Options) {
  const instance = randomUUID();
  let runner: Promise<Runner> | null = null, disposed = false;
  let admissions: Promise<unknown> = Promise.resolve();
  const getRunner = () => {
    if (disposed) throw new Error("Atelier is closing.");
    return runner ??= (options.createRunner ?? createPreviewRunner)(options);
  };
  const snapshot = async (): Promise<PreviewSnapshot> => {
    if (process.platform !== "darwin") return { instance, supported: false, revision: 0, active: null, candidate: null, error: null, errorProjectId: null };
    const state = (await getRunner()).getState();
    const active = state.active ? { id: state.active.id, projectId: state.active.projectId, branch: state.active.branch, commit: state.active.commit, origin: state.active.origin, manifest: state.active.manifest } : null;
    return { ...state, active, instance, supported: true };
  };
  return {
    async answer(request: IncomingMessage): Promise<Answer<PreviewSnapshot> | null> {
      if ((request.url ?? "").split("?")[0] !== PREVIEWS_PATH) return null;
      const refused = previewRefusal(request, options.atelierPort);
      if (refused) return refused;
      if (disposed) return { status: 503, body: { error: "Atelier is closing." } };
      if (request.method === "GET") return { status: 200, body: await snapshot() };
      let input: unknown;
      try { input = await body(request); } catch (error) { return { status: 400, body: { error: message(error) } }; }
      if (!input || typeof input !== "object" || Array.isArray(input)) return { status: 400, body: { error: "Invalid preview action." } };
      const data = input as Record<string, unknown>;
      const keys = data.action === "start" ? ["action", "instance", "revision", "projectId", "branch"] : ["action", "instance", "revision", "projectId", "runId"];
      if (!keys.every(k => k in data) || Object.keys(data).some(k => !keys.includes(k)) || !["start", "stop", "cancel"].includes(String(data.action))
        || typeof data.projectId !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(data.projectId)
        || !Number.isSafeInteger(data.revision) || typeof data.instance !== "string"
        || (data.action !== "start" && (typeof data.runId !== "string" || !data.runId || data.runId.length > 128))
        || (data.action === "start" && (typeof data.branch !== "string" || !data.branch || data.branch.length > 1024 || data.branch.includes("\0")))) {
        return { status: 400, body: { error: "Invalid preview action." } };
      }
      const action = async (): Promise<Answer<PreviewSnapshot>> => {
        if (process.platform !== "darwin") return { status: 400, body: { error: "Branch previews currently require macOS." } };
        try {
          const owned = await getRunner();
          // Reading a recipe is part of admission; recheck the revision after that read.
          const config = data.action === "start" ? await readPreviewRecipe(options.file, data.projectId as string, options.read) : null;
          const state = owned.getState();
          if (data.instance !== instance || (data.action === "start" ? data.revision !== state.revision : (data.revision as number) > state.revision)) return { status: 409, body: { error: "Preview state changed. Try again." } };
          if (data.action === "start" && config) {
            void owned.start({ ...config, projectId: data.projectId as string, branch: data.branch as string }).catch(() => {});
            await Promise.resolve(); // Publish the queued candidate without waiting for installation.
          } else if (data.action === "cancel") {
            if (state.candidate?.projectId !== data.projectId || state.candidate?.id !== data.runId) return { status: 409, body: { error: "That preparation is no longer active." } };
            await owned.cancel();
          } else {
            if (state.active?.projectId !== data.projectId || state.active?.id !== data.runId || state.candidate) return { status: 409, body: { error: "Cancel preparation before stopping the active preview." } };
            await owned.stop();
          }
          return { status: 202, body: await snapshot() };
        } catch (error) { return { status: 400, body: { error: message(error) } }; }
      };
      const result = admissions.then(action);
      admissions = result.catch(() => {});
      return result;
    },
    async dispose() {
      disposed = true;
      await runner?.then(r => r.dispose());
    },
  };
}
export type PreviewService = ReturnType<typeof createPreviewService>;
