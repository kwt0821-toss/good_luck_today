/** Claimable dex reward ids the rewards sheet has not shown yet. */
export function unseenDexRewardIds(
  claimableIds: readonly string[],
  seen: readonly string[] | undefined,
): string[] {
  const seenSet = new Set(seen ?? []);
  return claimableIds.filter((id) => !seenSet.has(id));
}

/** Mark every current claimable id as seen and drop ids that are no longer claimable. */
export function markDexClaimableSeen(claimableIds: readonly string[]): string[] {
  return [...new Set(claimableIds)];
}

/** Drop claimed (or otherwise gone) ids without marking newly claimable ones as seen. */
export function pruneSeenDexClaimable(
  seen: readonly string[] | undefined,
  claimableIds: readonly string[],
): string[] {
  const live = new Set(claimableIds);
  return (seen ?? []).filter((id) => live.has(id));
}

export function sameStringList(a: readonly string[] | undefined, b: readonly string[]): boolean {
  const left = a ?? [];
  if (left.length !== b.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== b[i]) return false;
  }
  return true;
}
