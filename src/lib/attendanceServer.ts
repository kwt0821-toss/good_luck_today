import { toKstDateKey, toKstYearKey } from "./date";
import type {
  AttendanceClaimResponse,
  AttendanceDay7ClaimBody,
  AttendanceDay7ClaimResponse,
  AttendancePhase,
  AttendanceReward,
} from "./attendanceTypes";
import { grantNyangCoinOnce } from "./mockToss";
import { loadOpsConfig } from "./opsConfig";
import type {
  AttendanceDay7BonusConfig,
  OpsConfig,
  OpsStarter,
  OpsState,
} from "./opsTypes";
import { saveOpsState } from "./opsStorage";

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function attendancePhase(days: number): AttendancePhase {
  return days <= 7 ? "firstWeek" : "weeklyCycle";
}

export function cycleInfo(n: number): { cycleNo: number; cycleDay: number } | null {
  if (n < 8) return null;
  const cycleNo = Math.floor((n - 8) / 7) + 1;
  const cycleDay = ((n - 8) % 7) + 1;
  return { cycleNo, cycleDay };
}

export function canClaimAttendanceToday(state: OpsState, today = toKstDateKey()): boolean {
  return state.lastAttendDateKST !== today;
}

/** Next claimable attendance day is weekly-cycle day 7 (day ≥ 8). */
export function isUpcomingWeeklyDay7(state: OpsState, today = toKstDateKey()): boolean {
  if (!canClaimAttendanceToday(state, today)) return false;
  const cycle = cycleInfo(state.attendanceDays + 1);
  return cycle?.cycleDay === 7;
}

export function readDay7BonusConfig(config: OpsConfig): AttendanceDay7BonusConfig | null {
  const att = config.economy.pawSources.attendance;
  if (!att || typeof att === "string") return null;
  return att.weeklyCycle?.day7Bonus ?? null;
}

export function nextMilestone(
  starter: OpsStarter,
  attendanceDays: number,
  claimedMilestoneDays: number[],
) {
  const milestones = starter.attendance?.milestones ?? [];
  return (
    milestones.find((m) => m.days > attendanceDays && !claimedMilestoneDays.includes(m.days)) ??
    null
  );
}

function pickUnownedFromPool(pool: string[], owned: string[]): string | null {
  const missing = pool.filter((id) => !owned.includes(id));
  if (!missing.length) return null;
  const index = Math.floor(Math.random() * missing.length);
  return missing[index] ?? null;
}

function buildRewardsForDay(
  n: number,
  config: OpsConfig,
  ownedItemIds: string[],
  rateUpTickets: number,
): AttendanceReward[] {
  const att = config.starter.attendance;
  if (!att) return [];
  const rewards: AttendanceReward[] = [];

  if (n <= 7) {
    const gift = att.firstWeek[n - 1];
    if (gift?.itemId) {
      rewards.push({ kind: "item", itemId: gift.itemId, attendanceOnly: true });
    }
    return rewards;
  }

  const cycle = cycleInfo(n);
  if (!cycle) return rewards;
  const { cycleNo, cycleDay } = cycle;

  if (cycleDay <= 6) {
    const day = att.weeklyCycle.days.find((row) => row.day === cycleDay);
    if (day) rewards.push({ kind: "paw", paw: day.paw });
  } else {
    const day7 = att.weeklyCycle.day7;
    if (day7.mode === "alternate") {
      if (cycleNo % 2 === 1) {
        const picked = pickUnownedFromPool(day7.itemBox.pool, ownedItemIds);
        if (picked) {
          rewards.push({ kind: "item", itemId: picked, attendanceOnly: true });
        } else {
          rewards.push({ kind: "paw", paw: day7.itemBox.fallbackWhenAllOwned.paw });
        }
      } else {
        const maxHold = config.economy.tickets?.rateUpTicket?.maxHold ?? 3;
        if (rateUpTickets < maxHold) {
          rewards.push({ kind: "rateUpTicket", count: 1 });
        } else {
          rewards.push({ kind: "paw", paw: day7.itemBox.fallbackWhenAllOwned.paw });
        }
      }
    }
  }

  const milestone = att.milestones.find((m) => m.days === n);
  if (milestone) {
    if (milestone.itemId) {
      rewards.push({ kind: "item", itemId: milestone.itemId, attendanceOnly: true });
    }
    if (milestone.badgeId) {
      rewards.push({
        kind: "badge",
        badgeId: milestone.badgeId,
        labelKo: milestone.labelKo,
      });
    }
  }

  return rewards;
}

