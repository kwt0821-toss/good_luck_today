import { cardsOfType, groupBreedRows, loadDexCatalog } from "./dexCatalog";
import { loadDexOwned } from "./dexCollection";
import { grantNyangCoinOnce } from "./mockToss";
import { serverWalletActive, walletEarn } from "./serverWallet";
import { loadOpsConfig } from "./opsConfig";
import { saveOpsState } from "./opsStorage";
import type { OpsState } from "./opsTypes";
import { loadRoomCatalog, loadRoomGrid, loadRoomsFile } from "./roomCatalog";
import { applyOpsPrices } from "./roomEconomy";
import { loadRoomState } from "./roomStore";

export type AchvCategory = "수집" | "뽑기" | "출석" | "방꾸미기" | "교환";
export type AchvTabId = "all" | AchvCategory;

export type AchvItemDef = {
  id: string;
  category: AchvCategory;
  /** Display title shown on ribbon / tiles */
  title: string;
  /** Achievement name (short description) */
  name: string;
  condition: string;
  reward: { nyangCoin: number; paw: number };
};

export type AchvConfig = {
  _version?: string;
  claimMode?: string;
  claimApi?: string;
  ui?: Record<string, unknown>;
  totals?: { nyangCoin: number; paw: number };
  items: AchvItemDef[];
};

export type AchvStatus = "claimable" | "equipped" | "owned" | "locked";

export type AchvProgress = {
  def: AchvItemDef;
  current: number;
  /** Uncapped metric value (for series "지금 n" label). */
  currentRaw: number;
  target: number;
  unit: string;
  status: AchvStatus;
  remaining: number;
  seriesId?: string;
  seriesSteps?: Array<{ id: string; title: string; target: number }>;
};

export type AchvMetrics = {
  uniqueCards: number;
  ownedFiveStar: number;
  ownedLegend: number;
  breedSetsComplete: number;
  lifetimeDraws: number;
  attendanceDays: number;
  placedItems: number;
  unlockedRooms: number;
  totalRooms: number;
  dupConverted: number;
};

let configCache: Promise<AchvConfig> | null = null;

export const EMPTY_RIBBON_COPY = "칭호 없음 · 새내기 집사 받기";

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

/** Parse goal number + unit from condition strings like "도감 10장", "뽑기 50회". */
export function parseAchvGoal(item: AchvItemDef): { target: number; unit: string } {
  const c = item.condition;
  if (item.id === "room_all") return { target: 3, unit: "개" };
  if (item.id === "first_set") return { target: 1, unit: "개" };
  if (item.id === "first_legend") return { target: 1, unit: "장" };
  if (item.id === "first_5star") return { target: 1, unit: "장" };
  const m = c.match(/(\d+)/);
  const target = m ? Number(m[1]) : 1;
  if (c.includes("회")) return { target, unit: "회" };
  if (c.includes("일")) return { target, unit: "일" };
  if (c.includes("장")) return { target, unit: "장" };
  if (c.includes("개")) return { target, unit: "개" };
  return { target, unit: "개" };
}

function metricFor(item: AchvItemDef, metrics: AchvMetrics): number {
  switch (item.id) {
    case "first_meet":
    case "dex_10":
    case "dex_30":
    case "dex_60":
    case "dex_90":
      return metrics.uniqueCards;
    case "first_5star":
      return metrics.ownedFiveStar;
    case "first_legend":
      return metrics.ownedLegend;
    case "first_set":
      return metrics.breedSetsComplete;
    case "draw_50":
    case "draw_300":
    case "draw_1000":
      return metrics.lifetimeDraws;
    case "att_7":
    case "att_30":
    case "att_100":
      return metrics.attendanceDays;
    case "room_10":
    case "room_30":
      return metrics.placedItems;
    case "room_unlock2":
    case "room_all":
      return metrics.unlockedRooms;
    case "exch_20":
    case "exch_100":
      return metrics.dupConverted;
    default:
      return 0;
  }
}

const SERIES: Record<string, string[]> = {
  dex: ["first_meet", "dex_10", "dex_30", "dex_60", "dex_90"],
  draw: ["draw_50", "draw_300", "draw_1000"],
  att: ["att_7", "att_30", "att_100"],
  room_place: ["room_10", "room_30"],
  room_unlock: ["room_unlock2", "room_all"],
  exch: ["exch_20", "exch_100"],
};

function seriesIdFor(id: string): string | undefined {
  for (const [sid, ids] of Object.entries(SERIES)) {
    if (ids.includes(id)) return sid;
  }
  return undefined;
}

