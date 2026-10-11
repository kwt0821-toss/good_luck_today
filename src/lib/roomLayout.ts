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
export const WALL_SLOTS = 8;
export const WALL_BANDS = 3;
export const WALL_BAND_EDGES = [32, 76, 118, 160] as const;
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
  const coords = wallPlaceFromSlot(item, place.wall, place.slot, place.band);
  const t = Number.isFinite(place.t) ? place.t : coords.t;
  const heightUnits = Number.isFinite(place.heightUnits) ? place.heightUnits : coords.heightUnits;
  const base = place.wall === "L" ? tileTopWorld(0, t) : tileTopWorld(t, 0);
  return {
    x: base.x - w / 2,
    y: base.y - heightUnits * 3 - h / 2,
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

export function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function wallSpanOf(item: RoomItem) {
  return clamp(Math.round(item.wallSpanTiles ?? 1), 1, WALL_SLOTS);
}

export function wallBandCenter(band: number) {
  const i = clamp(band, 0, WALL_BANDS - 1);
  return (WALL_BAND_EDGES[i] + WALL_BAND_EDGES[i + 1]) / 2;
}

export function wallBandFromHeight(heightUnits: number) {
  for (let band = 0; band < WALL_BANDS; band += 1) {
    if (heightUnits < WALL_BAND_EDGES[band + 1]) return band;
  }
  return WALL_BANDS - 1;
}

export function wallCoordsFromT(item: RoomItem, t: number, heightUnits: number) {
  const span = wallSpanOf(item);
  const slot = clamp(Math.round(t - span / 2), 0, WALL_SLOTS - span);
  return { slot, band: wallBandFromHeight(heightUnits), span };
}

export function wallPlaceFromSlot(
  item: RoomItem,
  wall: "L" | "R",
  slot: number,
  band: number,
): Pick<WallPlacement, "wall" | "slot" | "band" | "t" | "heightUnits"> {
  const span = wallSpanOf(item);
  const nextSlot = clamp(slot, 0, WALL_SLOTS - span);
  const nextBand = clamp(band, 0, WALL_BANDS - 1);
  return {
    wall,
    slot: nextSlot,
    band: nextBand,
    t: nextSlot + span / 2,
    heightUnits: wallBandCenter(nextBand),
  };
}

export function resolvedWallSlot(item: RoomItem, place: WallPlacement) {
  if (Number.isInteger(place.slot) && Number.isInteger(place.band)) {
    return { slot: place.slot, band: place.band, span: wallSpanOf(item) };
  }
  return wallCoordsFromT(item, place.t, place.heightUnits);
}

export function wallCellsOf(item: RoomItem, place: Pick<WallPlacement, "wall" | "slot" | "band" | "t" | "heightUnits">) {
  const { slot, band, span } = resolvedWallSlot(item, place as WallPlacement);
  const cells: { wall: "L" | "R"; slot: number; band: number }[] = [];
  for (let i = 0; i < span; i += 1) {
    cells.push({ wall: place.wall, slot: slot + i, band });
  }
  return cells;
}

export function wallOccupancy(
  walls: WallPlacement[],
  byId: Map<string, RoomItem>,
  ignoreInstanceId?: string,
) {
  const used = new Set<string>();
  for (const place of walls) {
    if (place.instanceId === ignoreInstanceId) continue;
    const item = byId.get(place.id);
    if (!item) continue;
    for (const cell of wallCellsOf(item, place)) {
      used.add(`${cell.wall}:${cell.slot}:${cell.band}`);
    }
  }
  return used;
}

export function canPlaceWall(
  item: RoomItem,
  wall: "L" | "R",
  slot: number,
  band: number,
  used: Set<string>,
) {
  const span = wallSpanOf(item);
  if (slot < 0 || band < 0 || band >= WALL_BANDS || slot + span > WALL_SLOTS) return false;
  for (let i = 0; i < span; i += 1) {
    if (used.has(`${wall}:${slot + i}:${band}`)) return false;
  }
  return true;
}

export function firstFreeOnWall(
  item: RoomItem,
  walls: WallPlacement[],
  byId: Map<string, RoomItem>,
  wall: "L" | "R",
) {
  const used = wallOccupancy(walls, byId);
  for (const band of [1, 0, 2]) {
    for (let slot = 0; slot < WALL_SLOTS; slot += 1) {
      if (canPlaceWall(item, wall, slot, band, used)) {
        return wallPlaceFromSlot(item, wall, slot, band);
      }
    }
  }
  return null;
}

export function firstFreeWallSlot(
  item: RoomItem,
  walls: WallPlacement[],
  byId: Map<string, RoomItem>,
  prefer: "L" | "R" = "L",
) {
  return firstFreeOnWall(item, walls, byId, prefer) ?? firstFreeOnWall(item, walls, byId, prefer === "L" ? "R" : "L");
}

export function wallCellPoints(wall: "L" | "R", slot: number, band: number) {
  const h0 = WALL_BAND_EDGES[band] * 3;
  const h1 = WALL_BAND_EDGES[band + 1] * 3;
  const a = wall === "L" ? tileTopWorld(0, slot) : tileTopWorld(slot, 0);
  const b = wall === "L" ? tileTopWorld(0, slot + 1) : tileTopWorld(slot + 1, 0);
  return `${a.x},${a.y - h0} ${b.x},${b.y - h0} ${b.x},${b.y - h1} ${a.x},${a.y - h1}`;
}

export function isoFromScreen(localX: number, localY: number, mode: RoomMode) {
  const scr = screenOf(mode);
  const u = (localX - scr.left) / scr.S;
  const v = (localY - scr.top) / scr.S;
  const col = ((u - 640) / 26 + (v - 300) / 13) / 2;
  const row = ((v - 300) / 13 - (u - 640) / 26) / 2;
  return { u, v, col, row };
}

export function hitTestWall(localX: number, localY: number, mode: RoomMode): {
  wall: "L" | "R";
  t: number;
  heightUnits: number;
} | null {
  const { u, v, col, row } = isoFromScreen(localX, localY, mode);
  const leftT = (640 - u) / 26;
  const leftH = 300 + leftT * 13 - v;
  const rightT = (u - 640) / 26;
  const rightH = 300 + rightT * 13 - v;
  const leftOk = leftT >= -0.35 && leftT <= WALL_SLOTS + 0.35 && leftH >= 18 && leftH <= 175;
  const rightOk = rightT >= -0.35 && rightT <= WALL_SLOTS + 0.35 && rightH >= 18 && rightH <= 175;
  if (leftOk && rightOk) {
    return col < row
      ? { wall: "L", t: clamp(leftT, 0, WALL_SLOTS), heightUnits: clamp(leftH, WALL_BAND_EDGES[0], WALL_BAND_EDGES[3]) }
      : { wall: "R", t: clamp(rightT, 0, WALL_SLOTS), heightUnits: clamp(rightH, WALL_BAND_EDGES[0], WALL_BAND_EDGES[3]) };
  }
  if (leftOk) {
    return { wall: "L", t: clamp(leftT, 0, WALL_SLOTS), heightUnits: clamp(leftH, WALL_BAND_EDGES[0], WALL_BAND_EDGES[3]) };
  }
  if (rightOk) {
    return { wall: "R", t: clamp(rightT, 0, WALL_SLOTS), heightUnits: clamp(rightH, WALL_BAND_EDGES[0], WALL_BAND_EDGES[3]) };
  }
  if (col < 1.2 || row < 1.2) {
    const wall: "L" | "R" = col <= row ? "L" : "R";
    const t = wall === "L" ? clamp(row, 0, WALL_SLOTS - 0.01) : clamp(col, 0, WALL_SLOTS - 0.01);
    const h = wall === "L" ? leftH : rightH;
    return { wall, t, heightUnits: clamp(h, WALL_BAND_EDGES[0], WALL_BAND_EDGES[3]) };
  }
  return null;
}

export function snapWallHit(item: RoomItem, hit: { wall: "L" | "R"; t: number; heightUnits: number }) {
  const span = wallSpanOf(item);
  const slot = clamp(Math.floor(hit.t - (span - 1) / 2), 0, WALL_SLOTS - span);
  const band = wallBandFromHeight(hit.heightUnits);
  return wallPlaceFromSlot(item, hit.wall, slot, band);
}

export function cloneLayout<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
