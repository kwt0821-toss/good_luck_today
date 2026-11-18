import type { OpsEconomy, OpsState } from "./opsTypes";
import { displayJellyBalance, jellyEnqueue, serverJellyActive } from "./serverJelly";

export type RoomSetPose = "idle_sit" | "loaf" | "sleep";
export type RoomSetEffect = "steam" | "petals" | "snow";

export type RoomSetCue = {
  pose: RoomSetPose;
  bubble: string;
  anchorId: string;
  effect: RoomSetEffect;
};

export type RoomSetView = RoomSetCue & {
  roomId: string;
  rewardId: string;
  nameKo: string;
  bannerSub: string;
  owned: number;
  total: number;
  complete: boolean;
  paw: number;
};

const POSES = new Set<RoomSetPose>(["idle_sit", "loaf", "sleep"]);
const EFFECTS = new Set<RoomSetEffect>(["steam", "petals", "snow"]);

function asPose(value: unknown): RoomSetPose {
  return typeof value === "string" && POSES.has(value as RoomSetPose) ? (value as RoomSetPose) : "idle_sit";
}

function asEffect(value: unknown): RoomSetEffect {
  return typeof value === "string" && EFFECTS.has(value as RoomSetEffect) ? (value as RoomSetEffect) : "steam";
}

/** Sets from economy.json. Item ids are not hardcoded here. */
export function roomSetViews(economy: OpsEconomy | null | undefined, owned: Record<string, number>): RoomSetView[] {
  const paw = Number(economy?.roomSets?.paw ?? 0);
  const rows = economy?.roomSets?.sets ?? [];
  const views: RoomSetView[] = [];
  for (const row of rows) {
    if (!row || typeof row.roomId !== "string") continue;
    const itemIds = (row.itemIds ?? []).filter((id): id is string => typeof id === "string" && id.length > 0);
    const total = itemIds.length;
    const have = itemIds.filter((id) => (owned[id] ?? 0) > 0).length;
    views.push({
      roomId: row.roomId,
      rewardId: typeof row.rewardId === "string" && row.rewardId ? row.rewardId : `roomSet_${row.roomId}`,
      nameKo: row.nameKo || row.roomId,
      bannerSub: row.bannerSub || "이 방에서만 나와요",
      bubble: row.bubble || "",
      pose: asPose(row.pose),
      effect: asEffect(row.effect),
      anchorId: row.anchorId || "",
      owned: have,
      total,
      complete: total > 0 && have >= total,
      paw: Number.isFinite(paw) ? paw : 0,
    });
  }
  return views;
}

export function roomSetFor(views: RoomSetView[], roomId: string): RoomSetView | null {
  return views.find((row) => row.roomId === roomId) ?? null;
}

export function roomSetCue(view: RoomSetView | null): RoomSetCue | null {
  if (!view?.complete) return null;
  return {
    pose: view.pose,
    bubble: view.bubble,
    anchorId: view.anchorId,
    effect: view.effect,
  };
}

/** Once per reward id. Local jelly when the server wallet is off. */
export async function claimRoomSetReward(state: OpsState, rewardId: string, paw: number): Promise<OpsState> {
  if (!rewardId || state.claimedRoomSetIds.includes(rewardId)) return state;
  const claimedRoomSetIds = [...state.claimedRoomSetIds, rewardId];
  const amount = Math.max(0, Math.floor(paw));
  if (amount > 0 && (await serverJellyActive())) {
    await jellyEnqueue({ rewardId, reason: "roomSet", optimistic: amount });
    return { ...state, claimedRoomSetIds, pawBalance: displayJellyBalance(state.pawBalance) };
  }
  return { ...state, claimedRoomSetIds, pawBalance: state.pawBalance + amount };
}
