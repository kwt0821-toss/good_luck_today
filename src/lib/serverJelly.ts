import {
  functionEndpoint,
  linkedSignal,
  readSaveToken,
} from "./serverSave";
import { serverWalletActive, serverWalletActiveNow } from "./serverWallet";
import { isTossApp } from "./tossEnv";
import { ensureGameUserHash, readStoredGameUserHash } from "./user";

/**
 * 발바닥 젤리는 서버 잔액이 권위다.
 * 광고 적립과 지출만 바로 보내고, 나머지 적립은 기기 대기열에 모았다가 한 번에 맞춘다.
 * 화면에 보이는 잔액 = 서버 jelly + 아직 대기열에 있는 낙관적 합.
 */

const GET_MS = 5_000;
const EARN_MS = 8_000;
const BATCH_MS = 15_000;
const SPEND_MS = 15_000;
const MIGRATE_MS = 15_000;
const BATCH_LIMIT = 60;
const FLUSH_AT = 5;
const FOREGROUND_MS = 60_000;
const QUEUE_PREFIX = "lucky-cat:jellyPending:";
const BALANCE_CACHE_KEY = "lucky-cat.jelly-balance.v1";
const DROP_ERRORS = new Set(["UNKNOWN_REWARD", "BAD_INPUT", "DAILY_CAP"]);

export type JellyPendingItem = {
  rewardId: string;
  reason: string;
  withWeekend?: boolean;
  withAd?: boolean;
  enqueuedAt: number;
  optimistic: number;
};

export type JellySnapshot = {
  jelly: number;
  jellyMigrated: boolean;
  pendingCount: number;
  displayJelly: number;
  fetchedAt: number;
};

export type JellyItemResult = {
  rewardId: string;
  ok: boolean;
  granted?: boolean;
  alreadyGranted?: boolean;
  amount?: number;
  error?: string;
};

export type JellyFail = { ok: false; error: string; insufficient?: boolean; network?: boolean };

export type JellyEarnResult =
  | { ok: true; jelly: number; displayJelly: number; results: JellyItemResult[] }
  | JellyFail;

export type JellySpendResult =
  | {
      ok: true;
      jelly: number;
      displayJelly: number;
      spent: boolean;
      alreadySpent: boolean;
      amount: number;
    }
  | JellyFail;

type JellyView = { jelly: number; jellyMigrated: boolean; fetchedAt: number };

const listeners = new Set<() => void>();
let snapshot: JellyView | null = null;
let supported: boolean | null = null;
let bootSync: Promise<void> | null = null;
let clientJellyHint = 0;
let localBase: number | null = null;
let baseAdopted = false;
let flushing: Promise<boolean> | null = null;
let flushRetryTimer = 0;
let flushRetryAttempt = 0;
let foregroundTimer = 0;
let lifecycleInstalled = false;
let bootRetryTimer = 0;
let bootRetryAttempt = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function queueKey(): string | null {
  const hash = readStoredGameUserHash();
  if (!hash || hash === "local-dev") return null;
  return `${QUEUE_PREFIX}${hash}`;
}

function readQueue(): JellyPendingItem[] {
  const key = queueKey();
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const items: JellyPendingItem[] = [];
    for (const row of parsed) {
      if (!isRecord(row) || typeof row.rewardId !== "string") continue;
      const optimistic = num(row.optimistic) ?? 0;
      items.push({
        rewardId: row.rewardId,
        reason: typeof row.reason === "string" ? row.reason : "",
        ...(row.withWeekend === true ? { withWeekend: true } : {}),
        ...(row.withAd === true ? { withAd: true } : {}),
        enqueuedAt: num(row.enqueuedAt) ?? Date.now(),
        optimistic,
      });
    }
    return items;
  } catch {
    return [];
  }
}

function writeQueue(items: JellyPendingItem[]) {
  const key = queueKey();
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // private mode / quota
  }
}

function pendingSum(items = readQueue()): number {
  return items.reduce((sum, item) => sum + Math.max(0, item.optimistic), 0);
}

function readBalanceMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(BALANCE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return {};
    const map: Record<string, number> = {};
    for (const [hash, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value)) map[hash] = value;
    }
    return map;
  } catch {
    return {};
  }
}

function readCachedJelly(): number | null {
  const hash = readStoredGameUserHash();
  if (!hash || hash === "local-dev") return null;
  const value = readBalanceMap()[hash];
  return typeof value === "number" ? value : null;
}

function rememberJelly(jelly: number) {
  const hash = readStoredGameUserHash();
  if (!hash || hash === "local-dev" || !Number.isFinite(jelly)) return;
  try {
    const map = readBalanceMap();
    map[hash] = jelly;
    localStorage.setItem(BALANCE_CACHE_KEY, JSON.stringify(map));
  } catch {
    // private mode / quota
  }
}

