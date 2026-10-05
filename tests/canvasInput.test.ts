import { describe, expect, it } from "vitest";
import { bindCanvasInput } from "../src/canvasInput";
import type { Camera } from "../src/camera";

function harness() {
  const target = new EventTarget();
  Object.assign(target, { clientHeight: 600, getBoundingClientRect: () => ({ left: 10, top: 20 }), ownerDocument: { defaultView: new EventTarget() } });
  let camera: Camera = { x: 0, y: 0, zoom: 0.5 };
  const unbind = bindCanvasInput(target as HTMLElement, () => camera, (change) => { camera = change(camera); });
  const send = (type: string, fields = {}) => {
    const event = Object.assign(new Event(type, { cancelable: true }), { clientX: 110, clientY: 120, scale: 1, deltaMode: 0, deltaX: 0, deltaY: 0 }, fields);
    target.dispatchEvent(event);
    return event;
  };
  return { send, read: () => camera, unbind };
}

describe("canvas browser input", () => {
  it("uses cumulative Safari scale without compounding and keeps the board point anchored", () => {
    const h = harness();
    expect(h.send("gesturestart").defaultPrevented).toBe(true);
    h.send("gesturechange", { scale: 2 });
    expect(h.read()).toEqual({ x: -100, y: -100, zoom: 1 });
    h.send("gesturechange", { scale: 3 });
    expect(h.read()).toEqual({ x: -200, y: -200, zoom: 1.5 });
  });
  it("does not double-zoom when wheel events accompany a gesture, then restores wheel panning", () => {
    const h = harness();
    h.send("gesturestart");
    h.send("wheel", { ctrlKey: true, deltaY: -50 });
    expect(h.read().zoom).toBe(0.5);
    h.send("gestureend");
    h.send("wheel", { deltaX: 12, deltaY: 20 });
    expect(h.read()).toEqual({ x: -12, y: -20, zoom: 0.5 });
  });
  it("clamps zoom and can reverse after hitting the limit; rejects invalid scales", () => {
    const h = harness();
    h.send("gesturestart");
    h.send("gesturechange", { scale: 100 });
    expect(h.read().zoom).toBe(2);
    h.send("gesturechange", { scale: 2 });
    expect(h.read().zoom).toBe(1);
    for (const scale of [0, -1, NaN, Infinity]) h.send("gesturechange", { scale });
    expect(h.read().zoom).toBe(1);
  });
  it("keeps Chromium modified-wheel zoom anchored and removes all handlers on cleanup", () => {
    const h = harness();
    h.send("wheel", { ctrlKey: true, deltaY: -Math.log(2) * 100 });
    expect(h.read().zoom).toBeCloseTo(1);
    expect(h.read().x).toBeCloseTo(-100);
    const before = h.read();
    h.unbind();
    expect(h.send("gesturestart").defaultPrevented).toBe(false);
    h.send("wheel", { deltaY: 100 });
    expect(h.read()).toEqual(before);
  });
});
