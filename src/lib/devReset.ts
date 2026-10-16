import { saveDexOwned } from "./dexCollection";
import { loadDexCatalog } from "./dexCatalog";
import type { DexOwnedMap } from "./dexTypes";
import { RESET_BONUS_PAW } from "./devMode";
import { toKstDateKey } from "./date";
import { loadOpsConfig } from "./opsConfig";
import { createDefaultOpsState } from "./opsState";
import { loadOpsState, saveOpsState } from "./opsStorage";
import type { OpsState } from "./opsTypes";
import { loadRoomCatalog, loadRoomGrid, loadRoomsFile } from "./roomCatalog";
import { applyOpsPrices } from "./roomEconomy";
import { loadRoomState, newUserRoomState, saveRoomState } from "./roomStore";
import { isInTossApp } from "./native";
import { Storage } from "@apps-in-toss/web-framework";

export { RESET_BONUS_PAW } from "./devMode";

/** Target cozy level for the hidden "풀 진행도" debug grant. */
export const DEV_MAX_COZY_LEVEL = 15;

const LEGACY_USER_KEY = "lucky-cat.user-state";
const ROOM_KEY = "lucky-cat.my-room.v6.rooms";
const ROOM_LEGACY_KEYS = ["lucky-cat.my-room.v5.tiles", "lucky-cat.my-room.v5"];
const DEX_KEY = "lucky-cat.dex-collection";
const OPS_KEY = "lucky-cat.ops-state.v1";

async function removeKey(key: string): Promise<void> {
  if (isInTossApp()) {
    try {
      await Storage.removeItem(key);
    } catch {
      // preview fallback
    }
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Wipe progress back to a fresh install.
 * Clears ops / dex / room (incl. legacy keys). Keeps menu/audio settings.
 * Reloading the app afterward is recommended.
 */
export async function resetToNewUserState(): Promise<OpsState> {
  // Drop persisted blobs first so a mid-flight failure can't leave mock leftovers.
  await removeKey(OPS_KEY);
  await removeKey(DEX_KEY);
  await removeKey(ROOM_KEY);
  await removeKey(LEGACY_USER_KEY);
  for (const key of ROOM_LEGACY_KEYS) await removeKey(key);

  const config = await loadOpsConfig();
  const next: OpsState = {
    ...createDefaultOpsState(config),
    pawBalance: RESET_BONUS_PAW,
    devForceCozyLevel: null,
  };
  await saveOpsState(next);

  // Empty collection — not the design mock seed.
  await saveDexOwned({});

  const [catalog, grid, rooms] = await Promise.all([
    loadRoomCatalog(),
    loadRoomGrid(),
    loadRoomsFile(),
  ]);
  const items = await applyOpsPrices(catalog.items);
  const room = newUserRoomState(items, rooms, next, grid, config.starter);
  await saveRoomState(room);

  return next;
}

/**
 * Hidden debug grant (below 진행도 초기화): own every dex card + room item,
 * unlock every room, force cozy level to {@link DEV_MAX_COZY_LEVEL}.
 */
export async function unlockMaxDevState(): Promise<OpsState> {
  const config = await loadOpsConfig();
  const [catalog, grid, roomsFile, dexCatalog, ops] = await Promise.all([
    loadRoomCatalog(),
    loadRoomGrid(),
    loadRoomsFile(),
    loadDexCatalog(),
    loadOpsState(),
  ]);
  const items = await applyOpsPrices(catalog.items);
  const today = toKstDateKey();

  const ownedDex: DexOwnedMap = {};
  for (const card of dexCatalog.cards) {
    ownedDex[card.id] = {
      id: card.id,
      firstSeen: today,
      count: Math.max(1, ownedDex[card.id]?.count ?? 1),
      isNew: false,
    };
  }
  await saveDexOwned(ownedDex);

  const ownedItemIds = [
    ...new Set([
      ...items.map((item) => item.id),
      ...(config.prices.attendanceOnly?.ids ?? []),
      ...ops.ownedItemIds,
    ]),
  ];

  const unlockedRoomIds = [
    ...new Set(
      roomsFile.rooms
        .map((room) => room.id)
        .filter((id) => Boolean(id) && !id.startsWith("_")),
    ),
  ];

  const maxRoomPaw = Math.max(
    0,
    ...config.economy.rooms.map((room) => room.unlock?.paw ?? 0),
  );

  const next: OpsState = {
    ...ops,
    ownedItemIds,
    unlockedRoomIds,
    pawBalance: Math.max(ops.pawBalance, maxRoomPaw, RESET_BONUS_PAW),
    tutorialDone: true,
    tutorialFirstDrawUsed: true,
    tutorialStep: Math.max(ops.tutorialStep, 99),
    tut: {
      rewardsIntro: ops.tut?.rewardsIntro === "unseen" ? "seen" : (ops.tut?.rewardsIntro ?? "seen"),
    },
    devForceCozyLevel: DEV_MAX_COZY_LEVEL,
  };
  await saveOpsState(next);

  const room = await loadRoomState(items, roomsFile, grid);
  const owned: Record<string, number> = { ...room.owned };
  for (const id of ownedItemIds) {
    owned[id] = Math.max(1, owned[id] ?? 0);
  }
  const unlocked = unlockedRoomIds.filter((id) => Boolean(room.rooms[id]));
  await saveRoomState({
    ...room,
    points: next.pawBalance,
    owned,
    unlocked: unlocked.length ? unlocked : room.unlocked,
    cozyLevel: DEV_MAX_COZY_LEVEL,
    currentRoomId: unlocked.includes(room.currentRoomId)
      ? room.currentRoomId
      : (unlocked[0] ?? room.currentRoomId),
  });

  return next;
}
