import { describe, expect, it } from "vitest";
import { layoutBoard } from "../src/layout";
import { parseManifest } from "../src/manifest";
import { DEFAULT_VIEWPORT } from "../src/viewports";

const source = {
  atelier: 1, name: "Example", frame: { width: 1280, height: 720 },
  groups: [{ id: "screens", title: "Screens", screens: [
    { id: "home", title: "Home", route: "/home" },
    { id: "phone", title: "Phone", route: "/phone", width: 390, height: 844 },
    { id: "compact", title: "Compact review", route: "/compact", width: 1280, height: 720 },
    { id: "partial", title: "Width-only review", route: "/partial", width: 1100 },
  ] }],
};

describe("desktop presentation", () => {
  it("gives inherited desktop frames room without changing exact review sizes or the source", () => {
    const manifest = parseManifest(source);
    const before = structuredClone(manifest);
    const board = layoutBoard(manifest, DEFAULT_VIEWPORT);
    expect(board.screens.map(({ rect: { width, height } }) => [width, height])).toEqual([
      [1440, 900], [390, 844], [1280, 720], [1100, 720],
    ]);
    expect(manifest).toEqual(before);
    for (let i = 1; i < board.screens.length; i++) {
      expect(board.screens[i]!.rect.x).toBeGreaterThan(board.screens[i - 1]!.rect.x + board.screens[i - 1]!.rect.width);
    }
  });

  it("can return to project sizes and compare desktop baselines", () => {
    const manifest = parseManifest(source);
    expect(layoutBoard(manifest, "project").screens[0]!.rect).toMatchObject({ width: 1280, height: 720 });
    expect(layoutBoard(manifest, "desktop").screens[0]!.rect).toMatchObject({ width: 1600, height: 1000 });
    expect(layoutBoard(manifest, "wide").screens[0]!.rect).toMatchObject({ width: 1920, height: 1080 });
  });

  it("does not shrink large desktops or enlarge phone, narrow or portrait defaults", () => {
    for (const frame of [{ width: 2560, height: 1440 }, { width: 390, height: 844 }, { width: 960, height: 720 }, { width: 1024, height: 1366 }]) {
      expect(layoutBoard(parseManifest({ ...source, frame }), DEFAULT_VIEWPORT).screens[0]!.rect).toMatchObject(frame);
    }
  });
});
