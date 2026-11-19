import { cardBackUrl, cardLargeUrl, cardThumbUrl } from "./cardArt";
import { cardDisplayName, cardKoreanName } from "./dexCatalog";
import { adjustedGradeRates, isGradeKey, pickSeasonCard, seasonActive, seasonCards, seasonRate } from "./season";
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
  if (card.type === "season") return "시즌";
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
  return isGradeKey(key);
}

/** Weighted grade pick. While a season is on, its rate is taken from b1 only. */
export function pickRarity(economy: OpsEconomy, rateUp: boolean, random = Math.random): DrawRarityKey {
  const table = adjustedGradeRates(economy, rateUp);
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
function withSeasonRow(economy: OpsEconomy, rows: RatesDisclosureRow[]): RatesDisclosureRow[] {
  const event = seasonActive(economy);
  if (!event) return rows;
  const from = event.rates.takenFrom;
  const normal = seasonRate(event, false) * 100;
  const rateUp = seasonRate(event, true) * 100;
  const cards = event.cardIds.length || 1;
  const next = rows.map((row) => {
    if (row.grade !== from) return row;
    const normalPct = Math.max(0, Math.round((row.normalPct - normal) * 1000) / 1000);
    const rateUpPct = Math.max(0, Math.round((row.rateUpPct - rateUp) * 1000) / 1000);
    return {
      ...row,
      normalPct,
      rateUpPct,
      normalPerCardPct: Math.round((normalPct / row.cards) * 10000) / 10000,
      rateUpPerCardPct: Math.round((rateUpPct / row.cards) * 10000) / 10000,
    };
  });
  next.push({
    grade: "season",
    nameKo: "시즌",
    cards,
    normalPct: Math.round(normal * 1000) / 1000,
    rateUpPct: Math.round(rateUp * 1000) / 1000,
    normalPerCardPct: Math.round((normal / cards) * 10000) / 10000,
    rateUpPerCardPct: Math.round((rateUp / cards) * 10000) / 10000,
  });
  return next;
}

export function ratesDisclosureRows(economy: OpsEconomy): RatesDisclosureRow[] {
  const raw = economy.draws.rates_proposal.disclosure;
  if (raw && typeof raw === "object" && Array.isArray(raw.rows) && raw.rows.length) {
    return withSeasonRow(
      economy,
      raw.rows.map((row) => ({
        grade: row.grade,
        nameKo: row.nameKo,
        cards: row.cards,
        normalPct: row.normalPct,
        rateUpPct: row.rateUpPct,
        normalPerCardPct: row.normalPerCardPct,
        rateUpPerCardPct: row.rateUpPerCardPct,
      })),
    );
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
  return withSeasonRow(
    economy,
    RARITY_KEYS.map((grade) => {
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
    }),
  );
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
  bias?: { breedId: string; weightMul: number } | null,
): { card: DexCard; rarity: DrawRarityKey } {
  const event = seasonActive(economy);
  if (event) {
    const seasonWeight = seasonRate(event, rateUp);
    const grades = adjustedGradeRates(economy, rateUp);
    const entries = Object.entries(grades).filter(
      (entry): entry is [DrawRarityKey, number] =>
        isRarityKey(entry[0]) && typeof entry[1] === "number" && entry[1] > 0,
    );
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0) + seasonWeight;
    let roll = random() * (total > 0 ? total : 1);
    if (roll < seasonWeight) {
      const pool = seasonCards(catalog, event);
      const card = pickSeasonCard(pool, random) ?? catalog.cards[0];
      return { card, rarity: "special" };
    }
    roll -= seasonWeight;
    let rarity: DrawRarityKey = entries[entries.length - 1]?.[0] ?? "b1";
    for (const [key, weight] of entries) {
      roll -= weight;
      if (roll < 0) {
        rarity = key;
        break;
      }
    }
    const pool = poolForRarity(catalog, rarity);
    const source = pool.length ? pool : catalog.cards.filter((card) => card.type !== "season");
    const card = pickWeighted(source, rarity, bias, random) ?? catalog.cards[0];
    return { card, rarity: rarityOfCard(card) };
  }
  const rarity = pickRarity(economy, rateUp, random);
  const pool = poolForRarity(catalog, rarity);
  const source = pool.length ? pool : catalog.cards.filter((card) => card.type !== "season");
  const card = pickWeighted(source, rarity, bias, random) ?? catalog.cards[0];
  return { card, rarity: rarityOfCard(card) };
}

/** Breed grades only. Special, character, and legend stay uniform. */
function pickWeighted(
  source: DexCard[],
  rarity: DrawRarityKey,
  bias: { breedId: string; weightMul: number } | null | undefined,
  random: () => number,
): DexCard | undefined {
  if (!source.length) return undefined;
  const breedGrade = rarity.startsWith("b");
  const mul = bias && breedGrade ? bias.weightMul : 1;
  if (!(mul > 1) || !bias) {
    const index = Math.min(source.length - 1, Math.floor(random() * source.length));
    return source[Math.max(0, index)];
  }
  let total = 0;
  const weights = source.map((card) => {
    const weight = card.type === "breed" && card.breed?.id === bias.breedId ? mul : 1;
    total += weight;
    return weight;
  });
  let roll = random() * total;
  for (let i = 0; i < source.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return source[i];
  }
  return source[source.length - 1];
}

export function cardImageUrls(card: DexCard) {
  return {
    frontUrl: cardLargeUrl(card),
    backUrl: cardBackUrl(card),
    thumbUrl: cardThumbUrl(card),
  };
}

export function dupPawForCard(card: DexCard, economy: OpsEconomy): number {
  const table = economy.pawSources.duplicateConvert;
  if (card.type === "season") return table.season ?? economy.seasonEvents?.events[economy.seasonEvents.activeId ?? ""]?.rewards.duplicateConvert.paw ?? table.special;
  if (card.type === "legend") return table.legend;
  if (card.type === "special") return table.special;
  if (card.type === "character") return table.character;
  const stars = card.stars ?? 1;
  if (stars <= 2) return table.common_1to2star;
  return table.rare_3to5star;
}

export function rateRows(economy: OpsEconomy, rateUp: boolean) {
  const table = adjustedGradeRates(economy, rateUp);
  const event = seasonActive(economy);
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
  const rows = Object.entries(table)
    .filter(([key]) => key in labels)
    .map(([key, value]) => ({
      key,
      label: labels[key] ?? key,
      rate: value,
      percent: `${(value * 100).toFixed(1)}%`,
    }));
  if (!event) return rows;
  const rate = seasonRate(event, rateUp);
  const count = event.cardIds.length || 1;
  const per = rate / count;
  const short = (iso: string, shiftMs = 0) => {
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(Date.parse(iso) + shiftMs));
    const [, month, day] = key.split("-");
    return `${Number(month)}/${Number(day)}`;
  };
  const start = short(event.startsAtKST);
  const end = short(event.endsAtKST, -60 * 1000);
  rows.push({
    key: "season",
    label: `시즌 · ${event.nameKo} · ${start}–${end} · 장당 ${(per * 100).toFixed(1)}%`,
    rate,
    percent: `${(rate * 100).toFixed(1)}%`,
  });
  return rows;
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
