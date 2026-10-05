import { describe, expect, it } from "vitest";
import { layoutBoard } from "../src/layout";
import { parseManifest } from "../src/manifest";
import { DEFAULT_VIEWPORT, DEFAULT_VIEWPORTS, DEVICE_VIEWPORTS } from "../src/viewports";

const source = {
  atelier: 1, name: "Example", frame: { width: 1280, height: 720 },
  groups: [{ id: "screens", title: "Screens", screens: [
    { id: "home", title: "Home", route: "/home" },
    { id: "phone", title: "Phone", route: "/phone", width: 390, height: 844 },
    { id: "compact", title: "Compact review", route: "/compact", width: 1280, height: 720 },
    { id: "partial", title: "Width-only review", route: "/partial", width: 1100 },
  ] }],
};

const dimensions = (board: ReturnType<typeof layoutBoard>) => board.screens.map(({ rect: { width, height } }) => [width, height]);

describe("device viewports", () => {
  it("opens at the full desktop preset without changing source dimensions", () => {
    const manifest = parseManifest(source);
    const before = structuredClone(manifest);
    expect(dimensions(layoutBoard(manifest, DEFAULT_VIEWPORT))).toEqual(Array(4).fill([1920, 1080]));
    expect(manifest).toEqual(before);
  });

  it("applies every preset exactly to mixed screens and keeps frames from overlapping", () => {
    const manifest = parseManifest(source);
    for (const preset of Object.values(DEVICE_VIEWPORTS).flat()) {
      const board = layoutBoard(manifest, preset.id);
      expect(dimensions(board)).toEqual(Array(4).fill([preset.width, preset.height]));
      for (let i = 1; i < board.screens.length; i++) {
        expect(board.screens[i]!.rect.x).toBeGreaterThan(board.screens[i - 1]!.rect.x + board.screens[i - 1]!.rect.width);
      }
    }
  });

  it("restores all original mixed and partially overridden dimensions with Project sizes", () => {
    const manifest = parseManifest(source);
    layoutBoard(manifest, "mobile-compact");
    expect(dimensions(layoutBoard(manifest, "project"))).toEqual([[1280, 720], [390, 844], [1280, 720], [1100, 720]]);
  });

  it("keeps at most three numeric presets per device and a valid default on device switches", () => {
    for (const device of ["desktop", "tablet", "mobile"] as const) {
      const presets = DEVICE_VIEWPORTS[device];
      expect(presets.length).toBeGreaterThan(0);
      expect(presets.length).toBeLessThanOrEqual(3);
      expect(presets.some(({ id }) => id === DEFAULT_VIEWPORTS[device])).toBe(true);
    }
  });
});
