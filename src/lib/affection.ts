import { toKstDateKey } from "./date";
import type { DexCard, DexCatalog } from "./dexTypes";
import type { AffectionConfig, AffectionSource, AffectionState, OpsEconomy, OpsState } from "./opsTypes";

export const AFFECTION_EVENT = "lucky-affection";
export const QUESTION_CAT = "/assets/affection/question-cat.webp";

const SOURCES: AffectionSource[] = ["pet", "attend", "sameDraw", "mission"];

export function emptyAffection(today = toKstDateKey()): AffectionState {
  return {
    catId: null,
    xp: 0,
    claimedLevels: [],
    dateKey: today,
    today: { pet: 0, attend: 0, sameDraw: 0, mission: 0 },
    greetedOn: "",
  };
}

export function affectionConfig(economy: OpsEconomy | null | undefined): AffectionConfig | null {
  const raw = economy?.affection;
  if (!raw || !Array.isArray(raw.levels) || raw.levels.length < 2) return null;
  const sources = raw.sources;
  if (!sources?.pet || !sources.attend || !sources.sameDraw || !sources.mission) return null;
  return raw;
}

export function readAffection(state: OpsState | null | undefined, today = toKstDateKey()): AffectionState {
  const raw = state?.affection ?? emptyAffection(today);
  if (raw.dateKey === today) return raw;
  return {
    ...raw,
    dateKey: today,
    today: { pet: 0, attend: 0, sameDraw: 0, mission: 0 },
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
  const next: AffectionState = {
    ...current,
    xp: current.xp + rule.xp,
    today: { ...current.today, [source]: current.today[source] + 1 },
  };
  return { ...state, affection: next };
}

export function chooseFavorite(state: OpsState, catId: string, today = toKstDateKey()): OpsState {
  const current = readAffection(state, today);
  if (current.catId === catId) return state;
  return { ...state, affection: { ...current, catId } };
}

export function markGreeted(state: OpsState, today = toKstDateKey()): OpsState {
  const current = readAffection(state, today);
  if (current.greetedOn === today) return state;
  return { ...state, affection: { ...current, greetedOn: today } };
}

export function pendingGiftLevel(state: OpsState, economy: OpsEconomy): number | null {
  const config = affectionConfig(economy);
  if (!config || !state.affection?.catId) return null;
  const level = affectionLevel(state.affection.xp, config);
  const claimed = new Set(state.affection.claimedLevels);
  if (level >= config.furnitureLevel && !claimed.has(config.furnitureLevel)) return config.furnitureLevel;
  if (level >= config.frameLevel && !claimed.has(config.frameLevel)) return config.frameLevel;
  return null;
}

export function claimAffectionLevel(state: OpsState, economy: OpsEconomy, level: number): OpsState {
  const config = affectionConfig(economy);
  if (!config) return state;
  const current = readAffection(state);
  if (affectionLevel(current.xp, config) < level) return state;
  if (current.claimedLevels.includes(level)) return state;
  const claimedLevels = [...current.claimedLevels, level].sort((a, b) => a - b);
  let next: OpsState = { ...state, affection: { ...current, claimedLevels } };
  if (level === config.furnitureLevel && config.furnitureId) {
    if (!next.ownedItemIds.includes(config.furnitureId)) {
      next = { ...next, ownedItemIds: [...next.ownedItemIds, config.furnitureId] };
    }
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
  if (affectionLevel(affection.xp, config) < config.rateBonus.fromLevel) return null;
  const weightMul = config.rateBonus.weightMul;
  if (!(weightMul > 1)) return null;
  return { breedId: affection.catId, weightMul };
}

export function frameUnlocked(state: OpsState | null | undefined, economy: OpsEconomy | null | undefined): boolean {
  const config = affectionConfig(economy);
  if (!config || !state?.affection) return false;
  return state.affection.claimedLevels.includes(config.frameLevel);
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

export function parseAffection(value: unknown, today: string): AffectionState {
  const blank = emptyAffection(today);
  if (!value || typeof value !== "object") return blank;
  const raw = value as Record<string, unknown>;
  const todayRaw = raw.today && typeof raw.today === "object" ? (raw.today as Record<string, unknown>) : {};
  const count = (key: AffectionSource) => {
    const n = todayRaw[key];
    return typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  };
  const levels = Array.isArray(raw.claimedLevels)
    ? raw.claimedLevels.filter((n): n is number => typeof n === "number" && Number.isFinite(n))
    : [];
  return {
    catId: typeof raw.catId === "string" && raw.catId ? raw.catId : null,
    xp: typeof raw.xp === "number" && Number.isFinite(raw.xp) ? Math.max(0, Math.floor(raw.xp)) : 0,
    claimedLevels: [...new Set(levels)].sort((a, b) => a - b),
    dateKey: typeof raw.dateKey === "string" && raw.dateKey ? raw.dateKey : today,
    today: {
      pet: count("pet"),
      attend: count("attend"),
      sameDraw: count("sameDraw"),
      mission: count("mission"),
    },
    greetedOn: typeof raw.greetedOn === "string" ? raw.greetedOn : "",
  };
}
