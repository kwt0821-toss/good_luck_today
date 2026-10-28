import { loadOpsConfig } from "./opsConfig";
import type { OpsState, WalletHistoryItem } from "./opsTypes";
import {
  functionEndpoint,
  linkedSignal,
  readSaveToken,
  refreshSaveToken,
  saveToServer,
} from "./serverSave";
import { isTossApp } from "./tossEnv";
import { ensureGameUserHash, readStoredGameUserHash } from "./user";

/**
 * 폰은 요청만 보낸다. 잔액·금액·한도·날짜는 서버 지갑이 정한다.
 * 요청에 넣는 금액은 withdraw 의 amount 뿐이다.
 */

const DEFAULT_MS = 5000;
const MIGRATE_MS = 15_000;
const WITHDRAW_MS = 25_000;
const EARN_CHUNK = 60;
const BOOT_WAIT_MS = 5000;

const HISTORY_STATUSES = ["sending", "done", "failed", "unknown", "manual_review"] as const;
export type WalletHistoryStatus = (typeof HISTORY_STATUSES)[number];

export type WalletHistoryRow = {
  requestId: string;
  amount: number;
  status: WalletHistoryStatus;
  isTest: boolean;
  createdAt: number;
  updatedAt: number;
};

export type WalletView = {
  balance: number;
  remainingToday: number;
  dailyLimit: number;
  min: number;
  unit: number;
  withdrawEnabled: boolean;
  migrated: boolean;
  blocked: boolean;
  history: WalletHistoryRow[];
  fetchedAt: number;
};

export type WalletFail = {
  ok: false;
  error: string;
  network?: true;
  status?: number;
  balance?: number;
  remainingToday?: number;
};

export type EarnItemInput = { rewardId: string; withAd?: boolean };

export type EarnItemResult = {
  rewardId: string;
  ok: boolean;
  granted?: boolean;
  alreadyGranted?: boolean;
  amount?: number;
  error?: string;
};

export type WalletEarnResult = { ok: true; balance: number; results: EarnItemResult[] } | WalletFail;

export type WalletGetResult = { ok: true; view: WalletView } | WalletFail;

export type WalletMigrateResult =
  | { ok: true; already: boolean; balance: number; imported: number; skipped: number }
  | WalletFail;

export type WalletWithdrawResult =
  | {
      ok: true;
      status: WalletHistoryStatus;
      pending: boolean;
      balance: number;
      remainingToday: number;
      item: WalletHistoryRow | null;
    }
  | WalletFail;

export type WalletHistoryResult = { ok: true; items: WalletHistoryRow[] } | WalletFail;

export type ServerWalletStatus = {
  mode: "server" | "local";
  last: string | null;
  balance: number | null;
  remainingToday: number | null;
};

type Retry = { token: boolean; missing: boolean };

let snapshot: WalletView | null = null;
let activeNow = false;
let modeLogged = "";
let bootSync: Promise<WalletView | null> | null = null;
let earnTail: Promise<void> = Promise.resolve();
let recheckTimers: number[] = [];

const status: ServerWalletStatus = {
  mode: "server",
  last: null,
  balance: null,
  remainingToday: null,
};
const statusListeners = new Set<() => void>();
const viewListeners = new Set<(view: WalletView) => void>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toMs(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now();
}

function parseStatus(value: unknown): WalletHistoryStatus {
  if (typeof value === "string" && (HISTORY_STATUSES as readonly string[]).includes(value)) {
    return value as WalletHistoryStatus;
  }
  return "unknown";
}

function parseHistory(value: unknown): WalletHistoryRow[] {
  if (!Array.isArray(value)) return [];
  const rows: WalletHistoryRow[] = [];
  for (const item of value) {
    if (!isRecord(item) || typeof item.requestId !== "string") continue;
    rows.push({
      requestId: item.requestId,
      amount: num(item.amount),
      status: parseStatus(item.status),
      isTest: item.isTest === true,
      createdAt: toMs(item.createdAt),
      updatedAt: toMs(item.updatedAt),
    });
  }
  return rows;
}

function parseItem(value: unknown): WalletHistoryRow | null {
  const rows = parseHistory([value]);
  return rows[0] ?? null;
}

export function errorText(fail: WalletFail): string {
  if (fail.network) return "network";
  if (fail.error.startsWith("http_")) return fail.error;
  if (fail.status && fail.status >= 400 && !fail.error) return `http_${fail.status}`;
  return fail.error || "server_error";
}

function emitStatus() {
  statusListeners.forEach((listener) => listener());
}

