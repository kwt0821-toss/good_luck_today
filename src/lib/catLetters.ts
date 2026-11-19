import { toKstDateKey } from "./date";
import { affectionConfig, affectionLevel, favoriteAffection } from "./affection";
import { seasonActive, seasonLastDateKey } from "./season";
import type { CatLetterEntry, CatLetterState, OpsEconomy, OpsState } from "./opsTypes";

const CONFIG_BASE = (import.meta.env?.VITE_OPS_CONFIG_BASE as string | undefined) ?? "/config";

export type CatLetterCopy = {
  id: string;
  title: string;
  body: string;
  pet?: boolean;
};

export type CatLetterFile = {
  nameFallback: string;
  letters: CatLetterCopy[];
};

const ABSENCE = ["absence_14", "absence_7", "absence_3"] as const;
const SPECIAL = ["season_end", "season_start", "christmas_day", "attend_100", "attend_30"] as const;

export function emptyCatLetters(): CatLetterState {
  return {
    inbox: [],
    readIds: [],
    absenceFrom: "",
    petted: false,
    sameDraw: false,
    seasonStarts: [],
    seasonEnds: [],
  };
}

export function readCatLetters(state: OpsState | null | undefined): CatLetterState {
  return state?.catLetters ?? emptyCatLetters();
}

export function contentId(id: string): string {
  if (id.startsWith("christmas_day:")) return "christmas_day";
  return id;
}

function hasId(inbox: CatLetterEntry[], id: string): boolean {
  return inbox.some((item) => item.id === id || contentId(item.id) === id);
}

function daysBetween(earlier: string, later: string): number {
  if (!earlier || !later || earlier === later) return 0;
  const start = Date.parse(`${earlier}T00:00:00+09:00`);
  const end = Date.parse(`${later}T00:00:00+09:00`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 86400000));
}

function push(inbox: CatLetterEntry[], id: string, today: string) {
  if (hasId(inbox, id)) return inbox;
  return [...inbox, { id, receivedOn: today }];
}

export function syncCatLetters(
  state: OpsState,
  economy: OpsEconomy | null | undefined,
  today = toKstDateKey(),
  now = new Date(),
): OpsState {
  const current = readCatLetters(state);
  let inbox = current.inbox;
  let absenceFrom = current.absenceFrom;
  let seasonStarts = current.seasonStarts;
  let seasonEnds = current.seasonEnds;
  const previousOpen = state.lastOpenDateKST || "";

  if (state.affection.catId) {
    const gap = daysBetween(previousOpen, today);
    const absence =
      gap >= 14 ? "absence_14" : gap >= 7 ? "absence_7" : gap >= 3 ? "absence_3" : "";
    if (absence && previousOpen && absenceFrom !== previousOpen) {
      inbox = push(inbox, absence, today);
      absenceFrom = previousOpen;
    }

    inbox = push(inbox, "first_pick", today);
    if (current.petted) inbox = push(inbox, "first_pet", today);
    if (current.sameDraw) inbox = push(inbox, "first_same_draw", today);

    const config = affectionConfig(economy);
    if (config) {
      const level = affectionLevel(favoriteAffection(state.affection).xp, config);
      for (let step = 2; step <= level; step += 1) inbox = push(inbox, `lv${step}`, today);
    }

    if ((state.attendanceDays ?? 0) >= 30) inbox = push(inbox, "attend_30", today);
    if ((state.attendanceDays ?? 0) >= 100) inbox = push(inbox, "attend_100", today);

    const month = Number(today.slice(5, 7));
    const day = Number(today.slice(8, 10));
    if (month === 12 && day === 25) inbox = push(inbox, `christmas_day:${today.slice(0, 4)}`, today);

    const active = seasonActive(economy, now);
    if (active && !seasonStarts.includes(active.id)) {
      inbox = push(inbox, "season_start", today);
      seasonStarts = [...seasonStarts, active.id];
    }
    if (active && seasonLastDateKey(active) === today && !seasonEnds.includes(active.id)) {
      inbox = push(inbox, "season_end", today);
      seasonEnds = [...seasonEnds, active.id];
    }
  }

  const nextLetters: CatLetterState = {
    ...current,
    inbox,
    absenceFrom,
    seasonStarts,
    seasonEnds,
  };
  if (
    state.lastOpenDateKST === today &&
    inbox === current.inbox &&
    absenceFrom === current.absenceFrom &&
    seasonStarts === current.seasonStarts &&
    seasonEnds === current.seasonEnds
  ) {
    return state;
  }
  return { ...state, lastOpenDateKST: today, catLetters: nextLetters };
}

