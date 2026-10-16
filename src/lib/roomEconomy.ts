import { loadOpsConfig, priceById } from "./opsConfig";
import { loadOpsState, saveOpsState } from "./opsStorage";
import { resolveCozyStatus } from "./roomCozy";
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

  // Prefer ops balance as source of truth when room still has mock seed.
  const points = ops.pawBalance > 0 || state.points === 1240 ? ops.pawBalance : state.points;

  const unlocked = config.economy.rooms
    .filter((room) => {
      if (room.unlock.type === "default") return true;
      // ops is source of truth — ignore mock-seeded state.unlocked
      if (ops.unlockedRoomIds.includes(room.id)) return true;
      const needPaw = room.unlock.paw ?? 0;
      const needLv = room.unlock.cozyLevel ?? 0;
      return points >= needPaw && cozy.level >= needLv;
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
    cozyLevel: cozy.level,
    unlocked: nextUnlocked,
    currentRoomId,
    owned: ownedCounts,
  };
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
