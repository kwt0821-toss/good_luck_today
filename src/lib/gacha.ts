import { CATS, getCatsByGrade } from "./cats";
import type { Cat, Grade } from "../types";

export const STANDARD_WEIGHTS: Record<Grade, number> = {
  SSS: 1,
  S: 4,
  A: 15,
  B: 30,
  C: 50,
};

export const BOOSTED_WEIGHTS: Record<Grade, number> = {
  SSS: 5,
  S: 15,
  A: 30,
  B: 35,
  C: 15,
};

const GRADE_ORDER: Grade[] = ["SSS", "S", "A", "B", "C"];

export function pickGrade(isBoosted: boolean, random = Math.random): Grade {
  const table = isBoosted ? BOOSTED_WEIGHTS : STANDARD_WEIGHTS;
  const total = GRADE_ORDER.reduce((sum, grade) => sum + table[grade], 0);
  let roll = random() * total;

  for (const grade of GRADE_ORDER) {
    roll -= table[grade];
    if (roll < 0) return grade;
  }

  return "C";
}

export function getRandomCat(isBoosted: boolean, random = Math.random): Cat {
  const grade = pickGrade(isBoosted, random);
  const pool = getCatsByGrade(grade);
  const source = pool.length > 0 ? pool : CATS;
  const index = Math.min(source.length - 1, Math.floor(random() * source.length));
  return source[index];
}