function note(last: string) {
  status.last = last;
  status.balance = snapshot?.balance ?? status.balance;
  status.remainingToday = snapshot?.remainingToday ?? status.remainingToday;
  emitStatus();
}

function setSnapshot(next: WalletView) {
  snapshot = next;
  status.balance = next.balance;
  status.remainingToday = next.remainingToday;
  emitStatus();
  viewListeners.forEach((listener) => listener(next));
}

function patchBalance(balance: number) {
  status.balance = balance;
  if (!snapshot) {
    emitStatus();
    return;
  }
  setSnapshot({ ...snapshot, balance, fetchedAt: Date.now() });
}

function patchWithdraw(balance: number, remainingToday: number, item: WalletHistoryRow | null) {
  status.balance = balance;
  status.remainingToday = remainingToday;
  if (!snapshot) {
    emitStatus();
    return;
  }
  const history = item
    ? [item, ...snapshot.history.filter((row) => row.requestId !== item.requestId)]
    : snapshot.history;
  setSnapshot({
    ...snapshot,
    balance,
    remainingToday,
    history,
    fetchedAt: Date.now(),
  });
}

export function getWalletSnapshot(): WalletView | null {
  if (!snapshot) return null;
  return { ...snapshot, history: snapshot.history.slice() };
}

export function serverWalletActiveNow(): boolean {
  return activeNow;
}

export function serverWalletStatus(): ServerWalletStatus {
  return { ...status };
}

export function subscribeServerWallet(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

export function subscribeWalletView(listener: (view: WalletView) => void): () => void {
  viewListeners.add(listener);
  return () => viewListeners.delete(listener);
}

function logMode(mode: "server" | "local", active: boolean) {
  const line = `${mode}:${active}`;
  if (modeLogged === line) return;
  modeLogged = line;
  console.info(`[serverWallet] mode=${mode} active=${active}`);
  emitStatus();
}

export async function resolveWalletMode(): Promise<"server" | "local"> {
  const raw = import.meta.env.VITE_WALLET_MODE;
  const env = typeof raw === "string" ? raw.trim() : "";
  let mode: "server" | "local" = "server";
  if (env === "server" || env === "local") mode = env;
  else {
    try {
      const config = await loadOpsConfig();
      const fromConfig = config.economy.nyangCoin.walletMode;
      if (fromConfig === "local" || fromConfig === "server") mode = fromConfig;
    } catch {
      // 설정을 못 읽으면 서버 모드로 둔다.
    }
  }
  status.mode = mode;
  emitStatus();
  return mode;
}

export async function serverWalletActive(): Promise<boolean> {
  const mode = await resolveWalletMode();
  status.mode = mode;
  let active = false;
  if (mode === "server" && functionEndpoint("wallet") && isTossApp()) {
    const identity = await ensureGameUserHash();
    active = Boolean(identity.ok && identity.hash && identity.hash !== "local-dev");
  }
  activeNow = active;
  logMode(mode, active);
  return active;
}

function serverRewardId(rewardId: string): string {
  const match = /att7:(\d+)$/.exec(rewardId);
  if (match) return `att7:${match[1]}`;
  return rewardId;
}

async function postWallet(
  action: string,
  extra: Record<string, unknown>,
  timeoutMs: number,
  allowMissing: boolean,
  retry: Retry,
): Promise<{ ok: true; json: Record<string, unknown> } | WalletFail> {
  if ((await resolveWalletMode()) !== "server") return { ok: false, error: "local" };
  const target = functionEndpoint("wallet");
  if (!target || !isTossApp()) return { ok: false, error: "local" };
  const identity = await ensureGameUserHash();
  if (!identity.ok || !identity.hash || identity.hash === "local-dev") {
    return { ok: false, error: "local" };
  }
  const token = await readSaveToken();
  const link = linkedSignal(undefined, timeoutMs);
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: target.apikey,
    };
    if (token) headers["x-save-token"] = token;
    let response: Response;
    try {
      response = await fetch(target.url, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...extra, action, hash: identity.hash }),
        signal: link.signal,
      });
    } catch {
      return { ok: false, error: "network", network: true };
    }
    let json: unknown = null;
    try {
      json = await response.json();
    } catch {
      json = null;
    }
    const record = isRecord(json) ? json : null;
    if (record && record.ok === true) return { ok: true, json: record };
    const error =
      record && typeof record.error === "string" && record.error
        ? record.error
        : `http_${response.status}`;
    const fail: WalletFail = {
      ok: false,
      error,
      status: response.status,
      ...(typeof record?.balance === "number" ? { balance: record.balance } : {}),
      ...(typeof record?.remainingToday === "number" ? { remainingToday: record.remainingToday } : {}),
    };
    if (!retry.token && error === "save_token_invalid") {
      const next = await refreshSaveToken();
      if (next) return postWallet(action, extra, timeoutMs, allowMissing, { ...retry, token: true });
    }
    if (!retry.missing && allowMissing && error === "save_not_found") {
      const saved = await saveToServer();
      if (saved) return postWallet(action, extra, timeoutMs, allowMissing, { ...retry, missing: true });
    }
    return fail;
  } finally {
    link.cancel();
  }
}

