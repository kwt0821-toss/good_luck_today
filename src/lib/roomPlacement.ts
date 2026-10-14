import { loadOpsConfig } from "./opsConfig";
import { isPaintItem } from "./roomCatalog";
import {
  canPlace,
  canPlaceWall,
  firstFreeOnWall,
  firstFreeTile,
  GRID,
  isDecal,
  itemSize,
  occupancy,
  resolveSuggestTile,
  wallOccupancy,
  wallPlaceFromSlot,
} from "./roomLayout";
import { applyPaint } from "./roomTiles";
import {
  newInstanceId,
  placedCountAll,
  patchCurrentRoom,
  saveRoomState,
} from "./roomStore";
import type {
  FloorPlacement,
  PaintTarget,
  RoomItem,
  RoomOrientation,
  RoomSaveState,
  WallPlacement,
} from "./roomTypes";

export type InventoryEntry = {
  itemId: string;
  count: number;
  source: "shop" | "attendance" | "starter";
};

export type PlacementPreview =
  | {
      kind: "floor";
      itemId: string;
      instanceId: string;
      col: number;
      row: number;
      orientation: RoomOrientation;
      origin: "drawer" | "placed" | "move-from";
      fromRoomId?: string;
      originFloor?: FloorPlacement;
      valid: boolean;
      reason: string | null;
    }
  | {
      kind: "wall";
      itemId: string;
      instanceId: string;
      wall: "L" | "R";
      slot: number;
      band: number;
      t: number;
      heightUnits: number;
      origin: "drawer" | "placed" | "move-from";
      fromRoomId?: string;
      originWall?: WallPlacement;
      valid: boolean;
      reason: string | null;
    }
  | {
      kind: "paint";
      itemId: string;
      paintKind: "floor" | "wall";
      target: PaintTarget;
      fillAll: boolean;
      valid: boolean;
      reason: string | null;
    };

const seenRequests = new Set<string>();

export function newRequestId(prefix = "plc") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function inventoryFromOwned(
  owned: Record<string, number>,
  attendanceIds: Set<string> = new Set(),
): InventoryEntry[] {
  return Object.entries(owned)
    .filter(([, count]) => count > 0)
    .map(([itemId, count]) => ({
      itemId,
      count,
      source: attendanceIds.has(itemId) ? ("attendance" as const) : ("shop" as const),
    }));
}

export function ownedCount(state: RoomSaveState, itemId: string) {
  return state.owned[itemId] ?? 0;
}

export function remainingCount(state: RoomSaveState, itemId: string) {
  return Math.max(0, ownedCount(state, itemId) - placedCountAll(state, itemId));
}

/** Prefer camera-center (4,4), then flip orientation. */
export function suggestFloorSpot(
  item: RoomItem,
  floor: FloorPlacement[],
  byId: Map<string, RoomItem>,
  prefer?: { col: number; row: number } | null,
  ignoreInstanceId?: string,
): { col: number; row: number; orientation: RoomOrientation; valid: boolean; reason: string | null } {
  const orientations: RoomOrientation[] = ["default", "mirrored"];
  const centers = prefer ? [prefer, { col: 4, row: 4 }] : [{ col: 4, row: 4 }];

  for (const orientation of orientations) {
    for (const center of centers) {
      const spot = resolveSuggestTile(item, orientation, floor, byId, center);
      if (!spot) continue;
      const used = occupancy(floor, byId, ignoreInstanceId);
      const [w, d] = itemSize(item, orientation);
      const ok = isDecal(item) ? true : canPlace(spot.col, spot.row, w, d, used);
      if (ok) return { col: spot.col, row: spot.row, orientation, valid: true, reason: null };
    }
    const free = firstFreeTile(item, orientation, floor, byId);
    if (free) return { ...free, orientation, valid: true, reason: null };
  }

  return {
    col: prefer?.col ?? 4,
    row: prefer?.row ?? 4,
    orientation: "default",
    valid: false,
    reason: "방에 자리가 없어요 · 다른 아이템을 서랍에 넣어 보세요",
  };
}

