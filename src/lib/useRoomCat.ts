import { useEffect, useRef, useState, type MutableRefObject } from "react";

import { track } from "./analytics";
import {
  CAT_HOP_MS,
  CAT_SEAT_CHANCE,
  easeHop,
  listCatSeats,
  loadCatSeats,
  pickCatSeat,
  rollSeatPose,
  seatHoldMs,
  type CatSeatDef,
  type CatSeatPose,
  type LiveCatSeat,
} from "./catSeats";
import { blizzardClock, saberCountedClip } from "./saberBlizzard";
import {
  CAT_STEP_MS,
  CAT_WALK_FPS,
  DEFAULT_CAT_BREED_ID,
  animDurationMs,
  clipPlayMs,
  defaultSitFrame,
  type CatAnimName,
  type CatSpriteSheet,
  type CatTile,
  type CatWalkDir,
  resolveFacedPose,
  findPath,
  largestWalkableComponent,
  loadCatSpriteSheet,
  nearestWalkable,
  pickIdlePose,
  randomWalkable,
  reachableTiles,
  tileCentreWorld,
  tileKey,
  walkDirOf,
  walkableTiles,
} from "./roomCat";
import { loadRoomCats, type RoomCatTapAction } from "./roomCats";
import { footprintTiles, itemSize } from "./roomLayout";
import type { RoomSetCue } from "./roomSets";
import type { FloorPlacement, RoomItem, RoomMode, WallPlacement } from "./roomTypes";

const TAP_ACTION_FPS = 8;
const TAP_ACTION_HOLD_MS = 500;
const TAP_BUBBLE_MS = 1200;
const TAP_COOLDOWN_MS = 4000;
/** Short lines drawn above the Siamese while its meow clip plays. */
const MEOW_LINES = ["냥~", "야옹!", "냐아앙"] as const;
const MEOW_BUBBLE_MS = 1500;

export type RoomCatMotion = {
  worldX: number;
  worldY: number;
  frameName: string;
  anim: CatAnimName | "tap_action";
  /** Mirror the frame around the foot anchor. `_r` clips stay unflipped. */
  flip: boolean;
  opacity: number;
  bubbleOn: boolean;
  bubbleText: string;
  bubbleEmoji: string;
  /** Draw the line in the room, outside the island mask, so it is not clipped. */
  bubbleRoom: boolean;
  /** App-drawn meditate cloud, aura, or sabertooth blizzard. Empty unless that clip is playing. */
  fx: "" | "meditate" | "aura" | "blizzard";
  /** Milliseconds into the current effect clip, from the first frame. */
  fxMs: number;
  /** Blizzard strength, 0 outside that effect. Fades particle count and alpha. */
  fxK: number;
  /** Hide the sprite and its ground shadow. Used while blizzard snow fades in. */
  spriteHidden: boolean;
  /** Cheese window pose. Empty uses the sprite sheet. */
  pose: "" | "sit_look";
  /** Code-drawn Zzz while curled up on a seat. */
  zzz: boolean;
  /** Reserved furniture seat, empty when the cat is on the floor. */
  seatId: string;
};

export type RoomCatView = {
  breedId: string;
  sheet: CatSpriteSheet | null;
  depthCol: number;
  depthRow: number;
  sleeping: boolean;
  ready: boolean;
  opacity: number;
  /** Happy clip length. 1 keeps the CSS breathe; 2 or more plays the sheet frames alone. */
  happyFrames: number;
};

export type CatMotionRef = MutableRefObject<RoomCatMotion> & {
  subscribe: (fn: () => void) => () => void;
};

type WalkSeat = {
  id: string;
  placeKey: string;
  footX: number;
  footY: number;
  approach: CatTile;
  pose: CatSeatPose;
  facing: CatWalkDir | null;
};

type WalkPhase = {
  kind: "walk";
  path: CatTile[];
  index: number;
  startedAt: number;
  dir: CatWalkDir;
  seat: WalkSeat | null;
};

type PerchPhase = {
  kind: "perch";
  seatId: string;
  placeKey: string;
  hop: "up" | "hold" | "down";
  startedAt: number;
  until: number;
  pose: CatSeatPose;
  anim: CatAnimName;
  footX: number;
  footY: number;
};

type Phase =
  | { kind: "idle"; until: number; anim: CatAnimName }
  | WalkPhase
  | PerchPhase
  | { kind: "tap"; step: "tapped" | "special" | "happy" | "wait"; until: number; cooldown?: boolean }
  | { kind: "blizzard"; startedAt: number }
  | {
      kind: "action";
      frames: string[];
      fps: number;
      startedAt: number;
      until: number;
      resume: WalkPhase | null;
      walkElapsed: number;
    };

export type CatSpot = { tile: CatTile; goal: CatTile | null; seatId: string | null };

export type CatSpotsRef = MutableRefObject<Map<string, CatSpot>>;

type UseRoomCatArgs = {
  roomId: string;
  breedId: string | null;
  floor: FloorPlacement[];
  walls?: WallPlacement[];
  itemsById: Map<string, RoomItem>;
  mode: RoomMode;
  active: boolean;
  reducedMotion: boolean;
  /** prefers-reduced-motion: tap actions show the bubble and skip frame changes. */
  reducedTapMotion?: boolean;
  /** Shared tiles so cats in the same room do not start or aim at the same cell. */
  spotsRef?: CatSpotsRef;
  /** 0-based order in the room. Picks a different start tile. */
  slot?: number;
  /** Theme set bonus for the cat in slot 0. Null unless this room's set is complete. */
  setBonus?: RoomSetCue | null;
  /** Rotating lines when this cat is the favorite and affection is high enough. */
  favoriteLines?: string[];
  /** Extra weight for one seat, used so the favorite rests on the heart bed. */
  seatBias?: { itemId: string; mul: number } | null;
  /** Fired after a real tap pose, not a cooldown replay. */
  onPet?: () => void;
};

