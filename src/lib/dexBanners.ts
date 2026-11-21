/** One banner after every `stride` cards or breed rows. A short list gets none. */
export function dexBannerAfter(index: number, stride: number): boolean {
  return stride > 0 && (index + 1) % stride === 0;
}

export function dexBannerStride(tab: "breed" | "special" | "character" | "season" | "legend"): number {
  if (tab === "breed") return 4;
  if (tab === "legend") return 8;
  return 12;
}

/** Split a tab's cards into 4-row chunks. A short tail stays its own chunk with no banner. */
export function chunkDexCards<T>(cards: readonly T[], stride: number): T[][] {
  if (cards.length === 0) return [];
  if (stride <= 0) return [cards.slice()];
  const chunks: T[][] = [];
  for (let index = 0; index < cards.length; index += stride) {
    chunks.push(cards.slice(index, index + stride));
  }
  return chunks;
}
