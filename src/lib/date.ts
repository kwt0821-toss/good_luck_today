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
