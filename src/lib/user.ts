import type { Cat, DrawResult, UserState } from "../types";
import { toKstDateKey } from "./date";

export const MAX_DAILY_REROLLS = 5;

export function createDefaultUser(): UserState {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `user_${Date.now()}`;

  return {
    userId: `user_${id}`,
    pinkJellyBalance: 0,
    lastDrawDate: "",
    dailyRerollCount: 0,
    unlockedCatIds: [],
    collection: {},
    lastResult: null,
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

  const result: DrawResult = {
    catId: cat.id,
    isNew,
    boosted: options.boosted,
    dateKey: today,
  };

  const next: UserState = {
    ...user,
    pinkJellyBalance: user.pinkJellyBalance + (isNew ? 1 : 0),
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
