import { loadOpsConfig, cozyLevelFromPoints } from "./opsConfig";
import type { OpsEconomy, OpsPrices, PriceItem, PriceTier } from "./opsTypes";
import { loadOpsState } from "./opsStorage";
import { isPaintItem, loadRoomCatalog, loadRoomGrid, loadRoomsFile } from "./roomCatalog";
import { maxOwnForItemSync } from "./roomPlacement";
import { loadRoomState } from "./roomStore";
import type { RoomItem } from "./roomTypes";

export type RoomCozyResponse = {
  cozyPoints: number;
  level: number;
  curMin: number;
  nextMin: number;
};

/** Sheet grid order from docs/archive/docs/cozy/cozy-spec.md (legend is a note, not a tile). */
export const COZY_SHEET_TIER_ORDER: PriceTier[] = [
  "small",
  "wall",
  "tile",
  "normal",
  "large",
];

export const COZY_SHEET_TIER_LABEL: Record<PriceTier, string> = {
  small: "소품",
  wall: "벽 꾸미기",
  tile: "벽지·바닥",
  normal: "가구",
  large: "큰 가구",
  legend: "레전드",
};

function beyondStep(economy: OpsEconomy): number {
  const match = economy.cozy.beyondLv10.match(/(\d+)/);
  return match ? Number(match[1]) : 80;
}

/** Current / next level thresholds for progress UI. */
export function cozyLevelBounds(
  economy: OpsEconomy,
  level: number,
): { curMin: number; nextMin: number } {
  const levels = economy.cozy.levels;
  const top = levels[levels.length - 1];
  const topLv = top?.lv ?? 10;
  const topMin = top?.minCozy ?? 400;
  const step = beyondStep(economy);

  if (level < topLv) {
    const cur = levels.find((row) => row.lv === level) ?? levels[0];
    const next = levels.find((row) => row.lv === level + 1);
    return {
      curMin: cur?.minCozy ?? 0,
      nextMin: next?.minCozy ?? topMin,
    };
  }

  // Lv.10+: curMin = topMin + (level - topLv) * step
  const curMin = topMin + Math.max(0, level - topLv) * step;
  return { curMin, nextMin: curMin + step };
}

function duplicatePointsForTier(economy: OpsEconomy, tier: PriceTier): number | null {
  const table = economy.cozy.duplicatePointsPerTier;
  if (table && tier in table) {
    const value = table[tier];
    if (value == null) return null;
    return Number(value);
  }
  if (tier === "tile") return null;
  const base = economy.cozy.pointsPerTier[tier] ?? 0;
  const rate = economy.cozy.duplicateRate ?? 0.5;
  return Math.ceil(base * rate);
}

function effectiveOwnCap(
  item: RoomItem | undefined,
  priced: PriceItem | undefined,
  tier: PriceTier,
): number {
  if (priced?.attendanceOnly || priced?.flags?.includes("attendanceOnly") || item?.attendanceOnly) {
    return 1;
  }
  if (tier === "tile" || isPaintItem(item)) return 1;
  return maxOwnForItemSync(
    item ??
      ({
        id: priced?.id ?? "",
        nameKo: priced?.nameKo ?? "",
        category: "소품",
        placement: "floor",
        footprint: [1, 1],
        price: priced?.price ?? 0,
        ownedDefault: false,
        placedDefault: false,
        image: null,
        tileImage: null,
      } as RoomItem),
    tier,
  );
}

/**
 * economy 2.2 cozy formula (placement-agnostic):
 * Σ [ pointsPerTier + max(0, min(count,maxOwn)-1) × ceil(pointsPerTier×duplicateRate) ]
 * Tiles / wallpaper-floor: no duplicates. Attendance-only: count 1.
 */
export function computeCozyPointsFromOwned(
  owned: Record<string, number>,
  prices: OpsPrices,
  economy: OpsEconomy,
  catalogById?: Map<string, RoomItem>,
): number {
  const byId = new Map(prices.items.map((item) => [item.id, item]));
  let total = 0;

  for (const [id, rawCount] of Object.entries(owned)) {
    const count = Math.max(0, Math.floor(Number(rawCount) || 0));
    if (count < 1) continue;
    const priced = byId.get(id);
    if (!priced?.tier) continue;
    const tier = priced.tier;
    const base = economy.cozy.pointsPerTier[tier] ?? priced.cozy ?? 0;
    if (base <= 0) continue;

    const dup = duplicatePointsForTier(economy, tier);
    const cap = effectiveOwnCap(catalogById?.get(id), priced, tier);
    const effective = Math.min(count, Number.isFinite(cap) ? cap : 1);

    if (dup == null || effective <= 1) {
      total += base;
      continue;
    }
    total += base + (effective - 1) * dup;
  }

  return total;
}

export function resolveCozyStatus(
  owned: Record<string, number>,
  prices: OpsPrices,
  economy: OpsEconomy,
  options?: {
    catalogById?: Map<string, RoomItem>;
    /** Hidden debug override from ops.devForceCozyLevel */
    forceLevel?: number | null;
  },
): RoomCozyResponse {
  const cozyPoints = computeCozyPointsFromOwned(
    owned,
    prices,
    economy,
    options?.catalogById,
  );
  const computedLevel = cozyLevelFromPoints(economy, cozyPoints);
  const level =
    typeof options?.forceLevel === "number" && options.forceLevel > 0
      ? options.forceLevel
      : computedLevel;
  const { curMin, nextMin } = cozyLevelBounds(economy, level);
  return { cozyPoints, level, curMin, nextMin };
}

/**
 * Mock GET /room/cozy → { cozyPoints, level, curMin, nextMin }.
 * Server-owned calculation; client calls this after buy/sell and on sheet open.
 */
export async function getRoomCozy(
  ownedOverride?: Record<string, number>,
): Promise<RoomCozyResponse> {
  const [config, ops] = await Promise.all([loadOpsConfig(), loadOpsState()]);
  let owned = ownedOverride;
  let catalogById: Map<string, RoomItem> | undefined;

  if (!owned) {
    const [catalog, grid, roomsFile] = await Promise.all([
      loadRoomCatalog(),
      loadRoomGrid(),
      loadRoomsFile(),
    ]);
    catalogById = new Map(catalog.items.map((item) => [item.id, item]));
    const room = await loadRoomState(catalog.items, roomsFile, grid);
    owned = { ...room.owned };
    for (const id of ops.ownedItemIds) {
      owned[id] = Math.max(1, owned[id] ?? 0);
    }
  }

  return resolveCozyStatus(owned, config.prices, config.economy, {
    catalogById,
    forceLevel: ops.devForceCozyLevel,
  });
}

/** Build owned-count map from unique id list (each counts as 1). */
export function ownedCountsFromIds(ids: string[]): Record<string, number> {
  const owned: Record<string, number> = {};
  for (const id of ids) owned[id] = Math.max(1, owned[id] ?? 0);
  return owned;
}