function emit() {
  listeners.forEach((listener) => listener());
}

function publishSnapshot(jelly: number, jellyMigrated: boolean) {
  snapshot = { jelly, jellyMigrated, fetchedAt: Date.now() };
  rememberJelly(jelly);
  emit();
}

function adoptBase(opsBalance: number) {
  if (baseAdopted) return;
  baseAdopted = true;
  if (snapshot || readCachedJelly() != null) return;
  localBase = Math.max(0, Math.floor(opsBalance) - pendingSum());
}

/** 서버 모드가 꺼져 있으면 로컬 paw 를 그대로 쓴다. */
export function jellyServerPreferred(): boolean {
  return supported !== false && serverWalletActiveNow();
}

/**
 * 화면에 그릴 발바닥 젤리.
 * 서버 숫자를 알기 전에는 저장해 둔 마지막 서버 잔액, 그것도 없으면 ops 잔액을 쓴다.
 * 대기열에 남은 낙관분은 그 위에 더한다.
 */
export function displayJellyBalance(opsBalance: number): number {
  if (!jellyServerPreferred() && !snapshot && readCachedJelly() == null) return opsBalance;
  adoptBase(opsBalance);
  const base = snapshot?.jelly ?? readCachedJelly() ?? localBase;
  if (base == null) return opsBalance;
  if (!jellyServerPreferred() && !snapshot) return opsBalance;
  return base + pendingSum();
}

export function getJellySnapshot(): JellySnapshot | null {
  if (!snapshot) return null;
  const pending = readQueue();
  return {
    jelly: snapshot.jelly,
    jellyMigrated: snapshot.jellyMigrated,
    pendingCount: pending.length,
    displayJelly: snapshot.jelly + pendingSum(pending),
    fetchedAt: snapshot.fetchedAt,
  };
}

export function subscribeJelly(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function serverJellyActive(): Promise<boolean> {
  const wallet = await serverWalletActive();
  return wallet && supported !== false;
}

async function postJelly(
  action: string,
  extra: Record<string, unknown>,
  timeoutMs: number,
  keepalive = false,
): Promise<{ ok: true; json: Record<string, unknown> } | JellyFail> {
  if (!(await serverWalletActive())) return { ok: false, error: "local" };
  const target = functionEndpoint("wallet");
  if (!target || !isTossApp()) return { ok: false, error: "local" };
  const identity = await ensureGameUserHash();
  if (!identity.ok || !identity.hash || identity.hash === "local-dev") {
    return { ok: false, error: "local" };
  }
  const token = await readSaveToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: target.apikey,
  };
  if (token) headers["x-save-token"] = token;
  const body = JSON.stringify({ ...extra, action, hash: identity.hash });
  if (keepalive) {
    try {
      const response = await fetch(target.url, { method: "POST", headers, body, keepalive: true });
      return parseResponse(response);
    } catch {
      return { ok: false, error: "network", network: true };
    }
  }
  const link = linkedSignal(undefined, timeoutMs);
  try {
    const response = await fetch(target.url, { method: "POST", headers, body, signal: link.signal });
    return parseResponse(response);
  } catch {
    return { ok: false, error: "network", network: true };
  } finally {
    link.cancel();
  }
}

async function parseResponse(response: Response): Promise<{ ok: true; json: Record<string, unknown> } | JellyFail> {
  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  const record = isRecord(json) ? json : null;
  if (response.status === 429 || response.status >= 500) {
    return { ok: false, error: record && typeof record.error === "string" ? record.error : `http_${response.status}`, network: true };
  }
  if (record && record.ok === true) return { ok: true, json: record };
  const error = record && typeof record.error === "string" && record.error ? record.error : `http_${response.status}`;
  return {
    ok: false,
    error,
    ...(error === "INSUFFICIENT" ? { insufficient: true } : {}),
  };
}

function parseResults(value: unknown): JellyItemResult[] {
  if (!Array.isArray(value)) return [];
  const rows: JellyItemResult[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.rewardId !== "string") continue;
    rows.push({
      rewardId: item.rewardId,
      ok: item.ok === true,
      ...(item.granted === true ? { granted: true } : {}),
      ...(item.alreadyGranted === true ? { alreadyGranted: true } : {}),
      ...(typeof item.amount === "number" ? { amount: item.amount } : {}),
      ...(typeof item.error === "string" ? { error: item.error } : {}),
    });
  }
  return rows;
}

function shouldRetry(fail: JellyFail): boolean {
  if (fail.error === "local") return false;
  if (fail.network) return true;
  if (fail.error === "timeout") return true;
  return false;
}

function clearFlushRetry() {
  if (flushRetryTimer) window.clearTimeout(flushRetryTimer);
  flushRetryTimer = 0;
  flushRetryAttempt = 0;
}

