import type { CSSProperties } from "react";

import artManifest from "../../public/assets/cards-art/art-manifest.json";
import { CARD_ASSET_VERSION } from "./cardAssetVersion";
import { dexAsset } from "./dexCatalog";
import type { DexCard } from "./dexTypes";

type ArtBox = {
  top: number;
  left: number;
  right?: number;
  bottom?: number;
  width?: number;
  height?: number;
};
type ArtPlacement = { box: ArtBox; objectFit: "contain"; objectPosition: string };
type ArtEntry = { art: string; thumb: string; placement?: ArtPlacement };
type ArtManifest = { _placement_default: ArtPlacement; cards: Record<string, ArtEntry> };

const ART_MANIFEST = artManifest as ArtManifest;
const ART_BASE = "/assets/cards-art";

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

function artEntry(id: string): ArtEntry | undefined {
  return ART_MANIFEST.cards[id];
}

/** Large transparent cat for CardViewer and the draw reveal. */
export function cardLargeUrl(card: Pick<DexCard, "id" | "front">): string {
  const art = artEntry(card.id)?.art;
  if (art) return withAssetVersion(`${ART_BASE}/${art}`);
  return withAssetVersion(dexAsset(card.front));
}

/** Grid thumb of the same transparent cat. */
export function cardThumbUrl(card: Pick<DexCard, "id" | "thumb">): string {
  const thumb = artEntry(card.id)?.thumb;
  if (thumb) return withAssetVersion(`${ART_BASE}/${thumb}`);
  return withAssetVersion(dexAsset(card.thumb));
}

/** Cat box inside the grade window. Width and height are definite so object-fit
 *  sizes the bitmap. A card with placement.width/height (selfie) uses those;
 *  every other card keeps the default inset. */
export function cardArtStyle(id: string): CSSProperties {
  const placement = artEntry(id)?.placement ?? ART_MANIFEST._placement_default;
  const { box } = placement;
  const width = box.width ?? 100 - box.left - (box.right ?? 0);
  const height = box.height ?? 100 - box.top - (box.bottom ?? 0);
  return {
    top: `${box.top}%`,
    left: `${box.left}%`,
    width: `${width}%`,
    height: `${height}%`,
    objectFit: placement.objectFit,
    objectPosition: placement.objectPosition,
  };
}

export function cardBackUrl(card: Pick<DexCard, "back">): string {
  return withAssetVersion(dexAsset(card.back));
}

export type ImageDecodeStatus = "ok" | "error";

const decodedImages = new Map<string, ImageDecodeStatus>();
const decodingImages = new Map<string, Promise<ImageDecodeStatus>>();
const decodeListeners = new Set<(url: string, status: ImageDecodeStatus) => void>();

function publishDecode(url: string, status: ImageDecodeStatus) {
  decodedImages.set(url, status);
  decodingImages.delete(url);
  decodeListeners.forEach((listener) => listener(url, status));
}

/** Cached result of `decodeImage`, including failures. */
export function imageDecodeStatus(url: string): ImageDecodeStatus | undefined {
  return decodedImages.get(url);
}

/**
 * Resolve when this URL's bitmap is ready or has failed.
 * A preload that already called `img.decode()` updates every subscriber.
 */
export function watchDecodedImage(
  url: string,
  onStatus: (status: ImageDecodeStatus) => void,
): () => void {
  const known = decodedImages.get(url);
  if (known) {
    onStatus(known);
    return () => {};
  }
  const listener = (nextUrl: string, status: ImageDecodeStatus) => {
    if (nextUrl === url) onStatus(status);
  };
  decodeListeners.add(listener);
  void decodeImageStatus(url);
  return () => decodeListeners.delete(listener);
}

function decodeImageStatus(url: string): Promise<ImageDecodeStatus> {
  const known = decodedImages.get(url);
  if (known) return Promise.resolve(known);
  const inflight = decodingImages.get(url);
  if (inflight) return inflight;
  const task = new Promise<ImageDecodeStatus>((resolve) => {
    let settled = false;
    const finish = (status: ImageDecodeStatus) => {
      if (settled) return;
      settled = true;
      publishDecode(url, status);
      resolve(status);
    };
    const img = new Image();
    const succeed = () => {
      if (typeof img.decode === "function") {
        img.decode().then(
          () => finish("ok"),
          () => finish(img.naturalWidth > 0 ? "ok" : "error"),
        );
        return;
      }
      finish(img.naturalWidth > 0 ? "ok" : "error");
    };
    img.onload = () => succeed();
    img.onerror = () => finish("error");
    img.src = url;
    if (img.complete && img.naturalWidth > 0) succeed();
  });
  decodingImages.set(url, task);
  return task;
}

/** Fetch and decode one image. `img.decode()` settles only after the bitmap is ready. */
export function decodeImage(url: string): Promise<void> {
  return decodeImageStatus(url).then((status) => {
    if (status === "error") throw new Error(url);
  });
}
