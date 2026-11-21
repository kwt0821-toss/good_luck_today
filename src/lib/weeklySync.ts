import { dailyMissionsCleared } from "./dailyMissions";
import { toKstMondayWeekKey } from "./date";
import type { OpsEconomy, OpsState } from "./opsTypes";
import { saveOpsState } from "./opsStorage";
import { markDirtyUrgent } from "./serverSave";
import { refreshMailbox } from "./mailbox";

export type WeeklyCelebrate = {
  title: string;
  lines: string[];
  past?: boolean;
};
import { fetchWeeklyStatus, syncWeeklyProgress } from "./serverWallet";
import { trustedKstDateKey, trustedNow } from "./tossClock";
import {
  absorbWeeklySources,
  emptyWeeklyBag,
  mailboxClaimedKinds,
  mergeWeeklyLogs,
  parseWeeklyMailbox,
  parseWeeklyRules,
  rollWeeklyBag,
  serverWeekToLog,
  unionKinds,
  weeklyProgressPayload,
  type WeeklyBag,
} from "./weeklyMissions";

let applyListener: (state: OpsState) => void = () => {};
let syncTimer: number | null = null;
let syncLatest: OpsState | null = null;

export function bindWeeklyApply(listener: (state: OpsState) => void) {
  applyListener = listener;
}

function weekKeyNow(): string {
  return toKstMondayWeekKey(trustedNow());
}

export function refreshWeekly(
  state: OpsState,
  economy?: OpsEconomy,
  today = trustedKstDateKey(),
  options?: { weekKey?: string; roomSaved?: boolean; inviteDone?: boolean },
): OpsState {
  const key = options?.weekKey || weekKeyNow();
  const bag = rollWeeklyBag(state.weekly, key);
  const current = absorbWeeklySources(bag.current, {
    weekKey: key,
    today,
    drawsByDate: state.drawsByDate,
    lastAttendDateKST: state.lastAttendDateKST,
    petToday: state.affection?.dateKey === today ? state.affection.today.pet : 0,
    affectionDate: state.affection?.dateKey,
    dailyClearedToday: dailyMissionsCleared(state, economy, today),
    ledger: state.pawAdLedger,
    roomSaved: options?.roomSaved === true,
    inviteDone: options?.inviteDone === true,
  });
  return { ...state, weekly: { ...bag, current } };
}

export function withTodayDraw(state: OpsState, today = trustedKstDateKey()): OpsState {
  const drawsByDate = { ...(state.drawsByDate ?? {}) };
  drawsByDate[today] = (drawsByDate[today] ?? 0) + 1;
  return { ...state, drawsByDate };
}

export function noteWeeklyRoomSaved(state: OpsState, economy?: OpsEconomy, today = trustedKstDateKey()): OpsState {
  return refreshWeekly(state, economy, today, { roomSaved: true });
}

export function noteWeeklyInvite(state: OpsState, economy?: OpsEconomy, today = trustedKstDateKey()): OpsState {
  return refreshWeekly(state, economy, today, { inviteDone: true });
}

export function noteWeeklyJellyAd(state: OpsState, economy?: OpsEconomy, today = trustedKstDateKey()): OpsState {
  const key = weekKeyNow();
  const bag = rollWeeklyBag(state.weekly, key);
  const jellyAdsByDate = { ...bag.current.jellyAdsByDate };
  jellyAdsByDate[today] = (jellyAdsByDate[today] ?? 0) + 1;
  const seeded: WeeklyBag = { ...bag, current: { ...bag.current, jellyAdsByDate } };
  return refreshWeekly({ ...state, weekly: seeded }, economy, today, { weekKey: key });
}

export async function saveWeeklyOps(state: OpsState, sync = true): Promise<void> {
  try {
    await saveOpsState(state);
  } catch {
    try {
      await saveOpsState(state);
    } catch (error) {
      console.warn("[weekly] save failed", error);
    }
  }
  markDirtyUrgent();
  if (sync) scheduleWeeklySync(state);
}

export function scheduleWeeklySync(state: OpsState) {
  syncLatest = state;
  if (syncTimer != null) window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    syncTimer = null;
    const snapshot = syncLatest;
    if (snapshot) void pushWeekly(snapshot);
  }, 700);
}

