import type { CSSProperties } from "react";

import artManifest from "../../public/assets/cards-art/art-manifest.json";
import { CARD_ASSET_VERSION } from "./cardAssetVersion";
import { dexAsset } from "./dexCatalog";
import type { DexCard } from "./dexTypes";

type ArtBox = { top: number; left: number; right: number; bottom: number };
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

/** Inset of the cat inside the grade window. Selfie is the only override.
 *  Width and height are set explicitly: an absolutely positioned image with
 *  auto size keeps its intrinsic pixels, so object-fit never sees this box. */
export function cardArtStyle(id: string): CSSProperties {
  const placement = artEntry(id)?.placement ?? ART_MANIFEST._placement_default;
  const { box } = placement;
  return {
    top: `${box.top}%`,
    left: `${box.left}%`,
    width: `${100 - box.left - box.right}%`,
    height: `${100 - box.top - box.bottom}%`,
    objectFit: placement.objectFit,
    objectPosition: placement.objectPosition,
  };
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
