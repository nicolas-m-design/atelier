import { createServer, request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { parseCommand } from "../server/command";
import { addProject, isAtelierProject, readProjects, type Read } from "../server/projects";
import { allowedHost, assetPath, requestListener } from "../server/serve";

const FILE = "/home/someone/.config/agent-atelier/projects.json";

function disk(files: Record<string, unknown>): Read {
  return async (path) => {
    if (!(path in files)) throw Object.assign(new Error(`ENOENT: no such file, open '${path}'`), { code: "ENOENT" });
    const content = files[path];
    return typeof content === "string" ? content : JSON.stringify(content);
  };
}

describe("command line", () => {
  it("serves on the fixed port unless told otherwise", () => {
    expect(parseCommand([], "/work")).toEqual({ run: "serve", port: 3200, overrides: new Map() });
    expect(parseCommand(["serve", "--port", "3300"], "/work")).toEqual({ run: "serve", port: 3300, overrides: new Map() });
    expect(parseCommand(["--origin", "palette=http://localhost:3101/", "--origin=other=http://127.0.0.1:4000"], "/work"))
      .toEqual({ run: "serve", port: 3200, overrides: new Map([["palette", "http://localhost:3101"], ["other", "http://127.0.0.1:4000"]]) });
  });

  it("adds the current folder, or the one named, with what was given", () => {
    expect(parseCommand(["add"], "/work/app")).toEqual({ run: "add", repo: "/work/app", origin: undefined, start: undefined });
    expect(parseCommand(["add", "../other", "--origin", "http://localhost:3000", "--start", "npm run dev"], "/work/app"))
      .toEqual({ run: "add", repo: "/work/other", origin: "http://localhost:3000", start: "npm run dev" });
  });

  it("answers help and version before anything else", () => {
    expect(parseCommand(["add", "-h"], "/work")).toEqual({ run: "help" });
    expect(parseCommand(["--version"], "/work")).toEqual({ run: "version" });
  });

  it("refuses what it cannot do, in a sentence", () => {
    for (const [args, message] of [
      [["start"], /not something agent-atelier does/],
      [["serve", "extra"], /not something agent-atelier does/],
      [["--port", "0"], /not a port/],
      [["--port", "3200.5"], /not a port/],
      [["--port", "http"], /not a port/],
      [["--origin", "http://localhost:3101"], /names a project/],
      [["--origin", "palette=localhost 3101"], /not an address/],
      [["--origin", "palette=http://localhost:3101/preview"], /not an address/],
      [["--start", "npm run dev"], /belongs to add/],
      [["add", "a", "b"], /one folder/],
      [["add", "--port", "3300"], /belongs to serving/],
      [["add", "--origin", "nowhere"], /not an address/],
      [["add", "--origin", "http://a:1", "--origin", "http://b:2"], /one --origin/],
    ] as const) {
      expect(() => parseCommand([...args], "/work"), args.join(" ")).toThrow(message);
    }
    expect(() => parseCommand(["--unknown"], "/work")).toThrow();
  });
});

describe("adding a project", () => {
  const packages = {
    "/repos/described/package.json": { name: "described", atelier: { origin: "http://localhost:3000", start: "npm run dev" } },
    "/repos/plain/package.json": { name: "plain" },
  };
  const saved = () => {
    const write = vi.fn(async (_path: string, _text: string) => {});
    const text = () => write.mock.calls[0]?.[1];
    return { write, text };
  };

  it("creates the file with a bare folder when the project describes itself", async () => {
    const { write, text } = saved();
    const project = await addProject(FILE, { repo: "/repos/described" }, disk(packages), write);
    expect(project).toEqual({ id: "described", name: "Described", origin: "http://localhost:3000", repo: "/repos/described", start: { cwd: "/repos/described", command: "npm run dev" } });
    expect(write).toHaveBeenCalledExactlyOnceWith(FILE, expect.any(String));
    expect(JSON.parse(text()!)).toEqual({ projects: ["/repos/described"] });
    expect(text()).toMatch(/\n$/);
  });

  it("appends what was given, and keeps everything already in the file", async () => {
    const { write, text } = saved();
    const before = { note: "kept", projects: ["/repos/described", { id: "remote", origin: "http://192.168.1.20:4000" }] };
    // The command hands over its whole decision; only the folder, address and start command are stored.
    const command = { run: "add", repo: "/repos/plain", origin: "http://localhost:3001", start: undefined };
    const project = await addProject(FILE, command, disk({ ...packages, [FILE]: before }), write);
    expect(project?.origin).toBe("http://localhost:3001");
    expect(JSON.parse(text()!)).toEqual({ ...before, projects: [...before.projects, { repo: "/repos/plain", origin: "http://localhost:3001" }] });
  });

  it("does nothing when the folder is already listed, however it is written", async () => {
    for (const listed of ["/repos/plain", { repo: "/repos/plain", origin: "http://localhost:3001" }]) {
      const { write } = saved();
      expect(await addProject(FILE, { repo: "/repos/plain" }, disk({ ...packages, [FILE]: { projects: [listed] } }), write)).toBeNull();
      expect(write).not.toHaveBeenCalled();
    }
  });

  it("never writes over a file it cannot use, nor an entry that would not work", async () => {
    const { write } = saved();
    await expect(addProject(FILE, { repo: "/repos/plain" }, disk({ ...packages, [FILE]: "{ not json" }), write)).rejects.toThrow(/not valid JSON.*nothing was written/);
    await expect(addProject(FILE, { repo: "/repos/unnamed" }, disk(packages), write)).rejects.toThrow("/repos/unnamed cannot be added: it needs an id, or a repo whose package.json has a name. Nothing was written.");
    await expect(addProject(FILE, { repo: "/repos/plain" }, disk({ ...packages, [FILE]: { projects: [{ id: "plain", origin: null }] } }), write)).rejects.toThrow(/already has the id "plain"/);
    expect(write).not.toHaveBeenCalled();
  });
});

describe("the folder the command is run in", () => {
  it("counts as a project when it describes itself or has installed this package", async () => {
    const read = disk({
      "/a/package.json": { name: "a", atelier: { origin: "http://localhost:3000" } },
      "/b/package.json": { name: "b", devDependencies: { "agent-atelier": "^0.1.0" } },
      "/c/package.json": { name: "c", dependencies: { react: "^19.0.0" } },
      "/e/package.json": "{ not json",
    });
    expect(await Promise.all(["/a", "/b", "/c", "/d", "/e"].map((folder) => isAtelierProject(folder, read)))).toEqual([true, true, false, false, false]);
  });

  it("is shown after the listed projects, once, and without the file being touched", async () => {
    const read = disk({
      [FILE]: { projects: ["/repos/one"] },
      "/repos/one/package.json": { name: "one" },
      "/repos/two/package.json": { name: "two", atelier: { origin: "http://localhost:3002" } },
    });
    expect((await readProjects(FILE, read, "/repos/two")).projects.map((project) => project.id)).toEqual(["one", "two"]);
    expect((await readProjects(FILE, read, "/repos/one")).projects.map((project) => project.id)).toEqual(["one"]);
    expect((await readProjects("/nowhere/projects.json", read, "/repos/two")).projects.map((project) => project.id)).toEqual(["two"]);
    expect((await readProjects(FILE, read, "/repos/unnamed")).problems).toEqual(["This folder: it needs an id, or a repo whose package.json has a name."]);
  });
});

describe("packaged server", () => {
  const root = `${sep}pkg${sep}dist${sep}app`;

  it("names only files inside the built page", () => {
    expect(assetPath(root, "/")).toBe(join(root, "index.html"));
    expect(assetPath(root, "/?x=1")).toBe(join(root, "index.html"));
    expect(assetPath(root, "/assets/index-abc.js")).toBe(join(root, "assets", "index-abc.js"));
    for (const url of ["/../server/cli.js", "/assets/../../../etc/passwd", "/%2e%2e/secret", "/..%2fsecret", "/a\\..\\b", "/%00", "/%E0%A4%A", "assets/x.js", "//etc/passwd/.."]) {
      expect(assetPath(root, url), url).toBeNull();
    }
  });

  it("answers only to the names a browser on this machine uses for it", () => {
    for (const host of ["localhost:3200", "127.0.0.1:3200", "[::1]:3200"]) expect(allowedHost(host, 3200), host).toBe(true);
    for (const host of ["localhost:3201", "localhost", "evil.example:3200", "localhost.evil.example:3200", "192.168.1.20:3200", "", undefined]) expect(allowedHost(host, 3200), String(host)).toBe(false);
  });

  describe("over a real connection", () => {
    let folder: string;
    let port: number;
    let close: () => void;
    const git = vi.fn(async () => ({ state: "not-a-repository" }) as const);

    const get = (path: string, headers: Record<string, string> = {}, method = "GET") => new Promise<{ status: number; type: string | undefined; cache: string | undefined; body: string }>((resolve, reject) => {
      const outgoing = httpRequest({ host: "127.0.0.1", port, path, method, headers: { Host: `localhost:${port}`, ...headers } }, (response) => {
        let body = "";
        response.setEncoding("utf8").on("data", (chunk: string) => { body += chunk; }).on("end", () => resolve({ status: response.statusCode ?? 0, type: response.headers["content-type"], cache: response.headers["cache-control"], body }));
      });
      outgoing.on("error", reject).end();
    });

    beforeAll(async () => {
      folder = await mkdtemp(join(tmpdir(), "agent-atelier-test-"));
      await mkdir(join(folder, "app", "assets"), { recursive: true });
      await writeFile(join(folder, "app", "index.html"), "<!doctype html><title>Atelier</title>");
      await writeFile(join(folder, "app", "assets", "index-abc.js"), "console.log(1)");
      await writeFile(join(folder, "secret.txt"), "outside the page");
      await mkdir(join(folder, "project"));
      await writeFile(join(folder, "project", "package.json"), JSON.stringify({ name: "project", atelier: { origin: "http://localhost:3000" } }));
      await writeFile(join(folder, "projects.json"), JSON.stringify({ projects: [join(folder, "project")] }));
      // Port 0 asks the system for a free one; the listener needs to know it to check the Host header.
      const server = createServer((request, response) => handle(request, response));
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      port = (server.address() as AddressInfo).port;
      const handle = requestListener({ root: join(folder, "app"), port, file: join(folder, "projects.json"), git });
      close = () => { server.closeAllConnections(); server.close(); };
    });
    afterAll(async () => { close(); await rm(folder, { recursive: true, force: true }); });

    it("serves the page and its files, and nothing else on disk", async () => {
      expect(await get("/")).toMatchObject({ status: 200, type: "text/html; charset=utf-8", cache: "no-cache", body: "<!doctype html><title>Atelier</title>" });
      expect(await get("/assets/index-abc.js")).toMatchObject({ status: 200, type: "text/javascript; charset=utf-8", cache: "public, max-age=31536000, immutable", body: "console.log(1)" });
      expect((await get("/", {}, "HEAD"))).toMatchObject({ status: 200, body: "" });
      for (const path of ["/missing.js", "/assets", "/../secret.txt", "/%2e%2e/secret.txt", "/assets/../../secret.txt"]) expect((await get(path)).status, path).toBe(404);
      expect((await get("/", {}, "POST")).status).toBe(405);
    });

    it("answers its endpoints to its own page only", async () => {
      const own = { "Sec-Fetch-Site": "same-origin" };
      const list = await get("/__atelier/projects", own);
      expect(list.status).toBe(200);
      expect(JSON.parse(list.body).projects).toEqual([{ id: "project", name: "Project", origin: "http://localhost:3000", repo: join(folder, "project") }]);
      expect(JSON.parse((await get("/__atelier/branches/project", own)).body)).toEqual({ state: "not-a-repository" });
      expect((await get("/__atelier/projects")).status).toBe(403);
      expect((await get("/__atelier/projects", { "Sec-Fetch-Site": "cross-site" })).status).toBe(403);
    });

    it("refuses a request that names it by another host, before reading anything", async () => {
      git.mockClear();
      for (const path of ["/", "/__atelier/projects", "/__atelier/branches/project"]) {
        expect((await get(path, { Host: `evil.example:${port}`, "Sec-Fetch-Site": "same-origin" })).status, path).toBe(403);
      }
      expect(git).not.toHaveBeenCalled();
    });
  });
});