function viewFromGet(json: Record<string, unknown>): WalletView {
  return {
    balance: num(json.balance),
    remainingToday: num(json.remainingToday),
    dailyLimit: num(json.dailyLimit),
    min: num(json.min, 10),
    unit: num(json.unit, 10),
    withdrawEnabled: json.withdrawEnabled === true,
    migrated: json.migrated === true,
    blocked: json.blocked === true,
    history: parseHistory(json.history),
    fetchedAt: Date.now(),
  };
}

export async function walletGet(): Promise<WalletGetResult> {
  const result = await postWallet("get", {}, DEFAULT_MS, false, { token: false, missing: false });
  if (!result.ok) {
    if (result.error !== "local") console.info(`[serverWallet] get failed error=${errorText(result)}`);
    return result;
  }
  const view = viewFromGet(result.json);
  setSnapshot(view);
  note("get ok");
  console.info(
    `[serverWallet] get ok balance=${view.balance} remainingToday=${view.remainingToday} migrated=${view.migrated} withdrawEnabled=${view.withdrawEnabled}`,
  );
  return { ok: true, view };
}

export async function walletMigrate(): Promise<WalletMigrateResult> {
  const result = await postWallet("migrate", {}, MIGRATE_MS, true, { token: false, missing: false });
  if (!result.ok) {
    if (result.error !== "local") console.info(`[serverWallet] migrate failed error=${errorText(result)}`);
    return result;
  }
  const already = result.json.already === true;
  const balance = num(result.json.balance);
  const imported = num(result.json.imported);
  const skipped = num(result.json.skipped);
  if (snapshot) setSnapshot({ ...snapshot, balance, migrated: true, fetchedAt: Date.now() });
  note("migrate ok");
  console.info(
    `[serverWallet] migrate ok already=${already} imported=${imported} balance=${balance}`,
  );
  return { ok: true, already, balance, imported, skipped };
}

function parseEarnResults(value: unknown, sentIds: string[]): EarnItemResult[] {
  const raw = Array.isArray(value) ? value : [];
  return sentIds.map((rewardId, index) => {
    const found =
      raw.find((item) => isRecord(item) && item.rewardId === rewardId) ??
      (isRecord(raw[index]) ? raw[index] : null);
    if (!isRecord(found)) return { rewardId, ok: false, error: "earn_failed" };
    const ok = found.ok === true;
    return {
      rewardId,
      ok,
      granted: found.granted === true,
      alreadyGranted: found.alreadyGranted === true,
      ...(typeof found.amount === "number" ? { amount: found.amount } : {}),
      ...(!ok && typeof found.error === "string" ? { error: found.error } : {}),
    };
  });
}

