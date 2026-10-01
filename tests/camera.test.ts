import { describe, expect, it } from "vitest";
import { centerOn, clampZoom, fitPage, isCamera, isNear, MAX_ZOOM, MIN_ZOOM, project, zoomAt } from "../src/camera";

describe("camera", () => {
  it("keeps the board point under the pointer fixed while zooming", () => {
    const camera = { x: 40, y: -120, zoom: 0.3 };
    const point = { x: 500, y: 300 };
    const before = { x: (point.x - camera.x) / camera.zoom, y: (point.y - camera.y) / camera.zoom };
    const next = zoomAt(camera, 0.9, point);
    expect(next.zoom).toBe(0.9);
    expect((point.x - next.x) / next.zoom).toBeCloseTo(before.x);
    expect((point.y - next.y) / next.zoom).toBeCloseTo(before.y);
  });

  it("clamps zoom to its limits", () => {
    expect(clampZoom(0)).toBe(MIN_ZOOM);
    expect(clampZoom(10)).toBe(MAX_ZOOM);
    expect(zoomAt({ x: 0, y: 0, zoom: 1 }, 99, { x: 0, y: 0 }).zoom).toBe(MAX_ZOOM);
  });

  it("centres a rectangle and never exceeds the requested zoom", () => {
    const rect = { x: 1456, y: 432, width: 1280, height: 720 };
    const viewport = { width: 1000, height: 700 };
    const camera = centerOn(rect, viewport, { width: 96, height: 100 }, 1);
    const shown = project(rect, camera);
    expect(shown.x + shown.width / 2).toBeCloseTo(500);
    expect(shown.y + shown.height / 2).toBeCloseTo(350);
    expect(shown.width).toBeLessThanOrEqual(viewport.width - 96);
    expect(centerOn({ x: 0, y: 0, width: 100, height: 100 }, viewport, { width: 0, height: 0 }, 1).zoom).toBe(1);
  });

  it("treats frames just outside the viewport as near, and distant ones as not", () => {
    const viewport = { width: 1000, height: 700 };
    expect(isNear({ x: 1200, y: 0, width: 300, height: 200 }, viewport, 500)).toBe(true);
    expect(isNear({ x: 1600, y: 0, width: 300, height: 200 }, viewport, 500)).toBe(false);
    expect(isNear({ x: -900, y: 0, width: 300, height: 200 }, viewport, 500)).toBe(false);
  });

  it("accepts only finite cameras within the zoom limits", () => {
    expect(isCamera({ x: 1, y: 2, zoom: 0.5 })).toBe(true);
    expect(isCamera({ x: 1, y: 2, zoom: 0 })).toBe(false);
    expect(isCamera({ x: Number.NaN, y: 2, zoom: 1 })).toBe(false);
    expect(isCamera({ x: "1", y: 2, zoom: 1 })).toBe(false);
    expect(isCamera(null)).toBe(false);
  });
});

describe("linked page fit", () => {
  it("fills the area when there is room or no design width", () => {
    expect(fitPage({ width: 1600, height: 900 }, 1280)).toEqual({ width: 1600, height: 900, scale: 1 });
    expect(fitPage({ width: 900, height: 700 })).toEqual({ width: 900, height: 700, scale: 1 });
    expect(fitPage({ width: 0, height: 0 }, 1280).scale).toBe(1);
  });

  it("lays a wide page out at its design width and scales it to the area", () => {
    const fit = fitPage({ width: 960, height: 600 }, 1280);
    expect(fit).toEqual({ width: 1280, height: 800, scale: 0.75 });
    expect(fit.width * fit.scale).toBe(960);
    expect(fit.height * fit.scale).toBeGreaterThanOrEqual(600);
  });
});
