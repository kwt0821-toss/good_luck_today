import { getAttendanceStatus } from "./attendanceServer";
import type { AttendanceStatusResponse } from "./attendanceTypes";
import { loadDexCatalog } from "./dexCatalog";
import { loadDexOwned } from "./dexCollection";
import { isWeekendDoublePaw, loadOpsConfig, computeOwnedCozy, cozyLevelFromPoints } from "./opsConfig";
import { remainingPawAds } from "./opsState";
import type { OpsConfig, OpsState } from "./opsTypes";
import { loadMenuConfig, menuAsset } from "./menuConfig";
import type { MenuBadge, MenuConfig, MenuRowView } from "./menuTypes";

export type MenuViewModel = {
  menu: MenuConfig;
  config: OpsConfig;
  pawBalance: number;
  nyangCoinBalance: number;
  dexOwned: number;
  dexTotal: number;
  cozyLevel: number;
  cozyPoints: number;
  sections: Array<{ id: string; label: string; rows: MenuRowView[] }>;
  menuIconDot: boolean;
  attendance: AttendanceStatusResponse;
  pawAds: { remaining: number; max: number; weekendDouble: boolean };
  exchange: { duplicateCount: number; totalPaw: number };
  rewards: { unclaimedCount: number; items: OpsState["rewardInbox"] };
  ratesMetaPercent: number;
  latestNotice: { id: string; title: string } | null;
};

function ratesHighlightSum(menu: MenuConfig, config: OpsConfig): number {
  const table = config.economy.draws.rates_proposal.normal;
  return menu.sheets.rates.highlight.reduce((sum, key) => sum + (table[key] ?? 0), 0);
}

