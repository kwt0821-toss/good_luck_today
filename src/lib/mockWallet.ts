import { toKstDateKey } from "./date";
import { loadOpsConfig } from "./opsConfig";
import { saveOpsState } from "./opsStorage";
import type { OpsEconomy, OpsState, WalletHistoryItem, WalletWithdrawStatus } from "./opsTypes";

/**
 * Mock of server POST /wallet/withdraw and GET /wallet.
 * Client must never call Toss grant APIs directly — only this surface.
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
const tossGrantMemory = new Map<string, "done" | "failed" | "unknown">();

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function idemKey(userId: string, requestId: string) {
  return `${userId}::${requestId}`;
}

export function getWithdrawRules(economy: OpsEconomy): WithdrawRules {
  const w = economy.nyangCoin.withdraw;
  return {
    min: w?.min ?? economy.nyangCoin.withdrawMin ?? 10,
    unit: w?.unit ?? economy.nyangCoin.withdrawStep ?? 10,
    dailyLimit: w?.dailyLimit ?? 50,
  };
}

/** Today’s withdraw sum (KST day). Counts done + pending only; failed excluded. */
export function withdrawnTodayAmount(state: OpsState, today = toKstDateKey()): number {
  return state.walletHistory.reduce((sum, row) => {
    if (row.status !== "done" && row.status !== "pending") return sum;
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

/**
 * Simulated Toss point grant. In production the server calls Promotion.grantReward
 * with requestId. Here we succeed unless amount is specially forced.
 */
async function callTossPointGrantApi(args: {
  tossUserKey: string;
  requestId: string;
  amountKRW: number;
}): Promise<"done" | "failed" | "unknown"> {
  await delay(80);
  const key = idemKey(args.tossUserKey, args.requestId);
  const prior = tossGrantMemory.get(key);
  if (prior === "done" || prior === "failed") return prior;
  // Deterministic mock: always succeed for preview.
  const result: "done" | "failed" | "unknown" = "done";
  tossGrantMemory.set(key, result);
  return result;
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
  const config = await loadOpsConfig();
  const rules = getWithdrawRules(config.economy);
  const { amount, requestId } = body;
  const today = toKstDateKey();

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
    // pending → re-check Toss grant with same requestId
    return recheckPending(state, existing, rules.dailyLimit);
  }

  if (amount > state.nyangCoinBalance) {
    return {
      state,
      response: withRemaining(state, { ok: false, reason: "냥코인이 부족해요" }, rules.dailyLimit),
    };
  }

  const remainingToday = remainingTodayAmount(state, rules.dailyLimit, today);
  if (amount > remainingToday) {
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

  const now = Date.now();
  const lock = locks.get(state.userId);
  if (lock && lock.until > now && lock.requestId !== requestId) {
    return {
      state,
      response: withRemaining(
        state,
        { ok: false, reason: "다른 출금이 처리 중이에요" },
        rules.dailyLimit,
      ),
    };
  }
  locks.set(state.userId, { requestId, until: now + 15_000 });

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
  };
  next = upsertHistory(next, pending);
  await saveOpsState(next);

  const grant = await callTossPointGrantApi({
    tossUserKey: state.userId,
    requestId,
    amountKRW: amount * (config.economy.nyangCoin.toTossPointRate ?? 1),
  });

  if (grant === "done") {
    const done: WalletHistoryItem = { ...pending, status: "done", updatedAt: Date.now() };
    next = upsertHistory(next, done);
    locks.delete(state.userId);
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
        },
        rules.dailyLimit,
      ),
    };
  }

  if (grant === "failed") {
    const failed: WalletHistoryItem = {
      ...pending,
      status: "failed",
      updatedAt: Date.now(),
      failReason: "토스포인트 지급에 실패했어요",
    };
    next = {
      ...upsertHistory(next, failed),
      nyangCoinBalance: next.nyangCoinBalance + amount,
    };
    locks.delete(state.userId);
    await saveOpsState(next);
    return {
      state: next,
      response: withRemaining(
        next,
        {
          ok: false,
          reason: failed.failReason ?? "지급 실패",
          status: "failed",
        },
        rules.dailyLimit,
      ),
    };
  }

  // unknown → keep pending for later re-check
  locks.delete(state.userId);
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

async function recheckPending(
  state: OpsState,
  item: WalletHistoryItem,
  dailyLimit: number,
): Promise<{ state: OpsState; response: WalletWithdrawResponse }> {
  const config = await loadOpsConfig();
  const grant = await callTossPointGrantApi({
    tossUserKey: state.userId,
    requestId: item.requestId,
    amountKRW: item.amount * (config.economy.nyangCoin.toTossPointRate ?? 1),
  });

  if (grant === "done") {
    const done: WalletHistoryItem = { ...item, status: "done", updatedAt: Date.now() };
    const next = upsertHistory(state, done);
    await saveOpsState(next);
    return {
      state: next,
      response: withRemaining(
        next,
        {
          ok: true,
          status: "done",
          amount: item.amount,
          requestId: item.requestId,
          nyangCoinBalance: next.nyangCoinBalance,
          remainingToday: 0,
          alreadyProcessed: true,
        },
        dailyLimit,
      ),
    };
  }

  if (grant === "failed") {
    const failed: WalletHistoryItem = {
      ...item,
      status: "failed",
      updatedAt: Date.now(),
      failReason: "토스포인트 지급에 실패했어요",
    };
    const next = {
      ...upsertHistory(state, failed),
      nyangCoinBalance: state.nyangCoinBalance + item.amount,
    };
    await saveOpsState(next);
    return {
      state: next,
      response: withRemaining(
        next,
        { ok: false, reason: failed.failReason ?? "지급 실패", status: "failed" },
        dailyLimit,
      ),
    };
  }

  return {
    state,
    response: withRemaining(
      state,
      {
        ok: true,
        status: "pending",
        amount: item.amount,
        requestId: item.requestId,
        nyangCoinBalance: state.nyangCoinBalance,
        remainingToday: 0,
      },
      dailyLimit,
    ),
  };
}

/** GET /wallet — balance + remainingToday + history */
export async function getWallet(state: OpsState): Promise<{ state: OpsState; wallet: WalletGetResponse }> {
  await delay(30);
  const config = await loadOpsConfig();
  const rules = getWithdrawRules(config.economy);
  // Re-check any pending rows so UI can settle.
  let next = state;
  for (const item of state.walletHistory.filter((row) => row.status === "pending")) {
    const res = await recheckPending(next, item, rules.dailyLimit);
    next = res.state;
  }
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
