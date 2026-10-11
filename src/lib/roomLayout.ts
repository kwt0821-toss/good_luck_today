import type {
  FloorPlacement,
  FurnitureOrientation,
  RoomItem,
  RoomMode,
  RoomOrientation,
  SpriteRect,
  WallPlacement,
} from "./roomTypes";

export const GRID = 8;
export const WORLD_W = 3840;
export const WORLD_H = 2160;
export const ISO_OX = 1920;
export const ISO_OY = 900;
export const TILE_WX = 78;
export const TILE_WY = 39;
export const TILE_WORLD = 156;

export const SCREENS = {
  view: {
    scale: 0.24667,
    S: 0.74,
    left: -282.33,
    top: 39,
    width: 947.2,
    height: 532.8,
  },
  edit: {
    scale: 0.28,
    S: 0.84,
    left: -342.67,
    top: -63.33,
    width: 1075.2,
    height: 604.8,
  },
} as const;

const SHADOW_SIZE: Record<string, [number, number]> = {
  "1x1": [250, 126],
  "2x1": [328, 164],
  "1x2": [328, 164],
  "2x2": [406, 204],
};

export function screenOf(mode: RoomMode) {
  return SCREENS[mode];
}

export function tileTopWorld(col: number, row: number) {
  return {
    x: ISO_OX + (col - row) * TILE_WX,
    y: ISO_OY + (col + row) * TILE_WY,
  };
}

export function footprintCentreWorld(col: number, row: number, w: number, d: number) {
  return tileTopWorld(col + w / 2, row + d / 2);
}

export function isFurniture(item: RoomItem | undefined): item is RoomItem & {
  furniture: { default: FurnitureOrientation; mirrored: FurnitureOrientation };
} {
  return Boolean(item?.furniture?.default && item.furniture.mirrored);
}

export function isDecal(item: RoomItem | undefined) {
  return Boolean(item?.decal || item?.placement === "floor-decal" || item?.id === "pawrug");
}

export function isOnTop(place: FloorPlacement) {
  return Boolean(place.onTopOf);
}

export function furnitureOri(item: RoomItem, orientation: RoomOrientation): FurnitureOrientation | null {
  if (!item.furniture) return null;
  return item.furniture[orientation] ?? item.furniture.default;
}

export function itemSize(item: RoomItem, orientation: RoomOrientation): [number, number] {
  const ori = furnitureOri(item, orientation);
  if (ori) return ori.footprint;
  const [w, d] = item.footprint ?? [1, 1];
  return orientation === "mirrored" ? [d, w] : [w, d];
}

export function toggledOrientation(orientation: RoomOrientation): RoomOrientation {
  return orientation === "default" ? "mirrored" : "default";
}

export function footprintTiles(col: number, row: number, w: number, d: number) {
  const tiles: { col: number; row: number }[] = [];
  for (let dc = 0; dc < w; dc += 1) {
    for (let dr = 0; dr < d; dr += 1) {
      tiles.push({ col: col + dc, row: row + dr });
    }
  }
  return tiles;
}

export function inGrid(col: number, row: number, w: number, d: number) {
  return col >= 0 && row >= 0 && col + w <= GRID && row + d <= GRID;
}

export function occupancy(
  floor: FloorPlacement[],
  byId: Map<string, RoomItem>,
  ignoreInstanceId?: string,
) {
  const used = new Set<string>();
  for (const place of floor) {
    if (place.instanceId === ignoreInstanceId) continue;
    if (isOnTop(place)) continue;
    const item = byId.get(place.id);
    if (!item || isDecal(item)) continue;
    if (item.placement !== "floor") continue;
    const [w, d] = itemSize(item, place.orientation);
    for (const tile of footprintTiles(place.col, place.row, w, d)) {
      used.add(`${tile.col},${tile.row}`);
    }
  }
  return used;
}

export function canPlace(col: number, row: number, w: number, d: number, used: Set<string>) {
  if (!inGrid(col, row, w, d)) return false;
  for (const tile of footprintTiles(col, row, w, d)) {
    if (used.has(`${tile.col},${tile.row}`)) return false;
  }
  return true;
}

