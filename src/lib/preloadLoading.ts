import { withAssetVersion } from "./cardArt";

/** @2x cat and moon, warmed at startup so the first loading window is instant. */
export const LOADING_PRELOAD_URLS = [
  withAssetVersion("/assets/loading/loading-cat@2x.webp"),
  withAssetVersion("/assets/loading/loading-moon@2x.webp"),
];

export function preloadLoadingAssets(): void {
  for (const url of LOADING_PRELOAD_URLS) {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  }
}
