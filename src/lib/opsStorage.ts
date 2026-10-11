import { Storage } from "@apps-in-toss/web-framework";

import { toKstDateKey } from "./date";
import { isInTossApp } from "./native";
import { loadOpsConfig } from "./opsConfig";
import { applyOpsDailyReset, createDefaultOpsState } from "./opsState";
import type { OpsState } from "./opsTypes";

const OPS_KEY = "lucky-cat.ops-state.v1";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function read(key: string): Promise<string | null> {
  if (isInTossApp()) {
    try {
      return await withTimeout(Storage.getItem(key), 800);
    } catch {
      // preview fallback
    }
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string): Promise<void> {
  if (isInTossApp()) {
    try {
      await withTimeout(Storage.setItem(key, value), 800);
      return;
    } catch {
      // preview fallback
    }
  }
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function parseOps(raw: string | null, fallback: OpsState): OpsState {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return fallback;
    return {
      ...fallback,
      userId: typeof parsed.userId === "string" ? parsed.userId : fallback.userId,
      pawBalance: typeof parsed.pawBalance === "number" ? parsed.pawBalance : fallback.pawBalance,
      tossBalance: typeof parsed.tossBalance === "number" ? parsed.tossBalance : fallback.tossBalance,
      dateKey: typeof parsed.dateKey === "string" ? parsed.dateKey : fallback.dateKey,
      normalDrawsUsed:
        typeof parsed.normalDrawsUsed === "number" ? parsed.normalDrawsUsed : fallback.normalDrawsUsed,
      rateUpUsed: typeof parsed.rateUpUsed === "number" ? parsed.rateUpUsed : fallback.rateUpUsed,
      pawAdsUsed: typeof parsed.pawAdsUsed === "number" ? parsed.pawAdsUsed : fallback.pawAdsUsed,
      tutorialFirstDrawUsed: Boolean(parsed.tutorialFirstDrawUsed),
      tutorialDone: Boolean(parsed.tutorialDone),
      tutorialStep: typeof parsed.tutorialStep === "number" ? parsed.tutorialStep : 1,
      tutorialInterruptions:
        typeof parsed.tutorialInterruptions === "number" ? parsed.tutorialInterruptions : 0,
      installDateKey:
        typeof parsed.installDateKey === "string" ? parsed.installDateKey : fallback.installDateKey,
      attendanceDays:
        typeof parsed.attendanceDays === "number"
          ? parsed.attendanceDays
          : typeof parsed.attendanceClaimed === "number"
            ? parsed.attendanceClaimed
            : 0,
      lastAttendDateKST:
        typeof parsed.lastAttendDateKST === "string"
          ? parsed.lastAttendDateKST
          : typeof parsed.lastAttendanceDateKey === "string"
            ? parsed.lastAttendanceDateKey
            : "",
      attendanceClaimed:
        typeof parsed.attendanceDays === "number"
          ? Math.min(parsed.attendanceDays, 7)
          : typeof parsed.attendanceClaimed === "number"
            ? parsed.attendanceClaimed
            : 0,
      lastAttendanceDateKey:
        typeof parsed.lastAttendDateKST === "string"
          ? parsed.lastAttendDateKST
          : typeof parsed.lastAttendanceDateKey === "string"
            ? parsed.lastAttendanceDateKey
            : "",
      rateUpTickets: typeof parsed.rateUpTickets === "number" ? parsed.rateUpTickets : 0,
      attendanceBadges: parseStringArray(parsed.attendanceBadges),
      claimedMilestoneDays: Array.isArray(parsed.claimedMilestoneDays)
        ? parsed.claimedMilestoneDays.filter((n): n is number => typeof n === "number")
        : [],
      featureIntrosSeen: parseStringArray(parsed.featureIntrosSeen),
      grantedTossRewardIds: parseStringArray(parsed.grantedTossRewardIds),
      grantedSetRewardIds: parseStringArray(parsed.grantedSetRewardIds),
      ownedItemIds: parseStringArray(parsed.ownedItemIds),
      unlockedRoomIds: parseStringArray(parsed.unlockedRoomIds).length
        ? parseStringArray(parsed.unlockedRoomIds)
        : fallback.unlockedRoomIds,
      pendingDraw: null,
      rewardInbox: Array.isArray(parsed.rewardInbox)
        ? parsed.rewardInbox
            .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
            .map((item) => ({
              id: typeof item.id === "string" ? item.id : "",
              label: typeof item.label === "string" ? item.label : "",
              paw: typeof item.paw === "number" ? item.paw : 0,
              toss: typeof item.toss === "number" ? item.toss : 0,
              collected: Boolean(item.collected),
            }))
            .filter((item) => item.id)
        : fallback.rewardInbox,
      lastSeenNoticeId:
        typeof parsed.lastSeenNoticeId === "string" ? parsed.lastSeenNoticeId : "",
    };
  } catch {
    return fallback;
  }
}

export async function loadOpsState(): Promise<OpsState> {
  const config = await loadOpsConfig();
  const today = toKstDateKey();
  const fallback = createDefaultOpsState(config, today);
  const parsed = parseOps(await read(OPS_KEY), fallback);
  const next = applyOpsDailyReset(parsed, today);
  if (next !== parsed) await saveOpsState(next);
  return next;
}

export async function saveOpsState(state: OpsState): Promise<void> {
  await write(OPS_KEY, JSON.stringify(state));
}
