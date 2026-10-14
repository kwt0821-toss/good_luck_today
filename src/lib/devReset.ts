import { saveDexOwned } from "./dexCollection";
import { RESET_BONUS_PAW } from "./devMode";
import { loadOpsConfig } from "./opsConfig";
import { createDefaultOpsState } from "./opsState";
import { saveOpsState } from "./opsStorage";
import type { OpsState } from "./opsTypes";
import { loadRoomCatalog, loadRoomGrid, loadRoomsFile } from "./roomCatalog";
import { applyOpsPrices } from "./roomEconomy";
import { newUserRoomState, saveRoomState } from "./roomStore";
import { isInTossApp } from "./native";
import { Storage } from "@apps-in-toss/web-framework";

export { RESET_BONUS_PAW } from "./devMode";

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
