import type { DexCard, DexCatalog, DexOwnedMap } from "./dexTypes";
import type { DrawRarityKey, OpsEconomy, SeasonEventConfig } from "./opsTypes";

const RARITY_KEYS = ["b1", "b2", "b3", "b4", "b5", "special", "character", "legend"] as const;

export function seasonEvent(economy: OpsEconomy | null | undefined, id?: string | null): SeasonEventConfig | null {
  const events = economy?.seasonEvents?.events;
  if (!events) return null;
  const key = id ?? economy?.seasonEvents?.activeId;
  if (!key) return null;
  const event = events[key];
  if (!event || !event.cardIds?.length) return null;
  return event;
}

export function seasonActive(
  economy: OpsEconomy | null | undefined,
  now = new Date(),
): SeasonEventConfig | null {
  const event = seasonEvent(economy);
  if (!event) return null;
  const start = Date.parse(event.startsAtKST);
  const end = Date.parse(event.endsAtKST);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  const time = now.getTime();
  if (time < start || time >= end) return null;
  return event;
}

export function seasonRate(event: SeasonEventConfig, rateUp: boolean): number {
  const rate = rateUp ? event.rates.rateUp : event.rates.normal;
  return rate > 0 ? rate : 0;
}

/** Grade weights with the season slice removed from `takenFrom` only. */
export function adjustedGradeRates(
  economy: OpsEconomy,
  rateUp: boolean,
  now = new Date(),
): Record<DrawRarityKey, number> {
  const table = rateUp ? economy.draws.rates_proposal.rateUp : economy.draws.rates_proposal.normal;
  const next = { ...table } as Record<DrawRarityKey, number>;
  const event = seasonActive(economy, now);
  if (!event) return next;
  const from = event.rates.takenFrom;
  if (from in next) {
    const key = from as DrawRarityKey;
    next[key] = Math.max(0, (next[key] ?? 0) - seasonRate(event, rateUp));
  }
  return next;
}

export function seasonCards(catalog: DexCatalog, event: SeasonEventConfig): DexCard[] {
  const byId = new Map(catalog.cards.filter((card) => card.type === "season").map((card) => [card.id, card]));
  return event.cardIds.map((id) => byId.get(id)).filter((card): card is DexCard => Boolean(card));
}

export function pickSeasonCard(cards: DexCard[], random: () => number): DexCard | undefined {
  if (!cards.length) return undefined;
  const index = Math.min(cards.length - 1, Math.floor(random() * cards.length));
  return cards[Math.max(0, index)];
}

export function isGradeKey(key: string): key is DrawRarityKey {
  return (RARITY_KEYS as readonly string[]).includes(key);
}

export function unownedSeasonCard(
  event: SeasonEventConfig,
  catalog: DexCatalog,
  owned: DexOwnedMap,
): DexCard | null {
  for (const card of seasonCards(catalog, event)) {
    if ((owned[card.id]?.count ?? 0) <= 0) return card;
  }
  return null;
}

export function seasonCountdown(event: SeasonEventConfig, now = new Date()): string {
  const end = Date.parse(event.endsAtKST);
  const ms = Math.max(0, end - now.getTime());
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}일 ${hours}시간`;
  if (hours > 0) return `${hours}시간 ${minutes}분`;
  return `${Math.max(1, minutes)}분`;
}

export function formatSeasonPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

/** Last calendar day the season is still on (the day before endsAt). */
export function seasonLastDateKey(event: SeasonEventConfig): string {
  const end = Date.parse(event.endsAtKST);
  if (!Number.isFinite(end)) return "";
  const dayBefore = new Date(end - 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dayBefore);
}
