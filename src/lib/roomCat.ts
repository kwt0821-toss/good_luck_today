import { GRID, ISO_OX, ISO_OY, TILE_WX, TILE_WY, itemSize, occupancy } from "./roomLayout";
import type { FloorPlacement, RoomItem } from "./roomTypes";

export const DEFAULT_CAT_BREED_ID = "cheese";
export const CAT_BASE = "cat";
export const CAT_STEP_MS = 600;
export const CAT_WALK_FPS = 8;

export type CatBreed = {
  id: string;
  nameKo: string;
  /** Relative to /assets/room/cat/ */
  spriteSheet: string;
  shadow: string;
  /** Future: palette LUT / pattern overlays per breed */
  palette?: string | null;
  patternOverlay?: string | null;
};

export type CatFrameRect = { x: number; y: number; w: number; h: number };

export type CatAnimDef = { frames: string[]; fps: number; loop: boolean; holdMs?: number };

export type CatSpriteSheet = {
  image: string;
  frameSize: [number, number];
  sheetSize: [number, number];
  anchor: { x: number; y: number };
  shadow: { image: string; size: [number, number]; anchor: [number, number] };
  frames: Record<string, CatFrameRect>;
  animations: Record<string, CatAnimDef>;
};

export type CatWalkDir = "walk_dl" | "walk_dr" | "walk_ul" | "walk_ur";
export type CatIdlePose = "idle_sit" | "groom" | "loaf" | "stretch" | "yawn" | "sleep";
export type CatAnimName = CatWalkDir | CatIdlePose | "tapped" | "happy";

export type CatTile = { col: number; row: number };

/** Cheese tabby is the only breed for now; more breeds share the same sheet layout later. */
export const CAT_BREEDS: CatBreed[] = [
  {
    id: "cheese",
    nameKo: "치즈 고양이",
    spriteSheet: "cat-sprite.png",
    shadow: "cat-shadow.png",
    palette: null,
    patternOverlay: null,
  },
];

export function getCatBreed(id: string | null | undefined): CatBreed {
  return CAT_BREEDS.find((breed) => breed.id === id) ?? CAT_BREEDS[0];
}

const FALLBACK_SHEET: CatSpriteSheet = {
  image: "cat-sprite.png",
  frameSize: [174, 137],
  sheetSize: [1392, 411],
  anchor: { x: 87, y: 132 },
  shadow: { image: "cat-shadow.png", size: [120, 44], anchor: [60, 22] },
  frames: {
    walk_dl_0: { x: 0, y: 0, w: 174, h: 137 },
    walk_dl_1: { x: 174, y: 0, w: 174, h: 137 },
    walk_dl_2: { x: 348, y: 0, w: 174, h: 137 },
    walk_dl_3: { x: 522, y: 0, w: 174, h: 137 },
    walk_ul_0: { x: 696, y: 0, w: 174, h: 137 },
    walk_ul_1: { x: 870, y: 0, w: 174, h: 137 },
    walk_ul_2: { x: 1044, y: 0, w: 174, h: 137 },
    walk_ul_3: { x: 1218, y: 0, w: 174, h: 137 },
    walk_dr_0: { x: 0, y: 137, w: 174, h: 137 },
    walk_dr_1: { x: 174, y: 137, w: 174, h: 137 },
    walk_dr_2: { x: 348, y: 137, w: 174, h: 137 },
    walk_dr_3: { x: 522, y: 137, w: 174, h: 137 },
    walk_ur_0: { x: 696, y: 137, w: 174, h: 137 },
    walk_ur_1: { x: 870, y: 137, w: 174, h: 137 },
    walk_ur_2: { x: 1044, y: 137, w: 174, h: 137 },
    walk_ur_3: { x: 1218, y: 137, w: 174, h: 137 },
    sit: { x: 0, y: 274, w: 174, h: 137 },
    groom: { x: 174, y: 274, w: 174, h: 137 },
    loaf: { x: 348, y: 274, w: 174, h: 137 },
    sleep: { x: 522, y: 274, w: 174, h: 137 },
    stretch: { x: 696, y: 274, w: 174, h: 137 },
    happy: { x: 870, y: 274, w: 174, h: 137 },
    tapped: { x: 1044, y: 274, w: 174, h: 137 },
    yawn: { x: 1218, y: 274, w: 174, h: 137 },
  },
  animations: {
    walk_dl: { frames: ["walk_dl_0", "walk_dl_1", "walk_dl_2", "walk_dl_3"], fps: 8, loop: true },
    walk_ul: { frames: ["walk_ul_0", "walk_ul_1", "walk_ul_2", "walk_ul_3"], fps: 8, loop: true },
    walk_dr: { frames: ["walk_dr_0", "walk_dr_1", "walk_dr_2", "walk_dr_3"], fps: 8, loop: true },
    walk_ur: { frames: ["walk_ur_0", "walk_ur_1", "walk_ur_2", "walk_ur_3"], fps: 8, loop: true },
    idle_sit: { frames: ["sit"], fps: 1, loop: true },
    groom: { frames: ["groom"], fps: 1, loop: true },
    loaf: { frames: ["loaf"], fps: 1, loop: true },
    sleep: { frames: ["sleep"], fps: 1, loop: true },
    stretch: { frames: ["stretch"], fps: 1, loop: false, holdMs: 900 },
    happy: { frames: ["happy"], fps: 1, loop: false, holdMs: 700 },
    tapped: { frames: ["tapped"], fps: 1, loop: false, holdMs: 600 },
    yawn: { frames: ["yawn"], fps: 1, loop: false, holdMs: 900 },
  },
};

