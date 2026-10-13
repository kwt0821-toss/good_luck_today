/**
 * Nyang-coin (냥코인) icon assets — single source of truth.
 *
 * Pick by CSS display size; for retina use a file ≥ 2× the display px.
 *  - text-adjacent small icons → 32
 *  - badges / buttons / chips  → 64
 *  - medium UI / sheets        → 128
 *  - big FX / celebration      → 512
 */
export const NCOIN_ICON = {
  /** Display ≤16px (2× → 32) */
  sm: "/assets/ncoin/ncoin-32.png",
  /** Display ≤32px (2× → 64) — badges, buttons, chips */
  md: "/assets/ncoin/ncoin-64.png",
  /** Display ≤64px (2× → 128) */
  lg: "/assets/ncoin/ncoin-128.png",
  /** Large FX / celebration */
  xl: "/assets/ncoin/ncoin-512.png",
} as const;

export type NcoinIconSize = keyof typeof NCOIN_ICON;

/** Resolve the best asset for a given on-screen CSS pixel size. */
export function ncoinIcon(displayPx: number): string {
  const need = displayPx * 2;
  if (need <= 32) return NCOIN_ICON.sm;
  if (need <= 64) return NCOIN_ICON.md;
  if (need <= 128) return NCOIN_ICON.lg;
  return NCOIN_ICON.xl;
}
