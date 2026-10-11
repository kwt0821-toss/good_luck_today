import { DEFAULT_FLOOR_TILE, DEFAULT_WALL_TILE, setTileRules } from "./roomTiles";
import type {
  FurnitureOrientation,
  RoomCatalog,
  RoomCategory,
  RoomItem,
  RoomPlacementKind,
  RoomTab,
  RoomTileRules,
} from "./roomTypes";

export const ROOM_BASE = "/assets/room";

export function roomAsset(relative: string | null | undefined): string {
  if (!relative) return "";
  return `${ROOM_BASE}/${relative.replace(/^\//, "")}`;
}

type RawFurnitureOri = {
  image?: string;
  footprint?: [number, number];
  anchorFootprintCenterPx?: [number, number];
  anchorBackCornerPx?: [number, number];
  size?: [number, number];
};

type RawItem = {
  id: string;
  nameKo?: string;
  category?: string;
  placement?: string;
  footprint?: [number, number] | null;
  price?: number;
  ownedDefault?: boolean;
  placedDefault?: boolean;
  image?: string | null;
  imageSizePx?: [number, number];
  tileImage?: string | null;
  orientations?: {
    default?: RawFurnitureOri;
    mirrored?: RawFurnitureOri;
    front?: string;
    leftWall?: string;
    rightWall?: string;
  };
  displayWidthTiles?: number;
  wallSpanTiles?: number;
  canSitOnSurface?: boolean;
  decal?: boolean;
  shadow?: string | null;
};

type RawHero = {
  id: string;
  nameKo?: string;
  image?: string;
  tileImage?: string;
  footprint?: [number, number];
  shadow?: string | null;
  displayWidthTiles?: number;
};

type RawTileRules = {
  floor?: { file?: string };
  wall?: { leftFile?: string; rightFile?: string };
  defaults?: { floor?: string; wall?: string };
  floorFile?: string;
  wallLeftFile?: string;
  wallRightFile?: string;
  defaultFloor?: string;
  defaultWall?: string;
};

type RawCatalog = {
  items?: RawItem[];
  heroCat?: RawHero;
  tileRules?: RawTileRules;
};

export type GridLayoutEntry = {
  id: string;
  c?: number;
  r?: number;
  w?: number;
  d?: number;
  orientation?: "default" | "mirrored";
  worldPx?: [number, number];
  wall?: "L" | "R";
  t?: number;
  heightUnits?: number;
  onTop?: string;
  fx?: number;
  fy?: number;
  kind?: string;
  shadow?: string | null;
};

export type RoomGridFile = {
  defaultLayout?: GridLayoutEntry[];
  tileMaps?: Partial<RoomTileRules>;
};

let catalogPromise: Promise<RoomCatalog> | null = null;
let gridPromise: Promise<RoomGridFile> | null = null;

function asCategory(value: string | undefined): RoomCategory {
  if (
    value === "가구" ||
    value === "소품" ||
    value === "벽 꾸미기" ||
    value === "벽지" ||
    value === "바닥" ||
    value === "카드액자"
  ) {
    return value;
  }
  return "소품";
}

function parseTileRules(raw: RawTileRules | undefined): RoomTileRules {
  return {
    floorFile: raw?.floor?.file ?? raw?.floorFile ?? "floor/iso/{id}_{c%2}{r%2}.png",
    wallLeftFile: raw?.wall?.leftFile ?? raw?.wallLeftFile ?? "wall/L/{id}_{i}.png",
    wallRightFile: raw?.wall?.rightFile ?? raw?.wallRightFile ?? "wall/R/{id}_{i}.png",
    defaultFloor: raw?.defaults?.floor ?? raw?.defaultFloor ?? DEFAULT_FLOOR_TILE,
    defaultWall: raw?.defaults?.wall ?? raw?.defaultWall ?? DEFAULT_WALL_TILE,
  };
}

