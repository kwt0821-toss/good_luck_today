import { useEffect, useRef, useState, type MutableRefObject } from "react";

import {
  CAT_STEP_MS,
  CAT_WALK_FPS,
  type CatAnimName,
  type CatSpriteSheet,
  type CatTile,
  type CatWalkDir,
  findPath,
  getCatBreed,
  loadCatSpriteSheet,
  nearestWalkable,
  pickIdlePose,
  randomWalkable,
  tileCentreWorld,
  tileKey,
  walkDirOf,
  walkableTiles,
} from "./roomCat";
import type { FloorPlacement, RoomItem, RoomMode } from "./roomTypes";

export type RoomCatMotion = {
  worldX: number;
  worldY: number;
  frameName: string;
  anim: CatAnimName;
  opacity: number;
};

export type RoomCatView = {
  breedId: string;
  sheet: CatSpriteSheet | null;
  depthCol: number;
  depthRow: number;
  sleeping: boolean;
  ready: boolean;
  opacity: number;
};

type Phase =
  | { kind: "idle"; until: number; anim: CatAnimName }
  | { kind: "walk"; path: CatTile[]; index: number; startedAt: number; dir: CatWalkDir }
  | { kind: "tap"; step: "tapped" | "happy" | "wait"; until: number };

type UseRoomCatArgs = {
  roomId: string;
  breedId: string | null;
  floor: FloorPlacement[];
  itemsById: Map<string, RoomItem>;
  mode: RoomMode;
  active: boolean;
  reducedMotion: boolean;
};

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function frameFor(sheet: CatSpriteSheet, anim: CatAnimName, elapsedMs: number): string {
  const def = sheet.animations[anim] ?? sheet.animations.idle_sit;
  const frames = def?.frames ?? ["sit"];
  if (frames.length <= 1) return frames[0] ?? "sit";
  const fps = def.fps || CAT_WALK_FPS;
  const idx = Math.floor((elapsedMs / 1000) * fps) % frames.length;
  return frames[idx] ?? frames[0] ?? "sit";
}

function seedTile(walkable: CatTile[]): CatTile {
  return (
    walkable.find((tile) => tile.col === 4 && tile.row === 5) ??
    walkable.find((tile) => tile.col === 3 && tile.row === 4) ??
    walkable[Math.floor(walkable.length / 2)] ?? { col: 4, row: 5 }
  );
}

