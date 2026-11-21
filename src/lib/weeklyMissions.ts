import { toKstDateKey, toKstMondayWeekKey } from "./date.ts";

/** One KST week of weekly-mission evidence. Counters are derived from this log. */
export type WeeklyLog = {
  weekKey: string;
  attendDates: string[];
  draws: number;
  petsByDate: Record<string, number>;
  dailyClearDates: string[];
  roomSaved: boolean;
  jellyAdsByDate: Record<string, number>;
  inviteDone: boolean;
};

export type WeeklyRules = {
  chest3Jelly: number;
  chest6Jelly: number;
  chest9Jelly: number;
  chest9Nyang: number;
  inviteJelly: number;
  ticketMaxHold: number;
};

export type WeeklyChestKind = "3" | "6" | "9" | "invite";

export type MailboxSlot = "none" | "pending" | "claimed" | "expired";

export type WeeklyMailboxMap = Partial<Record<WeeklyChestKind, MailboxSlot>>;

export type WeeklyMailbox = {
  current: WeeklyMailboxMap;
  previous: WeeklyMailboxMap;
};

export type WeeklyBag = {
  current: WeeklyLog;
  previous: WeeklyLog | null;
  claimed: string[];
  previousClaimed: string[];
  rules: WeeklyRules | null;
  /** Letters the server already moved into the mailbox. */
  mailbox?: WeeklyMailbox | null;
};

export const WEEKLY_STAMP_MAX = 9;
export const WEEKLY_TICKET_BONUS_MAX = 4;

export const FALLBACK_WEEKLY_RULES: WeeklyRules = {
  chest3Jelly: 50,
  chest6Jelly: 50,
  chest9Jelly: 100,
  chest9Nyang: 20,
  inviteJelly: 20,
  ticketMaxHold: 3,
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const CHEST_KINDS = new Set<string>(["3", "6", "9", "invite"]);

export function emptyWeeklyLog(weekKey: string): WeeklyLog {
  return {
    weekKey,
    attendDates: [],
    draws: 0,
    petsByDate: {},
    dailyClearDates: [],
    roomSaved: false,
    jellyAdsByDate: {},
    inviteDone: false,
  };
}

export function emptyWeeklyBag(weekKey: string): WeeklyBag {
  return {
    current: emptyWeeklyLog(weekKey),
    previous: null,
    claimed: [],
    previousClaimed: [],
    rules: null,
  };
}

/** Noon KST on a calendar key, so the week key does not depend on the device zone. */
export function dateKeyToUtcNoon(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 3, 0, 0));
}

export function weekKeyForDateKey(dateKey: string): string {
  return toKstMondayWeekKey(dateKeyToUtcNoon(dateKey));
}

export function dateInWeek(dateKey: string, weekKey: string): boolean {
  return DATE_KEY.test(dateKey) && weekKeyForDateKey(dateKey) === weekKey;
}

function uniqueDates(dates: string[], weekKey?: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const date of dates) {
    if (!DATE_KEY.test(date) || seen.has(date)) continue;
    if (weekKey && !dateInWeek(date, weekKey)) continue;
    seen.add(date);
    out.push(date);
  }
  out.sort();
  return out;
}

function countMap(value: Record<string, number> | null | undefined, weekKey?: string): Record<string, number> {
  const out: Record<string, number> = {};
  if (!value) return out;
  for (const [date, raw] of Object.entries(value)) {
    if (!DATE_KEY.test(date)) continue;
    if (weekKey && !dateInWeek(date, weekKey)) continue;
    if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) continue;
    out[date] = Math.floor(raw);
  }
  return out;
}

function maxMaps(left: Record<string, number>, right: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { ...left };
  for (const [date, count] of Object.entries(right)) {
    out[date] = Math.max(out[date] ?? 0, count);
  }
  return out;
}

export function sumCounts(map: Record<string, number>): number {
  let total = 0;
  for (const count of Object.values(map)) total += count;
  return total;
}

export function normalizeWeeklyLog(log: WeeklyLog): WeeklyLog {
  const weekKey = log.weekKey;
  return {
    weekKey,
    attendDates: uniqueDates(log.attendDates, weekKey),
    draws: Math.max(0, Math.floor(log.draws) || 0),
    petsByDate: countMap(log.petsByDate, weekKey),
    dailyClearDates: uniqueDates(log.dailyClearDates, weekKey),
    roomSaved: log.roomSaved === true,
    jellyAdsByDate: countMap(log.jellyAdsByDate, weekKey),
    inviteDone: log.inviteDone === true,
  };
}

