import { CARD_ASSET_VERSION } from "./cardAssetVersion";
import { dexAsset } from "./dexCatalog";
import type { DexCard } from "./dexTypes";

/** Cache-bust immutable image URLs. The build script changes the token when bytes change. */
export function withAssetVersion(url: string): string {
  const hashAt = url.indexOf("#");
  const base = hashAt >= 0 ? url.slice(0, hashAt) : url;
  const fragment = hashAt >= 0 ? url.slice(hashAt) : "";
  const queryAt = base.indexOf("?");
  const path = queryAt >= 0 ? base.slice(0, queryAt) : base;
  const params = new URLSearchParams(queryAt >= 0 ? base.slice(queryAt + 1) : "");
  params.set("v", CARD_ASSET_VERSION);
  return `${path}?${params.toString()}${fragment}`;
}

export function cardLargeUrl(card: Pick<DexCard, "front">): string {
  return withAssetVersion(dexAsset(card.front));
}

export function cardThumbUrl(card: Pick<DexCard, "thumb">): string {
  return withAssetVersion(dexAsset(card.thumb));
}

export function cardBackUrl(card: Pick<DexCard, "back">): string {
  return withAssetVersion(dexAsset(card.back));
}

/** Fetch and decode one image. `img.decode()` settles only after the bitmap is ready. */
export function decodeImage(url: string): Promise<void> {
  const img = new Image();
  img.src = url;
  if (typeof img.decode === "function") return img.decode();
  return new Promise((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(url));
  });
}