function reachableFrom(from: CatTile, walkable: CatTile[]): CatTile[] {
  const allowed = new Set(walkable.map(tileKey));
  const start = tileKey(from);
  if (!allowed.has(start)) return [];
  const out: CatTile[] = [];
  const seen = new Set<string>([start]);
  const queue: CatTile[] = [from];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;
  while (queue.length) {
    const cur = queue.shift()!;
    out.push(cur);
    for (const [dc, dr] of dirs) {
      const next = { col: cur.col + dc, row: cur.row + dr };
      const key = tileKey(next);
      if (!allowed.has(key) || seen.has(key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  return out;
}

function pickWalkPath(from: CatTile, walkable: CatTile[]): CatTile[] | null {
  const reachable = reachableFrom(from, walkable);
  if (reachable.length < 2) return null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const goal = randomWalkable(reachable, from);
    if (!goal) break;
    const path = findPath(from, goal, reachable);
    if (path.length >= 2) return path;
  }
  const other = reachable.find((tile) => tile.col !== from.col || tile.row !== from.row);
  if (!other) return null;
  const path = findPath(from, other, reachable);
  return path.length >= 2 ? path : null;
}

export function useRoomCat({
  roomId,
  breedId,
  floor,
  itemsById,
  mode,
  active,
  reducedMotion,
}: UseRoomCatArgs): {
  view: RoomCatView;
  motionRef: CatMotionRef;
  tap: () => void;
} {
  const breed = getCatBreed(breedId);
  const motionRef = useRef<RoomCatMotion>({
    worldX: 0,
    worldY: 0,
    frameName: "sit",
    anim: "idle_sit",
    opacity: 1,
  });
  const [view, setView] = useState<RoomCatView>({
    breedId: breed.id,
    sheet: null,
    depthCol: 4,
    depthRow: 5,
    sleeping: false,
    ready: false,
    opacity: 1,
  });

  const phaseRef = useRef<Phase>({ kind: "idle", until: 0, anim: "idle_sit" });
  const tileRef = useRef<CatTile>({ col: 4, row: 5 });
  const fromRef = useRef<CatTile>({ col: 4, row: 5 });
  const toRef = useRef<CatTile | null>(null);
  const progressRef = useRef(0);
  const animElapsedRef = useRef(0);
  const lastTsRef = useRef(0);
  const seededRef = useRef("");
  const floorRef = useRef(floor);
  const itemsRef = useRef(itemsById);
  const modeRef = useRef(mode);
  const activeRef = useRef(active);
  const reduceRef = useRef(reducedMotion || prefersReducedMotion());
  const sheetRef = useRef<CatSpriteSheet | null>(null);
  const depthRef = useRef({ col: 4, row: 5 });
  const sleepRef = useRef(false);
  const opacityRef = useRef(1);
  const listenersRef = useRef(new Set<() => void>());

  floorRef.current = floor;
  itemsRef.current = itemsById;
  modeRef.current = mode;
  activeRef.current = active;
  reduceRef.current = reducedMotion || prefersReducedMotion();

  useEffect(() => {
    void loadCatSpriteSheet().then((loaded) => {
      sheetRef.current = loaded;
      setView((prev) => ({ ...prev, sheet: loaded, ready: true, breedId: breed.id }));
    });
  }, [breed.id]);

  useEffect(() => {
    const walkable = walkableTiles(floor, itemsById);
    if (!walkable.length) return;
    const current = tileRef.current;
    const onWalkable = walkable.some((tile) => tile.col === current.col && tile.row === current.row);
    const needSeed = seededRef.current !== roomId;
    if (!needSeed && onWalkable) return;

    const start = needSeed ? seedTile(walkable) : (nearestWalkable(current, walkable) ?? seedTile(walkable));
    seededRef.current = roomId;
    tileRef.current = start;
    fromRef.current = start;
    toRef.current = null;
    progressRef.current = 0;
    depthRef.current = { col: start.col, row: start.row };
    const centre = tileCentreWorld(start.col, start.row);
    motionRef.current = {
      ...motionRef.current,
      worldX: centre.x,
      worldY: centre.y,
      frameName: "sit",
      anim: "idle_sit",
    };
    phaseRef.current = { kind: "idle", until: performance.now() + (needSeed ? 350 : 150), anim: "idle_sit" };
    setView((prev) => ({ ...prev, depthCol: start.col, depthRow: start.row }));
  }, [floor, itemsById, roomId]);

  useEffect(() => {
    if (mode === "edit") {
      phaseRef.current = {
        kind: "idle",
        until: Number.POSITIVE_INFINITY,
        anim: phaseRef.current.kind === "idle" ? phaseRef.current.anim : "idle_sit",
      };
      toRef.current = null;
      progressRef.current = 0;
      motionRef.current.opacity = 0.5;
      setView((prev) => ({ ...prev, opacity: 0.5 }));
      return;
    }
    motionRef.current.opacity = 1;
    setView((prev) => ({ ...prev, opacity: 1 }));
    if (phaseRef.current.kind === "idle" && !Number.isFinite(phaseRef.current.until)) {
      phaseRef.current = { kind: "idle", until: performance.now() + 250, anim: "idle_sit" };
    }
  }, [mode]);

  useEffect(() => {
    let raf = 0;
    let alive = true;
    const listeners = listenersRef.current;

    const notify = () => {
      for (const listener of listeners) listener();
    };

    const loop = (ts: number) => {
      if (!alive) return;
      const sheet = sheetRef.current;
      if (!sheet) {
        raf = requestAnimationFrame(loop);
        return;
      }

      const last = lastTsRef.current || ts;
      const dt = Math.min(64, ts - last);
      lastTsRef.current = ts;
      animElapsedRef.current += dt;

      const walkable = walkableTiles(floorRef.current, itemsRef.current);
      const phase = phaseRef.current;
      const reduce = reduceRef.current;
      const isEdit = modeRef.current === "edit";
      const isActive = activeRef.current;

      if (isActive && !isEdit && !reduce) {
        if (phase.kind === "tap") {
          if (ts >= phase.until) {
            if (phase.step === "tapped") {
              phaseRef.current = { kind: "tap", step: "happy", until: ts + 700 };
              animElapsedRef.current = 0;
            } else if (phase.step === "happy") {
              phaseRef.current = { kind: "tap", step: "wait", until: ts + 1000 };
              animElapsedRef.current = 0;
            } else {
              phaseRef.current = { kind: "idle", until: ts + 350, anim: "idle_sit" };
              animElapsedRef.current = 0;
            }
          }
        } else if (phase.kind === "walk") {
          const from = phase.path[phase.index];
          const to = phase.path[phase.index + 1];
          if (!from || !to) {
            phaseRef.current = { kind: "idle", until: ts + 350, anim: "idle_sit" };
          } else {
            const t = Math.min(1, (ts - phase.startedAt) / CAT_STEP_MS);
            progressRef.current = t;
            fromRef.current = from;
            toRef.current = to;
            if (t >= 1) {
              tileRef.current = to;
              fromRef.current = to;
              const nextIndex = phase.index + 1;
              if (nextIndex >= phase.path.length - 1) {
                toRef.current = null;
                progressRef.current = 0;
                const pose = pickIdlePose(false);
                phaseRef.current = { kind: "idle", until: ts + pose.durationMs, anim: pose.anim };
                animElapsedRef.current = 0;
              } else {
                const nextFrom = phase.path[nextIndex];
                const nextTo = phase.path[nextIndex + 1];
                phaseRef.current = {
                  kind: "walk",
                  path: phase.path,
                  index: nextIndex,
                  startedAt: ts,
                  dir: walkDirOf(nextFrom, nextTo),
                };
                animElapsedRef.current = 0;
              }
            }
          }
        } else if (phase.kind === "idle" && ts >= phase.until) {
          const path = pickWalkPath(tileRef.current, walkable);
          if (path) {
            phaseRef.current = {
              kind: "walk",
              path,
              index: 0,
              startedAt: ts,
              dir: walkDirOf(path[0], path[1]),
            };
            fromRef.current = path[0];
            toRef.current = path[1];
            progressRef.current = 0;
            animElapsedRef.current = 0;
          } else {
            const pose = pickIdlePose(false);
            phaseRef.current = { kind: "idle", until: ts + pose.durationMs, anim: pose.anim };
            animElapsedRef.current = 0;
          }
        }
      } else if (isEdit || reduce) {
        if (phase.kind !== "idle" || (reduce && phase.anim !== "idle_sit")) {
          phaseRef.current = { kind: "idle", until: Number.POSITIVE_INFINITY, anim: "idle_sit" };
          toRef.current = null;
          progressRef.current = 0;
        }
      }

      const live = phaseRef.current;
      let anim: CatAnimName = "idle_sit";
      if (live.kind === "walk") anim = live.dir;
      else if (live.kind === "tap") anim = live.step === "wait" ? "happy" : live.step;
      else anim = live.anim;

      const from = fromRef.current;
      const to = toRef.current;
      const progress = to ? progressRef.current : 0;
      const a = tileCentreWorld(from.col, from.row);
      const b = to ? tileCentreWorld(to.col, to.row) : a;
      const depthTile = to && progress > 0 ? to : tileRef.current;

      motionRef.current = {
        worldX: a.x + (b.x - a.x) * progress,
        worldY: a.y + (b.y - a.y) * progress,
        frameName: frameFor(sheet, anim, animElapsedRef.current),
        anim,
        opacity: isEdit ? 0.5 : 1,
      };
      notify();

      const nextOpacity = isEdit ? 0.5 : 1;
      const nextSleeping = anim === "sleep";
      if (
        depthTile.col !== depthRef.current.col ||
        depthTile.row !== depthRef.current.row ||
        nextSleeping !== sleepRef.current ||
        nextOpacity !== opacityRef.current
      ) {
        depthRef.current = { col: depthTile.col, row: depthTile.row };
        sleepRef.current = nextSleeping;
        opacityRef.current = nextOpacity;
        setView((prev) => ({
          ...prev,
          depthCol: depthTile.col,
          depthRow: depthTile.row,
          sleeping: nextSleeping,
          opacity: nextOpacity,
        }));
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      lastTsRef.current = 0;
      listeners.clear();
    };
  }, []);

  const motionRefWithSub = motionRef as CatMotionRef;
  motionRefWithSub.subscribe = (fn: () => void) => {
    listenersRef.current.add(fn);
    return () => {
      listenersRef.current.delete(fn);
    };
  };

  const tap = () => {
    if (modeRef.current === "edit" || reduceRef.current) return;
    const now = performance.now();
    phaseRef.current = { kind: "tap", step: "tapped", until: now + 600 };
    toRef.current = null;
    progressRef.current = 0;
    animElapsedRef.current = 0;
  };

  return { view, motionRef: motionRefWithSub, tap };
}

export type CatMotionRef = MutableRefObject<RoomCatMotion> & {
  subscribe?: (fn: () => void) => () => void;
};
