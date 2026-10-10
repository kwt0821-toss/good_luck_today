import type { DexCard, DexCardType, DexCatalog, DexOwnedMap, DexTab } from "./dexTypes";

export const DEX_BASE = "/assets/dex";

export function dexAsset(relative: string): string {
  return `${DEX_BASE}/${relative.replace(/^\//, "")}`;
}

export function cardDisplayName(card: DexCard): string {
  if (card.type === "breed") return card.breed?.en ?? card.id;
  return card.name?.ko ?? card.id;
}

export function cardKoreanName(card: DexCard): string {
  if (card.type === "breed") return card.breed?.ko ?? "";
  return card.name?.ko ?? "";
}

let catalogPromise: Promise<DexCatalog> | null = null;

export function loadDexCatalog(): Promise<DexCatalog> {
  if (!catalogPromise) {
    catalogPromise = fetch(dexAsset("cards.json"))
      .then((res) => {
        if (!res.ok) throw new Error("dex catalog missing");
        return res.json() as Promise<DexCatalog>;
      })
      .catch(() => ({
        version: 1,
        total: 0,
        counts: { breed: 0, special: 0, character: 0, legend: 0 },
        cards: [],
      }));
  }
  return catalogPromise;
}

export function cardsOfType(catalog: DexCatalog, type: DexCardType): DexCard[] {
  return catalog.cards.filter((card) => card.type === type);
}

export function ownedCount(cards: DexCard[], owned: DexOwnedMap): number {
  return cards.filter((card) => (owned[card.id]?.count ?? 0) > 0).length;
}

export type DexBreedRow = {
  breedId: string;
  en: string;
  ko: string;
  slots: DexCard[];
};

export function groupBreedRows(cards: DexCard[]): DexBreedRow[] {
  const rows = new Map<string, DexBreedRow>();
  for (const card of cards) {
    if (!card.breed) continue;
    const existing = rows.get(card.breed.id);
    if (existing) {
      existing.slots.push(card);
      continue;
    }
    rows.set(card.breed.id, {
      breedId: card.breed.id,
      en: card.breed.en,
      ko: card.breed.ko,
      slots: [card],
    });
  }
  for (const row of rows.values()) {
    row.slots.sort((a, b) => (a.stars ?? 0) - (b.stars ?? 0));
  }
  return [...rows.values()];
}

export function sortCardsAz(cards: DexCard[], tab: DexTab): DexCard[] {
  return [...cards].sort((a, b) => {
    if (tab === "breed") {
      return (a.breed?.en ?? "").localeCompare(b.breed?.en ?? "", "en");
    }
    return cardKoreanName(a).localeCompare(cardKoreanName(b), "ko");
  });
}

export function sortBreedRowsAz(rows: DexBreedRow[]): DexBreedRow[] {
  return [...rows].sort((a, b) => a.en.localeCompare(b.en, "en"));
}

export function formatMetDate(dateKey: string): { day: string; year: string } {
  const [year, month, day] = dateKey.split("-");
  return {
    day: `${month}.${day}`,
    year: year ?? "",
  };
}

export function groupForCard(catalog: DexCatalog, card: DexCard): DexCard[] {
  if (card.type === "breed" && card.breed) {
    return groupBreedRows(cardsOfType(catalog, "breed")).find((row) => row.breedId === card.breed?.id)
      ?.slots ?? [card];
  }
  return sortCardsAz(cardsOfType(catalog, card.type), card.type);
}

export const TAB_META: { id: DexTab; label: string }[] = [
  { id: "breed", label: "품종" },
  { id: "special", label: "스페셜" },
  { id: "character", label: "캐릭터" },
  { id: "legend", label: "레전드" },
];

export const TAB_COPY: Record<
  Exclude<DexTab, "breed">,
  { en: string; ko: string; note: string }
> = {
  special: {
    en: "Special",
    ko: "스페셜 카드",
    note: "별 등급 없이, 딱 한 종류씩만 있는 특별 카드",
  },
  character: {
    en: "Character",
    ko: "캐릭터 카드",
    note: "어디서 본 듯한 그 고양이들, 계속 늘어나요",
  },
  legend: {
    en: "Legend",
    ko: "레전드 카드",
    note: "아주 가끔, 전설의 고양이가 나타나요",
  },
};
