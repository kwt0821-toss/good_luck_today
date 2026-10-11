import { Storage } from "@apps-in-toss/web-framework";

import { isInTossApp } from "./native";
import type { FloorPlacement, RoomItem, RoomLayoutState, RoomSaveState, WallPlacement } from "./roomTypes";

const ROOM_KEY = "lucky-cat.my-room";
export const MOCK_POINTS = 1240;
export const MOCK_COZY = 3;

export const DEFAULT_FLOOR: FloorPlacement[] = [
  { instanceId: "p-cabinet", id: "cabinet", col: 3, row: 0, rot: 0, flip: false },
  { instanceId: "p-cattower", id: "cattower", col: 0, row: 4, rot: 0, flip: false },
  { instanceId: "p-floorlamp", id: "floorlamp", col: 6, row: 0, rot: 0, flip: false },
  { instanceId: "p-plant", id: "plant", col: 0, row: 7, rot: 0, flip: false },
  { instanceId: "p-catbed", id: "catbed", col: 3, row: 3, rot: 0, flip: false },
  { instanceId: "p-yarn", id: "yarn", col: 5, row: 5, rot: 0, flip: false },
  { instanceId: "p-rug", id: "rug", col: 3, row: 3, rot: 0, flip: false },
];

export const DEFAULT_WALLS: WallPlacement[] = [
  { instanceId: "p-window", id: "window", wall: "L", slot: 0, span: 3, worldPx: [1699, 549] },
  { instanceId: "p-frames", id: "frames", wall: "R", slot: 1, span: 3, worldPx: [1968, 594] },
];

export function defaultLayout(): RoomLayoutState {
  return {
    floor: DEFAULT_FLOOR.map((item) => ({ ...item })),
    walls: DEFAULT_WALLS.map((item) => ({ ...item })),
    wallpaper: "wallpaper-plum-sparkle",
    floorSkin: "floor-honey-check",
  };
}

export function mockOwned(items: RoomItem[]): Record<string, number> {
  const owned: Record<string, number> = {};
  for (const item of items) {
    if (item.ownedDefault) owned[item.id] = 1;
  }
  return owned;
}

export function mockState(items: RoomItem[]): RoomSaveState {
  return {
    points: MOCK_POINTS,
    owned: mockOwned(items),
    layout: defaultLayout(),
    cozyLevel: MOCK_COZY,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
      layout: {
        floor: layout.floor as FloorPlacement[],
        walls: layout.walls as WallPlacement[],
        wallpaper: typeof layout.wallpaper === "string" ? layout.wallpaper : "wallpaper-plum-sparkle",
        floorSkin: typeof layout.floorSkin === "string" ? layout.floorSkin : "floor-honey-check",
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

export async function loadRoomState(items: RoomItem[]): Promise<RoomSaveState> {
  const stored = parseState(await readKey(ROOM_KEY));
  if (stored) {
    return {
      ...stored,
      owned: { ...mockOwned(items), ...stored.owned },
    };
  }
  const mock = mockState(items);
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
