/**
 * The projects Atelier knows about. This registry holds identity and where a
 * project's preview answers; everything about its screens comes from the
 * manifest the project serves itself (docs/connector.md).
 */

export interface Project {
  id: string;
  name: string;
  /** Where the project's preview server answers, or null while it has none. */
  origin: string | null;
  /** How to start the preview by hand. Atelier shows this; it never runs it. */
  start?: { cwd: string; command: string };
}

const REGISTRY: readonly Project[] = [
  { id: "palier", name: "Palier", origin: "http://localhost:3100", start: { cwd: "/Users/nico/Sites/palier", command: "npm run dev" } },
  { id: "marvin", name: "Marvin", origin: "http://localhost:3210", start: { cwd: "/Users/nico/Sites/marvin", command: "npm run dev" } },
];

/**
 * `VITE_ORIGIN_<ID>` in `.env.local` points a project at another address, such
 * as a worktree's preview. The registered start command belongs to the
 * registered address, so an overridden project shows none.
 */
export const PROJECTS: readonly Project[] = REGISTRY.map((entry) => {
  const override: unknown = import.meta.env[`VITE_ORIGIN_${entry.id.toUpperCase()}`];
  return typeof override === "string" && override ? { id: entry.id, name: entry.name, origin: override.replace(/\/+$/, "") } : entry;
});
