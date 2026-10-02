import type { ItemCategory, ShopItem } from "../types";

/** 아이소 맵에 맞춘 2D 벡터/일러스트 도안 크기. */
export const ROOM_ART = {
  wallpaper: { width: 256, height: 256, folder: "walls" },
  floor: { width: 256, height: 256, folder: "floors" },
  item1: { width: 128, height: 160, folder: "items" },
  item2: { width: 256, height: 160, folder: "items" },
} as const;

export function customArtUrl(item: Pick<ShopItem, "id" | "category">): string {
  if (item.category === "wallpaper") return `/room-art/walls/${item.id}.png`;
  if (item.category === "floor") return `/room-art/floors/${item.id}.png`;
  return `/room-art/items/${item.id}.png`;
}

export function customArtUrlById(id: string, category: ItemCategory): string {
  return customArtUrl({ id, category });
}

export function itemCanvasSize(tilesW: number): { width: number; height: number } {
  if (tilesW >= 2) return { width: ROOM_ART.item2.width, height: ROOM_ART.item2.height };
  return { width: ROOM_ART.item1.width, height: ROOM_ART.item1.height };
}

export const ART_PROMPTS = {
  wallpaper:
    "Seamless 256x256 2D vector wallpaper texture, cute pastel mint, tiny paw prints, flat illustration, no furniture, no characters, tileable, clean vector shapes",
  floor:
    "Seamless 256x256 2D vector floor texture, pastel cream wood, top-down, tileable, flat illustration, no objects",
  item:
    "Cute isometric 2D vector game sprite, 3/4 view, pastel, sitting on a small diamond floor shadow, transparent background, 128x160, clean vector illustration, no pixel art, no UI",
} as const;
