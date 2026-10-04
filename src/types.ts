export type Star = 1 | 2 | 3 | 4 | 5;

export type ScreenName = "home" | "result" | "collection" | "room";

export type Screen =
  | { name: "home" }
  | { name: "result" }
  | { name: "collection" }
  | { name: "room" };

export interface CatSpecies {
  id: string;
  name: string;
}

export interface Cat {
  id: string;
  speciesId: string;
  name: string;
  star: Star;
  imageUrl: string;
  luckPhrase: string;
  description: [string, string];
}

export interface CollectionRecord {
  unlockedAt: string;
  count: number;
}

export interface DrawResult {
  catId: string;
  isNew: boolean;
  boosted: boolean;
  dateKey: string;
  earnedTossPoints: number;
  earnedPinkJelly: number;
}

export type ItemCategory = "wallpaper" | "floor" | "furniture" | "decor";

export type ItemAnchor = "wall" | "floor" | "surface";

export interface ShopItem {
  id: string;
  name: string;
  category: ItemCategory;
  price: number;
  tilesW: number;
  tilesH: number;
  anchor: ItemAnchor;
  unique: boolean;
  starter: boolean;
  imageUrl: string;
}

export interface RoomPlacement {
  instanceId: string;
  itemId: string;
  col: number;
  row: number;
}

export interface RoomState {
  wallpaperId: string;
  floorId: string;
  placements: RoomPlacement[];
}

export interface UserState {
  userId: string;
  pinkJellyBalance: number;
  tossPointBalance: number;
  lastDrawDate: string;
  dailyRerollCount: number;
  unlockedCatIds: string[];
  collection: Record<string, CollectionRecord>;
  lastResult: DrawResult | null;
  inventory: Record<string, number>;
  room: RoomState;
}

export type AdKind = "interstitial" | "rewarded";

export type DrawPurpose = "daily" | "reroll-standard" | "reroll-boosted";

export type SpeciesFilter = "ALL" | string;

export type CollectionSort = "acquired" | "species";

export type RoomTab = "decorate" | "shop";
