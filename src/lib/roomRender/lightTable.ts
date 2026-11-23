import type { RoomBright, RoomPeriod } from "../roomMood";

export type LightBlend = "screen" | "soft-light" | "multiply";

export type LightPaint = {
  background: string;
  blend: LightBlend;
  opacity: number;
};

export type LightStop = { at: number; opacity: number };

/** Same stops as `@keyframes lucky-lamp` and its dusk/cozy variants. */
export const LAMP_CURVES = {
  lamp: [
    { at: 0, opacity: 0.85 },
    { at: 0.4, opacity: 1 },
    { at: 0.7, opacity: 0.9 },
    { at: 1, opacity: 0.85 },
  ],
  dusk: [
    { at: 0, opacity: 0.55 },
    { at: 0.4, opacity: 0.78 },
    { at: 0.7, opacity: 0.64 },
    { at: 1, opacity: 0.55 },
  ],
  cozy: [
    { at: 0, opacity: 1 },
    { at: 0.4, opacity: 1 },
    { at: 0.7, opacity: 1 },
    { at: 1, opacity: 1 },
  ],
  duskCozy: [
    { at: 0, opacity: 0.825 },
    { at: 0.4, opacity: 1 },
    { at: 0.7, opacity: 0.96 },
    { at: 1, opacity: 0.825 },
  ],
} as const satisfies Record<string, LightStop[]>;

/** Piecewise linear opacity. `t` is the 0–1 position in the keyframe. */
export function lampOpacity(stops: readonly LightStop[], t: number): number {
  if (!stops.length) return 1;
  const x = ((t % 1) + 1) % 1;
  let prev = stops[0];
  for (const stop of stops) {
    if (x <= stop.at) {
      const span = stop.at - prev.at;
      if (span <= 0) return stop.opacity;
      const u = (x - prev.at) / span;
      return prev.opacity + (stop.opacity - prev.opacity) * u;
    }
    prev = stop;
  }
  return prev.opacity;
}

const SKY: Record<RoomPeriod, LightPaint | null> = {
  morning: {
    background: "linear-gradient(180deg, #f7c5d2 0%, #e6c6f4 46%, #f8dcc4 100%)",
    blend: "screen",
    opacity: 0.88,
  },
  day: {
    background: "linear-gradient(180deg, #8ecfff 0%, #d4efff 70%, #f4fbff 100%)",
    blend: "screen",
    opacity: 0.94,
  },
  sunset: {
    background: "linear-gradient(180deg, #ff9a55 0%, #e07ab8 48%, #6a4d92 100%)",
    blend: "screen",
    opacity: 0.9,
  },
  night: null,
};

const WINDOW: Record<RoomPeriod, LightPaint | null> = {
  morning: { background: "linear-gradient(165deg, #ffd0c0, #efc6f4)", blend: "screen", opacity: 0.82 },
  day: { background: "linear-gradient(180deg, #8fd0ff, #e4f5ff)", blend: "screen", opacity: 0.78 },
  sunset: { background: "linear-gradient(165deg, #ffb07a, #e08ad0 72%, #7a5aaa)", blend: "screen", opacity: 0.8 },
  night: null,
};

const SUN: Record<RoomPeriod, LightPaint | null> = {
  morning: {
    background: "linear-gradient(180deg, rgba(255, 236, 196, 0.7), transparent 74%)",
    blend: "screen",
    opacity: 1,
  },
  day: null,
  sunset: {
    background: "linear-gradient(180deg, rgba(255, 168, 96, 0.72), transparent 76%)",
    blend: "screen",
    opacity: 0.85,
  },
  night: null,
};

const WASH: Record<RoomPeriod, LightPaint> = {
  morning: {
    background: "linear-gradient(180deg, rgba(255, 214, 186, 0.72), rgba(244, 186, 214, 0.4))",
    blend: "soft-light",
    opacity: 1,
  },
  day: { background: "rgba(255, 252, 246, 0.5)", blend: "soft-light", opacity: 1 },
  sunset: {
    background: "linear-gradient(180deg, rgba(255, 168, 104, 0.62), rgba(190, 120, 196, 0.36))",
    blend: "soft-light",
    opacity: 1,
  },
  night: { background: "rgba(16, 8, 28, 0.32)", blend: "multiply", opacity: 1 },
};

const WASH_COZY: Record<RoomPeriod, LightPaint> = {
  morning: {
    background: "linear-gradient(180deg, rgba(255,196,140,.85), rgba(255,170,120,.5))",
    blend: "soft-light",
    opacity: 1,
  },
  day: {
    background: "linear-gradient(180deg, rgba(255,206,150,.75), rgba(255,180,120,.5))",
    blend: "soft-light",
    opacity: 1,
  },
  sunset: {
    background: "linear-gradient(180deg, rgba(255,176,104,.78), rgba(255,140,110,.45))",
    blend: "soft-light",
    opacity: 1,
  },
  night: {
    background: "linear-gradient(180deg, rgba(255,184,118,.46), rgba(255,150,100,.3))",
    blend: "soft-light",
    opacity: 1,
  },
};

export function skyPaint(period: RoomPeriod): LightPaint | null {
  return SKY[period];
}

export function windowPaint(period: RoomPeriod): LightPaint | null {
  return WINDOW[period];
}

export function sunbeamPaint(period: RoomPeriod): LightPaint | null {
  return SUN[period];
}

/** Interior wash. Bright and cozy override the plain time-of-day fill. */
export function washPaint(period: RoomPeriod, bright: RoomBright): LightPaint {
  if (bright === "bright") {
    return {
      background: period === "night" ? "rgba(255,250,244,.34)" : "rgba(255,255,250,.62)",
      blend: "soft-light",
      opacity: 1,
    };
  }
  if (bright === "cozy") return WASH_COZY[period];
  return WASH[period];
}

export function lampCurve(period: RoomPeriod, bright: RoomBright): { stops: readonly LightStop[]; staticOpacity: number | null } {
  if (bright === "cozy" && (period === "morning" || period === "day")) {
    return { stops: LAMP_CURVES.cozy, staticOpacity: 0.27 };
  }
  if (bright !== "cozy" && (period === "morning" || period === "day")) {
    return { stops: LAMP_CURVES.lamp, staticOpacity: 0.18 };
  }
  if (bright === "cozy" && period === "sunset") return { stops: LAMP_CURVES.duskCozy, staticOpacity: null };
  if (period === "sunset") return { stops: LAMP_CURVES.dusk, staticOpacity: null };
  if (bright === "cozy") return { stops: LAMP_CURVES.cozy, staticOpacity: 1 };
  return { stops: LAMP_CURVES.lamp, staticOpacity: null };
}
