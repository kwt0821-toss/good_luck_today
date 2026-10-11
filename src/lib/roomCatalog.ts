import type { FurnitureOrientation, RoomCatalog, RoomCategory, RoomItem, RoomPlacementKind, RoomTab } from "./roomTypes";

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

type RawCatalog = {
  items?: RawItem[];
  heroCat?: RawHero;
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
};

let catalogPromise: Promise<RoomCatalog> | null = null;
let gridPromise: Promise<RoomGridFile> | null = null;

function asCategory(value: string | undefined): RoomCategory {
  if (value === "가구" || value === "소품" || value === "벽 꾸미기" || value === "바닥" || value === "카드액자") {
    return value;
  }
  if (value === "벽지") return "벽 꾸미기";
  return "소품";
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
        const items = (data.items ?? []).map(normalizeItem);
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
  { id: "바닥", label: "바닥" },
  { id: "카드액자", label: "카드액자" },
];

export const CARD_FRAME_IDS = new Set(["squareframe", "cardframe"]);

export function itemMatchesTab(item: RoomItem, tab: RoomTab) {
  if (tab === "벽 꾸미기") return item.placement === "wall";
  if (tab === "카드액자") return item.category === "카드액자" || CARD_FRAME_IDS.has(item.id);
  if (tab === "바닥") return item.placement === "floor-skin" || item.category === "바닥";
  return item.category === tab && item.placement !== "wall";
}
