import { Analytics } from "@apps-in-toss/web-framework";

import { isTossApp } from "./tossEnv";

export type AnalyticsEvent =
  | "tutorial_step"
  | "tutorial_complete"
  | "tutorial_skip"
  | "draw"
  | "dex_reward_claim"
  | "set_complete"
  | "ad_intro_show"
  | "ad_intro_confirm"
  | "ad_intro_cancel"
  | "ad_complete"
  | "ad_close_early"
  | "ad_load_fail"
  | "ad_fallback_show"
  | "attendance_claim"
  | "jelly_ad_reward"
  | "toss_reward_request"
  | "toss_reward_result"
  | "room_open"
  | "room_item_buy"
  | "room_cat_tap";

export type AdPlacement =
  | "draw_normal"
  | "draw_rateup"
  | "retry"
  | "menu_jelly"
  | "attendance_day7";

type AnalyticsValue = string | number | boolean | undefined;

const MAX_PARAMS = 6;

function blockedParamKey(key: string): boolean {
  if (key === "item_id" || key === "cat_id" || key === "action_id") return false;
  const lower = key.toLowerCase();
  if (lower.includes("user") || lower.includes("key") || lower.includes("token")) return true;
  return lower.includes("id");
}

function cleanParams(
  params: Record<string, AnalyticsValue> | undefined,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!params) return out;
  for (const [key, value] of Object.entries(params)) {
    if (Object.keys(out).length >= MAX_PARAMS) break;
    if (value === undefined) continue;
    if (blockedParamKey(key)) continue;
    out[key] = value;
  }
  return out;
}

/** Fire-and-forget custom event. Never throws. Outside Toss, DEV logs only. */
export function track(name: AnalyticsEvent, params?: Record<string, AnalyticsValue>): void {
  const safe = cleanParams(params);
  if (!isTossApp()) {
    if (import.meta.env.DEV) console.debug("[track]", name, safe);
    return;
  }
  try {
    void Analytics.log({
      log_name: name,
      log_type: "event",
      params: safe,
    }).catch(() => {});
  } catch {
    // Analytics must never break the game.
  }
}

export function adPlacementOf(session: {
  purpose: "draw" | "paw" | "attendanceDay7";
  kind: "short" | "long";
}): AdPlacement {
  if (session.purpose === "paw") return "menu_jelly";
  if (session.purpose === "attendanceDay7") return "attendance_day7";
  return session.kind === "long" ? "draw_rateup" : "draw_normal";
}
