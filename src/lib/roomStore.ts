import { Storage } from "@apps-in-toss/web-framework";

import { isInTossApp } from "./native";
import type { OpsStarter, OpsState } from "./opsTypes";
import type { GridLayoutEntry, RoomDefinition, RoomGridFile, RoomsFile } from "./roomCatalog";
import { defaultRoomId } from "./roomCatalog";
import { DEFAULT_CAT_BREED_ID } from "./roomCat";
import { wallCoordsFromT } from "./roomLayout";
import {
  defaultFloorTiles,
  getTileRules,
  normalizeFloorTiles,
  normalizeWallTiles,
  wallTilesFromSides,
} from "./roomTiles";
import type {
  FloorPlacement,
  RoomItem,
  RoomLayoutState,
  RoomOrientation,
  RoomRecord,
  RoomSaveState,
  WallPlacement,
} from "./roomTypes";

const ROOM_KEY = "lucky-cat.my-room.v6.rooms";
const LEGACY_KEYS = ["lucky-cat.my-room.v5.tiles", "lucky-cat.my-room.v5"];
export const MOCK_POINTS = 1240;
export const MOCK_COZY = 3;

function orientationOf(value: unknown): RoomOrientation {
  return value === "mirrored" ? "mirrored" : "default";
}

function asRecord(layout: RoomLayoutState, roamingCatId: string | null = null): RoomRecord {
  return { ...layout, roamingCatId };
}

export function layoutFromEntries(
  entries: GridLayoutEntry[] | undefined,
  roomId: string,
  floorId: string,
  wallLeft: string,
  wallRight: string,
  floorTilesRaw?: unknown,
  wallTilesRaw?: unknown,
): RoomLayoutState {
  const floor: FloorPlacement[] = [];
  const walls: WallPlacement[] = [];
  const seen: Record<string, number> = {};
  for (const entry of entries ?? []) {
    seen[entry.id] = (seen[entry.id] ?? 0) + 1;
    const n = seen[entry.id];
    const instanceId = n === 1 ? `p-${roomId}-${entry.id}` : `p-${roomId}-${entry.id}-${n}`;
    if (entry.wall) {
      const t = entry.t ?? 2;
      const heightUnits = entry.heightUnits ?? 90;
      const coords = wallCoordsFromT({ wallSpanTiles: 1 } as RoomItem, t, heightUnits);
      walls.push({
        instanceId,
        id: entry.id,
        wall: entry.wall,
        t,
        heightUnits,
        slot: coords.slot,
        band: coords.band,
        worldPx: entry.worldPxBase ?? entry.worldPx,
      });
      continue;
    }
    if (entry.onTop) {
      floor.push({
        instanceId,
        id: entry.id,
        col: 0,
        row: 0,
        orientation: "default",
        onTopOf: entry.onTop,
        fx: entry.fx,
        fy: entry.fy,
      });
      continue;
    }
    floor.push({
      instanceId,
      id: entry.id,
      col: entry.c ?? 0,
      row: entry.r ?? 0,
      orientation: orientationOf(entry.orientation),
    });
  }
  return {
    floor,
    walls,
    wallpaper: wallLeft,
    floorSkin: floorId,
    floorTiles: normalizeFloorTiles(floorTilesRaw, floorId),
    wallTiles: normalizeWallTiles(wallTilesRaw, wallLeft, wallRight),
  };
}

export function layoutFromGrid(grid: RoomGridFile | undefined, roomId = "moon_bedroom"): RoomLayoutState {
  const rules = getTileRules();
  return layoutFromEntries(
    grid?.defaultLayout,
    roomId,
    rules.defaultFloor,
    rules.defaultWall,
    rules.defaultWall,
  );
}

export function layoutFromRoom(def: RoomDefinition, grid?: RoomGridFile): RoomLayoutState {
  if (def.defaultLayout?.length) {
    return layoutFromEntries(
      def.defaultLayout,
      def.id,
      def.defaultFloor,
      def.defaultWall.L,
      def.defaultWall.R,
      def.floorTiles,
      def.wallTiles,
    );
  }
  const base = layoutFromGrid(grid, def.id);
  return {
    ...base,
    wallpaper: def.defaultWall.L,
    floorSkin: def.defaultFloor,
    floorTiles: def.floorTiles ? normalizeFloorTiles(def.floorTiles, def.defaultFloor) : defaultFloorTiles(def.defaultFloor),
    wallTiles: def.wallTiles
      ? normalizeWallTiles(def.wallTiles, def.defaultWall.L, def.defaultWall.R)
      : wallTilesFromSides(def.defaultWall.L, def.defaultWall.R),
  };
}

