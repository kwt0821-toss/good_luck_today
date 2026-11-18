import { loadOpsConfig, priceById } from "./opsConfig";
import { loadOpsState, saveOpsState } from "./opsStorage";
import { displayJellyBalance, serverJellyActive } from "./serverJelly";
import { resolveCozyStatus } from "./roomCozy";
import { loadRoomsFile } from "./roomCatalog";
import type { OpsEconomy } from "./opsTypes";
import type { RoomItem, RoomSaveState } from "./roomTypes";

/** Overlay prices/cozy from prices.json onto catalog items. */
export async function applyOpsPrices(items: RoomItem[]): Promise<RoomItem[]> {
  const config = await loadOpsConfig();
  const attendanceIds = new Set(config.prices.attendanceOnly?.ids ?? []);
  const exclude = new Set(config.economy.shop?.excludeSources ?? ["attendance"]);
  const byId = new Map(items.map((item) => [item.id, item]));

  // Materialize attendance-only variants that reuse base room art (baseArtFrom).
  for (const priced of config.prices.items) {
    if (!priced.baseArtFrom || byId.has(priced.id)) continue;
    const base = byId.get(priced.baseArtFrom);
    if (!base) continue;
    byId.set(priced.id, {
      ...base,
      id: priced.id,
      nameKo: priced.nameKo || base.nameKo,
      price: priced.price ?? 0,
      attendanceOnly: true,
      ownedDefault: false,
    });
  }

  return [...byId.values()].map((item) => {
    const priced = priceById(config.prices, item.id);
    // Prefer prices.json as source of truth when the item is listed there.
    const attendanceOnly = priced
      ? Boolean(
          priced.attendanceOnly ||
            priced.flags?.includes("attendanceOnly") ||
            attendanceIds.has(item.id) ||
            (priced.source != null && exclude.has(priced.source)),
        )
      : Boolean(
          item.attendanceOnly ||
            attendanceIds.has(item.id),
        );
    if (!priced) return { ...item, attendanceOnly, ownedDefault: attendanceOnly ? false : item.ownedDefault };
    return {
      ...item,
      price: priced.price ?? 0,
      attendanceOnly,
      ownedDefault: attendanceOnly ? false : item.ownedDefault,
    };
  });
}

export async function syncRoomSaveWithOps(state: RoomSaveState): Promise<RoomSaveState> {
  const [config, ops] = await Promise.all([loadOpsConfig(), loadOpsState()]);
  const ownedIds = Object.entries(state.owned)
    .filter(([, count]) => count > 0)
    .map(([id]) => id);
  // Prefer ops inventory; room-owned fills gaps without letting mock seeds rewrite unlocks.
  const mergedOwned = [...new Set([...ops.ownedItemIds, ...ownedIds])];
  const ownedCounts: Record<string, number> = {
    ...state.owned,
    ...Object.fromEntries(mergedOwned.map((id) => [id, Math.max(1, state.owned[id] ?? 1)])),
  };
  const cozy = resolveCozyStatus(ownedCounts, config.prices, config.economy, {
    forceLevel: ops.devForceCozyLevel,
  });

  // Server jelly spends before a room opens. Local preview still opens from the balance.
  const serverJelly = await serverJellyActive();
  const points = serverJelly
    ? displayJellyBalance(ops.pawBalance)
    : ops.pawBalance > 0 || state.points === 1240
      ? ops.pawBalance
      : state.points;

  const unlocked = config.economy.rooms
    .filter((room) => {
      if (room.unlock.type === "default") return true;
      // ops is source of truth — ignore mock-seeded state.unlocked
      if (ops.unlockedRoomIds.includes(room.id)) return true;
      if (serverJelly) return false;
      const needPaw = room.unlock.paw ?? 0;
      const needLv = room.unlock.cozyLevel ?? 0;
      return points >= needPaw && cozy.level >= needLv;
    })
    .map((room) => room.id)
    .filter((id) => Boolean(state.rooms[id]));

  const nextUnlocked = unlocked.length ? unlocked : state.unlocked;
  const newlyUnlocked = nextUnlocked.filter((id) => !ops.unlockedRoomIds.includes(id));
  const ownedWithGifts = await grantUnlockRewards(ownedCounts, newlyUnlocked, config.economy.rooms);
  const cozyAfter = newlyUnlocked.length
    ? resolveCozyStatus(ownedWithGifts, config.prices, config.economy, {
        forceLevel: ops.devForceCozyLevel,
      })
    : cozy;
  const currentRoomId = nextUnlocked.includes(state.currentRoomId)
    ? state.currentRoomId
    : (nextUnlocked[0] ?? state.currentRoomId);
  const ownedItemIds = [
    ...new Set([
      ...mergedOwned,
      ...Object.keys(ownedWithGifts).filter(
        (id) => (ownedWithGifts[id] ?? 0) > 0 && (ownedCounts[id] ?? 0) <= 0,
      ),
    ]),
  ];

  const latest = await loadOpsState();
  const savedOwned = [
    ...new Set([
      ...latest.ownedItemIds,
      ...ownedItemIds,
    ]),
  ];
  const savedUnlocked = [
    ...new Set([...(unlocked.length ? unlocked : ops.unlockedRoomIds), ...latest.unlockedRoomIds]),
  ];
  await saveOpsState({
    ...ops,
    pawBalance: points,
    ownedItemIds: savedOwned,
    unlockedRoomIds: savedUnlocked,
  });

  return {
    ...state,
    points,
    cozyLevel: cozyAfter.level,
    unlocked: nextUnlocked,
    currentRoomId,
    owned: ownedWithGifts,
  };
}

