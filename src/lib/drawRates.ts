import { cardDisplayName, cardKoreanName, dexAsset } from "./dexCatalog";
import type { DexCard, DexCatalog } from "./dexTypes";
import type { DrawRarityKey, OpsEconomy } from "./opsTypes";

export function rarityOfCard(card: DexCard): DrawRarityKey {
  if (card.type === "special") return "special";
  if (card.type === "character") return "character";
  if (card.type === "legend") return "legend";
  const stars = card.stars ?? 1;
  if (stars <= 1) return "b1";
  if (stars === 2) return "b2";
  if (stars === 3) return "b3";
  if (stars === 4) return "b4";
  return "b5";
}

export function starsLabel(card: DexCard): string {
  if (card.type === "legend") return "LEGEND";
  if (card.type === "special") return "SPECIAL";
  if (card.type === "character") return "CHARACTER";
  const n = card.stars ?? 1;
  return "★".repeat(Math.max(1, Math.min(5, n)));
}

export function cardTitle(card: DexCard): string {
  if (card.type === "breed") return card.breed?.ko || cardDisplayName(card);
  return cardKoreanName(card) || cardDisplayName(card);
}

function poolForRarity(catalog: DexCatalog, rarity: DrawRarityKey): DexCard[] {
  if (rarity === "special") return catalog.cards.filter((c) => c.type === "special");
  if (rarity === "character") return catalog.cards.filter((c) => c.type === "character");
  if (rarity === "legend") return catalog.cards.filter((c) => c.type === "legend");
  const stars = Number(rarity.slice(1));
  return catalog.cards.filter((c) => c.type === "breed" && (c.stars ?? 0) === stars);
}

const RARITY_KEYS: readonly DrawRarityKey[] = [
  "b1",
  "b2",
  "b3",
  "b4",
  "b5",
  "special",
  "character",
  "legend",
];

function isRarityKey(key: string): key is DrawRarityKey {
  return (RARITY_KEYS as readonly string[]).includes(key);
}

/** Weighted grade pick from economy.draws.rates_proposal — no client hardcoding. */
export function pickRarity(economy: OpsEconomy, rateUp: boolean, random = Math.random): DrawRarityKey {
  const table = rateUp ? economy.draws.rates_proposal.rateUp : economy.draws.rates_proposal.normal;
  const entries = Object.entries(table).filter(
    (entry): entry is [DrawRarityKey, number] =>
      isRarityKey(entry[0]) && typeof entry[1] === "number" && entry[1] > 0,
  );
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (!entries.length || total <= 0) return "b1";
  let roll = random() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll < 0) return key;
  }
  return entries[entries.length - 1]?.[0] ?? "b1";
}

export type RatesDisclosureRow = {
  grade: string;
  nameKo: string;
  cards: number;
  normalPct: number;
  rateUpPct: number;
  normalPerCardPct: number;
  rateUpPerCardPct: number;
};

/** Prefer economy.disclosure.rows; fall back to computing from normal/rateUp + catalog counts. */
export function ratesDisclosureRows(economy: OpsEconomy): RatesDisclosureRow[] {
  const raw = economy.draws.rates_proposal.disclosure;
  if (raw && typeof raw === "object" && Array.isArray(raw.rows) && raw.rows.length) {
    return raw.rows.map((row) => ({
      grade: row.grade,
      nameKo: row.nameKo,
      cards: row.cards,
      normalPct: row.normalPct,
      rateUpPct: row.rateUpPct,
      normalPerCardPct: row.normalPerCardPct,
      rateUpPerCardPct: row.rateUpPerCardPct,
    }));
  }
  const normal = economy.draws.rates_proposal.normal;
  const rateUp = economy.draws.rates_proposal.rateUp;
  const fallbackCards: Record<string, number> = {
    b1: 18,
    b2: 18,
    b3: 18,
    b4: 18,
    b5: 18,
    special: 9,
    character: 4,
    legend: 4,
  };
  const labels: Record<string, string> = {
    b1: "1★",
    b2: "2★",
    b3: "3★",
    b4: "4★",
    b5: "5★",
    special: "밈(스페셜)",
    character: "캐릭터",
    legend: "레전드",
  };
  return RARITY_KEYS.map((grade) => {
    const cards = fallbackCards[grade] ?? 1;
    const n = normal[grade] ?? 0;
    const u = rateUp[grade] ?? 0;
    return {
      grade,
      nameKo: labels[grade] ?? grade,
      cards,
      normalPct: Math.round(n * 1000) / 10,
      rateUpPct: Math.round(u * 1000) / 10,
      normalPerCardPct: Math.round((n / cards) * 1000000) / 10000,
      rateUpPerCardPct: Math.round((u / cards) * 1000000) / 10000,
    };
  });
}

