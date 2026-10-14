import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { AudioManager } from "../audio/AudioManager";
import { isDevBuild, progressResetUnlockedByDefault } from "../lib/devMode";
import { resetToNewUserState } from "../lib/devReset";
import { menuAsset } from "../lib/menuConfig";
import { NCOIN_ICON, ncoinIcon } from "../lib/ncoinIcon";
import {
  attendanceSheetState,
  buildMenuViewModel,
  daysToMilestone,
  type MenuViewModel,
} from "../lib/menuModel";
import {
  loadMenuSettings,
  saveMenuSettings,
  shouldReduceMenuMotion,
  type MenuSettings,
} from "../lib/menuSettings";
import {
  buildWithdrawRequestId,
  postWalletWithdraw,
} from "../lib/mockWallet";
import {
  buildTicketBuyRequestId,
  postShopTicketsBuy,
} from "../lib/mockTicketShop";
import { buildDupExchangeRequestId, postDupExchange } from "../lib/dupExchange";
import { claimAttendanceGift } from "../lib/opsRewards";
import type { OpsState, WalletHistoryItem } from "../lib/opsTypes";
import type { MenuSheetId } from "../lib/menuTypes";
import { haptic } from "../lib/native";
import "./MenuPanel.css";

type RewardsView = "inbox" | "confirm" | "success" | "history";
type ExchangeView = "summary" | "confirm";

const PROGRESS_RESET_UNLOCK_KEY = "lucky-cat.progress-reset-unlocked";

function readProgressResetUnlocked(): boolean {
  if (progressResetUnlockedByDefault()) return true;
  try {
    return window.sessionStorage.getItem(PROGRESS_RESET_UNLOCK_KEY) === "1";
  } catch {
    return false;
  }
}

function writeProgressResetUnlocked(): void {
  try {
    window.sessionStorage.setItem(PROGRESS_RESET_UNLOCK_KEY, "1");
  } catch {
    // ignore quota / private mode
  }
}

type MenuPanelProps = {
  open: boolean;
  ops: OpsState;
  onClose: () => void;
  onOpsChange: (next: OpsState) => void;
  onOpenDex: () => void;
  onOpenRoom: () => void;
  onPawAd: () => void;
  onReplayTutorial: () => void;
  onDevResetNewUser?: () => void;
  /** Start rate-up draw from ticket shop CTA. */
  onRateUpDraw?: () => void;
  /** Force-open a sheet (rewards-intro coach). */
  forceSheet?: MenuSheetId;
  /** Block panel/sheet swipe & dim dismiss while coach marks are active. */
  lockDismiss?: boolean;
  onSheetOpen?: (id: NonNullable<MenuSheetId>) => void;
};

function formatMeta(text: string) {
  // `{ncoin}` → shared PNG icon (see NCOIN_ICON).
  const withIcons = text.split(/(\{ncoin\})/g);
  return withIcons.map((chunk, chunkIndex) => {
    if (chunk === "{ncoin}") {
      return (
        <img
          key={`coin-${chunkIndex}`}
          className="menu-meta-ncoin"
          src={ncoinIcon(12)}
          alt=""
        />
      );
    }
    // Highlight trailing numbers / fractions for amber weight via <b>
    const parts = chunk.split(/(\d+(?:\/\d+)?%?|장)/g);
    return parts.map((part, index) =>
      /^\d/.test(part) || part === "장" ? (
        <b key={`${chunkIndex}-${index}`}>{part}</b>
      ) : (
        <span key={`${chunkIndex}-${index}`}>{part}</span>
      ),
    );
  });
}