export function firstFreeTile(
  item: RoomItem,
  orientation: RoomOrientation,
  floor: FloorPlacement[],
  byId: Map<string, RoomItem>,
) {
  const [w, d] = itemSize(item, orientation);
  const used = occupancy(floor, byId);
  if (isDecal(item)) {
    for (let row = 0; row < GRID; row += 1) {
      for (let col = 0; col < GRID; col += 1) {
        if (inGrid(col, row, w, d)) return { col, row };
      }
    }
    return null;
  }
  for (let row = 0; row < GRID; row += 1) {
    for (let col = 0; col < GRID; col += 1) {
      if (canPlace(col, row, w, d, used)) return { col, row };
    }
  }
  return null;
}

export function depthKey(place: FloorPlacement, item: RoomItem) {
  const [w, d] = itemSize(item, place.orientation);
  const front = place.col + w - 1 + (place.row + d - 1);
  const bias = place.col - place.row;
  const area = w * d;
  return { front, bias, area };
}

export function sortFloor(floor: FloorPlacement[], byId: Map<string, RoomItem>) {
  const hosts = floor.filter((place) => !isOnTop(place));
  const sitting = floor.filter(isOnTop);
  const sortedHosts = [...hosts].sort((a, b) => {
    const ia = byId.get(a.id);
    const ib = byId.get(b.id);
    if (!ia || !ib) return 0;
    const ka = depthKey(a, ia);
    const kb = depthKey(b, ib);
    if (ka.front !== kb.front) return ka.front - kb.front;
    if (ka.bias !== kb.bias) return ka.bias - kb.bias;
    return ka.area - kb.area;
  });
  const out: FloorPlacement[] = [];
  for (const host of sortedHosts) {
    out.push(host);
    for (const child of sitting) {
      if (child.onTopOf === host.id || child.onTopOf === host.instanceId) out.push(child);
    }
  }
  for (const child of sitting) {
    if (!out.includes(child)) out.push(child);
  }
  return out;
}

function decorSize(item: RoomItem, scale = 1) {
  const displayW = (item.displayWidthTiles ?? 1) * TILE_WORLD * scale;
  const srcW = item.imageSizePx?.[0] ?? TILE_WORLD;
  const srcH = item.imageSizePx?.[1] ?? TILE_WORLD;
  return { w: displayW, h: displayW * (srcH / srcW) };
}

export function hostOf(place: FloorPlacement, floor: FloorPlacement[]) {
  if (!place.onTopOf) return null;
  return (
    floor.find((entry) => entry.instanceId === place.onTopOf || entry.id === place.onTopOf) ?? null
  );
}

export function spriteRect(
  item: RoomItem,
  place: FloorPlacement,
  floor: FloorPlacement[],
  byId: Map<string, RoomItem>,
): SpriteRect {
  if (place.onTopOf) {
    const hostPlace = hostOf(place, floor);
    const hostItem = hostPlace ? byId.get(hostPlace.id) : undefined;
    if (hostPlace && hostItem) {
      const host = spriteRect(hostItem, { ...hostPlace, onTopOf: undefined }, floor, byId);
      const size = decorSize(item, 0.62);
      const fx = place.fx ?? 0.5;
      const fy = place.fy ?? 0.3;
      return {
        x: host.x + host.w * fx - size.w / 2,
        y: host.y + host.h * fy - size.h,
        w: size.w,
        h: size.h,
        src: item.image ?? "",
      };
    }
  }

  const [w, d] = itemSize(item, place.orientation);
  const centre = footprintCentreWorld(place.col, place.row, w, d);
  const ori = furnitureOri(item, place.orientation);
  if (ori) {
    return {
      x: centre.x - ori.anchorFootprintCenterPx[0],
      y: centre.y - ori.anchorFootprintCenterPx[1],
      w: ori.size[0],
      h: ori.size[1],
      src: ori.image,
    };
  }

  if (isDecal(item)) {
    const rw = 0.96 * (w + d) * TILE_WX;
    const rh = 0.96 * (w + d) * TILE_WY;
    return {
      x: centre.x - rw / 2,
      y: centre.y - rh / 2,
      w: rw,
      h: rh,
      src: item.image ?? "",
    };
  }

  const size = decorSize(item);
  const yBottom = centre.y + 0.55 * ((w + d) / 2) * TILE_WY;
  return {
    x: centre.x - size.w / 2,
    y: yBottom - size.h,
    w: size.w,
    h: size.h,
    src: item.image ?? "",
  };
}

