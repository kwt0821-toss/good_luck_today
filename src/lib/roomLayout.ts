import type { FloorPlacement, RoomItem, RoomMode, WallPlacement } from "./roomTypes";

export const GRID = 8;
export const WORLD_W = 3840;
export const WORLD_H = 2160;
export const ISO_OX = 1920;
export const ISO_OY = 900;
export const TILE_WX = 78;
export const TILE_WY = 39;

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

export function itemSize(item: RoomItem, rot: 0 | 1): [number, number] {
  const [w, d] = item.footprint ?? [1, 1];
  return rot ? [d, w] : [w, d];
}

export function isDecal(item: RoomItem | undefined) {
  return item?.layer === "decal" || item?.id === "rug";
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
    const item = byId.get(place.id);
    if (!item || item.placement !== "floor" || isDecal(item)) continue;
    const [w, d] = itemSize(item, place.rot);
    for (const tile of footprintTiles(place.col, place.row, w, d)) {
      used.add(`${tile.col},${tile.row}`);
    }
  }
  return used;
}

export function canPlace(
  col: number, row: number, w: number, d: number, used: Set<string>,
) {
  if (!inGrid(col, row, w, d)) return false;
  for (const tile of footprintTiles(col, row, w, d)) {
    if (used.has(`${tile.col},${tile.row}`)) return false;
  }
  return true;
}

export function firstFreeTile(
  item: RoomItem,
  rot: 0 | 1,
  floor: FloorPlacement[],
  byId: Map<string, RoomItem>,
) {
  const [w, d] = itemSize(item, rot);
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
  const [w, d] = itemSize(item, place.rot);
  const front = place.col + w - 1 + (place.row + d - 1);
  const bias = place.col - place.row;
  const area = w * d;
  return { front, bias, area };
}

export function sortFloor(floor: FloorPlacement[], byId: Map<string, RoomItem>) {
  return [...floor].sort((a, b) => {
    const ia = byId.get(a.id);
    const ib = byId.get(b.id);
    if (!ia || !ib) return 0;
    const ka = depthKey(a, ia);
    const kb = depthKey(b, ib);
    if (ka.front !== kb.front) return ka.front - kb.front;
    if (ka.bias !== kb.bias) return ka.bias - kb.bias;
    return ka.area - kb.area;
  });
}

export function spriteWorldPos(item: RoomItem, col: number, row: number, rot: 0 | 1) {
  if (item.wallPosWorldPx && item.placement === "wall") {
    return { x: item.wallPosWorldPx[0], y: item.wallPosWorldPx[1] };
  }
  const [w, d] = itemSize(item, rot);
  const centre = footprintCentreWorld(col, row, w, d);
  const [ax, ay] = item.anchorOffsetWorldPx ?? [-(item.spriteWorldPx?.[0] ?? 52) / 2, -(item.spriteWorldPx?.[1] ?? 78)];
  return { x: centre.x + ax, y: centre.y + ay };
}

export function wallSpritePos(item: RoomItem, wall: WallPlacement) {
  if (wall.worldPx) return { x: wall.worldPx[0], y: wall.worldPx[1] };
  if (item.wallPosWorldPx) return { x: item.wallPosWorldPx[0], y: item.wallPosWorldPx[1] };
  return { x: ISO_OX, y: ISO_OY };
}

export function hitTestTile(
  localX: number,
  localY: number,
  mode: RoomMode,
): { col: number; row: number } {
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

export function contactShadow(item: RoomItem, col: number, row: number, rot: 0 | 1) {
  const [w, d] = itemSize(item, rot);
  const centre = footprintCentreWorld(col, row, w, d);
  const special: Record<string, [number, number]> = {
    floorlamp: [15, 6],
    yarn: [9, 4],
  };
  const [rxU, ryU] = special[item.id] ?? [26 * 0.62 * (w + d), 13 * 0.62 * (w + d)];
  return {
    cx: centre.x,
    cy: centre.y + 6,
    rx: rxU * 3,
    ry: ryU * 3,
  };
}

export function nearestHints(
  item: RoomItem,
  rot: 0 | 1,
  floor: FloorPlacement[],
  byId: Map<string, RoomItem>,
  ignoreInstanceId?: string,
  limit = 2,
) {
  const [w, d] = itemSize(item, rot);
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
  rot: 0 | 1,
  used: Set<string>,
): { col: number; row: number; valid: boolean }[] {
  const [w, d] = itemSize(item, rot);
  const whole = inGrid(col, row, w, d);
  return footprintTiles(col, row, w, d).map((tile) => ({
    ...tile,
    valid: whole && (isDecal(item) || !used.has(`${tile.col},${tile.row}`)),
  }));
}

export function cloneLayout<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
