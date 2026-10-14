import { loadDexCatalog } from "./dexCatalog";
import { loadDexOwned, saveDexOwned } from "./dexCollection";
import type { DexCard, DexOwnedMap } from "./dexTypes";
import { dupPawForCard } from "./drawRates";
import { loadOpsConfig } from "./opsConfig";
import { saveOpsState } from "./opsStorage";
import type { OpsEconomy, OpsState } from "./opsTypes";

export type DupExchangeGradeLine = {
  key: string;
  label: string;
  count: number;
  paw: number;
};

export type DupExchangeLedgerItem = {
  requestId: string;
  createdAt: number;
  mode: "all" | "card";
  cardId?: string;
  converted: number;
  gained: number;
  pawBalance: number;
};

export type DupExchangeResponse =
  | {
      ok: true;
      converted: number;
      gained: number;
      pawBalance: number;
      alreadyProcessed?: boolean;
    }
  | { ok: false; reason: string };

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function buildDupExchangeRequestId(mode: "all" | "card", cardId?: string) {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  if (mode === "card" && cardId) return `dex.dupExchange.card:${cardId}:${id}`;
  return `dex.dupExchange.all:${id}`;
}

export function formatDupBadge(ownedCount: number): string | null {
  const dups = ownedCount - 1;
  if (dups < 1) return null;
  if (dups >= 100) return "x99+";
  return `x${dups}`;
}

function gradeKey(card: DexCard): string {
  if (card.type === "legend") return "legend";
  if (card.type === "character") return "character";
  if (card.type === "special") return "special";
  return `star-${card.stars ?? 1}`;
}

function gradeLabel(card: DexCard): string {
  if (card.type === "legend") return "레전드";
  if (card.type === "character") return "캐릭터";
  if (card.type === "special") return "스페셜";
  return `${card.stars ?? 1}성`;
}

const GRADE_ORDER = [
  "star-1",
  "star-2",
  "star-3",
  "star-4",
  "star-5",
  "special",
  "character",
  "legend",
];

/** Summarize convertible duplicates (count − 1 per card) by grade. */
export function summarizeDupExchange(
  cards: DexCard[],
  owned: DexOwnedMap,
  economy: OpsEconomy,
): { duplicateCount: number; totalPaw: number; lines: DupExchangeGradeLine[] } {
  const buckets = new Map<string, DupExchangeGradeLine>();
  let duplicateCount = 0;
  let totalPaw = 0;

  for (const card of cards) {
    const count = owned[card.id]?.count ?? 0;
    if (count <= 1) continue;
    const extras = count - 1;
    const unit = dupPawForCard(card, economy);
    const paw = unit * extras;
    duplicateCount += extras;
    totalPaw += paw;
    const key = gradeKey(card);
    const prev = buckets.get(key);
    if (prev) {
      prev.count += extras;
      prev.paw += paw;
    } else {
      buckets.set(key, { key, label: gradeLabel(card), count: extras, paw });
    }
  }

  const lines = [...buckets.values()].sort(
    (a, b) => GRADE_ORDER.indexOf(a.key) - GRADE_ORDER.indexOf(b.key),
  );
  return { duplicateCount, totalPaw, lines };
}

/**
 * POST /dex/duplicates/exchange
 * body: { mode:'all'|'card', cardId?, qty?, requestId }
 * Idempotent on tossUserKey + requestId. Always keeps 1 copy of each card.
 */
export async function postDupExchange(
  state: OpsState,
  body: {
    mode: "all" | "card";
    requestId: string;
    cardId?: string;
    qty?: number;
  },
): Promise<{ state: OpsState; owned: DexOwnedMap; response: DupExchangeResponse }> {
  await delay(40);
  const { mode, requestId, cardId, qty } = body;
  if (!requestId || typeof requestId !== "string") {
    const owned = await loadDexOwned();
    return { state, owned, response: { ok: false, reason: "requestId가 필요해요" } };
  }

  const prior = state.dupExchangeLedger.find((row) => row.requestId === requestId);
  if (prior) {
    const owned = await loadDexOwned();
    return {
      state,
      owned,
      response: {
        ok: true,
        converted: prior.converted,
        gained: prior.gained,
        pawBalance: prior.pawBalance,
        alreadyProcessed: true,
      },
    };
  }

  const config = await loadOpsConfig();
  const catalog = await loadDexCatalog();
  let owned = await loadDexOwned();
  const nextOwned: DexOwnedMap = { ...owned };
  let gained = 0;
  let converted = 0;

  if (mode === "all") {
    for (const card of catalog.cards) {
      const record = nextOwned[card.id];
      if (!record || record.count <= 1) continue;
      const extras = record.count - 1;
      gained += dupPawForCard(card, config.economy) * extras;
      converted += extras;
      nextOwned[card.id] = { ...record, count: 1 };
    }
  } else {
    if (!cardId) {
      return { state, owned, response: { ok: false, reason: "카드가 필요해요" } };
    }
    const card = catalog.cards.find((item) => item.id === cardId);
    const record = nextOwned[cardId];
    if (!card || !record || record.count <= 1) {
      return { state, owned, response: { ok: false, reason: "바꿀 중복 카드가 없어요" } };
    }
    const maxQty = record.count - 1;
    const take = Math.min(maxQty, Math.max(1, Math.floor(qty ?? maxQty)));
    if (!Number.isFinite(take) || take < 1) {
      return { state, owned, response: { ok: false, reason: "바꿀 장수를 확인해 주세요" } };
    }
    gained = dupPawForCard(card, config.economy) * take;
    converted = take;
    nextOwned[cardId] = { ...record, count: record.count - take };
  }

  if (converted <= 0) {
    return { state, owned, response: { ok: false, reason: "바꿀 중복 카드가 없어요" } };
  }

  const pawBalance = state.pawBalance + gained;
  const entry: DupExchangeLedgerItem = {
    requestId,
    createdAt: Date.now(),
    mode,
    cardId: mode === "card" ? cardId : undefined,
    converted,
    gained,
    pawBalance,
  };
  const nextState: OpsState = {
    ...state,
    pawBalance,
    dupExchangeLedger: [entry, ...state.dupExchangeLedger].slice(0, 40),
  };

  await saveDexOwned(nextOwned);
  await saveOpsState(nextState);
  return {
    state: nextState,
    owned: nextOwned,
    response: { ok: true, converted, gained, pawBalance },
  };
}
