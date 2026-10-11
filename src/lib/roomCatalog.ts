import { DEFAULT_FLOOR_TILE, DEFAULT_WALL_TILE, registerThemeTile, setTileRules } from "./roomTiles";
import type {
  FurnitureOrientation,
  RoomCatalog,
  RoomCategory,
  RoomItem,
  RoomPlacementKind,
  RoomTab,
  RoomThemeFilter,
  RoomTileRules,
  RoomUnlock,
} from "./roomTypes";
import { isWallDecor } from "./roomLayout";

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
  theme?: string;
  textureId?: string;
  footprint?: [number, number] | null;
  price?: number;
  ownedDefault?: boolean;
  placedDefault?: boolean;
  image?: string | null;
  thumb?: string | null;
  drawerThumb?: string | null;
  imageSizePx?: [number, number];
  tileImage?: string | null;
  orientations?: {
    default?: RawFurnitureOri;
    mirrored?: RawFurnitureOri;
    front?: string;
    leftWall?: string;
    rightWall?: string;
  };
  isoTiles?: Record<string, string>;
  columnsL?: string[];
  columnsR?: string[];
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
  worldPxBase?: [number, number];
  worldPxFootprintCenter?: [number, number];
  wall?: "L" | "R";
  t?: number;
  heightUnits?: number;
  onTop?: string;
  fx?: number;
  fy?: number;
  kind?: string;
  shadow?: string | null;
  image?: string;
};

export type RoomGridFile = {
  defaultLayout?: GridLayoutEntry[];
  tileMaps?: Partial<RoomTileRules>;
};

export type RoomDefinition = {
  id: string;
  nameKo: string;
  isDefault: boolean;
  unlock: RoomUnlock;
  defaultFloor: string;
  defaultWall: { L: string; R: string };
  floorTiles?: string[][];
  wallTiles?: { L: string[]; R: string[] };
  defaultLayout?: GridLayoutEntry[];
  walkableTiles?: [number, number][];
  catRoaming?: unknown;
  hint: string;
};

export type RoomsFile = {
  switcher: { order: string[] };
  catRoaming?: unknown;
  rooms: RoomDefinition[];
};

export const ROOM_HINTS: Record<string, { lead?: string; rest: string }> = {
  moon_bedroom: { lead: "쉿,", rest: " 냥이가 자는 동안 방을 꾸며 봐요" },
  cat_cafe: { rest: "오늘도 라떼는 냥이 몫이에요" },
  sakura_greenhouse: { rest: "벚꽃잎 사이로 냥이가 낮잠 중이에요" },
};

export const ROOM_THEME_FILTERS: { id: RoomThemeFilter; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "moon_bedroom", label: "달밤" },
  { id: "cat_cafe", label: "카페" },
  { id: "sakura_greenhouse", label: "온실" },
];

const DEFAULT_ROOM_ORDER = ["moon_bedroom", "cat_cafe", "sakura_greenhouse"];

let catalogPromise: Promise<RoomCatalog> | null = null;
let gridPromise: Promise<RoomGridFile> | null = null;
let roomsPromise: Promise<RoomsFile> | null = null;

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
    theme: "moon_bedroom",
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
  if (value === "floorTile" || value === "floor-skin") return "floor-skin";
  if (value === "wallColumn" || value === "wallpaper") return "wallpaper";
  if (value === "wallTop") return "wallTop";
  if (value === "floor" || value === "floor-decal" || value === "wall") return value;
  return "floor";
}

function cleanShadow(raw: string | null | undefined, id: string): string | null | undefined {
  if (id === "koi_pond" || id === "picnic_blanket") return null;
  if (typeof raw !== "string") return raw;
  const match = raw.match(/shadows\/[^\s)]+/);
  return match ? match[0] : raw;
}

