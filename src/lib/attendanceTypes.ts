export type AttendancePhase = "firstWeek" | "weeklyCycle";

export type AttendanceReward =
  | { kind: "item"; itemId: string; attendanceOnly?: boolean }
  | { kind: "paw"; paw: number }
  | { kind: "rateUpTicket"; count: number }
  | { kind: "badge"; badgeId: string; labelKo?: string };

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