export function todayRewardLabel(
  nPreview: number,
  config: OpsConfig,
  ownedItemIds: string[],
  rateUpTickets: number,
): string {
  const rewards = buildRewardsForDay(nPreview, config, ownedItemIds, rateUpTickets);
  const first = rewards[0];
  if (!first) return "출석 선물";
  if (first.kind === "item") {
    const price = config.prices.items.find((item) => item.id === first.itemId);
    return price?.nameKo ?? first.itemId;
  }
  if (first.kind === "paw") return `${first.paw}P`;
  if (first.kind === "rateUpTicket") return config.economy.tickets?.rateUpTicket?.nameKo ?? "확률업 이용권";
  if (first.kind === "nyangCoin") return `${first.nyangCoin}냥코인`;
  if (first.kind === "badge") return first.labelKo ?? first.badgeId;
  return "출석 선물";
}

function applyRewards(state: OpsState, rewards: AttendanceReward[], milestoneDays: number[]): OpsState {
  let next = { ...state };
  const owned = new Set(next.ownedItemIds);
  const badges = new Set(next.attendanceBadges);
  const claimed = new Set(next.claimedMilestoneDays);

  for (const reward of rewards) {
    if (reward.kind === "item") {
      owned.add(reward.itemId);
    } else if (reward.kind === "paw") {
      next = { ...next, pawBalance: next.pawBalance + reward.paw };
    } else if (reward.kind === "rateUpTicket") {
      next = { ...next, rateUpTickets: next.rateUpTickets + reward.count };
    } else if (reward.kind === "badge") {
      badges.add(reward.badgeId);
    }
  }
  for (const day of milestoneDays) claimed.add(day);

  return {
    ...next,
    ownedItemIds: [...owned],
    attendanceBadges: [...badges],
    claimedMilestoneDays: [...claimed],
  };
}

/**
 * Server-only attendance claim.
 * Mocked locally with the same response contract as POST /attendance/claim.
 */
export async function claimAttendanceOnServer(
  state: OpsState,
): Promise<{ state: OpsState; response: AttendanceClaimResponse }> {
  await delay(40);
  const config = await loadOpsConfig();
  const today = toKstDateKey();
  if (!config.starter.attendance) {
    return {
      state,
      response: {
        attendanceDays: state.attendanceDays,
        phase: attendancePhase(state.attendanceDays),
        cycleNo: cycleInfo(state.attendanceDays)?.cycleNo ?? null,
        cycleDay: cycleInfo(state.attendanceDays)?.cycleDay ?? null,
        rewards: [],
        nextMilestone: null,
        canClaimToday: false,
        error: "출석 설정이 없어요",
      },
    };
  }

  if (!canClaimAttendanceToday(state, today)) {
    const days = state.attendanceDays;
    const cycle = cycleInfo(days);
    return {
      state,
      response: {
        attendanceDays: days,
        phase: attendancePhase(days),
        cycleNo: cycle?.cycleNo ?? null,
        cycleDay: cycle?.cycleDay ?? null,
        rewards: [],
        nextMilestone: nextMilestone(config.starter, days, state.claimedMilestoneDays),
        canClaimToday: false,
        claimed: false,
        error: "오늘 이미 출석했어요",
      },
    };
  }

  const n = state.attendanceDays + 1;
  const upcoming = cycleInfo(n);
  if (upcoming?.cycleDay === 7) {
    return {
      state,
      response: {
        attendanceDays: state.attendanceDays,
        phase: "weeklyCycle",
        cycleNo: upcoming.cycleNo,
        cycleDay: 7,
        rewards: [],
        nextMilestone: nextMilestone(config.starter, state.attendanceDays, state.claimedMilestoneDays),
        canClaimToday: true,
        error: "DAY7_BONUS_REQUIRED",
      },
    };
  }

  const rewards = buildRewardsForDay(n, config, state.ownedItemIds, state.rateUpTickets);
  const milestoneHit = (config.starter.attendance.milestones ?? [])
    .filter((m) => m.days === n)
    .map((m) => m.days);

  // Idempotency key: tossUserKey + attendanceMilestone:{days}
  for (const days of milestoneHit) {
    const key = `${state.userId}+attendanceMilestone:${days}`;
    if (state.grantedNyangCoinRewardIds.includes(key)) {
      // Already granted — strip duplicate milestone rewards
      // (keeps day rewards; milestones are once per account)
    }
  }

  let next: OpsState = {
    ...state,
    attendanceDays: n,
    lastAttendDateKST: today,
    // legacy mirrors
    attendanceClaimed: Math.min(n, 7),
    lastAttendanceDateKey: today,
  };

  const filteredRewards = rewards.filter((reward) => {
    if (reward.kind !== "badge" && reward.kind !== "item") return true;
    if (!milestoneHit.length) return true;
    // Milestone item+badge once per account via idempotency ledger
    const milestone = config.starter.attendance!.milestones.find((m) => m.days === n);
    if (!milestone) return true;
    const key = `${state.userId}+attendanceMilestone:${milestone.days}`;
    if (state.grantedNyangCoinRewardIds.includes(key)) {
      return reward.kind !== "badge" && !(reward.kind === "item" && reward.itemId === milestone.itemId);
    }
    return true;
  });

  next = applyRewards(next, filteredRewards, milestoneHit);
  if (milestoneHit.length) {
    const milestone = config.starter.attendance.milestones.find((m) => m.days === n);
    if (milestone) {
      const key = `${state.userId}+attendanceMilestone:${milestone.days}`;
      if (!next.grantedNyangCoinRewardIds.includes(key)) {
        next = { ...next, grantedNyangCoinRewardIds: [...next.grantedNyangCoinRewardIds, key] };
      }
    }
  }

  const maxHold = config.economy.tickets?.rateUpTicket?.maxHold ?? 3;
  next = { ...next, rateUpTickets: Math.min(next.rateUpTickets, maxHold) };

  await saveOpsState(next);
  const cycle = cycleInfo(n);
  return {
    state: next,
    response: {
      attendanceDays: n,
      phase: attendancePhase(n),
      cycleNo: cycle?.cycleNo ?? null,
      cycleDay: cycle?.cycleDay ?? null,
      rewards: filteredRewards,
      nextMilestone: nextMilestone(config.starter, n, next.claimedMilestoneDays),
      canClaimToday: false,
      claimed: true,
    },
  };
}

