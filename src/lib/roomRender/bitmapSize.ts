/** Keep one bitmap at or under 4 million pixels. */
export function cappedBitmapSize(
  width: number,
  height: number,
  maxPixels = 4_000_000,
): { width: number; height: number } {
  if (width < 1 || height < 1) return { width: 0, height: 0 };
  if (width * height <= maxPixels) return { width: Math.floor(width), height: Math.floor(height) };
  const scale = Math.sqrt(maxPixels / (width * height));
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  };
}