export function wallImageSize(item: RoomItem): [number, number] {
  const [fw, fh] = item.imageSizePx ?? [120, 150];
  const shearedW = fw * 0.894;
  return [Math.round(shearedW), Math.round(fh + 0.5 * shearedW)];
}

export function wallSpriteRect(item: RoomItem, place: WallPlacement): SpriteRect {
  const src =
    (place.wall === "L" ? item.wallImages?.left : item.wallImages?.right) ?? item.image ?? "";
  const [w, h] = wallImageSize(item);
  if (place.worldPx) {
    return { x: place.worldPx[0], y: place.worldPx[1], w, h, src };
  }
  const base = place.wall === "L" ? tileTopWorld(0, place.t) : tileTopWorld(place.t, 0);
  return {
    x: base.x - w / 2,
    y: base.y - place.heightUnits * 3 - h / 2,
    w,
    h,
    src,
  };
}

export function shadowRect(item: RoomItem, place: FloorPlacement): SpriteRect | null {
  if (isDecal(item) || isOnTop(place) || item.shadow === null) return null;
  const [w, d] = itemSize(item, place.orientation);
  const key = `${w}x${d}`;
  const size = SHADOW_SIZE[key] ?? SHADOW_SIZE["1x1"];
  const scale = isFurniture(item) ? 1 : 0.8;
  const sw = size[0] * scale;
  const sh = size[1] * scale;
  const centre = footprintCentreWorld(place.col, place.row, w, d);
  return {
    x: centre.x - sw / 2,
    y: centre.y - sh / 2,
    w: sw,
    h: sh,
    src: `shadows/shadow-${SHADOW_SIZE[key] ? key : "1x1"}.png`,
  };
}

export function hitTestTile(localX: number, localY: number, mode: RoomMode): { col: number; row: number } {
  const scr = screenOf(mode);
  const u = (localX - scr.left) / scr.S;
  const v = (localY - scr.top) / scr.S;
  const col = ((u - 640) / 26 + (v - 300) / 13) / 2;
  const row = ((v - 300) / 13 - (u - 640) / 26) / 2;
  return { col: Math.floor(col), row: Math.floor(row) };
}

export function diamondPoints(col: number, row: number) {
  const t = tileTopWorld(col, row);
  const r = tileTopWorld(col + 1, row);
  const b = tileTopWorld(col + 1, row + 1);
  const l = tileTopWorld(col, row + 1);
  return `${t.x},${t.y} ${r.x},${r.y} ${b.x},${b.y} ${l.x},${l.y}`;
}

export function nearestHints(
  item: RoomItem,
  orientation: RoomOrientation,
  floor: FloorPlacement[],
  byId: Map<string, RoomItem>,
  ignoreInstanceId?: string,
  limit = 2,
) {
  const [w, d] = itemSize(item, orientation);
  const used = occupancy(floor, byId, ignoreInstanceId);
  const hints: { col: number; row: number }[] = [];
  for (let row = 0; row < GRID && hints.length < limit; row += 1) {
    for (let col = 0; col < GRID && hints.length < limit; col += 1) {
      if (isDecal(item) ? inGrid(col, row, w, d) : canPlace(col, row, w, d, used)) {
        hints.push({ col, row });
      }
    }
  }
  return hints;
}

export function previewTiles(
  item: RoomItem,
  col: number,
  row: number,
  orientation: RoomOrientation,
  used: Set<string>,
): { col: number; row: number; valid: boolean }[] {
  const [w, d] = itemSize(item, orientation);
  const whole = inGrid(col, row, w, d);
  return footprintTiles(col, row, w, d).map((tile) => ({
    ...tile,
    valid: whole && (isDecal(item) || !used.has(`${tile.col},${tile.row}`)),
  }));
}

export function nextWallSlot(walls: WallPlacement[], prefer: "L" | "R" = "L") {
  const wall: "L" | "R" =
    walls.filter((item) => item.wall === "L").length <= walls.filter((item) => item.wall === "R").length
      ? prefer
      : prefer === "L"
        ? "R"
        : "L";
  const used = walls.filter((item) => item.wall === wall).map((item) => item.t);
  let t = 1.2;
  while (used.some((slot) => Math.abs(slot - t) < 1.1) && t < 7) t += 1.15;
  return { wall, t, heightUnits: 92 };
}

export function cloneLayout<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
