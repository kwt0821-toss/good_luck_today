import { toKstDateKey } from "./date";
import { loadDexCatalog } from "./dexCatalog";
import { loadDexOwned, saveDexOwned } from "./dexCollection";
import type { DexCard, DexOwnedMap } from "./dexTypes";
import { groupBreedRows, cardsOfType } from "./dexCatalog";
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
import { grantTossOnce } from "./mockToss";

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function evaluateSetRewards(
  state: OpsState,
  owned: DexOwnedMap,
): Promise<{ state: OpsState; rewards: ConfirmDrawResult["setRewards"] }> {
  const config = await loadOpsConfig();
  const catalog = await loadDexCatalog();
  const economy = config.economy;
  let next = state;
  const rewards: ConfirmDrawResult["setRewards"] = [];

  const grant = async (rewardId: string, paw: number, toss: number, label: string) => {
    if (next.grantedSetRewardIds.includes(rewardId)) return;
    next = {
      ...next,
      pawBalance: next.pawBalance + paw,
      grantedSetRewardIds: [...next.grantedSetRewardIds, rewardId],
      rewardInbox: [
        ...next.rewardInbox,
        { id: rewardId, label, paw, toss, collected: false },
      ],
    };
    if (toss > 0) {
      const tossRes = await grantTossOnce(next, {
        tossUserKey: next.userId,
        rewardId: `set:${rewardId}`,
        amountKRW: toss,
      });
      next = tossRes.state;
    }
    rewards.push({ id: rewardId, paw, toss, label });
  };

  const breedRows = groupBreedRows(cardsOfType(catalog, "breed"));
  for (const row of breedRows) {
    const complete = row.slots.every((card) => (owned[card.id]?.count ?? 0) > 0);
    if (complete) {
      await grant(
        `breed:${row.breedId}`,
        economy.pawSources.setComplete.breed_1to5star.paw,
        economy.pawSources.setComplete.breed_1to5star.toss,
        `${row.ko} 1~5성 완성`,
      );
    }
  }

  for (const type of ["special", "character", "legend"] as const) {
    const cards = cardsOfType(catalog, type);
    const complete = cards.length > 0 && cards.every((card) => (owned[card.id]?.count ?? 0) > 0);
    if (complete) {
      const pack = economy.pawSources.setComplete[type];
      await grant(`set:${type}`, pack.paw, pack.toss, `${type} 세트 완성`);
    }
  }

  const full =
    catalog.cards.length > 0 && catalog.cards.every((card) => (owned[card.id]?.count ?? 0) > 0);
  if (full) {
    const pack = economy.pawSources.setComplete.fullDex;
    await grant("set:fullDex", pack.paw, pack.toss, "전체 도감 완성");
  }

  return { state: next, rewards };
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
    };
  } else if (remainingRateUpAdSlots(next, config) > 0) {
    next = { ...next, rateUpUsed: next.rateUpUsed + 1 };
  } else {
    next = consumeRateUpTicket(next);
  }

  let toast: string | null = null;
  const confirmed: DrawReservation = {
    ...reservation,
    isNew,
    dupPaw: isNew ? 0 : dupPawForCard(card, config.economy),
    confirmed: true,
    remainingAfter: Math.max(0, remainingTotalDraws(next, config)),
  };

  if (isNew) {
    const grant = config.economy.pawSources.newCardFirstGet;
    const inboxId = `card:${card.id}`;
    next = {
      ...next,
      pawBalance: next.pawBalance + grant.paw,
      rewardInbox: next.rewardInbox.some((item) => item.id === inboxId)
        ? next.rewardInbox
        : [
            ...next.rewardInbox,
            {
              id: inboxId,
              label: `${card.id} 첫 획득`,
              paw: grant.paw,
              toss: grant.toss,
              collected: false,
            },
          ],
    };
    const tossRes = await grantTossOnce(next, {
      tossUserKey: next.userId,
      rewardId: inboxId,
      amountKRW: grant.toss,
    });
    next = tossRes.state;
    toast = "도감에 등록됐어요! 토스 1원 받았어요";
  }

  const setEval = await evaluateSetRewards(next, owned);
  next = { ...setEval.state, pendingDraw: confirmed };
  await saveOpsState(next);

  return {
    state: next,
    reservation: confirmed,
    card,
    toast,
    setRewards: setEval.rewards,
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

/** Convert one duplicate copy to paw (keeps count at least 1). */
export async function convertDuplicate(
  state: OpsState,
  card: DexCard,
): Promise<{ state: OpsState; gained: number; owned: DexOwnedMap } | { error: string }> {
  const config = await loadOpsConfig();
  const owned = await loadDexOwned();
  const record = owned[card.id];
  if (!record || record.count <= 1) {
    return { error: "바꿀 중복 카드가 없어요" };
  }
  const gained = dupPawForCard(card, config.economy);
  const nextOwned = {
    ...owned,
    [card.id]: { ...record, count: record.count - 1 },
  };
  await saveDexOwned(nextOwned);
  const next = { ...state, pawBalance: state.pawBalance + gained };
  await saveOpsState(next);
  return { state: next, gained, owned: nextOwned };
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
  const config = await loadOpsConfig();
  const catalog = await loadDexCatalog();
  let owned = await loadDexOwned();
  let gained = 0;
  let converted = 0;
  const nextOwned: DexOwnedMap = { ...owned };
  for (const card of catalog.cards) {
    const record = nextOwned[card.id];
    if (!record || record.count <= 1) continue;
    const extras = record.count - 1;
    gained += dupPawForCard(card, config.economy) * extras;
    converted += extras;
    nextOwned[card.id] = { ...record, count: 1 };
  }
  if (converted <= 0) return { error: "바꿀 중복 카드가 없어요" };
  owned = nextOwned;
  await saveDexOwned(owned);
  const next = { ...state, pawBalance: state.pawBalance + gained };
  await saveOpsState(next);
  return { state: next, gained, converted, owned };
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
