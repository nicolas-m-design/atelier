/** Owns one process group. Only the coordinator keeps stdin open. Never import this entry point. */
import { spawn } from "node:child_process";
import { mkdir, writeFile, realpath, stat, readdir, readlink, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve, isAbsolute, basename } from "node:path";
import { parseManifest } from "../src/manifest.ts";
import { inside, leasePath, message, previewEnvironment, RUN_ID, sleep, validateRecipe, type GuardianInput, type GuardianEvent, type PreviewCommand } from "./previews.ts";

let closing = false;
const control = createWriteStream("", { fd: 3, autoClose: false });
control.on("error", () => shutdown());
function emit(event: GuardianEvent) { control.write(JSON.stringify(event) + "\n"); }
function shutdown() {
  if (closing) return;
  closing = true;
  // Ignore our own TERM long enough to escalate the entire group, including ourselves.
  process.kill(-process.pid, "SIGTERM");
  setTimeout(() => process.kill(-process.pid, "SIGKILL"), 350);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
process.stdin.on("end", shutdown);
process.stdin.on("error", shutdown);
process.on("uncaughtException", () => { emit({ error: "Preview guardian failed." }); shutdown(); });
process.on("unhandledRejection", () => { emit({ error: "Preview guardian failed." }); shutdown(); });

const env = previewEnvironment();
function command(argv: PreviewCommand, cwd: string, commandEnv = env, timeout = 10_000): Promise<string> {
  if (closing) return Promise.reject(new Error("Preview cancelled."));
  return new Promise((resolve, reject) => {
    const child = spawn(argv[0], argv.slice(1), { cwd, env: commandEnv, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", exceeded = false;
    const timer = setTimeout(() => { reject(new Error("Preview command timed out.")); shutdown(); }, timeout);
    child.stdout.on("data", chunk => {
      if (out.length + chunk.length > 1024 * 1024) exceeded = true;
      else out += String(chunk);
    });
    child.stderr.resume();
    child.once("error", () => { clearTimeout(timer); reject(new Error(`Could not run ${basename(argv[0])}.`)); });
    child.once("close", code => {
      clearTimeout(timer);
      if (exceeded) reject(new Error("Preview command output exceeded its limit."));
      else if (code === 0) resolve(out);
      else reject(new Error(`${basename(argv[0])} failed (exit ${code}).`));
    });
  });
}
async function contained(root: string, path: string) {
  const full = await realpath(resolve(root, path));
  if (!inside(root, full)) throw new Error("Recipe path leaves the preview export.");
  return full;
}
async function validateLinks(root: string, directory = root): Promise<void> {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) await validateLinks(root, path);
    else if (item.isSymbolicLink()) {
      const target = await readlink(path);
      if (isAbsolute(target) || !inside(root, resolve(directory, target))) throw new Error("Export contains a symlink outside the preview.");
      const actual = await realpath(path).catch(() => null);
      if (actual && !inside(root, actual)) throw new Error("Export contains a symlink outside the preview.");
    }
  }
}
async function assignedPort(): Promise<number> {
  const socket = createServer();
  await new Promise<void>((resolve, reject) => { socket.once("error", reject); socket.listen(0, "127.0.0.1", resolve); });
  const address = socket.address();
  if (!address || typeof address === "string") throw new Error("No preview port was assigned.");
  await new Promise<void>((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
  return address.port;
}

/** macOS lsof field output; all listeners, including the other address family, must be ours. */
async function ownsPort(port: number, cwd: string): Promise<boolean> {
  let text: string;
  try { text = await command(["/usr/sbin/lsof", "-nP", "-a", `-iTCP:${port}`, "-sTCP:LISTEN", "-Fpgn"], cwd); }
  catch (error) {
    // lsof exits 1 when nothing matches; other failures must not be accepted as readiness.
    if (message(error) === "lsof failed (exit 1).") return false;
    throw error;
  }
  let group = "", listeners = 0;
  for (const line of text.trim().split("\n")) {
    if (line.startsWith("p")) group = "";
    if (line.startsWith("g")) group = line.slice(1);
    if (line.startsWith("n")) {
      listeners++;
      if (group !== String(process.pid)) throw new Error("The preview port has a foreign listener.");
      if (line !== `n127.0.0.1:${port}` && line !== `n[::1]:${port}`) throw new Error("The preview must listen only on loopback.");
    }
  }
  return listeners > 0;
}

async function manifestAt(origin: string) {
  const response = await fetch(origin + "/atelier.json", { signal: AbortSignal.timeout(2500), redirect: "error" });
  if (!response.ok) { await response.body?.cancel(); throw new Error(`Manifest answered ${response.status}.`); }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Manifest is empty.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > 512 * 1024) throw new Error("Manifest is too large.");
      chunks.push(part.value);
    }
    return parseManifest(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } finally { await reader.cancel().catch(() => {}); }
}

async function run(input: GuardianInput) {
  if (!RUN_ID.test(input.id) || basename(input.directory) !== input.id) throw new Error("Invalid run directory.");
  const recipe = validateRecipe(input.recipe);
  await mkdir(input.directory, { mode: 0o700 });
  const lease = createServer(socket => socket.end());
  await new Promise<void>((resolve, reject) => { lease.once("error", reject); lease.listen(leasePath(input.id), resolve); });
  await writeFile(join(input.directory, "owner.json"), JSON.stringify({ atelierPreview: 1, id: input.id }), { flag: "wx", mode: 0o600 });
  const repo = await realpath(input.repo);
  const gitEnv = { ...env, GIT_OPTIONAL_LOCKS: "0", GIT_CEILING_DIRECTORIES: dirname(repo) };
  const git = (...args: string[]) => command(["/usr/bin/git", ...args], repo, gitEnv);
  const top = await git("rev-parse", "--show-toplevel");
  if (await realpath(top.trim()) !== repo) throw new Error("Registered folder must be the repository root.");
  const ref = `refs/heads/${input.branch}`;
  await git("check-ref-format", ref);
  const commit = (await git("rev-parse", "--verify", "--end-of-options", `${ref}^{commit}`)).trim();
  if (!/^[a-f0-9]{40,64}$/.test(commit)) throw new Error("Branch has no commit.");
  emit({ phase: "preparing" });
  const archive = join(input.directory, "snapshot.tar");
  const source = join(input.directory, "source");
  await mkdir(source);
  await git("archive", "--format=tar", `--output=${archive}`, commit);
  // BSD tar's default extraction rejects traversal through archive symlinks and '..'.
  await command(["/usr/bin/tar", "-xf", archive, "--no-same-owner", "--no-same-permissions"], source);
  await rm(archive);
  await validateLinks(source);
  const cwd = await contained(source, recipe.dir);
  if (!(await stat(cwd)).isDirectory()) throw new Error("Recipe dir is not a directory.");
  for (const required of recipe.requires) {
    try { if (!(await stat(await contained(cwd, required))).isFile()) throw new Error(); }
    catch { throw new Error(`Required preview file is missing or outside the export: ${required}`); }
  }
  const runEnv = previewEnvironment(recipe.env);
  const checkNpm = async (argv: PreviewCommand) => {
    if (/^(npm|npm-cli\.js|npx|npx-cli\.js)$/.test(basename(argv[0])) || argv.some(arg => /(?:^|\/)(npm|npx)-cli\.js$/.test(arg))) {
      try {
        if (!(await stat(await contained(cwd, "package.json"))).isFile()) throw new Error();
      } catch { throw new Error("npm requires package.json in the preview working directory."); }
    }
  };
  for (const step of recipe.prepare) { await checkNpm(step); await command(step, cwd, runEnv, input.prepareTimeoutMs); }
  const port = await assignedPort();
  const argv = recipe.start.map(s => s.replaceAll("{port}", String(port))) as PreviewCommand;
  await checkNpm(argv);
  emit({ phase: "starting" });
  const server = spawn(argv[0], argv.slice(1), { cwd, env: runEnv, stdio: ["ignore", "ignore", "ignore"] });
  let serverExited = false;
  server.once("error", () => { serverExited = true; emit({ error: "Could not start preview command." }); shutdown(); });
  server.once("exit", () => { serverExited = true; emit({ error: "Preview command exited." }); shutdown(); });
  const origin = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + input.startupTimeoutMs;
  let lastError = "Preview did not start listening.";
  while (!closing && Date.now() < deadline) {
    if (await ownsPort(port, cwd)) {
      try {
        const manifest = await manifestAt(origin);
        if (closing || serverExited || !await ownsPort(port, cwd)) throw new Error("Preview stopped during readiness.");
        emit({ ready: { id: input.id, projectId: input.projectId, branch: input.branch, commit, origin, directory: input.directory, manifest } });
        return;
      } catch (error) { lastError = message(error); }
    }
    await sleep(100);
  }
  throw new Error(`Preview readiness failed: ${lastError}`);
}

let input = "", started = false;
const inputDeadline = setTimeout(() => shutdown(), 5000);
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk: string) => {
  if (started) return;
  input += chunk;
  if (input.length > 64 * 1024) { shutdown(); return; }
  if (!input.includes("\n")) return;
  started = true; clearTimeout(inputDeadline);
  void (async () => {
    try { await run(JSON.parse(input.slice(0, input.indexOf("\n"))) as GuardianInput); }
    catch (error) { emit({ error: message(error) }); shutdown(); }
  })();
});
process.stdin.resume();
