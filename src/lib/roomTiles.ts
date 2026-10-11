import { GRID, TILE_WX, WALL_SLOTS, tileTopWorld } from "./roomLayout";
import type { FloorTiles, PaintTarget, RoomItem, RoomTileRules, WallTiles } from "./roomTypes";

export const DEFAULT_FLOOR_TILE = "wood_honey";
export const DEFAULT_WALL_TILE = "plum_sparkle";
export const WALL_STRIPS = 8;
export const FLOOR_TILE_W = 160;
export const FLOOR_TILE_H = 82;
export const WALL_STRIP_W = 82;
export const WALL_STRIP_H = 493;
export const WALL_FACE_H = 450;
export const TILE_PAD = 2;

export const FALLBACK_TILE_RULES: RoomTileRules = {
  floorFile: "floor/iso/{id}_{c%2}{r%2}.png",
  wallLeftFile: "wall/L/{id}_{i}.png",
  wallRightFile: "wall/R/{id}_{i}.png",
  defaultFloor: DEFAULT_FLOOR_TILE,
  defaultWall: DEFAULT_WALL_TILE,
};

let activeRules: RoomTileRules = FALLBACK_TILE_RULES;

export function setTileRules(rules: Partial<RoomTileRules> | null | undefined) {
  activeRules = { ...FALLBACK_TILE_RULES, ...rules };
}

export function getTileRules() {
  return activeRules;
}

export function defaultFloorTiles(id = activeRules.defaultFloor): FloorTiles {
  return Array.from({ length: GRID }, () => Array.from({ length: GRID }, () => id));
}

export function defaultWallTiles(id = activeRules.defaultWall): WallTiles {
  return {
    L: Array.from({ length: WALL_STRIPS }, () => id),
    R: Array.from({ length: WALL_STRIPS }, () => id),
  };
}

export function cloneFloorTiles(tiles: FloorTiles): FloorTiles {
  return tiles.map((row) => [...row]);
}

export function cloneWallTiles(tiles: WallTiles): WallTiles {
  return { L: [...tiles.L], R: [...tiles.R] };
}

function fillTemplate(template: string, values: Record<string, string | number>) {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => String(values[key] ?? ""));
}

export function floorTileSrc(id: string, col: number, row: number, rules = activeRules) {
  const pc = ((col % 2) + 2) % 2;
  const pr = ((row % 2) + 2) % 2;
  return fillTemplate(rules.floorFile, { id, "c%2": pc, "r%2": pr, c: col, r: row });
}

export function wallStripSrc(id: string, wall: "L" | "R", index: number, rules = activeRules) {
  const template = wall === "L" ? rules.wallLeftFile : rules.wallRightFile;
  return fillTemplate(template, { id, i: index, "i%2": index % 2, wall });
}

export function floorTileRect(col: number, row: number) {
  const top = tileTopWorld(col, row);
  return {
    x: top.x - TILE_WX - TILE_PAD,
    y: top.y - TILE_PAD,
    w: FLOOR_TILE_W,
    h: FLOOR_TILE_H,
  };
}

export function wallStripRect(wall: "L" | "R", index: number) {
  const i = Math.max(0, Math.min(WALL_STRIPS - 1, index));
  if (wall === "L") {
    const far = tileTopWorld(0, i + 1);
    const near = tileTopWorld(0, i);
    return {
      x: far.x - TILE_PAD,
      y: near.y - WALL_FACE_H - TILE_PAD,
      w: WALL_STRIP_W,
      h: WALL_STRIP_H,
    };
  }
  const near = tileTopWorld(i, 0);
  return {
    x: near.x - TILE_PAD,
    y: near.y - WALL_FACE_H - TILE_PAD,
    w: WALL_STRIP_W,
    h: WALL_STRIP_H,
  };
}

export function wallStripPoints(wall: "L" | "R", index: number) {
  const i = Math.max(0, Math.min(WALL_STRIPS - 1, index));
  const a = wall === "L" ? tileTopWorld(0, i) : tileTopWorld(i, 0);
  const b = wall === "L" ? tileTopWorld(0, i + 1) : tileTopWorld(i + 1, 0);
  return `${a.x},${a.y} ${b.x},${b.y} ${b.x},${b.y - WALL_FACE_H} ${a.x},${a.y - WALL_FACE_H}`;
}

export function paintTargetLabel(target: PaintTarget, brush?: RoomItem | null) {
  if (target.kind === "floor") {
    const name = brush?.nameKo ? ` ${brush.nameKo}` : "";
    return `(${target.col}, ${target.row})${name}`;
  }
  const side = target.wall === "L" ? "왼쪽" : "오른쪽";
  return `${side} 벽 ${target.index + 1}번째 줄`;
}

export function paintTargetAnchor(target: PaintTarget) {
  if (target.kind === "floor") {
    const top = tileTopWorld(target.col, target.row);
    return { x: top.x + 36, y: top.y + 28 };
  }
  const rect = wallStripRect(target.wall, target.index);
  return { x: rect.x + rect.w / 2 + 24, y: rect.y + 70 };
}

export function applyPaint(
  floor: FloorTiles,
  walls: WallTiles,
  target: PaintTarget,
  id: string,
  fillAll: boolean,
): { floor: FloorTiles; walls: WallTiles; changed: boolean } {
  const nextFloor = cloneFloorTiles(floor);
  const nextWalls = cloneWallTiles(walls);
  let changed = false;
  if (target.kind === "floor") {
    if (fillAll) {
      for (let row = 0; row < GRID; row += 1) {
        for (let col = 0; col < GRID; col += 1) {
          if (nextFloor[row][col] !== id) {
            nextFloor[row][col] = id;
            changed = true;
          }
        }
      }
    } else if (nextFloor[target.row]?.[target.col] !== undefined && nextFloor[target.row][target.col] !== id) {
      nextFloor[target.row][target.col] = id;
      changed = true;
    }
  } else if (fillAll) {
    for (let i = 0; i < WALL_STRIPS; i += 1) {
      if (nextWalls[target.wall][i] !== id) {
        nextWalls[target.wall][i] = id;
        changed = true;
      }
    }
  } else if (nextWalls[target.wall][target.index] !== id) {
    nextWalls[target.wall][target.index] = id;
    changed = true;
  }
  return { floor: nextFloor, walls: nextWalls, changed };
}

export function normalizeFloorTiles(raw: unknown, fallbackId = activeRules.defaultFloor): FloorTiles {
  const fallback = defaultFloorTiles(fallbackId);
  if (!Array.isArray(raw) || raw.length !== GRID) return fallback;
  return raw.map((row, r) => {
    if (!Array.isArray(row) || row.length !== GRID) return fallback[r];
    return row.map((cell, c) => (typeof cell === "string" && cell ? cell : fallback[r][c]));
  });
}

export function normalizeWallTiles(raw: unknown, fallbackId = activeRules.defaultWall): WallTiles {
  const fallback = defaultWallTiles(fallbackId);
  if (!raw || typeof raw !== "object") return fallback;
  const rec = raw as { L?: unknown; R?: unknown };
  const side = (value: unknown, key: "L" | "R") => {
    if (!Array.isArray(value) || value.length !== WALL_STRIPS) return fallback[key];
    return value.map((cell, i) => (typeof cell === "string" && cell ? cell : fallback[key][i]));
  };
  return { L: side(rec.L, "L"), R: side(rec.R, "R") };
}

export { WALL_SLOTS };
