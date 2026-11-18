import { roomAsset } from "./roomCatalog";
import { findPath, tileCentreWorld, tileKey, type CatTile, type CatWalkDir } from "./roomCat";
import {
  GRID,
  footprintCentreWorld,
  footprintTiles,
  itemSize,
  wallSpriteRect,
} from "./roomLayout";
import type { FloorPlacement, RoomItem, WallPlacement } from "./roomTypes";

/** How often a resting cat tries an empty seat instead of a floor tile. */
export const CAT_SEAT_CHANCE = 0.4;
/** Short rise onto the seat. No hop sheet — the sit pose just changes height. */
export const CAT_HOP_MS = 420;

/**
 * Cheese window pose. 536×771, feet at 352,762.
 * `body` is the source-pixel width of the cat, so the drawn body stays ~125 world px.
 * Breeds without this file keep idle_sit.
 */
export const SIT_LOOK_CHEESE = {
  breedId: "cheese",
  src: "poses/sit_look-cheese.webp",
  w: 536,
  h: 771,
  ax: 352,
  ay: 762,
  body: 320,
};
export const SIT_LOOK_BODY_PX = 125;

export type CatSeatPose = "sit" | "sleep" | "loaf" | "sit_look";
export type CatSeatDefPose = "sit" | "sleep" | "sit_look";

export type CatSeatDef = {
  itemId: string;
  weight: number;
  pose: CatSeatDefPose;
  lift: number;
  slots: { c: number; r: number }[];
  center: boolean;
  wall: boolean;
  partner: string;
  fx: number;
  fy: number;
};

export type LiveCatSeat = {
  id: string;
  itemId: string;
  placeKey: string;
  weight: number;
  pose: CatSeatDefPose;
  approach: CatTile;
  footX: number;
  footY: number;
  facing: CatWalkDir | null;
};

type SeatFile = { seats?: unknown };

function num(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function parseCatSeats(data: unknown): CatSeatDef[] {
  const seatsRaw = data && typeof data === "object" ? (data as SeatFile).seats : undefined;
  const rows = Array.isArray(seatsRaw) ? seatsRaw : [];
  const defs: CatSeatDef[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const itemId = typeof row.itemId === "string" ? row.itemId : "";
    if (!itemId) continue;
    const pose: CatSeatDefPose = row.pose === "sleep" || row.pose === "sit_look" ? row.pose : "sit";
    const slots = Array.isArray(row.slots)
      ? row.slots.flatMap((slot) => {
          if (!slot || typeof slot !== "object") return [];
          const cell = slot as { c?: unknown; r?: unknown };
          return [{ c: num(cell.c, 0), r: num(cell.r, 0) }];
        })
      : [];
    defs.push({
      itemId,
      weight: Math.max(0, num(row.weight, 1)),
      pose,
      lift: Math.max(0, num(row.lift, 0)),
      slots,
      center: row.center === true,
      wall: row.wall === true,
      partner: typeof row.partner === "string" ? row.partner : "",
      fx: num(row.fx, 0.5),
      fy: num(row.fy, 0.65),
    });
  }
  return defs;
}

let seatsPromise: Promise<CatSeatDef[]> | null = null;

export function loadCatSeats(): Promise<CatSeatDef[]> {
  if (!seatsPromise) {
    seatsPromise = fetch(roomAsset("cat-seats.json"))
      .then((res) => (res.ok ? res.json() : { seats: [] }))
      .then((data) => parseCatSeats(data))
      .catch(() => [] as CatSeatDef[]);
  }
  return seatsPromise;
}

export function rollSeatPose(pose: CatSeatDefPose, rng: () => number): CatSeatPose {
  if (pose !== "sleep") return pose;
  return rng() < 0.65 ? "sleep" : "loaf";
}

/** Sit and look: 6–12s. Sleep and loaf: 10–16s, sometimes longer. */
export function seatHoldMs(pose: CatSeatPose, rng: () => number): number {
  if (pose === "sleep" || pose === "loaf") {
    if (rng() < 0.22) return 16000 + rng() * 10000;
    return 10000 + rng() * 6000;
  }
  return 6000 + rng() * 6000;
}

export function easeHop(u: number) {
  const x = Math.min(1, Math.max(0, u));
  return x * x * (3 - 2 * x);
}

export function pickCatSeat(seats: LiveCatSeat[], rng: () => number): LiveCatSeat | null {
  if (!seats.length) return null;
  let total = 0;
  for (const seat of seats) total += Math.max(0, seat.weight);
  if (total <= 0) return seats[0] ?? null;
  let roll = rng() * total;
  for (const seat of seats) {
    roll -= Math.max(0, seat.weight);
    if (roll <= 0) return seat;
  }
  return seats[seats.length - 1] ?? null;
}

function inRoom(col: number, row: number) {
  return col >= 0 && row >= 0 && col < GRID && row < GRID;
}

function floorKey(place: FloorPlacement) {
  return `${place.instanceId}@${place.col},${place.row},${place.orientation}`;
}

function wallKey(place: WallPlacement) {
  const px = place.worldPx ? place.worldPx.join(",") : "";
  return `${place.instanceId}@${place.wall},${place.t},${place.slot},${place.band},${px}`;
}

/** Front-most walkable neighbour. A decal tile can be the seat itself. */
function approachBeside(
  origins: CatTile[],
  footprint: Set<string>,
  walkable: Set<string>,
  blocked: Set<string>,
  reserved: Set<string>,
): CatTile | null {
  for (const origin of origins) {
    const key = tileKey(origin);
    if (walkable.has(key) && !blocked.has(key) && !reserved.has(key)) return origin;
  }
  const options: CatTile[] = [];
  for (const origin of origins) {
    for (const [dc, dr] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ] as const) {
      const tile = { col: origin.col + dc, row: origin.row + dr };
      if (!inRoom(tile.col, tile.row)) continue;
      const key = tileKey(tile);
      if (footprint.has(key) || !walkable.has(key) || blocked.has(key) || reserved.has(key)) continue;
      if (!options.some((item) => item.col === tile.col && item.row === tile.row)) options.push(tile);
    }
  }
  options.sort((a, b) => b.col + b.row - (a.col + a.row) || b.col - a.col);
  return options[0] ?? null;
}

