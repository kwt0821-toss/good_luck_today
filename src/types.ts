export type Grade = "SSS" | "S" | "A" | "B" | "C";

export type ScreenName = "home" | "result" | "collection";

export type Screen =
  | { name: "home" }
  | { name: "result" }
  | { name: "collection" };

export interface Cat {
  id: string;
  name: string;
  grade: Grade;
  imageUrl: string;
  description: string;
}

export interface CollectionRecord {
  unlockedAt: string;
  count: number;
}

export interface DrawResult {
  catId: string;
  isNew: boolean;
  boosted: boolean;
  dateKey: string;
}

export interface UserState {
  userId: string;
  pinkJellyBalance: number;
  lastDrawDate: string;
  dailyRerollCount: number;
  unlockedCatIds: string[];
  collection: Record<string, CollectionRecord>;
  lastResult: DrawResult | null;
}

export type AdKind = "interstitial" | "rewarded";

export type DrawPurpose = "daily" | "reroll-standard" | "reroll-boosted";

export type GradeFilter = "ALL" | Grade;

export type CollectionSort = "acquired" | "grade";
