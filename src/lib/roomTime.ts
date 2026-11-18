import { useEffect, useState } from "react";

import { trustedNow } from "./tossClock";

/** Korea-time bands. A boundary hour belongs to the later band (6 starts morning). */
export type RoomPeriod = "morning" | "day" | "sunset" | "night";

/**
 * Furniture that casts a warm glow.
 * `moonmobile` and `xmastree` stay out of this pass.
 */
export const LIGHT_ITEM_IDS = [
  "floorlamp",
  "moonlamp",
  "starlight",
  "starlamp",
  "fairylights",
  "heartneon",
  "catface_lamp",
  "pendant_lamps",
  "cup_neon",
  "stone_lantern",
  "fireplace",
] as const;

const LIGHT_IDS = new Set<string>(LIGHT_ITEM_IDS);

/** Neon signs share the lamp halo with a pink tint. */
export const NEON_ITEM_IDS = new Set(["heartneon", "cup_neon"]);

/** Wall windows that get a glass gradient and, at dawn and dusk, sun beams. */
export const WINDOW_ITEM_IDS = new Set(["archwindow", "greenhouse_window"]);

export function emitsLight(id: string): boolean {
  return LIGHT_IDS.has(id);
}

/** Asia/Seoul hour in 0–23. Uses the same clock as the rest of the app. */
export function kstHour(date: Date): number {
  const raw = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  let hour = Number(raw.find((part) => part.type === "hour")?.value ?? "0");
  if (!Number.isFinite(hour)) hour = 0;
  if (hour === 24) hour = 0;
  return hour;
}

/**
 * Morning 6:00–9:59, day 10:00–16:59, sunset 17:00–18:59, night otherwise.
 * The boundary is not included in the earlier band.
 */
export function roomPeriod(date: Date): RoomPeriod {
  const hour = kstHour(date);
  if (hour >= 6 && hour < 10) return "morning";
  if (hour >= 10 && hour < 17) return "day";
  if (hour >= 17 && hour < 19) return "sunset";
  return "night";
}

/** Recompute the band every minute, and again when the app comes back. */
export function useRoomPeriod(): RoomPeriod {
  const [period, setPeriod] = useState<RoomPeriod>(() => roomPeriod(trustedNow()));
  useEffect(() => {
    const tick = () => setPeriod(roomPeriod(trustedNow()));
    const id = window.setInterval(tick, 60_000);
    const onShow = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", tick);
    };
  }, []);
  return period;
}
