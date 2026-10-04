import type { Cat, CatSpecies, Star } from "../types";
import { catImageUrl } from "./catArt";

export const STARS: Star[] = [1, 2, 3, 4, 5];

export const CAT_SPECIES: CatSpecies[] = [
  { id: "calico", name: "삼색이" },
  { id: "ragdoll", name: "랙돌" },
  { id: "persian", name: "페르시안" },
  { id: "siamese", name: "샴" },
  { id: "russian_blue", name: "러시안블루" },
  { id: "maine_coon", name: "메인쿤" },
  { id: "scottish_fold", name: "스코티시폴드" },
  { id: "shorthair", name: "코숏" },
  { id: "tuxedo", name: "턱시도" },
  { id: "mackerel", name: "고등어" },
];

function card(species: CatSpecies, star: Star): Cat {
  const id = `cat_${species.id}_${star}`;
  return {
    id,
    speciesId: species.id,
    name: species.name,
    star,
    imageUrl: catImageUrl(id, species.id, star),
    luckPhrase: "행운 문구",
    description: ["설명 첫째 줄", "설명 둘째 줄"],
  };
}

export const CATS: Cat[] = CAT_SPECIES.flatMap((species) => STARS.map((star) => card(species, star)));

const CATS_BY_ID = new Map(CATS.map((item) => [item.id, item]));

export function getCatById(id: string): Cat | undefined {
  return CATS_BY_ID.get(id);
}

export function getCatsByStar(star: Star): Cat[] {
  return CATS.filter((item) => item.star === star);
}

export function getCatsBySpecies(speciesId: string): Cat[] {
  return CATS.filter((item) => item.speciesId === speciesId).sort((a, b) => a.star - b.star);
}

export function starLabel(star: Star): string {
  return `${star}성`;
}

export const TOTAL_CAT_COUNT = CATS.length;
export const SPECIES_COUNT = CAT_SPECIES.length;
