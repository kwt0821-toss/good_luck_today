const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** Asia/Seoul 기준 YYYY-MM-DD. 매일 00:00 KST에 일일 기회가 초기화돼요. */
export function toKstDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Asia/Seoul calendar year as `"2026"`. */
export function toKstYearKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).format(date);
}

export function formatKoreanDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(date);

  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? WEEKDAYS[date.getDay()];
  return `${month}월 ${day}일 ${weekday}요일`;
}

export function formatShortDate(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}월 ${Number(day)}일`;
}

/**
 * Monday date key (YYYY-MM-DD) for the KST week containing `date`.
 * Shop ticket week limits reset Monday 00:00 KST.
 */
export function toKstMondayWeekKey(date = new Date()): string {
  const key = toKstDateKey(date);
  const [year, month, day] = key.split("-").map(Number);
  // 12:00 KST = 03:00 UTC on that calendar date
  const probe = new Date(Date.UTC(year, month - 1, day, 3, 0, 0));
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(probe);
  const offsetFromMonday: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const delta = offsetFromMonday[weekday] ?? 0;
  const monday = new Date(Date.UTC(year, month - 1, day - delta));
  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, "0");
  const d = String(monday.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Ms until the next Asia/Seoul midnight (daily draw reset). */
export function msUntilNextKstMidnight(date = new Date()): number {
  const key = toKstDateKey(date);
  const [year, month, day] = key.split("-").map(Number);
  // KST midnight at the end of `key` = that calendar date 15:00 UTC.
  const endOfKstDayUtc = Date.UTC(year, month - 1, day, 15, 0, 0);
  return Math.max(0, endOfKstDayUtc - date.getTime());
}

export function formatCountdownHms(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** 홈 시안용 날짜. 예: Nº 023 · FRI 10.09 */
export function formatLuckyCatalogDate(date = new Date()): string {
  const key = toKstDateKey(date);
  const [year, month, day] = key.split("-").map(Number);
  const start = Date.UTC(year, 0, 1);
  const current = Date.UTC(year, month - 1, day);
  const dayOfYear = Math.floor((current - start) / 86_400_000) + 1;
  const weekday =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Seoul",
      weekday: "short",
    })
      .format(date)
      .toUpperCase();

  return `Nº ${String(dayOfYear).padStart(3, "0")} · ${weekday} ${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
}
