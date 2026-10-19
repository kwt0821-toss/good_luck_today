import { getAttendanceStatus } from "./attendanceServer";
import type { AttendanceStatusResponse } from "./attendanceTypes";
import { loadDexCatalog } from "./dexCatalog";
import { loadDexOwned } from "./dexCollection";
import { listClaimableDexRewards } from "./dexRewards";
import { summarizeDupExchange, type DupExchangeGradeLine } from "./dupExchange";
import {
  getWithdrawRules,
  maxWithdrawableAmount,
  remainingTodayAmount,
  withdrawnTodayAmount,
} from "./mockWallet";
import { isWeekendDoublePaw, loadOpsConfig } from "./opsConfig";
import { getTicketShopStatus } from "./mockTicketShop";
import { remainingPawAds } from "./opsState";
import type { OpsConfig, OpsState } from "./opsTypes";
import { loadMenuConfig, menuAsset } from "./menuConfig";
import type { MenuBadge, MenuConfig, MenuRowView } from "./menuTypes";
import { getRoomCozy } from "./roomCozy";

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
  pawAds: {
    remaining: number;
    max: number;
    weekendDouble: boolean;
    /** Paw granted per completed point-ad. Weekend events multiply this. */
    pawGrant: number;
    /** Nyangcoin granted per completed point-ad. The weekend event does not multiply this. */
    nyangGrant: number;
  };
  exchange: {
    duplicateCount: number;
    totalPaw: number;
    lines: DupExchangeGradeLine[];
  };
  /** Dex manual-claim pending count (inbox auto-grant removed). */
  rewards: { unclaimedCount: number; dexClaimableCount: number; items: [] };
  wallet: {
    min: number;
    unit: number;
    dailyLimit: number;
    withdrawnToday: number;
    remainingToday: number;
    maxWithdrawable: number;
  };
  ticketShop: ReturnType<typeof getTicketShopStatus>;
  ratesMetaPercent: number;
  latestNotice: { id: string; title: string } | null;
};

function ratesHighlightSum(menu: MenuConfig, config: OpsConfig): number {
  const table = config.economy.draws.rates_proposal.normal;
  const keys = menu.sheets.rates.highlight ?? ["b5", "special", "character", "legend"];
  return keys.reduce((sum, key) => sum + (table[key] ?? 0), 0);
}

export async function buildMenuViewModel(ops: OpsState): Promise<MenuViewModel> {
  const [menu, config, catalog, owned, attendancePack, dexClaimable] = await Promise.all([
    loadMenuConfig(),
    loadOpsConfig(),
    loadDexCatalog(),
    loadDexOwned(),
    getAttendanceStatus(ops),
    listClaimableDexRewards(ops),
  ]);
  const attendance = attendancePack.status;
  const dexOwned = Object.values(owned).filter((r) => r.count > 0).length;
  const dexTotal = catalog.total || 107;
  const cozy = await getRoomCozy();
  const cozyPoints = cozy.cozyPoints;
  const cozyLevel = cozy.level;

  const exchangeSummary = summarizeDupExchange(catalog.cards, owned, config.economy);
  const duplicateCount = exchangeSummary.duplicateCount;
  const exchangeTotal = exchangeSummary.totalPaw;

  const dexClaimableCount = dexClaimable.length;
  const pawRemaining = remainingPawAds(ops, config);
  const pawMax = config.economy.pawSources.rewardedAd.maxPerDay;
  const weekendDouble = isWeekendDoublePaw(config.economy);
  const pawMultiplier = weekendDouble ? config.economy.events.weekendDoublePaw.multiplier : 1;
  const pawGrant = config.economy.pawSources.rewardedAd.pawPerAd * pawMultiplier;
  const nyangGrant = config.economy.ncoinSources?.adPaw ?? 0;
  const highlightPct = Math.round(ratesHighlightSum(menu, config) * 1000) / 10;
  const ticketShop = getTicketShopStatus(ops, config);

  const friendEnabled = Boolean(config.economy.events.friendInvite?.enabled);
  const latestNotice = weekendDouble
    ? { id: "weekend-double-paw", title: "주말 젤리 2배" }
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
        ? `${Math.max(1, attendance.attendanceDays + 1)}일째 · 선물`
        : `누적 ${attendance.attendanceDays}일`;
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
    } else if (id === "ticketShop") {
      const shop = getTicketShopStatus(ops, config);
      meta = `보유 ${shop.ticketsHeld}장`;
    } else if (id === "rewards") {
      meta =
        dexClaimableCount > 0
          ? `{ncoin}${ops.nyangCoinBalance} · 보상 ${dexClaimableCount}`
          : `{ncoin}${ops.nyangCoinBalance}`;
      if (dexClaimableCount > 0) badge = { type: "dot" };
    } else if (id === "rates") {
      meta = `5성↑ ${highlightPct}%`;
    } else if (id === "notice") {
      // Keep a single right-side chip so NEW + long title don't pile onto the label.
      if (latestNotice.id !== ops.lastSeenNoticeId) {
        badge = { type: "pill-new", text: "NEW" };
        meta = "";
      } else if (weekendDouble) {
        badge = { type: "pill", text: latestNotice.title, tone: "hot" };
        meta = "";
      } else {
        meta = latestNotice.title;
      }
    } else if (id === "invite") {
      meta = "";
      if (!enabled) badge = { type: "pill", text: def.disabledPill ?? "준비 중", tone: "muted" };
    } else if (id === "settings" || id === "helpEarn") {
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

  const withdrawRules = getWithdrawRules(config.economy);
  const withdrawnToday = withdrawnTodayAmount(ops);
  const remainingToday = remainingTodayAmount(ops, withdrawRules.dailyLimit);
  const maxWithdrawable = maxWithdrawableAmount(
    ops.nyangCoinBalance,
    remainingToday,
    withdrawRules,
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
    pawAds: { remaining: pawRemaining, max: pawMax, weekendDouble, pawGrant, nyangGrant },
    exchange: {
      duplicateCount,
      totalPaw: exchangeTotal,
      lines: exchangeSummary.lines,
    },
    rewards: { unclaimedCount: dexClaimableCount, dexClaimableCount, items: [] },
    wallet: {
      min: withdrawRules.min,
      unit: withdrawRules.unit,
      dailyLimit: withdrawRules.dailyLimit,
      withdrawnToday,
      remainingToday,
      maxWithdrawable,
    },
    ticketShop,
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
