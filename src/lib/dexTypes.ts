export type DexCardType = "breed" | "special" | "character" | "legend";

export type DexBreed = {
  id: string;
  en: string;
  ko: string;
};

export type DexCard = {
  id: string;
  type: DexCardType;
  breed: DexBreed | null;
  name: { ko: string } | null;
  nameTemp: boolean;
  stars: number | null;
  front: string;
  back: string;
  thumb: string;
};

export type DexCatalog = {
  version: number;
  total: number;
  counts: Record<DexCardType, number>;
  cards: DexCard[];
};

export type DexOwnedRecord = {
  id: string;
  firstSeen: string;
  count: number;
  isNew: boolean;
};

export type DexOwnedMap = Record<string, DexOwnedRecord>;

export type DexTab = DexCardType;
