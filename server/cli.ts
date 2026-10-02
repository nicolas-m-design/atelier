#!/usr/bin/env node
/** The `agent-atelier` command: serve the workspace, or add a project to the list. */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseCommand, USAGE, type Command } from "./command.ts";
import { addProject, isAtelierProject, projectsFile, readProjects } from "./projects.ts";
import { serve } from "./serve.ts";

/** This package's own `package.json`, one folder up from the source and two from the built file. */
function version(): string {
  for (const path of ["../package.json", "../../package.json"]) {
    try {
      const manifest = JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as { name?: unknown; version?: unknown };
      if (manifest.name === "agent-atelier" && typeof manifest.version === "string") return manifest.version;
    } catch { /* try the next one */ }
  }
  return "unknown";
}

async function run(command: Command): Promise<void> {
  const file = projectsFile();

  if (command.run === "help") return console.log(USAGE);
  if (command.run === "version") return console.log(version());

  if (command.run === "add") {
    const project = await addProject(file, command);
    if (!project) return console.log(`${command.repo} is already listed in ${file}.`);
    console.log(`Added ${project.name} (${project.id}) to ${file}.`);
    if (!project.origin) console.log("It has no preview address yet. Give its entry an \"origin\", or add an \"atelier\" field with one to its package.json.");
    return;
  }

  const root = fileURLToPath(new URL("../app", import.meta.url));
  if (!existsSync(`${root}/index.html`)) throw new Error("The built page is missing from this copy of agent-atelier. In its repository, run it with npm run dev, or build it first.");
  // A project that has installed this package, or describes itself, is shown without being listed.
  const cwd = process.cwd();
  const extra = await isAtelierProject(cwd) ? cwd : undefined;
  try {
    await serve({ root, port: command.port, file, extra, overrides: (id) => command.overrides.get(id) });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
    throw new Error(`Port ${command.port} is already in use, perhaps by another Atelier. Saved canvas positions belong to this address, so Atelier does not move by itself. Stop the other server, or pass --port.`);
  }
  const list = await readProjects(file, undefined, extra);
  const unlisted = extra !== undefined && !(await readProjects(file)).projects.some((project) => project.repo === extra);
  console.log(`Atelier is at http://localhost:${command.port}`);
  console.log(`${list.projects.length === 1 ? "1 project" : `${list.projects.length} projects`}, listed in ${file}${unlisted ? ", plus this folder, which is not listed" : ""}`);
  for (const id of command.overrides.keys()) if (!list.projects.some((project) => project.id === id)) console.log(`No project has the id "${id}"; its --origin is not used.`);
  for (const problem of list.problems) console.log(problem);
}

try {
  await run(parseCommand(process.argv.slice(2), process.cwd()));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
