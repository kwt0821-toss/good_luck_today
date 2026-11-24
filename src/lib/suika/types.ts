import type { OpsEconomy } from "../opsTypes";

/** New fruit's tier → points. Cherry+cherry makes a strawberry (tier 2) = 4. */
export const MERGE_SCORE = [0, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048] as const;

export type FruitTier = {
  tier: number;
  name: string;
  src: string;
};

export const FRUITS: readonly FruitTier[] = [
  { tier: 1, name: "체리", src: "/assets/suika/01_cherry.png" },
  { tier: 2, name: "딸기", src: "/assets/suika/02_strawberry.png" },
  { tier: 3, name: "포도", src: "/assets/suika/03_grape.png" },
  { tier: 4, name: "귤", src: "/assets/suika/04_tangerine.png" },
  { tier: 5, name: "감", src: "/assets/suika/05_persimmon.png" },
  { tier: 6, name: "사과", src: "/assets/suika/06_apple.png" },
  { tier: 7, name: "배", src: "/assets/suika/07_pear.png" },
  { tier: 8, name: "복숭아", src: "/assets/suika/08_peach.png" },
  { tier: 9, name: "파인애플", src: "/assets/suika/09_pineapple.png" },
  { tier: 10, name: "멜론", src: "/assets/suika/10_melon.png" },
  { tier: 11, name: "왕수박", src: "/assets/suika/11_watermelon.png" },
];

/** Share of the watermelon radius. Index is the tier. */
export const RADIUS_FRAC = [0, 0.26, 0.32, 0.39, 0.46, 0.53, 0.61, 0.69, 0.77, 0.85, 0.92, 1] as const;

const DROP_WEIGHT = [0, 5, 4, 3, 2, 2];

export type SuikaTuning = {
  dropCooldownMs: number;
  dangerHoldMs: number;
  boxWidthInWatermelons: number;
  dropTiersMax: number;
};

export function tuningFrom(economy: OpsEconomy | null | undefined): SuikaTuning {
  const raw = economy?.suikaGame;
  return {
    dropCooldownMs: positive(raw?.dropCooldownMs, 550),
    dangerHoldMs: positive(raw?.dangerHoldMs, 2000),
    boxWidthInWatermelons: positive(raw?.boxWidthInWatermelons, 2.25),
    dropTiersMax: Math.min(5, Math.max(1, Math.floor(positive(raw?.dropTiersMax, 5)))),
  };
}

export function fruitByTier(tier: number): FruitTier {
  return FRUITS[tier - 1] ?? FRUITS[0];
}

/** Tiers 1–5 only. Cherry and strawberry show up a little more often. */
export function rollDropTier(maxTier: number, random: () => number = Math.random): number {
  const max = Math.min(5, Math.max(1, Math.floor(maxTier)));
  let total = 0;
  for (let tier = 1; tier <= max; tier += 1) total += DROP_WEIGHT[tier] ?? 1;
  let pick = random() * total;
  for (let tier = 1; tier <= max; tier += 1) {
    pick -= DROP_WEIGHT[tier] ?? 1;
    if (pick <= 0) return tier;
  }
  return 1;
}

function positive(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
