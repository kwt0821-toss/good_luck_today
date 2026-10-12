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
    attendanceBadges: [],
    claimedMilestoneDays: [],
    featureIntrosSeen: [],
    grantedNyangCoinRewardIds: [],
    grantedSetRewardIds: [],
    ownedItemIds: [...new Set(starterItems)],
    unlockedRoomIds: ["moon_bedroom"],
    pendingDraw: null,
    rewardInbox: [],
    walletHistory: [],
    lastSeenNoticeId: "",
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

export function willUseRateUpTicket(state: OpsState, config: OpsConfig): boolean {
  return remainingRateUpAdSlots(state, config) <= 0 && state.rateUpTickets > 0;
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
