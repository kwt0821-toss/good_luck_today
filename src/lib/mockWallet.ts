import { Storage } from "@apps-in-toss/web-framework";

import { toKstDateKey } from "./date";
import { isInTossApp } from "./native";
import { loadOpsConfig } from "./opsConfig";
import { saveOpsState } from "./opsStorage";
import type { OpsEconomy, OpsState, WalletHistoryItem, WalletWithdrawStatus } from "./opsTypes";
import { refreshServerTime, trustedKstDateKey, trustedNow, hasServerTime } from "./tossClock";
import { track } from "./analytics";
import { isTossApp } from "./tossEnv";
import { ensureGameUserHash, readStoredGameUserHash } from "./user";
import { withTimeout } from "./serverSave";
import {
  applyWalletViewToOps,
  getWalletSnapshot,
  scheduleWalletRecheck,
  serverWalletActive,
  walletGet,
  walletWithdraw,
  type WalletHistoryRow,
  type WalletView,
} from "./serverWallet";

/**
 * 냥코인 받기.
 * 서버 모드에서는 wallet 함수가 잔액과 지급을 정한다.
 * 로컬(연습) 모드에서는 mockGrant만 사용한다.
 */

export type WalletWithdrawRequest = {
  amount: number;
  requestId: string;
};

export type WalletWithdrawResponse =
  | {
      ok: true;
      status: WalletWithdrawStatus;
      amount: number;
      requestId: string;
      nyangCoinBalance: number;
      remainingToday: number;
      alreadyProcessed?: boolean;
      /** 연습 지급. 실제로는 받지 않아요. */
      testGrant?: boolean;
    }
  | {
      ok: false;
      reason: string;
      code?: "DAILY_LIMIT";
      remainingToday?: number;
      status?: WalletWithdrawStatus;
    };

export type WalletGetResponse = {
  nyangCoinBalance: number;
  remainingToday: number;
  dailyLimit: number;
  min: number;
  unit: number;
  withdrawnToday: number;
  history: WalletHistoryItem[];
};

export type WithdrawRules = {
  min: number;
  unit: number;
  dailyLimit: number;
};

type LockEntry = { requestId: string; until: number };

const locks = new Map<string, LockEntry>();
const GRANT_GAP_MS = 10_000;
const LAST_GRANT_KEY = "lucky-cat.promo-last-grant.v1";

export const SERVER_TIME_BLOCK_MESSAGE =
  "서버 시간을 확인하지 못해 지금은 받을 수 없어요";

export type TossPointGrantGate = { ok: true } | { ok: false; reason: string };

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function getWithdrawRules(economy: OpsEconomy): WithdrawRules {
  const w = economy.nyangCoin.withdraw;
  return {
    min: w?.min ?? economy.nyangCoin.withdrawMin ?? 10,
    unit: w?.unit ?? economy.nyangCoin.withdrawStep ?? 10,
    dailyLimit: w?.dailyLimit ?? 50,
  };
}

/** Today’s payout sum (KST day from the Toss clock when known). Counts done + pending; failed excluded. */
export function withdrawnTodayAmount(
  state: OpsState,
  today = trustedKstDateKey(),
  userHash = readStoredGameUserHash(),
): number {
  return state.walletHistory.reduce((sum, row) => {
    if (row.testGrant) return sum;
    if (row.status !== "done" && row.status !== "pending") return sum;
    if (userHash && row.userHash && row.userHash !== userHash) return sum;
    if (toKstDateKey(new Date(row.createdAt)) !== today) return sum;
    return sum + row.amount;
  }, 0);
}

export function remainingTodayAmount(
  state: OpsState,
  dailyLimit: number,
  today = toKstDateKey(),
): number {
  return Math.max(0, dailyLimit - withdrawnTodayAmount(state, today));
}

/** Max selectable withdraw amount for the stepper. */
export function maxWithdrawableAmount(
  balance: number,
  remainingToday: number,
  rules: WithdrawRules,
): number {
  if (balance < rules.min || remainingToday < rules.min) return 0;
  const byBalance = Math.floor(balance / rules.unit) * rules.unit;
  const byDay = Math.floor(remainingToday / rules.unit) * rules.unit;
  return Math.max(0, Math.min(byBalance, byDay));
}

