import { toKstDateKey } from "./date";
import { loadDexCatalog } from "./dexCatalog";
import { loadDexOwned, saveDexOwned } from "./dexCollection";
import type { DexCard, DexOwnedMap } from "./dexTypes";
import { duplicateRevealCopy, isManualDexClaim, newCardRevealCopy } from "./dexRewards";
import { dupPawForCard } from "./drawRates";
import { grantNyangCoinOnce } from "./mockToss";
import { isWeekendDoublePaw, loadOpsConfig } from "./opsConfig";
import {
  applyOpsDailyReset,
  consumeRateUpTicket,
  remainingPawAds,
  remainingRateUpAdSlots,
  remainingTotalDraws,
} from "./opsState";
import { saveOpsState } from "./opsStorage";
import type { ConfirmDrawResult, DrawReservation, OpsConfig, OpsState } from "./opsTypes";

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export type ConfirmDrawOpts = {
  /** True only after a completed ad callback (server-validated). */
  adCompleted?: boolean;
};

function adDrawRewardId(drawId: string) {
  return `adDraw:${drawId}`;
}

function shouldGrantAdDrawNyang(
  reservation: DrawReservation,
  state: OpsState,
  config: OpsConfig,
  adCompleted: boolean,
): boolean {
  if (!adCompleted) return false;
  if (reservation.slot === "tutorial") return false;
  // Ticket rate-up never watches an ad for the draw.
  if (reservation.slot === "rateUp" && state.rateUpTickets > 0) return false;
  const amount = config.economy.ncoinSources?.adDraw ?? 0;
  if (amount <= 0) return false;
  const dailyMax = config.economy.ncoinSources?.adDrawRule?.dailyMax ?? 4;
  if ((state.adDrawNyangToday ?? 0) >= dailyMax) return false;
  return reservation.slot === "normal" || reservation.slot === "rateUp";
}

/**
 * Ad-complete callback path. Consumes the draw quota and grants rewards only here.
 * Ad-draw 냥코인 is granted in the same transaction when `adCompleted` is true.
 */
export async function confirmDrawAfterAd(
  state: OpsState,
  drawId: string,
  opts: ConfirmDrawOpts = {},
): Promise<ConfirmDrawResult | { error: string }> {
  await delay(60);
  const config = await loadOpsConfig();
  const today = toKstDateKey();
  let next = applyOpsDailyReset(state, today);
  const reservation = next.pendingDraw;
  if (!reservation || reservation.drawId !== drawId) {
    return { error: "뽑기 예약을 찾을 수 없어요" };
  }

  const adCompleted = Boolean(opts.adCompleted);
  const notice =
    config.economy.ncoinSources?.adDrawRule?.notice ??
    "카드를 뽑아 냥코인x1이 지급되었습니다.";

  if (reservation.confirmed) {
    // Idempotent replay: same drawId → same response (including ad 냥코인).
    const catalog = await loadDexCatalog();
    const card = catalog.cards.find((item) => item.id === reservation.cardId);
    if (!card) return { error: "카드 정보를 찾지 못했어요" };
    const adNyangCoin = reservation.adNyangCoin ?? 0;
    return {
      state: next,
      reservation,
      card,
      toast: null,
      setRewards: [],
      adNyangCoin,
      nyangCoinBalance: next.nyangCoinBalance,
      adNyangNotice: adNyangCoin > 0 ? notice : null,
    };
  }

  // Ad must complete for ad-path draws; without it, cancel reservation path is used instead.
  // Ticket / tutorial call confirm with adCompleted=false intentionally.
  if (
    !adCompleted &&
    reservation.slot !== "tutorial" &&
    !(reservation.slot === "rateUp" && next.rateUpTickets > 0)
  ) {
    return { error: "광고를 끝까지 보지 못했어요" };
  }

  const catalog = await loadDexCatalog();
  const card = catalog.cards.find((item) => item.id === reservation.cardId);
  if (!card) return { error: "카드 정보를 찾지 못했어요" };

  let owned = await loadDexOwned();
  const prev = owned[card.id];
  const isNew = !prev || prev.count <= 0;
  owned = {
    ...owned,
    [card.id]: {
      id: card.id,
      firstSeen: prev?.firstSeen ?? today,
      count: (prev?.count ?? 0) + 1,
      isNew: isNew ? true : Boolean(prev?.isNew),
    },
  };
  await saveDexOwned(owned);

  const grantAdNyang = shouldGrantAdDrawNyang(reservation, next, config, adCompleted);
  const wantNyang = grantAdNyang ? (config.economy.ncoinSources?.adDraw ?? 1) : 0;

  if (reservation.slot === "tutorial" || reservation.slot === "normal") {
    next = {
      ...next,
      normalDrawsUsed: next.normalDrawsUsed + 1,
      tutorialFirstDrawUsed: true,
      lifetimeDraws: (next.lifetimeDraws ?? 0) + 1,
    };
  } else if (next.rateUpTickets > 0) {
    next = { ...consumeRateUpTicket(next), lifetimeDraws: (next.lifetimeDraws ?? 0) + 1 };
  } else if (remainingRateUpAdSlots(next, config) > 0) {
    next = {
      ...next,
      rateUpUsed: next.rateUpUsed + 1,
      lifetimeDraws: (next.lifetimeDraws ?? 0) + 1,
    };
  }

  let adNyangCoin = 0;
  if (wantNyang > 0) {
    const toss = await grantNyangCoinOnce(next, {
      tossUserKey: next.userId,
      rewardId: adDrawRewardId(drawId),
      amount: wantNyang,
    });
    next = toss.state;
    if (toss.result.ok && !toss.result.alreadyGranted) {
      adNyangCoin = toss.result.amount;
      next = {
        ...next,
        adDrawNyangToday: (next.adDrawNyangToday ?? 0) + adNyangCoin,
      };
    } else if (toss.result.ok && toss.result.alreadyGranted) {
      // Same drawRequestId replay mid-transaction — treat as already counted.
      adNyangCoin = wantNyang;
    }
  }

  const dupPaw = isNew ? 0 : dupPawForCard(card, config.economy);
  const confirmed: DrawReservation = {
    ...reservation,
    isNew,
    dupPaw,
    confirmed: true,
    usedAd: adCompleted,
    adNyangCoin,
    remainingAfter: Math.max(0, remainingTotalDraws(next, config)),
  };

  // Manual claim: register the card only — no auto paw/nyangCoin/set grants.
  let toast: string | null = null;
  if (isManualDexClaim(config.economy)) {
    toast = isNew
      ? `${newCardRevealCopy(card).title}\n도감에서 보상을 받아 보세요`
      : duplicateRevealCopy(dupPaw);
  }

  next = { ...next, pendingDraw: confirmed };
  await saveOpsState(next);

  return {
    state: next,
    reservation: confirmed,
    card,
    toast,
    setRewards: [],
    adNyangCoin,
    nyangCoinBalance: next.nyangCoinBalance,
    adNyangNotice: adNyangCoin > 0 ? notice : null,
  };
}

