import { Storage } from "@apps-in-toss/web-framework";

import type { CollectionRecord, DrawResult, RoomPlacement, RoomState, UserState } from "../types";
import { applyDailyReset, createDefaultUser } from "./user";
import { toKstDateKey } from "./date";
import { getItemById } from "./items";
import { createDefaultInventory, createDefaultRoom } from "./room";

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

function parseInventory(value: unknown): Record<string, number> {
  if (!isRecord(value)) return createDefaultInventory();

  const next: Record<string, number> = {};
  for (const [id, count] of Object.entries(value)) {
    if (typeof count !== "number" || count < 1 || !getItemById(id)) continue;
    next[id] = Math.floor(count);
  }
  return { ...createDefaultInventory(), ...next };
}

function parsePlacements(value: unknown): RoomPlacement[] {
  if (!Array.isArray(value)) return createDefaultRoom().placements;

  const next: RoomPlacement[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    if (typeof entry.instanceId !== "string" || typeof entry.itemId !== "string") continue;
    if (typeof entry.x !== "number" || typeof entry.y !== "number") continue;
    if (!getItemById(entry.itemId)) continue;
    next.push({
      instanceId: entry.instanceId,
      itemId: entry.itemId,
      x: entry.x,
      y: entry.y,
    });
  }
  return next;
}

function parseRoom(value: unknown): RoomState {
  const fallback = createDefaultRoom();
  if (!isRecord(value)) return fallback;

  const wallpaperId =
    typeof value.wallpaperId === "string" && getItemById(value.wallpaperId)
      ? value.wallpaperId
      : fallback.wallpaperId;
  const floorId =
    typeof value.floorId === "string" && getItemById(value.floorId) ? value.floorId : fallback.floorId;

  return {
    wallpaperId,
    floorId,
    placements: parsePlacements(value.placements),
  };
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
    earnedTossPoints: typeof value.earnedTossPoints === "number" ? value.earnedTossPoints : 0,
    earnedPinkJelly: typeof value.earnedPinkJelly === "number" ? value.earnedPinkJelly : 0,
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
      tossPointBalance:
        typeof parsed.tossPointBalance === "number" ? parsed.tossPointBalance : 0,
      lastDrawDate: typeof parsed.lastDrawDate === "string" ? parsed.lastDrawDate : "",
      dailyRerollCount:
        typeof parsed.dailyRerollCount === "number" ? parsed.dailyRerollCount : 0,
      unlockedCatIds: Array.isArray(parsed.unlockedCatIds)
        ? parsed.unlockedCatIds.filter((id): id is string => typeof id === "string")
        : [],
      collection: parseCollection(parsed.collection),
      lastResult: parseLastResult(parsed.lastResult),
      inventory: parseInventory(parsed.inventory),
      room: parseRoom(parsed.room),
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