export const FALLBACK_SKINS: RoomItem[] = [
  skin("wood_honey", "꿀빛 원목", "바닥", "floor-skin", 0, true),
  skin("wood_oak", "밝은 오크", "바닥", "floor-skin", 0, true),
  skin("check_pink", "핑크 체크", "바닥", "floor-skin", 0, true),
  skin("check_mint", "민트 체크", "바닥", "floor-skin", 0, true),
  skin("paw_tile", "발바닥 타일", "바닥", "floor-skin", 0, true),
  skin("cloud", "구름 타일", "바닥", "floor-skin", 200, false),
  skin("meadow", "초록 들판", "바닥", "floor-skin", 220, false),
  skin("marble_cream", "크림 대리석", "바닥", "floor-skin", 280, false),
  skin("star_navy", "별가루 네이비", "바닥", "floor-skin", 280, false),
  skin("herring_lav", "라벤더 헤링본", "바닥", "floor-skin", 300, false),
  skin("carpet_pink", "몽글 핑크 카펫", "바닥", "floor-skin", 300, false),
  skin("terrazzo", "파스텔 테라조", "바닥", "floor-skin", 340, false),
  skin("plum_sparkle", "플럼 반짝이", "벽지", "wallpaper", 0, true),
  skin("lav_stripe", "라벤더 줄무늬", "벽지", "wallpaper", 0, true),
  skin("pink_polka", "핑크 도트", "벽지", "wallpaper", 0, true),
  skin("mint_gingham", "민트 깅엄", "벽지", "wallpaper", 0, true),
  skin("paw_wall", "발바닥 벽지", "벽지", "wallpaper", 0, true),
  skin("peach_hearts", "피치 하트", "벽지", "wallpaper", 180, false),
  skin("cream_cats", "크림 냥이", "벽지", "wallpaper", 220, false),
  skin("cloud_wall", "몽실 구름", "벽지", "wallpaper", 220, false),
  skin("sage_leaf", "세이지 잎사귀", "벽지", "wallpaper", 220, false),
  skin("night_sky", "밤하늘 별빛", "벽지", "wallpaper", 280, false),
  skin("moon_navy", "달과 별", "벽지", "wallpaper", 280, false),
  skin("wainscot", "원목 웨인스코팅", "벽지", "wallpaper", 340, false),
];

function skin(
  id: string,
  nameKo: string,
  category: RoomCategory,
  placement: RoomPlacementKind,
  price: number,
  ownedDefault: boolean,
): RoomItem {
  const thumb = placement === "wallpaper" ? `wall/thumb/${id}.png` : `floor/thumb/${id}.png`;
  return {
    id,
    nameKo,
    category,
    placement,
    footprint: null,
    price,
    ownedDefault,
    placedDefault: id === DEFAULT_FLOOR_TILE || id === DEFAULT_WALL_TILE,
    image: thumb,
    tileImage: thumb,
  };
}

function mergeSkinItems(items: RoomItem[]) {
  const hasFloor = items.some((item) => item.category === "바닥" || item.placement === "floor-skin");
  const hasWall = items.some((item) => item.category === "벽지" || item.placement === "wallpaper");
  return [
    ...items,
    ...FALLBACK_SKINS.filter((skinItem) => {
      if (items.some((item) => item.id === skinItem.id)) return false;
      if (skinItem.placement === "floor-skin") return !hasFloor;
      return !hasWall;
    }),
  ];
}

function asPlacement(value: string | undefined): RoomPlacementKind {
  if (value === "floor" || value === "floor-decal" || value === "wall" || value === "wallpaper" || value === "floor-skin") {
    return value;
  }
  return "floor";
}

function asFurnitureOri(raw: RawFurnitureOri | undefined, fallback: RawItem): FurnitureOrientation | null {
  if (!raw?.image || !raw.anchorFootprintCenterPx || !raw.size || !raw.footprint) return null;
  return {
    image: raw.image,
    footprint: raw.footprint ?? fallback.footprint ?? [1, 1],
    anchorFootprintCenterPx: raw.anchorFootprintCenterPx,
    anchorBackCornerPx: raw.anchorBackCornerPx,
    size: raw.size,
  };
}

