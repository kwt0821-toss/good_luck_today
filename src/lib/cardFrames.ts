import layoutJson from "../../public/assets/frames/layout.json";
import type { DexCard, DexCardType } from "./dexTypes";

/**
 * Card chrome from public/assets/frames (frames-v5).
 * win / plate / ribbon boxes are the percentages in layout.json.
 */
export type FrameBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type FrameFamily = "pink" | "gold";

export type FrameKey =
  | "basic-1"
  | "basic-2"
  | "basic-3"
  | "4star"
  | "5star"
  | "meme"
  | "character"
  | "legend";

export type WindowId =
  | "1star"
  | "2star"
  | "3star"
  | "4star"
  | "5star"
  | "meme"
  | "character"
  | "legend";

/** Percent boxes from public/assets/frames/layout.json. */
export const FRAME_LAYOUT = layoutJson as Record<
  FrameFamily,
  { win: FrameBox; plate: FrameBox; ribbon: FrameBox }
>;

const FAMILY: Record<FrameKey, FrameFamily> = {
  "basic-1": "pink",
  "basic-2": "pink",
  "basic-3": "pink",
  "4star": "pink",
  "5star": "pink",
  meme: "pink",
  character: "pink",
  legend: "gold",
};

/** 1★ window-1star, 2★ window-2star, 3★ window-3star. window-basic is retired. */
const WINDOW: Record<FrameKey, WindowId> = {
  "basic-1": "1star",
  "basic-2": "2star",
  "basic-3": "3star",
  "4star": "4star",
  "5star": "5star",
  meme: "meme",
  character: "character",
  legend: "legend",
};

/** Ribbon breed-name color from frames-v5-spec. Plate grade is always gold. */
const NAME_COLOR: Record<WindowId, string> = {
  "1star": "#7A5236",
  "2star": "#2F5E9E",
  "3star": "#8A4A30",
  "4star": "#1F6B52",
  "5star": "#A3305E",
  meme: "#5A4600",
  character: "#5B3FC4",
  legend: "#6E4510",
};

/** Gold grade mark on the plate (★ and MEME / CHAR / LEGEND). */
export const PLATE_GRADE_COLOR = "#FFD34D";

export type FrameSubject = {
  type: DexCardType;
  stars: number | null;
};

export type ResolvedFrame = {
  key: FrameKey;
  windowId: WindowId;
  family: FrameFamily;
  layout: (typeof FRAME_LAYOUT)["pink"];
  nameColor: string;
  foil: boolean;
  glit: boolean;
  frameSrc: string;
  frameSrcSet: string;
  windowSrc: string;
  windowSrcSet: string;
};

function assetPair(file: string): { src: string; srcSet: string } {
  const one = `/assets/frames/${file}.webp`;
  const two = `/assets/frames/${file}@2x.webp`;
  return { src: one, srcSet: `${one} 1x, ${two} 2x` };
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
  const windowId = WINDOW[key];
  const frame = assetPair(`frame-${key}`);
  const win = assetPair(`window-${windowId}`);
  return {
    key,
    windowId,
    family: FAMILY[key],
    layout: FRAME_LAYOUT[FAMILY[key]],
    nameColor: NAME_COLOR[windowId],
    // 1★·2★·3★ stay without foil. Glit is 4★, 5★, character, legend only.
    foil: windowId !== "1star" && windowId !== "2star" && windowId !== "3star",
    glit: windowId === "4star" || windowId === "5star" || windowId === "legend" || windowId === "character",
    frameSrc: frame.src,
    frameSrcSet: frame.srcSet,
    windowSrc: win.src,
    windowSrcSet: win.srcSet,
  };
}

export function frameSubjectFromCard(card: Pick<DexCard, "type" | "stars">): FrameSubject {
  return { type: card.type, stars: card.stars };
}

export function miniRibbonLabel(card: FrameSubject): string {
  if (card.type === "legend") return "LEGEND";
  if (card.type === "character") return "CHAR";
  if (card.type === "special") return "MEME";
  return "★".repeat(Math.max(1, card.stars ?? 1));
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

/** Breed name stays inside the ribbon box (height and width from layout.json). */
export function ribbonNameFontSize(ribbon: FrameBox, name: string): string {
  const chars = Math.max(1, [...name].length);
  const byHeight = (ribbon.height / 100) * 0.72;
  const byWidth = (ribbon.width / 100 / chars) * 0.92;
  return `min(calc(100cqh * ${byHeight.toFixed(5)}), calc(100cqw * ${byWidth.toFixed(5)}))`;
}
