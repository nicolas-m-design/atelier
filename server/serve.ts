/**
 * The packaged workspace: a plain Node server for the built page and Atelier's
 * own endpoints, on this machine's loopback addresses only. Node's built-in
 * modules, nothing else.
 */
import { createPreviewService } from "./previewService.ts";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { extname, join, sep } from "node:path";
import { listener, type ServerOptions } from "./handler.ts";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/** The file an address names inside the built page, or null. Never a file outside `root`. */
export function assetPath(root: string, url: string | undefined): string | null {
  let path: string;
  try { path = decodeURIComponent((url ?? "/").split("?")[0] ?? "/"); } catch { return null; }
  if (!path.startsWith("/") || path.includes("\0") || path.includes("\\") || path.split("/").includes("..")) return null;
  const file = join(root, path === "/" ? "index.html" : path);
  return file.startsWith(root + sep) ? file : null;
}

/**
 * Whether a request names this server as the browser sees it. Another site
 * whose name was pointed at this machine would otherwise count as Atelier's
 * own page and be allowed to read the project list.
 */
export function allowedHost(host: string | undefined, port: number): boolean {
  return host === `localhost:${port}` || host === `127.0.0.1:${port}` || host === `[::1]:${port}`;
}

async function sendFile(root: string, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const plain = (status: number, text: string) => { response.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" }); response.end(text); };
  if (request.method !== "GET" && request.method !== "HEAD") return plain(405, "Only GET is answered.");
  const file = assetPath(root, request.url);
  const found = file ? await stat(file).catch(() => null) : null;
  if (!file || !found?.isFile()) return plain(404, "Not found.");
  response.writeHead(200, {
    "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
    "Content-Length": found.size,
    // Built files carry a hash in their name and never change; the page itself is asked for each time.
    "Cache-Control": file.startsWith(join(root, "assets") + sep) ? "public, max-age=31536000, immutable" : "no-cache",
    "X-Content-Type-Options": "nosniff",
  });
  if (request.method === "HEAD") response.end(); else createReadStream(file).pipe(response);
}

export interface ServeOptions extends ServerOptions {
  /** The folder holding the built page. */
  root: string;
  port: number;
}

/** One request: Atelier's endpoints first, then the built page's files. */
export function requestListener({ root, port, ...options }: ServeOptions): (request: IncomingMessage, response: ServerResponse) => void {
  const endpoints = listener(options);
  return (request, response) => {
    if (!allowedHost(request.headers.host, port)) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Atelier answers only at localhost.");
      return;
    }
    endpoints(request, response, () => { void sendFile(root, request, response).catch(() => { response.statusCode = 500; response.end(); }); });
  };
}

/**
 * Listens on both loopback addresses, since a browser may reach `localhost`
 * through either. Rejects when the port is taken on one of them, so that two
 * copies never share a port between them.
 */
export async function serve(options: ServeOptions): Promise<() => Promise<void>> {
  const previews = options.previews ?? createPreviewService({ atelierPort: options.port, file: options.file, read: options.read });
  const onRequest = requestListener({ ...options, previews });
  const servers: Server[] = [];
  for (const host of ["127.0.0.1", "::1"]) {
    const server = createServer(onRequest);
    try {
      await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(options.port, host, resolve); });
      servers.push(server);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      // A machine without IPv6 has no `::1` to listen on; the other address is enough.
      if (host === "::1" && (code === "EADDRNOTAVAIL" || code === "EAFNOSUPPORT")) continue;
      await Promise.all(servers.map((open) => new Promise((done) => open.close(done))));
      await previews.dispose();
      throw error;
    }
  }
  return async () => { await Promise.all([previews.dispose(), ...servers.map((open) => new Promise((done) => { open.closeAllConnections(); open.close(done); }))]); };
}
