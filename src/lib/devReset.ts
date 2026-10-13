import { isDevBuild } from "./devMode";
import { saveDexOwned } from "./dexCollection";
import { loadOpsConfig } from "./opsConfig";
import { createDefaultOpsState } from "./opsState";
import { saveOpsState } from "./opsStorage";
import type { OpsState } from "./opsTypes";
import { loadRoomCatalog, loadRoomGrid, loadRoomsFile } from "./roomCatalog";
import { applyOpsPrices } from "./roomEconomy";
import { newUserRoomState, saveRoomState } from "./roomStore";
import { isInTossApp } from "./native";
import { Storage } from "@apps-in-toss/web-framework";

const LEGACY_USER_KEY = "lucky-cat.user-state";
const ROOM_LEGACY_KEYS = ["lucky-cat.my-room.v5.tiles", "lucky-cat.my-room.v5"];

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
 * Wipe progress back to a fresh install (DEV builds only).
 * Keeps menu/audio settings. Reloading the app afterward is recommended.
 */
export async function resetToNewUserState(): Promise<OpsState> {
  if (!isDevBuild) {
    throw new Error("resetToNewUserState is DEV-only");
  }

  const config = await loadOpsConfig();
  const next = createDefaultOpsState(config);
  await saveOpsState(next);

  // Empty collection — not the design mock seed.
  await saveDexOwned({});

  await removeKey(LEGACY_USER_KEY);
  for (const key of ROOM_LEGACY_KEYS) await removeKey(key);

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
