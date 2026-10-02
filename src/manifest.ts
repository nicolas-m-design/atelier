/**
 * The contract a project serves at `<origin>/canvagent.json` (docs/connector.md).
 * Canvagent trusts nothing in it: every field is checked before use.
 */

export const MANIFEST_PATH = "/canvagent.json";
export const MANIFEST_VERSION = 1;
/**
 * The address and version field from before the rename of 2026-10-02, when
 * this workspace was called Atelier. Still read, so a project connected
 * earlier keeps working until it serves the new ones.
 */
export const LEGACY_MANIFEST_PATH = "/atelier.json";
const LEGACY_VERSION_FIELD = "atelier";

export interface ManifestScreen {
  id: string;
  title: string;
  /** A short line under the title, such as the persona. */
  caption?: string;
  /** Path on the project's own origin. Its state must come from the URL alone. */
  route: string;
  /** Frame size in CSS pixels; falls back to the manifest's `frame`. */
  width?: number;
  height?: number;
}

export interface ManifestGroup {
  id: string;
  /** A short ordinal shown before the title, such as "01". */
  label?: string;
  title: string;
  description?: string;
  screens: ManifestScreen[];
}

export interface ManifestLink {
  id: string;
  title: string;
  route: string;
  /** The narrowest width the page is designed for. With less room, Canvagent scales it down. */
  width?: number;
}

export interface Manifest {
  canvagent: typeof MANIFEST_VERSION;
  name: string;
  frame: { width: number; height: number };
  groups: ManifestGroup[];
  /** Project pages outside the canvas, such as a UI library. Listed above the screens and shown whole. */
  links: ManifestLink[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 200;
const isDimension = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 240 && value <= 4096;
/** A same-origin path only: never a full URL, a protocol-relative URL or a backslash trick. */
const isRoute = (value: unknown): value is string => isText(value) && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\");

function optionalText(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (!isText(value)) throw new Error(`${field} must be a short non-empty string`);
  return value;
}

/** Returns a checked manifest, or throws with the first problem found. */
export function parseManifest(input: unknown): Manifest {
  if (!isRecord(input)) throw new Error("manifest must be an object");
  if ((input.canvagent ?? input[LEGACY_VERSION_FIELD]) !== MANIFEST_VERSION) throw new Error(`unsupported manifest version (expected ${MANIFEST_VERSION})`);
  if (!isText(input.name)) throw new Error("name must be a short non-empty string");
  if (!isRecord(input.frame) || !isDimension(input.frame.width) || !isDimension(input.frame.height)) throw new Error("frame must give an integer width and height");
  if (!Array.isArray(input.groups)) throw new Error("groups must be a list");

  const seen = new Set<string>();
  const groups = input.groups.map((group, g): ManifestGroup => {
    if (!isRecord(group) || !isText(group.id) || !isText(group.title)) throw new Error(`group ${g + 1} needs an id and a title`);
    if (!Array.isArray(group.screens)) throw new Error(`group "${group.id}" needs a list of screens`);
    const screens = group.screens.map((screen, s): ManifestScreen => {
      if (!isRecord(screen) || !isText(screen.id) || !isText(screen.title)) throw new Error(`screen ${s + 1} in "${group.id}" needs an id and a title`);
      if (seen.has(screen.id)) throw new Error(`screen id "${screen.id}" is used twice`);
      seen.add(screen.id);
      if (!isRoute(screen.route)) throw new Error(`screen "${screen.id}" needs a route starting with one slash`);
      for (const side of ["width", "height"] as const) {
        if (screen[side] !== undefined && !isDimension(screen[side])) throw new Error(`screen "${screen.id}" has an invalid ${side}`);
      }
      return {
        id: screen.id, title: screen.title, route: screen.route,
        caption: optionalText(screen.caption, `screen "${screen.id}" caption`),
        width: screen.width as number | undefined, height: screen.height as number | undefined,
      };
    });
    return {
      id: group.id, title: group.title, screens,
      label: optionalText(group.label, `group "${group.id}" label`),
      description: optionalText(group.description, `group "${group.id}" description`),
    };
  });

  const links = (input.links === undefined ? [] : input.links);
  if (!Array.isArray(links)) throw new Error("links must be a list");
  return {
    canvagent: MANIFEST_VERSION,
    name: input.name,
    frame: { width: input.frame.width, height: input.frame.height },
    groups,
    links: links.map((link, l): ManifestLink => {
      if (!isRecord(link) || !isText(link.id) || !isText(link.title) || !isRoute(link.route)) throw new Error(`link ${l + 1} needs an id, a title and a route`);
      if (link.width !== undefined && !isDimension(link.width)) throw new Error(`link "${link.id}" has an invalid width`);
      return { id: link.id, title: link.title, route: link.route, width: link.width as number | undefined };
    }),
  };
}

export function screenIds(manifest: Manifest): string[] {
  return manifest.groups.flatMap((group) => group.screens.map((screen) => screen.id));
}