/** Larger numbers and the union of dates win. A smaller device cannot erase progress. */
export function mergeWeeklyLogs(left: WeeklyLog, right: WeeklyLog): WeeklyLog {
  const weekKey = left.weekKey || right.weekKey;
  const a = normalizeWeeklyLog({ ...left, weekKey });
  const b = normalizeWeeklyLog({ ...right, weekKey });
  return normalizeWeeklyLog({
    weekKey,
    attendDates: [...a.attendDates, ...b.attendDates],
    draws: Math.max(a.draws, b.draws),
    petsByDate: maxMaps(a.petsByDate, b.petsByDate),
    dailyClearDates: [...a.dailyClearDates, ...b.dailyClearDates],
    roomSaved: a.roomSaved || b.roomSaved,
    jellyAdsByDate: maxMaps(a.jellyAdsByDate, b.jellyAdsByDate),
    inviteDone: a.inviteDone || b.inviteDone,
  });
}

export type WeeklyProgress = {
  attend: number;
  draws: number;
  pets: number;
  daily: number;
  room: number;
  ads: number;
  stamps: number;
};

export function recountWeekly(log: WeeklyLog): WeeklyProgress {
  const clean = normalizeWeeklyLog(log);
  const attend = clean.attendDates.length;
  const draws = clean.draws;
  const pets = sumCounts(clean.petsByDate);
  const daily = clean.dailyClearDates.length;
  const room = clean.roomSaved ? 1 : 0;
  const ads = sumCounts(clean.jellyAdsByDate);
  let stamps = 0;
  if (attend >= 5) stamps += 2;
  if (draws >= 20) stamps += 2;
  if (pets >= 10) stamps += 1;
  if (daily >= 3) stamps += 2;
  if (room >= 1) stamps += 1;
  if (ads >= 20) stamps += 1;
  return { attend, draws, pets, daily, room, ads, stamps };
}

export function chestNeed(kind: WeeklyChestKind): number {
  if (kind === "3") return 3;
  if (kind === "6") return 6;
  if (kind === "9") return 9;
  return 0;
}

export function chestReady(log: WeeklyLog, kind: WeeklyChestKind): boolean {
  if (kind === "invite") return log.inviteDone === true;
  return recountWeekly(log).stamps >= chestNeed(kind);
}

export function pendingChestKinds(log: WeeklyLog, claimed: string[]): WeeklyChestKind[] {
  const have = new Set(claimed);
  const kinds: WeeklyChestKind[] = ["3", "6", "9", "invite"];
  return kinds.filter((kind) => !have.has(kind) && chestReady(log, kind));
}

export function weeklyMenuMeta(stamps: number, claimable: number): { meta: string; dot: boolean } {
  if (claimable > 0) return { meta: `${stamps}/${WEEKLY_STAMP_MAX} · 선물 도착`, dot: true };
  return { meta: `${stamps}/${WEEKLY_STAMP_MAX} · 월 0시에 리셋`, dot: false };
}

/**
 * Fraction labels stay `held/max` at or under the shop cap.
 * Above the cap the bonus is words, never `4/3`.
 */
export function ticketFractionLabel(held: number, maxHold = 3): string {
  const safeHeld = Math.max(0, Math.floor(held) || 0);
  const cap = Math.max(1, Math.floor(maxHold) || 3);
  if (safeHeld > cap) {
    const bonus = safeHeld - cap;
    return `${safeHeld}장 (보너스 ${bonus}장 포함)`;
  }
  return `${safeHeld}/${cap}`;
}

export function ticketMenuLabel(held: number): string {
  return `보유 ${Math.max(0, Math.floor(held) || 0)}장`;
}

const WEEKLY_TICKET_PREFIX = "weeklyChest:";

/** Remember every key. Only a new weekly-chest key may raise the hold from 3 to 4. */
export function applyChestTicketKeys(
  held: number,
  knownKeys: string[],
  incomingKeys: string[],
  maxHold = 3,
  weeklyMax = WEEKLY_TICKET_BONUS_MAX,
): { held: number; keys: string[] } {
  const seen = new Set(knownKeys.filter((key) => key.length > 0));
  let nextHeld = Math.max(0, Math.floor(held) || 0);
  let changed = false;
  for (const key of incomingKeys) {
    if (!key || seen.has(key)) continue;
    seen.add(key);
    changed = true;
    const cap = key.startsWith(WEEKLY_TICKET_PREFIX) ? weeklyMax : maxHold;
    if (nextHeld < cap) nextHeld += 1;
  }
  if (!changed) return { held: nextHeld, keys: knownKeys };
  return { held: nextHeld, keys: [...seen].slice(-50) };
}