export async function buildMenuViewModel(ops: OpsState): Promise<MenuViewModel> {
  const [menu, config, catalog, owned, attendancePack] = await Promise.all([
    loadMenuConfig(),
    loadOpsConfig(),
    loadDexCatalog(),
    loadDexOwned(),
    getAttendanceStatus(ops),
  ]);
  const attendance = attendancePack.status;
  const dexOwned = Object.values(owned).filter((r) => r.count > 0).length;
  const dexTotal = catalog.total || 107;
  const cozyPoints = computeOwnedCozy(config.prices, ops.ownedItemIds);
  const cozyLevel = cozyLevelFromPoints(config.economy, cozyPoints);

  let duplicateCount = 0;
  let exchangeTotal = 0;
  const convert = config.economy.pawSources.duplicateConvert;
  for (const card of catalog.cards) {
    const count = owned[card.id]?.count ?? 0;
    if (count <= 1) continue;
    const extras = count - 1;
    duplicateCount += extras;
    let unit = convert.rare_3to5star;
    if (card.type === "legend") unit = convert.legend;
    else if (card.type === "special") unit = convert.special;
    else if (card.type === "character") unit = convert.character;
    else if ((card.stars ?? 1) <= 2) unit = convert.common_1to2star;
    exchangeTotal += unit * extras;
  }

  const unclaimed = ops.rewardInbox.filter((item) => !item.collected);
  const pawRemaining = remainingPawAds(ops, config);
  const pawMax = config.economy.pawSources.rewardedAd.maxPerDay;
  const weekendDouble = isWeekendDoublePaw(config.economy);
  const highlightPct = Math.round(ratesHighlightSum(menu, config) * 1000) / 10;

  const friendEnabled = Boolean(config.economy.events.friendInvite?.enabled);
  const latestNotice = weekendDouble
    ? { id: "weekend-double-paw", title: "주말 포인트 2배" }
    : { id: "welcome", title: "럭키캣에 오신 걸 환영해요" };

  const rowViews: Record<string, MenuRowView> = {};
  for (const [id, def] of Object.entries(menu.rows)) {
    let enabled = def.enabled;
    if (id === "invite") enabled = friendEnabled;
    if (def.required) enabled = true;

    let meta = "";
    let badge: MenuBadge = { type: "none" };
    let rowDisabled = !enabled;

    if (id === "attendance") {
      meta = attendance.canClaimToday
        ? `${Math.max(1, attendance.attendanceDays + 1)}일째 · 선물 도착`
        : `누적 ${attendance.attendanceDays}일 · 내일 또 만나요`;
      if (attendance.canClaimToday) badge = { type: "dot" };
    } else if (id === "points") {
      meta =
        pawRemaining > 0
          ? `남은 횟수 ${pawRemaining}/${pawMax}`
          : (def.disabledMeta ?? "내일 다시 열려요");
      rowDisabled = pawRemaining <= 0;
      if (weekendDouble) badge = { type: "pill", text: "주말 2배", tone: "hot" };
    } else if (id === "exchange") {
      meta =
        duplicateCount > 0
          ? `중복 ${duplicateCount}장`
          : (def.disabledMeta ?? "아직 겹친 카드가 없어요");
      rowDisabled = duplicateCount <= 0;
    } else if (id === "rewards") {
      meta = `🪙${ops.nyangCoinBalance} 냥코인 · 받을 보상 ${unclaimed.length}`;
      if (unclaimed.length > 0) badge = { type: "dot" };
    } else if (id === "rates") {
      meta = `5성↑·스페셜 ${highlightPct}%`;
    } else if (id === "notice") {
      meta = latestNotice.title;
      if (latestNotice.id !== ops.lastSeenNoticeId) {
        badge = { type: "pill-new", text: "NEW" };
      } else if (weekendDouble) {
        badge = { type: "pill", text: latestNotice.title, tone: "hot" };
        meta = "";
      }
    } else if (id === "invite") {
      meta = "";
      if (!enabled) badge = { type: "pill", text: def.disabledPill ?? "준비 중", tone: "muted" };
    } else if (id === "settings") {
      meta = "";
    }

    rowViews[id] = {
      id,
      label: def.label,
      icon: menuAsset(def.icon),
      enabled: enabled && !rowDisabled,
      hidden: false,
      meta,
      badge: enabled ? badge : { type: "pill", text: def.disabledPill ?? "준비 중", tone: "muted" },
      open: def.open ?? "",
      chevron: enabled && !rowDisabled,
    };

    if (!enabled) {
      rowViews[id].enabled = false;
      rowViews[id].chevron = false;
      rowViews[id].badge = { type: "pill", text: def.disabledPill ?? "준비 중", tone: "muted" };
    } else if (rowDisabled && (id === "points" || id === "exchange")) {
      rowViews[id].enabled = false;
      rowViews[id].chevron = id === "exchange" || id === "points";
    }
  }

  const sections = menu.sections.map((section) => ({
    id: section.id,
    label: section.label,
    rows: section.rows.map((id) => rowViews[id]).filter((row): row is MenuRowView => Boolean(row) && !row.hidden),
  }));

  const menuIconDot = sections.some((section) =>
    section.rows.some((row) => row.badge.type === "dot"),
  );

  return {
    menu,
    config,
    pawBalance: ops.pawBalance,
    nyangCoinBalance: ops.nyangCoinBalance,
    dexOwned,
    dexTotal,
    cozyLevel,
    cozyPoints,
    sections,
    menuIconDot,
    attendance,
    pawAds: { remaining: pawRemaining, max: pawMax, weekendDouble },
    exchange: { duplicateCount, totalPaw: exchangeTotal },
    rewards: { unclaimedCount: unclaimed.length, items: ops.rewardInbox },
    ratesMetaPercent: highlightPct,
    latestNotice,
  };
}

export function daysToMilestone(attendance: AttendanceStatusResponse): number | null {
  if (!attendance.nextMilestone) return null;
  return Math.max(0, attendance.nextMilestone.days - attendance.attendanceDays);
}

export function attendanceSheetState(attendance: AttendanceStatusResponse): "firstWeek" | "weeklyCycle" {
  return attendance.phase === "weeklyCycle" ? "weeklyCycle" : "firstWeek";
}