const SEED_PREFS: CatTile[] = [
  { col: 4, row: 5 },
  { col: 3, row: 4 },
  { col: 5, row: 6 },
  { col: 2, row: 3 },
  { col: 6, row: 5 },
  { col: 1, row: 2 },
];

function spriteFileForBreed(catId: string): string | undefined {
  if (!catId || catId === DEFAULT_CAT_BREED_ID) return undefined;
  return `cat-sprite-${catId}.webp`;
}

function occupiedTiles(spots: Map<string, CatSpot> | undefined, selfId: string): Set<string> {
  const occupied = new Set<string>();
  if (!spots) return occupied;
  for (const [id, spot] of spots) {
    if (id === selfId) continue;
    occupied.add(tileKey(spot.tile));
  }
  return occupied;
}

function blockedGoals(spots: Map<string, CatSpot> | undefined, selfId: string): Set<string> {
  const blocked = new Set<string>();
  if (!spots) return blocked;
  for (const [id, spot] of spots) {
    if (id === selfId) continue;
    blocked.add(tileKey(spot.tile));
    if (spot.goal) blocked.add(tileKey(spot.goal));
  }
  return blocked;
}

function takenSeatIds(spots: Map<string, CatSpot> | undefined, selfId: string): Set<string> {
  const taken = new Set<string>();
  if (!spots) return taken;
  for (const [id, spot] of spots) {
    if (id === selfId || !spot.seatId) continue;
    taken.add(spot.seatId);
  }
  return taken;
}

function animForSeat(pose: CatSeatPose): CatAnimName {
  if (pose === "sleep") return "sleep";
  if (pose === "loaf") return "loaf";
  if (pose === "sit_look") return "sit_look";
  return "idle_sit";
}

function walkSeatOf(seat: LiveCatSeat, pose: CatSeatPose): WalkSeat {
  return {
    id: seat.id,
    placeKey: seat.placeKey,
    footX: seat.footX,
    footY: seat.footY,
    approach: seat.approach,
    pose,
    facing: seat.facing,
  };
}

function frameFor(sheet: CatSpriteSheet, anim: CatAnimName, elapsedMs: number): string {
  const sit = defaultSitFrame(sheet);
  const idle = anim.endsWith("_r") && sheet.animations.idle_sit_r ? sheet.animations.idle_sit_r : sheet.animations.idle_sit;
  const def = sheet.animations[anim] ?? idle;
  const frames = def?.frames?.length ? def.frames : idle === sheet.animations.idle_sit_r ? ["sit_r"] : [sit];
  if (frames.length <= 1) return frames[0] ?? sit;
  const fps = def && def.fps > 0 ? def.fps : CAT_WALK_FPS;
  const raw = Math.floor((elapsedMs / 1000) * fps);
  const idx = def?.loop === true ? raw % frames.length : Math.min(raw, frames.length - 1);
  return frames[idx] ?? frames[0] ?? sit;
}

function actionFrame(frames: string[], fps: number, elapsedMs: number): string {
  const raw = Math.floor((elapsedMs / 1000) * fps);
  const idx = Math.min(Math.max(0, raw), frames.length - 1);
  return frames[idx] ?? frames[frames.length - 1] ?? "sit";
}

function seedTile(walkable: CatTile[], slot: number, occupied: Set<string>): CatTile {
  const region = largestWalkableComponent(walkable);
  const prefs = SEED_PREFS.map((_, index) => SEED_PREFS[(slot + index) % SEED_PREFS.length]);
  for (const pool of [region, walkable]) {
    for (const pref of prefs) {
      const found = pool.find(
        (tile) => tile.col === pref.col && tile.row === pref.row && !occupied.has(tileKey(tile)),
      );
      if (found) return found;
    }
    const free = pool.find((tile) => !occupied.has(tileKey(tile)));
    if (free) return free;
  }
  return region[Math.floor(region.length / 2)] ?? walkable[0] ?? { col: 4, row: 5 };
}

const SET_HOLD_MS = 7200;
const SET_BUBBLE_MS = 3400;

/** A walkable tile in front of the anchor furniture, if it is placed. */
function setApproachTile(
  anchorId: string,
  floor: FloorPlacement[],
  items: Map<string, RoomItem>,
  walkable: CatTile[],
  occupied: Set<string>,
): CatTile | null {
  if (!anchorId) return null;
  const place = floor.find((row) => row.id === anchorId);
  if (!place) return null;
  const item = items.get(place.id);
  if (!item) return null;
  const [w, d] = itemSize(item, place.orientation);
  const tiles = footprintTiles(place.col, place.row, w, d);
  const covered = new Set(tiles.map((tile) => tileKey(tile)));
  const neighbors: CatTile[] = [];
  const seen = new Set<string>();
  for (const tile of tiles) {
    const { col, row } = tile;
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ] as const) {
      const next = { col: col + dc, row: row + dr };
      const nextKey = tileKey(next);
      if (seen.has(nextKey) || covered.has(nextKey) || occupied.has(nextKey)) continue;
      if (!walkable.some((tile) => tile.col === next.col && tile.row === next.row)) continue;
      seen.add(nextKey);
      neighbors.push(next);
    }
  }
  neighbors.sort((a, b) => b.row + b.col - (a.row + a.col));
  return neighbors[0] ?? null;
}

function nearestFree(from: CatTile, walkable: CatTile[], occupied: Set<string>): CatTile | null {
  const free = walkable.filter((tile) => !occupied.has(tileKey(tile)));
  return nearestWalkable(from, free.length ? free : walkable);
}

function pickWalkPath(from: CatTile, walkable: CatTile[], blocked: Set<string>): CatTile[] | null {
  const reachable = reachableTiles(from, walkable);
  if (reachable.length < 2) return null;
  const tryGoal = (goal: CatTile | null) => {
    if (!goal || (goal.col === from.col && goal.row === from.row)) return null;
    if (blocked.has(tileKey(goal))) return null;
    const path = findPath(from, goal, reachable);
    return path.length >= 2 ? path : null;
  };
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const path = tryGoal(randomWalkable(reachable, from));
    if (path) return path;
  }
  for (const tile of reachable) {
    const path = tryGoal(tile);
    if (path) return path;
  }
  const other = reachable.find((tile) => tile.col !== from.col || tile.row !== from.row);
  if (!other) return null;
  const path = findPath(from, other, reachable);
  return path.length >= 2 ? path : null;
}