async function earnNow(items: EarnItemInput[]): Promise<WalletEarnResult> {
  if (bootSync) {
    await Promise.race([
      bootSync.then(
        () => undefined,
        () => undefined,
      ),
      new Promise<void>((resolve) => {
        window.setTimeout(resolve, BOOT_WAIT_MS);
      }),
    ]);
  }
  if (!(await serverWalletActive())) return { ok: false, error: "local" };
  if (!items.length) {
    return { ok: true, balance: snapshot?.balance ?? 0, results: [] };
  }
  const sent = items.map((item) => ({
    rewardId: serverRewardId(item.rewardId),
    ...(item.withAd ? { withAd: true } : {}),
  }));
  const chunks: typeof sent[] = [];
  for (let i = 0; i < sent.length; i += EARN_CHUNK) chunks.push(sent.slice(i, i + EARN_CHUNK));

  const results: EarnItemResult[] = [];
  let balance = snapshot?.balance ?? 0;
  let anyOk = false;
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const result = await postWallet(
      "earn",
      { items: chunk },
      DEFAULT_MS,
      false,
      { token: false, missing: false },
    );
    if (!result.ok) {
      if (!anyOk) {
        console.info(`[serverWallet] earn failed rewardId=${chunk[0]?.rewardId ?? ""} error=${errorText(result)}`);
        return result;
      }
      for (const item of chunks.slice(index).flat()) {
        results.push({ rewardId: item.rewardId, ok: false, error: result.error });
        console.info(`[serverWallet] earn failed rewardId=${item.rewardId} error=${errorText(result)}`);
      }
      break;
    }
    anyOk = true;
    balance = num(result.json.balance, balance);
    const parsed = parseEarnResults(
      result.json.results,
      chunk.map((item) => item.rewardId),
    );
    results.push(...parsed);
    for (const row of parsed) {
      if (row.ok) {
        console.info(
          `[serverWallet] earn ok rewardId=${row.rewardId} granted=${row.granted === true} amount=${row.amount ?? 0} balance=${balance}`,
        );
      } else {
        console.info(`[serverWallet] earn failed rewardId=${row.rewardId} error=${row.error ?? "earn_failed"}`);
      }
    }
  }
  patchBalance(balance);
  note(results.some((row) => row.ok) ? "earn ok" : "earn failed");
  return { ok: true, balance, results };
}

export function walletEarn(items: EarnItemInput[]): Promise<WalletEarnResult> {
  const run = earnTail.then(() => earnNow(items));
  earnTail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function walletWithdraw(requestId: string, amount: number): Promise<WalletWithdrawResult> {
  const result = await postWallet(
    "withdraw",
    { requestId, amount },
    WITHDRAW_MS,
    true,
    { token: false, missing: false },
  );
  if (!result.ok) {
    if (typeof result.balance === "number") {
      patchWithdraw(result.balance, result.remainingToday ?? snapshot?.remainingToday ?? 0, null);
    }
    if (result.error !== "local") console.info(`[serverWallet] withdraw failed error=${errorText(result)}`);
    note("withdraw failed");
    return result;
  }
  const statusName = parseStatus(result.json.status);
  const pending = result.json.pending === true || statusName === "sending" || statusName === "unknown" || statusName === "manual_review";
  const balance = num(result.json.balance, snapshot?.balance ?? 0);
  const remainingToday = num(result.json.remainingToday, snapshot?.remainingToday ?? 0);
  const item = parseItem(result.json.item);
  patchWithdraw(balance, remainingToday, item);
  note(statusName === "failed" ? "withdraw failed" : pending ? "withdraw pending" : "withdraw done");
  console.info(`[serverWallet] withdraw status=${statusName} balance=${balance} remainingToday=${remainingToday}`);
  return { ok: true, status: statusName, pending, balance, remainingToday, item };
}

export async function walletHistory(before?: string | number): Promise<WalletHistoryResult> {
  const extra: Record<string, unknown> = {};
  if (before != null) extra.before = before;
  const result = await postWallet("history", extra, DEFAULT_MS, true, { token: false, missing: false });
  if (!result.ok) return result;
  const items = parseHistory(result.json.items);
  return { ok: true, items };
}

export function scheduleWalletRecheck() {
  for (const timer of recheckTimers) window.clearTimeout(timer);
  recheckTimers = [5000, 15000].map((ms) =>
    window.setTimeout(() => {
      void walletGet();
    }, ms),
  );
}

export async function syncWalletOnBoot(): Promise<WalletView | null> {
  if (!bootSync) bootSync = runBoot();
  return bootSync;
}

async function runBoot(): Promise<WalletView | null> {
  try {
    const active = await serverWalletActive();
    if (!active) return null;
    const got = await walletGet();
    if (!got.ok) return null;
    if (got.view.migrated) return got.view;
    await saveToServer();
    const migrated = await walletMigrate();
    if (!migrated.ok) return getWalletSnapshot();
    const again = await walletGet();
    return again.ok ? again.view : getWalletSnapshot();
  } catch {
    console.info("[serverWallet] get failed error=network");
    return null;
  }
}

export function applyWalletViewToOps(state: OpsState, view: WalletView): OpsState {
  const userHash = readStoredGameUserHash() || undefined;
  const walletHistory: WalletHistoryItem[] = view.history.map((row) => ({
    requestId: row.requestId,
    amount: row.amount,
    status: row.status === "done" ? "done" : row.status === "failed" ? "failed" : "pending",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    userHash,
    testGrant: row.isTest ? true : undefined,
  }));
  return {
    ...state,
    nyangCoinBalance: view.balance,
    walletHistory,
  };
}
