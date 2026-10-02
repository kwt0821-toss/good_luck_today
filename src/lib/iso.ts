import type { RoomPlacement, ShopItem } from "../types";
import { getItemById } from "./items";

export const ROOM_SIZE = 5;
export const TILE_W = 64;
export const TILE_H = 32;
export const WALL_H = 112;
export const ISO_VIEW_W = 336;
export const ISO_VIEW_H = 308;
export const ISO_ORIGIN_X = 168;
export const ISO_ORIGIN_Y = 132;
export const CAT_TILE = { col: 2, row: 2 } as const;

export type Tile = { col: number; row: number };

export type WallTheme = {
  light: string;
  mid: string;
  dark: string;
  line: string;
  window: string;
};

export type FloorTheme = {
  a: string;
  b: string;
  line: string;
};

export const WALL_THEMES: Record<string, WallTheme> = {
  wall_mint: {
    light: "#e7f8f3",
    mid: "#cfeee6",
    dark: "#b4dfd5",
    line: "#8ecfc2",
    window: "#c9ebf6",
  },
  wall_sky: {
    light: "#e3f5fb",
    mid: "#c9ebf6",
    dark: "#b0ddee",
    line: "#8ec9dc",
    window: "#fff4c8",
  },
  wall_lemon: {
    light: "#fff8d8",
    mid: "#fff0b8",
    dark: "#ffe59a",
    line: "#e8c86a",
    window: "#c9ebf6",
  },
};

export const FLOOR_THEMES: Record<string, FloorTheme> = {
  floor_wood: { a: "#f6e6c8", b: "#edd7b0", line: "#e0c394" },
  floor_tile: { a: "#d8f3ee", b: "#c3e8dc", line: "#9fd4c6" },
  floor_cloud: { a: "#eef9fd", b: "#dceff8", line: "#b7dcec" },
};

export function isoProject(col: number, row: number): { x: number; y: number } {
  return {
    x: (col - row) * (TILE_W / 2),
    y: (col + row) * (TILE_H / 2),
  };
}

export function isoUnproject(x: number, y: number): Tile {
  const a = x / (TILE_W / 2);
  const b = y / (TILE_H / 2);
  return {
    col: Math.floor((a + b) / 2),
    row: Math.floor((b - a) / 2),
  };
}

export function tileDiamond(col: number, row: number): string {
  const { x, y } = isoProject(col, row);
  const hw = TILE_W / 2;
  const hh = TILE_H / 2;
  return `${x},${y} ${x + hw},${y + hh} ${x},${y + TILE_H} ${x - hw},${y + hh}`;
}

export function footprintCells(item: ShopItem, col: number, row: number): Tile[] {
  const cells: Tile[] = [];
  for (let dc = 0; dc < item.tilesW; dc += 1) {
    for (let dr = 0; dr < item.tilesH; dr += 1) {
      cells.push({ col: col + dc, row: row + dr });
    }
  }
  return cells;
}

export function cellsInBounds(cells: Tile[]): boolean {
  return cells.every(
    (cell) => cell.col >= 0 && cell.col < ROOM_SIZE && cell.row >= 0 && cell.row < ROOM_SIZE,
  );
}

export function cellKey(cell: Tile): string {
  return `${cell.col},${cell.row}`;
}

export function occupiedKeys(
  placements: RoomPlacement[],
  ignoreInstanceId?: string | null,
): Set<string> {
  const keys = new Set<string>([cellKey(CAT_TILE)]);
  for (const placement of placements) {
    if (placement.instanceId === ignoreInstanceId) continue;
    const item = getItemById(placement.itemId);
    if (!item || item.unique) continue;
    for (const cell of footprintCells(item, placement.col, placement.row)) {
      keys.add(cellKey(cell));
    }
  }
  return keys;
}

export function canOccupy(
  placements: RoomPlacement[],
  item: ShopItem,
  col: number,
  row: number,
  ignoreInstanceId?: string | null,
): boolean {
  const cells = footprintCells(item, col, row);
  if (!cellsInBounds(cells)) return false;
  const taken = occupiedKeys(placements, ignoreInstanceId);
  return cells.every((cell) => !taken.has(cellKey(cell)));
}

export function footprintAnchor(
  item: Pick<ShopItem, "tilesW" | "tilesH">,
  col: number,
  row: number,
): { x: number; y: number } {
  const start = isoProject(col, row);
  const end = isoProject(col + item.tilesW - 1, row + item.tilesH - 1);
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2 + TILE_H * 0.72,
  };
}

export function sortDrawOrder(col: number, row: number): number {
  return col + row;
}

export function wallTheme(id: string): WallTheme {
  return WALL_THEMES[id] ?? WALL_THEMES.wall_mint;
}

export function floorTheme(id: string): FloorTheme {
  return FLOOR_THEMES[id] ?? FLOOR_THEMES.floor_wood;
}