export type AppliedChest = { weekKey: string; kind: string };

export type ChestGrantInput = {
  weekKey: string;
  kind: string;
  jelly: number;
  nyang: number;
  ticketKeys: string[];
  already?: boolean;
};

/**
 * The same week + kind pays jelly, nyang, and a ticket at most once.
 * A repeated `already` response may resend ticket keys; known keys do not add another.
 */
export function applyChestGrant(
  applied: AppliedChest[],
  grant: ChestGrantInput,
  tickets: { held: number; keys: string[] },
  maxHold = 3,
): { applied: AppliedChest[]; jelly: number; nyang: number; tickets: { held: number; keys: string[] } } {
  const ticketsNext = applyChestTicketKeys(tickets.held, tickets.keys, grant.ticketKeys, maxHold);
  const seen = applied.some((item) => item.weekKey === grant.weekKey && item.kind === grant.kind);
  if (seen || grant.already) {
    const marked = seen ? applied : [...applied, { weekKey: grant.weekKey, kind: grant.kind }];
    return { applied: marked, jelly: 0, nyang: 0, tickets: ticketsNext };
  }
  return {
    applied: [...applied, { weekKey: grant.weekKey, kind: grant.kind }],
    jelly: Math.max(0, Math.floor(grant.jelly) || 0),
    nyang: Math.max(0, Math.floor(grant.nyang) || 0),
    tickets: ticketsNext,
  };
}

export function weekRangeLabel(weekKey: string): string {
  if (!DATE_KEY.test(weekKey)) return "";
  const [year, month, day] = weekKey.split("-").map(Number);
  const sunday = new Date(Date.UTC(year, month - 1, day + 6));
  const endMonth = sunday.getUTCMonth() + 1;
  const endDay = sunday.getUTCDate();
  return `${month}/${day} – ${endMonth}/${endDay}`;
}

type LedgerRow = { createdAt?: number };

export function jellyAdsFromLedger(ledger: LedgerRow[] | null | undefined, weekKey: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of ledger ?? []) {
    if (!row || typeof row.createdAt !== "number" || !Number.isFinite(row.createdAt)) continue;
    const day = toKstDateKey(new Date(row.createdAt));
    if (!dateInWeek(day, weekKey)) continue;
    out[day] = (out[day] ?? 0) + 1;
  }
  return out;
}

export function drawsInWeek(drawsByDate: Record<string, number> | null | undefined, weekKey: string): number {
  return sumCounts(countMap(drawsByDate, weekKey));
}

export type WeeklySource = {
  weekKey: string;
  today: string;
  drawsByDate?: Record<string, number>;
  lastAttendDateKST?: string;
  petToday?: number;
  affectionDate?: string;
  dailyClearedToday?: boolean;
  ledger?: LedgerRow[];
  roomSaved?: boolean;
  inviteDone?: boolean;
};

/** Rebuild the log from saved evidence. The log wins over a lone +1 that disagrees with it. */
export function absorbWeeklySources(log: WeeklyLog | null, source: WeeklySource): WeeklyLog {
  const base = normalizeWeeklyLog(log && log.weekKey === source.weekKey ? log : emptyWeeklyLog(source.weekKey));
  const attend = [...base.attendDates];
  if (source.lastAttendDateKST && dateInWeek(source.lastAttendDateKST, source.weekKey)) {
    attend.push(source.lastAttendDateKST);
  }
  const pets = { ...base.petsByDate };
  if (
    source.affectionDate &&
    source.affectionDate === source.today &&
    dateInWeek(source.today, source.weekKey) &&
    (source.petToday ?? 0) > 0
  ) {
    pets[source.today] = Math.max(pets[source.today] ?? 0, Math.floor(source.petToday ?? 0));
  }
  const daily = [...base.dailyClearDates];
  if (source.dailyClearedToday && dateInWeek(source.today, source.weekKey)) daily.push(source.today);
  return normalizeWeeklyLog({
    weekKey: source.weekKey,
    attendDates: attend,
    draws: Math.max(base.draws, drawsInWeek(source.drawsByDate, source.weekKey)),
    petsByDate: pets,
    dailyClearDates: daily,
    roomSaved: base.roomSaved || source.roomSaved === true,
    jellyAdsByDate: maxMaps(base.jellyAdsByDate, jellyAdsFromLedger(source.ledger, source.weekKey)),
    inviteDone: base.inviteDone || source.inviteDone === true,
  });
}