export function noteCatLetterFlag(state: OpsState, flag: "petted" | "sameDraw"): OpsState {
  const current = readCatLetters(state);
  if (current[flag]) return state;
  return { ...state, catLetters: { ...current, [flag]: true } };
}

export function markCatLetterRead(state: OpsState, id: string): OpsState {
  const current = readCatLetters(state);
  if (current.readIds.includes(id)) return state;
  return { ...state, catLetters: { ...current, readIds: [...current.readIds, id] } };
}

export function hasUnreadCatLetter(state: OpsState | null | undefined): boolean {
  if (!state?.affection.catId) return false;
  const letters = readCatLetters(state);
  return letters.inbox.some((item) => !letters.readIds.includes(item.id));
}

function rank(id: string): number {
  const content = contentId(id);
  const absence = ABSENCE.indexOf(content as (typeof ABSENCE)[number]);
  if (absence >= 0) return 300 - absence;
  const special = SPECIAL.indexOf(content as (typeof SPECIAL)[number]);
  if (special >= 0) return 200 - special;
  return 0;
}

/** One letter for this visit. Absence, then a special day, then any other unread. */
export function popupCatLetter(state: OpsState, holdLevel: number | null): CatLetterEntry | null {
  if (!state.affection.catId) return null;
  const letters = readCatLetters(state);
  const unread = letters.inbox.filter((item) => !letters.readIds.includes(item.id));
  const open = unread.filter((item) => {
    if (holdLevel === 7 && item.id === "lv7") return false;
    if (holdLevel === 10 && item.id === "lv10") return false;
    return true;
  });
  if (!open.length) return null;
  const ranked = [...open].sort((a, b) => {
    const byRank = rank(b.id) - rank(a.id);
    if (byRank !== 0) return byRank;
    return a.receivedOn < b.receivedOn ? 1 : -1;
  });
  return ranked[0] ?? null;
}

export function fillCatLetter(copy: CatLetterCopy, name: string, seasonName: string): CatLetterCopy {
  const apply = (text: string) => text.split("{name}").join(name).split("{season}").join(seasonName);
  return { ...copy, title: apply(copy.title), body: apply(copy.body) };
}

let cached: Promise<CatLetterFile | null> | null = null;

export function loadCatLetters(): Promise<CatLetterFile | null> {
  if (!cached) {
    cached = fetch(`${CONFIG_BASE}/catLetters.json`, { cache: "no-cache" })
      .then(async (res) => {
        if (!res.ok) return null;
        const raw = (await res.json()) as CatLetterFile;
        if (!raw || !Array.isArray(raw.letters)) return null;
        return raw;
      })
      .catch(() => null);
  }
  return cached;
}

export function parseCatLetters(value: unknown): CatLetterState {
  const blank = emptyCatLetters();
  if (!value || typeof value !== "object") return blank;
  const raw = value as Record<string, unknown>;
  const inbox = Array.isArray(raw.inbox)
    ? raw.inbox
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .map((item) => ({
          id: typeof item.id === "string" ? item.id : "",
          receivedOn: typeof item.receivedOn === "string" ? item.receivedOn : "",
        }))
        .filter((item) => item.id)
    : [];
  const strings = (input: unknown) =>
    Array.isArray(input) ? input.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
  return {
    inbox,
    readIds: strings(raw.readIds),
    absenceFrom: typeof raw.absenceFrom === "string" ? raw.absenceFrom : "",
    petted: raw.petted === true,
    sameDraw: raw.sameDraw === true,
    seasonStarts: strings(raw.seasonStarts),
    seasonEnds: strings(raw.seasonEnds),
  };
}

export function mergeCatLetters(preferred: CatLetterState, other: CatLetterState): CatLetterState {
  const inbox = [...preferred.inbox];
  for (const item of other.inbox) {
    if (!inbox.some((row) => row.id === item.id)) inbox.push(item);
  }
  inbox.sort((a, b) => (a.receivedOn < b.receivedOn ? 1 : a.receivedOn > b.receivedOn ? -1 : 0));
  return {
    inbox,
    readIds: [...new Set([...preferred.readIds, ...other.readIds])],
    absenceFrom: preferred.absenceFrom || other.absenceFrom,
    petted: preferred.petted || other.petted,
    sameDraw: preferred.sameDraw || other.sameDraw,
    seasonStarts: [...new Set([...preferred.seasonStarts, ...other.seasonStarts])],
    seasonEnds: [...new Set([...preferred.seasonEnds, ...other.seasonEnds])],
  };
}