export async function getAttendanceStatus(state: OpsState): Promise<{
  state: OpsState;
  status: import("./attendanceTypes").AttendanceStatusResponse;
}> {
  const config = await loadOpsConfig();
  const today = toKstDateKey();
  const canClaim = canClaimAttendanceToday(state, today);
  const days = state.attendanceDays;
  const previewN = canClaim ? days + 1 : days;
  const cycle = cycleInfo(Math.max(previewN, days));
  const att = config.starter.attendance;

  const firstWeekGifts = (att?.firstWeek ?? []).map((gift) => {
    const price = config.prices.items.find((item) => item.id === gift.itemId);
    const claimed = days >= gift.day;
    const isToday = canClaim && previewN === gift.day && previewN <= 7;
    return {
      day: gift.day,
      itemId: gift.itemId,
      nameKo: price?.nameKo ?? gift.itemId,
      thumb: `/assets/menu/gift-${gift.itemId}.png`,
      claimed,
      isToday,
      attendanceOnly: true,
    };
  });

  const weekCells = Array.from({ length: 7 }, (_, i) => {
    const day = i + 1;
    const cycleDay = cycle?.cycleDay ?? (canClaim && previewN >= 8 ? ((previewN - 8) % 7) + 1 : null);
    const claimedInWeek =
      days >= 8 && cycle
        ? days >= 8 + (cycle.cycleNo - 1) * 7 + (day - 1)
        : false;
    let rewardLabel = "";
    if (day <= 6) {
      const paw = att?.weeklyCycle.days.find((row) => row.day === day)?.paw;
      rewardLabel = paw != null ? `${paw}P` : "";
    } else {
      rewardLabel = "특별 선물";
    }
    return {
      day,
      label: `DAY ${day}`,
      claimed: Boolean(claimedInWeek && !(canClaim && cycleDay === day)),
      isToday: Boolean(canClaim && cycleDay === day),
      rewardLabel,
    };
  });

  const label = todayRewardLabel(previewN || 1, config, state.ownedItemIds, state.rateUpTickets);
  const activePhase: AttendancePhase =
    !canClaim && days === 0
      ? "firstWeek"
      : canClaim
        ? attendancePhase(previewN)
        : attendancePhase(days);
  const isWeeklyDay7 = Boolean(canClaim && cycleInfo(previewN)?.cycleDay === 7);

  return {
    state,
    status: {
      attendanceDays: days,
      phase: activePhase,
      cycleNo: cycle?.cycleNo ?? null,
      cycleDay: cycle?.cycleDay ?? null,
      rewards: [],
      nextMilestone: nextMilestone(config.starter, days, state.claimedMilestoneDays),
      canClaimToday: canClaim,
      lastAttendDateKST: state.lastAttendDateKST,
      rateUpTickets: state.rateUpTickets,
      badges: state.attendanceBadges,
      todayRewardLabel: isWeeklyDay7 ? "7일 보너스" : label,
      isWeeklyDay7,
      weekCells: weekCells.map((cell) =>
        cell.day === 7 && isWeeklyDay7
          ? { ...cell, rewardLabel: "5냥코인+" }
          : cell,
      ),
      firstWeekGifts,
    },
  };
}

