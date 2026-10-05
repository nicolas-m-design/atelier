/**
 * Lays a manifest out on the board: one row per group, screens left to right.
 * All measurements are board pixels (source pixels at zoom 1). The proportions
 * follow Palier's canvas, where a 720 px frame was drawn 260 px tall.
 */
import type { Rect } from "./camera";
import type { Manifest, ManifestGroup, ManifestScreen } from "./manifest";
import { frameSize, type ViewportMode } from "./viewports";

/** Text sizes in board pixels; the canvas multiplies them by the zoom. */
export const TYPE = {
  groupTitle: { size: 66, line: 88 },
  groupDescription: { size: 39, line: 55, gap: 17 },
  screenTitle: { size: 39, line: 55 },
  screenCaption: { size: 30, line: 44, gap: 11 },
  /** Space between a screen's label and its frame. */
  labelGap: 33,
} as const;

/** From the top of a group's heading to the top of its frames. */
const FRAME_TOP = 432;
const COLUMN_GAP = 176;
const ROW_GAP = 176;

export interface BoardScreen extends ManifestScreen { group: string; rect: Rect }
export interface BoardGroup extends Omit<ManifestGroup, "screens"> {
  /** The heading's top-left corner. */
  x: number;
  y: number;
  /** The row's extent: heading, labels and frames. */
  rect: Rect;
  screens: BoardScreen[];
}
export interface Board { groups: BoardGroup[]; screens: BoardScreen[]; width: number; height: number }

export function layoutBoard(manifest: Manifest, viewport: ViewportMode = "project"): Board {
  let y = 0;
  const groups = manifest.groups.filter((group) => group.screens.length > 0).map((group): BoardGroup => {
    let x = 0;
    const screens = group.screens.map((screen): BoardScreen => {
      const { width, height } = frameSize(manifest, screen, viewport);
      const placed = { ...screen, group: group.id, rect: { x, y: y + FRAME_TOP, width, height } };
      x += width + COLUMN_GAP;
      return placed;
    });
    const rect = { x: 0, y, width: x - COLUMN_GAP, height: FRAME_TOP + Math.max(...screens.map((screen) => screen.rect.height)) };
    const { screens: _, ...heading } = group;
    y += rect.height + ROW_GAP;
    return { ...heading, x: 0, y: rect.y, rect, screens };
  });
  return {
    groups,
    screens: groups.flatMap((group) => group.screens),
    width: Math.max(0, ...groups.map((group) => group.rect.width)),
    height: Math.max(0, y - ROW_GAP),
  };
}

/**
 * Which frames hold a live preview. A frame loads when it comes near the
 * viewport and then stays loaded, so its in-frame state survives panning,
 * until more than `limit` are loaded; then the farthest idle ones are dropped.
 */
export function retainFrames(previous: ReadonlySet<string>, candidates: { id: string; near: boolean; distance: number; keep: boolean }[], limit: number): Set<string> {
  const known = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const next = new Set([...previous].filter((id) => known.has(id)));
  for (const candidate of candidates) if (candidate.near || candidate.keep) next.add(candidate.id);
  const idle = [...next].map((id) => known.get(id)!).filter((candidate) => !candidate.near && !candidate.keep).sort((a, b) => b.distance - a.distance);
  while (next.size > limit && idle.length) next.delete(idle.shift()!.id);
  return next;
}
