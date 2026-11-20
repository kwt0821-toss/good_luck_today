import { dailyMissionsCleared } from "./dailyMissions";
import { toKstMondayWeekKey } from "./date";
import type { OpsEconomy, OpsState } from "./opsTypes";
import { saveOpsState } from "./opsStorage";
import { markDirtyUrgent } from "./serverSave";
import { adoptServerJelly } from "./serverJelly";
import {
  claimWeeklyChest,
  fetchWeeklyStatus,
  syncWeeklyProgress,
  walletGet,
  type WeeklyClaimResult,
} from "./serverWallet";
import { trustedKstDateKey, trustedNow } from "./tossClock";
import {
  absorbWeeklySources,
  applyChestGrant,
  chestReady,
  emptyWeeklyBag,
  mergeWeeklyLogs,
  parseWeeklyRules,
  pendingChestKinds,
  rollWeeklyBag,
  serverWeekToLog,
  unionKinds,
  weeklyProgressPayload,
  type AppliedChest,
  type WeeklyBag,
  type WeeklyChestKind,
} from "./weeklyMissions";

export type WeeklyCelebrate = {
  title: string;
  lines: string[];
  past?: boolean;
};

let celebrateListener: (view: WeeklyCelebrate) => void = () => {};
let applyListener: (state: OpsState) => void = () => {};
let syncTimer: number | null = null;
let syncLatest: OpsState | null = null;

export function bindWeeklyCelebrate(listener: (view: WeeklyCelebrate) => void) {
  celebrateListener = listener;
}

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
  if (next === state) return;
  await saveWeeklyOps(next, false);
  applyListener(next);
}

function claimLines(result: WeeklyClaimResult, beforeKeys: Set<string>): string[] {
  if (result.already) return [];
  const lines: string[] = [];
  if (result.jelly > 0) lines.push(`젤리 ${result.jelly}`);
  if (result.ticketKeys.some((key) => key.startsWith("weeklyChest:") && !beforeKeys.has(key))) {
    lines.push("확률업 뽑기권 1장");
  }
  if (result.nyangCoin > 0) lines.push(`냥코인 ${result.nyangCoin}`);
  return lines;
}

function claimMessage(error: string): string {
  if (error === "local") return "서버가 필요할 때 받을 수 있어요";
  if (error === "not_ready") return "아직 도장이 모자라요";
  if (error === "week_invalid") return "지난 주 선물만 받을 수 있어요";
  if (error === "disabled") return "지금은 준비 중이에요";
  if (error === "blocked") return "지금은 받을 수 없어요";
  return "다시 시도해 주세요";
}