function lastGrantAt(hash: string): number {
  try {
    const raw = localStorage.getItem(LAST_GRANT_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as Record<string, number>;
    return typeof parsed[hash] === "number" ? parsed[hash] : 0;
  } catch {
    return 0;
  }
}

function markGrantAt(hash: string, at: number) {
  try {
    const raw = localStorage.getItem(LAST_GRANT_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    parsed[hash] = at;
    localStorage.setItem(LAST_GRANT_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

function pendingForHash(state: OpsState, hash: string): WalletHistoryItem | undefined {
  return state.walletHistory.find(
    (row) => row.status === "pending" && (!row.userHash || row.userHash === hash),
  );
}

type GrantOutcome =
  | { kind: "done"; key: string }
  | { kind: "failed"; reason: string; code: string }
  | { kind: "unconfirmed"; reason: string; code: string };

/** Practice grant. Does not call the promotion SDK. */
async function mockGrant(): Promise<GrantOutcome> {
  await delay(80);
  return { kind: "done", key: `mock_${Date.now().toString(36)}` };
}

/**
 * Whether the payout button may start a new grant.
 * Pending rows are never retried here.
 */
const PREPARE_MESSAGE = "지금은 받기를 준비하고 있어요";
const BLOCKED_MESSAGE = "지금은 받을 수 없어요";
const OFFLINE_MESSAGE = "연결을 확인하지 못해 지금은 받을 수 없어요";
const FRESH_MS = 15_000;
const PENDING_KEY = "lucky-cat.wallet.pending-withdraw.v1";

type PendingWithdraw = { requestId: string; amount: number; sentAt?: number };

async function readStorage(key: string): Promise<string | null> {
  if (isInTossApp()) {
    try {
      return await withTimeout(Storage.getItem(key), 800);
    } catch {
      // 브라우저 미리보기는 localStorage를 써요.
    }
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

async function writeStorage(key: string, value: string): Promise<void> {
  if (isInTossApp()) {
    try {
      await withTimeout(Storage.setItem(key, value), 800);
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
}

async function removeStorage(key: string): Promise<void> {
  if (isInTossApp()) {
    try {
      await withTimeout(Storage.removeItem(key), 800);
      return;
    } catch {
      // fall through
    }
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

async function readPending(): Promise<PendingWithdraw | null> {
  const raw = await readStorage(PENDING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.requestId !== "string" || typeof record.amount !== "number") return null;
    return {
      requestId: record.requestId,
      amount: record.amount,
      ...(typeof record.sentAt === "number" ? { sentAt: record.sentAt } : {}),
    };
  } catch {
    return null;
  }
}

async function writePending(pending: PendingWithdraw): Promise<void> {
  await writeStorage(PENDING_KEY, JSON.stringify(pending));
}

async function clearPending(requestId?: string): Promise<void> {
  if (!requestId) {
    await removeStorage(PENDING_KEY);
    return;
  }
  const stored = await readPending();
  if (stored?.requestId === requestId) await removeStorage(PENDING_KEY);
}

function inflightRow(history: WalletHistoryRow[]): WalletHistoryRow | undefined {
  return history.find(
    (row) => row.status === "sending" || row.status === "unknown" || row.status === "manual_review",
  );
}

function classifyPending(view: WalletView | null, pending: PendingWithdraw): "reuse" | "replace" | "unknown" {
  if (!pending.sentAt) return "reuse";
  if (!view || view.fetchedAt < pending.sentAt) return "unknown";
  const row = view.history.find((item) => item.requestId === pending.requestId);
  if (!row || row.status === "done" || row.status === "failed") return "replace";
  return "reuse";
}

async function freshWalletView(): Promise<WalletView | null> {
  const snap = getWalletSnapshot();
  if (snap && Date.now() - snap.fetchedAt < FRESH_MS) return snap;
  const got = await walletGet();
  if (!got.ok) return null;
  return got.view;
}

export async function inspectTossPointGrant(state: OpsState): Promise<TossPointGrantGate> {
  if (await serverWalletActive()) {
    const view = await freshWalletView();
    if (!view) return { ok: false, reason: OFFLINE_MESSAGE };
    if (!view.migrated || !view.withdrawEnabled) return { ok: false, reason: PREPARE_MESSAGE };
    if (view.blocked) return { ok: false, reason: BLOCKED_MESSAGE };
    if (inflightRow(view.history)) return { ok: false, reason: "확인 중인 지급이 있어요" };
    return { ok: true };
  }
  const identity = await ensureGameUserHash();
  if (!identity.ok) return identity;
  if (isTossApp()) {
    const timed = await refreshServerTime();
    if (!timed || !hasServerTime()) return { ok: false, reason: SERVER_TIME_BLOCK_MESSAGE };
  }
  if (pendingForHash(state, identity.hash)) {
    return { ok: false, reason: "확인 중인 지급이 있어요" };
  }
  const waited = Date.now() - lastGrantAt(identity.hash);
  if (lastGrantAt(identity.hash) > 0 && waited < GRANT_GAP_MS) {
    return { ok: false, reason: "10초 뒤에 다시 받을 수 있어요" };
  }
  const lock = locks.get(identity.hash);
  if (lock && lock.until > Date.now()) {
    return { ok: false, reason: "다른 지급이 진행 중이에요" };
  }
  return { ok: true };
}

function upsertHistory(state: OpsState, item: WalletHistoryItem): OpsState {
  const rest = state.walletHistory.filter((row) => row.requestId !== item.requestId);
  return { ...state, walletHistory: [item, ...rest].slice(0, 50) };
}

function withRemaining(
  state: OpsState,
  response: WalletWithdrawResponse,
  dailyLimit: number,
): WalletWithdrawResponse {
  const remainingToday = remainingTodayAmount(state, dailyLimit);
  if (response.ok) {
    return { ...response, remainingToday };
  }
  return { ...response, remainingToday: response.remainingToday ?? remainingToday };
}

function withdrawFailReason(error: string): { reason: string; code?: "DAILY_LIMIT" } {
  switch (error) {
    case "DAILY_LIMIT":
      return { reason: "오늘 받을 수 있는 한도를 넘었어요", code: "DAILY_LIMIT" };
    case "INSUFFICIENT":
      return { reason: "냥코인이 부족해요" };
    case "BUSY":
      return { reason: "확인 중인 신청이 있어요" };
    case "BUDGET":
    case "DISABLED":
    case "NOT_MIGRATED":
    case "server_not_configured":
      return { reason: PREPARE_MESSAGE };
    case "BLOCKED":
      return { reason: BLOCKED_MESSAGE };
    case "rate_limited":
      return { reason: "잠시 후 다시 시도해 주세요" };
    default:
      return { reason: "지금은 받지 못했어요. 잠시 후 다시 시도해 주세요" };
  }
}

let withdrawInflight: Promise<{ state: OpsState; response: WalletWithdrawResponse }> | null = null;

/**
 * POST /wallet/withdraw
 * Server mode asks the wallet function. Local mode keeps the practice grant.
 */
export function postWalletWithdraw(
  state: OpsState,
  body: WalletWithdrawRequest,
): Promise<{ state: OpsState; response: WalletWithdrawResponse }> {
  if (withdrawInflight) return withdrawInflight;
  withdrawInflight = postWalletWithdrawRun(state, body).finally(() => {
    withdrawInflight = null;
  });
  return withdrawInflight;
}

async function postWalletWithdrawRun(
  state: OpsState,
  body: WalletWithdrawRequest,
): Promise<{ state: OpsState; response: WalletWithdrawResponse }> {
  if (await serverWalletActive()) return postWalletWithdrawServer(state, body);
  return postWalletWithdrawLocal(state, body);
}

async function postWalletWithdrawServer(
  state: OpsState,
  body: WalletWithdrawRequest,
): Promise<{ state: OpsState; response: WalletWithdrawResponse }> {
  const snap = getWalletSnapshot();
  const min = snap?.min ?? 10;
  const unit = snap?.unit ?? 10;
  let amount = body.amount;
  const requestId = body.requestId;
  if (!requestId || typeof requestId !== "string") {
    return { state, response: { ok: false, reason: "requestId가 필요해요" } };
  }
  const stored = await readPending();
  if (stored && stored.requestId === requestId && stored.amount !== amount) {
    amount = stored.amount;
  }
  if (!Number.isInteger(amount) || amount < min || (unit > 0 && amount % unit !== 0)) {
    return {
      state,
      response: { ok: false, reason: `${min}냥코인부터 ${unit}단위로 받을 수 있어요` },
    };
  }

  const got = await walletGet();
  if (!got.ok) {
    return { state, response: { ok: false, reason: OFFLINE_MESSAGE } };
  }
  let next = applyWalletViewToOps(state, got.view);
  if (!got.view.migrated || !got.view.withdrawEnabled) {
    await saveOpsState(next);
    return { state: next, response: { ok: false, reason: PREPARE_MESSAGE } };
  }
  if (got.view.blocked) {
    await saveOpsState(next);
    return { state: next, response: { ok: false, reason: BLOCKED_MESSAGE } };
  }
  const busy = inflightRow(got.view.history);
  if (busy) {
    await saveOpsState(next);
    return {
      state: next,
      response: {
        ok: true,
        status: "pending",
        amount: busy.amount,
        requestId: busy.requestId,
        nyangCoinBalance: got.view.balance,
        remainingToday: got.view.remainingToday,
        alreadyProcessed: true,
      },
    };
  }

  await writePending({ requestId, amount, sentAt: Date.now() });
  track("toss_reward_request", { amount });
  const result = await walletWithdraw(requestId, amount);
  const view = getWalletSnapshot() ?? got.view;
  next = applyWalletViewToOps(state, view);

  if (!result.ok) {
    if (result.network) {
      const pendingRow: WalletHistoryItem = {
        requestId,
        amount,
        status: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        userHash: readStoredGameUserHash() || undefined,
      };
      next = {
        ...next,
        walletHistory: [pendingRow, ...next.walletHistory.filter((row) => row.requestId !== requestId)].slice(0, 50),
      };
      await saveOpsState(next);
      scheduleWalletRecheck();
      track("toss_reward_result", { amount, success: false, error_code: "network" });
      return {
        state: next,
        response: {
          ok: true,
          status: "pending",
          amount,
          requestId,
          nyangCoinBalance: view.balance,
          remainingToday: view.remainingToday,
        },
      };
    }
    await clearPending(requestId);
    await saveOpsState(next);
    const mapped = withdrawFailReason(result.error);
    track("toss_reward_result", { amount, success: false, error_code: result.error });
    return {
      state: next,
      response: {
        ok: false,
        reason: mapped.reason,
        code: mapped.code,
        remainingToday: result.remainingToday ?? view.remainingToday,
        ...(result.error === "DAILY_LIMIT" ? {} : {}),
      },
    };
  }

  const balance = result.balance;
  const remainingToday = result.remainingToday;
  next = applyWalletViewToOps(state, { ...view, balance, remainingToday });
  if (result.status === "done" && !result.pending) {
    await clearPending(requestId);
    await saveOpsState(next);
    track("toss_reward_result", { amount, success: true });
    return {
      state: next,
      response: {
        ok: true,
        status: "done",
        amount,
        requestId,
        nyangCoinBalance: balance,
        remainingToday,
        testGrant: result.item?.isTest || undefined,
      },
    };
  }
  if (result.status === "failed" && !result.pending) {
    await clearPending(requestId);
    await saveOpsState(next);
    track("toss_reward_result", { amount, success: false, error_code: "failed" });
    return {
      state: next,
      response: {
        ok: false,
        status: "failed",
        reason: "보내지 못해 냥코인을 돌려드렸어요",
      },
    };
  }
  await saveOpsState(next);
  track("toss_reward_result", { amount, success: false, error_code: result.status });
  return {
    state: next,
    response: {
      ok: true,
      status: "pending",
      amount,
      requestId,
      nyangCoinBalance: balance,
      remainingToday,
    },
  };
}

/**
 * Local practice withdraw. Deducts on this device and never calls the promotion SDK.
 */
async function postWalletWithdrawLocal(
  state: OpsState,
  body: WalletWithdrawRequest,
): Promise<{ state: OpsState; response: WalletWithdrawResponse }> {
  await delay(50);
  await refreshServerTime();
  const config = await loadOpsConfig();
  const rules = getWithdrawRules(config.economy);
  const { amount, requestId } = body;
  const today = trustedKstDateKey();

  if (!requestId || typeof requestId !== "string") {
    return {
      state,
      response: withRemaining(state, { ok: false, reason: "requestId가 필요해요" }, rules.dailyLimit),
    };
  }
  if (!Number.isInteger(amount) || amount < rules.min || amount % rules.unit !== 0) {
    return {
      state,
      response: withRemaining(
        state,
        {
          ok: false,
          reason: `${rules.min}냥코인부터 ${rules.unit}단위로 받을 수 있어요`,
        },
        rules.dailyLimit,
      ),
    };
  }

  const existing = state.walletHistory.find((row) => row.requestId === requestId);
  if (existing) {
    if (existing.status === "done" || existing.status === "failed") {
      return {
        state,
        response: withRemaining(
          state,
          {
            ok: true,
            status: existing.status,
            amount: existing.amount,
            requestId,
            nyangCoinBalance: state.nyangCoinBalance,
            remainingToday: 0,
            alreadyProcessed: true,
          },
          rules.dailyLimit,
        ),
      };
    }
    // A killed app leaves pending. Do not call the promotion API again.
    return {
      state,
      response: withRemaining(
        state,
        {
          ok: true,
          status: "pending",
          amount: existing.amount,
          requestId,
          nyangCoinBalance: state.nyangCoinBalance,
          remainingToday: 0,
          alreadyProcessed: true,
        },
        rules.dailyLimit,
      ),
    };
  }

  const gate = await inspectTossPointGrant(state);
  if (!gate.ok) {
    return {
      state,
      response: withRemaining(state, { ok: false, reason: gate.reason }, rules.dailyLimit),
    };
  }
  const identity = await ensureGameUserHash();
  if (!identity.ok) {
    return {
      state,
      response: withRemaining(state, { ok: false, reason: identity.reason }, rules.dailyLimit),
    };
  }
  const held = locks.get(identity.hash);
  if (held && held.until > Date.now()) {
    return {
      state,
      response: withRemaining(
        state,
        { ok: false, reason: "다른 지급이 진행 중이에요" },
        rules.dailyLimit,
      ),
    };
  }
  locks.set(identity.hash, { requestId, until: Date.now() + 30_000 });

  if (amount > state.nyangCoinBalance) {
    locks.delete(identity.hash);
    return {
      state,
      response: withRemaining(state, { ok: false, reason: "냥코인이 부족해요" }, rules.dailyLimit),
    };
  }

  const remainingToday = remainingTodayAmount(state, rules.dailyLimit, today);
  if (amount > remainingToday) {
    locks.delete(identity.hash);
    return {
      state,
      response: {
        ok: false,
        reason: "오늘 받을 수 있는 한도를 넘었어요",
        code: "DAILY_LIMIT",
        remainingToday,
      },
    };
  }

  const now = trustedNow().getTime();

  let next: OpsState = {
    ...state,
    nyangCoinBalance: state.nyangCoinBalance - amount,
  };
  const pending: WalletHistoryItem = {
    requestId,
    amount,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    userHash: identity.hash,
  };
  next = upsertHistory(next, pending);
  await saveOpsState(next);
  markGrantAt(identity.hash, Date.now());

  track("toss_reward_request", { amount });
  const grant = await mockGrant();
  track("toss_reward_result", {
    amount,
    success: grant.kind === "done",
    error_code: grant.kind === "done" ? undefined : grant.code,
  });
  const testGrant = false;

  if (grant.kind === "done") {
    const done: WalletHistoryItem = {
      ...pending,
      status: "done",
      updatedAt: trustedNow().getTime(),
      rewardKey: grant.key,
      testGrant: testGrant || undefined,
    };
    next = upsertHistory(next, done);
    if (testGrant) {
      next = { ...next, nyangCoinBalance: next.nyangCoinBalance + amount };
    }
    locks.delete(identity.hash);
    await saveOpsState(next);
    return {
      state: next,
      response: withRemaining(
        next,
        {
          ok: true,
          status: "done",
          amount,
          requestId,
          nyangCoinBalance: next.nyangCoinBalance,
          remainingToday: 0,
          testGrant: testGrant || undefined,
        },
        rules.dailyLimit,
      ),
    };
  }

  if (grant.kind === "failed") {
    const failed: WalletHistoryItem = {
      ...pending,
      status: "failed",
      updatedAt: trustedNow().getTime(),
      failReason: grant.reason,
    };
    next = {
      ...upsertHistory(next, failed),
      nyangCoinBalance: next.nyangCoinBalance + amount,
    };
    locks.delete(identity.hash);
    await saveOpsState(next);
    return {
      state: next,
      response: withRemaining(
        next,
        {
          ok: false,
          reason: grant.reason,
          status: "failed",
        },
        rules.dailyLimit,
      ),
    };
  }

  // Result unknown. Keep the deducted balance and the pending row. Do not retry.
  locks.delete(identity.hash);
  await saveOpsState(next);
  return {
    state: next,
    response: withRemaining(
      next,
      {
        ok: true,
        status: "pending",
        amount,
        requestId,
        nyangCoinBalance: next.nyangCoinBalance,
        remainingToday: 0,
      },
      rules.dailyLimit,
    ),
  };
}

/** GET /wallet — balance + remainingToday + history. Pending rows stay pending. */
export async function getWallet(state: OpsState): Promise<{ state: OpsState; wallet: WalletGetResponse }> {
  if (await serverWalletActive()) {
    const got = await walletGet();
    const view = got.ok ? got.view : getWalletSnapshot();
    if (!view) {
      return {
        state,
        wallet: {
          nyangCoinBalance: state.nyangCoinBalance,
          remainingToday: 0,
          dailyLimit: 0,
          min: 10,
          unit: 10,
          withdrawnToday: 0,
          history: state.walletHistory,
        },
      };
    }
    const next = applyWalletViewToOps(state, view);
    await saveOpsState(next);
    const withdrawnToday = Math.max(0, view.dailyLimit - view.remainingToday);
    return {
      state: next,
      wallet: {
        nyangCoinBalance: view.balance,
        remainingToday: view.remainingToday,
        dailyLimit: view.dailyLimit,
        min: view.min,
        unit: view.unit,
        withdrawnToday,
        history: next.walletHistory,
      },
    };
  }
  await delay(30);
  const config = await loadOpsConfig();
  const rules = getWithdrawRules(config.economy);
  const next = state;
  const withdrawnToday = withdrawnTodayAmount(next);
  const remainingToday = Math.max(0, rules.dailyLimit - withdrawnToday);
  return {
    state: next,
    wallet: {
      nyangCoinBalance: next.nyangCoinBalance,
      remainingToday,
      dailyLimit: rules.dailyLimit,
      min: rules.min,
      unit: rules.unit,
      withdrawnToday,
      history: next.walletHistory,
    },
  };
}

/** @deprecated use getWallet */
export async function getWalletHistory(
  state: OpsState,
): Promise<{ items: WalletHistoryItem[]; nyangCoinBalance: number; remainingToday: number }> {
  const pack = await getWallet(state);
  return {
    items: pack.wallet.history,
    nyangCoinBalance: pack.wallet.nyangCoinBalance,
    remainingToday: pack.wallet.remainingToday,
  };
}

export function buildWithdrawRequestId(): string {
  return `wd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

let idInflight: Promise<string> | null = null;

/** Server mode reuses one id until the payout is final. Local mode mints a new id. */
export function acquireWithdrawRequestId(amount: number): Promise<string> {
  if (idInflight) return idInflight;
  idInflight = acquireWithdrawRequestIdBody(amount).finally(() => {
    idInflight = null;
  });
  return idInflight;
}

async function acquireWithdrawRequestIdBody(amount: number): Promise<string> {
  if (!(await serverWalletActive())) return buildWithdrawRequestId();
  const stored = await readPending();
  if (!stored) {
    const requestId = buildWithdrawRequestId();
    await writePending({ requestId, amount });
    return requestId;
  }
  let decision = classifyPending(getWalletSnapshot(), stored);
  if (decision === "unknown") {
    const got = await walletGet();
    decision = classifyPending(got.ok ? got.view : null, stored);
    if (decision === "unknown") return stored.requestId;
  }
  if (decision === "reuse") return stored.requestId;
  await clearPending(stored.requestId);
  const requestId = buildWithdrawRequestId();
  await writePending({ requestId, amount });
  return requestId;
}

/** @deprecated chips replaced by stepper — kept for any stray imports */
export function withdrawChipAmounts(balance: number, step = 10, min = 10): number[] {
  if (balance < min) return [];
  const max = Math.floor(balance / step) * step;
  const chips: number[] = [];
  for (let n = min; n <= max; n += step) chips.push(n);
  return chips;
}