export function MenuPanel({
  open,
  ops,
  onClose,
  onOpsChange,
  onOpenDex,
  onOpenRoom,
  onPawAd,
  onReplayTutorial,
  onDevResetNewUser,
  onRateUpDraw,
  forceSheet = null,
  lockDismiss = false,
  onSheetOpen,
}: MenuPanelProps) {
  const [model, setModel] = useState<MenuViewModel | null>(null);
  const [closing, setClosing] = useState(false);
  const [sheet, setSheet] = useState<MenuSheetId>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [ratesTab, setRatesTab] = useState<"normal" | "rateUp">("normal");
  const [settings, setSettings] = useState<MenuSettings>(() => loadMenuSettings());
  const [toast, setToast] = useState<string | null>(null);
  const [stampDay, setStampDay] = useState<number | null>(null);
  const [popDay, setPopDay] = useState<number | null>(null);
  const [creditsText, setCreditsText] = useState<string | null>(null);
  const [devResetting, setDevResetting] = useState(false);
  const [progressResetVisible, setProgressResetVisible] = useState(() => readProgressResetUnlocked());
  const [progressResetConfirm, setProgressResetConfirm] = useState(false);
  const versionTapRef = useRef({ count: 0, timer: 0, lastMs: 0 });
  const [rewardsView, setRewardsView] = useState<RewardsView>("inbox");
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [lastWithdraw, setLastWithdraw] = useState<WalletHistoryItem | null>(null);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [ticketBuyBusy, setTicketBuyBusy] = useState(false);
  const [exchangeView, setExchangeView] = useState<ExchangeView>("summary");
  const [exchangeBusy, setExchangeBusy] = useState(false);
  const reduce = shouldReduceMenuMotion(settings);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const sheetDrag = useRef<{ y: number; active: boolean }>({ y: 0, active: false });
  const toastTimer = useRef(0);
  const stepHoldTimer = useRef(0);
  const stepRepeatTimer = useRef(0);
  const withdrawAmountRef = useRef(withdrawAmount);
  withdrawAmountRef.current = withdrawAmount;

  useEffect(() => {
    if (!open) {
      // Drop any open sub-sheet (e.g. rewards left open after tutorial step 5).
      setSheet(null);
      setSheetOpen(false);
      setRewardsView("inbox");
      setExchangeView("summary");
      return;
    }
    setClosing(false);
    void buildMenuViewModel(ops).then(setModel);
    AudioManager.playSfx("sheet-open");
    AudioManager.setScreen("menu");
  }, [open, ops]);

  useEffect(() => {
    if (!open || !forceSheet) return;
    if (sheet === forceSheet && sheetOpen) return;
    openSheet(forceSheet);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, forceSheet]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !lockDismiss) requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sheet, lockDismiss]);

  const requestClose = () => {
    if (lockDismiss) return;
    if (sheet) {
      closeSheet();
      return;
    }
    setClosing(true);
    AudioManager.playSfx("sheet-close");
    window.setTimeout(() => {
      setClosing(false);
      onClose();
    }, reduce ? 150 : 220);
  };

  const openSheet = (id: MenuSheetId) => {
    if (!id) return;
    setSheet(id);
    if (id === "rewards") {
      setRewardsView("inbox");
      // Default to max; refined once model loads.
      void buildMenuViewModel(ops).then((next) => {
        setModel(next);
        setWithdrawAmount(next.wallet.maxWithdrawable);
      });
    }
    if (id === "exchange") {
      setExchangeView("summary");
      setExchangeBusy(false);
    }
    AudioManager.playSfx("sheet-open");
    requestAnimationFrame(() => setSheetOpen(true));
    onSheetOpen?.(id);
  };

  const clearStepHold = () => {
    window.clearTimeout(stepHoldTimer.current);
    window.clearInterval(stepRepeatTimer.current);
    stepHoldTimer.current = 0;
    stepRepeatTimer.current = 0;
  };

  useEffect(() => () => clearStepHold(), []);

  useEffect(() => {
    if (!model || sheet !== "rewards" || rewardsView !== "inbox") return;
    const max = model.wallet.maxWithdrawable;
    const min = model.wallet.min;
    setWithdrawAmount((prev) => {
      if (max <= 0) return 0;
      if (prev < min || prev > max) return max;
      if (prev % model.wallet.unit !== 0) return max;
      return prev;
    });
  }, [model, sheet, rewardsView]);

  const nudgeWithdraw = (delta: number) => {
    if (!model) return;
    const { min, unit, maxWithdrawable } = model.wallet;
    if (maxWithdrawable < min) return;
    const next = Math.min(
      maxWithdrawable,
      Math.max(min, withdrawAmountRef.current + delta * unit),
    );
    if (next === withdrawAmountRef.current) return;
    setWithdrawAmount(next);
    AudioManager.playSfx("tap");
    void haptic("tap");
  };

  const startStepHold = (delta: number) => {
    clearStepHold();
    nudgeWithdraw(delta);
    const longMs = model?.menu.sheets.rewards.wallet?.stepper?.longPressMs ?? 400;
    const repeatMs = model?.menu.sheets.rewards.wallet?.stepper?.repeatMs ?? 120;
    stepHoldTimer.current = window.setTimeout(() => {
      stepRepeatTimer.current = window.setInterval(() => nudgeWithdraw(delta), repeatMs);
    }, longMs);
  };

  const closeSheet = () => {
    if (lockDismiss) return;
    setSheetOpen(false);
    AudioManager.playSfx("sheet-close");
    window.setTimeout(() => {
      setSheet(null);
      setRewardsView("inbox");
      setExchangeView("summary");
      setExchangeBusy(false);
      setProgressResetConfirm(false);
    }, reduce ? 150 : 280);
  };

  const doWithdraw = async () => {
    if (!model || withdrawBusy || withdrawAmount < model.wallet.min) return;
    if (withdrawAmount > model.wallet.maxWithdrawable) return;
    setWithdrawBusy(true);
    try {
      const requestId = buildWithdrawRequestId();
      const result = await postWalletWithdraw(ops, { amount: withdrawAmount, requestId });
      onOpsChange(result.state);
      const row = result.state.walletHistory.find((item) => item.requestId === requestId) ?? null;
      setLastWithdraw(row);
      if (result.response.ok && result.response.status === "done") {
        setRewardsView("success");
        haptic("success");
      } else if (result.response.ok && result.response.status === "pending") {
        setLastWithdraw(row);
        setRewardsView("success");
        showToast("처리 중이에요. 잠시 후 기록에서 확인해 주세요");
      } else if (result.response.ok === false && result.response.code === "DAILY_LIMIT") {
        showToast(
          result.response.remainingToday != null
            ? `오늘은 ${result.response.remainingToday}원까지 받을 수 있어요`
            : result.response.reason,
        );
        setRewardsView("inbox");
      } else {
        showToast(result.response.ok === false ? result.response.reason : "지급에 실패했어요");
        setRewardsView("inbox");
      }
      void buildMenuViewModel(result.state).then((next) => {
        setModel(next);
        setWithdrawAmount(next.wallet.maxWithdrawable);
      });
    } finally {
      setWithdrawBusy(false);
    }
  };

  const showToast = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  };

  const unlockProgressReset = () => {
    if (devResetting || progressResetConfirm) return;
    const stamp = versionTapRef.current;
    const now = Date.now();
    // pointerdown-only counting; ignore rapid duplicates from the same gesture.
    if (now - stamp.lastMs < 90) return;
    stamp.lastMs = now;
    window.clearTimeout(stamp.timer);
    stamp.count += 1;
    if (stamp.count >= 7) {
      stamp.count = 0;
      writeProgressResetUnlocked();
      setProgressResetVisible(true);
      setProgressResetConfirm(true);
      showToast("진행도 초기화");
      void haptic("success");
      return;
    }
    if (stamp.count === 3 || stamp.count === 5) {
      showToast(`버전 ${stamp.count}/7`);
    }
    stamp.timer = window.setTimeout(() => {
      stamp.count = 0;
    }, 2800);
  };

  const runProgressReset = () => {
    if (devResetting) return;
    setDevResetting(true);
    void resetToNewUserState()
      .then((next) => {
        onOpsChange(next);
        onDevResetNewUser?.();
        // Hard reload — Toss WebViews sometimes keep the old SPA shell on assign("/").
        const url = `${window.location.pathname}?reset=${Date.now()}`;
        window.location.replace(url);
        window.setTimeout(() => {
          window.location.href = url;
        }, 200);
      })
      .catch((err) => {
        console.error("progress reset failed", err);
        setDevResetting(false);
        setProgressResetConfirm(false);
        showToast("초기화에 실패했어요");
      });
  };

  const onPanelPointerDown = (event: ReactPointerEvent) => {
    swipeStart.current = { x: event.clientX, y: event.clientY };
  };

  const onPanelPointerUp = (event: ReactPointerEvent) => {
    if (lockDismiss || !swipeStart.current || !model) return;
    const dx = event.clientX - swipeStart.current.x;
    const dy = Math.abs(event.clientY - swipeStart.current.y);
    swipeStart.current = null;
    if (dx > model.menu.panel.swipeToCloseThresholdPt && dy < 80) requestClose();
  };

  const onSheetPointerDown = (event: ReactPointerEvent) => {
    if (lockDismiss) return;
    sheetDrag.current = { y: event.clientY, active: true };
  };

  const onSheetPointerUp = (event: ReactPointerEvent) => {
    if (lockDismiss || !sheetDrag.current.active) return;
    const dy = event.clientY - sheetDrag.current.y;
    sheetDrag.current.active = false;
    if (dy > 120) closeSheet();
  };

  const onRow = (open: string, enabled: boolean, id: string) => {
    if (!enabled && id !== "points" && id !== "exchange") return;
    if (open === "action:rewardedAd(paw)") {
      if (!enabled) {
        showToast("내일 다시 열려요");
        return;
      }
      onPawAd();
      return;
    }
    if (open.startsWith("sheet:")) {
      openSheet(open.slice(6) as MenuSheetId);
      return;
    }
    if (open === "page:settings") openSheet("settings");
  };

  const claimAttendance = async () => {
    const result = await claimAttendanceGift(ops);
    if (result.error) {
      showToast(result.error);
      return;
    }
    const day =
      result.response?.phase === "firstWeek"
        ? result.state.attendanceDays
        : (result.response?.cycleDay ?? result.state.attendanceDays);
    setPopDay(day);
    setStampDay(day);
    onOpsChange(result.state);
    void haptic("success");
    window.setTimeout(() => AudioManager.playSfx("stamp"), 180);
    const itemReward = result.response?.rewards.find((reward) => reward.kind === "item");
    const pawReward = result.response?.rewards.find((reward) => reward.kind === "paw");
    const ticketReward = result.response?.rewards.find((reward) => reward.kind === "rateUpTicket");
    window.setTimeout(() => {
      setPopDay(null);
      if (pawReward || ticketReward) AudioManager.playSfx("reward-coin");
      if (itemReward) showToast("서랍에 쏙 넣었어요");
      else if (ticketReward) showToast("확률업 이용권을 받았어요");
      else if (pawReward) showToast(`포인트 +${pawReward.paw}`);
      else showToast("출석 완료!");
    }, 320);
  };

  const doExchange = async () => {
    if (exchangeBusy || !model || model.exchange.duplicateCount <= 0) return;
    setExchangeBusy(true);
    try {
      const result = await postDupExchange(ops, {
        mode: "all",
        requestId: buildDupExchangeRequestId("all"),
      });
      if (!result.response.ok) {
        showToast(result.response.reason);
        return;
      }
      onOpsChange(result.state);
      const toastTpl =
        model.menu.sheets.exchange.doneToast ?? "{p}P를 받았어요";
      showToast(toastTpl.replace("{p}", String(result.response.gained)));
      AudioManager.playSfx("reward-coin");
      void haptic("success");
      closeSheet();
    } finally {
      setExchangeBusy(false);
    }
  };

  const doBuyRateUpTicket = async () => {
    if (ticketBuyBusy) return;
    setTicketBuyBusy(true);
    try {
      const result = await postShopTicketsBuy(ops, {
        ticketType: "rateUp",
        requestId: buildTicketBuyRequestId(),
      });
      onOpsChange(result.state);
      if (!result.response.ok) {
        showToast(result.response.reason);
        return;
      }
      AudioManager.playSfx("reward-coin");
      void haptic("success");
      showToast(model?.menu.sheets.ticketShop.toastBought ?? "확률업 뽑기권을 샀어요");
    } finally {
      setTicketBuyBusy(false);
    }
  };

  const patchSettings = (patch: Partial<MenuSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveMenuSettings(next);
  };

  const ratesRows = useMemo(() => {
    if (!model) return [];
    const table =
      ratesTab === "rateUp"
        ? model.config.economy.draws.rates_proposal.rateUp
        : model.config.economy.draws.rates_proposal.normal;
    return model.menu.sheets.rates.rows.map(([key, label, count]) => {
      const rate = table[key] ?? 0;
      const perCard = rate / count;
      const decimals = model.menu.sheets.rates.perCardDecimals;
      const pct = rate * 100;
      return {
        key,
        label,
        count,
        rate,
        percent: Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`,
        perCard: `${(perCard * 100).toFixed(decimals)}%`,
        highlight: model.menu.sheets.rates.highlight.includes(key),
      };
    });
  }, [model, ratesTab]);

  const highlightSum = useMemo(() => {
    if (!model) return 0;
    const table =
      ratesTab === "rateUp"
        ? model.config.economy.draws.rates_proposal.rateUp
        : model.config.economy.draws.rates_proposal.normal;
    return model.menu.sheets.rates.highlight.reduce((sum, key) => sum + (table[key] ?? 0), 0);
  }, [model, ratesTab]);

  const rateUpHighlightSum = useMemo(() => {
    if (!model) return 0;
    const table = model.config.economy.draws.rates_proposal.rateUp;
    return model.menu.sheets.rates.highlight.reduce((sum, key) => sum + (table[key] ?? 0), 0);
  }, [model]);

  const formatGradePct = (rate: number) => {
    const pct = rate * 100;
    return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
  };

  if (!open && !closing) return null;

  const attState = model ? attendanceSheetState(model.attendance) : "firstWeek";
  const attCopy = model?.menu.sheets.attendance.states?.[attState];
  const attCta = model
    ? model.attendance.canClaimToday
      ? (attCopy?.cta ?? model.menu.sheets.attendance.cta ?? "오늘 출석하기").replace(
          "{todayRewardLabel}",
          model.attendance.todayRewardLabel,
        )
      : (attCopy?.ctaDone ?? model.menu.sheets.attendance.ctaDone ?? "오늘 출석했어요")
    : "";
  const milestoneDaysLeft = model ? daysToMilestone(model.attendance) : null;

  return (
    <div
      className={`menu-root ${open && !closing ? "is-open" : ""} ${closing ? "is-closing" : ""} ${reduce ? "is-reduce" : ""}`}
    >
      <button
        type="button"
        className="menu-dim"
        aria-label="메뉴 닫기"
        onClick={() => {
          if (!lockDismiss) requestClose();
        }}
      />
      <aside
        className="menu-panel"
        role="dialog"
        aria-modal="true"
        aria-label="메뉴"
        onPointerDown={onPanelPointerDown}
        onPointerUp={onPanelPointerUp}
      >
        {model ? (
          <>
            <div className="menu-panel-head">
              <h2 className="menu-title">
                MENU<span className="dot">.</span>
              </h2>
              <p className="menu-sub">{model.menu.header.subtitle}</p>
              <button type="button" className="menu-close" aria-label="닫기" onClick={requestClose}>
                <img src={menuAsset("icon-close.svg")} alt="" />
              </button>

              <div className="menu-stats">
                <div className="menu-stat">
                  <div className="menu-stat-value">
                    <img src={menuAsset("icon-paw-mini.svg")} alt="" />
                    {model.pawBalance.toLocaleString("ko-KR")}
                  </div>
                  <div className="menu-stat-label">내 포인트</div>
                </div>
                <button type="button" className="menu-stat is-tap" onClick={() => openSheet("rewards")}>
                  <div className="menu-stat-value">
                    <img src={ncoinIcon(14)} alt="" />
                    {model.nyangCoinBalance.toLocaleString("ko-KR")}
                  </div>
                  <div className="menu-stat-label">냥코인</div>
                </button>
                <button
                  type="button"
                  className="menu-stat is-tap"
                  onClick={() => {
                    requestClose();
                    onOpenDex();
                  }}
                >
                  <div className="menu-stat-value">
                    {model.dexOwned}
                    <small>/ {model.dexTotal}</small>
                  </div>
                  <div className="menu-stat-label">도감</div>
                  <div className="menu-stat-bar">
                    <i style={{ width: `${model.dexTotal ? (model.dexOwned / model.dexTotal) * 100 : 0}%` }} />
                  </div>
                </button>
                <button
                  type="button"
                  className="menu-stat is-tap"
                  onClick={() => {
                    requestClose();
                    onOpenRoom();
                  }}
                >
                  <div className="menu-stat-value">Lv.{model.cozyLevel}</div>
                  <div className="menu-stat-label">방 레벨</div>
                </button>
              </div>
            </div>

            <div className="menu-scroll">
              {model.sections.map((section) => (
                <section key={section.id}>
                  <p className="menu-section-label">{section.label}</p>
                  {section.rows.map((row, index) => (
                    <button
                      key={row.id}
                      id={`menu-row-${row.id}`}
                      type="button"
                      className={`menu-row ${row.enabled ? "" : "is-disabled"}`}
                      style={{ animationDelay: reduce ? "0ms" : `${index * 30}ms` }}
                      onClick={() => onRow(row.open, row.enabled, row.id)}
                    >
                      <span className="menu-row-icon">
                        <img src={row.icon} alt="" />
                        {row.badge.type === "dot" ? <span className="menu-dot" /> : null}
                      </span>
                      <span className="menu-row-label">
                        {row.label}
                        {row.id === "points" ? (
                          <span className="menu-ad-tag" aria-label="광고">
                            광고
                          </span>
                        ) : null}
                      </span>
                      <span className="menu-row-meta">
                        {row.badge.type === "pill" || row.badge.type === "pill-new" ? (
                          <span
                            className={`menu-pill ${row.badge.type === "pill-new" ? "is-new" : ""} ${row.badge.type === "pill" && row.badge.tone === "muted" ? "is-muted" : ""}`}
                          >
                            {row.badge.text}
                          </span>
                        ) : null}
                        {row.meta ? <span>{formatMeta(row.meta)}</span> : null}
                      </span>
                      {row.chevron ? (
                        <img className="menu-chevron" src={menuAsset("icon-chevron.svg")} alt="" />
                      ) : (
                        <span />
                      )}
                    </button>
                  ))}
                </section>
              ))}
            </div>

            <div className="menu-footer">
              <span>LUCKY CAT · v1.0.0</span>
              <button type="button" onClick={() => showToast("문의 링크는 곧 연결돼요")}>
                문의하기
              </button>
            </div>
          </>
        ) : null}

        {sheet && model ? (
          <div className={`menu-sheet-root ${sheetOpen ? "is-open" : ""}`}>
            <button
              type="button"
              className="menu-sheet-dim"
              aria-label="시트 닫기"
              onClick={() => {
                if (!lockDismiss) closeSheet();
              }}
            />
            <div
              className="menu-sheet"
              onPointerDown={onSheetPointerDown}
              onPointerUp={onSheetPointerUp}
              style={{
                minHeight:
                  sheet === "attendance"
                    ? attState === "weeklyCycle"
                      ? 520
                      : 560
                    : sheet === "rates"
                      ? 640
                      : sheet === "ticketShop"
                        ? 520
                        : sheet === "settings"
                          ? 520
                          : 420,
              }}
            >
              <div className="menu-grab" />
              <div className="menu-sheet-head">
                <p className="menu-sheet-eye">
                  {sheet === "attendance"
                    ? model.menu.sheets.attendance.eyebrow
                    : sheet === "rates"
                      ? model.menu.sheets.rates.eyebrow
                      : sheet === "exchange"
                        ? model.menu.sheets.exchange.eyebrow
                        : sheet === "ticketShop"
                          ? model.menu.sheets.ticketShop.eyebrow
                          : sheet === "rewards"
                            ? model.menu.sheets.rewards.eyebrow
                            : sheet === "settings"
                              ? "SETTINGS"
                              : "NOTICE"}
                </p>
                <h3 className="menu-sheet-title">
                  {sheet === "attendance"
                    ? model.menu.sheets.attendance.title
                    : sheet === "rates"
                      ? model.menu.sheets.rates.title
                      : sheet === "exchange"
                        ? model.menu.sheets.exchange.title
                        : sheet === "ticketShop"
                          ? model.menu.sheets.ticketShop.title
                          : sheet === "rewards"
                            ? model.menu.sheets.rewards.title
                            : sheet === "settings"
                              ? "설정"
                              : "공지·이벤트"}
                </h3>
                <p className="menu-sheet-desc">
                  {sheet === "attendance"
                    ? (attCopy?.desc ?? model.menu.sheets.attendance.desc ?? "").replace(
                        "{day7.nameKo}",
                        model.attendance.firstWeekGifts[6]?.nameKo ?? "캣타워",
                      )
                    : sheet === "rates"
                      ? model.menu.sheets.rates.desc
                      : sheet === "exchange"
                        ? model.menu.sheets.exchange.desc
                        : sheet === "ticketShop"
                          ? model.menu.sheets.ticketShop.desc
                          : sheet === "rewards"
                            ? model.menu.sheets.rewards.desc
                            : sheet === "settings"
                              ? "소리·진동·움직임과 계정 안내를 관리해요."
                              : "이벤트와 공지를 확인해요."}
                </p>
                <button
                  type="button"
                  className="menu-close menu-sheet-close"
                  aria-label="닫기"
                  onClick={closeSheet}
                >
                  <img src={menuAsset("icon-close.svg")} alt="" />
                </button>
              </div>

              <div className="menu-sheet-body">
                {sheet === "attendance" && attState === "firstWeek" ? (
                  <>
                    <div className="att-grid">
                      {model.attendance.firstWeekGifts.map((gift) => {
                        const canTapClaim = gift.isToday && model.attendance.canClaimToday;
                        return (
                          <button
                            key={gift.day}
                            type="button"
                            className={`att-cell ${gift.day === 7 ? "is-day7" : ""} ${gift.claimed ? "is-claimed" : ""} ${gift.isToday ? "is-today" : ""} ${!gift.claimed && !gift.isToday ? "is-locked" : ""} ${stampDay === gift.day ? "is-stamping" : ""} ${popDay === gift.day ? "is-pop" : ""}`}
                            disabled={!canTapClaim}
                            aria-label={
                              canTapClaim
                                ? `${gift.day}일차 출석하기`
                                : gift.claimed
                                  ? `${gift.day}일차 출석 완료`
                                  : `${gift.day}일차`
                            }
                            onClick={() => {
                              if (!canTapClaim) return;
                              void claimAttendance();
                            }}
                          >
                            <span className="att-day">DAY {gift.day}</span>
                            <img className="att-thumb" src={gift.thumb} alt="" />
                            <span className="att-name">{gift.nameKo}</span>
                            {gift.attendanceOnly ? (
                              <span className="att-only-tag">
                                {model.menu.attendanceOnlyTag?.label ?? "출석 한정"}
                              </span>
                            ) : null}
                            {gift.day === 7 ? <span className="att-day7-note">마지막 날 큰 선물</span> : null}
                            {gift.claimed || stampDay === gift.day ? (
                              <img className="att-stamp" src={menuAsset("icon-stamp.svg")} alt="" />
                            ) : null}
                            {gift.isToday ? (
                              <>
                                <span className="menu-dot" />
                                <span className="att-today-tag">오늘</span>
                              </>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                    <div className="att-progress">
                      <span>출석 진행</span>
                      <b>{Math.min(model.attendance.attendanceDays, 7)} / 7일</b>
                    </div>
                    <div className="att-bar">
                      <i
                        style={{
                          width: `${(Math.min(model.attendance.attendanceDays, 7) / 7) * 100}%`,
                        }}
                      />
                    </div>
                  </>
                ) : null}

                {sheet === "attendance" && attState === "weeklyCycle" ? (
                  <>
                    <div className="att-cycle-card">
                      <div>
                        <p className="att-cycle-label">
                          {attCopy && "summaryCard" in attCopy
                            ? attCopy.summaryCard?.title ?? "누적 출석"
                            : "누적 출석"}
                        </p>
                        <p className="att-cycle-value">{model.attendance.attendanceDays}일</p>
                      </div>
                      <div className="att-cycle-meta">
                        {model.attendance.nextMilestone && milestoneDaysLeft != null ? (
                          <p>
                            {(attCopy && "summaryCard" in attCopy
                              ? attCopy.summaryCard?.milestone
                              : "{milestoneLabel}까지 {daysToMilestone}일")
                              ?.replace(
                                "{milestoneLabel}",
                                model.attendance.nextMilestone.labelKo ??
                                  `${model.attendance.nextMilestone.days}일`,
                              )
                              .replace("{daysToMilestone}", String(milestoneDaysLeft))}
                          </p>
                        ) : (
                          <p>다음 기념일을 기다려 주세요</p>
                        )}
                        {model.attendance.nextMilestone?.badgeId || model.attendance.badges[0] ? (
                          <span className="att-badge-pill">
                            {model.attendance.nextMilestone?.labelKo ?? "출석 배지"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p className="att-week-label">
                      {model.attendance.cycleNo != null
                        ? `${model.attendance.cycleNo}번째 주`
                        : "이번 주"}
                    </p>
                    <div className="att-week-grid">
                      {model.attendance.weekCells.map((cell) => {
                        const canTapClaim = cell.isToday && model.attendance.canClaimToday;
                        return (
                          <button
                            key={cell.day}
                            type="button"
                            className={`att-week-cell ${cell.claimed ? "is-claimed" : ""} ${cell.isToday ? "is-today" : ""} ${stampDay === cell.day ? "is-stamping" : ""} ${popDay === cell.day ? "is-pop" : ""}`}
                            disabled={!canTapClaim}
                            aria-label={
                              canTapClaim
                                ? `${cell.label} 출석하기`
                                : cell.claimed
                                  ? `${cell.label} 출석 완료`
                                  : cell.label
                            }
                            onClick={() => {
                              if (!canTapClaim) return;
                              void claimAttendance();
                            }}
                          >
                            <span className="att-day">{cell.label}</span>
                            <strong>{cell.rewardLabel}</strong>
                            {cell.claimed || stampDay === cell.day ? (
                              <img className="att-stamp" src={menuAsset("icon-stamp.svg")} alt="" />
                            ) : null}
                            {cell.isToday ? <span className="att-today-tag">오늘</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : null}

                {sheet === "rates" ? (
                  <>
                    <div className="rates-tabs">
                      {model.menu.sheets.rates.tabs.map((label, index) => (
                        <button
                          key={label}
                          type="button"
                          className={ratesTab === (index === 0 ? "normal" : "rateUp") ? "is-on" : ""}
                          onClick={() => setRatesTab(index === 0 ? "normal" : "rateUp")}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <table className="rates-table">
                      <thead>
                        <tr>
                          <th style={{ width: 74 }}>등급</th>
                          <th> </th>
                          <th style={{ width: 60, textAlign: "right" }}>등급 확률</th>
                          <th style={{ width: 64, textAlign: "right" }}>카드 1장</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ratesRows.map((row) => (
                          <tr key={row.key} className={row.highlight ? "is-hi" : ""}>
                            <td>
                              {row.label}
                              <small className="rates-count"> ({row.count}장)</small>
                            </td>
                            <td>
                              <div className="rates-bar">
                                <i style={{ width: `${Math.min(100, row.rate * 100 * 2)}%` }} />
                              </div>
                            </td>
                            <td className="rates-pct">{row.percent}</td>
                            <td className="rates-one">{row.perCard}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="rates-sum">
                      <span>5성 + 스페셜 + 캐릭터 + 레전드</span>
                      <b>{formatGradePct(highlightSum)}</b>
                    </div>
                    <p className="rates-note">
                      {ratesTab === "normal" ? (
                        <>
                          확률업 뽑기에선 이 합계가 {formatGradePct(rateUpHighlightSum)}로 올라가요
                          <br />
                        </>
                      ) : null}
                      {model.menu.sheets.rates.note}
                    </p>
                  </>
                ) : null}

                {sheet === "exchange" && exchangeView === "summary" ? (
                  <>
                    <div className="menu-list-row">
                      <span>중복 카드</span>
                      <b>{model.exchange.duplicateCount}장</b>
                    </div>
                    <div className="menu-list-row">
                      <span>받을 포인트</span>
                      <b>{model.exchange.totalPaw.toLocaleString("ko-KR")}P</b>
                    </div>
                  </>
                ) : null}

                {sheet === "exchange" && exchangeView === "confirm" ? (
                  <div className="exchange-confirm">
                    <h4>
                      {(model.menu.sheets.exchange.confirmTitle ??
                        "중복 카드 {n}장을 발바닥 포인트 {p}P로 바꿀까요?")
                        .replace("{n}", String(model.exchange.duplicateCount))
                        .replace("{p}", String(model.exchange.totalPaw))}
                    </h4>
                    <p className="exchange-confirm-sub">
                      {model.menu.sheets.exchange.confirmSub ??
                        "카드마다 1장은 도감에 남아요 · 바꾼 카드는 되돌릴 수 없어요"}
                    </p>
                    <ul className="exchange-grade-list">
                      {model.exchange.lines.map((line) => (
                        <li key={line.key}>
                          <span>
                            {line.label} {line.count}장 · {line.paw.toLocaleString("ko-KR")}P
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {sheet === "ticketShop" ? (
                  <div className="ticket-shop">
                    <div className="ticket-shop-card">
                      <div className="ticket-shop-card-icon" aria-hidden="true">
                        <img src={menuAsset("icon-ticket.svg")} alt="" width={28} height={28} />
                      </div>
                      <div className="ticket-shop-card-copy">
                        <p className="ticket-shop-card-title">{model.menu.sheets.ticketShop.cardTitle}</p>
                        <p className="ticket-shop-card-desc">{model.menu.sheets.ticketShop.cardDesc}</p>
                      </div>
                      <p className="ticket-shop-card-price">
                        {model.menu.sheets.ticketShop.priceLabel.replace(
                          "{price}",
                          String(model.ticketShop.pricePaw),
                        )}
                      </p>
                    </div>
                    <div className="ticket-shop-limits" role="list">
                      <div className="ticket-shop-limit" role="listitem">
                        <span>오늘</span>
                        <b>
                          {model.ticketShop.dayBought}/{model.ticketShop.dayLimit}
                        </b>
                      </div>
                      <div className="ticket-shop-limit" role="listitem">
                        <span>이번 주</span>
                        <b>
                          {model.ticketShop.weekBought}/{model.ticketShop.weekLimit}
                        </b>
                      </div>
                      <div className="ticket-shop-limit" role="listitem">
                        <span>보유</span>
                        <b>
                          {model.ticketShop.ticketsHeld}/{model.ticketShop.maxHold}
                        </b>
                      </div>
                    </div>
                    <p className="ticket-shop-balance">
                      {model.menu.sheets.ticketShop.balanceLabel.replace(
                        "{paw}",
                        model.ticketShop.pawBalance.toLocaleString("ko-KR"),
                      )}
                    </p>
                    {!model.ticketShop.canBuy && model.ticketShop.disabledReason ? (
                      <p className="ticket-shop-disabled">{model.ticketShop.disabledReason}</p>
                    ) : null}
                    {model.menu.sheets.ticketShop.note ? (
                      <p className="ticket-shop-note">{model.menu.sheets.ticketShop.note}</p>
                    ) : null}
                  </div>
                ) : null}

                {sheet === "rewards" ? (
                  rewardsView === "history" ? (
                    ops.walletHistory.length ? (
                      ops.walletHistory.map((item) => (
                        <div key={item.requestId} className="menu-list-row">
                          <span>
                            {item.amount}냥코인 → {item.amount}원
                          </span>
                          <b>
                            <span className={`wallet-status is-${item.status}`}>
                              {item.status === "done"
                                ? "완료"
                                : item.status === "pending"
                                  ? "처리 중"
                                  : "실패"}
                            </span>
                          </b>
                        </div>
                      ))
                    ) : (
                      <p className="rates-note">아직 받은 기록이 없어요.</p>
                    )
                  ) : rewardsView === "success" ? (
                    <div className="wallet-success">
                      <img src={NCOIN_ICON.lg} alt="" width={64} height={64} />
                      <h4>
                        {lastWithdraw?.status === "pending"
                          ? "처리 중이에요"
                          : (model.menu.sheets.rewards.wallet?.successTitle ??
                            "토스포인트를 받았어요")}
                      </h4>
                      <p>
                        {lastWithdraw
                          ? lastWithdraw.status === "pending"
                            ? `${lastWithdraw.amount}원 지급을 확인하고 있어요.`
                            : `${lastWithdraw.amount}원이 토스 포인트로 들어갔어요.`
                          : null}
                      </p>
                    </div>
                  ) : rewardsView === "confirm" ? (
                    <div className="wallet-success">
                      <img src={NCOIN_ICON.lg} alt="" width={64} height={64} />
                      <h4>{model.menu.sheets.rewards.wallet?.confirmTitle ?? "토스포인트로 받을까요?"}</h4>
                      <p>
                        {withdrawAmount}냥코인을 토스포인트 {withdrawAmount}원으로 바꿔요.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="wallet-card" id="wallet-card">
                        <div className="wallet-card-label">
                          {model.menu.sheets.rewards.wallet?.title ?? "내 냥코인"}
                        </div>
                        <div className="wallet-card-value">
                          <img src={ncoinIcon(24)} alt="" width={24} height={24} />
                          {model.nyangCoinBalance.toLocaleString("ko-KR")}
                          <small>냥코인</small>
                        </div>
                      </div>
                      <div id="withdraw-picker" className="withdraw-picker">
                        {(() => {
                          const { min, unit, dailyLimit, remainingToday, maxWithdrawable } =
                            model.wallet;
                          const balance = model.nyangCoinBalance;
                          const lowBalance = balance < min;
                          const dailyDone = !lowBalance && remainingToday < min;
                          const stepperDisabled = lowBalance || dailyDone || maxWithdrawable < min;
                          const canMinus = !stepperDisabled && withdrawAmount > min;
                          const canPlus = !stepperDisabled && withdrawAmount < maxWithdrawable;
                          const needMore = Math.max(0, min - balance);
                          const leftover = Math.max(0, balance - withdrawAmount);
                          const walletCopy = model.menu.sheets.rewards.wallet;
                          const hint = lowBalance
                            ? (walletCopy?.lowBalanceHint ??
                                "10 냥코인부터 받을 수 있어요 · {need}개 더 모아요").replace(
                                "{need}",
                                String(needMore),
                              )
                            : dailyDone
                              ? (walletCopy?.dailyDoneHint ??
                                "오늘은 다 받았어요 · 내일 00:00에 다시 받을 수 있어요")
                              : (walletCopy?.dailyLimitHint ??
                                  "오늘 {remainingToday}원 더 받을 수 있어요 · 하루 최대 {dailyLimit}원")
                                  .replace("{remainingToday}", String(remainingToday))
                                  .replace("{dailyLimit}", String(dailyLimit));
                          const cta = walletCopy?.withdrawCta ?? "토스 포인트 전환";
                          return (
                            <>
                              <div
                                className={`wallet-stepper ${stepperDisabled ? "is-disabled" : ""}`}
                                aria-disabled={stepperDisabled}
                              >
                                <button
                                  type="button"
                                  className="wallet-stepper-btn"
                                  aria-label={`${unit}냥코인 줄이기`}
                                  disabled={!canMinus}
                                  onPointerDown={(event) => {
                                    event.preventDefault();
                                    if (canMinus) startStepHold(-1);
                                  }}
                                  onPointerUp={clearStepHold}
                                  onPointerLeave={clearStepHold}
                                  onPointerCancel={clearStepHold}
                                >
                                  −
                                </button>
                                <div
                                  className="wallet-stepper-value"
                                  aria-live="polite"
                                  aria-atomic="true"
                                >
                                  <strong>
                                    {stepperDisabled ? Math.max(0, maxWithdrawable) : withdrawAmount}
                                  </strong>
                                  <span>냥코인</span>
                                </div>
                                <button
                                  type="button"
                                  className="wallet-stepper-btn"
                                  aria-label={`${unit}냥코인 늘리기`}
                                  disabled={!canPlus}
                                  onPointerDown={(event) => {
                                    event.preventDefault();
                                    if (canPlus) startStepHold(1);
                                  }}
                                  onPointerUp={clearStepHold}
                                  onPointerLeave={clearStepHold}
                                  onPointerCancel={clearStepHold}
                                >
                                  +
                                </button>
                              </div>
                              <p className="wallet-hint">{hint}</p>
                              {!stepperDisabled && leftover > 0 ? (
                                <p className="wallet-remain-hint">
                                  {(
                                    walletCopy?.remainAfterHint ??
                                    "받고 남는 {remain}냥코인은 그대로 모여요"
                                  ).replace("{remain}", String(leftover))}
                                </p>
                              ) : null}
                              <button
                                type="button"
                                id="btn-withdraw"
                                className="menu-sheet-cta is-withdraw"
                                disabled={stepperDisabled || withdrawAmount < min}
                                onClick={() => setRewardsView("confirm")}
                              >
                                {cta}
                              </button>
                            </>
                          );
                        })()}
                      </div>
                      {model.rewards.dexClaimableCount > 0 ? (
                        <button
                          type="button"
                          id="btn-dex-rewards-shortcut"
                          className="menu-list-row is-tap dex-rewards-shortcut"
                          onClick={() => {
                            closeSheet();
                            onClose();
                            onOpenDex();
                          }}
                        >
                          <span>
                            도감에서 받을 보상 {model.rewards.dexClaimableCount}개
                          </span>
                          <b>도감 가기 ›</b>
                        </button>
                      ) : (
                        <p className="rates-note">도감에서 받을 보상이 없어요.</p>
                      )}
                      <button
                        type="button"
                        id="btn-wallet-history"
                        className="wallet-history-link"
                        onClick={() => setRewardsView("history")}
                      >
                        {model.menu.sheets.rewards.wallet?.historyTitle ?? "받은 기록"}
                      </button>
                    </>
                  )
                ) : null}

                {sheet === "notice" ? (
                  <div className="menu-list-row">
                    <span>{model.latestNotice?.title ?? "공지 없음"}</span>
                    <b>NEW</b>
                  </div>
                ) : null}

                {sheet === "settings" ? (
                  <>
                    {(model.menu.rows.settings.items ?? []).map((item) => {
                      if (item.type === "toggle") {
                        const key = item.id as keyof MenuSettings;
                        const on = Boolean(settings[key]);
                        return (
                          <div key={item.id} className="settings-row">
                            <span>{item.label}</span>
                            <button
                              type="button"
                              className={`settings-toggle ${on ? "is-on" : ""}`}
                              aria-pressed={on}
                              onClick={() => patchSettings({ [key]: !on })}
                            >
                              <i />
                            </button>
                          </div>
                        );
                      }
                      if (item.type === "action") {
                        return (
                          <div key={item.id} className="settings-row">
                            <button
                              type="button"
                              className="link"
                              onClick={() => {
                                closeSheet();
                                requestClose();
                                onReplayTutorial();
                              }}
                            >
                              {item.label}
                            </button>
                          </div>
                        );
                      }
                      if (item.type === "text") {
                        return (
                          <div key={item.id} className="settings-row">
                            <span>{item.label}</span>
                            <button
                              type="button"
                              className="link settings-version-tap"
                              aria-label="앱 버전"
                              onPointerDown={(event) => {
                                if (event.button != null && event.button !== 0) return;
                                event.preventDefault();
                                unlockProgressReset();
                              }}
                            >
                              v1.0.0{isDevBuild ? " · DEV" : ""}
                            </button>
                          </div>
                        );
                      }
                      return (
                        <div key={item.id} className="settings-row">
                          <button
                            type="button"
                            className="link"
                            onClick={() => {
                              if (item.id === "credits" || item.url?.includes("LICENSES")) {
                                void fetch(item.url ?? "/assets/audio/LICENSES.md")
                                  .then((res) => (res.ok ? res.text() : "라이선스 파일을 찾지 못했어요."))
                                  .then(setCreditsText);
                                return;
                              }
                              showToast("링크는 곧 연결돼요");
                            }}
                          >
                            {item.label}
                          </button>
                        </div>
                      );
                    })}
                    {isDevBuild ? (
                      <div className="settings-row settings-row-dev">
                        <button
                          type="button"
                          className="link"
                          onClick={() => {
                            const next = {
                              ...ops,
                              nyangCoinBalance: ops.nyangCoinBalance + 10,
                            };
                            onOpsChange(next);
                            void buildMenuViewModel(next).then(setModel);
                            showToast("냥코인 +10 (DEV)");
                            AudioManager.playSfx("reward-coin");
                          }}
                        >
                          냥코인 10개 획득 (DEV)
                        </button>
                      </div>
                    ) : null}
                    {progressResetVisible ? (
                      <div className="settings-row settings-row-dev">
                        <button
                          type="button"
                          className="link is-danger"
                          disabled={devResetting}
                          onClick={() => {
                            if (devResetting) return;
                            setProgressResetConfirm(true);
                          }}
                        >
                          {devResetting ? "초기화 중…" : "진행도 초기화"}
                        </button>
                      </div>
                    ) : null}
                    {creditsText ? (
                      <pre className="menu-credits">{creditsText}</pre>
                    ) : null}
                  </>
                ) : null}
              </div>

              {sheet === "attendance" ? (
                <>
                  <button
                    type="button"
                    className="menu-sheet-cta"
                    disabled={!model.attendance.canClaimToday}
                    onClick={() => void claimAttendance()}
                  >
                    {attCta}
                  </button>
                  <p className="menu-sheet-note">
                    {attCopy?.note ?? model.menu.sheets.attendance.note ?? ""}
                  </p>
                </>
              ) : null}

              {sheet === "exchange" && exchangeView === "summary" ? (
                <button
                  type="button"
                  className="menu-sheet-cta"
                  disabled={model.exchange.duplicateCount <= 0}
                  onClick={() => setExchangeView("confirm")}
                >
                  {model.menu.sheets.exchange.cta.replace(
                    "{total}",
                    String(model.exchange.totalPaw),
                  )}
                </button>
              ) : null}

              {sheet === "exchange" && exchangeView === "confirm" ? (
                <div className="exchange-confirm-actions">
                  <button
                    type="button"
                    className="menu-sheet-cta is-secondary"
                    disabled={exchangeBusy}
                    onClick={() => setExchangeView("summary")}
                  >
                    {model.menu.sheets.exchange.confirmCancel ?? "취소"}
                  </button>
                  <button
                    type="button"
                    className="menu-sheet-cta"
                    disabled={exchangeBusy || model.exchange.duplicateCount <= 0}
                    onClick={() => void doExchange()}
                  >
                    {exchangeBusy
                      ? "처리 중…"
                      : (model.menu.sheets.exchange.confirmOk ?? "바꾸기")}
                  </button>
                </div>
              ) : null}

              {sheet === "ticketShop" ? (
                <div className="ticket-shop-actions">
                  <button
                    type="button"
                    className="menu-sheet-cta"
                    disabled={!model.ticketShop.canBuy || ticketBuyBusy}
                    onClick={() => void doBuyRateUpTicket()}
                  >
                    {ticketBuyBusy
                      ? "구매 중…"
                      : model.menu.sheets.ticketShop.ctaBuy.replace(
                          "{price}",
                          String(model.ticketShop.pricePaw),
                        )}
                  </button>
                  {model.ticketShop.ticketsHeld > 0 && onRateUpDraw ? (
                    <button
                      type="button"
                      className="menu-sheet-cta is-secondary"
                      onClick={() => {
                        closeSheet();
                        onClose();
                        onRateUpDraw();
                      }}
                    >
                      {model.menu.sheets.ticketShop.ctaDraw}
                    </button>
                  ) : null}
                </div>
              ) : null}

              {sheet === "rewards" ? (
                rewardsView === "history" ? (
                  <button type="button" className="menu-sheet-cta" onClick={() => setRewardsView("inbox")}>
                    돌아가기
                  </button>
                ) : rewardsView === "success" ? (
                  <button type="button" className="menu-sheet-cta" onClick={() => setRewardsView("inbox")}>
                    확인
                  </button>
                ) : rewardsView === "confirm" ? (
                  <button
                    type="button"
                    className="menu-sheet-cta"
                    disabled={withdrawBusy}
                    onClick={() => void doWithdraw()}
                  >
                    {withdrawBusy ? "처리 중…" : `받기 · ${withdrawAmount}원`}
                  </button>
                ) : model.rewards.dexClaimableCount > 0 ? (
                  <button
                    type="button"
                    id="btn-dex-rewards-go"
                    className="menu-sheet-cta"
                    onClick={() => {
                      closeSheet();
                      onClose();
                      onOpenDex();
                    }}
                  >
                    도감에서 보상 받기
                  </button>
                ) : null
              ) : null}

              {sheet === "notice" ? (
                <button
                  type="button"
                  className="menu-sheet-cta"
                  onClick={() => {
                    onOpsChange({
                      ...ops,
                      lastSeenNoticeId: model.latestNotice?.id ?? ops.lastSeenNoticeId,
                    });
                    closeSheet();
                  }}
                >
                  확인했어요
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {toast ? <div className="menu-toast">{toast}</div> : null}
      </aside>

      {progressResetConfirm ? (
        <div className="settings-reset-overlay" role="dialog" aria-modal="true" aria-label="진행도 초기화 확인">
          <button
            type="button"
            className="settings-reset-overlay-dim"
            aria-label="닫기"
            disabled={devResetting}
            onClick={() => {
              if (!devResetting) setProgressResetConfirm(false);
            }}
          />
          <div className="settings-reset-confirm is-modal">
            <strong>신규 유저 상태로 초기화할까요?</strong>
            <p>도감·카드·출석·튜토리얼·방꾸미기 진행도가 모두 지워져요.</p>
            <div className="settings-reset-confirm-actions">
              <button
                type="button"
                className="menu-sheet-cta is-secondary"
                disabled={devResetting}
                onClick={() => setProgressResetConfirm(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="menu-sheet-cta is-danger"
                disabled={devResetting}
                onClick={runProgressReset}
              >
                {devResetting ? "초기화 중…" : "초기화"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
