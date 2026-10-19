import { Storage } from "@apps-in-toss/web-framework";

import { toKstDateKey } from "./date";
import { DEV_PAW_BALANCE, isDevBuild, RESET_BONUS_PAW } from "./devMode";
import { isInTossApp } from "./native";
import { loadOpsConfig } from "./opsConfig";
import { applyOpsDailyReset, createDefaultOpsState } from "./opsState";
import type { OpsState } from "./opsTypes";

const OPS_KEY = "lucky-cat.ops-state.v1";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function read(key: string): Promise<string | null> {
  if (isInTossApp()) {
    try {
      return await withTimeout(Storage.getItem(key), 800);
    } catch {
      // preview fallback
    }
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string): Promise<void> {
  if (isInTossApp()) {
    try {
      await withTimeout(Storage.setItem(key, value), 800);
      return;
    } catch {
      // preview fallback
    }
  }
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseOps(raw: string | null, fallback: OpsState): OpsState {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return fallback;
    return {
      ...fallback,
      userId: typeof parsed.userId === "string" ? parsed.userId : fallback.userId,
      pawBalance: typeof parsed.pawBalance === "number" ? parsed.pawBalance : fallback.pawBalance,
      nyangCoinBalance:
        typeof parsed.nyangCoinBalance === "number"
          ? parsed.nyangCoinBalance
          : typeof parsed.tossBalance === "number"
            ? parsed.tossBalance
            : fallback.nyangCoinBalance,
      dateKey: typeof parsed.dateKey === "string" ? parsed.dateKey : fallback.dateKey,
      normalDrawsUsed:
        typeof parsed.normalDrawsUsed === "number" ? parsed.normalDrawsUsed : fallback.normalDrawsUsed,
      rateUpUsed: typeof parsed.rateUpUsed === "number" ? parsed.rateUpUsed : fallback.rateUpUsed,
      adDrawNyangToday:
        typeof parsed.adDrawNyangToday === "number" ? parsed.adDrawNyangToday : 0,
      adPawNyangToday:
        typeof parsed.adPawNyangToday === "number" ? parsed.adPawNyangToday : 0,
      pawAdsUsed: typeof parsed.pawAdsUsed === "number" ? parsed.pawAdsUsed : fallback.pawAdsUsed,
      pawAdLedger: Array.isArray(parsed.pawAdLedger)
        ? parsed.pawAdLedger
            .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
            .map((item) => ({
              requestId: typeof item.requestId === "string" ? item.requestId : "",
              createdAt: typeof item.createdAt === "number" ? item.createdAt : 0,
              paw: typeof item.paw === "number" ? item.paw : 0,
              nyangCoin: typeof item.nyangCoin === "number" ? item.nyangCoin : 0,
              pawBalance: typeof item.pawBalance === "number" ? item.pawBalance : 0,
              nyangCoinBalance:
                typeof item.nyangCoinBalance === "number" ? item.nyangCoinBalance : 0,
            }))
            .filter((item) => item.requestId)
        : fallback.pawAdLedger,
      tutorialFirstDrawUsed: Boolean(parsed.tutorialFirstDrawUsed),
      tutorialDone: Boolean(parsed.tutorialDone),
      tutorialStep: typeof parsed.tutorialStep === "number" ? parsed.tutorialStep : 1,
      tutorialInterruptions:
        typeof parsed.tutorialInterruptions === "number" ? parsed.tutorialInterruptions : 0,
      tut: (() => {
        const raw = isRecord(parsed.tut) ? parsed.tut : null;
        const status = raw?.rewardsIntro;
        if (status === "seen" || status === "skipped" || status === "unseen") {
          return { rewardsIntro: status };
        }
        return fallback.tut;
      })(),
      installDateKey:
        typeof parsed.installDateKey === "string" ? parsed.installDateKey : fallback.installDateKey,
      attendanceDays:
        typeof parsed.attendanceDays === "number"
          ? parsed.attendanceDays
          : typeof parsed.attendanceClaimed === "number"
            ? parsed.attendanceClaimed
            : 0,
      lastAttendDateKST:
        typeof parsed.lastAttendDateKST === "string"
          ? parsed.lastAttendDateKST
          : typeof parsed.lastAttendanceDateKey === "string"
            ? parsed.lastAttendanceDateKey
            : "",
      attendanceClaimed:
        typeof parsed.attendanceDays === "number"
          ? Math.min(parsed.attendanceDays, 7)
          : typeof parsed.attendanceClaimed === "number"
            ? parsed.attendanceClaimed
            : 0,
      lastAttendanceDateKey:
        typeof parsed.lastAttendDateKST === "string"
          ? parsed.lastAttendDateKST
          : typeof parsed.lastAttendanceDateKey === "string"
            ? parsed.lastAttendanceDateKey
            : "",
      rateUpTickets: typeof parsed.rateUpTickets === "number" ? parsed.rateUpTickets : 0,
      ticketShopWeekKey:
        typeof parsed.ticketShopWeekKey === "string" ? parsed.ticketShopWeekKey : fallback.ticketShopWeekKey,
      ticketShopWeekBought:
        typeof parsed.ticketShopWeekBought === "number" ? parsed.ticketShopWeekBought : 0,
      ticketShopDayKey:
        typeof parsed.ticketShopDayKey === "string" ? parsed.ticketShopDayKey : fallback.ticketShopDayKey,
      ticketShopDayBought:
        typeof parsed.ticketShopDayBought === "number" ? parsed.ticketShopDayBought : 0,
      ticketShopLedger: Array.isArray(parsed.ticketShopLedger)
        ? parsed.ticketShopLedger
            .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
            .map((item) => ({
              requestId: typeof item.requestId === "string" ? item.requestId : "",
              ticketType: "rateUp" as const,
              createdAt: typeof item.createdAt === "number" ? item.createdAt : 0,
              paw: typeof item.paw === "number" ? item.paw : 0,
              ticketsHeld: typeof item.ticketsHeld === "number" ? item.ticketsHeld : 0,
              weekBought: typeof item.weekBought === "number" ? item.weekBought : 0,
              dayBought: typeof item.dayBought === "number" ? item.dayBought : 0,
            }))
            .filter((item) => item.requestId)
        : fallback.ticketShopLedger,
      dupExchangeLedger: Array.isArray(parsed.dupExchangeLedger)
        ? parsed.dupExchangeLedger
            .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
            .map((item) => ({
              requestId: typeof item.requestId === "string" ? item.requestId : "",
              createdAt: typeof item.createdAt === "number" ? item.createdAt : 0,
              mode: item.mode === "card" ? ("card" as const) : ("all" as const),
              cardId: typeof item.cardId === "string" ? item.cardId : undefined,
              converted: typeof item.converted === "number" ? item.converted : 0,
              gained: typeof item.gained === "number" ? item.gained : 0,
              pawBalance: typeof item.pawBalance === "number" ? item.pawBalance : 0,
            }))
            .filter((item) => item.requestId)
        : fallback.dupExchangeLedger,
      attendanceBadges: parseStringArray(parsed.attendanceBadges),
      claimedMilestoneDays: Array.isArray(parsed.claimedMilestoneDays)
        ? parsed.claimedMilestoneDays.filter((n): n is number => typeof n === "number")
        : [],
      featureIntrosSeen: parseStringArray(parsed.featureIntrosSeen),
      grantedNyangCoinRewardIds: (() => {
        const next = parseStringArray(parsed.grantedNyangCoinRewardIds);
        if (next.length) return next;
        return parseStringArray(parsed.grantedTossRewardIds);
      })(),
      grantedSetRewardIds: parseStringArray(parsed.grantedSetRewardIds),
      claimedDexRewardIds: (() => {
        const next = parseStringArray(parsed.claimedDexRewardIds);
        if (next.length) return next;
        // Migrate legacy auto-grants so they are not claimable again.
        const legacyNyang = parseStringArray(parsed.grantedNyangCoinRewardIds).concat(
          parseStringArray(parsed.grantedTossRewardIds),
        );
        const fromCards = legacyNyang.map((id) =>
          id.startsWith("card:") ? `newCard:${id.slice("card:".length)}` : id,
        );
        const fromSets = parseStringArray(parsed.grantedSetRewardIds).map((id) =>
          id.startsWith("breed:") ? `set:${id}` : id,
        );
        return [...new Set([...fromCards, ...fromSets])];
      })(),
      dexClaimLedger: Array.isArray(parsed.dexClaimLedger)
        ? parsed.dexClaimLedger
            .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
            .map((item) => ({
              requestId: typeof item.requestId === "string" ? item.requestId : "",
              rewardIds: Array.isArray(item.rewardIds)
                ? item.rewardIds.filter((id): id is string => typeof id === "string")
                : [],
              createdAt: typeof item.createdAt === "number" ? item.createdAt : 0,
              paw: typeof item.paw === "number" ? item.paw : 0,
              nyangCoin: typeof item.nyangCoin === "number" ? item.nyangCoin : 0,
              pawBalance: typeof item.pawBalance === "number" ? item.pawBalance : 0,
              nyangCoinBalance:
                typeof item.nyangCoinBalance === "number" ? item.nyangCoinBalance : 0,
            }))
            .filter((item) => item.requestId)
        : fallback.dexClaimLedger,
      ownedItemIds: parseStringArray(parsed.ownedItemIds),
      unlockedRoomIds: parseStringArray(parsed.unlockedRoomIds).length
        ? parseStringArray(parsed.unlockedRoomIds)
        : fallback.unlockedRoomIds,
      pendingDraw: null,
      rewardInbox: Array.isArray(parsed.rewardInbox)
        ? parsed.rewardInbox
            .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
            .map((item) => ({
              id: typeof item.id === "string" ? item.id : "",
              label: typeof item.label === "string" ? item.label : "",
              paw: typeof item.paw === "number" ? item.paw : 0,
              nyangCoin:
                typeof item.nyangCoin === "number"
                  ? item.nyangCoin
                  : typeof item.toss === "number"
                    ? item.toss
                    : 0,
              collected: Boolean(item.collected),
            }))
            .filter((item) => item.id)
        : fallback.rewardInbox,
      walletHistory: Array.isArray(parsed.walletHistory)
        ? parsed.walletHistory
            .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
            .map((item) => {
              const status: "pending" | "done" | "failed" =
                item.status === "done" || item.status === "failed" || item.status === "pending"
                  ? item.status
                  : "pending";
              return {
                requestId: typeof item.requestId === "string" ? item.requestId : "",
                amount: typeof item.amount === "number" ? item.amount : 0,
                status,
                createdAt: typeof item.createdAt === "number" ? item.createdAt : 0,
                updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : 0,
                failReason: typeof item.failReason === "string" ? item.failReason : undefined,
                userHash: typeof item.userHash === "string" ? item.userHash : undefined,
                rewardKey: typeof item.rewardKey === "string" ? item.rewardKey : undefined,
                testGrant: item.testGrant === true ? true : undefined,
              };
            })
            .filter((item) => item.requestId)
        : fallback.walletHistory,
      lastSeenNoticeId:
        typeof parsed.lastSeenNoticeId === "string" ? parsed.lastSeenNoticeId : "",
      lifetimeDraws:
        typeof parsed.lifetimeDraws === "number" ? parsed.lifetimeDraws : fallback.lifetimeDraws,
      claimedAchievementIds: Array.isArray(parsed.claimedAchievementIds)
        ? parsed.claimedAchievementIds.filter((id): id is string => typeof id === "string")
        : fallback.claimedAchievementIds,
      equippedTitleId:
        typeof parsed.equippedTitleId === "string" ? parsed.equippedTitleId : fallback.equippedTitleId,
      achievementClaimLedger: Array.isArray(parsed.achievementClaimLedger)
        ? parsed.achievementClaimLedger
            .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
            .map((item) => ({
              requestId: typeof item.requestId === "string" ? item.requestId : "",
              titleId: typeof item.titleId === "string" ? item.titleId : "",
              createdAt: typeof item.createdAt === "number" ? item.createdAt : 0,
              paw: typeof item.paw === "number" ? item.paw : 0,
              nyangCoin: typeof item.nyangCoin === "number" ? item.nyangCoin : 0,
              pawBalance: typeof item.pawBalance === "number" ? item.pawBalance : 0,
              nyangCoinBalance:
                typeof item.nyangCoinBalance === "number" ? item.nyangCoinBalance : 0,
            }))
            .filter((item) => item.requestId && item.titleId)
        : fallback.achievementClaimLedger,
      attendanceDay7Ledger: Array.isArray(parsed.attendanceDay7Ledger)
        ? parsed.attendanceDay7Ledger
            .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
            .map((item) => ({
              requestId: typeof item.requestId === "string" ? item.requestId : "",
              cycleNo: typeof item.cycleNo === "number" ? item.cycleNo : 0,
              withAd: Boolean(item.withAd),
              createdAt: typeof item.createdAt === "number" ? item.createdAt : 0,
              nyangCoin: typeof item.nyangCoin === "number" ? item.nyangCoin : 0,
              paw: typeof item.paw === "number" ? item.paw : 0,
              tickets: typeof item.tickets === "number" ? item.tickets : 0,
              pawBalance: typeof item.pawBalance === "number" ? item.pawBalance : 0,
              nyangCoinBalance:
                typeof item.nyangCoinBalance === "number" ? item.nyangCoinBalance : 0,
              rateUpTickets: typeof item.rateUpTickets === "number" ? item.rateUpTickets : 0,
            }))
            .filter((item) => item.requestId && item.cycleNo > 0)
        : fallback.attendanceDay7Ledger,
      attendanceNyangYearKey:
        typeof parsed.attendanceNyangYearKey === "string"
          ? parsed.attendanceNyangYearKey
          : fallback.attendanceNyangYearKey,
      attendanceNyangCoinYear:
        typeof parsed.attendanceNyangCoinYear === "number"
          ? parsed.attendanceNyangCoinYear
          : fallback.attendanceNyangCoinYear,
      devForceCozyLevel: null,
    };
  } catch {
    return fallback;
  }
}

export async function loadOpsState(): Promise<OpsState> {
  const config = await loadOpsConfig();
  const today = toKstDateKey();
  const fallback = createDefaultOpsState(config, today);
  const parsed = parseOps(await read(OPS_KEY), fallback);
  let next = applyOpsDailyReset(parsed, today);
  // Keep the post-reset test grant; otherwise top up local DEV to a generous balance.
  if (isDevBuild && next.pawBalance !== DEV_PAW_BALANCE && next.pawBalance !== RESET_BONUS_PAW) {
    next = { ...next, pawBalance: DEV_PAW_BALANCE };
  }
  if (next !== parsed) await saveOpsState(next);
  return next;
}

export async function saveOpsState(state: OpsState): Promise<void> {
  await write(OPS_KEY, JSON.stringify(state));
}