const DEFAULT_SPRITE_FILE = "cat-sprite.png";
const sheetCache = new Map<string, Promise<CatSpriteSheet>>();

function sheetSizeFromFrames(frames: Record<string, CatFrameRect>): [number, number] {
  let w = 0;
  let h = 0;
  for (const frame of Object.values(frames)) {
    w = Math.max(w, frame.x + frame.w);
    h = Math.max(h, frame.y + frame.h);
  }
  return [w || 1392, h || 411];
}

function spriteJsonName(spriteFile: string) {
  if (/\.json$/i.test(spriteFile)) return spriteFile;
  return spriteFile.replace(/\.[^.]+$/, ".json");
}

function isDefaultSprite(spriteFile: string | undefined) {
  if (!spriteFile) return true;
  const name = spriteFile.replace(/^\//, "");
  return name === DEFAULT_SPRITE_FILE || name === "cat-sprite.json";
}

function parseSheet(raw: unknown, imageFallback: string): CatSpriteSheet | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (!data.frames || typeof data.frames !== "object" || !data.animations || typeof data.animations !== "object") {
    return null;
  }
  const frames = data.frames as Record<string, CatFrameRect>;
  if (!Object.keys(frames).length) return null;
  const animations: Record<string, CatAnimDef> = {};
  for (const [name, value] of Object.entries(data.animations as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const def = value as Record<string, unknown>;
    if (!Array.isArray(def.frames) || !def.frames.every((frame) => typeof frame === "string")) continue;
    animations[name] = {
      frames: def.frames as string[],
      fps: typeof def.fps === "number" && def.fps > 0 ? def.fps : 1,
      loop: def.loop === true,
      ...(typeof def.holdMs === "number" ? { holdMs: def.holdMs } : {}),
    };
  }
  const shadowRaw =
    data.shadow && typeof data.shadow === "object" ? (data.shadow as Record<string, unknown>) : {};
  const anchorRaw =
    data.anchor && typeof data.anchor === "object" ? (data.anchor as Record<string, unknown>) : {};
  return {
    image: typeof data.image === "string" ? data.image : imageFallback,
    frameSize: Array.isArray(data.frameSize) ? (data.frameSize as [number, number]) : FALLBACK_SHEET.frameSize,
    sheetSize: sheetSizeFromFrames(frames),
    anchor: {
      x: typeof anchorRaw.x === "number" ? anchorRaw.x : FALLBACK_SHEET.anchor.x,
      y: typeof anchorRaw.y === "number" ? anchorRaw.y : FALLBACK_SHEET.anchor.y,
    },
    shadow: {
      image: "cat-shadow.png",
      size: Array.isArray(shadowRaw.size) ? (shadowRaw.size as [number, number]) : FALLBACK_SHEET.shadow.size,
      anchor: Array.isArray(shadowRaw.anchor)
        ? (shadowRaw.anchor as [number, number])
        : FALLBACK_SHEET.shadow.anchor,
    },
    frames,
    animations,
  };
}

function loadDefaultSheet(): Promise<CatSpriteSheet> {
  const cached = sheetCache.get(DEFAULT_SPRITE_FILE);
  if (cached) return cached;
  const promise = fetch(catAsset("cat-sprite.json"))
    .then((res) => (res.ok ? res.json() : null))
    .then((raw) => parseSheet(raw, FALLBACK_SHEET.image) ?? FALLBACK_SHEET)
    .catch(() => FALLBACK_SHEET);
  sheetCache.set(DEFAULT_SPRITE_FILE, promise);
  return promise;
}

/** `spriteFile` is a filename under /assets/room/cat/ (e.g. cat-sprite-korean_shorthair.png). */
export function loadCatSpriteSheet(spriteFile?: string): Promise<CatSpriteSheet> {
  const file = spriteFile?.trim();
  if (!file || isDefaultSprite(file)) return loadDefaultSheet();
  const cached = sheetCache.get(file);
  if (cached) return cached;
  const promise = fetch(catAsset(spriteJsonName(file)))
    .then((res) => (res.ok ? res.json() : null))
    .then((raw) => parseSheet(raw, file) ?? loadDefaultSheet())
    .catch(() => loadDefaultSheet());
  sheetCache.set(file, promise);
  return promise;
}

export function catAsset(relative: string) {
  return `/assets/room/${CAT_BASE}/${relative.replace(/^\//, "")}`;
}

export function tileCentreWorld(col: number, row: number) {
  return {
    x: ISO_OX + (col + 0.5 - (row + 0.5)) * TILE_WX,
    y: ISO_OY + (col + 0.5 + row + 0.5) * TILE_WY,
  };
}

export function walkableTiles(
  floor: FloorPlacement[],
  byId: Map<string, RoomItem>,
): CatTile[] {
  // occupancy skips decals and on-top props; wall items are not on the floor grid
  const used = occupancy(floor, byId);
  const out: CatTile[] = [];
  for (let row = 0; row < GRID; row += 1) {
    for (let col = 0; col < GRID; col += 1) {
      if (!used.has(`${col},${row}`)) out.push({ col, row });
    }
  }
  return out;
}

export function tileKey(tile: CatTile) {
  return `${tile.col},${tile.row}`;
}

export function nearestWalkable(from: CatTile, walkable: CatTile[]): CatTile | null {
  if (!walkable.length) return null;
  let best = walkable[0];
  let bestDist = Infinity;
  for (const tile of walkable) {
    const dist = Math.abs(tile.col - from.col) + Math.abs(tile.row - from.row);
    if (dist < bestDist) {
      best = tile;
      bestDist = dist;
    }
  }
  return best;
}

const NEIGHBOR_DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Connected walkable tiles reachable from `from` (4-way). */
export function reachableTiles(from: CatTile, walkable: CatTile[]): CatTile[] {
  const allowed = new Set(walkable.map(tileKey));
  const start = tileKey(from);
  if (!allowed.has(start)) return [];
  const out: CatTile[] = [];
  const seen = new Set<string>([start]);
  const queue: CatTile[] = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    out.push(cur);
    for (const [dc, dr] of NEIGHBOR_DIRS) {
      const next = { col: cur.col + dc, row: cur.row + dr };
      const key = tileKey(next);
      if (!allowed.has(key) || seen.has(key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return out;
}

/** Largest 4-way connected walkable region (cats must seed here or they never path). */
export function largestWalkableComponent(walkable: CatTile[]): CatTile[] {
  if (walkable.length <= 1) return walkable;
  const seen = new Set<string>();
  let best: CatTile[] = [];
  for (const tile of walkable) {
    const key = tileKey(tile);
    if (seen.has(key)) continue;
    const component = reachableTiles(tile, walkable);
    for (const part of component) seen.add(tileKey(part));
    if (component.length > best.length) best = component;
  }
  return best.length ? best : walkable;
}

export function randomWalkable(walkable: CatTile[], exclude?: CatTile | null): CatTile | null {
  const pool = exclude
    ? walkable.filter((tile) => tile.col !== exclude.col || tile.row !== exclude.row)
    : walkable;
  if (!pool.length) return walkable[0] ?? null;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

export function walkDirOf(from: CatTile, to: CatTile): CatWalkDir {
  const dc = to.col - from.col;
  const dr = to.row - from.row;
  if (Math.abs(dc) >= Math.abs(dr)) {
    return dc > 0 ? "walk_dr" : "walk_ul";
  }
  return dr > 0 ? "walk_dl" : "walk_ur";
}

/** A* on 4-way iso neighbours over the walkable set. */
export function findPath(from: CatTile, to: CatTile, walkable: CatTile[]): CatTile[] {
  const allowed = new Set(walkable.map(tileKey));
  const startKey = tileKey(from);
  const goalKey = tileKey(to);
  if (startKey === goalKey) return [from];
  if (!allowed.has(goalKey) || !allowed.has(startKey)) return [];

  type Node = { col: number; row: number; g: number; f: number };
  const open = new Map<string, Node>();
  const closed = new Set<string>();
  const parent = new Map<string, string | null>();
  const h = (col: number, row: number) => Math.abs(col - to.col) + Math.abs(row - to.row);
  open.set(startKey, { col: from.col, row: from.row, g: 0, f: h(from.col, from.row) });
  parent.set(startKey, null);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;

  while (open.size) {
    let bestKey = "";
    let best: Node | null = null;
    for (const [key, node] of open) {
      if (!best || node.f < best.f) {
        best = node;
        bestKey = key;
      }
    }
    if (!best) break;
    if (bestKey === goalKey) {
      const path: CatTile[] = [];
      let key: string | null = bestKey;
      while (key) {
        const [c, r] = key.split(",").map(Number);
        path.push({ col: c, row: r });
        key = parent.get(key) ?? null;
      }
      path.reverse();
      return path;
    }
    open.delete(bestKey);
    closed.add(bestKey);
    for (const [dc, dr] of dirs) {
      const nc = best.col + dc;
      const nr = best.row + dr;
      const key = `${nc},${nr}`;
      if (!allowed.has(key) || closed.has(key)) continue;
      const g = best.g + 1;
      const prev = open.get(key);
      if (!prev || g < prev.g) {
        open.set(key, { col: nc, row: nr, g, f: g + h(nc, nr) });
        parent.set(key, bestKey);
      }
    }
  }
  return [];
}

/** One full play of `def`, plus its hold. Looping clips use this as a minimum, not a stop. */
export function animDurationMs(def: { frames: string[]; fps?: number; holdMs?: number } | null | undefined): number {
  const count = def?.frames.length ?? 0;
  const fps = def?.fps && def.fps > 0 ? def.fps : 1;
  return (count / fps) * 1000 + (def?.holdMs ?? 0);
}

export function pickIdlePose(
  sheet: CatSpriteSheet,
  preferSleep = false,
): { anim: CatIdlePose; durationMs: number } {
  // Rare, short sleeps — long idle made the cat look broken in the browser.
  if (preferSleep || Math.random() < 0.04) {
    return { anim: "sleep", durationMs: 2500 + Math.random() * 2500 };
  }
  const poses: CatIdlePose[] = ["idle_sit", "groom", "loaf", "stretch", "yawn"];
  const anim = poses[Math.floor(Math.random() * poses.length)] ?? "idle_sit";
  const def = sheet.animations[anim];
  if (anim === "stretch" || anim === "yawn") return { anim, durationMs: animDurationMs(def) };
  if (anim === "groom") {
    const fps = def?.fps && def.fps > 0 ? def.fps : 1;
    const once = ((def?.frames.length ?? 1) / fps) * 1000;
    return { anim, durationMs: Math.max(once, 400 + Math.random() * 700) };
  }
  // Prefer getting back on the path quickly so roaming is obvious.
  return { anim, durationMs: 400 + Math.random() * 700 };
}

export function catDepthKey(col: number, row: number) {
  return { front: col + row, bias: col - row };
}

/** Depth key while walking uses the destination tile so the cat stays in front of furniture ahead. */
export function catDepthForMove(from: CatTile, to: CatTile | null, t: number) {
  if (!to || t < 1) {
    // during move use destination; when idle use current
    const tile = to && t > 0 ? to : from;
    return catDepthKey(tile.col, tile.row);
  }
  return catDepthKey(to.col, to.row);
}

export function furnitureDepthKey(place: FloorPlacement, item: RoomItem) {
  const [w, d] = itemSize(item, place.orientation);
  return { front: place.col + w - 1 + (place.row + d - 1), bias: place.col - place.row };
}
