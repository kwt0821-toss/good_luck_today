import { toKstDateKey } from "./date";
import type { DexCard, DexCatalog } from "./dexTypes";
import type {
  AffectionCatRecord,
  AffectionConfig,
  AffectionSource,
  AffectionState,
  OpsEconomy,
  OpsState,
} from "./opsTypes";

export const AFFECTION_EVENT = "lucky-affection";
export const QUESTION_CAT = "/assets/affection/question-cat.webp";

const SOURCES: AffectionSource[] = ["pet", "attend", "sameDraw", "mission", "suika"];

function emptyToday(): Record<AffectionSource, number> {
  return { pet: 0, attend: 0, sameDraw: 0, mission: 0, suika: 0 };
}

function emptyCat(): AffectionCatRecord {
  return { xp: 0, claimedLevels: [] };
}

function cleanLevels(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((n): n is number => typeof n === "number" && Number.isFinite(n)))].sort(
    (a, b) => a - b,
  );
}

function cleanRecord(xp: unknown, levels: unknown): AffectionCatRecord {
  const nextXp = typeof xp === "number" && Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  return { xp: nextXp, claimedLevels: cleanLevels(levels) };
}

export function catHasProgress(record: AffectionCatRecord | null | undefined): boolean {
  return Boolean(record && (record.xp > 0 || record.claimedLevels.length > 0));
}

export function emptyAffection(today = toKstDateKey()): AffectionState {
  return {
    catId: null,
    dateKey: today,
    today: emptyToday(),
    greetedOn: "",
    cats: {},
    unassigned: null,
  };
}

export function affectionConfig(economy: OpsEconomy | null | undefined): AffectionConfig | null {
  const raw = economy?.affection;
  if (!raw || !Array.isArray(raw.levels) || raw.levels.length < 2) return null;
  const sources = raw.sources;
  if (!sources?.pet || !sources.attend || !sources.sameDraw || !sources.mission || !sources.suika) return null;
  return raw;
}

export function catAffection(state: AffectionState, catId: string | null | undefined): AffectionCatRecord {
  if (!catId) return emptyCat();
  return state.cats[catId] ?? emptyCat();
}

export function favoriteAffection(state: AffectionState): AffectionCatRecord {
  return catAffection(state, state.catId);
}

export function readAffection(state: OpsState | null | undefined, today = toKstDateKey()): AffectionState {
  const raw = state?.affection ?? emptyAffection(today);
  if (raw.dateKey === today) return raw;
  return {
    ...raw,
    dateKey: today,
    today: emptyToday(),
  };
}

export function affectionLevel(xp: number, config: AffectionConfig): number {
  let level = 1;
  const cap = Math.max(1, Math.floor(config.maxLevel));
  for (let i = 0; i < config.levels.length && i < cap; i++) {
    if (xp >= config.levels[i]) level = i + 1;
  }
  return Math.min(cap, level);
}

/** 0–1 fill of the bar toward the next level. Full at the cap. */
export function affectionProgress(xp: number, config: AffectionConfig): number {
  const level = affectionLevel(xp, config);
  if (level >= config.maxLevel) return 1;
  const start = config.levels[level - 1] ?? 0;
  const next = config.levels[level] ?? start;
  if (next <= start) return 1;
  return Math.min(1, Math.max(0, (xp - start) / (next - start)));
}

export function todayAffectionXp(state: AffectionState, config: AffectionConfig): number {
  return SOURCES.reduce((sum, source) => sum + state.today[source] * config.sources[source].xp, 0);
}

function allClaimed(state: AffectionState): Set<number> {
  const claimed = new Set<number>();
  for (const record of Object.values(state.cats)) {
    for (const level of record.claimedLevels) claimed.add(level);
  }
  if (state.unassigned) {
    for (const level of state.unassigned.claimedLevels) claimed.add(level);
  }
  return claimed;
}

export function grantAffection(
  state: OpsState,
  economy: OpsEconomy,
  source: AffectionSource,
  today = toKstDateKey(),
): OpsState {
  const config = affectionConfig(economy);
  if (!config) return state;
  const current = readAffection(state, today);
  if (!current.catId) return state;
  const rule = config.sources[source];
  if (!rule || rule.xp <= 0 || rule.perDay <= 0) return state;
  if (current.today[source] >= rule.perDay) return state;
  const gained = todayAffectionXp(current, config);
  if (gained + rule.xp > config.dailyCap) return state;
  const record = catAffection(current, current.catId);
  const next: AffectionState = {
    ...current,
    today: { ...current.today, [source]: current.today[source] + 1 },
    cats: {
      ...current.cats,
      [current.catId]: { xp: record.xp + rule.xp, claimedLevels: record.claimedLevels },
    },
  };
  return { ...state, affection: next };
}