export function rollWeeklyBag(bag: WeeklyBag | null, weekKey: string): WeeklyBag {
  if (!bag) return emptyWeeklyBag(weekKey);
  if (bag.current.weekKey === weekKey) return bag;
  const ended = bag.current.weekKey ? normalizeWeeklyLog(bag.current) : null;
  return {
    current: emptyWeeklyLog(weekKey),
    previous: ended,
    claimed: [],
    previousClaimed: ended ? uniqueKinds(bag.claimed) : uniqueKinds(bag.previousClaimed),
    rules: bag.rules,
    mailbox: bag.mailbox ?? null,
  };
}

function uniqueKinds(kinds: string[]): string[] {
  const out: string[] = [];
  for (const kind of kinds) {
    if (!CHEST_KINDS.has(kind) || out.includes(kind)) continue;
    out.push(kind);
  }
  return out;
}

export function parseWeeklyLog(value: unknown): WeeklyLog | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.weekKey !== "string" || !DATE_KEY.test(raw.weekKey)) return null;
  return normalizeWeeklyLog({
    weekKey: raw.weekKey,
    attendDates: Array.isArray(raw.attendDates) ? raw.attendDates.filter((item): item is string => typeof item === "string") : [],
    draws: typeof raw.draws === "number" ? raw.draws : 0,
    petsByDate: countMap(raw.petsByDate as Record<string, number> | undefined),
    dailyClearDates: Array.isArray(raw.dailyClearDates)
      ? raw.dailyClearDates.filter((item): item is string => typeof item === "string")
      : [],
    roomSaved: raw.roomSaved === true,
    jellyAdsByDate: countMap(raw.jellyAdsByDate as Record<string, number> | undefined),
    inviteDone: raw.inviteDone === true,
  });
}

export function parseWeeklyRules(value: unknown): WeeklyRules | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const num = (key: string, fallback: number) => {
    const item = raw[key];
    return typeof item === "number" && Number.isFinite(item) ? Math.max(0, Math.floor(item)) : fallback;
  };
  return {
    chest3Jelly: num("chest3Jelly", FALLBACK_WEEKLY_RULES.chest3Jelly),
    chest6Jelly: num("chest6Jelly", FALLBACK_WEEKLY_RULES.chest6Jelly),
    chest9Jelly: num("chest9Jelly", FALLBACK_WEEKLY_RULES.chest9Jelly),
    chest9Nyang: num("chest9Nyang", FALLBACK_WEEKLY_RULES.chest9Nyang),
    inviteJelly: num("inviteJelly", FALLBACK_WEEKLY_RULES.inviteJelly),
    ticketMaxHold: num("ticketMaxHold", FALLBACK_WEEKLY_RULES.ticketMaxHold),
  };
}

export function parseWeeklyBag(value: unknown): WeeklyBag | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const current = parseWeeklyLog(raw.current);
  if (!current) return null;
  const claimed = Array.isArray(raw.claimed) ? uniqueKinds(raw.claimed.filter((item): item is string => typeof item === "string")) : [];
  const previousClaimed = Array.isArray(raw.previousClaimed)
    ? uniqueKinds(raw.previousClaimed.filter((item): item is string => typeof item === "string"))
    : [];
  return {
    current,
    previous: parseWeeklyLog(raw.previous),
    claimed,
    previousClaimed,
    rules: parseWeeklyRules(raw.rules),
    mailbox: parseWeeklyMailbox(raw.mailbox),
  };
}

const MAILBOX_SLOTS = new Set<MailboxSlot>(["none", "pending", "claimed", "expired"]);

function parseMailboxSide(value: unknown): WeeklyMailboxMap {
  const out: WeeklyMailboxMap = {};
  if (!value || typeof value !== "object") return out;
  const raw = value as Record<string, unknown>;
  for (const key of ["3", "6", "9", "invite"] as const) {
    const slot = raw[key];
    if (typeof slot === "string" && MAILBOX_SLOTS.has(slot as MailboxSlot)) out[key] = slot as MailboxSlot;
  }
  return out;
}

export function parseWeeklyMailbox(value: unknown): WeeklyMailbox | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  return { current: parseMailboxSide(raw.current), previous: parseMailboxSide(raw.previous) };
}

