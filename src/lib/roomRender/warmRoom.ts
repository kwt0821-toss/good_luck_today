import { Environment } from "@apps-in-toss/web-framework";

import { loadRoomCatalog, roomAsset } from "../roomCatalog";
import { ROOM_KEY } from "../roomStore";
import { defaultFloorTiles, floorTileSrc } from "../roomTiles";
import { loadRoomImage } from "./imageCache";
import { LAYER_CROPS } from "./layerCrops";
import { prebakeFloor, type FloorCanvasTile } from "./paintFloor";
import { canvas2dSupported, roomRenderFlags, type RoomRenderConfig } from "./renderer";
import { warmRelatives } from "./warmList";

const held: HTMLImageElement[] = [];
let started = false;

/** Keeps the decoded images alive for the rest of the page. */
export function heldWarmImages(): readonly HTMLImageElement[] {
  return held;
}

function tossScheme(): string {
  try {
    const read = (Environment as { getTossScheme?: () => string | null }).getTossScheme;
    return typeof read === "function" ? read.call(Environment) ?? "" : "";
  } catch {
    return "";
  }
}

function readSavedRoom(): { floor: string[][] | null; cats: string[] } {
  if (typeof localStorage === "undefined") return { floor: null, cats: [] };
  try {
    const raw = localStorage.getItem(ROOM_KEY);
    if (!raw) return { floor: null, cats: [] };
    const parsed = JSON.parse(raw) as {
      currentRoomId?: string;
      rooms?: Record<string, { floorTiles?: unknown; roamingCatIds?: unknown }>;
    };
    const room = parsed.currentRoomId ? parsed.rooms?.[parsed.currentRoomId] : undefined;
    return { floor: asFloor(room?.floorTiles), cats: asCats(room?.roamingCatIds) };
  } catch {
    return { floor: null, cats: [] };
  }
}

function asFloor(value: unknown): string[][] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const rows: string[][] = [];
  for (const row of value) {
    if (!Array.isArray(row)) return null;
    const cells: string[] = [];
    for (const cell of row) {
      if (typeof cell !== "string") return null;
      cells.push(cell);
    }
    rows.push(cells);
  }
  return rows;
}

function asCats(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string" && id.length > 0);
}

export async function warmCurrentRoom(bakeFloor: boolean): Promise<void> {
  await loadRoomCatalog().catch(() => undefined);
  const saved = readSavedRoom();
  const floor = saved.floor ?? defaultFloorTiles();
  const relatives = warmRelatives(
    floor,
    saved.cats,
    Object.values(LAYER_CROPS).map((crop) => `world/${crop.file}`),
  );
  await Promise.all(
    relatives.map(async (relative) => {
      const image = await loadRoomImage(roomAsset(relative));
      if (image) held.push(image);
    }),
  );
  if (!bakeFloor) return;
  const tiles: FloorCanvasTile[] = [];
  for (let row = 0; row < floor.length; row += 1) {
    const line = floor[row] ?? [];
    for (let col = 0; col < line.length; col += 1) {
      const id = line[col];
      if (!id) continue;
      tiles.push({ col, row, src: roomAsset(floorTileSrc(id, col, row)) });
    }
  }
  await prebakeFloor(tiles);
}

/** Decode the current room once, after the home screen has been idle for 1.5s. */
export function scheduleLiteWarm(config: RoomRenderConfig | null | undefined): () => void {
  if (started || typeof window === "undefined") return () => undefined;
  const flags = roomRenderFlags({
    config,
    search: window.location.search,
    schemeUrl: tossScheme(),
    canvasSupported: canvas2dSupported(),
  });
  if (!flags.lite) return () => undefined;
  let dead = false;
  let timer = 0;
  let idle = 0;
  const run = () => {
    if (dead || started) return;
    started = true;
    void warmCurrentRoom(flags.tiles).catch(() => undefined);
  };
  timer = window.setTimeout(() => {
    if (dead) return;
    if (typeof window.requestIdleCallback === "function") {
      idle = window.requestIdleCallback(run, { timeout: 1500 });
    } else {
      run();
    }
  }, 1500);
  return () => {
    dead = true;
    window.clearTimeout(timer);
    if (idle && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
  };
}