export function chooseFavorite(state: OpsState, catId: string, today = toKstDateKey()): OpsState {
  const current = readAffection(state, today);
  let cats = current.cats;
  let unassigned = current.unassigned;
  if (unassigned) {
    if (!catHasProgress(cats[catId])) cats = { ...cats, [catId]: unassigned };
    unassigned = null;
  }
  if (current.catId === catId && cats === current.cats && unassigned === current.unassigned) return state;
  return { ...state, affection: { ...current, catId, cats, unassigned } };
}

export function markGreeted(state: OpsState, today = toKstDateKey()): OpsState {
  const current = readAffection(state, today);
  if (current.greetedOn === today) return state;
  return { ...state, affection: { ...current, greetedOn: today } };
}

export function pendingGiftLevel(state: OpsState, economy: OpsEconomy): number | null {
  const config = affectionConfig(economy);
  const affection = state.affection;
  if (!config || !affection?.catId) return null;
  const current = readAffection(state);
  const level = affectionLevel(favoriteAffection(current).xp, config);
  const claimed = allClaimed(current);
  const ownsBed = state.ownedItemIds.includes(config.furnitureId);
  if (level >= config.furnitureLevel && !claimed.has(config.furnitureLevel) && !ownsBed) {
    return config.furnitureLevel;
  }
  if (level >= config.frameLevel && !claimed.has(config.frameLevel)) return config.frameLevel;
  return null;
}

export function claimAffectionLevel(state: OpsState, economy: OpsEconomy, level: number): OpsState {
  const config = affectionConfig(economy);
  if (!config || !state.affection.catId) return state;
  const current = readAffection(state);
  const catId = current.catId;
  if (!catId) return state;
  const record = catAffection(current, catId);
  if (affectionLevel(record.xp, config) < level) return state;
  const claimed = allClaimed(current);
  const ownsBed = state.ownedItemIds.includes(config.furnitureId);
  if (level === config.furnitureLevel && (claimed.has(level) || ownsBed)) return state;
  if (level === config.frameLevel && claimed.has(level)) return state;
  if (record.claimedLevels.includes(level)) return state;
  const claimedLevels = [...record.claimedLevels, level].sort((a, b) => a - b);
  let next: OpsState = {
    ...state,
    affection: {
      ...current,
      cats: { ...current.cats, [catId]: { xp: record.xp, claimedLevels } },
    },
  };
  if (level === config.furnitureLevel && config.furnitureId && !ownsBed) {
    next = { ...next, ownedItemIds: [...next.ownedItemIds, config.furnitureId] };
  }
  return next;
}

export function rateBias(
  state: OpsState | null | undefined,
  economy: OpsEconomy | null | undefined,
): { breedId: string; weightMul: number } | null {
  const config = affectionConfig(economy);
  const affection = state?.affection;
  if (!config || !affection?.catId) return null;
  const xp = favoriteAffection(affection).xp;
  if (affectionLevel(xp, config) < config.rateBonus.fromLevel) return null;
  const weightMul = config.rateBonus.weightMul;
  if (!(weightMul > 1)) return null;
  return { breedId: affection.catId, weightMul };
}

export function frameUnlocked(state: OpsState | null | undefined, economy: OpsEconomy | null | undefined): boolean {
  const config = affectionConfig(economy);
  if (!config || !state?.affection) return false;
  return allClaimed(state.affection).has(config.frameLevel);
}

function mergeRecords(
  left: AffectionCatRecord | null | undefined,
  right: AffectionCatRecord | null | undefined,
): AffectionCatRecord | null {
  if (!left && !right) return null;
  if (!left) return right ?? null;
  if (!right) return left;
  return {
    xp: Math.max(left.xp, right.xp),
    claimedLevels: [...new Set([...left.claimedLevels, ...right.claimedLevels])].sort((a, b) => a - b),
  };
}

