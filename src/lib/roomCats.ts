import { roomAsset } from "./roomCatalog";

/** One entry in public/assets/room/cat-friends/roomCats.json */
export type RoomCatStatus = "available" | "comingSoon";
export type RoomCatType = "breed" | "legend";
export type RoomCatUnlockRule = { breedId: string } | { legendCardId: string } | null;

export type RoomCatEntry = {
  id: string;
  nameKo: string;
  type: RoomCatType;
  /** true only for the free starter cat (cheese). */
  default?: boolean;
  unlockRule: RoomCatUnlockRule;
  status: RoomCatStatus;
  /** Sprite sheet, relative to /assets/room/cat/ (same layout as cat-sprite.png/json). null = not drawn yet. */
  sprite: string | null;
  /** Drawer icon, relative to /assets/room/. null = use the shared silhouette. */
  icon: string | null;
};

export const ROOM_CATS_URL = roomAsset("cat-friends/roomCats.json");
export const ROOM_CAT_SILHOUETTE = roomAsset("cat-friends/silhouette.webp");

const FALLBACK: RoomCatEntry[] = [
  {
    id: "cheese",
    nameKo: "치즈냥",
    type: "breed",
    default: true,
    unlockRule: null,
    status: "available",
    sprite: "cat-sprite.png",
    icon: "cat-friends/cheese.webp",
  },
];

let catsPromise: Promise<RoomCatEntry[]> | null = null;

function isEntry(value: unknown): value is RoomCatEntry {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.nameKo === "string" &&
    (v.type === "breed" || v.type === "legend") &&
    (v.status === "available" || v.status === "comingSoon")
  );
}

export function loadRoomCats(): Promise<RoomCatEntry[]> {
  if (!catsPromise) {
    catsPromise = fetch(ROOM_CATS_URL)
      .then((res) => (res.ok ? res.json() : null))
      .then((raw) => {
        const list = Array.isArray(raw?.cats) ? (raw.cats as unknown[]).filter(isEntry) : [];
        return list.length ? list : FALLBACK;
      })
      .catch(() => FALLBACK);
  }
  return catsPromise;
}

/** Teaser line for the unlock rule. No progress, no dates. `short` is for the grid cell. */
export function roomCatRuleText(cat: RoomCatEntry, short = false): string {
  if (cat.default || !cat.unlockRule) return short ? "기본 친구" : "처음부터 함께하는 기본 친구";
  if ("breedId" in cat.unlockRule) {
    return short ? "1~5성 모두 모으면" : `${cat.nameKo} 1~5성을 모두 모으면 놀러 와요`;
  }
  return short ? "레전드 카드 얻으면" : `레전드 '${cat.nameKo}' 카드를 얻으면 놀러 와요`;
}

/**
 * Can this cat be placed in the room right now?
 * Launch: only `status: "available"` cats with a sprite are selectable.
 * Later: also check the unlock rule against the dex (all 5 cards of the breed / the legend card).
 */
export function isRoomCatSelectable(
  cat: RoomCatEntry,
  ownedCardIds?: ReadonlySet<string>,
): boolean {
  if (cat.status !== "available" || !cat.sprite) return false;
  if (cat.default || !cat.unlockRule || !ownedCardIds) return true;
  if ("breedId" in cat.unlockRule) {
    const breedId = cat.unlockRule.breedId;
    return [1, 2, 3, 4, 5].every((star) => ownedCardIds.has(`${breedId}_${star}`));
  }
  return ownedCardIds.has(cat.unlockRule.legendCardId);
}