function nearestTile(x: number, y: number, tiles: CatTile[]): CatTile | null {
  let best: CatTile | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const tile of tiles) {
    const centre = tileCentreWorld(tile.col, tile.row);
    const dist = (centre.x - x) ** 2 + (centre.y - y) ** 2;
    if (dist < bestD) {
      bestD = dist;
      best = tile;
    }
  }
  return best;
}

function reachable(from: CatTile | null | undefined, approach: CatTile, walkable: CatTile[]) {
  if (!from) return true;
  if (from.col === approach.col && from.row === approach.row) return true;
  return findPath(from, approach, walkable).length >= 2;
}

export function listCatSeats(args: {
  defs: CatSeatDef[];
  floor: FloorPlacement[];
  walls: WallPlacement[];
  items: Map<string, RoomItem>;
  walkable: CatTile[];
  blocked: Set<string>;
  takenSeatIds?: Set<string>;
  from?: CatTile | null;
}): LiveCatSeat[] {
  const walkableKeys = new Set(args.walkable.map(tileKey));
  const taken = args.takenSeatIds ?? new Set<string>();
  const reserved = new Set<string>();
  const seats: LiveCatSeat[] = [];

  const push = (seat: LiveCatSeat) => {
    if (taken.has(seat.id) || reserved.has(tileKey(seat.approach))) return;
    if (!reachable(args.from, seat.approach, args.walkable)) return;
    reserved.add(tileKey(seat.approach));
    seats.push(seat);
  };

  for (const place of args.floor) {
    const def = args.defs.find((item) => item.itemId === place.id && !item.wall && item.weight > 0);
    if (!def) continue;
    const item = args.items.get(place.id);
    if (!item) continue;
    const [w, d] = itemSize(item, place.orientation);
    const tiles = footprintTiles(place.col, place.row, w, d);
    const footprint = new Set(tiles.map(tileKey));
    const centre = footprintCentreWorld(place.col, place.row, w, d);
    if (def.center || def.slots.length === 0) {
      const approach = approachBeside(tiles, footprint, walkableKeys, args.blocked, reserved);
      if (!approach) continue;
      push({
        id: `${place.instanceId}:0`,
        itemId: place.id,
        placeKey: floorKey(place),
        weight: def.weight,
        pose: def.pose,
        approach,
        footX: centre.x,
        footY: centre.y - def.lift,
        facing: null,
      });
      continue;
    }
    def.slots.forEach((slot, index) => {
      let c = slot.c;
      let r = slot.r;
      if (place.orientation === "mirrored") {
        c = slot.r;
        r = slot.c;
      }
      c = Math.max(0, Math.min(w - 1, c));
      r = Math.max(0, Math.min(d - 1, r));
      const origin = { col: place.col + c, row: place.row + r };
      const approach = approachBeside([origin], footprint, walkableKeys, args.blocked, reserved);
      if (!approach) return;
      const foot = tileCentreWorld(origin.col, origin.row);
      push({
        id: `${place.instanceId}:${index}`,
        itemId: place.id,
        placeKey: floorKey(place),
        weight: def.weight,
        pose: def.pose,
        approach,
        footX: foot.x,
        footY: foot.y - def.lift,
        facing: null,
      });
    });
  }

  for (const place of args.walls) {
    const def = args.defs.find((item) => item.itemId === place.id && item.wall && item.weight > 0);
    if (!def) continue;
    const item = args.items.get(place.id);
    if (!item) continue;
    if (def.partner && !args.walls.some((other) => other.id === def.partner && other.wall === place.wall)) continue;
    const rect = wallSpriteRect(item, place);
    const footX = rect.x + rect.w * def.fx;
    const footY = rect.y + rect.h * def.fy;
    const open = args.walkable.filter((tile) => !args.blocked.has(tileKey(tile)) && !reserved.has(tileKey(tile)));
    const along = open.filter((tile) => (place.wall === "L" ? tile.col <= 1 : tile.row <= 1));
    const approach = nearestTile(footX, footY, along.length ? along : open);
    if (!approach) continue;
    push({
      id: `${place.instanceId}:0`,
      itemId: place.id,
      placeKey: wallKey(place),
      weight: def.weight,
      pose: def.pose,
      approach,
      footX,
      footY,
      facing: place.wall === "R" ? "walk_dr" : "walk_dl",
    });
  }

  return seats;
}
