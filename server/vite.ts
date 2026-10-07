/** Mounts Atelier's endpoints on the dev server. They exist only under `npm run dev`. */
import { resolve } from "node:path";
import { createPreviewService } from "./previewService.ts";
import type { Plugin } from "vite";
import { envOverrides } from "../src/projects.ts";
import { listener } from "./handler.ts";
import { projectsFile } from "./projects.ts";

export function atelierServer(): Plugin {
  let env: Record<string, unknown> = {};
  return {
    name: "atelier-server",
    // Vite has read `.env.local` by now; address overrides come from there.
    configResolved(config) { env = config.env; },
    configureServer(server) {
      const file = projectsFile();
      const current = createPreviewService({ file, atelierPort: server.config.server.port ?? 3200, guardianPath: resolve(server.config.root, "server/previewGuardian.ts") });
      server.httpServer?.once("close", () => { void current.dispose().catch(() => {}); });
      server.middlewares.use(listener({ file, overrides: envOverrides(env), previews: current }));
    },
  };
}
