/**
 * The projects Canvagent knows about, as plain data. The browser reads it
 * through `projects.ts`; the dev server reads it directly to find a project's
 * repository (`server/branches.ts`), so nothing here may depend on either side.
 */

export interface Project {
  id: string;
  name: string;
  /** Where the project's preview server answers, or null while it has none. */
  origin: string | null;
  /** How to start the preview by hand. Canvagent shows this; it never runs it. */
  start?: { cwd: string; command: string };
  /** The project's main folder, where its local branches are read from. Canvagent never writes there. */
  repo?: string;
}

export const REGISTRY: readonly Project[] = [
  { id: "palier", name: "Palier", origin: "http://localhost:3100", start: { cwd: "/Users/nico/Sites/palier", command: "npm run dev" }, repo: "/Users/nico/Sites/palier" },
  { id: "marvin", name: "Marvin", origin: "http://localhost:3210", start: { cwd: "/Users/nico/Sites/marvin", command: "npm run dev" }, repo: "/Users/nico/Sites/marvin" },
];
