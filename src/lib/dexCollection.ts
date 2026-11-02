import { Storage } from "@apps-in-toss/web-framework";

import { isInTossApp } from "./native";
import { markDirty } from "./serverSave";
import type { DexOwnedMap, DexOwnedRecord } from "./dexTypes";

const DEX_KEY = "lucky-cat.dex-collection";

/** 시안 23/107과 맞춰 둔 로컬 목 보유 데이터. 나중에 서버/유저 저장소로 교체해요. */
export const MOCK_DEX_OWNED: DexOwnedRecord[] = [
  { id: "abyssinian_1", firstSeen: "2026-09-12", count: 1, isNew: false },
  { id: "abyssinian_2", firstSeen: "2026-09-18", count: 2, isNew: false },
  { id: "abyssinian_3", firstSeen: "2026-09-21", count: 1, isNew: false },
  { id: "abyssinian_4", firstSeen: "2026-09-28", count: 1, isNew: false },
  { id: "abyssinian_5", firstSeen: "2026-10-02", count: 1, isNew: false },
  { id: "siamese_1", firstSeen: "2026-09-30", count: 1, isNew: false },
  { id: "siamese_2", firstSeen: "2026-10-07", count: 1, isNew: true },
  { id: "siamese_3", firstSeen: "2026-10-07", count: 2, isNew: false },
  { id: "british_shorthair_1", firstSeen: "2026-10-01", count: 1, isNew: false },
  { id: "british_shorthair_2", firstSeen: "2026-10-04", count: 2, isNew: false },
  { id: "sokoke_1", firstSeen: "2026-10-05", count: 1, isNew: false },
  { id: "bengal_1", firstSeen: "2026-09-22", count: 1, isNew: false },
  { id: "bengal_2", firstSeen: "2026-09-25", count: 1, isNew: false },
  { id: "maine_coon_1", firstSeen: "2026-09-27", count: 1, isNew: false },
  { id: "persian_1", firstSeen: "2026-10-03", count: 1, isNew: false },
  { id: "ragdoll_1", firstSeen: "2026-10-06", count: 1, isNew: false },
  { id: "russian_blue_1", firstSeen: "2026-10-08", count: 1, isNew: false },
  { id: "nyang", firstSeen: "2026-09-20", count: 1, isNew: false },
  { id: "hangang", firstSeen: "2026-10-02", count: 1, isNew: false },
  { id: "hunt", firstSeen: "2026-10-06", count: 1, isNew: false },
  { id: "meowth", firstSeen: "2026-09-16", count: 1, isNew: false },
  { id: "doraemon", firstSeen: "2026-10-01", count: 1, isNew: false },
  { id: "baekho", firstSeen: "2026-10-08", count: 1, isNew: false },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseOwned(raw: string | null): DexOwnedMap | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;
    const next: DexOwnedMap = {};
    for (const [id, entry] of Object.entries(parsed)) {
      if (!isRecord(entry)) continue;
      if (typeof entry.firstSeen !== "string" || typeof entry.count !== "number") continue;
      next[id] = {
        id,
        firstSeen: entry.firstSeen,
        count: entry.count,
        isNew: Boolean(entry.isNew),
      };
    }
    return next;
  } catch {
    return null;
  }
}

type DexRawRead =
  | { status: "missing" }
  | { status: "value"; raw: string }
  | { status: "error" };

/** Missing key and a failed read stay distinct so a blip cannot be saved as `{}`. */
async function readDexRaw(): Promise<DexRawRead> {
  if (isInTossApp()) {
    try {
      const value = await Storage.getItem(DEX_KEY);
      if (value == null) return { status: "missing" };
      return { status: "value", raw: value };
    } catch {
      return { status: "error" };
    }
  }
  try {
    const value = window.localStorage.getItem(DEX_KEY);
    if (value == null) return { status: "missing" };
    return { status: "value", raw: value };
  } catch {
    return { status: "error" };
  }
}

async function writeKey(key: string, value: string): Promise<void> {
  if (isInTossApp()) {
    try {
      await Storage.setItem(key, value);
      markDirty();
      return;
    } catch {
      // fall through
    }
  }
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
  markDirty();
}

/** Owned card ids that are not in `seenDexCardIds`. */
export function unseenOwnedCardIds(owned: DexOwnedMap, seen: readonly string[]): string[] {
  const seenSet = new Set(seen);
  return Object.values(owned)
    .filter((row) => row.count > 0 && row.id && !seenSet.has(row.id))
    .map((row) => row.id);
}

/**
 * Read the collection without writing.
 * Null when the key is absent or the read/parse failed.
 */
export async function peekDexOwned(): Promise<DexOwnedMap | null> {
  const read = await readDexRaw();
  if (read.status !== "value") return null;
  return parseOwned(read.raw);
}

/**
 * Collection for a mutation.
 * `{}` when the member has no key yet (the first card may create it).
 * Null when the read failed — callers must not save over the real collection.
 */
export async function readDexOwnedForUpdate(): Promise<DexOwnedMap | null> {
  const read = await readDexRaw();
  if (read.status === "error") return null;
  if (read.status === "missing") return {};
  return parseOwned(read.raw);
}

export async function loadDexOwned(): Promise<DexOwnedMap> {
  const read = await readDexRaw();
  // Explicit empty `{}` (e.g. DEV new-user reset) must not re-seed the mock catalog.
  // A missing or unreadable key stays unwritten. The first real card calls saveDexOwned.
  if (read.status === "value") {
    const stored = parseOwned(read.raw);
    if (stored) return stored;
  }
  return {};
}

export async function saveDexOwned(owned: DexOwnedMap): Promise<void> {
  await writeKey(DEX_KEY, JSON.stringify(owned));
}

export async function markDexCardViewed(owned: DexOwnedMap, id: string): Promise<DexOwnedMap> {
  const current = owned[id];
  if (!current?.isNew) return owned;
  const next = { ...owned, [id]: { ...current, isNew: false } };
  await saveDexOwned(next);
  return next;
}
