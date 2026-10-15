import { loadDexCatalog } from "./dexCatalog";
import { loadDexOwned } from "./dexCollection";
import { grantNyangCoinOnce } from "./mockToss";
import { loadOpsConfig } from "./opsConfig";
import { saveOpsState } from "./opsStorage";
import type { OpsState } from "./opsTypes";
import { loadRoomCatalog, loadRoomGrid, loadRoomsFile } from "./roomCatalog";
import { applyOpsPrices } from "./roomEconomy";
import { loadRoomState } from "./roomStore";

export type AchvTabId = "all" | "collect" | "draw" | "attend" | "room" | "exchange";

export type AchvConditionMetric =
  | "uniqueCards"
  | "lifetimeDraws"
  | "ownedFiveStar"
  | "attendanceDays"
  | "placedItems"
  | "ownedItems"
  | "cozyLevel"
  | "unlockedRooms"
  | "dupExchanges"
  | "dupExchangePaw";

export type AchvTitleDef = {
  id: string;
  nameKo: string;
  tab: Exclude<AchvTabId, "all">;
  seriesId?: string;
  seriesOrder?: number;
  condition: { metric: AchvConditionMetric; target: number };
  conditionCopy: string;
  reward: { nyangCoin: number; paw: number };
};

export type AchvConfig = {
  _version?: string;
  emptyRibbonCopy: string;
  tabs: Array<{ id: AchvTabId; labelKo: string }>;
  titles: AchvTitleDef[];
};

export type AchvStatus = "claimable" | "equipped" | "owned" | "locked";

export type AchvProgress = {
  def: AchvTitleDef;
  current: number;
  target: number;
  status: AchvStatus;
  remaining: number;
  seriesSteps?: number[];
};

export type AchvMetrics = {
  uniqueCards: number;
  lifetimeDraws: number;
  ownedFiveStar: number;
  attendanceDays: number;
  placedItems: number;
  ownedItems: number;
  cozyLevel: number;
  unlockedRooms: number;
  dupExchanges: number;
  dupExchangePaw: number;
};

let configCache: Promise<AchvConfig> | null = null;

export function loadAchievementsConfig(): Promise<AchvConfig> {
  if (!configCache) {
    const base = (import.meta.env.VITE_OPS_CONFIG_BASE as string | undefined) ?? "/config";
    configCache = fetch(`${base}/achievements.json`, { cache: "no-cache" }).then(async (res) => {
      if (!res.ok) throw new Error("achievements.json missing");
      return (await res.json()) as AchvConfig;
    });
  }
  return configCache;
}

export function clearAchievementsConfigCache() {
  configCache = null;
}

