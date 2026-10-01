import { describe, expect, it, vi } from "vitest";
import { createStore, parseSaved, STORAGE_KEY } from "../src/storage";

function memory(initial?: string) {
  const data = new Map<string, string>(initial ? [[STORAGE_KEY, initial]] : []);
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); }, data };
}

describe("saved state", () => {
  it("starts empty when nothing or nonsense is stored", () => {
    for (const raw of [null, "", "not json", "[]", "42"]) {
      expect(parseSaved(raw)).toEqual({ active: null, sidebar: true, projects: {} });
    }
  });

  it("keeps each project's view separate and drops malformed parts", () => {
    const saved = parseSaved(JSON.stringify({
      active: "marvin",
      sidebar: false,
      projects: {
        palier: { camera: { x: 10, y: 20, zoom: 0.4 }, selected: "photo-1" },
        marvin: { camera: { x: 0, y: 0, zoom: 99 }, selected: 7, manifest: { atelier: 1 } },
        broken: "nope",
      },
    }));
    expect(saved.active).toBe("marvin");
    expect(saved.sidebar).toBe(false);
    expect(saved.projects.palier).toEqual({ camera: { x: 10, y: 20, zoom: 0.4 }, selected: "photo-1" });
    expect(saved.projects.marvin).toEqual({});
    expect(saved.projects).not.toHaveProperty("broken");
  });

  it("writes after a short delay, merges per-project changes and survives a reload", () => {
    vi.useFakeTimers();
    const storage = memory();
    const store = createStore(storage, 250);
    store.updateProject("palier", { camera: { x: 1, y: 2, zoom: 0.5 } });
    store.updateProject("palier", { selected: "home" });
    store.updateProject("marvin", { selected: null });
    expect(storage.data.size).toBe(0);
    vi.advanceTimersByTime(250);
    const reloaded = createStore(storage).get();
    expect(reloaded.projects.palier).toEqual({ camera: { x: 1, y: 2, zoom: 0.5 }, selected: "home" });
    expect(reloaded.projects.marvin).toEqual({ selected: null });
    vi.useRealTimers();
  });

  it("flushes immediately on request and tolerates storage that throws", () => {
    const storage = memory();
    const store = createStore(storage, 10_000);
    store.update((saved) => { saved.active = "palier"; });
    store.flush();
    expect(parseSaved(storage.getItem(STORAGE_KEY)).active).toBe("palier");
    const failing = createStore({ getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("full"); } });
    expect(() => { failing.update((saved) => { saved.sidebar = false; }); failing.flush(); }).not.toThrow();
    expect(failing.get().sidebar).toBe(false);
  });
});