export function validateFloorPreview(
  item: RoomItem,
  col: number,
  row: number,
  orientation: RoomOrientation,
  floor: FloorPlacement[],
  byId: Map<string, RoomItem>,
  ignoreInstanceId?: string,
): { valid: boolean; reason: string | null } {
  const [w, d] = itemSize(item, orientation);
  const used = occupancy(floor, byId, ignoreInstanceId);
  if (col < 0 || row < 0 || col + w > GRID || row + d > GRID) {
    return { valid: false, reason: "여기는 놓을 수 없어요" };
  }
  if (!isDecal(item) && !canPlace(col, row, w, d, used)) {
    return { valid: false, reason: "다른 가구와 겹쳐요" };
  }
  return { valid: true, reason: null };
}

export function validateWallPreview(
  item: RoomItem,
  wall: "L" | "R",
  slot: number,
  band: number,
  walls: WallPlacement[],
  byId: Map<string, RoomItem>,
  ignoreInstanceId?: string,
): { valid: boolean; reason: string | null } {
  const used = wallOccupancy(walls, byId, ignoreInstanceId);
  if (!canPlaceWall(item, wall, slot, band, used)) {
    return { valid: false, reason: "여기는 놓을 수 없어요" };
  }
  return { valid: true, reason: null };
}

/** Sync cap used by drawer CTAs; pass tier from ops prices when available. */
export function maxOwnForItemSync(item: RoomItem, tier?: string | null): number {
  if (item.attendanceOnly) return 1;
  if (isPaintItem(item)) return Number.POSITIVE_INFINITY;
  if (tier === "large") return 3;
  const [w, d] = item.footprint ?? [1, 1];
  if (w * d >= 4) return 3;
  return 5;
}

export async function maxOwnForItem(item: RoomItem): Promise<number> {
  if (item.attendanceOnly) return 1;
  if (isPaintItem(item)) return Number.POSITIVE_INFINITY;
  const config = await loadOpsConfig();
  const priced = config.prices.items.find((row) => row.id === item.id);
  return maxOwnForItemSync(item, priced?.tier);
}

/** Finger → ghost lift while dragging a placement preview (pt). */
export const PREVIEW_GHOST_LIFT_PT = 24;

export function findPaintPreviewTarget(
  item: RoomItem,
  floorTiles: string[][],
  wallTiles: { L: string[]; R: string[] },
): { target: PaintTarget; paintKind: "floor" | "wall"; valid: boolean; reason: string | null } {
  const isFloor = item.placement === "floor-skin" || item.category === "바닥";
  if (isFloor) {
    const type = item.id.replace(/^floor_/, "");
    for (let dist = 0; dist < GRID * 2; dist += 1) {
      for (let row = 0; row < GRID; row += 1) {
        for (let col = 0; col < GRID; col += 1) {
          if (Math.abs(col - 4) + Math.abs(row - 4) !== dist) continue;
          if (floorTiles[row]?.[col] !== type) {
            return {
              target: { kind: "floor", col, row },
              paintKind: "floor",
              valid: true,
              reason: null,
            };
          }
        }
      }
    }
    return {
      target: { kind: "floor", col: 4, row: 4 },
      paintKind: "floor",
      valid: false,
      reason: "이미 같은 바닥이 깔려 있어요",
    };
  }

  const type = item.id.replace(/^wall_/, "");
  for (const wall of ["L", "R"] as const) {
    for (let index = 0; index < GRID; index += 1) {
      if (wallTiles[wall][index] !== type) {
        return {
          target: { kind: "wall", wall, index },
          paintKind: "wall",
          valid: true,
          reason: null,
        };
      }
    }
  }
  return {
    target: { kind: "wall", wall: "L", index: 0 },
    paintKind: "wall",
    valid: false,
    reason: "이미 같은 벽지가 깔려 있어요",
  };
}

export type CommitResult =
  | { ok: true; state: RoomSaveState }
  | { ok: false; reason: string; state?: RoomSaveState };

function removeOnePlacement(state: RoomSaveState, roomId: string, itemId: string): RoomSaveState {
  const room = state.rooms[roomId];
  if (!room) return state;
  const floorHit = room.floor.find((p) => p.id === itemId);
  if (floorHit) {
    return {
      ...state,
      rooms: {
        ...state.rooms,
        [roomId]: { ...room, floor: room.floor.filter((p) => p.instanceId !== floorHit.instanceId) },
      },
    };
  }
  const wallHit = room.walls.find((p) => p.id === itemId);
  if (wallHit) {
    return {
      ...state,
      rooms: {
        ...state.rooms,
        [roomId]: { ...room, walls: room.walls.filter((p) => p.instanceId !== wallHit.instanceId) },
      },
    };
  }
  return state;
}

