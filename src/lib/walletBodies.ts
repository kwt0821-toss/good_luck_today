export type CozyStatus = {
  level: number;
  points: number;
  claimedLevel: number;
  fromLevel: number;
  perLevel: number;
  milestones: Record<string, string>;
  retroCap: number;
  items: string[];
  waitingItems: string[];
};

export type CozyClaimResult = {
  sent: boolean;
  fromLevel: number;
  toLevel: number;
  jelly: number;
  items: string[];
  capped: boolean;
  level: number;
  claimedLevel: number;
};

export type DealItem = {
  itemId: string;
  pct: number | null;
  price: number;
  salePrice: number;
  bought: boolean;
};

export type DealList = {
  date: string;
  items: DealItem[];
  refreshesLeft: number;
  resetAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export function parseCozyStatusBody(json: Record<string, unknown>): CozyStatus | null {
  if (!isRecord(json) || typeof json.level !== "number") return null;
  const milestones: Record<string, string> = {};
  if (isRecord(json.milestones)) {
    for (const [key, value] of Object.entries(json.milestones)) {
      if (typeof value === "string" && value) milestones[key] = value;
    }
  }
  return {
    level: json.level,
    points: num(json.points),
    claimedLevel: num(json.claimedLevel),
    fromLevel: num(json.fromLevel),
    perLevel: num(json.perLevel),
    milestones,
    retroCap: num(json.retroCap),
    items: stringList(json.items),
    waitingItems: stringList(json.waitingItems),
  };
}

export function parseDealListBody(json: Record<string, unknown>): DealList | null {
  if (typeof json.date !== "string" || !json.date || !Array.isArray(json.items)) return null;
  const items: DealItem[] = [];
  for (const row of json.items) {
    if (!isRecord(row) || typeof row.itemId !== "string" || !row.itemId) continue;
    if (typeof row.price !== "number" || typeof row.salePrice !== "number") continue;
    items.push({
      itemId: row.itemId,
      pct: typeof row.pct === "number" ? row.pct : null,
      price: row.price,
      salePrice: row.salePrice,
      bought: row.bought === true,
    });
  }
  return {
    date: json.date,
    items,
    refreshesLeft: num(json.refreshesLeft),
    resetAt: typeof json.resetAt === "string" ? json.resetAt : "",
  };
}

export function collectCozyItems(json: Record<string, unknown>): string[] {
  const ids = stringList(json.cozyItems);
  const letters = Array.isArray(json.letters) ? json.letters : json.letter ? [json.letter] : [];
  for (const letter of letters) {
    if (isRecord(letter)) ids.push(...stringList(letter.cozyItems));
  }
  return [...new Set(ids)];
}
