import { toKstDateKey, toKstMondayWeekKey } from "./date";
import { resolveStartPaw } from "./devMode";
import type { OpsConfig, OpsState } from "./opsTypes";

export function createDefaultOpsState(config: OpsConfig, today = toKstDateKey()): OpsState {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `ops_${Date.now()}`;
  const starterItems = [
    ...config.starter.drawer,
    ...config.starter.firstRoom.placed
      .map((entry) => (typeof entry.id === "string" ? entry.id : null))
      .filter((id): id is string => Boolean(id)),
    config.starter.firstRoom.floor,
    config.starter.firstRoom.wall.L,
    config.starter.firstRoom.wall.R,
  ];
  const configPaw = config.starter.startPaw ?? config.economy.currency.paw.startBalance;
  return {
    userId: `user_${id}`,
    pawBalance: resolveStartPaw(configPaw),
    nyangCoinBalance: 0,
    dateKey: today,
    normalDrawsUsed: 0,
    rateUpUsed: 0,
    pawAdsUsed: 0,
    adDrawNyangToday: 0,
    adPawNyangToday: 0,
    pawAdLedger: [],
    tutorialFirstDrawUsed: false,
    tutorialDone: false,
    tutorialStep: 1,
    tutorialInterruptions: 0,
    tut: { rewardsIntro: "unseen" },
    installDateKey: today,
    attendanceDays: 0,
    lastAttendDateKST: "",
    attendanceClaimed: 0,
    lastAttendanceDateKey: "",
    rateUpTickets: 0,
    ticketShopWeekKey: toKstMondayWeekKey(),
    ticketShopWeekBought: 0,
    ticketShopDayKey: today,
    ticketShopDayBought: 0,
    ticketShopLedger: [],
    dupExchangeLedger: [],
    attendanceBadges: [],
    claimedMilestoneDays: [],
    featureIntrosSeen: [],
    grantedNyangCoinRewardIds: [],
    grantedSetRewardIds: [],
    claimedDexRewardIds: [],
    seenDexClaimableIds: [],
    dexClaimLedger: [],
    ownedItemIds: [...new Set(starterItems)],
    unlockedRoomIds: ["moon_bedroom"],
    pendingDraw: null,
    rewardInbox: [],
    walletHistory: [],
    lastSeenNoticeId: "",
    lifetimeDraws: 0,
    claimedAchievementIds: [],
    equippedTitleId: "",
    achievementClaimLedger: [],
    attendanceDay7Ledger: [],
    attendanceNyangYearKey: today.slice(0, 4),
    attendanceNyangCoinYear: 0,
  };
}

/** Reset day/week ticket-shop counters when KST windows roll. */
export function syncTicketShopWindows(state: OpsState, today = toKstDateKey()): OpsState {
  const weekKey = toKstMondayWeekKey();
  let next = state;
  if (next.ticketShopDayKey !== today) {
    next = { ...next, ticketShopDayKey: today, ticketShopDayBought: 0 };
  }
  if (next.ticketShopWeekKey !== weekKey) {
    next = { ...next, ticketShopWeekKey: weekKey, ticketShopWeekBought: 0 };
  }
  return next;
}

export function applyOpsDailyReset(state: OpsState, today = toKstDateKey()): OpsState {
  const synced = syncTicketShopWindows(state, today);
  if (synced.dateKey === today) return synced;
  return {
    ...synced,
    dateKey: today,
    normalDrawsUsed: 0,
    rateUpUsed: 0,
    pawAdsUsed: 0,
    adDrawNyangToday: 0,
    adPawNyangToday: 0,
    pendingDraw: null,
  };
}

export function daysSinceInstall(state: OpsState, today = toKstDateKey()): number {
  const [y1, m1, d1] = state.installDateKey.split("-").map(Number);
  const [y2, m2, d2] = today.split("-").map(Number);
  const a = Date.UTC(y1, m1 - 1, d1);
  const b = Date.UTC(y2, m2 - 1, d2);
  return Math.max(1, Math.floor((b - a) / 86_400_000) + 1);
}

export function remainingNormalDraws(state: OpsState, config: OpsConfig): number {
  return Math.max(0, config.economy.draws.normalPerDay - state.normalDrawsUsed);
}

export function remainingRateUpAdSlots(state: OpsState, config: OpsConfig): number {
  return Math.max(0, config.economy.draws.rateUpPerDay - state.rateUpUsed);
}

export function remainingRateUpDraws(state: OpsState, config: OpsConfig): number {
  // Tickets are separate from the daily ad cap (economy.tickets.rateUpTicket.separateDailyCap).
  return remainingRateUpAdSlots(state, config) + Math.max(0, state.rateUpTickets);
}

export function willUseRateUpTicket(state: OpsState, config?: OpsConfig): boolean {
  void config;
  // Prefer tickets whenever held — ads only when tickets are 0.
  return state.rateUpTickets > 0;
}

export function consumeRateUpTicket(state: OpsState): OpsState {
  if (state.rateUpTickets <= 0) return state;
  return { ...state, rateUpTickets: state.rateUpTickets - 1 };
}

export function remainingTotalDraws(state: OpsState, config: OpsConfig): number {
  return remainingNormalDraws(state, config) + remainingRateUpDraws(state, config);
}

export function remainingPawAds(state: OpsState, config: OpsConfig): number {
  return Math.max(0, config.economy.pawSources.rewardedAd.maxPerDay - state.pawAdsUsed);
}

export function nextDrawSlot(
  state: OpsState,
  config: OpsConfig,
): "tutorial" | "normal" | "rateUp" | null {
  if (!state.tutorialFirstDrawUsed && config.economy.draws.tutorialFirstDrawFree) {
    return "tutorial";
  }
  if (remainingNormalDraws(state, config) > 0) return "normal";
  if (remainingRateUpDraws(state, config) > 0) return "rateUp";
  return null;
}

/** What the next cat-tap / "한 장 더" actually spends. */
export type NextDrawKind = "tutorial" | "normal" | "rateUpAd" | "rateUpTicket" | "none";

export function nextDrawKind(state: OpsState, config: OpsConfig): NextDrawKind {
  const slot = nextDrawSlot(state, config);
  if (slot === "tutorial") return "tutorial";
  if (slot === "normal") return "normal";
  if (slot === "rateUp") return willUseRateUpTicket(state, config) ? "rateUpTicket" : "rateUpAd";
  return "none";
}

/** Button copy that matches the ad (or ticket) the next draw will use. */
export function drawAgainLabel(kind: NextDrawKind): string {
  if (kind === "rateUpAd") return "30초 광고 보고 확률업 뽑기";
  if (kind === "rateUpTicket") return "이용권으로 한 장 더";
  if (kind === "normal") return "짧은 광고 보고 카드 뽑기";
  return "한 장 더 뽑기";
}