async function mergeSyncedWeek(state: OpsState, week: unknown, which: "current" | "previous"): Promise<OpsState> {
  const parsed = serverWeekToLog(week);
  const bag = state.weekly;
  if (!parsed || !bag) return state;
  if (which === "current") {
    if (parsed.log.weekKey !== bag.current.weekKey) return state;
    return {
      ...state,
      weekly: {
        ...bag,
        current: mergeWeeklyLogs(bag.current, parsed.log),
        claimed: unionKinds(bag.claimed, parsed.claimed),
      },
    };
  }
  if (!bag.previous || parsed.log.weekKey !== bag.previous.weekKey) return state;
  return {
    ...state,
    weekly: {
      ...bag,
      previous: mergeWeeklyLogs(bag.previous, parsed.log),
      previousClaimed: unionKinds(bag.previousClaimed, parsed.claimed),
    },
  };
}

async function pushWeekly(state: OpsState): Promise<void> {
  const bag = state.weekly;
  if (!bag?.current.weekKey) return;
  const result = await syncWeeklyProgress(bag.current.weekKey, weeklyProgressPayload(bag.current));
  if (!result.ok) return;
  const next = await mergeSyncedWeek(state, result.week, "current");
  if (next !== state) {
    await saveWeeklyOps(next, false);
    applyListener(next);
  }
  void refreshMailbox();
}

function rememberMailbox(state: OpsState, mailbox: unknown): OpsState {
  const parsed = parseWeeklyMailbox(mailbox);
  const bag = state.weekly;
  if (!parsed || !bag) return state;
  return {
    ...state,
    weekly: {
      ...bag,
      mailbox: parsed,
      claimed: unionKinds(bag.claimed, mailboxClaimedKinds(parsed.current)),
      previousClaimed: unionKinds(bag.previousClaimed, mailboxClaimedKinds(parsed.previous)),
    },
  };
}

export async function settleWeeklyOnBoot(state: OpsState, economy?: OpsEconomy): Promise<OpsState> {
  const status = await fetchWeeklyStatus();
  const today = status.ok && status.today ? status.today : trustedKstDateKey();
  const weekKey = status.ok && status.weekKey ? status.weekKey : weekKeyNow();
  let next = refreshWeekly(state, economy, today, { weekKey });
  if (!next.weekly) next = { ...next, weekly: emptyWeeklyBag(weekKey) };
  if (!status.ok) {
    await saveWeeklyOps(next, false);
    void refreshMailbox();
    return next;
  }

  const rules = parseWeeklyRules(status.rules);
  let bag = next.weekly ?? emptyWeeklyBag(weekKey);
  if (rules) bag = { ...bag, rules };
  const currentServer = serverWeekToLog(status.current);
  if (currentServer && currentServer.log.weekKey === bag.current.weekKey) {
    bag = {
      ...bag,
      current: mergeWeeklyLogs(bag.current, currentServer.log),
      claimed: unionKinds(bag.claimed, currentServer.claimed),
    };
  }
  const previousServer = serverWeekToLog(status.previous);
  if (previousServer) {
    const localPrev = bag.previous && bag.previous.weekKey === previousServer.log.weekKey ? bag.previous : null;
    bag = {
      ...bag,
      previous: localPrev ? mergeWeeklyLogs(localPrev, previousServer.log) : previousServer.log,
      previousClaimed: unionKinds(localPrev ? bag.previousClaimed : [], previousServer.claimed),
    };
  }
  next = { ...next, weekly: bag };

  const currentSync = await syncWeeklyProgress(bag.current.weekKey, weeklyProgressPayload(bag.current));
  if (currentSync.ok) next = await mergeSyncedWeek(next, currentSync.week, "current");
  const previous = next.weekly?.previous;
  if (previous) {
    const previousSync = await syncWeeklyProgress(previous.weekKey, weeklyProgressPayload(previous));
    if (previousSync.ok) next = await mergeSyncedWeek(next, previousSync.week, "previous");
    else if (previousSync.error === "week_invalid") {
      next = { ...next, weekly: next.weekly ? { ...next.weekly, previous: null, previousClaimed: [] } : null };
    }
  }

  next = rememberMailbox(next, status.mailbox);
  await saveWeeklyOps(next, false);
  void refreshMailbox();
  return next;
}
