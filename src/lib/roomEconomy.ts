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
  // Prefer ops inventory; room-owned fills gaps without letting mock seeds rewrite unlocks.
  const mergedOwned = [...new Set([...ops.ownedItemIds, ...ownedIds])];
  const cozyPoints = computeOwnedCozy(config.prices, mergedOwned);
  const cozyLevel =
    typeof ops.devForceCozyLevel === "number" && ops.devForceCozyLevel > 0
      ? ops.devForceCozyLevel
      : cozyLevelFromPoints(config.economy, cozyPoints);

  // Prefer ops balance as source of truth when room still has mock seed.
  const points = ops.pawBalance > 0 || state.points === 1240 ? ops.pawBalance : state.points;

  const unlocked = config.economy.rooms
    .filter((room) => {
      if (room.unlock.type === "default") return true;
      // ops is source of truth — ignore mock-seeded state.unlocked
      if (ops.unlockedRoomIds.includes(room.id)) return true;
      const needPaw = room.unlock.paw ?? 0;
      const needLv = room.unlock.cozyLevel ?? 0;
      return points >= needPaw && cozyLevel >= needLv;
    })
    .map((room) => room.id)
    .filter((id) => Boolean(state.rooms[id]));

  const nextUnlocked = unlocked.length ? unlocked : state.unlocked;
  const currentRoomId = nextUnlocked.includes(state.currentRoomId)
    ? state.currentRoomId
    : (nextUnlocked[0] ?? state.currentRoomId);

  await saveOpsState({
    ...ops,
    pawBalance: points,
    ownedItemIds: mergedOwned,
    unlockedRoomIds: unlocked.length ? unlocked : ops.unlockedRoomIds,
  });

  return {
    ...state,
    points,
    cozyLevel,
    unlocked: nextUnlocked,
    currentRoomId,
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