/** Local mock of room placement writes with requestId idempotency. */
export async function commitPlacement(args: {
  state: RoomSaveState;
  roomId: string;
  preview: PlacementPreview;
  itemsById: Map<string, RoomItem>;
  requestId: string;
}): Promise<CommitResult> {
  const { state, roomId, preview, itemsById, requestId } = args;
  if (seenRequests.has(requestId)) return { ok: true, state };

  const room = state.rooms[roomId];
  if (!room) return { ok: false, reason: "방을 찾을 수 없어요" };
  const item = itemsById.get(preview.itemId);
  if (!item) return { ok: false, reason: "아이템을 찾을 수 없어요" };

  let nextState = state;

  if (preview.kind === "paint") {
    if (!preview.valid) return { ok: false, reason: preview.reason ?? "칠할 수 없어요" };
    const type = preview.itemId.replace(/^(floor_|wall_)/, "");
    if (preview.fillAll) {
      if (preview.paintKind === "floor") {
        const floorTiles = room.floorTiles.map((row) => row.map(() => type));
        nextState = {
          ...state,
          rooms: {
            ...state.rooms,
            [roomId]: { ...room, floorTiles, floorSkin: type },
          },
        };
      } else {
        const wallTiles = {
          L: room.wallTiles.L.map(() => type),
          R: room.wallTiles.R.map(() => type),
        };
        nextState = {
          ...state,
          rooms: {
            ...state.rooms,
            [roomId]: { ...room, wallTiles, wallpaper: type },
          },
        };
      }
    } else {
      const next = applyPaint(room.floorTiles, room.wallTiles, preview.target, preview.itemId, false);
      nextState = {
        ...state,
        rooms: {
          ...state.rooms,
          [roomId]: { ...room, floorTiles: next.floor, wallTiles: next.walls },
        },
      };
    }
    seenRequests.add(requestId);
    await saveRoomState(nextState);
    return { ok: true, state: nextState };
  }

  if (preview.origin === "move-from" && preview.fromRoomId && preview.fromRoomId !== roomId) {
    nextState = removeOnePlacement(nextState, preview.fromRoomId, preview.itemId);
  }

  const live = nextState.rooms[roomId] ?? room;

  if (preview.kind === "floor") {
    if (!preview.valid) return { ok: false, reason: preview.reason ?? "놓을 수 없어요" };
    const withoutSelf = live.floor.filter((p) => p.instanceId !== preview.instanceId);
    const check = validateFloorPreview(
      item,
      preview.col,
      preview.row,
      preview.orientation,
      withoutSelf,
      itemsById,
    );
    if (!check.valid) return { ok: false, reason: check.reason ?? "놓을 수 없어요" };
    if (preview.origin === "drawer" || preview.origin === "move-from") {
      // Local drafts may already sit in layout; count excluding this instance.
      const draftState = {
        ...nextState,
        rooms: {
          ...nextState.rooms,
          [roomId]: { ...live, floor: withoutSelf },
        },
      };
      const rem = remainingCount(draftState, preview.itemId);
      if (preview.origin === "drawer" && rem <= 0) {
        return { ok: false, reason: "더 이상 배치할 수 없어요" };
      }
    }
    const place: FloorPlacement = {
      instanceId: preview.instanceId,
      id: preview.itemId,
      col: preview.col,
      row: preview.row,
      orientation: preview.orientation,
    };
    nextState = {
      ...nextState,
      currentRoomId: roomId,
      rooms: {
        ...nextState.rooms,
        [roomId]: { ...live, floor: [...withoutSelf, place] },
      },
    };
  } else {
    if (!preview.valid) return { ok: false, reason: preview.reason ?? "놓을 수 없어요" };
    const withoutSelf = live.walls.filter((p) => p.instanceId !== preview.instanceId);
    const check = validateWallPreview(
      item,
      preview.wall,
      preview.slot,
      preview.band,
      withoutSelf,
      itemsById,
    );
    if (!check.valid) return { ok: false, reason: check.reason ?? "놓을 수 없어요" };
    if (preview.origin === "drawer" || preview.origin === "move-from") {
      const draftState = {
        ...nextState,
        rooms: {
          ...nextState.rooms,
          [roomId]: { ...live, walls: withoutSelf },
        },
      };
      const rem = remainingCount(draftState, preview.itemId);
      if (preview.origin === "drawer" && rem <= 0) {
        return { ok: false, reason: "더 이상 배치할 수 없어요" };
      }
    }
    const coords = wallPlaceFromSlot(item, preview.wall, preview.slot, preview.band);
    const place: WallPlacement = {
      instanceId: preview.instanceId,
      id: preview.itemId,
      ...coords,
    };
    nextState = {
      ...nextState,
      currentRoomId: roomId,
      rooms: {
        ...nextState.rooms,
        [roomId]: { ...live, walls: [...withoutSelf, place] },
      },
    };
  }

  if (!isPaintItem(item) && placedCountAll(nextState, preview.itemId) > ownedCount(nextState, preview.itemId)) {
    return { ok: false, reason: "보유 개수를 넘었어요" };
  }

  seenRequests.add(requestId);
  await saveRoomState(nextState);
  return { ok: true, state: nextState };
}

