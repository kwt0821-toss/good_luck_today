import { roomAsset } from "./roomCatalog";

/** One entry in public/assets/room/cat-friends/roomCats.json */
export type RoomCatStatus = "available" | "comingSoon";
export type RoomCatType = "breed" | "legend";
export type RoomCatUnlockRule = { breedId: string } | { legendCardId: string } | null;

export type RoomCatTapAction = {
  id: string;
  frames: string[];
  fps?: number;
  bubble?: string;
  emoji?: string;
  cooldownMs?: number;
};

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
  /** Played when the cat is tapped in the room. Omitted when the json has none. */
  tapAction?: RoomCatTapAction;
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

function isEntry(value: unknown): value is Record<string, unknown> & RoomCatEntry {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.nameKo === "string" &&
    (v.type === "breed" || v.type === "legend") &&
    (v.status === "available" || v.status === "comingSoon")
  );
}

function readTapAction(value: unknown): RoomCatTapAction | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || !v.id) return undefined;
  if (
    !Array.isArray(v.frames) ||
    v.frames.length === 0 ||
    !v.frames.every((frame) => typeof frame === "string" && frame.length > 0)
  ) {
    return undefined;
  }
  const action: RoomCatTapAction = { id: v.id, frames: v.frames as string[] };
  if (typeof v.fps === "number") action.fps = v.fps;
  if (typeof v.bubble === "string") action.bubble = v.bubble;
  if (typeof v.emoji === "string") action.emoji = v.emoji;
  if (typeof v.cooldownMs === "number") action.cooldownMs = v.cooldownMs;
  return action;
}

function toEntry(value: unknown): RoomCatEntry | null {
  if (!isEntry(value)) return null;
  const entry: RoomCatEntry = {
    id: value.id,
    nameKo: value.nameKo,
    type: value.type,
    unlockRule: value.unlockRule ?? null,
    status: value.status,
    sprite: typeof value.sprite === "string" ? value.sprite : null,
    icon: typeof value.icon === "string" ? value.icon : null,
  };
  if (value.default === true) entry.default = true;
  const tapAction = readTapAction(value.tapAction);
  if (tapAction) entry.tapAction = tapAction;
  return entry;
}

export function loadRoomCats(): Promise<RoomCatEntry[]> {
  if (!catsPromise) {
    catsPromise = fetch(ROOM_CATS_URL)
      .then((res) => (res.ok ? res.json() : null))
      .then((raw) => {
        const list = Array.isArray(raw?.cats)
          ? (raw.cats as unknown[]).map(toEntry).filter((cat): cat is RoomCatEntry => cat !== null)
          : [];
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
