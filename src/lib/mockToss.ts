import type { OpsState } from "./opsTypes";

/**
 * Server-shaped toss payout gate. Real server must verify
 * `tossUserKey + rewardId` once per account. This mock keeps the same
 * idempotency surface on the client for local preview.
 */
export type TossGrantRequest = {
  tossUserKey: string;
  rewardId: string;
  amountKRW: number;
};

export type TossGrantResult =
  | { ok: true; alreadyGranted: boolean; amountKRW: number }
  | { ok: false; reason: string };

const memory = new Set<string>();

function keyOf(req: TossGrantRequest) {
  return `${req.tossUserKey}::${req.rewardId}`;
}

export async function grantTossOnce(
  state: OpsState,
  req: TossGrantRequest,
): Promise<{ state: OpsState; result: TossGrantResult }> {
  await delay(40);
  if (req.amountKRW <= 0) {
    return { state, result: { ok: false, reason: "invalid amount" } };
  }
  const key = keyOf(req);
  if (memory.has(key) || state.grantedTossRewardIds.includes(req.rewardId)) {
    return {
      state,
      result: { ok: true, alreadyGranted: true, amountKRW: 0 },
    };
  }
  memory.add(key);
  const next: OpsState = {
    ...state,
    tossBalance: state.tossBalance + req.amountKRW,
    grantedTossRewardIds: [...state.grantedTossRewardIds, req.rewardId],
  };
  return { state: next, result: { ok: true, alreadyGranted: false, amountKRW: req.amountKRW } };
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