export function defaultLayout(grid?: RoomGridFile): RoomLayoutState {
  return layoutFromGrid(grid);
}

export function defaultRecord(def: RoomDefinition, grid?: RoomGridFile): RoomRecord {
  return asRecord(layoutFromRoom(def, grid), def.roamingCatId ?? DEFAULT_CAT_BREED_ID);
}

function countDefaultPlacements(def: RoomDefinition, grid?: RoomGridFile) {
  const entries =
    def.defaultLayout ?? (def.isDefault || def.id === "moon_bedroom" ? grid?.defaultLayout : undefined) ?? [];
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    counts[entry.id] = (counts[entry.id] ?? 0) + 1;
  }
  const grantTile = (id: string | undefined) => {
    if (!id) return;
    counts[id] = Math.max(counts[id] ?? 0, 1);
  };
  if (def.floorTiles) {
    for (const row of def.floorTiles) for (const id of row) grantTile(id);
  } else {
    grantTile(def.defaultFloor);
  }
  if (def.wallTiles) {
    for (const id of def.wallTiles.L) grantTile(id);
    for (const id of def.wallTiles.R) grantTile(id);
  } else {
    grantTile(def.defaultWall.L);
    grantTile(def.defaultWall.R);
  }
  return counts;
}

export function mockOwned(items: RoomItem[], roomsFile?: RoomsFile, grid?: RoomGridFile): Record<string, number> {
  const owned: Record<string, number> = {};
  for (const item of items) {
    if (item.ownedDefault) owned[item.id] = Math.max(owned[item.id] ?? 0, 1);
  }
  for (const def of roomsFile?.rooms ?? []) {
    const counts = countDefaultPlacements(def, grid);
    for (const [id, count] of Object.entries(counts)) {
      owned[id] = Math.max(owned[id] ?? 0, count);
    }
  }
  return owned;
}

export function mockUnlocked(roomsFile: RoomsFile) {
  return roomsFile.rooms.map((room) => room.id);
}

export function mockState(items: RoomItem[], roomsFile: RoomsFile, grid?: RoomGridFile): RoomSaveState {
  const rooms: Record<string, RoomRecord> = {};
  for (const def of roomsFile.rooms) {
    rooms[def.id] = defaultRecord(def, grid);
  }
  const requested = new URLSearchParams(window.location.search).get("room");
  const startId =
    requested && rooms[requested] ? requested : defaultRoomId(roomsFile);
  return {
    points: MOCK_POINTS,
    owned: mockOwned(items, roomsFile, grid),
    cozyLevel: MOCK_COZY,
    shadowsEnabled: true,
    currentRoomId: startId,
    unlocked: mockUnlocked(roomsFile),
    rooms,
  };
}

function starterEntries(firstRoom: OpsStarter["firstRoom"]): GridLayoutEntry[] {
  const out: GridLayoutEntry[] = [];
  for (const raw of firstRoom.placed) {
    if (typeof raw.id !== "string") continue;
    const entry: GridLayoutEntry = { id: raw.id };
    if (typeof raw.c === "number") entry.c = raw.c;
    if (typeof raw.r === "number") entry.r = raw.r;
    if (raw.orientation === "mirrored" || raw.orientation === "default") {
      entry.orientation = raw.orientation;
    }
    if (raw.wall === "L" || raw.wall === "R") entry.wall = raw.wall;
    if (typeof raw.t === "number") entry.t = raw.t;
    if (typeof raw.heightUnits === "number") entry.heightUnits = raw.heightUnits;
    out.push(entry);
  }
  return out;
}

function skinTextureId(id: string) {
  // starter.json uses catalog ids (floor_wood_honey); room tiles use texture ids (wood_honey).
  return id.replace(/^(floor_|wall_)/, "");
}

/** Build moon_bedroom (etc.) from starter.json so drawer gifts stay NEW/unplaced. */
export function layoutFromStarter(firstRoom: OpsStarter["firstRoom"], roomId = firstRoom.roomId): RoomLayoutState {
  return layoutFromEntries(
    starterEntries(firstRoom),
    roomId,
    skinTextureId(firstRoom.floor),
    skinTextureId(firstRoom.wall.L),
    skinTextureId(firstRoom.wall.R),
  );
}

