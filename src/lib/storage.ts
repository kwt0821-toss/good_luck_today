import { Storage } from "@apps-in-toss/web-framework";

import type { CollectionRecord, DrawResult, UserState } from "../types";
import { applyDailyReset, createDefaultUser } from "./user";
import { toKstDateKey } from "./date";

const USER_KEY = "lucky-cat.user-state";

async function read(key: string): Promise<string | null> {
  try {
    return await Storage.getItem(key);
  } catch {
    return window.localStorage.getItem(key);
  }
}

async function write(key: string, value: string): Promise<void> {
  try {
    await Storage.setItem(key, value);
  } catch {
    window.localStorage.setItem(key, value);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseCollection(value: unknown): Record<string, CollectionRecord> {
  if (!isRecord(value)) return {};

  const next: Record<string, CollectionRecord> = {};
  for (const [id, entry] of Object.entries(value)) {
    if (!isRecord(entry)) continue;
    if (typeof entry.unlockedAt !== "string" || typeof entry.count !== "number") continue;
    next[id] = { unlockedAt: entry.unlockedAt, count: entry.count };
  }
  return next;
}

function parseLastResult(value: unknown): DrawResult | null {
  if (!isRecord(value)) return null;
  if (typeof value.catId !== "string") return null;
  if (typeof value.isNew !== "boolean") return null;
  if (typeof value.boosted !== "boolean") return null;
  if (typeof value.dateKey !== "string") return null;
  return {
    catId: value.catId,
    isNew: value.isNew,
    boosted: value.boosted,
    dateKey: value.dateKey,
  };
}

function parseUser(raw: string | null): UserState {
  if (!raw) return createDefaultUser();

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return createDefaultUser();

    const base = createDefaultUser();
    return {
      ...base,
      userId: typeof parsed.userId === "string" ? parsed.userId : base.userId,
      pinkJellyBalance:
        typeof parsed.pinkJellyBalance === "number" ? parsed.pinkJellyBalance : 0,
      lastDrawDate: typeof parsed.lastDrawDate === "string" ? parsed.lastDrawDate : "",
      dailyRerollCount:
        typeof parsed.dailyRerollCount === "number" ? parsed.dailyRerollCount : 0,
      unlockedCatIds: Array.isArray(parsed.unlockedCatIds)
        ? parsed.unlockedCatIds.filter((id): id is string => typeof id === "string")
        : [],
      collection: parseCollection(parsed.collection),
      lastResult: parseLastResult(parsed.lastResult),
    };
  } catch {
    return createDefaultUser();
  }
}

export async function loadUserState(): Promise<UserState> {
  const parsed = parseUser(await read(USER_KEY));
  const next = applyDailyReset(parsed, toKstDateKey());
  if (
    next.dailyRerollCount !== parsed.dailyRerollCount ||
    next.lastResult !== parsed.lastResult
  ) {
    await saveUserState(next);
  }
  return next;
}

export async function saveUserState(user: UserState): Promise<void> {
  await write(USER_KEY, JSON.stringify(user));
}