function adPawRewardId(requestId: string) {
  return `adPaw:${requestId}`;
}

export function buildPawAdRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `pawAd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Point-ad complete callback. Grants paw (+ weekend 2×) and adPaw 냥코인
 * in the same transaction. Idempotent on tossUserKey + requestId.
 */
export async function grantPawAdReward(
  state: OpsState,
  body: { requestId: string },
): Promise<
  | {
      state: OpsState;
      gained: number;
      adPawNyangCoin: number;
      adPawNotice: string | null;
    }
  | { error: string }
> {
  await delay(40);
  const { requestId } = body;
  if (!requestId) {
    return { error: "requestId가 필요해요" };
  }
  const config = await loadOpsConfig();
  const today = toKstDateKey();
  let next = applyOpsDailyReset(state, today);

  const prior = (next.pawAdLedger ?? []).find((row) => row.requestId === requestId);
  const notice =
    config.economy.ncoinSources?.adPawRule?.notice ??
    "광고를 봐서 냥코인x1이 지급되었습니다.";
  if (prior) {
    return {
      state: next,
      gained: prior.paw,
      adPawNyangCoin: prior.nyangCoin,
      adPawNotice: prior.nyangCoin > 0 ? notice : null,
    };
  }

  if (remainingPawAds(next, config) <= 0) {
    return { error: "오늘 포인트 광고를 모두 봤어요" };
  }

  let gained = config.economy.pawSources.rewardedAd.pawPerAd;
  if (isWeekendDoublePaw(config.economy)) {
    gained *= config.economy.events.weekendDoublePaw.multiplier;
  }

  // Weekend 2× applies to paw only — 냥코인은 1개 그대로.
  const wantNyang = config.economy.ncoinSources?.adPaw ?? 0;
  const dailyMax = config.economy.ncoinSources?.adPawRule?.dailyMax ?? 10;
  const grantNyang =
    wantNyang > 0 && (next.adPawNyangToday ?? 0) < dailyMax ? wantNyang : 0;

  next = {
    ...next,
    pawAdsUsed: next.pawAdsUsed + 1,
    pawBalance: next.pawBalance + gained,
  };

  let adPawNyangCoin = 0;
  if (grantNyang > 0) {
    const toss = await grantNyangCoinOnce(next, {
      tossUserKey: next.userId,
      rewardId: adPawRewardId(requestId),
      amount: grantNyang,
    });
    next = toss.state;
    if (toss.result.ok && !toss.result.alreadyGranted) {
      adPawNyangCoin = toss.result.amount;
      next = {
        ...next,
        adPawNyangToday: (next.adPawNyangToday ?? 0) + adPawNyangCoin,
      };
    } else if (toss.result.ok && toss.result.alreadyGranted) {
      adPawNyangCoin = grantNyang;
    }
  }

  next = {
    ...next,
    pawAdLedger: [
      ...(next.pawAdLedger ?? []),
      {
        requestId,
        createdAt: Date.now(),
        paw: gained,
        nyangCoin: adPawNyangCoin,
        pawBalance: next.pawBalance,
        nyangCoinBalance: next.nyangCoinBalance,
      },
    ],
  };
  await saveOpsState(next);
  return {
    state: next,
    gained,
    adPawNyangCoin,
    adPawNotice: adPawNyangCoin > 0 ? notice : null,
  };
}

/** Convert `qty` duplicate copies (default 1) to paw. Prefer postDupExchange for idempotent writes. */
export async function convertDuplicate(
  state: OpsState,
  card: DexCard,
  qty = 1,
): Promise<{ state: OpsState; gained: number; owned: DexOwnedMap } | { error: string }> {
  const { buildDupExchangeRequestId, postDupExchange } = await import("./dupExchange");
  const result = await postDupExchange(state, {
    mode: "card",
    cardId: card.id,
    qty,
    requestId: buildDupExchangeRequestId("card", card.id),
  });
  if (!result.response.ok) return { error: result.response.reason };
  return { state: result.state, gained: result.response.gained, owned: result.owned };
}

export { canClaimAttendanceToday } from "./attendanceServer";

/** Manual claim — delegates to server-only attendance API. */
export async function claimAttendanceGift(
  state: OpsState,
): Promise<{ state: OpsState; itemId: string | null; error?: string; response?: import("./attendanceTypes").AttendanceClaimResponse }> {
  const { claimAttendanceOnServer } = await import("./attendanceServer");
  const today = toKstDateKey();
  const next = applyOpsDailyReset(state, today);
  const result = await claimAttendanceOnServer(next);
  if (result.response.error) {
    return { state: result.state, itemId: null, error: result.response.error, response: result.response };
  }
  const itemId =
    result.response.rewards.find((reward) => reward.kind === "item")?.itemId ?? null;
  return { state: result.state, itemId, response: result.response };
}

/** POST /attendance/day7/claim — weekly cycle day 7 + optional ad bonus. */
export async function claimAttendanceDay7(
  state: OpsState,
  body: {
    cycleNo: number;
    withAd: boolean;
    adToken?: string;
    requestId: string;
  },
): Promise<{
  state: OpsState;
  response: import("./attendanceTypes").AttendanceDay7ClaimResponse;
}> {
  const { claimAttendanceDay7OnServer } = await import("./attendanceServer");
  const today = toKstDateKey();
  const next = applyOpsDailyReset(state, today);
  return claimAttendanceDay7OnServer(next, body);
}

/** @deprecated attendance is never auto-granted on boot */
export async function claimAttendanceIfNeeded(
  state: OpsState,
): Promise<{ state: OpsState; itemId: string | null }> {
  return { state, itemId: null };
}

export async function convertAllDuplicates(
  state: OpsState,
): Promise<{ state: OpsState; gained: number; converted: number; owned: DexOwnedMap } | { error: string }> {
  const { buildDupExchangeRequestId, postDupExchange } = await import("./dupExchange");
  const result = await postDupExchange(state, {
    mode: "all",
    requestId: buildDupExchangeRequestId("all"),
  });
  if (!result.response.ok) return { error: result.response.reason };
  return {
    state: result.state,
    gained: result.response.gained,
    converted: result.response.converted,
    owned: result.owned,
  };
}

export async function collectAllRewards(
  state: OpsState,
): Promise<{ state: OpsState; count: number }> {
  const pending = state.rewardInbox.filter((item) => !item.collected);
  if (!pending.length) return { state, count: 0 };
  const next: OpsState = {
    ...state,
    rewardInbox: state.rewardInbox.map((item) =>
      item.collected ? item : { ...item, collected: true },
    ),
  };
  await saveOpsState(next);
  return { state: next, count: pending.length };
}