export function achvBadgeSrc(id: string) {
  return `/assets/achv/badges/${id}.svg`;
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/** Server-side progress metrics derived from ops + dex + room state. */
export async function computeAchvMetrics(state: OpsState): Promise<AchvMetrics> {
  const [owned, catalog] = await Promise.all([loadDexOwned(), loadDexCatalog()]);
  let room = null as Awaited<ReturnType<typeof loadRoomState>> | null;
  try {
    const [roomCatalog, roomsFile, grid] = await Promise.all([
      loadRoomCatalog(),
      loadRoomsFile(),
      loadRoomGrid(),
    ]);
    const items = await applyOpsPrices(roomCatalog.items);
    room = await loadRoomState(items, roomsFile, grid);
  } catch {
    room = null;
  }
  const uniqueCards = Object.values(owned).filter((row) => (row?.count ?? 0) > 0).length;
  let ownedFiveStar = 0;
  for (const card of catalog.cards) {
    if ((owned[card.id]?.count ?? 0) <= 0) continue;
    if (card.type === "breed" && (card.stars ?? 0) >= 5) ownedFiveStar += 1;
  }
  const currentRoom = room?.rooms?.[room.currentRoomId];
  const placed =
    (currentRoom?.floor?.length ?? 0) + (currentRoom?.walls?.length ?? 0);
  return {
    uniqueCards,
    lifetimeDraws: state.lifetimeDraws ?? 0,
    ownedFiveStar,
    attendanceDays: state.attendanceDays ?? 0,
    placedItems: Math.max(placed, currentRoom ? 1 : 0),
    ownedItems: state.ownedItemIds?.length ?? 0,
    cozyLevel: room?.cozyLevel ?? 1,
    unlockedRooms: (room?.unlocked?.length ?? state.unlockedRoomIds?.length) || 1,
    dupExchanges: state.dupExchangeLedger?.length ?? 0,
    dupExchangePaw: (state.dupExchangeLedger ?? []).reduce((sum, row) => sum + (row.gained ?? 0), 0),
  };
}

function metricValue(metrics: AchvMetrics, metric: AchvConditionMetric): number {
  return metrics[metric] ?? 0;
}

export function buildAchvProgressList(
  config: AchvConfig,
  state: OpsState,
  metrics: AchvMetrics,
): AchvProgress[] {
  const claimed = new Set(state.claimedAchievementIds ?? []);
  const equipped = state.equippedTitleId ?? "";
  const seriesSteps = new Map<string, number[]>();
  for (const title of config.titles) {
    if (!title.seriesId) continue;
    const list = seriesSteps.get(title.seriesId) ?? [];
    list.push(title.condition.target);
    seriesSteps.set(title.seriesId, list);
  }
  for (const [id, steps] of seriesSteps) {
    seriesSteps.set(
      id,
      [...steps].sort((a, b) => a - b),
    );
  }

  return config.titles.map((def) => {
    const current = metricValue(metrics, def.condition.metric);
    const target = def.condition.target;
    const done = current >= target;
    const isClaimed = claimed.has(def.id);
    let status: AchvStatus = "locked";
    if (isClaimed && equipped === def.id) status = "equipped";
    else if (isClaimed) status = "owned";
    else if (done) status = "claimable";
    return {
      def,
      current: Math.min(current, target),
      target,
      status,
      remaining: Math.max(0, target - current),
      seriesSteps: def.seriesId ? seriesSteps.get(def.seriesId) : undefined,
    };
  });
}

export function claimableAchvCount(list: AchvProgress[]) {
  return list.filter((item) => item.status === "claimable").length;
}

export function claimableTabs(list: AchvProgress[]): Set<AchvTabId> {
  const set = new Set<AchvTabId>();
  for (const item of list) {
    if (item.status === "claimable") set.add(item.def.tab);
  }
  return set;
}

export function equippedProgress(list: AchvProgress[], state: OpsState) {
  return list.find((item) => item.def.id === state.equippedTitleId) ?? null;
}

export function buildAchvClaimRequestId(): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `achv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return `achievements.claim:${id}`;
}

export type AchvClaimOk = {
  ok: true;
  titleId: string;
  paw: number;
  nyangCoin: number;
  alreadyProcessed?: boolean;
};

export type AchvClaimResponse = AchvClaimOk | { ok: false; reason: string };

/**
 * POST /achievements/claim { titleId, requestId }
 * Server verifies progress, grants once per title, idempotent by requestId.
 */
export async function postAchievementClaim(
  state: OpsState,
  body: { titleId: string; requestId: string },
): Promise<{ state: OpsState; response: AchvClaimResponse }> {
  await delay(40);
  const { titleId, requestId } = body;
  if (!requestId || !titleId) {
    return { state, response: { ok: false, reason: "요청이 올바르지 않아요" } };
  }

  const prior = (state.achievementClaimLedger ?? []).find((row) => row.requestId === requestId);
  if (prior) {
    return {
      state,
      response: {
        ok: true,
        titleId: prior.titleId,
        paw: prior.paw,
        nyangCoin: prior.nyangCoin,
        alreadyProcessed: true,
      },
    };
  }

  const config = await loadAchievementsConfig();
  const def = config.titles.find((item) => item.id === titleId);
  if (!def) return { state, response: { ok: false, reason: "칭호를 찾을 수 없어요" } };

  if ((state.claimedAchievementIds ?? []).includes(titleId)) {
    return { state, response: { ok: false, reason: "이미 받은 칭호예요" } };
  }

  const metrics = await computeAchvMetrics(state);
  if (metricValue(metrics, def.condition.metric) < def.condition.target) {
    return { state, response: { ok: false, reason: "아직 조건을 못 채웠어요" } };
  }

  let next: OpsState = {
    ...state,
    pawBalance: state.pawBalance + def.reward.paw,
    claimedAchievementIds: [...(state.claimedAchievementIds ?? []), titleId],
    equippedTitleId: state.equippedTitleId || titleId,
  };

  if (def.reward.nyangCoin > 0) {
    const toss = await grantNyangCoinOnce(next, {
      tossUserKey: next.userId,
      rewardId: `achv:${titleId}`,
      amount: def.reward.nyangCoin,
    });
    next = toss.state;
  }

  const entry = {
    requestId,
    titleId,
    createdAt: Date.now(),
    paw: def.reward.paw,
    nyangCoin: def.reward.nyangCoin,
    pawBalance: next.pawBalance,
    nyangCoinBalance: next.nyangCoinBalance,
  };
  next = {
    ...next,
    achievementClaimLedger: [entry, ...(next.achievementClaimLedger ?? [])].slice(0, 80),
  };
  await saveOpsState(next);
  return {
    state: next,
    response: { ok: true, titleId, paw: def.reward.paw, nyangCoin: def.reward.nyangCoin },
  };
}

export async function equipAchievementTitle(
  state: OpsState,
  titleId: string,
): Promise<{ state: OpsState; ok: boolean; reason?: string }> {
  if (!(state.claimedAchievementIds ?? []).includes(titleId)) {
    return { state, ok: false, reason: "아직 받지 않은 칭호예요" };
  }
  const next = { ...state, equippedTitleId: titleId };
  await saveOpsState(next);
  return { state: next, ok: true };
}

/** Ensure ops config also exposes achievements when needed elsewhere. */
export async function ensureAchievementsLoaded() {
  await Promise.all([loadOpsConfig(), loadAchievementsConfig()]);
}
