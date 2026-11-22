import {
  COZY_LEGACY_KEY,
  cozyClaimOwned,
} from "./cozyGiftMath";
import { nyNotify } from "./nyangNotify";
import { loadOpsState, saveOpsState } from "./opsStorage";
import { refreshMailbox } from "./mailbox";
import { grantRoomOwned } from "./roomStore";
import { cozyClaim, cozyStatus, type CozyStatus } from "./serverWallet";
import type { RoomItem } from "./roomTypes";

export { COZY_LEGACY_KEY, COZY_GIFT_FROM, COZY_GIFT_TO, cozyClaimOwned, cozyGiftLevels, nextCozyGiftLevel } from "./cozyGiftMath";

export function cozyLegacySent(): boolean {
  try {
    return window.localStorage.getItem(COZY_LEGACY_KEY) === "1";
  } catch {
    return false;
  }
}

export function markCozyLegacySent(): void {
  try {
    window.localStorage.setItem(COZY_LEGACY_KEY, "1");
  } catch {
    // ignore
  }
}

let inflight: Promise<void> | null = null;
let queued = false;
let latest: { roomOwned: Record<string, number>; items: RoomItem[] } | null = null;

/** Ask the server for a level gift, then quietly restore exclusives already granted. */
export function syncCozyGifts(input: {
  roomOwned: Record<string, number>;
  items: RoomItem[];
}): Promise<void> {
  latest = input;
  if (inflight) {
    queued = true;
    return inflight;
  }
  const run = async () => {
    do {
      queued = false;
      if (latest) await syncOnce(latest);
    } while (queued);
  };
  inflight = run().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function syncOnce(input: { roomOwned: Record<string, number>; items: RoomItem[] }): Promise<void> {
  const ops = await loadOpsState();
  const full = !cozyLegacySent();
  const owned = cozyClaimOwned(input.roomOwned, ops.ownedItemIds, input.items, !full);
  const claimed = await cozyClaim(owned);
  if (claimed.ok) {
    if (full) markCozyLegacySent();
    if (claimed.sent) {
      try {
        await refreshMailbox();
      } catch {
        // The letter is still on the server. The badge catches up on the next open.
      }
      const level = claimed.toLevel || claimed.level;
      nyNotify({
        key: `cozy-gift-${claimed.claimedLevel || level}`,
        kind: "reward",
        title: level > 0 ? `COZY Lv.${level} 선물이 편지함에 도착했어요` : "COZY 선물이 편지함에 도착했어요",
      });
    }
  }
  const status = await cozyStatus();
  if (!status.ok) return;
  await restoreCozyItems(status.items, input.roomOwned, ops.ownedItemIds);
}

export async function restoreCozyItems(
  ids: string[],
  roomOwned: Record<string, number>,
  opsIds: string[],
): Promise<string[]> {
  const missing = ids.filter((id) => (roomOwned[id] ?? 0) < 1 || !opsIds.includes(id));
  if (!missing.length) return [];
  const ops = await loadOpsState();
  const ownedItemIds = [...new Set([...ops.ownedItemIds, ...missing])];
  if (ownedItemIds.length !== ops.ownedItemIds.length) {
    await saveOpsState({ ...ops, ownedItemIds });
  }
  await grantRoomOwned(missing);
  window.dispatchEvent(new CustomEvent("lucky-cozy-items", { detail: { ids: missing } }));
  return missing;
}

export function cozyGiftWaiting(status: CozyStatus | null): boolean {
  if (!status) return false;
  return status.waitingItems.length > 0 || status.claimedLevel < status.level;
}
