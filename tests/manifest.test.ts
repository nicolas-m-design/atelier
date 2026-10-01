import { describe, expect, it } from "vitest";
import { layoutBoard, retainFrames } from "../src/layout";
import { parseManifest, screenIds } from "../src/manifest";
import { checkProject } from "../src/status";

const valid = {
  atelier: 1,
  name: "Example",
  frame: { width: 1280, height: 720 },
  groups: [
    { id: "a", label: "01", title: "First", description: "Two screens.", screens: [
      { id: "one", title: "One", caption: "Persona", route: "/screens/one" },
      { id: "two", title: "Two", route: "/screens/two?state=x", width: 1440, height: 900 },
    ] },
    { id: "b", title: "Second", screens: [{ id: "three", title: "Three", route: "/screens/three" }] },
    { id: "c", title: "Empty", screens: [] },
  ],
  links: [{ id: "library", title: "Library", route: "/ui" }],
};

const manifestLinks = (links: unknown[]) => parseManifest({ ...valid, links }).links;

describe("manifest", () => {
  it("accepts a valid manifest and keeps only known fields", () => {
    const manifest = parseManifest({ ...valid, extra: "ignored" });
    expect(screenIds(manifest)).toEqual(["one", "two", "three"]);
    expect(manifest).not.toHaveProperty("extra");
    expect(parseManifest({ ...valid, links: undefined }).links).toEqual([]);
  });

  it("keeps a linked page's design width and rejects an unusable one", () => {
    expect(manifestLinks([{ id: "library", title: "Library", route: "/ui" }])).toEqual([{ id: "library", title: "Library", route: "/ui", width: undefined }]);
    expect(manifestLinks([{ id: "library", title: "Library", route: "/ui", width: 1280 }])[0]!.width).toBe(1280);
    for (const width of [0, 12.5, "1280", 99999]) {
      expect(() => manifestLinks([{ id: "library", title: "Library", route: "/ui", width }]), String(width)).toThrow(/width/);
    }
  });

  it("rejects routes that could leave the project's origin", () => {
    for (const route of ["https://example.com/", "//example.com/", "screens/one", "/\\example.com", ""]) {
      const bad = { ...valid, groups: [{ id: "a", title: "A", screens: [{ id: "one", title: "One", route }] }] };
      expect(() => parseManifest(bad), route).toThrow();
    }
    expect(() => parseManifest({ ...valid, links: [{ id: "x", title: "X", route: "javascript:alert(1)" }] })).toThrow();
  });

  it("rejects wrong versions, duplicate ids and bad dimensions", () => {
    expect(() => parseManifest({ ...valid, atelier: 2 })).toThrow(/version/);
    expect(() => parseManifest({ ...valid, frame: { width: 0, height: 720 } })).toThrow(/frame/);
    expect(() => parseManifest({ ...valid, groups: [valid.groups[0], { id: "z", title: "Z", screens: [{ id: "one", title: "Again", route: "/again" }] }] })).toThrow(/twice/);
    expect(() => parseManifest(null)).toThrow();
  });
});

describe("board layout", () => {
  const board = layoutBoard(parseManifest(valid));

  it("places each group on its own row and skips empty groups", () => {
    expect(board.groups.map((group) => group.id)).toEqual(["a", "b"]);
    expect(board.groups[1]!.y).toBeGreaterThan(board.groups[0]!.rect.y + board.groups[0]!.rect.height);
  });

  it("uses each screen's own dimensions, falling back to the manifest frame", () => {
    const [one, two] = board.screens;
    expect(one!.rect).toMatchObject({ x: 0, width: 1280, height: 720 });
    expect(two!.rect).toMatchObject({ width: 1440, height: 900 });
    expect(two!.rect.x).toBeGreaterThan(one!.rect.x + one!.rect.width);
    expect(board.width).toBe(two!.rect.x + 1440);
    expect(board.groups[0]!.rect.height).toBe(two!.rect.y + 900);
  });
});

describe("frame loading", () => {
  const candidate = (id: string, near: boolean, distance: number, keep = false) => ({ id, near, distance, keep });

  it("loads frames near the viewport and leaves distant ones unloaded", () => {
    expect([...retainFrames(new Set(), [candidate("a", true, 0), candidate("b", false, 9000)], 12)]).toEqual(["a"]);
  });

  it("keeps a frame loaded after it scrolls away, until the limit is passed", () => {
    expect([...retainFrames(new Set(["a"]), [candidate("a", false, 5000), candidate("b", true, 0)], 12)].sort()).toEqual(["a", "b"]);
    const next = retainFrames(new Set(["a", "b"]), [candidate("a", false, 5000), candidate("b", false, 9000), candidate("c", true, 0)], 2);
    expect([...next].sort()).toEqual(["a", "c"]);
  });

  it("never drops the frame being interacted with, and forgets removed screens", () => {
    const next = retainFrames(new Set(["gone", "far"]), [candidate("far", false, 9000, true), candidate("c", true, 0)], 1);
    expect([...next].sort()).toEqual(["c", "far"]);
  });
});

describe("project status", () => {
  const json = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body }) as Response;

  it("is online when a valid manifest is served", async () => {
    const status = await checkProject("http://localhost:1", async () => json(valid));
    expect(status.state).toBe("online");
  });

  it("is offline when nothing answers either request", async () => {
    const status = await checkProject("http://localhost:1", async () => { throw new TypeError("Failed to fetch"); });
    expect(status).toEqual({ state: "offline" });
  });

  it("is unconnected when a server answers without a readable or valid manifest", async () => {
    const opaque = await checkProject("http://localhost:1", async (_url, init) => { if (init.mode === "no-cors") return json(null); throw new TypeError("blocked"); });
    expect(opaque.state).toBe("unconnected");
    expect((await checkProject("http://localhost:1", async () => json(null, false, 404))).state).toBe("unconnected");
    expect((await checkProject("http://localhost:1", async () => json({ atelier: 1 }))).state).toBe("unconnected");
  });
});
