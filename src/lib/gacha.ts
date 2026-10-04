import { CATS, getCatsByStar } from "./cats";
import type { Cat, Star } from "../types";

export const STANDARD_WEIGHTS: Record<Star, number> = {
  5: 1,
  4: 4,
  3: 15,
  2: 30,
  1: 50,
};

export const BOOSTED_WEIGHTS: Record<Star, number> = {
  5: 5,
  4: 15,
  3: 30,
  2: 35,
  1: 15,
};

const STAR_ORDER: Star[] = [5, 4, 3, 2, 1];

export function pickStar(isBoosted: boolean, random = Math.random): Star {
  const table = isBoosted ? BOOSTED_WEIGHTS : STANDARD_WEIGHTS;
  const total = STAR_ORDER.reduce((sum, star) => sum + table[star], 0);
  let roll = random() * total;

  for (const star of STAR_ORDER) {
    roll -= table[star];
    if (roll < 0) return star;
  }

  return 1;
}

export function getRandomCat(isBoosted: boolean, random = Math.random): Cat {
  const star = pickStar(isBoosted, random);
  const pool = getCatsByStar(star);
  const source = pool.length > 0 ? pool : CATS;
  const index = Math.min(source.length - 1, Math.floor(random() * source.length));
  return source[index];
}
