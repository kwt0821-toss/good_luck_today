import {
  STARTER_FLOOR_ID,
  STARTER_WALLPAPER_ID,
  STARTER_YARN_ID,
  getItemById,
} from "./items";
import { canOccupy } from "./iso";
import type { RoomPlacement, RoomState, ShopItem, UserState } from "../types";

export type RoomActionResult =
  | { ok: true; next: UserState; message: string }
  | { ok: false; message: string };

export function ownedCount(user: UserState, itemId: string): number {
  return user.inventory[itemId] ?? 0;
}

export function placedCount(user: UserState, itemId: string): number {
  return user.room.placements.filter((item) => item.itemId === itemId).length;
}

export function availableCount(user: UserState, itemId: string): number {
  const item = getItemById(itemId);
  if (!item) return 0;
  if (item.unique) return ownedCount(user, itemId);
  return Math.max(0, ownedCount(user, itemId) - placedCount(user, itemId));
}

export function isEquipped(user: UserState, item: ShopItem): boolean {
  if (item.category === "wallpaper") return user.room.wallpaperId === item.id;
  if (item.category === "floor") return user.room.floorId === item.id;
  return false;
}

function newInstanceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `place_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function buyItem(user: UserState, itemId: string): RoomActionResult {
  const item = getItemById(itemId);
  if (!item) return { ok: false, message: "없는 아이템이에요." };
  if (item.price <= 0) return { ok: false, message: "기본으로 가지고 있는 아이템이에요." };
  if (item.unique && ownedCount(user, itemId) > 0) {
    return { ok: false, message: "이미 가지고 있어요." };
  }
  if (user.pinkJellyBalance < item.price) {
    return { ok: false, message: "핑크젤리가 부족해요." };
  }

  const next: UserState = {
    ...user,
    pinkJellyBalance: user.pinkJellyBalance - item.price,
    inventory: {
      ...user.inventory,
      [itemId]: ownedCount(user, itemId) + 1,
    },
  };

  if (item.category === "wallpaper" || item.category === "floor") {
    const equipped = equipSurface(next, itemId);
    return {
      ok: true,
      next: equipped.ok ? equipped.next : next,
      message: `${item.name}을 사고 바로 적용했어요.`,
    };
  }

  return { ok: true, next, message: `${item.name}을 샀어요. 타일 위에 놓아 보세요.` };
}

export function equipSurface(user: UserState, itemId: string): RoomActionResult {
  const item = getItemById(itemId);
  if (!item) return { ok: false, message: "없는 아이템이에요." };
  if (item.category !== "wallpaper" && item.category !== "floor") {
    return { ok: false, message: "벽에 붙이거나 바닥에 깔 아이템이 아니에요." };
  }
  if (ownedCount(user, itemId) < 1) return { ok: false, message: "아직 가지고 있지 않아요." };

  return {
    ok: true,
    next: {
      ...user,
      room: {
        ...user.room,
        wallpaperId: item.category === "wallpaper" ? item.id : user.room.wallpaperId,
        floorId: item.category === "floor" ? item.id : user.room.floorId,
      },
    },
    message: `${item.name}을 적용했어요.`,
  };
}

export function placeItem(user: UserState, itemId: string, col: number, row: number): RoomActionResult {
  const item = getItemById(itemId);
  if (!item) return { ok: false, message: "없는 아이템이에요." };
  if (item.unique) return { ok: false, message: "벽지와 바닥은 적용 버튼으로 바꿔요." };
  if (availableCount(user, itemId) < 1) return { ok: false, message: "놓을 수 있는 개수가 없어요." };
  if (!canOccupy(user.room.placements, item, col, row)) {
    return { ok: false, message: "그 타일에는 놓을 수 없어요." };
  }

  const placement: RoomPlacement = {
    instanceId: newInstanceId(),
    itemId,
    col,
    row,
  };

  return {
    ok: true,
    next: {
      ...user,
      room: {
        ...user.room,
        placements: [...user.room.placements, placement],
      },
    },
    message: `${item.name}을 타일에 놓았어요.`,
  };
}

export function movePlacement(
  user: UserState,
  instanceId: string,
  col: number,
  row: number,
): RoomActionResult {
  const current = user.room.placements.find((item) => item.instanceId === instanceId);
  if (!current) return { ok: false, message: "놓을 가구를 찾지 못했어요." };
  const item = getItemById(current.itemId);
  if (!item) return { ok: false, message: "없는 아이템이에요." };
  if (!canOccupy(user.room.placements, item, col, row, instanceId)) {
    return { ok: false, message: "" };
  }

  return {
    ok: true,
    next: {
      ...user,
      room: {
        ...user.room,
        placements: user.room.placements.map((entry) =>
          entry.instanceId === instanceId ? { ...entry, col, row } : entry,
        ),
      },
    },
    message: "",
  };
}

export function removePlacement(user: UserState, instanceId: string): RoomActionResult {
  const current = user.room.placements.find((item) => item.instanceId === instanceId);
  if (!current) return { ok: false, message: "치울 가구를 찾지 못했어요." };
  const item = getItemById(current.itemId);

  return {
    ok: true,
    next: {
      ...user,
      room: {
        ...user.room,
        placements: user.room.placements.filter((entry) => entry.instanceId !== instanceId),
      },
    },
    message: item ? `${item.name}을 보관했어요.` : "아이템을 보관했어요.",
  };
}

export function createDefaultRoom(): RoomState {
  return {
    wallpaperId: STARTER_WALLPAPER_ID,
    floorId: STARTER_FLOOR_ID,
    placements: [],
  };
}

export function createDefaultInventory(): Record<string, number> {
  return {
    [STARTER_WALLPAPER_ID]: 1,
    [STARTER_FLOOR_ID]: 1,
    [STARTER_YARN_ID]: 1,
  };
}
