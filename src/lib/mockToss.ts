import type { OpsState } from "./opsTypes";

/**
 * Server-shaped 냥코인 grant gate (earning into wallet).
 * Real server verifies `tossUserKey + rewardId` once per account.
 */
export type NyangCoinGrantRequest = {
  tossUserKey: string;
  rewardId: string;
  amount: number;
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
  await delay(40);
  if (req.amount <= 0) {
    return { state, result: { ok: false, reason: "invalid amount" } };
  }
  const key = keyOf(req);
  if (memory.has(key) || state.grantedNyangCoinRewardIds.includes(req.rewardId)) {
    return {
      state,
      result: { ok: true, alreadyGranted: true, amount: 0 },
    };
  }
  memory.add(key);
  const next: OpsState = {
    ...state,
    nyangCoinBalance: state.nyangCoinBalance + req.amount,
    grantedNyangCoinRewardIds: [...state.grantedNyangCoinRewardIds, req.rewardId],
  };
  return { state: next, result: { ok: true, alreadyGranted: false, amount: req.amount } };
}

/** @deprecated use grantNyangCoinOnce */
export const grantTossOnce = grantNyangCoinOnce;

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
