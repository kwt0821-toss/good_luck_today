import { loadOpsConfig } from "./opsConfig";
import { saveOpsState } from "./opsStorage";
import type { OpsState, WalletHistoryItem, WalletWithdrawStatus } from "./opsTypes";

/**
 * Mock of server POST /wallet/withdraw and GET /wallet/history.
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
      alreadyProcessed?: boolean;
    }
  | { ok: false; reason: string; status?: WalletWithdrawStatus };

type LockEntry = { requestId: string; until: number };

const locks = new Map<string, LockEntry>();
const tossGrantMemory = new Map<string, "done" | "failed" | "unknown">();

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function idemKey(userId: string, requestId: string) {
  return `${userId}::${requestId}`;
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

/**
 * POST /wallet/withdraw
 * - amount % 10 == 0, >= 10, <= balance
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
  const min = config.economy.nyangCoin.withdrawMin ?? 10;
  const step = config.economy.nyangCoin.withdrawStep ?? 10;
  const { amount, requestId } = body;

  if (!requestId || typeof requestId !== "string") {
    return { state, response: { ok: false, reason: "requestId가 필요해요" } };
  }
  if (!Number.isInteger(amount) || amount < min || amount % step !== 0) {
    return {
      state,
      response: { ok: false, reason: `${min}냥코인부터 ${step}단위로 받을 수 있어요` },
    };
  }

  const existing = state.walletHistory.find((row) => row.requestId === requestId);
  if (existing) {
    if (existing.status === "done" || existing.status === "failed") {
      return {
        state,
        response: {
          ok: true,
          status: existing.status,
          amount: existing.amount,
          requestId,
          nyangCoinBalance: state.nyangCoinBalance,
          alreadyProcessed: true,
        },
      };
    }
    // pending → re-check Toss grant with same requestId
    return recheckPending(state, existing);
  }

  if (amount > state.nyangCoinBalance) {
    return { state, response: { ok: false, reason: "냥코인이 부족해요" } };
  }

  const now = Date.now();
  const lock = locks.get(state.userId);
  if (lock && lock.until > now && lock.requestId !== requestId) {
    return { state, response: { ok: false, reason: "다른 출금이 처리 중이에요" } };
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
      response: {
        ok: true,
        status: "done",
        amount,
        requestId,
        nyangCoinBalance: next.nyangCoinBalance,
      },
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
      response: {
        ok: false,
        reason: failed.failReason ?? "지급 실패",
        status: "failed",
      },
    };
  }

  // unknown → keep pending for later re-check
  locks.delete(state.userId);
  await saveOpsState(next);
  return {
    state: next,
    response: {
      ok: true,
      status: "pending",
      amount,
      requestId,
      nyangCoinBalance: next.nyangCoinBalance,
    },
  };
}

async function recheckPending(
  state: OpsState,
  item: WalletHistoryItem,
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
      response: {
        ok: true,
        status: "done",
        amount: item.amount,
        requestId: item.requestId,
        nyangCoinBalance: next.nyangCoinBalance,
        alreadyProcessed: true,
      },
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
      response: { ok: false, reason: failed.failReason ?? "지급 실패", status: "failed" },
    };
  }

  return {
    state,
    response: {
      ok: true,
      status: "pending",
      amount: item.amount,
      requestId: item.requestId,
      nyangCoinBalance: state.nyangCoinBalance,
    },
  };
}

/** GET /wallet/history */
export async function getWalletHistory(
  state: OpsState,
): Promise<{ items: WalletHistoryItem[]; nyangCoinBalance: number }> {
  await delay(30);
  // Re-check any pending rows so UI can settle.
  let next = state;
  for (const item of state.walletHistory.filter((row) => row.status === "pending")) {
    const res = await recheckPending(next, item);
    next = res.state;
  }
  return { items: next.walletHistory, nyangCoinBalance: next.nyangCoinBalance };
}

export function buildWithdrawRequestId(): string {
  return `wd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function withdrawChipAmounts(balance: number, step = 10, min = 10): number[] {
  if (balance < min) return [];
  const max = Math.floor(balance / step) * step;
  const chips: number[] = [];
  for (let n = min; n <= max; n += step) chips.push(n);
  return chips;
}