/** Combine two saved affection blobs. `preferred` wins the current favorite. */
export function mergeAffectionStates(
  preferred: AffectionState,
  other: AffectionState,
  today = toKstDateKey(),
): AffectionState {
  const cats: Record<string, AffectionCatRecord> = {};
  for (const id of new Set([...Object.keys(preferred.cats), ...Object.keys(other.cats)])) {
    const merged = mergeRecords(preferred.cats[id], other.cats[id]);
    if (merged) cats[id] = merged;
  }
  let unassigned = mergeRecords(preferred.unassigned, other.unassigned);
  const catId = preferred.catId ?? other.catId;
  if (unassigned && catId && !catHasProgress(cats[catId])) {
    cats[catId] = unassigned;
    unassigned = null;
  } else if (Object.values(cats).some((record) => catHasProgress(record))) {
    unassigned = null;
  }
  const preferredToday = preferred.dateKey === today;
  const otherToday = other.dateKey === today;
  let dateKey = preferred.dateKey || other.dateKey || today;
  let counts = preferred.today;
  if (preferredToday && otherToday) {
    counts = {
      pet: Math.max(preferred.today.pet, other.today.pet),
      attend: Math.max(preferred.today.attend, other.today.attend),
      sameDraw: Math.max(preferred.today.sameDraw, other.today.sameDraw),
      mission: Math.max(preferred.today.mission, other.today.mission),
      suika: Math.max(preferred.today.suika, other.today.suika),
    };
    dateKey = today;
  } else if (otherToday) {
    counts = other.today;
    dateKey = today;
  } else if (preferredToday) {
    dateKey = today;
  }
  const greetedOn =
    preferred.greetedOn === today || other.greetedOn === today
      ? today
      : preferred.greetedOn || other.greetedOn;
  return { catId, dateKey, today: counts, greetedOn, cats, unassigned };
}

/** Same-grade weights. Grade rate stays put; only the favorite card's share moves. */
export function shiftedGradeRates(gradeRate: number, cards: number, weightMul: number) {
  const count = Math.max(1, cards);
  const total = count - 1 + weightMul;
  return {
    even: gradeRate / count,
    favorite: (weightMul / total) * gradeRate,
    other: (1 / total) * gradeRate,
  };
}

export function formatRatePercent(rate: number): string {
  return `${(rate * 100).toFixed(4)}%`;
}

export function breedCardsInGrade(catalog: DexCatalog, stars: number): number {
  return catalog.cards.filter((card) => card.type === "breed" && (card.stars ?? 0) === stars).length;
}

export function cardMatchesFavorite(card: DexCard, catId: string | null | undefined): boolean {
  return Boolean(catId && card.type === "breed" && card.breed?.id === catId);
}

export function publishAffection(state: OpsState) {
  window.dispatchEvent(new CustomEvent(AFFECTION_EVENT, { detail: state }));
}

function countOf(raw: Record<string, unknown>, key: AffectionSource): number {
  const n = raw[key];
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

export function parseAffection(value: unknown, today: string): AffectionState {
  const blank = emptyAffection(today);
  if (!value || typeof value !== "object") return blank;
  const raw = value as Record<string, unknown>;
  const todayRaw = raw.today && typeof raw.today === "object" ? (raw.today as Record<string, unknown>) : {};
  const catId = typeof raw.catId === "string" && raw.catId ? raw.catId : null;
  const cats: Record<string, AffectionCatRecord> = {};
  if (raw.cats && typeof raw.cats === "object") {
    for (const [id, entry] of Object.entries(raw.cats as Record<string, unknown>)) {
      if (!id || !entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      cats[id] = cleanRecord(record.xp, record.claimedLevels);
    }
  }
  const legacy = cleanRecord(raw.xp, raw.claimedLevels);
  const hasBucket = Object.keys(cats).length > 0;
  let unassigned: AffectionCatRecord | null = null;
  if (catHasProgress(legacy)) {
    if (catId && !catHasProgress(cats[catId])) cats[catId] = legacy;
    else if (!catId && !hasBucket) unassigned = legacy;
  }
  if (!unassigned && raw.unassigned && typeof raw.unassigned === "object") {
    const held = raw.unassigned as Record<string, unknown>;
    const record = cleanRecord(held.xp, held.claimedLevels);
    if (catHasProgress(record)) unassigned = record;
  }
  return {
    catId,
    dateKey: typeof raw.dateKey === "string" && raw.dateKey ? raw.dateKey : today,
    today: {
      pet: countOf(todayRaw, "pet"),
      attend: countOf(todayRaw, "attend"),
      sameDraw: countOf(todayRaw, "sameDraw"),
      mission: countOf(todayRaw, "mission"),
      suika: countOf(todayRaw, "suika"),
    },
    greetedOn: typeof raw.greetedOn === "string" ? raw.greetedOn : "",
    cats,
    unassigned,
  };
}
