import { useEffect, useRef, useState } from "react";

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
  walkDirOf,
  walkableTiles,
} from "./roomCat";
import type { FloorPlacement, RoomItem, RoomMode } from "./roomTypes";

export type RoomCatView = {
  breedId: string;
  sheet: CatSpriteSheet | null;
  worldX: number;
  worldY: number;
  depthCol: number;
  depthRow: number;
  anim: CatAnimName;
  frameName: string;
  opacity: number;
  sleeping: boolean;
  ready: boolean;
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
  return walkable.find((tile) => tile.col === 4 && tile.row === 5)
    ?? walkable.find((tile) => tile.col === 3 && tile.row === 4)
    ?? walkable[Math.floor(walkable.length / 2)]
    ?? { col: 4, row: 5 };
}

export function useRoomCat({
  roomId,
  breedId,
  floor,
  itemsById,
  mode,
  active,
  reducedMotion,
}: UseRoomCatArgs): { view: RoomCatView; tap: () => void } {
  const breed = getCatBreed(breedId);
  const [sheet, setSheet] = useState<CatSpriteSheet | null>(null);
  const [tick, setTick] = useState(0);
  const phaseRef = useRef<Phase>({ kind: "idle", until: 0, anim: "idle_sit" });
  const tileRef = useRef<CatTile>({ col: 4, row: 5 });
  const fromRef = useRef<CatTile>({ col: 4, row: 5 });
  const toRef = useRef<CatTile | null>(null);
  const progressRef = useRef(0);
  const animElapsedRef = useRef(0);
  const lastTsRef = useRef(0);
  const seededRef = useRef("");
  const reduce = reducedMotion || prefersReducedMotion();

  useEffect(() => {
    void loadCatSpriteSheet().then(setSheet);
  }, []);

  // Relocate when layout blocks the cat, or seed once per room.
  useEffect(() => {
    const walkable = walkableTiles(floor, itemsById);
    if (!walkable.length) return;
    const current = tileRef.current;
    const onWalkable = walkable.some((tile) => tile.col === current.col && tile.row === current.row);
    if (seededRef.current !== roomId) {
      seededRef.current = roomId;
      const start = seedTile(walkable);
      tileRef.current = start;
      fromRef.current = start;
      toRef.current = null;
      progressRef.current = 0;
      phaseRef.current = { kind: "idle", until: performance.now() + 800, anim: "idle_sit" };
      setTick((n) => n + 1);
      return;
    }
    if (!onWalkable) {
      const next = nearestWalkable(current, walkable);
      if (next) {
        tileRef.current = next;
        fromRef.current = next;
        toRef.current = null;
        progressRef.current = 0;
        phaseRef.current = { kind: "idle", until: performance.now() + 600, anim: "idle_sit" };
        setTick((n) => n + 1);
      }
    }
  }, [floor, itemsById, roomId]);

  useEffect(() => {
    if (mode === "edit") {
      // freeze in place
      phaseRef.current = {
        kind: "idle",
        until: Number.POSITIVE_INFINITY,
        anim: phaseRef.current.kind === "idle" ? phaseRef.current.anim : "idle_sit",
      };
      toRef.current = null;
      progressRef.current = 0;
      setTick((n) => n + 1);
    } else if (phaseRef.current.kind === "idle" && !Number.isFinite(phaseRef.current.until)) {
      phaseRef.current = { kind: "idle", until: performance.now() + 400, anim: "idle_sit" };
    }
  }, [mode]);

  useEffect(() => {
    if (!active || !sheet) return;
    let raf = 0;
    const loop = (ts: number) => {
      const last = lastTsRef.current || ts;
      const dt = Math.min(48, ts - last);
      lastTsRef.current = ts;
      animElapsedRef.current += dt;

      const walkable = walkableTiles(floor, itemsById);
      const phase = phaseRef.current;

      if (mode === "edit" || reduce) {
        if (phase.kind !== "idle" || phase.anim !== "idle_sit") {
          phaseRef.current = { kind: "idle", until: Number.POSITIVE_INFINITY, anim: "idle_sit" };
          toRef.current = null;
          progressRef.current = 0;
        }
        setTick((n) => n + 1);
        raf = requestAnimationFrame(loop);
        return;
      }

      if (phase.kind === "tap") {
        if (ts >= phase.until) {
          if (phase.step === "tapped") {
            phaseRef.current = { kind: "tap", step: "happy", until: ts + 700 };
            animElapsedRef.current = 0;
          } else if (phase.step === "happy") {
            phaseRef.current = { kind: "tap", step: "wait", until: ts + 1000 };
            animElapsedRef.current = 0;
          } else {
            const idle = pickIdlePose(false);
            phaseRef.current = { kind: "idle", until: ts + Math.min(idle.durationMs, 1200), anim: idle.anim };
            animElapsedRef.current = 0;
          }
        }
      } else if (phase.kind === "walk") {
        const t = Math.min(1, (ts - phase.startedAt) / CAT_STEP_MS);
        progressRef.current = t;
        const from = phase.path[phase.index];
        const to = phase.path[phase.index + 1];
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
      } else if (phase.kind === "idle") {
        if (ts >= phase.until) {
          if (reduce || walkable.length < 2) {
            const pose = pickIdlePose(false);
            phaseRef.current = { kind: "idle", until: ts + pose.durationMs, anim: pose.anim };
            animElapsedRef.current = 0;
          } else {
            const goal = randomWalkable(walkable, tileRef.current);
            const path = goal ? findPath(tileRef.current, goal, walkable) : [];
            if (path.length >= 2) {
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
        }
      }

      setTick((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lastTsRef.current = 0;
    };
  }, [active, sheet, floor, itemsById, mode, reduce]);

  const tap = () => {
    if (mode === "edit" || reduce) return;
    const now = performance.now();
    phaseRef.current = { kind: "tap", step: "tapped", until: now + 600 };
    toRef.current = null;
    progressRef.current = 0;
    animElapsedRef.current = 0;
    setTick((n) => n + 1);
  };

  const phase = phaseRef.current;
  let anim: CatAnimName = "idle_sit";
  if (phase.kind === "walk") anim = phase.dir;
  else if (phase.kind === "tap") anim = phase.step === "wait" ? "happy" : phase.step;
  else anim = phase.anim;

  const from = fromRef.current;
  const to = toRef.current;
  const progress = to ? progressRef.current : 0;
  const a = tileCentreWorld(from.col, from.row);
  const b = to ? tileCentreWorld(to.col, to.row) : a;
  const worldX = a.x + (b.x - a.x) * progress;
  const worldY = a.y + (b.y - a.y) * progress;
  const depthTile = to && progress > 0 ? to : tileRef.current;
  const frameName = sheet ? frameFor(sheet, anim, animElapsedRef.current) : "sit";

  void tick;

  return {
    view: {
      breedId: breed.id,
      sheet,
      worldX,
      worldY,
      depthCol: depthTile.col,
      depthRow: depthTile.row,
      anim,
      frameName,
      opacity: mode === "edit" ? 0.5 : 1,
      sleeping: anim === "sleep",
      ready: Boolean(sheet),
    },
    tap,
  };
}
