export type AttendancePhase = "firstWeek" | "weeklyCycle";

export type AttendanceReward =
  | { kind: "item"; itemId: string; attendanceOnly?: boolean }
  | { kind: "paw"; paw: number }
  | { kind: "rateUpTicket"; count: number }
  | { kind: "badge"; badgeId: string; labelKo?: string }
  | { kind: "nyangCoin"; nyangCoin: number };

export type AttendanceClaimResponse = {
  attendanceDays: number;
  phase: AttendancePhase;
  cycleNo: number | null;
  cycleDay: number | null;
  rewards: AttendanceReward[];
  nextMilestone: { days: number; labelKo?: string; badgeId?: string; itemId?: string } | null;
  canClaimToday: boolean;
  /** Present after a successful claim */
  claimed?: boolean;
  error?: string;
};

export type AttendanceStatusResponse = AttendanceClaimResponse & {
  lastAttendDateKST: string;
  rateUpTickets: number;
  badges: string[];
  todayRewardLabel: string;
  /** True when today's claimable day is weekly-cycle day 7 (needs day7Bonus UI). */
  isWeeklyDay7?: boolean;
  weekCells: Array<{
    day: number;
    label: string;
    claimed: boolean;
    isToday: boolean;
    rewardLabel: string;
  }>;
  firstWeekGifts: Array<{
    day: number;
    itemId: string;
    nameKo: string;
    thumb: string;
    claimed: boolean;
    isToday: boolean;
    attendanceOnly: boolean;
  }>;
};

/** POST /attendance/day7/claim body */
export type AttendanceDay7ClaimBody = {
  cycleNo: number;
  withAd: boolean;
  adToken?: string;
  requestId: string;
};

export type AttendanceDay7ClaimOk = {
  ok: true;
  cycleNo: number;
  withAd: boolean;
  alreadyProcessed?: boolean;
  nyangCoin: number;
  paw: number;
  tickets: number;
  /** Existing day7 gift (item box / rate-up ticket / paw fallback) */
  itemOrTicket: AttendanceReward | null;
  rewards: AttendanceReward[];
  balances: {
    pawBalance: number;
    nyangCoinBalance: number;
    rateUpTickets: number;
  };
  /** Overflow 냥코인 converted to P when yearlyCoinCap is on */
  overflowPaw?: number;
  attendanceDays: number;
};

export type AttendanceDay7ClaimResponse =
  | AttendanceDay7ClaimOk
  | { ok: false; reason: string };
