import type { DexCard } from "./dexTypes";
import type { OpsEconomy } from "./opsTypes";

const FALLBACK = {
  b1: 1,
  b2: 1,
  b3: 1,
  b4: 5,
  b5: 10,
  special: 5,
  character: 7,
  legend: 50,
} as const;

/** Resolve 냥코인 for a first-time new card from economy.newCardFirstGet.nyangCoinByGrade. */
export function nyangCoinForCard(economy: OpsEconomy, card: DexCard): number {
  const first = economy.pawSources.newCardFirstGet;
  const table = first.nyangCoinByGrade ?? FALLBACK;
  if (card.type === "special") return table.special;
  if (card.type === "character") return table.character;
  if (card.type === "legend") return table.legend;
  const stars = card.stars ?? 1;
  if (stars >= 5) return table.b5;
  if (stars >= 4) return table.b4;
  if (stars >= 3) return table.b3;
  if (stars >= 2) return table.b2;
  return table.b1;
}

export function newCardPaw(economy: OpsEconomy): number {
  return economy.pawSources.newCardFirstGet.paw;
}
