import { toKstDateKey } from "./date";
import { loadDexCatalog } from "./dexCatalog";
import { loadDexOwned, saveDexOwned } from "./dexCollection";
import type { DexCard, DexOwnedMap } from "./dexTypes";
import { groupBreedRows, cardsOfType } from "./dexCatalog";
import { dupPawForCard } from "./drawRates";
import { isWeekendDoublePaw, loadOpsConfig } from "./opsConfig";
import { applyOpsDailyReset, remainingPawAds } from "./opsState";
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
  } else {
    next = { ...next, rateUpUsed: next.rateUpUsed + 1 };
  }

  let toast: string | null = null;
  const confirmed: DrawReservation = {
    ...reservation,
    isNew,
    dupPaw: isNew ? 0 : dupPawForCard(card, config.economy),
    confirmed: true,
    remainingAfter: Math.max(
      0,
      config.economy.draws.normalPerDay +
        config.economy.draws.rateUpPerDay -
        next.normalDrawsUsed -
        next.rateUpUsed,
    ),
  };

  if (isNew) {
    const grant = config.economy.pawSources.newCardFirstGet;
    next = { ...next, pawBalance: next.pawBalance + grant.paw };
    const tossRes = await grantTossOnce(next, {
      tossUserKey: next.userId,
      rewardId: `card:${card.id}`,
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

export async function claimAttendanceIfNeeded(
  state: OpsState,
): Promise<{ state: OpsState; itemId: string | null }> {
  const config = await loadOpsConfig();
  const today = toKstDateKey();
  let next = applyOpsDailyReset(state, today);
  if (next.lastAttendanceDateKey === today) return { state: next, itemId: null };
  if (next.attendanceClaimed >= config.starter.attendance7.length) {
    return { state: next, itemId: null };
  }
  const gift = config.starter.attendance7[next.attendanceClaimed];
  if (!gift) return { state: next, itemId: null };
  next = {
    ...next,
    attendanceClaimed: next.attendanceClaimed + 1,
    lastAttendanceDateKey: today,
    ownedItemIds: next.ownedItemIds.includes(gift.itemId)
      ? next.ownedItemIds
      : [...next.ownedItemIds, gift.itemId],
  };
  await saveOpsState(next);
  return { state: next, itemId: gift.itemId };
}