/** Server-side progress metrics derived from ops + dex + room state. */
export async function computeAchvMetrics(state: OpsState): Promise<AchvMetrics> {
  const [owned, catalog] = await Promise.all([loadDexOwned(), loadDexCatalog()]);
  let room = null as Awaited<ReturnType<typeof loadRoomState>> | null;
  let totalRooms = 3;
  try {
    const [roomCatalog, roomsFile, grid] = await Promise.all([
      loadRoomCatalog(),
      loadRoomsFile(),
      loadRoomGrid(),
    ]);
    totalRooms = roomsFile.rooms.filter((r) => !r.id.startsWith("_")).length || 3;
    const items = await applyOpsPrices(roomCatalog.items);
    room = await loadRoomState(items, roomsFile, grid);
  } catch {
    room = null;
  }

  const uniqueCards = Object.values(owned).filter((row) => (row?.count ?? 0) > 0).length;
  let ownedFiveStar = 0;
  let ownedLegend = 0;
  for (const card of catalog.cards) {
    if ((owned[card.id]?.count ?? 0) <= 0) continue;
    if (card.type === "legend") ownedLegend += 1;
    if (card.type === "breed" && (card.stars ?? 0) >= 5) ownedFiveStar += 1;
  }

  let breedSetsComplete = 0;
  for (const row of groupBreedRows(cardsOfType(catalog, "breed"))) {
    if (row.slots.every((card) => (owned[card.id]?.count ?? 0) > 0)) breedSetsComplete += 1;
  }

  let placedItems = 0;
  if (room) {
    for (const rec of Object.values(room.rooms)) {
      placedItems += (rec?.floor?.length ?? 0) + (rec?.walls?.length ?? 0);
    }
  }

  return {
    uniqueCards,
    ownedFiveStar,
    ownedLegend,
    breedSetsComplete,
    lifetimeDraws: state.lifetimeDraws ?? 0,
    attendanceDays: state.attendanceDays ?? 0,
    placedItems,
    unlockedRooms: (room?.unlocked?.length ?? state.unlockedRoomIds?.length) || 1,
    totalRooms,
    dupConverted: (state.dupExchangeLedger ?? []).reduce((sum, row) => sum + (row.converted ?? 0), 0),
  };
}

export function buildAchvProgressList(
  config: AchvConfig,
  state: OpsState,
  metrics: AchvMetrics,
): AchvProgress[] {
  const claimed = new Set(state.claimedAchievementIds ?? []);
  const equipped = state.equippedTitleId ?? "";
  const byId = new Map(config.items.map((item) => [item.id, item]));

  return config.items.map((def) => {
    const { target: parsedTarget, unit } = parseAchvGoal(def);
    const target = def.id === "room_all" ? Math.max(parsedTarget, metrics.totalRooms) : parsedTarget;
    const currentRaw = metricFor(def, metrics);
    const current = Math.min(currentRaw, target);
    const done = currentRaw >= target;
    const isClaimed = claimed.has(def.id);
    let status: AchvStatus = "locked";
    if (isClaimed && equipped === def.id) status = "equipped";
    else if (isClaimed) status = "owned";
    else if (done) status = "claimable";

    const sid = seriesIdFor(def.id);
    const seriesSteps = sid
      ? (SERIES[sid] ?? [])
          .map((id) => {
            const row = byId.get(id);
            if (!row) return null;
            const g = parseAchvGoal(row);
            const t = id === "room_all" ? Math.max(g.target, metrics.totalRooms) : g.target;
            return { id, title: row.title, target: t };
          })
          .filter((x): x is { id: string; title: string; target: number } => Boolean(x))
      : undefined;

    return {
      def,
      current,
      currentRaw,
      target,
      unit,
      status,
      remaining: Math.max(0, target - currentRaw),
      seriesId: sid,
      seriesSteps,
    };
  });
}

export function claimableAchvCount(list: AchvProgress[]) {
  return list.filter((item) => item.status === "claimable").length;
}