function normalizeItem(raw: RawItem): RoomItem {
  const defaultOri = asFurnitureOri(raw.orientations?.default, raw);
  const mirroredOri = asFurnitureOri(raw.orientations?.mirrored, raw);
  const wallFront = raw.orientations?.front;
  const wallLeft = raw.orientations?.leftWall;
  const wallRight = raw.orientations?.rightWall;
  return {
    id: raw.id,
    nameKo: raw.nameKo ?? raw.id,
    category: asCategory(raw.category),
    placement: asPlacement(raw.placement),
    footprint: raw.footprint ?? null,
    price: raw.price ?? 0,
    ownedDefault: Boolean(raw.ownedDefault),
    placedDefault: Boolean(raw.placedDefault),
    image: raw.image ?? null,
    imageSizePx: raw.imageSizePx,
    tileImage: raw.tileImage ?? (raw.id ? `tiles/${raw.id}.png` : null),
    furniture: defaultOri && mirroredOri ? { default: defaultOri, mirrored: mirroredOri } : undefined,
    wallImages:
      wallFront || wallLeft || wallRight
        ? {
            front: wallFront ?? raw.image ?? "",
            left: wallLeft ?? raw.image ?? "",
            right: wallRight ?? raw.image ?? "",
          }
        : undefined,
    displayWidthTiles: raw.displayWidthTiles,
    wallSpanTiles: raw.wallSpanTiles,
    canSitOnSurface: raw.canSitOnSurface,
    decal: raw.decal || raw.placement === "floor-decal",
    shadow: raw.shadow,
  };
}

function normalizeHero(raw: RawHero): RoomItem {
  return {
    id: raw.id,
    nameKo: raw.nameKo ?? "잠자는 냥이",
    category: "소품",
    placement: "floor",
    footprint: raw.footprint ?? [1, 1],
    price: 0,
    ownedDefault: true,
    placedDefault: true,
    image: raw.image ?? "items/hero/catbed_cat.png",
    imageSizePx: [307, 251],
    tileImage: raw.tileImage ?? "tiles/catbed_cat.png",
    displayWidthTiles: raw.displayWidthTiles ?? 0.83,
    shadow: raw.shadow ?? "shadows/shadow-1x1.png",
    hero: true,
  };
}

export function loadRoomCatalog(): Promise<RoomCatalog> {
  if (!catalogPromise) {
    catalogPromise = fetch(roomAsset("items.json"))
      .then((res) => {
        if (!res.ok) throw new Error("room catalog missing");
        return res.json() as Promise<RawCatalog>;
      })
      .then((data) => {
        setTileRules(parseTileRules(data.tileRules));
        const items = mergeSkinItems((data.items ?? []).map(normalizeItem));
        if (data.heroCat && !items.some((item) => item.id === data.heroCat?.id)) {
          items.push(normalizeHero(data.heroCat));
        }
        return { items };
      })
      .catch(() => ({ items: [] }));
  }
  return catalogPromise;
}

export function loadRoomGrid(): Promise<RoomGridFile> {
  if (!gridPromise) {
    gridPromise = fetch(roomAsset("grid.json"))
      .then((res) => (res.ok ? (res.json() as Promise<RoomGridFile>) : {}))
      .then((data) => {
        if (data.tileMaps) setTileRules(data.tileMaps);
        return data;
      })
      .catch(() => ({}));
  }
  return gridPromise;
}

export function itemMap(items: RoomItem[]) {
  return new Map(items.map((item) => [item.id, item]));
}

export const ROOM_TABS: { id: RoomCategory; label: string }[] = [
  { id: "가구", label: "가구" },
  { id: "소품", label: "소품" },
  { id: "벽 꾸미기", label: "벽 꾸미기" },
  { id: "벽지", label: "벽지" },
  { id: "바닥", label: "바닥" },
  { id: "카드액자", label: "카드액자" },
];

export const CARD_FRAME_IDS = new Set(["squareframe", "cardframe"]);

export function itemMatchesTab(item: RoomItem, tab: RoomTab) {
  if (tab === "벽 꾸미기") return item.placement === "wall";
  if (tab === "벽지") return item.category === "벽지" || item.placement === "wallpaper";
  if (tab === "카드액자") return item.category === "카드액자" || CARD_FRAME_IDS.has(item.id);
  if (tab === "바닥") return item.placement === "floor-skin" || item.category === "바닥";
  return item.category === tab && item.placement !== "wall" && item.placement !== "wallpaper" && item.placement !== "floor-skin";
}

export function isPaintItem(item: RoomItem | undefined) {
  return Boolean(
    item &&
      (item.placement === "wallpaper" ||
        item.placement === "floor-skin" ||
        item.category === "벽지" ||
        item.category === "바닥"),
  );
}
