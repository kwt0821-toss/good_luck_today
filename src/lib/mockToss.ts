import type { OpsState } from "./opsTypes";
import { serverWalletActive, walletEarn } from "./serverWallet";

/**
 * Server-shaped 냥코인 grant gate (earning into wallet).
 * Real server verifies `tossUserKey + rewardId` once per account.
 */
export type NyangCoinGrantRequest = {
  tossUserKey: string;
  rewardId: string;
  amount: number;
  /** 출석 7일차에서 광고를 보고 받을 때만 서버로 전달한다. */
  withAd?: boolean;
};

export type NyangCoinGrantResult =
  | { ok: true; alreadyGranted: boolean; amount: number }
  | { ok: false; reason: string };

const memory = new Set<string>();

function keyOf(req: NyangCoinGrantRequest) {
  return `${req.tossUserKey}::${req.rewardId}`;
}

export async function grantNyangCoinOnce(
  state: OpsState,
  req: NyangCoinGrantRequest,
): Promise<{ state: OpsState; result: NyangCoinGrantResult }> {
  try {
    await delay(40);
    if (req.amount <= 0) {
      return { state, result: { ok: false, reason: "invalid amount" } };
    }
    if (memory.has(keyOf(req)) || state.grantedNyangCoinRewardIds.includes(req.rewardId)) {
      return {
        state,
        result: { ok: true, alreadyGranted: true, amount: 0 },
      };
    }
    if (await serverWalletActive()) {
      const earned = await walletEarn([{ rewardId: req.rewardId, withAd: req.withAd }]);
      if (!earned.ok) return { state, result: { ok: false, reason: earned.error } };
      const row = earned.results[0];
      if (!row?.ok) return { state, result: { ok: false, reason: row?.error ?? "earn_failed" } };
      const grantedIds = state.grantedNyangCoinRewardIds.includes(req.rewardId)
        ? state.grantedNyangCoinRewardIds
        : [...state.grantedNyangCoinRewardIds, req.rewardId];
      const next: OpsState = {
        ...state,
        nyangCoinBalance: earned.balance,
        grantedNyangCoinRewardIds: grantedIds,
      };
      if (row.alreadyGranted) {
        return { state: next, result: { ok: true, alreadyGranted: true, amount: 0 } };
      }
      return {
        state: next,
        result: { ok: true, alreadyGranted: false, amount: row.amount ?? 0 },
      };
    }
    memory.add(keyOf(req));
    const next: OpsState = {
      ...state,
      nyangCoinBalance: state.nyangCoinBalance + req.amount,
      grantedNyangCoinRewardIds: [...state.grantedNyangCoinRewardIds, req.rewardId],
    };
    return { state: next, result: { ok: true, alreadyGranted: false, amount: req.amount } };
  } catch {
    return { state, result: { ok: false, reason: "network" } };
  }
}

/** @deprecated use grantNyangCoinOnce */
export const grantTossOnce = grantNyangCoinOnce;

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
