import { toKstDateKey } from "./date";
import { loadDexCatalog } from "./dexCatalog";
import { loadDexOwned, saveDexOwned } from "./dexCollection";
import type { DexCard, DexOwnedMap } from "./dexTypes";
import { duplicateRevealCopy, isManualDexClaim, newCardRevealCopy } from "./dexRewards";
import { dupPawForCard } from "./drawRates";
import { isWeekendDoublePaw, loadOpsConfig } from "./opsConfig";
import {
  applyOpsDailyReset,
  consumeRateUpTicket,
  remainingPawAds,
  remainingRateUpAdSlots,
  remainingTotalDraws,
} from "./opsState";
import { saveOpsState } from "./opsStorage";
import type { ConfirmDrawResult, DrawReservation, OpsState } from "./opsTypes";

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Ad-complete callback path. Consumes the draw quota and grants rewards only here.
 */
export async function confirmDrawAfterAd(
  state: OpsState,
  drawId: string,
): Promise<ConfirmDrawResult | { error: string }> {
  await delay(60);
  const config = await loadOpsConfig();
  const today = toKstDateKey();
  let next = applyOpsDailyReset(state, today);
  const reservation = next.pendingDraw;
  if (!reservation || reservation.drawId !== drawId) {
    return { error: "뽑기 예약을 찾을 수 없어요" };
  }
  if (reservation.confirmed) {
    const catalog = await loadDexCatalog();
    const card = catalog.cards.find((item) => item.id === reservation.cardId);
    if (!card) return { error: "카드 정보를 찾지 못했어요" };
    return { state: next, reservation, card, toast: null, setRewards: [] };
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

  const dupPaw = isNew ? 0 : dupPawForCard(card, config.economy);
  const confirmed: DrawReservation = {
    ...reservation,
    isNew,
    dupPaw,
    confirmed: true,
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
  };
}

export async function grantPawAdReward(state: OpsState): Promise<
  { state: OpsState; gained: number } | { error: string }
> {
  await delay(40);
  const config = await loadOpsConfig();
  const today = toKstDateKey();
  let next = applyOpsDailyReset(state, today);
  if (remainingPawAds(next, config) <= 0) {
    return { error: "오늘 포인트 광고를 모두 봤어요" };
  }
  let gained = config.economy.pawSources.rewardedAd.pawPerAd;
  if (isWeekendDoublePaw(config.economy)) {
    gained *= config.economy.events.weekendDoublePaw.multiplier;
  }
  next = {
    ...next,
    pawAdsUsed: next.pawAdsUsed + 1,
    pawBalance: next.pawBalance + gained,
  };
  await saveOpsState(next);
  return { state: next, gained };
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