export function claimableCategories(list: AchvProgress[]): Set<AchvCategory> {
  const set = new Set<AchvCategory>();
  for (const item of list) {
    if (item.status === "claimable") set.add(item.def.category);
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
  titleIds: string[];
  paw: number;
  nyangCoin: number;
  alreadyProcessed?: boolean;
};

export type AchvClaimResponse = AchvClaimOk | { ok: false; reason: string };

/**
 * POST /achievements/claim { ids: string[] | 'all', requestId }
 * Server verifies progress, grants once per title, idempotent by requestId.
 */
export async function postAchievementClaim(
  state: OpsState,
  body: { ids: string[] | "all"; requestId: string },
): Promise<{ state: OpsState; response: AchvClaimResponse }> {
  await delay(40);
  const { ids, requestId } = body;
  if (!requestId) {
    return { state, response: { ok: false, reason: "요청이 올바르지 않아요" } };
  }

  const prior = (state.achievementClaimLedger ?? []).find((row) => row.requestId === requestId);
  if (prior) {
    return {
      state,
      response: {
        ok: true,
        titleIds: [prior.titleId],
        paw: prior.paw,
        nyangCoin: prior.nyangCoin,
        alreadyProcessed: true,
      },
    };
  }

  const config = await loadAchievementsConfig();
  const metrics = await computeAchvMetrics(state);
  const list = buildAchvProgressList(config, state, metrics);
  const selected =
    ids === "all"
      ? list.filter((item) => item.status === "claimable")
      : list.filter((item) => Array.isArray(ids) && ids.includes(item.def.id) && item.status === "claimable");

  if (!selected.length) {
    return { state, response: { ok: false, reason: "받을 칭호가 없어요" } };
  }

  let next = state;
  let totalPaw = 0;
  let totalNyang = 0;
  const claimedIds: string[] = [];
  const fresh = selected.filter((item) => !(next.claimedAchievementIds ?? []).includes(item.def.id));

  if (await serverWalletActive()) {
    const free = fresh.filter((item) => item.def.reward.nyangCoin <= 0);
    const paid = fresh.filter((item) => item.def.reward.nyangCoin > 0);
    for (const item of free) {
      totalPaw += item.def.reward.paw;
      claimedIds.push(item.def.id);
      next = {
        ...next,
        pawBalance: next.pawBalance + item.def.reward.paw,
        claimedAchievementIds: [...(next.claimedAchievementIds ?? []), item.def.id],
      };
    }
    if (paid.length) {
      let earned: Awaited<ReturnType<typeof walletEarn>>;
      try {
        earned = await walletEarn(
          paid.map((item) => ({ rewardId: `achv:${item.def.id}` })),
        );
      } catch {
        earned = { ok: false, error: "network", network: true };
      }
      if (earned.ok) {
        next = { ...next, nyangCoinBalance: earned.balance };
        for (const item of paid) {
          const rewardId = `achv:${item.def.id}`;
          const row = earned.results.find((entry) => entry.rewardId === rewardId);
          if (!row?.ok) continue;
          totalPaw += item.def.reward.paw;
          totalNyang += row.amount ?? 0;
          claimedIds.push(item.def.id);
          const grantedIds = next.grantedNyangCoinRewardIds.includes(rewardId)
            ? next.grantedNyangCoinRewardIds
            : [...next.grantedNyangCoinRewardIds, rewardId];
          next = {
            ...next,
            pawBalance: next.pawBalance + item.def.reward.paw,
            claimedAchievementIds: [...(next.claimedAchievementIds ?? []), item.def.id],
            grantedNyangCoinRewardIds: grantedIds,
          };
        }
      }
    }
    if (!claimedIds.length) {
      return {
        state,
        response: {
          ok: false,
          reason: fresh.length
            ? "연결이 불안정해요. 잠시 후 다시 받아 주세요"
            : "이미 받은 칭호예요",
        },
      };
    }
  } else {
    for (const item of fresh) {
      totalPaw += item.def.reward.paw;
      totalNyang += item.def.reward.nyangCoin;
      claimedIds.push(item.def.id);
      next = {
        ...next,
        pawBalance: next.pawBalance + item.def.reward.paw,
        claimedAchievementIds: [...(next.claimedAchievementIds ?? []), item.def.id],
      };
      if (item.def.reward.nyangCoin > 0) {
        let toss: Awaited<ReturnType<typeof grantNyangCoinOnce>>;
        try {
          toss = await grantNyangCoinOnce(next, {
            tossUserKey: next.userId,
            rewardId: `achv:${item.def.id}`,
            amount: item.def.reward.nyangCoin,
          });
        } catch {
          toss = { state: next, result: { ok: false, reason: "network" } };
        }
        next = toss.state;
      }
    }
  }

  if (!claimedIds.length) {
    return { state: next, response: { ok: false, reason: "이미 받은 칭호예요" } };
  }

  if (!next.equippedTitleId) {
    next = { ...next, equippedTitleId: claimedIds[0] };
  }

  const entry = {
    requestId,
    titleId: claimedIds.join(","),
    createdAt: Date.now(),
    paw: totalPaw,
    nyangCoin: totalNyang,
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
    response: { ok: true, titleIds: claimedIds, paw: totalPaw, nyangCoin: totalNyang },
  };
}

/** POST /profile/title { achievementId | null } */
export async function equipAchievementTitle(
  state: OpsState,
  titleId: string | null,
): Promise<{ state: OpsState; ok: boolean; reason?: string }> {
  if (titleId && !(state.claimedAchievementIds ?? []).includes(titleId)) {
    return { state, ok: false, reason: "아직 받지 않은 칭호예요" };
  }
  const next = { ...state, equippedTitleId: titleId ?? "" };
  await saveOpsState(next);
  return { state: next, ok: true };
}

export async function ensureAchievementsLoaded() {
  await Promise.all([loadOpsConfig(), loadAchievementsConfig()]);
}
