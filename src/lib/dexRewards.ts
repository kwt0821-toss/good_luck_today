import { loadDexCatalog, groupBreedRows, cardsOfType } from "./dexCatalog";
import { loadDexOwned } from "./dexCollection";
import type { DexCard, DexOwnedMap, DexTab } from "./dexTypes";
import { loadOpsConfig } from "./opsConfig";
import { saveOpsState } from "./opsStorage";
import type { OpsConfig, OpsEconomy, OpsState } from "./opsTypes";
import { grantNyangCoinOnce } from "./mockToss";

/**
 * Manual dex rewards (economy.dexRewards.claimMode = manual).
 * POST /dex/rewards/claim — idempotent on tossUserKey + requestId.
 */

export type DexRewardKind = "newCard" | "breedSet" | "typeSet" | "fullDex";

export type DexReward = {
  id: string;
  kind: DexRewardKind;
  label: string;
  paw: number;
  nyangCoin: number;
  cardId?: string;
  breedId?: string;
  typeSet?: "special" | "character" | "legend";
  tab: DexTab;
};

export type DexClaimRequest = {
  rewardIds: string[] | "all";
  requestId: string;
};

export type DexClaimOk = {
  ok: true;
  claimed: DexReward[];
  paw: number;
  nyangCoin: number;
  alreadyProcessed?: boolean;
};

export type DexClaimResponse = DexClaimOk | { ok: false; reason: string };

export type DexClaimLedgerItem = {
  requestId: string;
  rewardIds: string[];
  createdAt: number;
  paw: number;
  nyangCoin: number;
  nyangCoinBalance: number;
  pawBalance: number;
};

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function isManualDexClaim(economy: OpsEconomy): boolean {
  return (economy.dexRewards?.claimMode ?? "manual") === "manual";
}

export function newCardRewardId(cardId: string) {
  return `newCard:${cardId}`;
}

export function breedSetRewardId(breedId: string) {
  return `set:breed:${breedId}`;
}

export function typeSetRewardId(type: "special" | "character" | "legend") {
  return `set:${type}`;
}

export const FULL_DEX_REWARD_ID = "fullDex";

function isClaimed(state: OpsState, rewardId: string) {
  return state.claimedDexRewardIds.includes(rewardId);
}

/** Build all currently claimable (earned, not yet claimed) dex rewards. */
export async function listClaimableDexRewards(
  state: OpsState,
  owned?: DexOwnedMap,
): Promise<DexReward[]> {
  const config = await loadOpsConfig();
  const catalog = await loadDexCatalog();
  const map = owned ?? (await loadDexOwned());
  const economy = config.economy;
  const first = economy.pawSources.newCardFirstGet;
  const sets = economy.pawSources.setComplete;
  const out: DexReward[] = [];

  for (const card of catalog.cards) {
    if ((map[card.id]?.count ?? 0) <= 0) continue;
    const id = newCardRewardId(card.id);
    if (isClaimed(state, id)) continue;
    const tab: DexTab =
      card.type === "breed" ? "breed" : card.type === "special" ? "special" : card.type === "character" ? "character" : "legend";
    out.push({
      id,
      kind: "newCard",
      cardId: card.id,
      tab,
      paw: first.paw,
      nyangCoin: first.nyangCoin,
      label: `${card.name?.ko ?? card.id} 첫 획득`,
    });
  }

  for (const row of groupBreedRows(cardsOfType(catalog, "breed"))) {
    const complete = row.slots.every((card) => (map[card.id]?.count ?? 0) > 0);
    if (!complete) continue;
    const id = breedSetRewardId(row.breedId);
    if (isClaimed(state, id)) continue;
    out.push({
      id,
      kind: "breedSet",
      breedId: row.breedId,
      tab: "breed",
      paw: sets.breed_1to5star.paw,
      nyangCoin: sets.breed_1to5star.nyangCoin,
      label: `${row.ko} 1~5성 완성`,
    });
  }

  for (const type of ["special", "character", "legend"] as const) {
    const cards = cardsOfType(catalog, type);
    const complete = cards.length > 0 && cards.every((card) => (map[card.id]?.count ?? 0) > 0);
    if (!complete) continue;
    const id = typeSetRewardId(type);
    if (isClaimed(state, id)) continue;
    const pack = sets[type];
    const labelKo = type === "special" ? "스페셜" : type === "character" ? "캐릭터" : "레전드";
    out.push({
      id,
      kind: "typeSet",
      typeSet: type,
      tab: type,
      paw: pack.paw,
      nyangCoin: pack.nyangCoin,
      label: `${labelKo} 세트 완성`,
    });
  }

  const full =
    catalog.cards.length > 0 && catalog.cards.every((card) => (map[card.id]?.count ?? 0) > 0);
  if (full && !isClaimed(state, FULL_DEX_REWARD_ID)) {
    out.push({
      id: FULL_DEX_REWARD_ID,
      kind: "fullDex",
      tab: "breed",
      paw: sets.fullDex.paw,
      nyangCoin: sets.fullDex.nyangCoin,
      label: "도감 전체 완성",
    });
  }

  return out;
}

export function summarizeClaimable(rewards: DexReward[]) {
  return {
    count: rewards.length,
    nyangCoin: rewards.reduce((sum, item) => sum + item.nyangCoin, 0),
    paw: rewards.reduce((sum, item) => sum + item.paw, 0),
  };
}

export function claimableForCard(rewards: DexReward[], cardId: string) {
  return rewards.find((item) => item.kind === "newCard" && item.cardId === cardId) ?? null;
}

