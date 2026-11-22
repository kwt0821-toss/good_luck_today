export const COZY_LEGACY_KEY = "lucky-cat.cozy-legacy-sent.v1";
export const COZY_GIFT_FROM = 11;
export const COZY_GIFT_TO = 25;

type GiftItem = {
  id: string;
  attendanceOnly?: boolean;
  affectionGift?: boolean;
};

/**
 * First call sends the whole inventory once (pre-server credit).
 * Later calls send only attendance and affection gift ids.
 */
export function cozyClaimOwned(
  roomOwned: Record<string, number>,
  opsIds: string[],
  items: GiftItem[],
  legacySent: boolean,
): Record<string, number> {
  const byId = new Map(items.map((item) => [item.id, item]));
  const out: Record<string, number> = {};
  const ids = new Set([...Object.keys(roomOwned), ...opsIds]);
  for (const id of ids) {
    const item = byId.get(id);
    if (legacySent && (!item || (!item.attendanceOnly && !item.affectionGift))) continue;
    const count = Math.max(roomOwned[id] ?? 0, opsIds.includes(id) ? 1 : 0);
    if (count > 0) out[id] = count;
  }
  return out;
}

export function cozyGiftLevels(): number[] {
  const levels: number[] = [];
  for (let level = COZY_GIFT_FROM; level <= COZY_GIFT_TO; level += 1) levels.push(level);
  return levels;
}

export function nextCozyGiftLevel(claimedLevel: number): number {
  return Math.max(COZY_GIFT_FROM, Math.floor(claimedLevel) + 1);
}