function scheduleFlushRetry() {
  if (flushRetryTimer) return;
  const delay = Math.min(60_000, 2_000 * 2 ** flushRetryAttempt);
  flushRetryAttempt += 1;
  console.info(`[serverJelly] batch retry in ${delay}ms`);
  flushRetryTimer = window.setTimeout(() => {
    flushRetryTimer = 0;
    void jellyFlushPending();
  }, delay);
}

function applyBatchResults(results: JellyItemResult[], jelly: number | null) {
  const pending = readQueue();
  const byId = new Map(results.map((row) => [row.rewardId, row]));
  const kept: JellyPendingItem[] = [];
  for (const item of pending) {
    const row = byId.get(item.rewardId);
    if (!row) {
      kept.push(item);
      continue;
    }
    if (row.ok) continue;
    if (row.error && DROP_ERRORS.has(row.error)) {
      console.info(`[serverJelly] drop rewardId=${item.rewardId} error=${row.error}`);
      continue;
    }
    kept.push(item);
  }
  writeQueue(kept);
  if (jelly != null) publishSnapshot(jelly, snapshot?.jellyMigrated ?? true);
  else emit();
  if (kept.length && results.some((row) => !row.ok && !(row.error && DROP_ERRORS.has(row.error)))) {
    scheduleFlushRetry();
  } else if (!kept.length) {
    clearFlushRetry();
  }
}

async function jellyGet(): Promise<{ ok: true; jelly: number | null; jellyMigrated: boolean } | JellyFail> {
  const result = await postJelly("get", {}, GET_MS);
  if (!result.ok) return result;
  const jelly = num(result.json.jelly);
  const jellyMigrated = result.json.jellyMigrated === true;
  return { ok: true, jelly, jellyMigrated };
}

export async function jellyEnqueue(item: {
  rewardId: string;
  reason: string;
  optimistic: number;
  withWeekend?: boolean;
  withAd?: boolean;
}): Promise<number> {
  if (!(await serverJellyActive())) return displayJellyBalance(0);
  const pending = readQueue();
  if (!pending.some((row) => row.rewardId === item.rewardId)) {
    pending.push({
      rewardId: item.rewardId,
      reason: item.reason,
      optimistic: Math.max(0, Math.floor(item.optimistic)),
      enqueuedAt: Date.now(),
      ...(item.withWeekend ? { withWeekend: true } : {}),
      ...(item.withAd ? { withAd: true } : {}),
    });
    writeQueue(pending);
    console.info(`[serverJelly] enqueue rewardId=${item.rewardId} optimistic=${item.optimistic} size=${pending.length}`);
  }
  emit();
  if (pending.length >= FLUSH_AT) void jellyFlushPending();
  return displayJellyBalance(localBase ?? 0);
}

export async function jellyFlushPending(): Promise<boolean> {
  if (flushing) return flushing;
  flushing = flushNow(false).finally(() => {
    flushing = null;
  });
  return flushing;
}

async function flushNow(keepalive: boolean): Promise<boolean> {
  if (!(await serverJellyActive())) return false;
  for (let round = 0; round < 8; round += 1) {
    const pending = readQueue();
    if (!pending.length) return true;
    const batch = pending.slice(0, BATCH_LIMIT);
    const result = await postJelly(
      "jelly_earn_batch",
      {
        items: batch.map((item) => ({
          rewardId: item.rewardId,
          ...(item.withWeekend ? { withWeekend: true } : {}),
          ...(item.withAd ? { withAd: true } : {}),
        })),
      },
      BATCH_MS,
      keepalive,
    );
    if (!result.ok) {
      if (shouldRetry(result)) {
        console.info(`[serverJelly] batch failed error=${result.error}`);
        scheduleFlushRetry();
      }
      return false;
    }
    const jelly = num(result.json.jelly);
    const results = parseResults(result.json.results);
    const before = pending.length;
    applyBatchResults(
      results.length ? results : batch.map((item) => ({ rewardId: item.rewardId, ok: true, granted: true })),
      jelly,
    );
    console.info(`[serverJelly] batch ok jelly=${jelly ?? "?"} sent=${batch.length}`);
    if (readQueue().length >= before) return readQueue().length === 0;
  }
  return readQueue().length === 0;
}

