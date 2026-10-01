/**
 * The projects as the browser sees them: the registry, with any local address
 * override applied. Everything about a project's screens comes from the
 * manifest the project serves itself (docs/connector.md).
 */
import { REGISTRY, type Project } from "./registry";

export type { Project };

/**
 * `VITE_ORIGIN_<ID>` in `.env.local` points a project at another address, such
 * as a worktree's preview. The registered start command belongs to the
 * registered address, so an overridden project shows none.
 */
export const PROJECTS: readonly Project[] = REGISTRY.map((entry) => {
  const override: unknown = import.meta.env[`VITE_ORIGIN_${entry.id.toUpperCase()}`];
  return typeof override === "string" && override ? { id: entry.id, name: entry.name, origin: override.replace(/\/+$/, "") } : entry;
});
