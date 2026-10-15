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

/** Tolerate older economy.json keys (toss / tossPayout) during rollout. */
function normalizeEconomy(raw: OpsEconomy & Record<string, unknown>): OpsEconomy {
  const anyRaw = raw as Record<string, unknown>;
  const currency = { ...(raw.currency as Record<string, unknown>) };
  if (!currency.nyangCoin && currency.toss) {
    const toss = currency.toss as { nameKo?: string; unit?: string };
    currency.nyangCoin = { nameKo: "냥코인", unit: "NYANG", note: "1냥코인 = 토스포인트 1원", ...toss };
    delete currency.toss;
  }
  const pawSources = structuredClone(raw.pawSources) as OpsEconomy["pawSources"] & Record<string, unknown>;
  const first = pawSources.newCardFirstGet as OpsEconomy["pawSources"]["newCardFirstGet"] & {
    toss?: number;
  };
  if (first && first.nyangCoin == null && first.toss != null) {
    first.nyangCoin = first.toss;
    delete first.toss;
  }
  const setComplete = pawSources.setComplete as Record<string, Record<string, number | undefined>>;
  for (const pack of Object.values(setComplete ?? {})) {
    if (pack && pack.nyangCoin == null && pack.toss != null) {
      pack.nyangCoin = pack.toss;
      delete pack.toss;
    }
  }
  // Ensure currency.nyangCoin.unit for older call sites.
  if (currency.nyangCoin && typeof currency.nyangCoin === "object") {
    const nc = currency.nyangCoin as Record<string, unknown>;
    if (nc.unit == null) nc.unit = "NYANG";
  }

  let nyangCoin = raw.nyangCoin;
  if (!nyangCoin && anyRaw.tossPayout) {
    nyangCoin = {
      ...(anyRaw.tossPayout as OpsEconomy["nyangCoin"]),
      nameKo: "냥코인",
      toTossPointRate: 1,
      withdrawMin: 10,
      withdrawStep: 10,
    };
  }
  const baseNyang = nyangCoin ?? {
    maxPerUserKRW: 417,
    oncePerTossAccount: true,
    serverVerified: true,
    idempotencyKey: "tossUserKey + requestId",
    withdrawMin: 10,
    withdrawStep: 10,
    toTossPointRate: 1,
  };
  const grant = (baseNyang as { grant?: Record<string, unknown> }).grant;
  const withdrawRaw = (baseNyang.withdraw ?? {}) as {
    min?: number;
    unit?: number;
    dailyLimit?: number;
    resetTimeKST?: string;
    note?: string;
  };
  const withdraw = {
    min: Number(withdrawRaw.min ?? baseNyang.withdrawMin ?? 10),
    unit: Number(withdrawRaw.unit ?? baseNyang.withdrawStep ?? 10),
    dailyLimit: Number(withdrawRaw.dailyLimit ?? 50),
    resetTimeKST: String(withdrawRaw.resetTimeKST ?? "00:00"),
    note: typeof withdrawRaw.note === "string" ? withdrawRaw.note : undefined,
  };
  const maxPerUserKRW =
    baseNyang.maxPerUserKRW ??
    baseNyang.maxEarnPerUser ??
    417;
  return {
    ...raw,
    currency: currency as OpsEconomy["currency"],
    pawSources: pawSources as OpsEconomy["pawSources"],
    nyangCoin: {
      ...baseNyang,
      maxPerUserKRW,
      oncePerTossAccount:
        baseNyang.oncePerTossAccount ??
        (grant?.oncePerTossAccountPerReward != null
          ? Boolean(grant.oncePerTossAccountPerReward)
          : true),
      serverVerified:
        baseNyang.serverVerified ??
        (grant?.serverVerified != null ? Boolean(grant.serverVerified) : true),
      idempotencyKey:
        baseNyang.idempotencyKey ??
        (typeof grant?.idempotencyKey === "string"
          ? grant.idempotencyKey
          : "tossUserKey + rewardId"),
      toTossPointRate: baseNyang.toTossPointRate ?? 1,
      withdraw,
      withdrawMin: withdraw.min,
      withdrawStep: withdraw.unit,
    },
  };
}

export function loadOpsConfig(): Promise<OpsConfig> {
  if (!cache) {
    cache = Promise.all([
      fetchJson<OpsEconomy & Record<string, unknown>>("economy.json"),
      fetchJson<OpsPrices>("prices.json"),
      fetchJson<OpsStarter>("starter.json"),
      fetchJson<OpsTutorial>("tutorial.json"),
    ]).then(([economy, prices, starter, tutorial]) => ({
      economy: normalizeEconomy(economy),
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