function placeMotion(
  motion: RoomCatMotion,
  tile: CatTile,
  sheet: CatSpriteSheet | null,
  anim: CatAnimName = "idle_sit",
) {
  const centre = tileCentreWorld(tile.col, tile.row);
  motion.worldX = centre.x;
  motion.worldY = centre.y;
  motion.frameName =
    anim === "idle_sit" ? (sheet ? defaultSitFrame(sheet) : "sit") : anim === "idle_sit_r" ? "sit_r" : motion.frameName;
  motion.anim = anim;
}

export function useRoomCat({
  roomId,
  breedId,
  floor,
  walls = [],
  itemsById,
  mode,
  active,
  reducedMotion,
  reducedTapMotion = false,
  spotsRef,
  slot = 0,
  setBonus = null,
  favoriteLines = [],
  seatBias = null,
  onPet,
}: UseRoomCatArgs): {
  view: RoomCatView;
  motionRef: CatMotionRef;
  tap: () => void;
} {
  const listenersRef = useRef(new Set<() => void>());
  const motionRef = useRef<CatMotionRef | null>(null);
  if (!motionRef.current) {
    const motion: RoomCatMotion = {
      worldX: 0,
      worldY: 0,
      frameName: "sit",
      anim: "idle_sit",
      flip: false,
      opacity: 1,
      bubbleOn: false,
      bubbleText: "",
      bubbleEmoji: "",
      bubbleRoom: false,
      fx: "",
      fxMs: 0,
      fxK: 0,
      spriteHidden: false,
      pose: "",
      zzz: false,
      seatId: "",
    };
    const ref = {
      current: motion,
      subscribe(fn: () => void) {
        listenersRef.current.add(fn);
        return () => {
          listenersRef.current.delete(fn);
        };
      },
    } as CatMotionRef;
    motionRef.current = ref;
  }
  const catMotion = motionRef.current;

  const [view, setView] = useState<RoomCatView>({
    breedId: breedId || "cheese",
    sheet: null,
    depthCol: 4,
    depthRow: 5,
    sleeping: false,
    ready: false,
    opacity: 1,
    happyFrames: 1,
  });

  const phaseRef = useRef<Phase>({ kind: "idle", until: 0, anim: "idle_sit" });
  const facingRef = useRef<CatWalkDir>("walk_dl");
  const tileRef = useRef<CatTile>({ col: 4, row: 5 });
  const fromRef = useRef<CatTile>({ col: 4, row: 5 });
  const toRef = useRef<CatTile | null>(null);
  const progressRef = useRef(0);
  const animElapsedRef = useRef(0);
  const lastTsRef = useRef(0);
  const seededRef = useRef("");
  const floorRef = useRef(floor);
  const wallsRef = useRef(walls);
  const itemsRef = useRef(itemsById);
  const seatsDefRef = useRef<CatSeatDef[]>([]);
  const seatIdRef = useRef<string | null>(null);
  const lastSeatRef = useRef("");
  const modeRef = useRef(mode);
  const activeRef = useRef(active);
  const reduceRef = useRef(reducedMotion);
  const roomIdRef = useRef(roomId);
  const sheetRef = useRef<CatSpriteSheet | null>(null);
  const tapActionRef = useRef<RoomCatTapAction | null>(null);
  const catIdRef = useRef(breedId || "cheese");
  const lastActionAtRef = useRef(0);
  const saberTapRef = useRef(0);
  const bubbleUntilRef = useRef(0);
  const reduceTapRef = useRef(reducedTapMotion);
  const depthRef = useRef({ col: 4, row: 5 });
  const sleepRef = useRef(false);
  const opacityRef = useRef(1);
  const slotRef = useRef(slot);
  slotRef.current = slot;
  const bonusRef = useRef<RoomSetCue | null>(setBonus);
  bonusRef.current = setBonus;
  const favoriteLinesRef = useRef(favoriteLines);
  favoriteLinesRef.current = favoriteLines;
  const seatBiasRef = useRef(seatBias);
  seatBiasRef.current = seatBias;
  const onPetRef = useRef(onPet);
  onPetRef.current = onPet;
  const petLineRef = useRef(0);
  catIdRef.current = breedId || "cheese";
  if (spotsRef && !spotsRef.current.has(catIdRef.current)) {
    const walkableNow = walkableTiles(floor, itemsById);
    if (walkableNow.length) {
      const startNow = seedTile(walkableNow, slot, occupiedTiles(spotsRef.current, catIdRef.current));
      spotsRef.current.set(catIdRef.current, { tile: startNow, goal: null, seatId: null });
      tileRef.current = startNow;
      fromRef.current = startNow;
      depthRef.current = { col: startNow.col, row: startNow.row };
    }
  }

  floorRef.current = floor;
  wallsRef.current = walls;
  itemsRef.current = itemsById;
  modeRef.current = mode;
  activeRef.current = active;
  reduceRef.current = reducedMotion;
  reduceTapRef.current = reducedTapMotion;
  roomIdRef.current = roomId;

  useEffect(() => {
    let cancelled = false;
    const catId = breedId || "cheese";
    catIdRef.current = catId;
    phaseRef.current = { kind: "idle", until: performance.now() + 200, anim: "idle_sit" };
    facingRef.current = "walk_dl";
    animElapsedRef.current = 0;
    lastActionAtRef.current = 0;
    bubbleUntilRef.current = 0;
    catMotion.current.bubbleOn = false;
    catMotion.current.bubbleRoom = false;
    void loadRoomCats().then((cats) => {
      if (cancelled) return;
      const entry = cats.find((cat) => cat.id === catId) ?? null;
      tapActionRef.current = entry?.tapAction ?? null;
      void loadCatSpriteSheet(spriteFileForBreed(catId)).then((loaded) => {
        if (cancelled) return;
        sheetRef.current = loaded;
        const happyFrames = Math.max(
          loaded.animations.happy?.frames.length ?? 1,
          loaded.animations.happy_r?.frames.length ?? 1,
        );
        setView((prev) => ({
          ...prev,
          sheet: loaded,
          ready: true,
          breedId: entry?.id ?? catId,
          happyFrames,
        }));
      });
    });
    return () => {
      cancelled = true;
    };
  }, [breedId, catMotion]);

  useEffect(() => {
    let cancelled = false;
    void loadCatSeats().then((defs) => {
      if (!cancelled) seatsDefRef.current = defs;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const walkable = walkableTiles(floor, itemsById);
    if (!walkable.length) return;
    const current = tileRef.current;
    const region = largestWalkableComponent(walkable);
    const onRegion = region.some((tile) => tile.col === current.col && tile.row === current.row);
    const needSeed = seededRef.current !== roomId;
    // Re-home when the cat is stranded on an isolated walkable tile.
    if (!needSeed && onRegion && reachableTiles(current, walkable).length >= 2) return;

    const occupied = occupiedTiles(spotsRef?.current, catIdRef.current);
    const start = needSeed
      ? seedTile(walkable, slotRef.current, occupied)
      : (nearestFree(current, region, occupied) ?? seedTile(walkable, slotRef.current, occupied));
    seededRef.current = roomId;
    tileRef.current = start;
    fromRef.current = start;
    toRef.current = null;
    progressRef.current = 0;
    depthRef.current = { col: start.col, row: start.row };
    seatIdRef.current = null;
    spotsRef?.current.set(catIdRef.current, { tile: start, goal: null, seatId: null });
    placeMotion(catMotion.current, start, sheetRef.current, "idle_sit");
    // Start walking almost immediately so a cold browser load looks alive.
    phaseRef.current = { kind: "idle", until: performance.now() + (needSeed ? 200 : 80), anim: "idle_sit" };
    setView((prev) => ({ ...prev, depthCol: start.col, depthRow: start.row }));
    for (const listener of listenersRef.current) listener();
  }, [floor, itemsById, roomId, catMotion, spotsRef]);

  useEffect(() => {
    if (mode === "edit") {
      const phase = phaseRef.current;
      if (phase.kind === "perch" && phase.hop === "hold") {
        phaseRef.current = { ...phase, until: Number.POSITIVE_INFINITY };
      } else {
        seatIdRef.current = null;
        phaseRef.current = {
          kind: "idle",
          until: Number.POSITIVE_INFINITY,
          anim: "idle_sit",
        };
        toRef.current = null;
        progressRef.current = 0;
      }
      bubbleUntilRef.current = 0;
      catMotion.current.bubbleOn = false;
      catMotion.current.bubbleRoom = false;
      catMotion.current.opacity = 0.5;
      setView((prev) => ({ ...prev, opacity: 0.5 }));
      for (const listener of listenersRef.current) listener();
      return;
    }
    catMotion.current.opacity = 1;
    setView((prev) => ({ ...prev, opacity: 1 }));
    const phase = phaseRef.current;
    if (phase.kind === "perch" && !Number.isFinite(phase.until)) {
      phaseRef.current = { ...phase, until: performance.now() + 4000 };
    } else if (phase.kind === "idle" && !Number.isFinite(phase.until)) {
      phaseRef.current = { kind: "idle", until: performance.now() + 200, anim: "idle_sit" };
    }
    for (const listener of listenersRef.current) listener();
  }, [mode, catMotion]);

  useEffect(() => {
    let raf = 0;
    let alive = true;
    const listeners = listenersRef.current;

    const notify = () => {
      for (const listener of listeners) listener();
    };

    const publishSpot = (goal: CatTile | null) => {
      spotsRef?.current.set(catIdRef.current, {
        tile: tileRef.current,
        goal,
        seatId: seatIdRef.current,
      });
    };

    const beginWalk = (path: CatTile[], ts: number, seat: WalkSeat | null = null) => {
      phaseRef.current = {
        kind: "walk",
        path,
        index: 0,
        startedAt: ts,
        dir: walkDirOf(path[0], path[1]),
        seat,
      };
      fromRef.current = path[0];
      toRef.current = path[1];
      progressRef.current = 0;
      animElapsedRef.current = 0;
      publishSpot(path[path.length - 1] ?? null);
    };

    const seatContext = (from: CatTile | null) => ({
      defs: seatsDefRef.current,
      floor: floorRef.current,
      walls: wallsRef.current,
      items: itemsRef.current,
      walkable: walkableTiles(floorRef.current, itemsRef.current),
      blocked: blockedGoals(spotsRef?.current, catIdRef.current),
      takenSeatIds: takenSeatIds(spotsRef?.current, catIdRef.current),
      from,
    });

    const beginPerch = (seat: WalkSeat, ts: number) => {
      if (seat.facing) facingRef.current = seat.facing;
      seatIdRef.current = seat.id;
      tileRef.current = seat.approach;
      fromRef.current = seat.approach;
      toRef.current = null;
      progressRef.current = 0;
      phaseRef.current = {
        kind: "perch",
        seatId: seat.id,
        placeKey: seat.placeKey,
        hop: "up",
        startedAt: ts,
        until: 0,
        pose: seat.pose,
        anim: "idle_sit",
        footX: seat.footX,
        footY: seat.footY,
      };
      animElapsedRef.current = 0;
      publishSpot(null);
    };

    const dropToFloor = (ts: number, stay: boolean) => {
      seatIdRef.current = null;
      const walkableNow = walkableTiles(floorRef.current, itemsRef.current);
      const occupied = occupiedTiles(spotsRef?.current, catIdRef.current);
      const here = tileRef.current;
      const hereOk =
        walkableNow.some((tile) => tile.col === here.col && tile.row === here.row) && !occupied.has(tileKey(here));
      const tile = hereOk ? here : (nearestFree(here, walkableNow, occupied) ?? here);
      tileRef.current = tile;
      fromRef.current = tile;
      toRef.current = null;
      progressRef.current = 0;
      phaseRef.current = {
        kind: "idle",
        until: stay ? Number.POSITIVE_INFINITY : ts + 400,
        anim: "idle_sit",
      };
      animElapsedRef.current = 0;
      publishSpot(null);
    };

    const seatStillThere = (seatId: string, placeKey: string) =>
      listCatSeats(seatContext(null)).some((seat) => seat.id === seatId && seat.placeKey === placeKey);

    const loop = (ts: number) => {
      if (!alive) return;
      const sheet = sheetRef.current;
      if (!sheet) {
        raf = requestAnimationFrame(loop);
        return;
      }
      const phaseGoal =
        phaseRef.current.kind === "walk" ? (phaseRef.current.path[phaseRef.current.path.length - 1] ?? null) : null;
      publishSpot(phaseGoal);

      const last = lastTsRef.current || ts;
      const dt = Math.min(64, ts - last);
      lastTsRef.current = ts;
      const phaseNow = phaseRef.current;
      if (!(phaseNow.kind === "action" && phaseNow.frames.length > 0)) {
        animElapsedRef.current += dt;
      }

      const walkable = walkableTiles(floorRef.current, itemsRef.current);
      const phase = phaseRef.current;
      const reduce = reduceRef.current;
      const isEdit = modeRef.current === "edit";
      const isActive = activeRef.current;
      const bonusNow = slotRef.current === 0 ? bonusRef.current : null;
      const motionEarly = catMotion.current;
      const startSetPose = (pose: RoomSetCue["pose"], bubble: string) => {
        phaseRef.current = { kind: "idle", until: ts + SET_HOLD_MS, anim: pose };
        animElapsedRef.current = 0;
        seatIdRef.current = null;
        if (!bubble) return;
        bubbleUntilRef.current = ts + SET_BUBBLE_MS;
        motionEarly.bubbleOn = true;
        motionEarly.bubbleText = bubble;
        motionEarly.bubbleEmoji = "";
        motionEarly.bubbleRoom = true;
      };
      if (
        bonusNow &&
        isActive &&
        !isEdit &&
        !reduce &&
        phase.kind === "idle" &&
        phase.anim !== bonusNow.pose &&
        phase.until > ts
      ) {
        phase.until = ts;
      }
      if (bubbleUntilRef.current && ts >= bubbleUntilRef.current) {
        bubbleUntilRef.current = 0;
        motionEarly.bubbleOn = false;
        motionEarly.bubbleRoom = false;
      }

      if (isActive && !isEdit && !reduce) {
        if (phase.kind === "action") {
          if (ts >= phase.until) {
            const resume = phase.resume;
            if (resume) {
              phaseRef.current = { ...resume, startedAt: ts - phase.walkElapsed };
            } else {
              phaseRef.current = { kind: "idle", until: ts + 200, anim: "idle_sit" };
              animElapsedRef.current = 0;
            }
          }
        } else if (phase.kind === "blizzard") {
          const playMs = clipPlayMs(sheet.animations.blizzard);
          if (blizzardClock(ts - phase.startedAt, playMs).stage === "done") {
            phaseRef.current = { kind: "idle", until: ts + 200, anim: "idle_sit" };
            animElapsedRef.current = 0;
          }
        } else if (phase.kind === "tap") {
          if (ts >= phase.until) {
            if (phase.step === "tapped") {
              if (phase.cooldown) {
                phaseRef.current = { kind: "idle", until: ts + 200, anim: "idle_sit" };
                animElapsedRef.current = 0;
              } else {
                const special = sheet.special?.tap;
                if (special && sheet.animations[special]) {
                  phaseRef.current = {
                    kind: "tap",
                    step: "special",
                    until: ts + animDurationMs(sheet.animations[special]),
                  };
                  if (special === "meow") {
                    const text = MEOW_LINES[Math.floor(Math.random() * MEOW_LINES.length)] ?? "야옹!";
                    bubbleUntilRef.current = ts + MEOW_BUBBLE_MS;
                    motionEarly.bubbleOn = true;
                    motionEarly.bubbleText = text;
                    motionEarly.bubbleEmoji = "";
                    motionEarly.bubbleRoom = true;
                  }
                } else {
                  const happyClip = resolveFacedPose(sheet, "happy", facingRef.current);
                  phaseRef.current = {
                    kind: "tap",
                    step: "happy",
                    until: ts + animDurationMs(sheet.animations[happyClip.anim] ?? sheet.animations.happy),
                  };
                }
                animElapsedRef.current = 0;
              }
            } else if (phase.step === "happy" || phase.step === "special") {
              phaseRef.current = { kind: "tap", step: "wait", until: ts + 1000 };
              animElapsedRef.current = 0;
            } else {
              phaseRef.current = { kind: "idle", until: ts + 200, anim: "idle_sit" };
              animElapsedRef.current = 0;
            }
          }
        } else if (phase.kind === "walk") {
          const from = phase.path[phase.index];
          const to = phase.path[phase.index + 1];
          if (!from || !to) {
            seatIdRef.current = null;
            phaseRef.current = { kind: "idle", until: ts + 200, anim: "idle_sit" };
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
                const seat = phase.seat;
                if (seat && seatStillThere(seat.id, seat.placeKey)) {
                  beginPerch(seat, ts);
                } else if (bonusNow) {
                  startSetPose(bonusNow.pose, bonusNow.bubble);
                } else {
                  seatIdRef.current = null;
                  const pose = pickIdlePose(sheet, false, facingRef.current);
                  phaseRef.current = { kind: "idle", until: ts + pose.durationMs, anim: pose.anim };
                  animElapsedRef.current = 0;
                }
              } else {
                const nextFrom = phase.path[nextIndex];
                const nextTo = phase.path[nextIndex + 1];
                phaseRef.current = {
                  kind: "walk",
                  path: phase.path,
                  index: nextIndex,
                  startedAt: ts,
                  dir: walkDirOf(nextFrom, nextTo),
                  seat: phase.seat,
                };
                animElapsedRef.current = 0;
              }
            }
          }
        } else if (phase.kind === "perch") {
          if (!seatStillThere(phase.seatId, phase.placeKey)) {
            dropToFloor(ts, false);
          } else if (phase.hop === "up") {
            if (ts - phase.startedAt >= CAT_HOP_MS) {
              phaseRef.current = {
                ...phase,
                hop: "hold",
                startedAt: ts,
                until: ts + seatHoldMs(phase.pose, Math.random),
                anim: animForSeat(phase.pose),
              };
              animElapsedRef.current = 0;
            }
          } else if (phase.hop === "hold") {
            if (ts >= phase.until) {
              phaseRef.current = { ...phase, hop: "down", startedAt: ts, anim: "idle_sit" };
              animElapsedRef.current = 0;
            }
          } else if (ts - phase.startedAt >= CAT_HOP_MS) {
            lastSeatRef.current = phase.seatId;
            dropToFloor(ts, false);
          }
        } else if (phase.kind === "idle" && ts >= phase.until && bonusNow) {
          const goal = setApproachTile(
            bonusNow.anchorId,
            floorRef.current,
            itemsRef.current,
            walkable,
            occupiedTiles(spotsRef?.current, catIdRef.current),
          );
          const here = tileRef.current;
          if (goal && (goal.col !== here.col || goal.row !== here.row)) {
            const path = findPath(here, goal, walkable);
            if (path.length >= 2) {
              seatIdRef.current = null;
              beginWalk(path, ts, null);
            } else {
              startSetPose(bonusNow.pose, bonusNow.bubble);
            }
          } else {
            startSetPose(bonusNow.pose, bonusNow.bubble);
          }
        } else if (phase.kind === "idle" && ts >= phase.until) {
          const blocked = blockedGoals(spotsRef?.current, catIdRef.current);
          let claimedSeat = false;
          if (Math.random() < CAT_SEAT_CHANCE && seatsDefRef.current.length) {
            const offers = listCatSeats(seatContext(tileRef.current)).filter(
              (seat) => seat.id !== lastSeatRef.current,
            );
            const bias = seatBiasRef.current;
            const weighted =
              bias && bias.mul > 1
                ? offers.map((seat) =>
                    seat.itemId === bias.itemId ? { ...seat, weight: seat.weight * bias.mul } : seat,
                  )
                : offers;
            const picked = pickCatSeat(weighted, Math.random);
            if (picked) {
              const pose = rollSeatPose(picked.pose, Math.random);
              const seat = walkSeatOf(picked, pose);
              if (tileRef.current.col === seat.approach.col && tileRef.current.row === seat.approach.row) {
                beginPerch(seat, ts);
                claimedSeat = true;
              } else {
                const path = findPath(tileRef.current, seat.approach, walkable);
                if (path.length >= 2) {
                  seatIdRef.current = seat.id;
                  beginWalk(path, ts, seat);
                  claimedSeat = true;
                }
              }
            }
          }
          if (!claimedSeat) {
            lastSeatRef.current = "";
            let path = pickWalkPath(tileRef.current, walkable, blocked);
            if (!path) {
              // Stranded on a 1-tile island — hop to the main walkable region.
              const home = seedTile(
                walkable,
                slotRef.current,
                occupiedTiles(spotsRef?.current, catIdRef.current),
              );
              if (home.col !== tileRef.current.col || home.row !== tileRef.current.row) {
                tileRef.current = home;
                fromRef.current = home;
                toRef.current = null;
                progressRef.current = 0;
                publishSpot(null);
                placeMotion(catMotion.current, home, sheet, "idle_sit");
                path = pickWalkPath(home, walkable, blockedGoals(spotsRef?.current, catIdRef.current));
              }
            }
            if (path) {
              seatIdRef.current = null;
              beginWalk(path, ts, null);
            } else {
              const pose = pickIdlePose(sheet, false, facingRef.current);
              phaseRef.current = { kind: "idle", until: ts + pose.durationMs, anim: pose.anim };
              animElapsedRef.current = 0;
            }
          }
        }
      } else if (isEdit || reduce) {
        if (phase.kind === "perch" && phase.hop === "hold" && !reduce) {
          if (!seatStillThere(phase.seatId, phase.placeKey)) dropToFloor(ts, true);
          else if (Number.isFinite(phase.until)) phaseRef.current = { ...phase, until: Number.POSITIVE_INFINITY };
        } else if (phase.kind !== "idle" || seatIdRef.current || (reduce && phase.anim !== "idle_sit")) {
          dropToFloor(ts, true);
        }
      }

      const live = phaseRef.current;
      let anim: CatAnimName | "tap_action" = "idle_sit";
      let flip = false;
      let frameOverride: string | null = null;
      const facingRight = facingRef.current === "walk_dr" || facingRef.current === "walk_ur";
      if (live.kind === "walk") {
        facingRef.current = live.dir;
        const faced = resolveFacedPose(sheet, live.dir, live.dir);
        anim = faced.anim as CatAnimName;
        flip = faced.flip;
      } else if (live.kind === "blizzard") {
        const clip = sheet.animations.blizzard;
        if (clip) {
          const clock = blizzardClock(ts - live.startedAt, clipPlayMs(clip));
          const faced = resolveFacedPose(sheet, "blizzard", facingRef.current);
          anim = faced.anim as CatAnimName;
          flip = faced.flip;
          const frames = sheet.animations[faced.anim]?.frames ?? clip.frames;
          frameOverride = frameFor(sheet, faced.anim as CatAnimName, clock.localMs) || frames[frames.length - 1] || null;
          if (clock.stage === "hold" || clock.stage === "out") {
            frameOverride = frames[frames.length - 1] ?? frameOverride;
          }
        } else {
          const faced = resolveFacedPose(sheet, "idle_sit", facingRef.current);
          anim = faced.anim as CatAnimName;
          flip = faced.flip;
        }
      } else if (live.kind === "tap") {
        const special = sheet.special?.tap;
        const specialOk = Boolean(special && sheet.animations[special]);
        const pose =
          live.step === "special" || live.step === "wait" ? (specialOk ? special! : "happy") : live.step;
        const faced = resolveFacedPose(sheet, pose, facingRef.current);
        anim = faced.anim as CatAnimName;
        flip = faced.flip;
        if (live.step === "wait" && specialOk && special) {
          const hold = sheet.animations[faced.anim] ?? sheet.animations[special];
          frameOverride = hold.frames[hold.frames.length - 1] ?? null;
        }
      } else if (live.kind === "action") {
        if (live.frames.length) {
          anim = "tap_action";
          frameOverride = actionFrame(live.frames, live.fps, ts - live.startedAt);
          const hasRightFrame = live.frames.some((name) => Boolean(sheet.frames[`${name}_r`]));
          flip = facingRight && !hasRightFrame;
        } else {
          frameOverride = catMotion.current.frameName;
          anim = catMotion.current.anim === "tap_action" ? "idle_sit" : catMotion.current.anim;
          flip = catMotion.current.flip;
        }
      } else {
        const faced = resolveFacedPose(sheet, live.anim, facingRef.current);
        anim = faced.anim as CatAnimName;
        flip = faced.flip;
      }

      const from = fromRef.current;
      const to = toRef.current;
      const progress = to ? progressRef.current : 0;
      const a = tileCentreWorld(from.col, from.row);
      const b = to ? tileCentreWorld(to.col, to.row) : a;
      const depthTile =
        live.kind === "perch" && live.hop !== "down"
          ? { col: tileRef.current.col + 1, row: tileRef.current.row }
          : to && progress > 0
            ? to
            : tileRef.current;

      // Mutate in place so subscribe identity on the ref wrapper stays stable.
      const motion = catMotion.current;
      motion.worldX = a.x + (b.x - a.x) * progress;
      motion.worldY = a.y + (b.y - a.y) * progress;
      let poseImage: "" | "sit_look" = "";
      let zzz = false;
      if (live.kind === "perch") {
        const ground = tileCentreWorld(tileRef.current.col, tileRef.current.row);
        const foot = { x: live.footX, y: live.footY };
        const hopT = live.hop === "hold" ? 1 : Math.min(1, (ts - live.startedAt) / CAT_HOP_MS);
        const u = live.hop === "hold" ? 1 : easeHop(hopT);
        if (live.hop === "down") {
          motion.worldX = foot.x + (ground.x - foot.x) * u;
          motion.worldY = foot.y + (ground.y - foot.y) * u;
        } else {
          motion.worldX = ground.x + (foot.x - ground.x) * u;
          motion.worldY = ground.y + (foot.y - ground.y) * u;
        }
        if (live.hop === "hold" && (live.pose === "sleep" || live.pose === "loaf")) zzz = true;
        if (live.hop === "hold" && live.pose === "sit_look") poseImage = "sit_look";
      } else if (live.kind === "idle" && (live.anim === "sleep" || live.anim === "sleep_r")) {
        zzz = true;
      }
      motion.frameName = frameOverride ?? frameFor(sheet, anim === "tap_action" ? "idle_sit" : anim, animElapsedRef.current);
      motion.anim = anim;
      motion.flip = flip;
      motion.pose = poseImage;
      motion.zzz = zzz;
      motion.seatId = live.kind === "perch" ? live.seatId : seatIdRef.current ?? "";
      motion.opacity = isEdit ? 0.5 : 1;
      const fxName = anim.endsWith("_r") ? anim.slice(0, -2) : anim;
      const fxOn =
        (fxName === "meditate" && live.kind === "idle") ||
        (fxName === "aura" && live.kind === "tap" && live.step === "special");
      if (live.kind === "blizzard" && sheet.animations.blizzard) {
        const clock = blizzardClock(ts - live.startedAt, clipPlayMs(sheet.animations.blizzard));
        motion.fx = "blizzard";
        motion.fxMs = ts - live.startedAt;
        motion.fxK = clock.k;
        motion.spriteHidden = clock.hideSprite;
      } else {
        motion.fx = fxOn ? fxName : "";
        motion.fxMs = fxOn ? animElapsedRef.current : 0;
        motion.fxK = 0;
        motion.spriteHidden = false;
      }
      notify();

      if (isActive) {
        const phaseKind =
          live.kind === "walk"
            ? `walk:${live.index}/${live.path.length - 1}`
            : live.kind === "perch"
              ? `perch:${live.hop}:${live.pose}`
              : live.kind === "tap"
              ? `tap:${live.step}`
              : live.kind === "blizzard"
                ? "blizzard"
                : live.kind === "action"
                ? `action:${live.frames.join(",") || "bubble"}`
                : `idle:${live.anim}`;
        const debug = {
          roomId: roomIdRef.current,
          catId: catIdRef.current,
          phase: phaseKind,
          tile: { ...tileRef.current },
          goal:
            live.kind === "walk" ? { ...(live.path[live.path.length - 1] ?? tileRef.current) } : null,
          anim,
          pose: motion.pose,
          zzz: motion.zzz,
          seatId: motion.seatId,
          fx: motion.fx,
          fxMs: Math.round(motion.fxMs),
          fxK: Math.round(motion.fxK * 100) / 100,
          spriteHidden: motion.spriteHidden,
          saberTap: saberTapRef.current,
          worldX: Math.round(motion.worldX),
          worldY: Math.round(motion.worldY),
          listeners: listeners.size,
          walkable: walkable.length,
          active: isActive,
          edit: isEdit,
          reduce,
        };
        const host = window as Window & {
          __luckyCat?: unknown;
          __luckyCats?: Record<string, unknown>;
        };
        if (!host.__luckyCats) host.__luckyCats = {};
        host.__luckyCats[catIdRef.current] = debug;
        host.__luckyCat = debug;
      }

      const nextOpacity = isEdit ? 0.5 : 1;
      const nextSleeping = anim === "sleep" || anim === "sleep_r";
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
  }, [catMotion, spotsRef]);

  useEffect(() => {
    const spots = spotsRef?.current;
    const id = breedId || "cheese";
    return () => {
      spots?.delete(id);
      const host = window as Window & { __luckyCats?: Record<string, unknown> };
      if (host.__luckyCats) delete host.__luckyCats[id];
    };
  }, [spotsRef, breedId]);

  const playTapped = (now: number) => {
    if (phaseRef.current.kind === "perch" || seatIdRef.current) {
      seatIdRef.current = null;
      toRef.current = null;
      progressRef.current = 0;
    }
    phaseRef.current = { kind: "tap", step: "tapped", until: now + 600 };
    toRef.current = null;
    progressRef.current = 0;
    animElapsedRef.current = 0;
  };

  const notePet = (now: number) => {
    onPetRef.current?.();
    const lines = favoriteLinesRef.current;
    if (!lines.length) return;
    const line = lines[petLineRef.current % lines.length] ?? "";
    petLineRef.current += 1;
    if (!line) return;
    bubbleUntilRef.current = now + TAP_BUBBLE_MS;
    catMotion.current.bubbleOn = true;
    catMotion.current.bubbleText = line;
    catMotion.current.bubbleEmoji = "";
    catMotion.current.bubbleRoom = false;
  };

  const tap = () => {
    if (modeRef.current === "edit") return;
    const now = performance.now();
    const sheet = sheetRef.current;
    const action = tapActionRef.current;
    const specialTap = sheet?.special?.tap;
    if (sheet && catIdRef.current === "sabertooth" && sheet.animations.blizzard && specialTap === "roar") {
      const phase = phaseRef.current;
      const playing =
        phase.kind === "blizzard" ||
        (phase.kind === "tap" && !phase.cooldown && (phase.step === "tapped" || phase.step === "special"));
      if (playing) return;
      const cooling = lastActionAtRef.current > 0 && now - lastActionAtRef.current < TAP_COOLDOWN_MS;
      if (cooling) {
        phaseRef.current = { kind: "tap", step: "tapped", until: now + 600, cooldown: true };
        toRef.current = null;
        progressRef.current = 0;
        animElapsedRef.current = 0;
        return;
      }
      saberTapRef.current += 1;
      lastActionAtRef.current = now;
      const clip = saberCountedClip(saberTapRef.current);
      toRef.current = null;
      progressRef.current = 0;
      animElapsedRef.current = 0;
      if (clip === "blizzard") {
        phaseRef.current = { kind: "blizzard", startedAt: now };
      } else {
        playTapped(now);
      }
      notePet(now);
      return;
    }
    if (sheet && specialTap && sheet.animations[specialTap]) {
      const cooldown = action?.cooldownMs ?? TAP_COOLDOWN_MS;
      const cooling = lastActionAtRef.current > 0 && now - lastActionAtRef.current < cooldown;
      if (action && !cooling) {
        lastActionAtRef.current = now;
        track("room_cat_tap", { cat_id: catIdRef.current, action_id: action.id });
        const text = action.bubble ?? "";
        const emoji = action.emoji ?? "";
        const showBubble = Boolean(text || emoji);
        bubbleUntilRef.current = showBubble ? now + TAP_BUBBLE_MS : 0;
        catMotion.current.bubbleOn = showBubble;
        catMotion.current.bubbleText = text;
        catMotion.current.bubbleEmoji = emoji;
        catMotion.current.bubbleRoom = false;
      }
      if (specialTap === "meow") {
        bubbleUntilRef.current = 0;
        catMotion.current.bubbleOn = false;
        catMotion.current.bubbleRoom = false;
      }
      playTapped(now);
      if (!cooling) notePet(now);
      return;
    }
    const framesOk = Boolean(action && sheet && action.frames.every((name) => sheet.frames[name]));
    const cooldown = action?.cooldownMs ?? TAP_COOLDOWN_MS;
    const cooling = lastActionAtRef.current > 0 && now - lastActionAtRef.current < cooldown;
    if (!action || !framesOk || cooling || !sheet) {
      playTapped(now);
      if (!cooling) notePet(now);
      return;
    }
    lastActionAtRef.current = now;
    track("room_cat_tap", { cat_id: catIdRef.current, action_id: action.id });
    const fps = action.fps && action.fps > 0 ? action.fps : TAP_ACTION_FPS;
    const phase = phaseRef.current;
    const resume = phase.kind === "walk" ? phase : null;
    const walkElapsed = resume ? Math.max(0, now - resume.startedAt) : 0;
    const text = action.bubble ?? "";
    const emoji = action.emoji ?? "";
    const showBubble = Boolean(text || emoji);
    const motionless = reduceTapRef.current;
    const frameMs = (action.frames.length / fps) * 1000 + TAP_ACTION_HOLD_MS;
    const animMs = motionless ? TAP_BUBBLE_MS : Math.max(frameMs, showBubble ? TAP_BUBBLE_MS : 0);
    phaseRef.current = {
      kind: "action",
      frames: motionless ? [] : action.frames,
      fps,
      startedAt: now,
      until: now + animMs,
      resume,
      walkElapsed,
    };
    animElapsedRef.current = 0;
    bubbleUntilRef.current = showBubble ? now + TAP_BUBBLE_MS : 0;
    catMotion.current.bubbleOn = showBubble;
    catMotion.current.bubbleText = text;
    catMotion.current.bubbleEmoji = emoji;
    catMotion.current.bubbleRoom = false;
    notePet(now);
  };

  return { view, motionRef: catMotion, tap };
}