/** Default floor and wall texture ids that ship with a room. */
function defaultTileIds(def: {
  defaultFloor: string;
  defaultWall: { L: string; R: string };
  floorTiles?: string[][];
  wallTiles?: { L: string[]; R: string[] };
}): string[] {
  const ids: string[] = [];
  const add = (id: string | undefined) => {
    if (id && !ids.includes(id)) ids.push(id);
  };
  if (def.floorTiles?.length) {
    for (const row of def.floorTiles) for (const id of row) add(id);
  } else {
    add(def.defaultFloor);
  }
  if (def.wallTiles) {
    for (const id of def.wallTiles.L) add(id);
    for (const id of def.wallTiles.R) add(id);
  } else {
    add(def.defaultWall.L);
    add(def.defaultWall.R);
  }
  return ids;
}

/** Grant a room's unlock gifts once. Counts come from economy.json, not from code. */
export async function grantUnlockRewards(
  owned: Record<string, number>,
  roomIds: string[],
  economyRooms: OpsEconomy["rooms"],
): Promise<Record<string, number>> {
  if (!roomIds.length) return owned;
  const roomsFile = await loadRoomsFile();
  const next = { ...owned };
  for (const roomId of roomIds) {
    const spec = economyRooms.find((row) => row.id === roomId);
    if (!spec) continue;
    for (const id of spec.grantItems ?? []) {
      next[id] = Math.max(next[id] ?? 0, 1);
    }
    if (!spec.grantDefaultTiles) continue;
    const def = roomsFile.rooms.find((room) => room.id === roomId);
    if (!def) continue;
    for (const id of defaultTileIds(def)) {
      next[id] = Math.max(next[id] ?? 0, 1);
    }
  }
  return next;
}

/** Recalculate cozy after buy/sell (economy 2.2). Returns updated room save. */
export async function recalculateRoomCozy(state: RoomSaveState): Promise<RoomSaveState> {
  const [config, ops] = await Promise.all([loadOpsConfig(), loadOpsState()]);
  const cozy = resolveCozyStatus(state.owned, config.prices, config.economy, {
    forceLevel: ops.devForceCozyLevel,
  });
  return { ...state, cozyLevel: cozy.level };
}

export async function spendRoomPoints(pointsAfter: number): Promise<void> {
  const ops = await loadOpsState();
  await saveOpsState({ ...ops, pawBalance: pointsAfter });
}
