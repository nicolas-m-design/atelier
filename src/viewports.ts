import type { Size } from "./camera";
import type { Manifest, ManifestScreen } from "./manifest";

/** Minimum presentation sizes, not display resolutions or canvas zoom levels. */
export const DESKTOP_VIEWPORTS = {
  laptop: { width: 1440, height: 900 },
  desktop: { width: 1600, height: 1000 },
  wide: { width: 1920, height: 1080 },
} as const;
export type ViewportMode = "project" | keyof typeof DESKTOP_VIEWPORTS;
export const DEFAULT_VIEWPORT: ViewportMode = "laptop";

export function usesDesktopBaseline(manifest: Manifest, screen: ManifestScreen): boolean {
  // A screen-specific size is intentional: compact reviews, phones, tablets,
  // and other exact-size captures must never be silently enlarged.
  return screen.width === undefined && screen.height === undefined
    && manifest.frame.width >= 1024 && manifest.frame.width > manifest.frame.height;
}

export function frameSize(manifest: Manifest, screen: ManifestScreen, mode: ViewportMode): Size {
  const size = { width: screen.width ?? manifest.frame.width, height: screen.height ?? manifest.frame.height };
  if (mode === "project" || !usesDesktopBaseline(manifest, screen)) return size;
  const baseline = DESKTOP_VIEWPORTS[mode];
  return { width: Math.max(size.width, baseline.width), height: Math.max(size.height, baseline.height) };
}
