import type { ItemCategory, ShopItem } from "../types";

/** 아이소 맵에 맞춘 2D 벡터/일러스트 도안 크기. */
export const ROOM_ART = {
  wallpaper: { width: 256, height: 256, folder: "walls" },
  floor: { width: 256, height: 256, folder: "floors" },
  item1: { width: 128, height: 160, folder: "items" },
  item2: { width: 256, height: 160, folder: "items" },
} as const;

export const CUSTOM_WALL_IDS = new Set(["wall_ivy", "wall_cafe"]);

export const CUSTOM_FLOOR_IDS = new Set([
  "floor_paw",
  "floor_fish",
  "floor_flower",
  "floor_sparkle",
  "floor_grass",
  "floor_stone",
  "floor_paw_tile",
  "floor_puzzle",
]);

/** Source PNG size and Y of the isometric left/right vertices. */
export const FLOOR_ART_METRICS: Record<string, { width: number; height: number; leftY: number }> = {
  floor_paw: { width: 575, height: 366, leftY: 170 },
  floor_fish: { width: 580, height: 369, leftY: 178 },
  floor_flower: { width: 513, height: 322, leftY: 155 },
  floor_sparkle: { width: 483, height: 306, leftY: 146 },
  floor_grass: { width: 454, height: 292, leftY: 134 },
  floor_stone: { width: 365, height: 223, leftY: 114 },
  floor_paw_tile: { width: 407, height: 241, leftY: 118 },
  floor_puzzle: { width: 371, height: 262, leftY: 125 },
};

/** Room-shell PNGs. leftY is the row where the sprite is widest (floor left/right). */
export const WALL_ART_METRICS: Record<string, { width: number; height: number; leftY: number }> = {
  wall_cafe: { width: 509, height: 400, leftY: 260 },
  wall_ivy: { width: 417, height: 416, leftY: 297 },
};

export function floorArtBox(id: string, tileW: number, tileH: number, roomSize: number) {
  const width = roomSize * tileW;
  const midY = (roomSize * tileH) / 2;
  const metrics = FLOOR_ART_METRICS[id];
  if (!metrics) {
    return { x: -width / 2, y: 0, width, height: roomSize * tileH };
  }
  const scale = width / metrics.width;
  return {
    x: -width / 2,
    y: midY - metrics.leftY * scale,
    width,
    height: metrics.height * scale,
  };
}

export function wallArtBox(id: string, tileW: number, tileH: number, wallH: number, roomSize: number) {
  const width = roomSize * tileW;
  const floorMidY = (roomSize * tileH) / 2;
  const metrics = WALL_ART_METRICS[id];
  if (!metrics) {
    return { x: -width / 2, y: -wallH, width, height: wallH + floorMidY };
  }
  const scale = width / metrics.width;
  return {
    x: -width / 2,
    y: floorMidY - metrics.leftY * scale,
    width,
    height: metrics.height * scale,
  };
}

export function customArtUrl(item: Pick<ShopItem, "id" | "category">): string {
  if (item.category === "wallpaper") return `/room-art/walls/${item.id}.png`;
  if (item.category === "floor") return `/room-art/floors/${item.id}.png`;
  return `/room-art/items/${item.id}.png`;
}

export function hasCustomSurfaceArt(id: string, category: ItemCategory): boolean {
  if (category === "wallpaper") return CUSTOM_WALL_IDS.has(id);
  if (category === "floor") return CUSTOM_FLOOR_IDS.has(id);
  return false;
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
