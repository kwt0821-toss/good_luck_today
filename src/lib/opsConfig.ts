import type { OpsConfig, OpsEconomy, OpsPrices, OpsStarter, OpsTutorial } from "./opsTypes";

/**
 * Single ops-config loader. Today it reads static JSON from `/config/*`
 * (copied from repo `config/`). Later swap `CONFIG_BASE` / fetch target for
 * a server endpoint without touching call sites.
 */
const CONFIG_BASE = (import.meta.env.VITE_OPS_CONFIG_BASE as string | undefined) ?? "/config";

let cache: Promise<OpsConfig> | null = null;

async function fetchJson<T>(name: string): Promise<T> {
  const res = await fetch(`${CONFIG_BASE}/${name}`, { cache: "no-cache" });
  if (!res.ok) throw new Error(`ops config missing: ${name}`);
  return (await res.json()) as T;
}

export function loadOpsConfig(): Promise<OpsConfig> {
  if (!cache) {
    cache = Promise.all([
      fetchJson<OpsEconomy>("economy.json"),
      fetchJson<OpsPrices>("prices.json"),
      fetchJson<OpsStarter>("starter.json"),
      fetchJson<OpsTutorial>("tutorial.json"),
    ]).then(([economy, prices, starter, tutorial]) => ({
      economy,
      prices,
      starter,
      tutorial,
    }));
  }
  return cache;
}

/** Test helper — drop cached config after hot edits. */
export function clearOpsConfigCache() {
  cache = null;
}

export function priceById(prices: OpsPrices, id: string) {
  return prices.items.find((item) => item.id === id) ?? null;
}

export function cozyLevelFromPoints(economy: OpsEconomy, cozyPoints: number): number {
  const levels = economy.cozy.levels;
  let level = levels[0]?.lv ?? 1;
  for (const row of levels) {
    if (cozyPoints >= row.minCozy) level = row.lv;
  }
  if (cozyPoints >= (levels[levels.length - 1]?.minCozy ?? 0)) {
    const beyond = economy.cozy.beyondLv10.match(/(\d+)/);
    const step = beyond ? Number(beyond[1]) : 80;
    const top = levels[levels.length - 1];
    if (top && cozyPoints > top.minCozy) {
      level = top.lv + Math.floor((cozyPoints - top.minCozy) / step);
    }
  }
  return level;
}

export function computeOwnedCozy(prices: OpsPrices, ownedItemIds: string[]): number {
  const byId = new Map(prices.items.map((item) => [item.id, item]));
  let total = 0;
  const seen = new Set<string>();
  for (const id of ownedItemIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    total += byId.get(id)?.cozy ?? 0;
  }
  return total;
}

export function isWeekendDoublePaw(economy: OpsEconomy, date = new Date()): boolean {
  const event = economy.events.weekendDoublePaw;
  if (!event?.enabled) return false;
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  })
    .format(date)
    .toUpperCase();
  const map: Record<string, string> = {
    SAT: "SAT",
    SUN: "SUN",
    MON: "MON",
    TUE: "TUE",
    WED: "WED",
    THU: "THU",
    FRI: "FRI",
  };
  const key = map[weekday] ?? weekday;
  return event.days.includes(key);
}