export function ratesDisclosureNote(economy: OpsEconomy): string {
  const raw = economy.draws.rates_proposal.disclosure;
  if (raw && typeof raw === "object" && typeof raw.note === "string" && raw.note.trim()) {
    return raw.note;
  }
  if (typeof raw === "string" && raw.trim()) return raw;
  return "같은 등급 안에서는 카드별 확률이 같아요 · 합계 100%";
}

export function pickCardFromCatalog(
  catalog: DexCatalog,
  economy: OpsEconomy,
  rateUp: boolean,
  random = Math.random,
): { card: DexCard; rarity: DrawRarityKey } {
  const rarity = pickRarity(economy, rateUp, random);
  const pool = poolForRarity(catalog, rarity);
  const source = pool.length ? pool : catalog.cards;
  const index = Math.min(source.length - 1, Math.floor(random() * source.length));
  const card = source[Math.max(0, index)] ?? catalog.cards[0];
  return { card, rarity: rarityOfCard(card) };
}

export function cardImageUrls(card: DexCard) {
  return {
    frontUrl: dexAsset(card.front),
    backUrl: dexAsset(card.back),
    thumbUrl: dexAsset(card.thumb),
  };
}

export function dupPawForCard(card: DexCard, economy: OpsEconomy): number {
  const table = economy.pawSources.duplicateConvert;
  if (card.type === "legend") return table.legend;
  if (card.type === "special") return table.special;
  if (card.type === "character") return table.character;
  const stars = card.stars ?? 1;
  if (stars <= 2) return table.common_1to2star;
  return table.rare_3to5star;
}

export function rateRows(economy: OpsEconomy, rateUp: boolean) {
  const table = rateUp ? economy.draws.rates_proposal.rateUp : economy.draws.rates_proposal.normal;
  const labels: Record<string, string> = {
    b1: "품종 1★",
    b2: "품종 2★",
    b3: "품종 3★",
    b4: "품종 4★",
    b5: "품종 5★",
    special: "스페셜",
    character: "캐릭터",
    legend: "레전드",
  };
  return Object.entries(table)
    .filter(([key]) => key in labels)
    .map(([key, value]) => ({
      key,
      label: labels[key] ?? key,
      rate: value,
      percent: `${(value * 100).toFixed(1)}%`,
    }));
}

/** 5성↑ 합계에 쓰는 등급 키 — economy rates + menu rates.highlight 와 동일. */
export const RATE_HIGHLIGHT_KEYS = ["b5", "special", "character", "legend"] as const;

export function sumHighlightRate(
  table: Record<string, number> | undefined,
  keys: readonly string[] = RATE_HIGHLIGHT_KEYS,
): number {
  if (!table) return 0;
  return keys.reduce((sum, key) => sum + (table[key] ?? 0), 0);
}

export function formatHighlightPercent(rate: number): string {
  const pct = rate * 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

export function highlightRatesFromEconomy(economy: OpsEconomy): {
  normalPct: string;
  rateUpPct: string;
} {
  const normal = sumHighlightRate(economy.draws.rates_proposal.normal);
  const rateUp = sumHighlightRate(economy.draws.rates_proposal.rateUp);
  return {
    normalPct: formatHighlightPercent(normal),
    rateUpPct: formatHighlightPercent(rateUp),
  };
}

/** Long-ad duration for rate-up (economy.draws.daily[slot=up].adSeconds). */
export function rateUpAdSecondsFromEconomy(economy: OpsEconomy, fallback = 30): number {
  const up = economy.draws.daily?.find((entry) => entry.slot === "up");
  const seconds = up?.adSeconds;
  return typeof seconds === "number" && seconds > 0 ? Math.floor(seconds) : fallback;
}
