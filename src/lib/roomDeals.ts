/** rewardId for one discounted buy. Prices and the date come from the server. */
export function roomDealRewardId(spendId: string, date: string, requestId: string): string {
  return `roomDeal:${spendId}:${date}:${requestId}`;
}

/** Minutes left until the server reset, as HH:MM. */
export function dealRemainLabel(resetAt: string, now = Date.now()): string {
  const end = Date.parse(resetAt);
  if (!Number.isFinite(end)) return "";
  const total = Math.floor(Math.max(0, end - now) / 60000);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
