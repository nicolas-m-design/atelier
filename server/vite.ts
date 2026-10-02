/** Mounts Atelier's endpoints on the dev server. They exist only under `npm run dev`. */
import type { Plugin } from "vite";
import { listener } from "./handler.ts";
import { projectsFile } from "./projects.ts";

export function atelierServer(): Plugin {
  let env: Record<string, unknown> = {};
  return {
    name: "atelier-server",
    // Vite has read `.env.local` by now; address overrides come from there.
    configResolved(config) { env = config.env; },
    configureServer(server) { server.middlewares.use(listener({ file: projectsFile(), env })); },
  };
}
