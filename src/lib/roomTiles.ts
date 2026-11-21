import { diamondPoints, GRID, TILE_WX, WALL_SLOTS, tileTopWorld } from "./roomLayout";
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

type ThemeTilePack = {
  floor?: string;
  wallL?: string;
  wallR?: string;
};

const themeTiles = new Map<string, ThemeTilePack>();

export function setTileRules(rules: Partial<RoomTileRules> | null | undefined) {
  activeRules = { ...FALLBACK_TILE_RULES, ...rules };
}

export function registerThemeTile(id: string, pack: ThemeTilePack) {
  const prev = themeTiles.get(id) ?? {};
  themeTiles.set(id, { ...prev, ...pack });
}

export function wallTilesFromSides(left: string, right: string): WallTiles {
  return {
    L: Array.from({ length: WALL_STRIPS }, () => left),
    R: Array.from({ length: WALL_STRIPS }, () => right),
  };
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
  const template = themeTiles.get(id)?.floor ?? rules.floorFile;
  return fillTemplate(template, { id, "c%2": pc, "r%2": pr, c: col, r: row });
}

export function wallStripSrc(id: string, wall: "L" | "R", index: number, rules = activeRules) {
  const pack = themeTiles.get(id);
  const template =
    (wall === "L" ? pack?.wallL : pack?.wallR) ?? (wall === "L" ? rules.wallLeftFile : rules.wallRightFile);
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

type TileBox = { x: number; y: number; w: number; h: number };

function roundPct(value: number) {
  return Math.round(value * 10000) / 10000;
}

/** CSS polygon() for a world-space shape, as percentages of its tile box. */
export function clipPathForBox(rect: TileBox, points: string): string {
  const parts = points
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(",");
      const px = ((Number(x) - rect.x) / rect.w) * 100;
      const py = ((Number(y) - rect.y) / rect.h) * 100;
      return `${roundPct(px)}% ${roundPct(py)}%`;
    });
  return `polygon(${parts.join(", ")})`;
}

/** Same parallelogram for every strip. Shared edges overlap by half a pixel; outer slants stay put. */
export function wallStripClip(wall: "L" | "R"): string {
  return clipPathForBox(wallStripRect(wall, 0), bleedWallSeam(wallStripPoints(wall, 0)));
}

/** Same diamond for every floor cell. Shared edges overlap by half a pixel. */
export function floorTileClip(): string {
  return clipPathForBox(floorTileRect(0, 0), bleedFloorSeam(diamondPoints(0, 0)));
}

const SEAM_PX = 0.5;

function parsePoints(points: string) {
  return points
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [x, y] = pair.split(",");
      return { x: Number(x), y: Number(y) };
    });
}

function formatPoints(points: { x: number; y: number }[]) {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

function lineY(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  return (x: number) => (dx === 0 ? a.y : a.y + ((b.y - a.y) * (x - a.x)) / dx);
}

/** Slide the vertical seams outward along the top and bottom slants. */
function bleedWallSeam(points: string) {
  const poly = parsePoints(points);
  const minX = Math.min(...poly.map((p) => p.x));
  const maxX = Math.max(...poly.map((p) => p.x));
  const onX = (x: number) => poly.filter((p) => p.x === x);
  const topOf = (side: { x: number; y: number }[]) => side.reduce((a, b) => (a.y < b.y ? a : b));
  const botOf = (side: { x: number; y: number }[]) => side.reduce((a, b) => (a.y > b.y ? a : b));
  const left = onX(minX);
  const right = onX(maxX);
  const topAt = lineY(topOf(right), topOf(left));
  const botAt = lineY(botOf(left), botOf(right));
  const moved = new Map<(typeof poly)[number], { x: number; y: number }>();
  moved.set(topOf(left), { x: minX - SEAM_PX, y: topAt(minX - SEAM_PX) });
  moved.set(botOf(left), { x: minX - SEAM_PX, y: botAt(minX - SEAM_PX) });
  moved.set(topOf(right), { x: maxX + SEAM_PX, y: topAt(maxX + SEAM_PX) });
  moved.set(botOf(right), { x: maxX + SEAM_PX, y: botAt(maxX + SEAM_PX) });
  return formatPoints(poly.map((p) => moved.get(p) ?? p));
}

/** Push each diamond vertex half a pixel toward its neighbor, along the bisector. */
function bleedFloorSeam(points: string) {
  const poly = parsePoints(points);
  const cx = poly.reduce((sum, p) => sum + p.x, 0) / poly.length;
  const cy = poly.reduce((sum, p) => sum + p.y, 0) / poly.length;
  return formatPoints(
    poly.map((p) => {
      const dx = p.x - cx;
      const dy = p.y - cy;
      const len = Math.hypot(dx, dy) || 1;
      return { x: p.x + (dx / len) * SEAM_PX, y: p.y + (dy / len) * SEAM_PX };
    }),
  );
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

export function paintSkinType(itemId: string) {
  return itemId.replace(/^(floor_|wall_)/, "");
}

export function applyPaint(
  floor: FloorTiles,
  walls: WallTiles,
  target: PaintTarget,
  id: string,
  fillAll: boolean,
): { floor: FloorTiles; walls: WallTiles; changed: boolean } {
  const skin = paintSkinType(id);
  const nextFloor = cloneFloorTiles(floor);
  const nextWalls = cloneWallTiles(walls);
  let changed = false;
  if (target.kind === "floor") {
    if (fillAll) {
      for (let row = 0; row < GRID; row += 1) {
        for (let col = 0; col < GRID; col += 1) {
          if (nextFloor[row][col] !== skin) {
            nextFloor[row][col] = skin;
            changed = true;
          }
        }
      }
    } else if (nextFloor[target.row]?.[target.col] !== undefined && nextFloor[target.row][target.col] !== skin) {
      nextFloor[target.row][target.col] = skin;
      changed = true;
    }
  } else if (fillAll) {
    // Fill every wall strip on both faces (matches commitPlacement).
    for (const wall of ["L", "R"] as const) {
      for (let i = 0; i < WALL_STRIPS; i += 1) {
        if (nextWalls[wall][i] !== skin) {
          nextWalls[wall][i] = skin;
          changed = true;
        }
      }
    }
  } else if (nextWalls[target.wall][target.index] !== skin) {
    nextWalls[target.wall][target.index] = skin;
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

export function normalizeWallTiles(
  raw: unknown,
  fallbackLeft = activeRules.defaultWall,
  fallbackRight = fallbackLeft,
): WallTiles {
  const fallback = wallTilesFromSides(fallbackLeft, fallbackRight);
  if (!raw || typeof raw !== "object") return fallback;
  const rec = raw as { L?: unknown; R?: unknown };
  const side = (value: unknown, key: "L" | "R") => {
    if (!Array.isArray(value) || value.length !== WALL_STRIPS) return fallback[key];
    return value.map((cell, i) => (typeof cell === "string" && cell ? cell : fallback[key][i]));
  };
  return { L: side(rec.L, "L"), R: side(rec.R, "R") };
}

export { WALL_SLOTS };