function registerItemTiles(id: string, theme: string | undefined, raw: RawItem, placement: RoomPlacementKind) {
  if (raw.isoTiles?.["00"]) {
    registerThemeTile(id, {
      floor: raw.isoTiles["00"].replace(`${id}_00`, `${id}_{c%2}{r%2}`),
    });
  } else if (placement === "floor-skin" && theme && theme !== "moon_bedroom") {
    registerThemeTile(id, { floor: `themes/${theme}/floor/iso/{id}_{c%2}{r%2}.png` });
  }
  if (raw.columnsL?.[0]) {
    registerThemeTile(id, { wallL: raw.columnsL[0].replace(`${id}_0`, `${id}_{i}`) });
  } else if (placement === "wallpaper" && theme && theme !== "moon_bedroom") {
    registerThemeTile(id, { wallL: `themes/${theme}/wall/L/{id}_{i}.png` });
  }
  if (raw.columnsR?.[0]) {
    registerThemeTile(id, { wallR: raw.columnsR[0].replace(`${id}_0`, `${id}_{i}`) });
  } else if (placement === "wallpaper" && theme && theme !== "moon_bedroom") {
    registerThemeTile(id, { wallR: `themes/${theme}/wall/R/{id}_{i}.png` });
  }
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

function normalizeItem(raw: RawItem, fallbackTheme = "moon_bedroom"): RoomItem {
  const id = raw.textureId ?? raw.id;
  const theme = raw.theme ?? fallbackTheme;
  const placement = asPlacement(raw.placement);
  registerItemTiles(id, theme, raw, placement);
  const defaultOri = asFurnitureOri(raw.orientations?.default, raw);
  const mirroredOri = asFurnitureOri(raw.orientations?.mirrored, raw);
  const wallFront = raw.orientations?.front;
  const wallLeft = raw.orientations?.leftWall;
  const wallRight = raw.orientations?.rightWall;
  const thumb = raw.drawerThumb ?? raw.thumb ?? raw.tileImage ?? raw.image ?? (raw.id ? `tiles/${raw.id}.png` : null);
  return {
    id,
    nameKo: raw.nameKo ?? raw.id,
    category: asCategory(raw.category),
    placement,
    footprint: raw.footprint ?? null,
    price: raw.price ?? 0,
    ownedDefault: Boolean(raw.ownedDefault),
    placedDefault: Boolean(raw.placedDefault),
    image: raw.image ?? raw.thumb ?? null,
    imageSizePx: raw.imageSizePx,
    tileImage: thumb,
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
    shadow: cleanShadow(raw.shadow, id),
    theme,
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
    theme: "moon_bedroom",
  };
}

export function loadRoomCatalog(): Promise<RoomCatalog> {
  if (!catalogPromise) {
    catalogPromise = Promise.all([
      fetch(roomAsset("items.json")).then((res) => {
        if (!res.ok) throw new Error("room catalog missing");
        return res.json() as Promise<RawCatalog>;
      }),
      fetch(roomAsset("items-themes.json"))
        .then((res) => (res.ok ? (res.json() as Promise<RawCatalog>) : { items: [] }))
        .catch(() => ({ items: [] as RawItem[] })),
    ])
      .then(([data, themes]) => {
        setTileRules(parseTileRules(data.tileRules));
        const seen = new Set<string>();
        const merged: RoomItem[] = [];
        for (const raw of data.items ?? []) {
          const item = normalizeItem(raw, "moon_bedroom");
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          merged.push(item);
        }
        for (const raw of themes.items ?? []) {
          const item = normalizeItem(raw, raw.theme ?? "cat_cafe");
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          merged.push(item);
        }
        const items = mergeSkinItems(merged);
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
      .then((res) => (res.ok ? (res.json() as Promise<RoomGridFile>) : ({} as RoomGridFile)))
      .then((data) => {
        if (data.tileMaps) setTileRules(data.tileMaps);
        return data;
      })
      .catch(() => ({} as RoomGridFile));
  }
  return gridPromise;
}

function asRoomUnlock(raw: unknown): RoomUnlock {
  if (!raw || typeof raw !== "object") return { type: "PLACEHOLDER" };
  const rec = raw as { type?: unknown; example?: unknown };
  return {
    type: typeof rec.type === "string" ? rec.type : "PLACEHOLDER",
    example: typeof rec.example === "string" ? rec.example : undefined,
  };
}

function asLayoutEntries(raw: unknown): GridLayoutEntry[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: GridLayoutEntry[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || typeof (entry as { id?: unknown }).id !== "string") continue;
    const rec = entry as GridLayoutEntry;
    out.push({
      ...rec,
      worldPx: rec.worldPxBase ?? rec.worldPx,
    });
  }
  return out;
}

function normalizeRoom(raw: Record<string, unknown>): RoomDefinition | null {
  if (typeof raw.id !== "string" || typeof raw.nameKo !== "string") return null;
  const defaultWallRaw = raw.defaultWall;
  const defaultWall =
    defaultWallRaw && typeof defaultWallRaw === "object"
      ? {
          L: typeof (defaultWallRaw as { L?: unknown }).L === "string" ? (defaultWallRaw as { L: string }).L : DEFAULT_WALL_TILE,
          R: typeof (defaultWallRaw as { R?: unknown }).R === "string" ? (defaultWallRaw as { R: string }).R : DEFAULT_WALL_TILE,
        }
      : { L: DEFAULT_WALL_TILE, R: DEFAULT_WALL_TILE };
  const walkable = Array.isArray(raw.walkableTiles)
    ? (raw.walkableTiles.filter(
        (tile) => Array.isArray(tile) && typeof tile[0] === "number" && typeof tile[1] === "number",
      ) as [number, number][])
    : undefined;
  return {
    id: raw.id,
    nameKo: raw.nameKo,
    isDefault: Boolean(raw.isDefault),
    unlock: asRoomUnlock(raw.unlock),
    defaultFloor: typeof raw.defaultFloor === "string" ? raw.defaultFloor : DEFAULT_FLOOR_TILE,
    defaultWall,
    floorTiles: Array.isArray(raw.floorTiles) ? (raw.floorTiles as string[][]) : undefined,
    wallTiles:
      raw.wallTiles && typeof raw.wallTiles === "object"
        ? (raw.wallTiles as { L: string[]; R: string[] })
        : undefined,
    defaultLayout: asLayoutEntries(raw.defaultLayout),
    walkableTiles: walkable,
    catRoaming: raw.catRoaming,
    hint: ROOM_HINTS[raw.id]?.rest ? `${ROOM_HINTS[raw.id].lead ?? ""}${ROOM_HINTS[raw.id].rest}` : "",
  };
}

const FALLBACK_ROOMS: RoomsFile = {
  switcher: { order: [...DEFAULT_ROOM_ORDER] },
  rooms: [
    {
      id: "moon_bedroom",
      nameKo: "달밤 침실",
      isDefault: true,
      unlock: { type: "default" },
      defaultFloor: DEFAULT_FLOOR_TILE,
      defaultWall: { L: DEFAULT_WALL_TILE, R: DEFAULT_WALL_TILE },
      hint: `${ROOM_HINTS.moon_bedroom.lead ?? ""}${ROOM_HINTS.moon_bedroom.rest}`,
    },
  ],
};

export function loadRoomsFile(): Promise<RoomsFile> {
  if (!roomsPromise) {
    roomsPromise = fetch(roomAsset("rooms.json"))
      .then((res) => (res.ok ? (res.json() as Promise<Record<string, unknown>>) : null))
      .then((data) => {
        if (!data || !Array.isArray(data.rooms)) return FALLBACK_ROOMS;
        const rooms = data.rooms
          .map((entry) => (entry && typeof entry === "object" ? normalizeRoom(entry as Record<string, unknown>) : null))
          .filter((room): room is RoomDefinition => Boolean(room));
        if (!rooms.length) return FALLBACK_ROOMS;
        const rawOrder = (data.switcher as { order?: unknown } | undefined)?.order;
        const order = Array.isArray(rawOrder)
          ? rawOrder.filter((id): id is string => typeof id === "string" && rooms.some((room) => room.id === id))
          : rooms.map((room) => room.id);
        return {
          switcher: { order: order.length ? order : rooms.map((room) => room.id) },
          catRoaming: data.catRoaming,
          rooms,
        };
      })
      .catch(() => FALLBACK_ROOMS);
  }
  return roomsPromise;
}

export function roomById(rooms: RoomDefinition[], id: string) {
  return rooms.find((room) => room.id === id);
}

export function defaultRoomId(roomsFile: RoomsFile) {
  return roomsFile.rooms.find((room) => room.isDefault)?.id ?? roomsFile.switcher.order[0] ?? roomsFile.rooms[0]?.id ?? "moon_bedroom";
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
  if (tab === "벽 꾸미기") return isWallDecor(item);
  if (tab === "벽지") return item.category === "벽지" || item.placement === "wallpaper";
  if (tab === "카드액자") return item.category === "카드액자" || CARD_FRAME_IDS.has(item.id);
  if (tab === "바닥") return item.placement === "floor-skin" || item.category === "바닥";
  return (
    item.category === tab &&
    item.placement !== "wall" &&
    item.placement !== "wallTop" &&
    item.placement !== "wallpaper" &&
    item.placement !== "floor-skin"
  );
}

export function itemMatchesTheme(item: RoomItem, filter: RoomThemeFilter) {
  if (filter === "all") return true;
  return (item.theme ?? "moon_bedroom") === filter;
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