export function buildAttendanceDay7RequestId(cycleNo: number): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `d7_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return `att7:${cycleNo}:${id}`;
}

function day7CycleIdempotencyKey(userId: string, cycleNo: number) {
  return `${userId}+att7:${cycleNo}`;
}

/**
 * POST /attendance/day7/claim { cycleNo, withAd, adToken?, requestId }
 * Grants existing day7 gift + base/ad bonus. Once per cycle (tossUserKey+cycleNo).
 */
export async function claimAttendanceDay7OnServer(
  state: OpsState,
  body: AttendanceDay7ClaimBody,
): Promise<{ state: OpsState; response: AttendanceDay7ClaimResponse }> {
  await delay(40);
  const { cycleNo, withAd, adToken, requestId } = body;
  if (!requestId || !cycleNo || cycleNo < 1) {
    return { state, response: { ok: false, reason: "요청이 올바르지 않아요" } };
  }

  const priorByRequest = (state.attendanceDay7Ledger ?? []).find(
    (row) => row.requestId === requestId,
  );
  if (priorByRequest) {
    return {
      state,
      response: {
        ok: true,
        cycleNo: priorByRequest.cycleNo,
        withAd: priorByRequest.withAd,
        alreadyProcessed: true,
        nyangCoin: priorByRequest.nyangCoin,
        paw: priorByRequest.paw,
        tickets: priorByRequest.tickets,
        itemOrTicket: null,
        rewards: [],
        balances: {
          pawBalance: priorByRequest.pawBalance,
          nyangCoinBalance: priorByRequest.nyangCoinBalance,
          rateUpTickets: priorByRequest.rateUpTickets,
        },
        attendanceDays: state.attendanceDays,
      },
    };
  }

  const config = await loadOpsConfig();
  const bonus = readDay7BonusConfig(config);
  if (!bonus || !config.starter.attendance) {
    return { state, response: { ok: false, reason: "출석 보너스 설정이 없어요" } };
  }

  const today = toKstDateKey();
  if (!canClaimAttendanceToday(state, today)) {
    return { state, response: { ok: false, reason: "오늘 이미 출석했어요" } };
  }

  const n = state.attendanceDays + 1;
  const cycle = cycleInfo(n);
  if (!cycle || cycle.cycleDay !== 7 || cycle.cycleNo !== cycleNo) {
    return { state, response: { ok: false, reason: "7일차 보너스를 받을 수 없어요" } };
  }

  const cycleKey = day7CycleIdempotencyKey(state.userId, cycleNo);
  if (
    state.grantedNyangCoinRewardIds.includes(cycleKey) ||
    (state.attendanceDay7Ledger ?? []).some((row) => row.cycleNo === cycleNo)
  ) {
    return { state, response: { ok: false, reason: "이번 주기 보너스는 이미 받았어요" } };
  }

  if (withAd && !adToken) {
    return { state, response: { ok: false, reason: "광고 완료를 확인하지 못했어요" } };
  }

  const maxHold = config.economy.tickets?.rateUpTicket?.maxHold ?? 3;
  const existingRewards = buildRewardsForDay(n, config, state.ownedItemIds, state.rateUpTickets);
  // Strip milestone handling into apply path below — buildRewards includes milestones.
  const milestoneHit = (config.starter.attendance.milestones ?? [])
    .filter((m) => m.days === n)
    .map((m) => m.days);

  const pack = withAd ? bonus.adBonus : bonus.base;
  let wantNyang = pack.nyangCoin;
  let wantPaw = pack.paw;
  let wantTickets = withAd ? (bonus.adBonus.rateUpTicket ?? 0) : 0;

  let next: OpsState = {
    ...state,
    attendanceDays: n,
    lastAttendDateKST: today,
    attendanceClaimed: Math.min(n, 7),
    lastAttendanceDateKey: today,
  };

  next = applyRewards(next, existingRewards, milestoneHit);

  // Yearly 냥코인 cap → overflow to P (10P each)
  const yearKey = toKstYearKey();
  let yearGranted =
    next.attendanceNyangYearKey === yearKey ? next.attendanceNyangCoinYear : 0;
  let overflowPaw = 0;
  const cap = bonus.yearlyCoinCap;
  if (cap?.enabled) {
    const limit = cap.proposal ?? 300;
    const room = Math.max(0, limit - yearGranted);
    if (wantNyang > room) {
      overflowPaw = (wantNyang - room) * 10;
      wantNyang = room;
    }
  }

  if (wantTickets > 0) {
    const room = Math.max(0, maxHold - next.rateUpTickets);
    wantTickets = Math.min(wantTickets, room);
  }

  next = {
    ...next,
    pawBalance: next.pawBalance + wantPaw + overflowPaw,
    rateUpTickets: Math.min(next.rateUpTickets + wantTickets, maxHold),
    attendanceNyangYearKey: yearKey,
    attendanceNyangCoinYear: yearGranted + wantNyang,
  };

  if (wantNyang > 0) {
    const toss = await grantNyangCoinOnce(next, {
      tossUserKey: next.userId,
      rewardId: cycleKey,
      amount: wantNyang,
    });
    next = toss.state;
    if (toss.result.ok && toss.result.alreadyGranted) {
      // Cycle already granted somehow — keep paw/tickets from this attempt? Prefer fail-safe.
    }
  } else {
    // Still mark cycle claimed even when all 냥코인 converted to P
    if (!next.grantedNyangCoinRewardIds.includes(cycleKey)) {
      next = {
        ...next,
        grantedNyangCoinRewardIds: [...next.grantedNyangCoinRewardIds, cycleKey],
      };
    }
  }

  if (milestoneHit.length) {
    const milestone = config.starter.attendance.milestones.find((m) => m.days === n);
    if (milestone) {
      const key = `${next.userId}+attendanceMilestone:${milestone.days}`;
      if (!next.grantedNyangCoinRewardIds.includes(key)) {
        next = { ...next, grantedNyangCoinRewardIds: [...next.grantedNyangCoinRewardIds, key] };
      }
    }
  }

  const itemOrTicket =
    existingRewards.find(
      (reward) =>
        reward.kind === "item" || reward.kind === "rateUpTicket" || reward.kind === "paw",
    ) ?? null;

  const bonusRewards: AttendanceReward[] = [];
  if (wantNyang > 0) bonusRewards.push({ kind: "nyangCoin", nyangCoin: wantNyang });
  if (wantPaw + overflowPaw > 0) bonusRewards.push({ kind: "paw", paw: wantPaw + overflowPaw });
  if (wantTickets > 0) bonusRewards.push({ kind: "rateUpTicket", count: wantTickets });

  const entry = {
    requestId,
    cycleNo,
    withAd,
    createdAt: Date.now(),
    nyangCoin: wantNyang,
    paw: wantPaw + overflowPaw,
    tickets: wantTickets,
    pawBalance: next.pawBalance,
    nyangCoinBalance: next.nyangCoinBalance,
    rateUpTickets: next.rateUpTickets,
  };
  next = {
    ...next,
    attendanceDay7Ledger: [entry, ...(next.attendanceDay7Ledger ?? [])].slice(0, 80),
  };

  await saveOpsState(next);
  return {
    state: next,
    response: {
      ok: true,
      cycleNo,
      withAd,
      nyangCoin: wantNyang,
      paw: wantPaw + overflowPaw,
      tickets: wantTickets,
      itemOrTicket,
      rewards: [...existingRewards, ...bonusRewards],
      balances: {
        pawBalance: next.pawBalance,
        nyangCoinBalance: next.nyangCoinBalance,
        rateUpTickets: next.rateUpTickets,
      },
      overflowPaw: overflowPaw || undefined,
      attendanceDays: n,
    },
  };
}

/** Reject shop purchase of attendance-only items. */
export function assertPurchasableItem(config: OpsConfig, itemId: string): string | null {
  const exclude = config.economy.shop?.excludeSources ?? ["attendance"];
  const onlyIds = new Set(config.prices.attendanceOnly?.ids ?? []);
  const priced = config.prices.items.find((item) => item.id === itemId);
  const source = priced?.source;
  const flagged = priced?.flags?.includes("attendance");
  if (onlyIds.has(itemId) || flagged || (source && exclude.includes(source))) {
    return "출석 한정 아이템은 구매할 수 없어요";
  }
  return null;
}

export function isAttendanceOnlyId(config: OpsConfig, itemId: string): boolean {
  if (config.prices.attendanceOnly?.ids?.includes(itemId)) return true;
  const priced = config.prices.items.find((item) => item.id === itemId);
  return priced?.source === "attendance" || Boolean(priced?.flags?.includes("attendance"));
}
