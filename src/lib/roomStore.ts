import { Storage } from "@apps-in-toss/web-framework";

import { isInTossApp } from "./native";
import type { GridLayoutEntry, RoomGridFile } from "./roomCatalog";
import type { FloorPlacement, RoomItem, RoomLayoutState, RoomOrientation, RoomSaveState, WallPlacement } from "./roomTypes";

const ROOM_KEY = "lucky-cat.my-room.v5";
export const MOCK_POINTS = 1240;
export const MOCK_COZY = 3;

function orientationOf(value: unknown): RoomOrientation {
  return value === "mirrored" ? "mirrored" : "default";
}

export function layoutFromGrid(grid: RoomGridFile | undefined): RoomLayoutState {
  const floor: FloorPlacement[] = [];
  const walls: WallPlacement[] = [];
  for (const entry of grid?.defaultLayout ?? []) {
    if (entry.wall) {
      walls.push({
        instanceId: `p-${entry.id}`,
        id: entry.id,
        wall: entry.wall,
        t: entry.t ?? 2,
        heightUnits: entry.heightUnits ?? 90,
        worldPx: entry.worldPx,
      });
      continue;
    }
    if (entry.onTop) {
      floor.push({
        instanceId: `p-${entry.id}`,
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
      instanceId: `p-${entry.id}`,
      id: entry.id,
      col: entry.c ?? 0,
      row: entry.r ?? 0,
      orientation: orientationOf(entry.orientation),
    });
  }
  return {
    floor,
    walls,
    wallpaper: "",
    floorSkin: "",
  };
}

export function defaultLayout(grid?: RoomGridFile): RoomLayoutState {
  return layoutFromGrid(grid);
}

export function mockOwned(items: RoomItem[]): Record<string, number> {
  const owned: Record<string, number> = {};
  for (const item of items) {
    if (item.ownedDefault) owned[item.id] = 1;
  }
  return owned;
}

export function mockState(items: RoomItem[], grid?: RoomGridFile): RoomSaveState {
  return {
    points: MOCK_POINTS,
    owned: mockOwned(items),
    layout: defaultLayout(grid),
    cozyLevel: MOCK_COZY,
    shadowsEnabled: true,
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
    out.push({
      instanceId: entry.instanceId,
      id: entry.id,
      wall: entry.wall === "R" ? "R" : "L",
      t: typeof entry.t === "number" ? entry.t : 2,
      heightUnits: typeof entry.heightUnits === "number" ? entry.heightUnits : 90,
      worldPx: Array.isArray(entry.worldPx) ? (entry.worldPx as [number, number]) : undefined,
    });
  }
  return out;
}

function parseState(raw: string | null): RoomSaveState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || typeof parsed.points !== "number" || !isRecord(parsed.owned) || !isRecord(parsed.layout)) {
      return null;
    }
    const layout = parsed.layout;
    if (!Array.isArray(layout.floor) || !Array.isArray(layout.walls)) return null;
    return {
      points: parsed.points,
      owned: parsed.owned as Record<string, number>,
      cozyLevel: typeof parsed.cozyLevel === "number" ? parsed.cozyLevel : MOCK_COZY,
      shadowsEnabled: parsed.shadowsEnabled !== false,
      layout: {
        floor: parseFloor(layout.floor),
        walls: parseWalls(layout.walls),
        wallpaper: typeof layout.wallpaper === "string" ? layout.wallpaper : "",
        floorSkin: typeof layout.floorSkin === "string" ? layout.floorSkin : "",
      },
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

export async function loadRoomState(items: RoomItem[], grid?: RoomGridFile): Promise<RoomSaveState> {
  const stored = parseState(await readKey(ROOM_KEY));
  if (stored && stored.layout.floor.length + stored.layout.walls.length > 0) {
    return {
      ...stored,
      owned: { ...mockOwned(items), ...stored.owned },
    };
  }
  const mock = mockState(items, grid);
  await writeKey(ROOM_KEY, JSON.stringify(mock));
  return mock;
}

export async function saveRoomState(state: RoomSaveState): Promise<void> {
  await writeKey(ROOM_KEY, JSON.stringify(state));
}

export function newInstanceId(id: string) {
  return `p-${id}-${Math.random().toString(36).slice(2, 8)}`;
}

export const EXCHANGE_RATES = {
  common: 10,
  rare: 30,
  special: 60,
  legend: 150,
} as const;

export type { GridLayoutEntry };