/** Fresh-install room save: starter unlocks / owned from ops, starter first-room layout. */
export function newUserRoomState(
  _items: RoomItem[],
  roomsFile: RoomsFile,
  ops: OpsState,
  grid?: RoomGridFile,
  starter?: OpsStarter,
): RoomSaveState {
  const rooms: Record<string, RoomRecord> = {};
  for (const def of roomsFile.rooms) {
    if (starter && def.id === starter.firstRoom.roomId) {
      rooms[def.id] = asRecord(
        layoutFromStarter(starter.firstRoom, def.id),
        def.roamingCatId ?? DEFAULT_CAT_BREED_ID,
      );
    } else {
      rooms[def.id] = defaultRecord(def, grid);
    }
  }
  const unlocked = ops.unlockedRoomIds.length
    ? [...ops.unlockedRoomIds]
    : [defaultRoomId(roomsFile)];
  const currentRoomId = unlocked.find((id) => rooms[id]) ?? defaultRoomId(roomsFile);
  const owned: Record<string, number> = {};
  for (const id of ops.ownedItemIds) owned[id] = Math.max(1, owned[id] ?? 0);
  for (const roomId of unlocked) {
    const room = rooms[roomId];
    if (!room) continue;
    for (const place of room.floor) owned[place.id] = Math.max(owned[place.id] ?? 0, 1);
    for (const place of room.walls) owned[place.id] = Math.max(owned[place.id] ?? 0, 1);
    owned[room.floorSkin] = Math.max(owned[room.floorSkin] ?? 0, 1);
    owned[room.wallpaper] = Math.max(owned[room.wallpaper] ?? 0, 1);
  }
  return {
    points: ops.pawBalance,
    owned,
    cozyLevel: 1,
    shadowsEnabled: true,
    currentRoomId,
    unlocked,
    rooms,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseFloor(raw: unknown): FloorPlacement[] {
  if (!Array.isArray(raw)) return [];
  const out: FloorPlacement[] = [];
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.instanceId !== "string") continue;
    out.push({
      instanceId: entry.instanceId,
      id: entry.id,
      col: typeof entry.col === "number" ? entry.col : 0,
      row: typeof entry.row === "number" ? entry.row : 0,
      orientation: orientationOf(entry.orientation ?? (entry.rot === 1 || entry.flip ? "mirrored" : "default")),
      onTopOf: typeof entry.onTopOf === "string" ? entry.onTopOf : undefined,
      fx: typeof entry.fx === "number" ? entry.fx : undefined,
      fy: typeof entry.fy === "number" ? entry.fy : undefined,
    });
  }
  return out;
}

function parseWalls(raw: unknown): WallPlacement[] {
  if (!Array.isArray(raw)) return [];
  const out: WallPlacement[] = [];
  for (const entry of raw) {
    if (!isRecord(entry) || typeof entry.id !== "string" || typeof entry.instanceId !== "string") continue;
    const t = typeof entry.t === "number" ? entry.t : 2;
    const heightUnits = typeof entry.heightUnits === "number" ? entry.heightUnits : 90;
    const inferred = wallCoordsFromT({ wallSpanTiles: 1, footprint: null } as RoomItem, t, heightUnits);
    out.push({
      instanceId: entry.instanceId,
      id: entry.id,
      wall: entry.wall === "R" ? "R" : "L",
      t,
      heightUnits,
      slot: typeof entry.slot === "number" ? entry.slot : inferred.slot,
      band: typeof entry.band === "number" ? entry.band : inferred.band,
      worldPx: Array.isArray(entry.worldPx) ? (entry.worldPx as [number, number]) : undefined,
    });
  }
  return out;
}

function parseLayout(raw: unknown, floorId: string, wallLeft: string, wallRight: string): RoomLayoutState | null {
  if (!isRecord(raw) || !Array.isArray(raw.floor) || !Array.isArray(raw.walls)) return null;
  return {
    floor: parseFloor(raw.floor),
    walls: parseWalls(raw.walls),
    wallpaper: typeof raw.wallpaper === "string" ? raw.wallpaper : wallLeft,
    floorSkin: typeof raw.floorSkin === "string" ? raw.floorSkin : floorId,
    floorTiles: normalizeFloorTiles(raw.floorTiles, floorId),
    wallTiles: normalizeWallTiles(raw.wallTiles, wallLeft, wallRight),
  };
}

function parseRoomRecord(raw: unknown, def: RoomDefinition, grid?: RoomGridFile): RoomRecord {
  const fallback = defaultRecord(def, grid);
  if (!isRecord(raw)) return fallback;
  const layout = parseLayout(raw, def.defaultFloor, def.defaultWall.L, def.defaultWall.R);
  if (!layout) return fallback;
  return {
    ...layout,
    roamingCatId:
      typeof raw.roamingCatId === "string"
        ? raw.roamingCatId
        : (def.roamingCatId ?? DEFAULT_CAT_BREED_ID),
  };
}

