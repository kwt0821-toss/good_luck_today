import { decorArt, floorArt, furnitureArt, wallpaperArt } from "./itemArt";
import { customArtUrl } from "./roomArt";
import type { ItemAnchor, ItemCategory, ShopItem } from "../types";

function pngItem(
  item: Omit<ShopItem, "imageUrl" | "starter" | "unique" | "anchor" | "tilesW" | "tilesH"> & {
    tilesW?: number;
    tilesH?: number;
    starter?: boolean;
    unique?: boolean;
    anchor?: ItemAnchor;
  },
): ShopItem {
  const unique = item.unique ?? (item.category === "wallpaper" || item.category === "floor");
  return {
    tilesW: 1,
    tilesH: 1,
    starter: false,
    anchor: unique ? "surface" : "floor",
    ...item,
    unique,
    imageUrl: customArtUrl({ id: item.id, category: item.category }),
  };
}

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
  pngItem({ id: "wall_ivy", name: "담쟁이 코너 벽", category: "wallpaper", price: 8 }),
  pngItem({ id: "wall_cafe", name: "고양이 카페 벽", category: "wallpaper", price: 9 }),
  pngItem({ id: "floor_paw", name: "발바닥 마루", category: "floor", price: 5 }),
  pngItem({ id: "floor_fish", name: "물고기 타일", category: "floor", price: 5 }),
  pngItem({ id: "floor_flower", name: "벚꽃 타일", category: "floor", price: 6 }),
  pngItem({ id: "floor_sparkle", name: "민트 스파클 타일", category: "floor", price: 6 }),
  pngItem({ id: "floor_grass", name: "꽃잔디", category: "floor", price: 5 }),
  pngItem({ id: "floor_stone", name: "돌길 잔디", category: "floor", price: 6 }),
  pngItem({ id: "floor_paw_tile", name: "발바닥 타일", category: "floor", price: 4 }),
  pngItem({ id: "floor_puzzle", name: "퍼즐 매트", category: "floor", price: 5 }),
  pngItem({ id: "furn_cat_sofa", name: "고양이 소파", category: "furniture", price: 10, tilesW: 2, tilesH: 2 }),
  pngItem({ id: "furn_cat_tv", name: "고양이 TV", category: "furniture", price: 8, tilesW: 1, tilesH: 1 }),
  pngItem({ id: "furn_paw_table", name: "발바닥 식탁", category: "furniture", price: 9, tilesW: 2, tilesH: 2 }),
  pngItem({ id: "furn_shower_curtain", name: "물고기 샤워커튼", category: "furniture", price: 7, tilesW: 2, tilesH: 1 }),
  pngItem({ id: "furn_cat_tub", name: "고양이 욕조", category: "furniture", price: 9, tilesW: 2, tilesH: 1 }),
  pngItem({ id: "furn_paw_sink", name: "발바닥 세면대", category: "furniture", price: 6 }),
  pngItem({ id: "furn_cat_toilet", name: "고양이 변기", category: "furniture", price: 6 }),
  pngItem({ id: "furn_fish_fountain", name: "물고기 분수", category: "furniture", price: 8, tilesW: 2, tilesH: 1 }),
  pngItem({ id: "furn_paw_bench", name: "발바닥 벤치", category: "furniture", price: 7, tilesW: 2, tilesH: 1 }),
  pngItem({ id: "furn_espresso", name: "고양이 커피머신", category: "furniture", price: 8 }),
  pngItem({ id: "furn_cafe_table", name: "카페 테이블", category: "furniture", price: 6 }),
  pngItem({ id: "furn_cafe_stool_l", name: "발바닥 스툴", category: "furniture", price: 4 }),
  pngItem({ id: "furn_cafe_stool_r", name: "구름 스툴", category: "furniture", price: 4 }),
  pngItem({ id: "furn_cake_case", name: "케이크 진열장", category: "furniture", price: 9, tilesW: 2, tilesH: 1 }),
  pngItem({ id: "furn_awning", name: "핑크 캐노피", category: "furniture", price: 6, tilesW: 2, tilesH: 1 }),
  pngItem({ id: "furn_snack_shelf", name: "간식 선반", category: "furniture", price: 8, tilesW: 2, tilesH: 1 }),
  pngItem({ id: "furn_cat_cart", name: "고양이 카트", category: "furniture", price: 7 }),
  pngItem({ id: "furn_can_rack", name: "생선캔 진열대", category: "furniture", price: 7 }),
  pngItem({ id: "furn_register", name: "발바닥 계산대", category: "furniture", price: 8, tilesW: 2, tilesH: 1 }),
  pngItem({ id: "furn_yarn_pool", name: "털실 풀장", category: "furniture", price: 8, tilesW: 2, tilesH: 1 }),
  pngItem({ id: "furn_slide", name: "별 미끄럼틀", category: "furniture", price: 9, tilesW: 2, tilesH: 1 }),
  pngItem({ id: "furn_whale_rocker", name: "고래 목마", category: "furniture", price: 6 }),
  pngItem({ id: "furn_teepee", name: "별 텐트", category: "furniture", price: 8, tilesW: 2, tilesH: 1 }),
  pngItem({ id: "decor_tea_cup", name: "홍차 잔", category: "decor", price: 3 }),
  pngItem({ id: "decor_matcha", name: "말차 가루", category: "decor", price: 3 }),
  pngItem({ id: "decor_green_bottle", name: "고양이 시럽", category: "decor", price: 3 }),
  pngItem({ id: "decor_tea_tin", name: "찻잎 통", category: "decor", price: 3 }),
  pngItem({ id: "decor_lime", name: "라임", category: "decor", price: 2 }),
  pngItem({ id: "decor_sugar", name: "각설탕", category: "decor", price: 2 }),
  pngItem({ id: "decor_duck", name: "노란 오리", category: "decor", price: 3 }),
  pngItem({ id: "decor_towels", name: "발바닥 수건", category: "decor", price: 3 }),
  pngItem({ id: "decor_cat_planter", name: "고양이 화분", category: "decor", price: 4 }),
  pngItem({ id: "decor_lemon_tree", name: "레몬나무", category: "decor", price: 6 }),
  pngItem({ id: "decor_watering_can", name: "고양이 물뿌리개", category: "decor", price: 4 }),
  pngItem({ id: "decor_paw_cup", name: "발바닥 컵", category: "decor", price: 3 }),
  pngItem({ id: "decor_cake_stand", name: "딸기 케이크", category: "decor", price: 4 }),
  pngItem({ id: "decor_milk", name: "고양이 우유", category: "decor", price: 3 }),
  pngItem({ id: "decor_cat_food", name: "고양이 사료", category: "decor", price: 3 }),
  pngItem({ id: "decor_fish_crate", name: "생선 상자", category: "decor", price: 4 }),
  pngItem({ id: "decor_mouse_cushion", name: "쥐 쿠션", category: "decor", price: 5 }),
  pngItem({ id: "decor_paw_blocks", name: "발바닥 블럭", category: "decor", price: 4 }),
];

const ITEM_MAP = new Map(ITEMS.map((item) => [item.id, item]));

/** Catalog prices stay as-is; the Vite dev server treats every shop item as free. */
export function shopPrice(item: Pick<ShopItem, "price">): number {
  if (import.meta.env.DEV) return 0;
  return item.price;
}

export function isCatalogFree(item: Pick<ShopItem, "price">): boolean {
  return item.price <= 0;
}

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
