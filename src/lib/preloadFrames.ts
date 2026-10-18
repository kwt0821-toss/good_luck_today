import { FRAME_LAYOUT, type FrameKey } from "./cardFrames";
import { withAssetVersion } from "./cardArt";

const FRAME_KEYS = Object.keys(FRAME_LAYOUT.tiers) as FrameKey[];

/** Every grade's frame and window, both densities. */
export function framePreloadUrls(): string[] {
  const urls: string[] = [];
  for (const key of FRAME_KEYS) {
    const windowName = FRAME_LAYOUT.tiers[key].windowBg;
    for (const file of [`frame-${key}`, windowName]) {
      urls.push(withAssetVersion(`/assets/frames/${file}.webp`));
      urls.push(withAssetVersion(`/assets/frames/${file}@2x.webp`));
    }
  }
  return urls;
}

/** Warm the HTTP cache after first paint. Does not block the UI. */
export function preloadFrameAssets(): void {
  const urls = framePreloadUrls();
  const run = () => {
    const hi = window.devicePixelRatio >= 1.5;
    const chosen = urls.filter((url) => (url.includes("@2x.webp") ? hi : !hi));
    for (const url of chosen) {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
    }
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 2000 });
    return;
  }
  window.setTimeout(run, 200);
}
