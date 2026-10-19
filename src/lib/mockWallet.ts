import { grantPromotionRewardForGame } from "@apps-in-toss/web-framework";

import { toKstDateKey } from "./date";
import { loadOpsConfig } from "./opsConfig";
import { saveOpsState } from "./opsStorage";
import type { OpsEconomy, OpsState, WalletHistoryItem, WalletWithdrawStatus } from "./opsTypes";
import { refreshServerTime, trustedKstDateKey, trustedNow, hasServerTime } from "./tossClock";
import { isTossApp } from "./tossEnv";
import { ensureGameUserHash, readStoredGameUserHash, TOSS_APP_UPDATE_MESSAGE } from "./user";

/**
 * 냥코인 → 토스 포인트 지급.
 * 토스 앱 안에서는 grantPromotionRewardForGame, 토스 밖에서는 연습용 지급.
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
      /** TEST_ 코드 성공. 실제 토스 포인트는 지급되지 않아요. */
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
  "토스 서버 시간을 확인하지 못해 지금은 토스 포인트를 지급할 수 없어요";

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

function messageForPromoError(code: string): string {
  switch (code) {
    case "4109":
      return "지금은 토스 포인트를 지급할 수 없어요";
    case "4100":
      return "토스 포인트 지급 정보를 찾지 못했어요";
    case "4110":
      return "토스 포인트를 지급하지 못했어요. 잠시 후 다시 시도해 주세요";
    case "4112":
      return "준비한 토스 포인트가 부족해요";
    case "4114":
      return "한 번에 지급할 수 있는 금액을 넘었어요";
    case "4116":
      return "토스 포인트 지급 한도를 넘었어요";
    case "40000":
      return "토스 포인트 지급 요청이 올바르지 않아요";
    default:
      return "토스 포인트를 지급하지 못했어요";
  }
}

type PromotionCodeChoice = { code: string; test: boolean };

/**
 * 정식 코드로 지급해요. VITE_USE_TEST_PROMOTION=true 이거나 promotionLive 가 아니면 TEST_ 코드를 써요.
 */
function promotionCodeFrom(economy: OpsEconomy): PromotionCodeChoice {
  const block = economy.nyangCoin.withdraw;
  const testCode = typeof block?.testPromotionCode === "string" ? block.testPromotionCode.trim() : "";
  const liveCode = typeof block?.promotionCode === "string" ? block.promotionCode.trim() : "";
  const liveOn = block?.promotionLive === true;
  const forceTest = import.meta.env.VITE_USE_TEST_PROMOTION === "true";
  const test = forceTest || !liveOn;
  return { code: test ? testCode : liveCode, test };
}

function pendingForHash(state: OpsState, hash: string): WalletHistoryItem | undefined {
  return state.walletHistory.find(
    (row) => row.status === "pending" && (!row.userHash || row.userHash === hash),
  );
}

type GrantOutcome =
  | { kind: "done"; key: string }
  | { kind: "failed"; reason: string }
  | { kind: "unconfirmed"; reason: string };

/** Practice grant outside Toss. Does not call the promotion SDK. */
async function mockGrant(): Promise<GrantOutcome> {
  await delay(80);
  return { kind: "done", key: `mock_${Date.now().toString(36)}` };
}

async function liveGrant(promotionCode: string, amountKRW: number): Promise<GrantOutcome> {
  try {
    const result = await grantPromotionRewardForGame({
      params: { promotionCode, amount: amountKRW },
    });
    if (result == null) return { kind: "failed", reason: TOSS_APP_UPDATE_MESSAGE };
    if (result === "ERROR") {
      return { kind: "failed", reason: "토스 포인트를 지급하지 못했어요. 잠시 후 다시 시도해 주세요" };
    }
    if ("key" in result && typeof result.key === "string" && result.key) {
      return { kind: "done", key: result.key };
    }
    if ("errorCode" in result && result.errorCode) {
      return { kind: "failed", reason: messageForPromoError(String(result.errorCode)) };
    }
    return { kind: "unconfirmed", reason: "지급 결과를 확인하지 못했어요" };
  } catch {
    // The call may have reached Toss. Leave the row pending instead of paying twice.
    return { kind: "unconfirmed", reason: "지급 결과를 확인하지 못했어요" };
  }
}

/**
 * Whether the payout button may start a new grant.
 * Pending rows are never retried here.
 */
export async function inspectTossPointGrant(state: OpsState): Promise<TossPointGrantGate> {
  const identity = await ensureGameUserHash();
  if (!identity.ok) return identity;
  if (isTossApp()) {
    const timed = await refreshServerTime();
    if (!timed || !hasServerTime()) return { ok: false, reason: SERVER_TIME_BLOCK_MESSAGE };
    const config = await loadOpsConfig();
    if (!promotionCodeFrom(config.economy).code) {
      return { ok: false, reason: "토스 포인트 지급 코드가 아직 없어요" };
    }
  }
  if (pendingForHash(state, identity.hash)) {
    return { ok: false, reason: "확인 중인 지급이 있어요" };
  }
  const waited = Date.now() - lastGrantAt(identity.hash);
  if (lastGrantAt(identity.hash) > 0 && waited < GRANT_GAP_MS) {
    return { ok: false, reason: "10초 뒤에 다시 토스 포인트를 지급할 수 있어요" };
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

/**
 * POST /wallet/withdraw
 * - amount % unit == 0, >= min, <= balance
 * - (withdrawnToday + amount) <= dailyLimit → else 409 DAILY_LIMIT
 * - deduct + pending → Toss grant → done / refund+failed
 * - idempotent on tossUserKey+requestId
 * - one in-flight lock per account
 */
export async function postWalletWithdraw(
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

  const amountKRW = amount * (config.economy.nyangCoin.toTossPointRate ?? 1);
  const code = promotionCodeFrom(config.economy);
  const grant = isTossApp() ? await liveGrant(code.code, amountKRW) : await mockGrant();
  // TEST_ 성공은 resultType SUCCESS({ key })지만 실제 포인트는 나가지 않아요.
  const testGrant = grant.kind === "done" && code.test && isTossApp();

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

/** @deprecated chips replaced by stepper — kept for any stray imports */
export function withdrawChipAmounts(balance: number, step = 10, min = 10): number[] {
  if (balance < min) return [];
  const max = Math.floor(balance / step) * step;
  const chips: number[] = [];
  for (let n = min; n <= max; n += step) chips.push(n);
  return chips;
}
