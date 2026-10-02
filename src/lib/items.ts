import { decorArt, floorArt, furnitureArt, wallpaperArt } from "./itemArt";
import type { ItemCategory, ShopItem } from "../types";

export const STARTER_WALLPAPER_ID = "wall_mint";
export const STARTER_FLOOR_ID = "floor_wood";
export const STARTER_YARN_ID = "decor_yarn";

export const ITEMS: ShopItem[] = [
  {
    id: STARTER_WALLPAPER_ID,
    name: "민트 아침 벽지",
    category: "wallpaper",
    price: 0,
    tilesW: 1,
    tilesH: 1,
    anchor: "surface",
    unique: true,
    starter: true,
    imageUrl: wallpaperArt("mint"),
  },
  {
    id: "wall_sky",
    name: "하늘 오후 벽지",
    category: "wallpaper",
    price: 5,
    tilesW: 1,
    tilesH: 1,
    anchor: "surface",
    unique: true,
    starter: false,
    imageUrl: wallpaperArt("sky"),
  },
  {
    id: "wall_lemon",
    name: "레몬크림 벽지",
    category: "wallpaper",
    price: 6,
    tilesW: 1,
    tilesH: 1,
    anchor: "surface",
    unique: true,
    starter: false,
    imageUrl: wallpaperArt("lemon"),
  },
  {
    id: STARTER_FLOOR_ID,
    name: "크림 마루",
    category: "floor",
    price: 0,
    tilesW: 1,
    tilesH: 1,
    anchor: "surface",
    unique: true,
    starter: true,
    imageUrl: floorArt("wood"),
  },
  {
    id: "floor_tile",
    name: "민트 타일",
    category: "floor",
    price: 4,
    tilesW: 1,
    tilesH: 1,
    anchor: "surface",
    unique: true,
    starter: false,
    imageUrl: floorArt("tile"),
  },
  {
    id: "floor_cloud",
    name: "구름 러그 바닥",
    category: "floor",
    price: 5,
    tilesW: 1,
    tilesH: 1,
    anchor: "surface",
    unique: true,
    starter: false,
    imageUrl: floorArt("cloud"),
  },
  {
    id: "furn_tower",
    name: "레몬 캣타워",
    category: "furniture",
    price: 8,
    tilesW: 1,
    tilesH: 1,
    anchor: "floor",
    unique: false,
    starter: false,
    imageUrl: furnitureArt("tower"),
  },
  {
    id: "furn_bed",
    name: "구름 쿠션 침대",
    category: "furniture",
    price: 6,
    tilesW: 2,
    tilesH: 1,
    anchor: "floor",
    unique: false,
    starter: false,
    imageUrl: furnitureArt("bed"),
  },
  {
    id: "furn_bowl",
    name: "노란 식기",
    category: "furniture",
    price: 3,
    tilesW: 1,
    tilesH: 1,
    anchor: "floor",
    unique: false,
    starter: false,
    imageUrl: furnitureArt("bowl"),
  },
  {
    id: "furn_shelf",
    name: "창가 선반",
    category: "furniture",
    price: 7,
    tilesW: 2,
    tilesH: 1,
    anchor: "floor",
    unique: false,
    starter: false,
    imageUrl: furnitureArt("shelf"),
  },
  {
    id: "decor_plant",
    name: "민트 화분",
    category: "decor",
    price: 3,
    tilesW: 1,
    tilesH: 1,
    anchor: "floor",
    unique: false,
    starter: false,
    imageUrl: decorArt("plant"),
  },
  {
    id: STARTER_YARN_ID,
    name: "털실 공",
    category: "decor",
    price: 2,
    tilesW: 1,
    tilesH: 1,
    anchor: "floor",
    unique: false,
    starter: true,
    imageUrl: decorArt("yarn"),
  },
  {
    id: "decor_lamp",
    name: "달빛 스탠드",
    category: "decor",
    price: 4,
    tilesW: 1,
    tilesH: 1,
    anchor: "floor",
    unique: false,
    starter: false,
    imageUrl: decorArt("lamp"),
  },
  {
    id: "decor_toy",
    name: "깃털 낚싯대",
    category: "decor",
    price: 3,
    tilesW: 1,
    tilesH: 1,
    anchor: "floor",
    unique: false,
    starter: false,
    imageUrl: decorArt("toy"),
  },
  {
    id: "decor_clock",
    name: "하늘 시계",
    category: "decor",
    price: 4,
    tilesW: 1,
    tilesH: 1,
    anchor: "floor",
    unique: false,
    starter: false,
    imageUrl: decorArt("clock"),
  },
];

const ITEM_MAP = new Map(ITEMS.map((item) => [item.id, item]));

export function getItemById(id: string): ShopItem | undefined {
  return ITEM_MAP.get(id);
}

export function getItemsByCategory(category: ItemCategory | "ALL"): ShopItem[] {
  if (category === "ALL") return ITEMS;
  return ITEMS.filter((item) => item.category === category);
}

export const ITEM_CATEGORIES: Array<ItemCategory | "ALL"> = [
  "ALL",
  "wallpaper",
  "floor",
  "furniture",
  "decor",
];

export function categoryLabel(category: ItemCategory | "ALL"): string {
  if (category === "ALL") return "전체";
  if (category === "wallpaper") return "벽지";
  if (category === "floor") return "바닥";
  if (category === "furniture") return "가구";
  return "소품";
}