export function claimableBreedSet(rewards: DexReward[], breedId: string) {
  return rewards.find((item) => item.kind === "breedSet" && item.breedId === breedId) ?? null;
}

export function claimableTypeSet(
  rewards: DexReward[],
  type: "special" | "character" | "legend",
) {
  return rewards.find((item) => item.kind === "typeSet" && item.typeSet === type) ?? null;
}

export function tabsWithClaimable(rewards: DexReward[]): Set<DexTab> {
  return new Set(rewards.map((item) => item.tab));
}

export function buildDexClaimRequestId(): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `dex_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return `dex.rewards.claim:${id}`;
}

export function newCardRevealCopy(card: DexCard): { title: string; sub: string } {
  if (card.type === "legend") {
    return { title: "전설의 고양이를 만났어요", sub: "도감에서 보상을 받아 보세요" };
  }
  if (card.type === "character") {
    return { title: "캐릭터 고양이를 만났어요", sub: "도감에서 보상을 받아 보세요" };
  }
  if (card.type === "special") {
    return { title: "스페셜 고양이를 만났어요", sub: "도감에서 보상을 받아 보세요" };
  }
  const stars = card.stars ?? 1;
  if (stars >= 5) {
    return { title: "5성 고양이를 만났어요", sub: "도감에서 보상을 받아 보세요" };
  }
  if (stars >= 3) {
    return { title: "희귀한 고양이를 만났어요", sub: "도감에서 보상을 받아 보세요" };
  }
  return { title: "새 고양이를 만났어요", sub: "도감에서 보상을 받아 보세요" };
}

export function duplicateRevealCopy(dupPaw: number): string {
  return `이미 만난 고양이예요 발바닥 포인트 ${dupPaw}P로 바꿀 수 있어요`;
}

/**
 * POST /dex/rewards/claim { rewardIds | 'all', requestId }
 * One transaction: grant paw/nyangCoin + mark claimed. Idempotent by requestId.
 */
export async function postDexRewardsClaim(
  state: OpsState,
  body: DexClaimRequest,
): Promise<{ state: OpsState; response: DexClaimResponse; claimed: DexReward[] }> {
  await delay(50);
  const { rewardIds, requestId } = body;
  if (!requestId || typeof requestId !== "string") {
    return { state, response: { ok: false, reason: "requestId가 필요해요" }, claimed: [] };
  }

  const prior = state.dexClaimLedger.find((row) => row.requestId === requestId);
  if (prior) {
    return {
      state,
      response: {
        ok: true,
        claimed: prior.rewardIds.map((id) => ({
          id,
          kind: "newCard" as const,
          label: id,
          paw: 0,
          nyangCoin: 0,
          tab: "breed" as const,
        })),
        paw: prior.pawBalance,
        nyangCoin: prior.nyangCoinBalance,
        alreadyProcessed: true,
      },
      claimed: [],
    };
  }

  const pending = await listClaimableDexRewards(state);
  const selected =
    rewardIds === "all"
      ? pending
      : pending.filter((item) => Array.isArray(rewardIds) && rewardIds.includes(item.id));

  if (!selected.length) {
    return { state, response: { ok: false, reason: "받을 보상이 없어요" }, claimed: [] };
  }

  let next = state;
  let totalPaw = 0;
  let totalNyang = 0;
  const claimedIds: string[] = [];

  for (const reward of selected) {
    if (next.claimedDexRewardIds.includes(reward.id)) continue;
    totalPaw += reward.paw;
    totalNyang += reward.nyangCoin;
    claimedIds.push(reward.id);
    next = {
      ...next,
      pawBalance: next.pawBalance + reward.paw,
      claimedDexRewardIds: [...next.claimedDexRewardIds, reward.id],
    };
    if (reward.nyangCoin > 0) {
      const toss = await grantNyangCoinOnce(next, {
        tossUserKey: next.userId,
        rewardId: reward.id,
        amount: reward.nyangCoin,
      });
      next = toss.state;
    }
  }

  if (!claimedIds.length) {
    return { state: next, response: { ok: false, reason: "이미 받은 보상이에요" }, claimed: [] };
  }

  const entry: DexClaimLedgerItem = {
    requestId,
    rewardIds: claimedIds,
    createdAt: Date.now(),
    paw: totalPaw,
    nyangCoin: totalNyang,
    pawBalance: next.pawBalance,
    nyangCoinBalance: next.nyangCoinBalance,
  };
  next = {
    ...next,
    dexClaimLedger: [entry, ...next.dexClaimLedger].slice(0, 60),
  };
  await saveOpsState(next);

  const claimed = selected.filter((item) => claimedIds.includes(item.id));
  return {
    state: next,
    response: {
      ok: true,
      claimed,
      paw: next.pawBalance,
      nyangCoin: next.nyangCoinBalance,
    },
    claimed,
  };
}

export async function countClaimableDexRewards(state: OpsState): Promise<number> {
  return (await listClaimableDexRewards(state)).length;
}

/** Accessible label for the claim-all chip (UI uses icons + x N). */
export function dexClaimChipLabel(count: number, nyangCoin: number, paw: number) {
  const parts = [`받을 보상 ${count}개`];
  if (nyangCoin > 0) parts.push(`냥코인 x ${nyangCoin}`);
  if (paw > 0) parts.push(`발바닥 포인트 x ${paw}`);
  return parts.join(" · ");
}

/** @deprecated legacy inbox path — prefer postDexRewardsClaim */
export function legacyInboxStillUsed(_config: OpsConfig) {
  return false;
}