export async function putBackToDrawer(args: {
  state: RoomSaveState;
  roomId: string;
  instanceId: string;
  requestId: string;
}): Promise<CommitResult> {
  const { state, roomId, instanceId, requestId } = args;
  if (seenRequests.has(requestId)) return { ok: true, state };
  const room = state.rooms[roomId];
  if (!room) return { ok: false, reason: "방을 찾을 수 없어요" };
  const next = {
    ...state,
    rooms: {
      ...state.rooms,
      [roomId]: {
        ...room,
        floor: room.floor.filter((p) => p.instanceId !== instanceId),
        walls: room.walls.filter((p) => p.instanceId !== instanceId),
      },
    },
  };
  seenRequests.add(requestId);
  await saveRoomState(next);
  return { ok: true, state: next };
}

export async function clearFurnitureToDrawer(args: {
  state: RoomSaveState;
  roomId: string;
  requestId: string;
}): Promise<CommitResult> {
  const { state, roomId, requestId } = args;
  if (seenRequests.has(requestId)) return { ok: true, state };
  const room = state.rooms[roomId];
  if (!room) return { ok: false, reason: "방을 찾을 수 없어요" };
  const next = {
    ...state,
    rooms: {
      ...state.rooms,
      [roomId]: { ...room, floor: [], walls: [] },
    },
  };
  seenRequests.add(requestId);
  await saveRoomState(next);
  return { ok: true, state: next };
}

export function startFloorPreviewFromDrawer(
  item: RoomItem,
  layoutFloor: FloorPlacement[],
  byId: Map<string, RoomItem>,
  prefer?: { col: number; row: number } | null,
  origin: "drawer" | "move-from" = "drawer",
  fromRoomId?: string,
): Extract<PlacementPreview, { kind: "floor" }> {
  const spot = suggestFloorSpot(item, layoutFloor, byId, prefer);
  return {
    kind: "floor",
    itemId: item.id,
    instanceId: newInstanceId(item.id),
    col: spot.col,
    row: spot.row,
    orientation: spot.orientation,
    origin,
    fromRoomId,
    valid: spot.valid,
    reason: spot.reason,
  };
}

export function startWallPreviewFromDrawer(
  item: RoomItem,
  walls: WallPlacement[],
  byId: Map<string, RoomItem>,
  preferWall: "L" | "R" = "L",
): Extract<PlacementPreview, { kind: "wall" }> {
  const slot = firstFreeOnWall(item, walls, byId, preferWall);
  if (!slot) {
    return {
      kind: "wall",
      itemId: item.id,
      instanceId: newInstanceId(item.id),
      wall: preferWall,
      slot: 2,
      band: 1,
      t: 2,
      heightUnits: 90,
      origin: "drawer",
      valid: false,
      reason: "방에 자리가 없어요 · 다른 아이템을 서랍에 넣어 보세요",
    };
  }
  const coords = wallPlaceFromSlot(item, slot.wall, slot.slot, slot.band);
  return {
    kind: "wall",
    itemId: item.id,
    instanceId: newInstanceId(item.id),
    wall: slot.wall,
    slot: slot.slot,
    band: slot.band,
    t: coords.t,
    heightUnits: coords.heightUnits,
    origin: "drawer",
    valid: true,
    reason: null,
  };
}

export { patchCurrentRoom, newInstanceId };