export function mailboxClaimedKinds(map: WeeklyMailboxMap | undefined): string[] {
  if (!map) return [];
  return (["3", "6", "9", "invite"] as const).filter((key) => map[key] === "claimed");
}

/** Filled chests wait in the mailbox. Already received chests stay checked. */
export function chestMailboxLabel(
  ready: boolean,
  claimed: boolean,
  slot: MailboxSlot | undefined,
): { state: "locked" | "sent" | "claimed"; label: string } {
  if (claimed || slot === "claimed") return { state: "claimed", label: "받음" };
  if (slot === "pending" || slot === "expired" || ready) return { state: "sent", label: "편지함으로 보냈어요" };
  return { state: "locked", label: "잠김" };
}

export function serverWeekToLog(value: unknown): { log: WeeklyLog; claimed: string[] } | null {
  const log = parseWeeklyLog(value);
  if (!log || !value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const claimed = Array.isArray(raw.claimed)
    ? raw.claimed.filter((item): item is string => typeof item === "string")
    : [];
  if (raw.inviteClaimed === true) claimed.push("invite");
  return { log, claimed: uniqueKinds(claimed) };
}

export function unionKinds(left: string[], right: string[]): string[] {
  return uniqueKinds([...left, ...right]);
}

export type WeeklyMissionRow = {
  id: string;
  title: string;
  current: number;
  target: number;
  stamps: number;
  done: boolean;
  icon: string;
};

export function weeklyMissionRows(log: WeeklyLog): WeeklyMissionRow[] {
  const progress = recountWeekly(log);
  const rows: Array<Omit<WeeklyMissionRow, "done"> & { current: number }> = [
    { id: "attend", title: "출석하기", current: progress.attend, target: 5, stamps: 2, icon: "icon-attendance.svg" },
    { id: "draw", title: "카드 뽑기", current: progress.draws, target: 20, stamps: 2, icon: "icon-stamp.svg" },
    { id: "pet", title: "고양이 쓰다듬기", current: progress.pets, target: 10, stamps: 1, icon: "icon-paw-mini.svg" },
    { id: "daily", title: "오늘의 미션 다 깨기", current: progress.daily, target: 3, stamps: 2, icon: "icon-stamp.svg" },
    { id: "room", title: "방 꾸미기 저장", current: progress.room, target: 1, stamps: 1, icon: "icon-room-mini.svg" },
    { id: "ad", title: "젤리 광고 보기", current: progress.ads, target: 20, stamps: 1, icon: "icon-ad.svg" },
  ];
  return rows.map((row) => ({
    ...row,
    current: Math.min(row.target, row.current),
    done: row.current >= row.target,
  }));
}

export type WeeklyChestView = {
  kind: WeeklyChestKind;
  need: number;
  lines: string[];
  state: "claimed" | "ready" | "locked";
};

export function weeklyChestViews(log: WeeklyLog, claimed: string[], rules: WeeklyRules | null): WeeklyChestView[] {
  const book = rules ?? FALLBACK_WEEKLY_RULES;
  const have = new Set(claimed);
  const stamps = recountWeekly(log).stamps;
  const specs: Array<{ kind: WeeklyChestKind; need: number; lines: string[] }> = [
    { kind: "3", need: 3, lines: [`젤리 ${book.chest3Jelly}`] },
    { kind: "6", need: 6, lines: [`젤리 ${book.chest6Jelly}`, "뽑기권"] },
    { kind: "9", need: 9, lines: [`젤리 ${book.chest9Jelly}`, `냥코인 ${book.chest9Nyang}`] },
  ];
  return specs.map((spec) => ({
    ...spec,
    state: have.has(spec.kind) ? "claimed" : stamps >= spec.need ? "ready" : "locked",
  }));
}

export function weeklyProgressPayload(log: WeeklyLog): {
  attendDates: string[];
  draws: number;
  petsByDate: Record<string, number>;
  dailyClearDates: string[];
  roomSaved: boolean;
  jellyAdsByDate: Record<string, number>;
  inviteDone: boolean;
} {
  const clean = normalizeWeeklyLog(log);
  return {
    attendDates: clean.attendDates,
    draws: clean.draws,
    petsByDate: clean.petsByDate,
    dailyClearDates: clean.dailyClearDates,
    roomSaved: clean.roomSaved,
    jellyAdsByDate: clean.jellyAdsByDate,
    inviteDone: clean.inviteDone,
  };
}
