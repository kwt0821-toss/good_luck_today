import type { DexCard } from "./dexTypes";
import type { OpsEconomy } from "./opsTypes";

const FALLBACK = {
  breed_1to3: 1,
  breed_4: 5,
  breed_5: 10,
  special: 5,
  character: 7,
  legend: 50,
} as const;

/** Resolve 냥코인 for a first-time new card from economy.nyangCoinByGrade. */
export function nyangCoinForCard(economy: OpsEconomy, card: DexCard): number {
  const table = economy.pawSources.nyangCoinByGrade ?? FALLBACK;
  if (card.type === "special") return table.special;
  if (card.type === "character") return table.character;
  if (card.type === "legend") return table.legend;
  const stars = card.stars ?? 1;
  if (stars >= 5) return table.breed_5;
  if (stars >= 4) return table.breed_4;
  return table.breed_1to3;
}

export function newCardPaw(economy: OpsEconomy): number {
  return economy.pawSources.newCardFirstGet.paw;
}
