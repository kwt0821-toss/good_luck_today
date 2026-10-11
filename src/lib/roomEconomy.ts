import { computeOwnedCozy, cozyLevelFromPoints, loadOpsConfig, priceById } from "./opsConfig";
import { loadOpsState, saveOpsState } from "./opsStorage";
import type { RoomItem, RoomSaveState } from "./roomTypes";

/** Overlay prices/cozy from prices.json onto catalog items. */
export async function applyOpsPrices(items: RoomItem[]): Promise<RoomItem[]> {
  const config = await loadOpsConfig();
  const attendanceIds = new Set(config.prices.attendanceOnly?.ids ?? []);
  const exclude = new Set(config.economy.shop?.excludeSources ?? ["attendance"]);
  return items.map((item) => {
    const priced = priceById(config.prices, item.id);
    const attendanceOnly =
      item.attendanceOnly ||
      attendanceIds.has(item.id) ||
      Boolean(priced?.flags?.includes("attendance")) ||
      (priced?.source != null && exclude.has(priced.source));
    if (!priced) return { ...item, attendanceOnly, ownedDefault: attendanceOnly ? false : item.ownedDefault };
    return {
      ...item,
      price: priced.price,
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
  const mergedOwned = [...new Set([...ownedIds, ...ops.ownedItemIds])];
  const cozyPoints = computeOwnedCozy(config.prices, mergedOwned);
  const cozyLevel = cozyLevelFromPoints(config.economy, cozyPoints);

  // Keep a single paw balance — room spends/writes back into ops.
  const nextOps = {
    ...ops,
    pawBalance: state.points !== ops.pawBalance ? state.points : ops.pawBalance,
    ownedItemIds: mergedOwned,
    unlockedRoomIds: state.unlocked.length ? state.unlocked : ops.unlockedRoomIds,
  };
  // Prefer ops balance as source of truth when room still has mock seed.
  const points = ops.pawBalance > 0 || state.points === 1240 ? ops.pawBalance : state.points;
  nextOps.pawBalance = points;
  await saveOpsState(nextOps);

  const unlocked = config.economy.rooms
    .filter((room) => {
      if (room.unlock.type === "default") return true;
      if (ops.unlockedRoomIds.includes(room.id) || state.unlocked.includes(room.id)) return true;
      const needPaw = room.unlock.paw ?? 0;
      const needLv = room.unlock.cozyLevel ?? 0;
      return points >= needPaw && cozyLevel >= needLv;
    })
    .map((room) => room.id)
    .filter((id) => Boolean(state.rooms[id]));

  return {
    ...state,
    points,
    cozyLevel,
    unlocked: unlocked.length ? unlocked : state.unlocked,
    owned: {
      ...state.owned,
      ...Object.fromEntries(mergedOwned.map((id) => [id, Math.max(1, state.owned[id] ?? 1)])),
    },
  };
}

export async function spendRoomPoints(pointsAfter: number): Promise<void> {
  const ops = await loadOpsState();
  await saveOpsState({ ...ops, pawBalance: pointsAfter });
}
