import type { DexCard, DexCardType } from "./dexTypes";

/**
 * Card chrome from public/assets/frames (frames-v5).
 * Boxes match layout.json. Cat placement stays in CardFrame.css
 * (left -7%, width 114%, top 55%).
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

/** Same numbers as public/assets/frames/layout.json. */
export const FRAME_LAYOUT: Record<FrameFamily, { win: FrameBox; plate: FrameBox; ribbon: FrameBox }> = {
  pink: {
    win: { left: 12.549019607843137, top: 17.76937618147448, width: 74.90196078431373, height: 73.47195967233773 },
    plate: { left: 25.19607843137255, top: 9.073724007561438, width: 49.6078431372549, height: 5.103969754253308 },
    ribbon: { left: 31.372549019607842, top: 93.38374291115312, width: 37.254901960784316, height: 4.095778197857593 },
  },
  gold: {
    win: { left: 15.686274509803921, top: 18.3994959042218, width: 68.62745098039215, height: 69.50220541902962 },
    plate: { left: 25.098039215686274, top: 10.459987397605545, width: 49.80392156862745, height: 5.040957781978576 },
    ribbon: { left: 32.84313725490196, top: 89.35097668557026, width: 34.31372549019608, height: 4.662885948330183 },
  },
};

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

/** [한 줄, 이름] */
const TEXT: Record<WindowId, readonly [string, string]> = {
  "1star": ["#5A4030", "#7A5236"],
  "2star": ["#26466E", "#2F5E9E"],
  "3star": ["#6E3A28", "#8A4A30"],
  "4star": ["#1F5A47", "#1F6B52"],
  "5star": ["#7A2A4A", "#A3305E"],
  meme: ["#4A3A00", "#5A4600"],
  character: ["#3E2E7A", "#5B3FC4"],
  legend: ["#4A3210", "#6E4510"],
};

export type FrameSubject = {
  type: DexCardType;
  stars: number | null;
};

export type ResolvedFrame = {
  key: FrameKey;
  windowId: WindowId;
  family: FrameFamily;
  layout: (typeof FRAME_LAYOUT)["pink"];
  lineColor: string;
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
  const [lineColor, nameColor] = TEXT[windowId];
  const frame = assetPair(`frame-${key}`);
  const win = assetPair(`window-${windowId}`);
  return {
    key,
    windowId,
    family: FAMILY[key],
    layout: FRAME_LAYOUT[FAMILY[key]],
    lineColor,
    nameColor,
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
