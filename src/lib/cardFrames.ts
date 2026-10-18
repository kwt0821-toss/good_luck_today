import layoutJson from "../../public/assets/frames/layout.json";
import { withAssetVersion } from "./cardArt";
import type { DexCard, DexCardType } from "./dexTypes";

/**
 * Card chrome from public/assets/frames (frames-v7).
 * win / plate / stars / stamp boxes are percentages of the 900×1400 card.
 */
export type FrameBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type FrameKey =
  | "basic-1"
  | "basic-2"
  | "basic-3"
  | "4star"
  | "5star"
  | "meme"
  | "character"
  | "legend";

export type TierLayout = {
  win: FrameBox;
  plate: FrameBox;
  stars: FrameBox;
  stamp: FrameBox;
  windowBg: string;
  ribbonText: null;
  showStars: boolean;
  starCount: number;
  label: string | null;
};

type LayoutFile = {
  flipButtonZone: FrameBox;
  nameFont: {
    family: string;
    startOfCardHeight: number;
    minOfCardHeight: number;
    lineHeight: number;
  };
  starsFont: {
    sizeOfCardWidth: number;
    size5OfCardWidth: number;
    color: string;
    stroke: string;
  };
  labelFont: {
    sizeOfCardWidth: number;
    sizeMemeCharOfCardWidth: number;
    color: string;
    stroke: string;
    glow: string;
  };
  nameColor: Record<FrameKey, string>;
  tiers: Record<FrameKey, TierLayout>;
};

export const FRAME_LAYOUT = layoutJson as LayoutFile;

/** Bottom-right corner reserved for the rotate button. */
export const FLIP_BUTTON_ZONE = FRAME_LAYOUT.flipButtonZone;

/** Handwritten hint sits above every tier's star row and clear of the stamp. */
export function flipGuideStyle(): { left: string; right: string; bottom: string } {
  const tiers = Object.values(FRAME_LAYOUT.tiers);
  const starsTop = Math.min(...tiers.map((tier) => tier.stars.top));
  const stampRight = Math.max(...tiers.map((tier) => tier.stamp.left + tier.stamp.width));
  return {
    left: `${(stampRight + 3).toFixed(2)}%`,
    right: "2%",
    bottom: `${(100 - starsTop + 0.6).toFixed(2)}%`,
  };
}

export type FrameSubject = {
  type: DexCardType;
  stars: number | null;
};

export type ResolvedFrame = {
  key: FrameKey;
  tier: TierLayout;
  nameColor: string;
  foil: boolean;
  glit: boolean;
  frameSrc: string;
  frameSrcSet: string;
  windowSrc: string;
  windowSrcSet: string;
};

function assetPair(file: string): { src: string; srcSet: string } {
  const one = withAssetVersion(`/assets/frames/${file}.webp`);
  const two = withAssetVersion(`/assets/frames/${file}@2x.webp`);
  return { src: one, srcSet: `${one} 1x, ${two} 2x` };
}

/** 1x and 2x frame + window for this grade. */
export function frameAssetUrls(card: FrameSubject): string[] {
  const frame = resolveFrame(card);
  return [frame.frameSrcSet, frame.windowSrcSet].flatMap((srcSet) =>
    srcSet
      .split(",")
      .map((part) => part.trim().split(/\s+/)[0] ?? "")
      .filter(Boolean),
  );
}

export function frameKeyFor(card: FrameSubject): FrameKey {
  if (card.type === "legend") return "legend";
  if (card.type === "character") return "character";
  if (card.type === "special") return "meme";
  const stars = card.stars ?? 1;
  if (stars <= 1) return "basic-1";
  if (stars === 2) return "basic-2";
  if (stars === 3) return "basic-3";
  if (stars === 4) return "4star";
  return "5star";
}

export function resolveFrame(card: FrameSubject): ResolvedFrame {
  const key = frameKeyFor(card);
  const tier = FRAME_LAYOUT.tiers[key];
  const frame = assetPair(`frame-${key}`);
  const win = assetPair(tier.windowBg);
  const basic = key === "basic-1" || key === "basic-2" || key === "basic-3";
  return {
    key,
    tier,
    nameColor: FRAME_LAYOUT.nameColor[key],
    foil: !basic,
    glit: false,
    frameSrc: frame.src,
    frameSrcSet: frame.srcSet,
    windowSrc: win.src,
    windowSrcSet: win.srcSet,
  };
}

export function frameSubjectFromCard(card: Pick<DexCard, "type" | "stars">): FrameSubject {
  return { type: card.type, stars: card.stars };
}

export function boxStyle(box: FrameBox): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  return {
    left: `${box.left.toFixed(2)}%`,
    top: `${box.top.toFixed(2)}%`,
    width: `${box.width.toFixed(2)}%`,
    height: `${box.height.toFixed(2)}%`,
  };
}
