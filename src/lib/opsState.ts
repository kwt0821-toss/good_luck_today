import { toKstDateKey } from "./date";
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
  return {
    userId: `user_${id}`,
    pawBalance: config.starter.startPaw ?? config.economy.currency.paw.startBalance,
    tossBalance: 0,
    dateKey: today,
    normalDrawsUsed: 0,
    rateUpUsed: 0,
    pawAdsUsed: 0,
    tutorialFirstDrawUsed: false,
    tutorialDone: false,
    tutorialStep: 1,
    tutorialInterruptions: 0,
    installDateKey: today,
    attendanceClaimed: 0,
    lastAttendanceDateKey: "",
    featureIntrosSeen: [],
    grantedTossRewardIds: [],
    grantedSetRewardIds: [],
    ownedItemIds: [...new Set(starterItems)],
    unlockedRoomIds: ["moon_bedroom"],
    pendingDraw: null,
  };
}

export function applyOpsDailyReset(state: OpsState, today = toKstDateKey()): OpsState {
  if (state.dateKey === today) return state;
  return {
    ...state,
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

export function remainingRateUpDraws(state: OpsState, config: OpsConfig): number {
  return Math.max(0, config.economy.draws.rateUpPerDay - state.rateUpUsed);
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
