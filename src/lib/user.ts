import { getUserKeyForGame } from "@apps-in-toss/web-framework";

import { createDefaultInventory, createDefaultRoom } from "./room";
import type { Cat, DrawResult, Grade, UserState } from "../types";
import { toKstDateKey } from "./date";
import { isTossApp } from "./tossEnv";

const GAME_USER_HASH_KEY = "lucky-cat.game-user-hash.v1";
const LOCAL_DEV_HASH = "local-dev";

export const TOSS_APP_UPDATE_MESSAGE = "토스 앱을 최신 버전으로 업데이트해 주세요";

export type GameUserHashResult = { ok: true; hash: string } | { ok: false; reason: string };

export function readStoredGameUserHash(): string | null {
  try {
    const value = localStorage.getItem(GAME_USER_HASH_KEY);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function storeGameUserHash(hash: string) {
  try {
    localStorage.setItem(GAME_USER_HASH_KEY, hash);
  } catch {
    /* private mode */
  }
}

/**
 * Game user id from getUserKeyForGame. Stored so history and daily limits stay
 * tied to the same person across visits. Does not call appLogin.
 * Outside Toss, a stable local id keeps the practice grant working.
 */
export async function ensureGameUserHash(): Promise<GameUserHashResult> {
  if (!isTossApp()) {
    const hash = readStoredGameUserHash() ?? LOCAL_DEV_HASH;
    storeGameUserHash(hash);
    return { ok: true, hash };
  }
  try {
    const result = await getUserKeyForGame();
    if (!result || result === "ERROR" || result.type !== "HASH" || !result.hash) {
      return { ok: false, reason: TOSS_APP_UPDATE_MESSAGE };
    }
    storeGameUserHash(result.hash);
    return { ok: true, hash: result.hash };
  } catch {
    return { ok: false, reason: TOSS_APP_UPDATE_MESSAGE };
  }
}

export const MAX_DAILY_REROLLS = 5;

/** 기본 1 + 등급이 오를 때마다 토스 포인트·핑크젤리 1씩 추가 */
export const GRADE_REWARD: Record<Grade, number> = {
  C: 1,
  B: 2,
  A: 3,
  S: 4,
  SSS: 5,
};

export function getDrawReward(grade: Grade): { tossPoints: number; pinkJelly: number } {
  const amount = GRADE_REWARD[grade];
  return { tossPoints: amount, pinkJelly: amount };
}

export function createDefaultUser(): UserState {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `user_${Date.now()}`;

  return {
    userId: `user_${id}`,
    pinkJellyBalance: 0,
    tossPointBalance: 0,
    lastDrawDate: "",
    dailyRerollCount: 0,
    unlockedCatIds: [],
    collection: {},
    lastResult: null,
    inventory: createDefaultInventory(),
    room: createDefaultRoom(),
  };
}

export function hasDrawnToday(user: UserState, today = toKstDateKey()): boolean {
  return user.lastDrawDate === today;
}

export function remainingRerolls(user: UserState, today = toKstDateKey()): number {
  if (user.lastDrawDate !== today) return MAX_DAILY_REROLLS;
  return Math.max(0, MAX_DAILY_REROLLS - user.dailyRerollCount);
}

export function applyDailyReset(user: UserState, today = toKstDateKey()): UserState {
  if (user.lastDrawDate === today) {
    return user.lastResult?.dateKey === today ? user : { ...user, lastResult: null };
  }

  return {
    ...user,
    dailyRerollCount: 0,
    lastResult: user.lastResult?.dateKey === today ? user.lastResult : null,
  };
}

export function applyDraw(
  user: UserState,
  cat: Cat,
  options: { isReroll: boolean; boosted: boolean; today?: string },
): { next: UserState; result: DrawResult } {
  const today = options.today ?? toKstDateKey();
  const isNew = !user.unlockedCatIds.includes(cat.id);
  const previous = user.collection[cat.id];
  const reward = getDrawReward(cat.grade);

  const result: DrawResult = {
    catId: cat.id,
    isNew,
    boosted: options.boosted,
    dateKey: today,
    earnedTossPoints: reward.tossPoints,
    earnedPinkJelly: reward.pinkJelly,
  };

  const next: UserState = {
    ...user,
    pinkJellyBalance: user.pinkJellyBalance + reward.pinkJelly,
    tossPointBalance: user.tossPointBalance + reward.tossPoints,
    lastDrawDate: today,
    dailyRerollCount: user.dailyRerollCount + (options.isReroll ? 1 : 0),
    unlockedCatIds: isNew ? [...user.unlockedCatIds, cat.id] : user.unlockedCatIds,
    collection: {
      ...user.collection,
      [cat.id]: {
        unlockedAt: previous?.unlockedAt ?? today,
        count: (previous?.count ?? 0) + 1,
      },
    },
    lastResult: result,
  };

  return { next, result };
}
