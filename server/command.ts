/** What the `agent-atelier` command was asked to do. Text in, a decision out; nothing here runs. */
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { parseOrigin } from "../src/projects.ts";

/** The page's saved canvas positions belong to this address, so it is the same every time. */
export const DEFAULT_PORT = 3200;

export const USAGE = `agent-atelier                  serve the workspace at http://localhost:${DEFAULT_PORT}
agent-atelier add [folder]     add a project to the list (the current folder by default)

Serving:
  --origin <id>=<address>      show a listed project at another address, for this run
  --port <number>              another port; saved canvas positions belong to each address

Adding:
  --origin <address>           where the project's preview answers, such as http://localhost:3000
  --start <command>            the command that starts the preview
  --id <id>                    lowercase letters, digits and hyphens; needed without a package.json
  --name <name>                the name shown, when the id with a capital will not do

  -h, --help
  -v, --version`;

export type Command =
  | { run: "serve"; port: number; overrides: Map<string, string> }
  | { run: "add"; repo: string; origin?: string; start?: string; id?: string; name?: string }
  | { run: "help" }
  | { run: "version" };

function address(value: string): string {
  let origin: string | null = null;
  try { origin = parseOrigin(value); } catch { /* reported below */ }
  if (!origin) throw new Error(`"${value}" is not an address such as http://localhost:3000.`);
  return origin;
}

/** Reads the arguments after the command's name. Throws with a sentence for the person who typed them. */
export function parseCommand(args: string[], cwd: string): Command {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      origin: { type: "string", multiple: true },
      port: { type: "string" },
      start: { type: "string" },
      id: { type: "string" },
      name: { type: "string" },
      help: { type: "boolean", short: "h" },
      version: { type: "boolean", short: "v" },
    },
  });
  if (values.help) return { run: "help" };
  if (values.version) return { run: "version" };
  const [verb = "serve", folder, ...rest] = positionals;
  const origins = values.origin ?? [];

  if (verb === "add") {
    if (rest.length > 0) throw new Error("add takes one folder.");
    if (values.port !== undefined) throw new Error("--port belongs to serving, not to add.");
    if (origins.length > 1) throw new Error("add takes one --origin.");
    return { run: "add", repo: resolve(cwd, folder ?? "."), origin: origins[0] === undefined ? undefined : address(origins[0]), start: values.start, id: values.id, name: values.name };
  }

  if (verb !== "serve" || folder !== undefined) throw new Error(`"${positionals.join(" ")}" is not something agent-atelier does.`);
  for (const option of ["start", "id", "name"] as const) if (values[option] !== undefined) throw new Error(`--${option} belongs to add.`);
  const port = values.port === undefined ? DEFAULT_PORT : Number(values.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`"${values.port}" is not a port.`);
  const overrides = new Map<string, string>();
  for (const origin of origins) {
    const at = origin.indexOf("=");
    if (at < 1) throw new Error(`When serving, --origin names a project: --origin palette=http://localhost:3001. Got "${origin}".`);
    overrides.set(origin.slice(0, at), address(origin.slice(at + 1)));
  }
  return { run: "serve", port, overrides };
}