function parseState(raw: string | null, roomsFile: RoomsFile, grid?: RoomGridFile): RoomSaveState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || typeof parsed.points !== "number" || !isRecord(parsed.owned)) return null;
    const rooms: Record<string, RoomRecord> = {};
    const storedRooms = isRecord(parsed.rooms) ? parsed.rooms : null;
    const legacyLayout = !storedRooms && isRecord(parsed.layout) ? parsed.layout : null;
    for (const def of roomsFile.rooms) {
      if (storedRooms && isRecord(storedRooms[def.id])) {
        rooms[def.id] = parseRoomRecord(storedRooms[def.id], def, grid);
      } else if (legacyLayout && (def.isDefault || def.id === "moon_bedroom")) {
        const migrated = parseLayout(legacyLayout, def.defaultFloor, def.defaultWall.L, def.defaultWall.R);
        rooms[def.id] = migrated ? asRecord(migrated, null) : defaultRecord(def, grid);
      } else {
        rooms[def.id] = defaultRecord(def, grid);
      }
    }
    const unlockedRaw = Array.isArray(parsed.unlocked)
      ? parsed.unlocked.filter((id): id is string => typeof id === "string" && Boolean(rooms[id]))
      : [];
    const current =
      typeof parsed.currentRoomId === "string" && rooms[parsed.currentRoomId]
        ? parsed.currentRoomId
        : defaultRoomId(roomsFile);
    const hasPlacements = Object.values(rooms).some((room) => room.floor.length + room.walls.length > 0);
    if (!hasPlacements) return null;
    return {
      points: parsed.points,
      owned: parsed.owned as Record<string, number>,
      cozyLevel: typeof parsed.cozyLevel === "number" ? parsed.cozyLevel : MOCK_COZY,
      shadowsEnabled: parsed.shadowsEnabled !== false,
      currentRoomId: current,
      unlocked: unlockedRaw.length ? unlockedRaw : mockUnlocked(roomsFile),
      rooms,
    };
  } catch {
    return null;
  }
}

async function readKey(key: string): Promise<string | null> {
  if (isInTossApp()) {
    try {
      return await Storage.getItem(key);
    } catch {
      // fall through
    }
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

async function writeKey(key: string, value: string): Promise<void> {
  if (isInTossApp()) {
    try {
      await Storage.setItem(key, value);
      return;
    } catch {
      // fall through
    }
  }
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export async function loadRoomState(
  items: RoomItem[],
  roomsFile: RoomsFile,
  grid?: RoomGridFile,
): Promise<RoomSaveState> {
  let stored: RoomSaveState | null = parseState(await readKey(ROOM_KEY), roomsFile, grid);
  if (!stored) {
    for (const key of LEGACY_KEYS) {
      stored = parseState(await readKey(key), roomsFile, grid);
      if (stored) break;
    }
  }
  if (stored) {
    return {
      ...stored,
      owned: { ...mockOwned(items, roomsFile, grid), ...stored.owned },
      unlocked: stored.unlocked.length ? stored.unlocked : mockUnlocked(roomsFile),
    };
  }
  const mock = mockState(items, roomsFile, grid);
  await writeKey(ROOM_KEY, JSON.stringify(mock));
  return mock;
}

export async function saveRoomState(state: RoomSaveState): Promise<void> {
  await writeKey(ROOM_KEY, JSON.stringify(state));
}

export function newInstanceId(id: string) {
  return `p-${id}-${Math.random().toString(36).slice(2, 8)}`;
}

export function currentRoom(state: RoomSaveState): RoomRecord {
  return state.rooms[state.currentRoomId] ?? Object.values(state.rooms)[0];
}

export function patchCurrentRoom(state: RoomSaveState, layout: RoomLayoutState): RoomSaveState {
  const prev = currentRoom(state);
  return {
    ...state,
    rooms: {
      ...state.rooms,
      [state.currentRoomId]: {
        ...prev,
        ...layout,
        roamingCatId: prev?.roamingCatId ?? DEFAULT_CAT_BREED_ID,
      },
    },
  };
}

export function placedCountAll(state: RoomSaveState, itemId: string) {
  let count = 0;
  for (const room of Object.values(state.rooms)) {
    count += room.floor.filter((place) => place.id === itemId).length;
    count += room.walls.filter((place) => place.id === itemId).length;
  }
  return count;
}

export function placedInOtherRoom(state: RoomSaveState, itemId: string, roomId = state.currentRoomId) {
  for (const [id, room] of Object.entries(state.rooms)) {
    if (id === roomId) continue;
    if (room.floor.some((place) => place.id === itemId) || room.walls.some((place) => place.id === itemId)) {
      return id;
    }
  }
  return null;
}

export const EXCHANGE_RATES = {
  common: 10,
  rare: 30,
  special: 60,
  legend: 150,
} as const;

export type { GridLayoutEntry };
