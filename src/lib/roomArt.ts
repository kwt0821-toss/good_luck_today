import type { ItemCategory, ShopItem } from "../types";

/** 맵에 맞춘 그림 크기. 이 숫자만 지키면 방에 바로 붙어요. */
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
    "Seamless 256x256 pixel-art wallpaper texture, pastel mint, tiny cute paw prints, flat repeating pattern, no furniture, no characters, tileable",
  floor:
    "Seamless 256x256 pixel-art floor texture, pastel cream wood planks, top-down, tileable, no objects",
  item:
    "Isometric pixel-art game sprite, 3/4 view, cute pastel, sitting on a small diamond floor shadow, transparent background, 128x160, no UI",
} as const;