export async function jellyEarnImmediate(
  items: { rewardId: string; withWeekend?: boolean }[],
): Promise<JellyEarnResult> {
  if (!(await serverJellyActive())) return { ok: false, error: "local" };
  const result = await postJelly(
    "jelly_earn",
    {
      items: items.map((item) => ({
        rewardId: item.rewardId,
        ...(item.withWeekend ? { withWeekend: true } : {}),
      })),
    },
    EARN_MS,
  );
  if (!result.ok) {
    console.info(`[serverJelly] earn failed error=${result.error}`);
    return result;
  }
  const jelly = num(result.json.jelly);
  const rows = parseResults(result.json.results);
  if (jelly != null) publishSnapshot(jelly, true);
  else emit();
  console.info(`[serverJelly] earn ok jelly=${jelly ?? "?"}`);
  return {
    ok: true,
    jelly: jelly ?? snapshot?.jelly ?? 0,
    displayJelly: displayJellyBalance(jelly ?? 0),
    results: rows,
  };
}

export async function jellySpend(rewardId: string): Promise<JellySpendResult> {
  if (!(await serverJellyActive())) return { ok: false, error: "local" };
  const flushed = await jellyFlushPending();
  if (!flushed && readQueue().length) {
    return { ok: false, error: "network", network: true };
  }
  const result = await postJelly("jelly_spend", { rewardId }, SPEND_MS);
  if (!result.ok) {
    console.info(`[serverJelly] spend failed rewardId=${rewardId} error=${result.error}`);
    const jelly = snapshot?.jelly ?? null;
    if (result.insufficient && jelly != null) publishSnapshot(jelly, snapshot?.jellyMigrated ?? true);
    return result;
  }
  const jelly = num(result.json.jelly);
  if (jelly != null) publishSnapshot(jelly, true);
  console.info(`[serverJelly] spend ok rewardId=${rewardId} jelly=${jelly ?? "?"}`);
  return {
    ok: true,
    jelly: jelly ?? snapshot?.jelly ?? 0,
    displayJelly: displayJellyBalance(jelly ?? 0),
    spent: result.json.spent !== false,
    alreadySpent: result.json.alreadySpent === true,
    amount: num(result.json.amount) ?? 0,
  };
}

async function runBoot(): Promise<void> {
  try {
    const wallet = await serverWalletActive();
    if (!wallet) return;
    adoptBase(clientJellyHint);
    const got = await jellyGet();
    if (!got.ok) {
      if (shouldRetry(got)) scheduleBootRetry();
      return;
    }
    if (got.jelly == null) {
      supported = false;
      console.info("[serverJelly] get has no jelly; local paw stays");
      emit();
      return;
    }
    supported = true;
    let jelly = got.jelly;
    let migrated = got.jellyMigrated;
    if (!migrated) {
      const moved = await postJelly(
        "jelly_migrate",
        { clientJelly: Math.max(0, Math.floor(clientJellyHint)) },
        MIGRATE_MS,
      );
      if (moved.ok) {
        jelly = num(moved.json.jelly) ?? jelly;
        migrated = true;
        console.info(`[serverJelly] migrate ok already=${moved.json.already === true} jelly=${jelly}`);
      } else if (shouldRetry(moved)) {
        scheduleBootRetry();
      }
    }
    publishSnapshot(jelly, migrated);
    console.info(`[serverJelly] get ok jelly=${jelly} migrated=${migrated} pending=${readQueue().length}`);
    bootRetryAttempt = 0;
    if (bootRetryTimer) window.clearTimeout(bootRetryTimer);
    bootRetryTimer = 0;
    await flushNow(false);
    startForegroundTimer();
  } catch {
    console.info("[serverJelly] get failed error=network");
    scheduleBootRetry();
  }
}

function scheduleBootRetry() {
  if (bootRetryTimer) return;
  const delay = Math.min(30_000, 3_000 * 2 ** bootRetryAttempt);
  bootRetryAttempt += 1;
  bootRetryTimer = window.setTimeout(() => {
    bootRetryTimer = 0;
    bootSync = null;
    void syncJellyOnBoot(clientJellyHint);
  }, delay);
}

function startForegroundTimer() {
  if (foregroundTimer || typeof window === "undefined") return;
  foregroundTimer = window.setInterval(() => {
    if (document.visibilityState !== "visible") return;
    if (!readQueue().length) return;
    void jellyFlushPending();
  }, FOREGROUND_MS);
}

export function syncJellyOnBoot(clientJelly: number): Promise<void> {
  clientJellyHint = Math.max(0, Math.floor(clientJelly));
  adoptBase(clientJellyHint);
  if (!bootSync) bootSync = runBoot();
  return bootSync;
}

/** pagehide / 화면이 가려질 때 대기열을 한 번 보낸다. 앱 효과에서 한 번만 호출한다. */
export function installJellyLifecycle() {
  if (lifecycleInstalled || typeof window === "undefined") return;
  lifecycleInstalled = true;
  const hidden = () => {
    if (!jellyServerPreferred() || !readQueue().length) return;
    void flushNow(true);
  };
  window.addEventListener("pagehide", hidden);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") hidden();
  });
  startForegroundTimer();
}
