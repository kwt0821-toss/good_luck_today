import type { ItemCategory, ShopItem } from "../types";

/** 파니룸식 쿼터뷰 픽셀아트 도안 크기. */
export const ROOM_ART = {
  wallpaper: { width: 32, height: 32, folder: "walls" },
  floor: { width: 32, height: 32, folder: "floors" },
  item1: { width: 32, height: 40, folder: "items" },
  item2: { width: 64, height: 40, folder: "items" },
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
    "32x32 seamless pixel-art wallpaper texture, 1:1 pixels, junior-naver pani room style, pastel mint, tiny paw dots, flat repeating pattern, no furniture, no perspective, tileable",
  floor:
    "32x32 seamless pixel-art floor texture, 1:1 pixels, pani room style, pastel cream wood planks, top-down, tileable, no objects, no isometric diamond",
  item:
    "Isometric pixel-art game sprite, 2:1 quarter view, pani room / habbo dollhouse style, cute pastel, 32x40, transparent background, chunky pixels, sitting on a small diamond shadow, no room, no UI",
} as const;
