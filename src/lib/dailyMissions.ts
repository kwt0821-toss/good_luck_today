import { track } from "./analytics";
import { toKstDateKey } from "./date";
import { saveOpsState } from "./opsStorage";
import { displayJellyBalance, jellyEnqueue, serverJellyActive } from "./serverJelly";
import type { OpsEconomy, OpsState } from "./opsTypes";

/** v1 payout caps. Config cannot grant more 발바닥 젤리 than this table. */
const MISSION_PAW_CAP: Record<string, number> = {
  draw_1: 10,
  attend_1: 10,
  room_1: 5,
};

type MissionDef = {
  id: string;
  title: string;
  desc: string;
  target: number;
  paw: number;
};

const FALLBACK_ITEMS: MissionDef[] = [
  { id: "draw_1", title: "카드 뽑기", desc: "오늘 카드 1장 뽑기", target: 1, paw: 10 },
  { id: "attend_1", title: "출석 체크", desc: "오늘 출석 선물 받기", target: 1, paw: 10 },
  { id: "room_1", title: "방 놀러 가기", desc: "내 방에 한 번 들어가기", target: 1, paw: 5 },
];

export type MissionStatus = "locked" | "claimable" | "done";

export type MissionRow = {
  id: string;
  title: string;
  desc: string;
  current: number;
  target: number;
  paw: number;
  status: MissionStatus;
};

function missionDefs(economy?: OpsEconomy): MissionDef[] {
  const items = economy?.dailyMissions?.items;
  const source = items?.length ? items : FALLBACK_ITEMS;
  const defs = source
    .filter((item) => typeof item.id === "string" && MISSION_PAW_CAP[item.id] != null)
    .map((item) => ({
      id: item.id,
      title: item.title,
      desc: item.desc,
      target: Math.max(1, Math.floor(item.target) || 1),
      paw: Math.min(MISSION_PAW_CAP[item.id] ?? 0, Math.max(0, Math.floor(item.paw) || 0)),
    }));
  return defs.length ? defs : FALLBACK_ITEMS;
}

/** Reset mission progress when the KST date key has moved on. */
export function ensureMissionDay(state: OpsState, today = toKstDateKey()): OpsState {
  if (state.missionDateKey === today) return state;
  return {
    ...state,
    missionDateKey: today,
    missionProgress: {},
    missionClaimedIds: [],
  };
}

function raiseToTarget(state: OpsState, id: string, target: number): OpsState {
  const current = state.missionProgress[id] ?? 0;
  if (current >= target) return state;
  return {
    ...state,
    missionProgress: { ...state.missionProgress, [id]: target },
  };
}

/** A draw that already counted today: normal, rate-up, or a confirmed reservation. */
function drewToday(state: OpsState, today: string): boolean {
  if (state.dateKey === today && (state.normalDrawsUsed > 0 || state.rateUpUsed > 0)) return true;
  const pending = state.pendingDraw;
  if (!pending?.confirmed) return false;
  return toKstDateKey(new Date(pending.createdAt)) === today;
}

/**
 * Line today's checklist up with what already happened.
 * Attendance and draws fill to their target. A claimed mission stays claimed.
 * Room visits are not guessed. Does not save.
 */
export function reconcileMissions(state: OpsState, economy?: OpsEconomy, today = toKstDateKey()): OpsState {
  let next = ensureMissionDay(state, today);
  const defs = missionDefs(economy);
  const attended = next.lastAttendDateKST === today || next.lastAttendanceDateKey === today;
  if (attended) {
    const target = defs.find((item) => item.id === "attend_1")?.target;
    if (target) next = raiseToTarget(next, "attend_1", target);
  }
  if (drewToday(next, today)) {
    const target = defs.find((item) => item.id === "draw_1")?.target;
    if (target) next = raiseToTarget(next, "draw_1", target);
  }
  return next;
}

/**
 * Raise progress up to the mission target. Already-claimed missions keep their progress.
 * Does not save — callers persist with the rest of the success path.
 */
export function bumpMission(
  state: OpsState,
  missionId: string,
  by = 1,
  today = toKstDateKey(),
  economy?: OpsEconomy,
): OpsState {
  const base = reconcileMissions(state, economy, today);
  const def = missionDefs(economy).find((item) => item.id === missionId);
  if (!def) return base;
  const current = base.missionProgress[missionId] ?? 0;
  const value = Math.min(def.target, current + Math.max(0, Math.floor(by)));
  if (value === current) return base;
  track("mission_progress", { mission: missionId, current: value, target: def.target });
  return {
    ...base,
    missionProgress: { ...base.missionProgress, [missionId]: value },
  };
}

export async function claimMission(
  state: OpsState,
  missionId: string,
  economy: OpsEconomy,
): Promise<{ state: OpsState; gained: number } | { error: string }> {
  const base = reconcileMissions(state, economy);
  const def = missionDefs(economy).find((item) => item.id === missionId);
  if (!def) return { error: "미션을 찾지 못했어요" };
  if (base.missionClaimedIds.includes(missionId)) return { error: "이미 받았어요" };
  const current = base.missionProgress[missionId] ?? 0;
  if (current < def.target) return { error: "아직이에요" };
  if (def.paw <= 0) return { error: "받을 젤리가 없어요" };
  const today = base.missionDateKey || toKstDateKey();
  let pawBalance = base.pawBalance + def.paw;
  if (await serverJellyActive()) {
    await jellyEnqueue({
      rewardId: `mission:${missionId}:${today}`,
      reason: "mission",
      optimistic: def.paw,
    });
    pawBalance = displayJellyBalance(base.pawBalance);
  }
  const next: OpsState = {
    ...base,
    pawBalance,
    missionClaimedIds: [...base.missionClaimedIds, missionId],
  };
  await saveOpsState(next);
  track("mission_claim", { mission: missionId, paw: def.paw });
  return { state: next, gained: def.paw };
}

export function listMissions(state: OpsState, economy: OpsEconomy, today = toKstDateKey()): MissionRow[] {
  const base = reconcileMissions(state, economy, today);
  return missionDefs(economy).map((def) => {
    const current = Math.min(def.target, Math.max(0, base.missionProgress[def.id] ?? 0));
    const claimed = base.missionClaimedIds.includes(def.id);
    const status: MissionStatus = claimed ? "done" : current >= def.target ? "claimable" : "locked";
    return {
      id: def.id,
      title: def.title,
      desc: def.desc,
      current,
      target: def.target,
      paw: def.paw,
      status,
    };
  });
}
