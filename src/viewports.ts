import type { Size } from "./camera";
import type { Manifest, ManifestScreen } from "./manifest";

/** Curated CSS viewport sizes, reviewed 2026-10-06; sources in docs/connector.md. */
export const DEVICE_VIEWPORTS = {
  desktop: [
    { id: "desktop-laptop", width: 1536, height: 864 },
    { id: "desktop-full", width: 1920, height: 1080 },
    { id: "desktop-large", width: 2560, height: 1440 },
  ],
  tablet: [
    { id: "tablet-android", width: 800, height: 1280 },
    { id: "tablet-standard", width: 820, height: 1180 },
  ],
  mobile: [
    { id: "mobile-compact", width: 360, height: 800 },
    { id: "mobile-standard", width: 390, height: 844 },
    { id: "mobile-large", width: 430, height: 932 },
  ],
} as const;

export type Device = keyof typeof DEVICE_VIEWPORTS;
export type ViewportMode = "project" | (typeof DEVICE_VIEWPORTS)[Device][number]["id"];
export const DEFAULT_DEVICE: Device = "desktop";
export const DEFAULT_VIEWPORTS = { desktop: "desktop-full", tablet: "tablet-standard", mobile: "mobile-standard" } as const satisfies Record<Device, ViewportMode>;
export const DEFAULT_VIEWPORT = DEFAULT_VIEWPORTS[DEFAULT_DEVICE];

export function frameSize(manifest: Manifest, screen: ManifestScreen, mode: ViewportMode): Size {
  if (mode === "project") return { width: screen.width ?? manifest.frame.width, height: screen.height ?? manifest.frame.height };
  const preset = Object.values(DEVICE_VIEWPORTS).flat().find((preset) => preset.id === mode)!;
  // A selected preset is an explicit responsive review of every screen, even
  // if the manifest contains mixed devices. Project sizes restores the source.
  return { width: preset.width, height: preset.height };
}