async function claimKinds(
  state: OpsState,
  which: "current" | "previous",
  only?: WeeklyChestKind,
): Promise<{ state: OpsState; lines: string[]; message: string | null }> {
  const bag = state.weekly ?? emptyWeeklyBag(weekKeyNow());
  const log = which === "current" ? bag.current : bag.previous;
  if (!log) return { state, lines: [], message: null };
  const claimed = which === "current" ? bag.claimed : bag.previousClaimed;
  const kinds = (only ? [only] : pendingChestKinds(log, claimed)).filter(
    (kind) => !claimed.includes(kind) && chestReady(log, kind),
  );
  if (kinds.length === 0) return { state, lines: [], message: only ? "아직이에요" : null };

  let next = state.weekly ? state : { ...state, weekly: bag };
  const lines: string[] = [];
  let message: string | null = null;
  let sawNyang = false;

  for (const kind of kinds) {
    const live = next.weekly;
    if (!live) break;
    const beforeKeys = new Set(next.inviteTicketKeys ?? []);
    const applied: AppliedChest[] = (which === "current" ? live.claimed : live.previousClaimed).map((item) => ({
      weekKey: log.weekKey,
      kind: item,
    }));
    const result = await claimWeeklyChest({
      weekKey: log.weekKey,
      kind,
      ticketsHeld: next.rateUpTickets,
    });
    if (!result.ok) {
      message = claimMessage(result.error);
      if (result.error === "week_invalid" && which === "previous") {
        next = { ...next, weekly: { ...live, previous: null, previousClaimed: [] } };
      }
      break;
    }
    if (result.jellyBalance != null) {
      adoptServerJelly(result.jellyBalance);
      next = { ...next, pawBalance: result.jellyBalance };
    }
    if (result.nyangCoinBalance != null) {
      next = { ...next, nyangCoinBalance: result.nyangCoinBalance };
      sawNyang = result.nyangCoin > 0 || sawNyang;
    } else if (result.nyangCoin > 0) {
      sawNyang = true;
    }
    const grant = applyChestGrant(
      applied,
      {
        weekKey: log.weekKey,
        kind,
        jelly: result.jelly,
        nyang: result.nyangCoin,
        ticketKeys: result.ticketKeys,
        already: result.already,
      },
      { held: next.rateUpTickets, keys: next.inviteTicketKeys ?? [] },
    );
    next = {
      ...next,
      rateUpTickets: grant.tickets.held,
      inviteTicketKeys: grant.tickets.keys,
    };
    const parsed = serverWeekToLog(result.week);
    const claimedNow = unionKinds(
      which === "current" ? next.weekly?.claimed ?? [] : next.weekly?.previousClaimed ?? [],
      [kind],
    );
    const bagNow = next.weekly ?? live;
    if (which === "current") {
      const current =
        parsed && parsed.log.weekKey === bagNow.current.weekKey
          ? mergeWeeklyLogs(bagNow.current, parsed.log)
          : bagNow.current;
      next = { ...next, weekly: { ...bagNow, current, claimed: claimedNow } };
    } else {
      const previousLog =
        parsed && bagNow.previous && parsed.log.weekKey === bagNow.previous.weekKey
          ? mergeWeeklyLogs(bagNow.previous, parsed.log)
          : bagNow.previous;
      const stillWaiting = previousLog ? pendingChestKinds(previousLog, claimedNow).length > 0 : false;
      next = {
        ...next,
        weekly: {
          ...bagNow,
          previous: stillWaiting ? previousLog : null,
          previousClaimed: stillWaiting ? claimedNow : [],
        },
      };
    }
    lines.push(...claimLines(result, beforeKeys));
  }

  if (sawNyang) void walletGet();
  return { state: next, lines, message };
}

export async function claimWeeklyFromBoard(
  state: OpsState,
  kind: WeeklyChestKind,
  economy?: OpsEconomy,
): Promise<{ state: OpsState; message: string | null; celebrate: WeeklyCelebrate | null }> {
  let next = refreshWeekly(state, economy);
  const synced = await syncWeeklyProgress(
    next.weekly?.current.weekKey ?? weekKeyNow(),
    weeklyProgressPayload(next.weekly?.current ?? emptyWeeklyBag(weekKeyNow()).current),
  );
  if (synced.ok) next = await mergeSyncedWeek(next, synced.week, "current");
  if (!synced.ok && synced.error === "local") {
    return { state: next, message: "서버가 필요할 때 받을 수 있어요", celebrate: null };
  }
  const claimed = await claimKinds(next, "current", kind);
  await saveWeeklyOps(claimed.state, false);
  const celebrate =
    claimed.lines.length > 0
      ? {
          title: kind === "invite" ? "선택 미션을 끝냈어요" : `${kind}도장 달성`,
          lines: claimed.lines,
        }
      : null;
  if (celebrate) celebrateListener(celebrate);
  return { state: claimed.state, message: claimed.lines.length ? null : claimed.message, celebrate };
}

export async function settleWeeklyOnBoot(state: OpsState, economy?: OpsEconomy): Promise<OpsState> {
  const status = await fetchWeeklyStatus();
  const today = status.ok && status.today ? status.today : trustedKstDateKey();
  const weekKey = status.ok && status.weekKey ? status.weekKey : weekKeyNow();
  let next = refreshWeekly(state, economy, today, { weekKey });
  if (!next.weekly) next = { ...next, weekly: emptyWeeklyBag(weekKey) };
  if (!status.ok) {
    await saveWeeklyOps(next, false);
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

  const past = await claimKinds(next, "previous");
  await saveWeeklyOps(past.state, false);
  if (past.lines.length > 0) {
    celebrateListener({ title: "지난 주 선물을 받았어요", lines: past.lines, past: true });
  }
  return past.state;
}
