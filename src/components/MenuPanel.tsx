import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { AudioManager } from "../audio/AudioManager";
import { useBackHandler } from "../hooks/useBackHandler";
import { useLoadingHold } from "../lib/loadingGate";
import { jellyLabel } from "../lib/jellyLabel";
import { menuAsset } from "../lib/menuConfig";
import { NCOIN_ICON, ncoinIcon } from "../lib/ncoinIcon";
import { listClaimableDexRewards } from "../lib/dexRewards";
import { markDexClaimableSeen, sameStringList } from "../lib/dexSeen";
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
  acquireWithdrawRequestId,
  inspectTossPointGrant,
  postWalletWithdraw,
} from "../lib/mockWallet";
import { getWalletSnapshot, serverWalletActive, walletGet } from "../lib/serverWallet";
import {
  buildTicketBuyRequestId,
  postShopTicketsBuy,
} from "../lib/mockTicketShop";
import { buildDupExchangeRequestId, postDupExchange } from "../lib/dupExchange";
import { buildAttendanceDay7RequestId, readDay7BonusConfig } from "../lib/attendanceServer";
import { ratesDisclosureNote, ratesDisclosureRows } from "../lib/drawRates";
import { claimAttendanceDay7, claimAttendanceGift } from "../lib/opsRewards";
import type { OpsState, WalletHistoryItem } from "../lib/opsTypes";
import type { MenuSheetId } from "../lib/menuTypes";
import { track } from "../lib/analytics";
import {
  recordAttendanceNotifyResult,
  requestAttendanceNotification,
} from "../lib/attendanceNotify";
import { haptic } from "../lib/native";
import { nyConfirm, nyNotify } from "../lib/nyangNotify";
import type { HelpTabId } from "../lib/helpConfig";
import { HelpEarnSheet } from "./HelpEarnSheet";
import { NyChip } from "./NyChip";
import "./MenuPanel.css";

type RewardsView = "inbox" | "confirm" | "success" | "history";
type ExchangeView = "summary" | "confirm";

type MenuPanelProps = {
  open: boolean;
  ops: OpsState;
  onClose: () => void;
  onOpsChange: (next: OpsState) => void;
  onOpenDex: () => void;
  onOpenRoom: () => void;
  onPawAd: () => void;
  /** Play long ad for weekly day7 bonus; retries load once upstream. */
  onAttendanceDay7Ad?: () => Promise<"completed" | "cancelled" | "failed" | "offline">;
  /** Fired once a check-in reward has been granted. */
  onAttendanceRewarded?: () => void;
  onReplayTutorial: () => void;
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
  onAttendanceDay7Ad,
  onAttendanceRewarded,
  onReplayTutorial,
  onRateUpDraw,
  forceSheet = null,
  lockDismiss = false,
  onSheetOpen,
}: MenuPanelProps) {
  const [model, setModel] = useState<MenuViewModel | null>(null);
  const [closing, setClosing] = useState(false);
  const [sheet, setSheet] = useState<MenuSheetId>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [ratesExpandedGrade, setRatesExpandedGrade] = useState<string | null>(null);
  const [settings, setSettings] = useState<MenuSettings>(() => loadMenuSettings());
  const [stampDay, setStampDay] = useState<number | null>(null);
  const [popDay, setPopDay] = useState<number | null>(null);
  const [creditsText, setCreditsText] = useState<string | null>(null);
  const [rewardsView, setRewardsView] = useState<RewardsView>("inbox");
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [lastWithdraw, setLastWithdraw] = useState<WalletHistoryItem | null>(null);
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [grantHold, setGrantHold] = useState<string | null>(null);
  const [attendBusy, setAttendBusy] = useState(false);
  const [day7AdWaiting, setDay7AdWaiting] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTab, setHelpTab] = useState<HelpTabId>("ncoin");
  const [ticketBuyBusy, setTicketBuyBusy] = useState(false);
  const [exchangeView, setExchangeView] = useState<ExchangeView>("summary");
  const [exchangeBusy, setExchangeBusy] = useState(false);
  const [pawTipOpen, setPawTipOpen] = useState(false);
  const [day7Busy, setDay7Busy] = useState(false);
  const [day7AdExhausted, setDay7AdExhausted] = useState(false);
  const menuRequestBusy =
    withdrawBusy || exchangeBusy || ticketBuyBusy || attendBusy || (day7Busy && !day7AdWaiting);
  useLoadingHold("menu-request", menuRequestBusy);
  const day7RequestIdRef = useRef<string | null>(null);
  const reduce = shouldReduceMenuMotion(settings);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const sheetDrag = useRef<{ y: number; active: boolean }>({ y: 0, active: false });
  const stepHoldTimer = useRef(0);
  const stepRepeatTimer = useRef(0);
  const withdrawAmountRef = useRef(withdrawAmount);
  const pointsTopRef = useRef<HTMLSpanElement>(null);
  const [pointsWeekendBelow, setPointsWeekendBelow] = useState(false);
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
    if (sheet !== "rewards" || rewardsView !== "inbox") return;
    let cancelled = false;
    void listClaimableDexRewards(ops).then((list) => {
      if (cancelled) return;
      const nextSeen = markDexClaimableSeen(list.map((item) => item.id));
      if (sameStringList(ops.seenDexClaimableIds, nextSeen)) return;
      onOpsChange({ ...ops, seenDexClaimableIds: nextSeen });
    });
    return () => {
      cancelled = true;
    };
  }, [sheet, rewardsView, ops, onOpsChange]);

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
    }, reduce ? 150 : 280);
  };

  useBackHandler(open, requestClose, 20);

  useEffect(() => {
    if (sheet !== "rewards") return;
    let cancel = false;
    void (async () => {
      if (await serverWalletActive()) {
        const snap = getWalletSnapshot();
        if (!snap || Date.now() - snap.fetchedAt >= 15_000) await walletGet();
      }
      if (cancel) return;
      const result = await inspectTossPointGrant(ops);
      if (!cancel) setGrantHold(result.ok ? null : result.reason);
    })();
    return () => {
      cancel = true;
    };
  }, [sheet, ops]);

  const doWithdraw = async () => {
    if (!model || withdrawBusy || withdrawAmount < model.wallet.min) return;
    if (withdrawAmount > model.wallet.maxWithdrawable) return;
    setWithdrawBusy(true);
    try {
      const requestId = await acquireWithdrawRequestId(withdrawAmount);
      const result = await postWalletWithdraw(ops, { amount: withdrawAmount, requestId });
      onOpsChange(result.state);
      const responseId = result.response.ok ? result.response.requestId : requestId;
      const shownAmount = result.response.ok ? result.response.amount : withdrawAmount;
      const row =
        result.state.walletHistory.find((item) => item.requestId === responseId) ??
        (result.response.ok
          ? {
              requestId: responseId,
              amount: shownAmount,
              status: result.response.status,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              testGrant: result.response.testGrant,
            }
          : null);
      setLastWithdraw(row);
      if (result.response.ok && result.response.status === "done") {
        setRewardsView("success");
        haptic("success");
        nyNotify(
          result.response.testGrant
            ? {
                key: "withdraw-test",
                kind: "success",
                title: "테스트 지급을 확인했어요",
                sub: "연습이라 실제로는 받지 않아요",
              }
            : {
                key: "withdraw-done",
                kind: "success",
                title: `<b>${shownAmount}원</b>을 받았어요`,
              },
        );
      } else if (result.response.ok && result.response.status === "pending") {
        setLastWithdraw(row);
        setRewardsView("success");
        nyNotify({
          key: "withdraw-pending",
          kind: "info",
          title: "확인 중이에요",
          sub: "잠시 후 기록에서 확인해 주세요",
        });
      } else if (result.response.ok === false && result.response.code === "DAILY_LIMIT") {
        setRewardsView("inbox");
      } else {
        nyNotify({
          key: "withdraw-fail",
          kind: "error",
          title: "보내지 못해 냥코인을 돌려드렸어요",
          sub:
            result.response.ok === false
              ? result.response.reason
              : "네트워크를 확인하고 다시 눌러 주세요",
          action: { label: "다시 시도", onClick: () => setRewardsView("inbox") },
        });
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

  useEffect(() => {
    if (!open) setHelpOpen(false);
  }, [open]);

  const openHelp = (tab: HelpTabId = "ncoin") => {
    setHelpTab(tab);
    setHelpOpen(true);
  };

  const onRow = (open: string, enabled: boolean, id: string) => {
    if (!enabled && id !== "points" && id !== "exchange") return;
    if (open === "action:rewardedAd(paw)") {
      if (!enabled) {
        nyNotify({
          key: "paw-ad-closed",
          kind: "info",
          title: "오늘 보상 받기를 모두 했어요",
          sub: "내일 0시에 다시 열려요",
        });
        return;
      }
      onPawAd();
      return;
    }
    if (open === "sheet:helpEarn") {
      openHelp("ncoin");
      return;
    }
    if (open.startsWith("sheet:")) {
      openSheet(open.slice(6) as MenuSheetId);
      return;
    }
    if (open === "page:settings") openSheet("settings");
  };

  const notifyDay7Claim = (
    withAd: boolean,
    nyangCoin: number,
    paw: number,
    tickets: number,
  ) => {
    const parts = [`+${nyangCoin} 냥코인`, jellyLabel(paw, true)];
    if (withAd && tickets > 0) parts.push("뽑기권 1장");
    nyNotify({
      key: withAd ? "attend-day7-ad" : "attend-day7-base",
      kind: "reward",
      title: parts.join(" · "),
    });
  };

  const finishDay7Claim = async (withAd: boolean, adToken?: string) => {
    if (!model || day7Busy) return;
    const cycleNo = model.attendance.cycleNo;
    if (cycleNo == null) {
      nyNotify({
        key: "attend-day7-nocycle",
        kind: "error",
        title: "출석 주기를 확인하지 못했어요",
      });
      return;
    }
    setDay7Busy(true);
    try {
      if (!day7RequestIdRef.current) {
        day7RequestIdRef.current = buildAttendanceDay7RequestId(cycleNo);
      }
      const result = await claimAttendanceDay7(ops, {
        cycleNo,
        withAd,
        adToken,
        requestId: day7RequestIdRef.current,
      });
      if (!result.response.ok) {
        nyNotify({
          key: "attend-day7-fail",
          kind: "error",
          title: "보너스를 받지 못했어요",
          sub: result.response.reason,
        });
        return;
      }
      day7RequestIdRef.current = null;
      setDay7AdExhausted(false);
      onOpsChange(result.state);
      onAttendanceRewarded?.();
      if (withAd) {
        track("ad_complete", { placement: "attendance_day7", ad_length: "long" });
      }
      track("attendance_claim", { day: 7, doubled: withAd });
      setPopDay(7);
      setStampDay(7);
      void haptic("success");
      window.setTimeout(() => AudioManager.playSfx("stamp"), 180);
      window.setTimeout(() => {
        setPopDay(null);
        AudioManager.playSfx("reward-coin");
        notifyDay7Claim(
          result.response.ok ? result.response.withAd : withAd,
          result.response.ok ? result.response.nyangCoin : 0,
          result.response.ok ? result.response.paw : 0,
          result.response.ok ? result.response.tickets : 0,
        );
      }, 320);
    } finally {
      setDay7Busy(false);
    }
  };

  const claimDay7WithAd = async () => {
    if (!onAttendanceDay7Ad || day7Busy || day7AdExhausted) return;
    setDay7Busy(true);
    setDay7AdWaiting(true);
    try {
      const result = await onAttendanceDay7Ad();
      if (result === "offline") {
        nyNotify({
          key: "ad-offline",
          kind: "error",
          title: "인터넷 연결을 확인해 주세요",
        });
        return;
      }
      if (result === "cancelled") return;
      if (result !== "completed") {
        setDay7AdExhausted(true);
        nyNotify({
          key: "attend-day7-ad-fail",
          kind: "error",
          title: "광고를 보지 못했어요",
          sub: "그냥 받기로 보너스를 받을 수 있어요",
        });
        return;
      }
      setDay7Busy(false);
      setDay7AdWaiting(false);
      const token = `ad:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      await finishDay7Claim(true, token);
    } finally {
      setDay7Busy(false);
      setDay7AdWaiting(false);
    }
  };

  const claimAttendance = async () => {
    if (model?.attendance.isWeeklyDay7) {
      // Dual-button footer handles weekly day7; ignore accidental single CTA.
      return;
    }
    setAttendBusy(true);
    let result;
    try {
      result = await claimAttendanceGift(ops);
    } finally {
      setAttendBusy(false);
    }
    if (result.error) {
      if (result.error === "DAY7_BONUS_REQUIRED") {
        void buildMenuViewModel(ops).then(setModel);
        return;
      }
      nyNotify({
        key: "attend-fail",
        kind: "error",
        title: "출석하지 못했어요",
        sub: result.error,
        action: { label: "다시 시도", onClick: () => void claimAttendance() },
      });
      return;
    }
    const day =
      result.response?.phase === "firstWeek"
        ? result.state.attendanceDays
        : (result.response?.cycleDay ?? result.state.attendanceDays);
    setPopDay(day);
    setStampDay(day);
    onOpsChange(result.state);
    onAttendanceRewarded?.();
    track("attendance_claim", { day, doubled: false });
    void haptic("success");
    window.setTimeout(() => AudioManager.playSfx("stamp"), 180);
    const itemReward = result.response?.rewards.find((reward) => reward.kind === "item");
    const pawReward = result.response?.rewards.find((reward) => reward.kind === "paw");
    const ticketReward = result.response?.rewards.find((reward) => reward.kind === "rateUpTicket");
    window.setTimeout(() => {
      setPopDay(null);
      if (pawReward || ticketReward) AudioManager.playSfx("reward-coin");
      if (day === 7) {
        const rewards = [];
        if (pawReward) rewards.push({ label: jellyLabel(pawReward.paw, true), icon: "paw" as const });
        if (ticketReward) rewards.push({ label: "뽑기권 +1", icon: "ticket" as const });
        if (itemReward) rewards.push({ label: "가구", icon: "cat" as const });
        nyNotify({
          key: "attend-7",
          kind: "celebrate",
          title: "출석 7일 달성! 🎉",
          rewards: rewards.length ? rewards : [{ label: "출석 선물", icon: "paw" }],
        });
        return;
      }
      if (itemReward) {
        nyNotify({
          key: "attend-item",
          kind: "success",
          title: "출석 선물이 도착했어요",
          sub: "서랍에 쏙 넣었어요",
          action: { label: "놓으러 가기", onClick: () => { closeSheet(); onClose(); onOpenRoom(); } },
        });
      } else if (ticketReward) {
        nyNotify({
          key: "attend-ticket",
          kind: "reward",
          title: "출석 선물 도착!",
          sub: "확률업 이용권을 받았어요",
        });
      } else if (pawReward) {
        nyNotify({
          key: "attend-paw",
          kind: "reward",
          title: "출석 선물 도착!",
          sub: `{paw} <b>${pawReward.paw}</b>`,
          count: pawReward.paw,
        });
      } else {
        nyNotify({ key: "attend-ok", kind: "success", title: "출석 완료!" });
      }
    }, 320);
  };

  const doExchange = async () => {
    if (exchangeBusy || !model || model.exchange.duplicateCount <= 0) return;
    const n = model.exchange.duplicateCount;
    const p = model.exchange.totalPaw;
    const ok = await nyConfirm({
      key: "dup-exchange",
      title: `중복 카드 ${n}장을 바꿀까요?`,
      body: "바꾼 카드는 도감에 1장씩 남아요\n젤리로 바꾸면 되돌릴 수 없어요",
      badge: `+${p} 젤리`,
      cancelLabel: model.menu.sheets.exchange.confirmCancel ?? "취소",
      confirmLabel: model.menu.sheets.exchange.confirmOk ?? "바꾸기",
    });
    if (!ok) return;
    setExchangeBusy(true);
    try {
      const result = await postDupExchange(ops, {
        mode: "all",
        requestId: buildDupExchangeRequestId("all"),
      });
      if (!result.response.ok) {
        nyNotify({
          key: "dup-exchange-fail",
          kind: "error",
          title: "바꾸지 못했어요",
          sub: result.response.reason,
          action: { label: "다시 시도", onClick: () => void doExchange() },
        });
        return;
      }
      onOpsChange(result.state);
      nyNotify({
        key: "dup-exchange-done",
        kind: "reward",
        title: `{paw} <b>+${result.response.gained}</b> 받았어요`,
        count: result.response.gained,
      });
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
        const reason = result.response.reason;
        if (reason.includes("주") || reason.includes("한도") || reason.includes("보유")) {
          // Inline chip near buy button handles persistent can't-buy; snack for feedback.
          nyNotify({
            key: "ticket-limit",
            kind: "info",
            title: reason.includes("보유")
              ? "뽑기권은 3장까지 가질 수 있어요"
              : "이번 주 구매 한도를 다 썼어요",
            sub: reason.includes("보유")
              ? "가지고 있는 권을 먼저 써 보세요"
              : "월요일 0시에 다시 살 수 있어요",
          });
        } else {
          nyNotify({
            key: "ticket-buy-fail",
            kind: "error",
            title: "사지 못했어요",
            sub: reason,
            action: { label: "다시 시도", onClick: () => void doBuyRateUpTicket() },
          });
        }
        return;
      }
      AudioManager.playSfx("reward-coin");
      void haptic("success");
      const held = result.state.rateUpTickets;
      nyNotify({
        key: "ticket-bought",
        kind: "success",
        title: "확률업 뽑기권을 샀어요",
        sub: `보유 <b>${held}/3</b>`,
      });
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
    return ratesDisclosureRows(model.config.economy);
  }, [model]);

  const ratesNote = useMemo(() => {
    if (!model) return "같은 등급 안에서는 카드별 확률이 같아요 · 합계 100%";
    return ratesDisclosureNote(model.config.economy);
  }, [model]);

  const formatDisclosurePct = (pct: number) => {
    if (Number.isInteger(pct)) return `${pct}%`;
    const fixed = pct.toFixed(4).replace(/\.?0+$/, "");
    return `${fixed}%`;
  };

  useLayoutEffect(() => {
    if (!open || !model?.pawAds.weekendDouble) {
      setPointsWeekendBelow(false);
      return;
    }
    const measure = () => {
      const el = pointsTopRef.current;
      if (!el) return;
      if (!pointsWeekendBelow) {
        if (el.scrollWidth > el.clientWidth + 1) setPointsWeekendBelow(true);
        return;
      }
      const badge = el.parentElement?.querySelector(".menu-points-weekend");
      const need = (badge?.getBoundingClientRect().width ?? 56) + 6;
      if (el.clientWidth - el.scrollWidth >= need) setPointsWeekendBelow(false);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (pointsTopRef.current) ro.observe(pointsTopRef.current);
    return () => ro.disconnect();
  }, [open, model, pointsWeekendBelow]);

  if (!open && !closing) return null;

  const attState = model ? attendanceSheetState(model.attendance) : "firstWeek";
  const attCopy = model?.menu.sheets.attendance.states?.[attState];
  const isWeeklyDay7Claim =
    Boolean(model?.attendance.canClaimToday && model.attendance.isWeeklyDay7);
  const day7Bonus = model ? readDay7BonusConfig(model.config) : null;
  const ticketMaxHold = model?.config.economy.tickets?.rateUpTicket?.maxHold ?? 3;
  const ticketsFull = Boolean(model && model.attendance.rateUpTickets >= ticketMaxHold);
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
      className={`menu-root ${open && !closing ? "is-open" : ""} ${closing ? "is-closing" : ""} ${reduce ? "is-reduce" : ""} ${helpOpen ? "is-help-open" : ""}`}
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
                <button
                  type="button"
                  className={`menu-stat is-paw-tip ${pawTipOpen ? "is-tip-open" : ""}`}
                  aria-label="내 젤리 안내"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setPawTipOpen(true);
                  }}
                  onPointerUp={() => setPawTipOpen(false)}
                  onPointerLeave={() => setPawTipOpen(false)}
                  onPointerCancel={() => setPawTipOpen(false)}
                >
                  <div className="menu-stat-value">
                    <img src={menuAsset("icon-paw-mini.svg")} alt="" />
                    {model.pawBalance.toLocaleString("ko-KR")}
                  </div>
                  <div className="menu-stat-label">내 젤리</div>
                  {pawTipOpen ? (
                    <span className="menu-paw-tip" role="status">
                      방꾸미기와 뽑기권 구매에 사용돼요
                    </span>
                  ) : null}
                </button>
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
                      className={`menu-row ${row.id === "points" ? "is-points" : ""} ${row.enabled ? "" : "is-disabled"}`}
                      style={{ animationDelay: reduce ? "0ms" : `${index * 30}ms` }}
                      onClick={() => onRow(row.open, row.enabled, row.id)}
                    >
                      <span className="menu-row-icon">
                        <img src={row.icon} alt="" />
                        {row.badge.type === "dot" ? <span className="menu-dot" /> : null}
                      </span>
                      {row.id === "points" ? (
                        <span className="menu-points-copy">
                          <span className="menu-points-top" ref={pointsTopRef}>
                            <span className="menu-row-label">{row.label}</span>
                            <span className="menu-ad-tag" aria-label="광고">
                              광고
                            </span>
                            {model.pawAds.weekendDouble && !pointsWeekendBelow ? (
                              <span className="menu-pill menu-points-weekend">주말 2배</span>
                            ) : null}
                          </span>
                          <span
                            className={`menu-points-sub${model.pawAds.remaining <= 0 ? " is-done" : ""}`}
                          >
                            {model.pawAds.weekendDouble && pointsWeekendBelow ? (
                              <span className="menu-pill menu-points-weekend">주말 2배</span>
                            ) : null}
                            <span className="menu-points-bit">
                              <img src={menuAsset("icon-paw-mini.svg")} alt="" />
                              짧은 광고 보고 젤리 +{model.pawAds.pawGrant}
                            </span>
                            <span className="menu-points-sep" aria-hidden="true">
                              ·
                            </span>
                            <span className="menu-points-bit">
                              <img src={ncoinIcon(12)} alt="" width={12} height={12} />
                              냥코인 {model.pawAds.nyangGrant}개
                            </span>
                            <span className="menu-points-sep" aria-hidden="true">
                              ·
                            </span>
                            {model.pawAds.remaining > 0 ? (
                              <span className="menu-points-bit">
                                남은 <b>{model.pawAds.remaining}/{model.pawAds.max}</b>회
                              </span>
                            ) : (
                              <span className="menu-points-bit">오늘은 다 받았어요</span>
                            )}
                          </span>
                        </span>
                      ) : (
                        <span className="menu-row-label">{row.label}</span>
                      )}
                      {row.id === "points" ? null : (
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
                      )}
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
              <span>행운냥 · v1.0.0</span>
              <button
                type="button"
                onClick={() =>
                  nyNotify({ key: "contact-soon", kind: "info", title: "문의 링크는 곧 연결돼요" })
                }
              >
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
                      ? model.menu.sheets.rates.desc ||
                        "뽑기 결과는 서버에서 정해져요.\n같은 등급 안에서는 카드마다 확률이 같아요."
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
                              if (cell.day === 7 && model.attendance.isWeeklyDay7) {
                                // Dual CTA in footer — scroll/focus handled by buttons.
                                return;
                              }
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
                    {isWeeklyDay7Claim && day7Bonus ? (
                      <div className="att-day7-bonus">
                        <p className="att-day7-bonus-title">7일차 보너스</p>
                        <p className="att-day7-bonus-desc">
                          기본 {day7Bonus.base.nyangCoin}냥코인 + 젤리 {day7Bonus.base.paw}
                          {day7Bonus.adBonus
                            ? ` · 광고 시 ${day7Bonus.adBonus.nyangCoin}냥코인 + 젤리 ${day7Bonus.adBonus.paw} + 뽑기권`
                            : ""}
                        </p>
                      </div>
                    ) : null}
                  </>
                ) : null}

                {sheet === "rates" ? (
                  <>
                    <table className="rates-table rates-table-disclosure">
                      <thead>
                        <tr>
                          <th>등급</th>
                          <th style={{ textAlign: "right" }}>장수</th>
                          <th style={{ textAlign: "right" }}>일반 %</th>
                          <th style={{ textAlign: "right" }}>확률업 %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ratesRows.map((row) => {
                          const open = ratesExpandedGrade === row.grade;
                          const rare =
                            row.grade === "b5" ||
                            row.grade === "special" ||
                            row.grade === "character" ||
                            row.grade === "legend";
                          return (
                            <Fragment key={row.grade}>
                              <tr
                                className={`rates-row-main ${open ? "is-open" : ""} ${
                                  rare ? "is-hi" : ""
                                }`}
                                onClick={() =>
                                  setRatesExpandedGrade((prev) =>
                                    prev === row.grade ? null : row.grade,
                                  )
                                }
                              >
                                <td>
                                  {row.nameKo}
                                  <span className="rates-expand-hint" aria-hidden="true">
                                    {open ? " ▾" : " ›"}
                                  </span>
                                </td>
                                <td className="rates-num">{row.cards}</td>
                                <td className="rates-pct">{formatDisclosurePct(row.normalPct)}</td>
                                <td className="rates-pct">{formatDisclosurePct(row.rateUpPct)}</td>
                              </tr>
                              {open ? (
                                <tr className="rates-row-detail">
                                  <td colSpan={4}>
                                    카드 1장당 · 일반 {formatDisclosurePct(row.normalPerCardPct)} ·
                                    확률업 {formatDisclosurePct(row.rateUpPerCardPct)}
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="rates-note">{ratesNote}</p>
                  </>
                ) : null}

                {sheet === "exchange" && exchangeView === "summary" ? (
                  <>
                    <div className="menu-list-row">
                      <span>중복 카드</span>
                      <b>{model.exchange.duplicateCount}장</b>
                    </div>
                    <div className="menu-list-row">
                      <span>받을 젤리</span>
                      <b>{jellyLabel(model.exchange.totalPaw)}</b>
                    </div>
                  </>
                ) : null}

                {sheet === "exchange" && exchangeView === "confirm" ? (
                  <div className="exchange-confirm">
                    <h4>
                      {(model.menu.sheets.exchange.confirmTitle ??
                        "중복 카드 {n}장을 발바닥 젤리 {p}으로 바꿀까요?")
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
                            {line.label} {line.count}장 · {jellyLabel(line.paw)}
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
                              {item.testGrant
                                ? "테스트"
                                : item.status === "done"
                                  ? "완료"
                                  : item.status === "pending"
                                    ? "확인 중"
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
                        {lastWithdraw?.testGrant
                          ? "테스트 지급을 확인했어요"
                          : lastWithdraw?.status === "pending"
                            ? "확인 중이에요"
                            : (model.menu.sheets.rewards.wallet?.successTitle ??
                              "받았어요")}
                      </h4>
                      <p>
                        {lastWithdraw
                          ? lastWithdraw.testGrant
                            ? "연습이라 실제로는 받지 않아요. 냥코인은 그대로예요."
                            : lastWithdraw.status === "pending"
                              ? `${lastWithdraw.amount}원 지급을 확인하고 있어요.`
                              : `${lastWithdraw.amount}원을 받았어요.`
                          : null}
                      </p>
                    </div>
                  ) : rewardsView === "confirm" ? (
                    <div className="wallet-success">
                      <img src={NCOIN_ICON.lg} alt="" width={64} height={64} />
                      <h4>{model.menu.sheets.rewards.wallet?.confirmTitle ?? "냥코인을 받을까요?"}</h4>
                      <p>
                        {withdrawAmount}냥코인을 {withdrawAmount}원으로 받아요.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="wallet-card" id="wallet-card">
                        <button
                          type="button"
                          className="wallet-card-help"
                          aria-label="냥코인·젤리 얻는 법"
                          onClick={() => openHelp("ncoin")}
                        >
                          ?
                        </button>
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
                          const cta = walletCopy?.withdrawCta ?? "냥코인 받기";
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
                              {grantHold ? (
                                <p className="wallet-hint">{grantHold}</p>
                              ) : lowBalance || dailyDone ? (
                                <div className="ny-chip-anchor">
                                  <NyChip arrow="down" arrowX={40} wide>
                                    {lowBalance
                                      ? `10냥코인부터 받을 수 있어요 · ${needMore}개 더 모으면 돼요`
                                      : "오늘 받을 수 있는 한도를 다 썼어요 · 내일 0시에 다시 받을 수 있어요"}
                                  </NyChip>
                                </div>
                              ) : (
                                <p className="wallet-hint">{hint}</p>
                              )}
                              {!stepperDisabled && leftover > 0 ? (
                                <p className="wallet-remain-hint">
                                  {(
                                    walletCopy?.remainAfterHint ??
                                    "받고 남는 {remain}냥코인은 그대로 모여요"
                                  ).replace("{remain}", String(leftover))}
                                </p>
                              ) : null}
                              <p className="wallet-policy">
                                {walletCopy?.policy ??
                                  "받으면 바로 지급돼요. 10냥코인부터 10개씩이고, 1냥코인은 1원이에요. 탈퇴하거나 부정하게 참여하면 받을 수 없어요. 이 프로모션은 사전 고지 없이 중단될 수 있어요."}
                              </p>
                              <button
                                type="button"
                                id="btn-withdraw"
                                className="menu-sheet-cta is-withdraw"
                                disabled={
                                  stepperDisabled ||
                                  withdrawAmount < min ||
                                  withdrawBusy ||
                                  Boolean(grantHold)
                                }
                                onClick={() => {
                                  void (async () => {
                                    const ok = await nyConfirm({
                                      key: "withdraw",
                                      title: `냥코인 ${withdrawAmount}원을 받을까요?`,
                                      body: "받은 뒤에는 냥코인으로 되돌릴 수 없어요. 이 프로모션은 사전 고지 없이 중단될 수 있어요.",
                                      cancelLabel: "취소",
                                      confirmLabel: "받기",
                                    });
                                    if (ok) void doWithdraw();
                                  })();
                                }}
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
                        {model.menu.sheets.rewards.wallet?.historyTitle ?? "지급 내역"}
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
                                if (item.action === "notification.attendance") {
                                  requestAttendanceNotification({
                                    onResult: recordAttendanceNotifyResult,
                                  });
                                  return;
                                }
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
                            <span className="settings-version">v1.0.0</span>
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
                              nyNotify({ key: "link-soon", kind: "info", title: "링크는 곧 연결돼요" });
                            }}
                          >
                            {item.label}
                          </button>
                        </div>
                      );
                    })}
                    {creditsText ? (
                      <pre className="menu-credits">{creditsText}</pre>
                    ) : null}
                  </>
                ) : null}
              </div>

              {sheet === "attendance" ? (
                <>
                  {isWeeklyDay7Claim ? (
                    <div className="att-day7-actions">
                      <button
                        type="button"
                        className="menu-sheet-cta is-secondary"
                        disabled={day7Busy || !model.attendance.canClaimToday}
                        onClick={() => void finishDay7Claim(false)}
                      >
                        그냥 받기
                      </button>
                      <button
                        type="button"
                        className="menu-sheet-cta"
                        disabled={
                          day7Busy ||
                          day7AdExhausted ||
                          !model.attendance.canClaimToday ||
                          !onAttendanceDay7Ad
                        }
                        onClick={() => void claimDay7WithAd()}
                      >
                        {day7AdExhausted ? (
                          "광고 불가 · 그냥 받기 이용"
                        ) : (
                          <span className="ticket-shop-draw-cta">
                            <span className="ticket-shop-ad-badge">광고</span>
                            30초 광고 보고 2배 + 뽑기권
                          </span>
                        )}
                      </button>
                      {ticketsFull ? (
                        <p className="att-day7-ticket-full">
                          뽑기권 보관함이 가득 찼어요 · 냥코인·젤리만 2배
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="menu-sheet-cta"
                      disabled={!model.attendance.canClaimToday || attendBusy}
                      onClick={() => void claimAttendance()}
                    >
                      {attCta}
                    </button>
                  )}
                  <p className="menu-sheet-note">
                    {attCopy?.note ?? model.menu.sheets.attendance.note ?? ""}
                  </p>
                </>
              ) : null}

              {sheet === "exchange" && exchangeView === "summary" ? (
                <button
                  type="button"
                  className="menu-sheet-cta"
                  disabled={exchangeBusy || model.exchange.duplicateCount <= 0}
                  onClick={() => void doExchange()}
                >
                  {model.menu.sheets.exchange.cta.replace(
                    "{total}",
                    String(model.exchange.totalPaw),
                  )}
                </button>
              ) : null}

              {sheet === "ticketShop" ? (
                <div className="ticket-shop-actions">
                  {!model.ticketShop.canBuy && model.ticketShop.disabledReason ? (
                    <div className="ny-chip-anchor is-ticket">
                      <NyChip arrow="down" arrowX={48} wide>
                        {model.ticketShop.disabledReason.includes("보유")
                          ? "뽑기권은 3장까지 가질 수 있어요"
                          : model.ticketShop.disabledReason.includes("주")
                            ? "이번 주 구매 한도를 다 썼어요 · 월요일 0시에 다시 살 수 있어요"
                            : model.ticketShop.disabledReason}
                      </NyChip>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="menu-sheet-cta"
                    disabled={!model.ticketShop.canBuy || ticketBuyBusy}
                    onClick={() => void doBuyRateUpTicket()}
                  >
                    {model.menu.sheets.ticketShop.ctaBuy.replace(
                      "{price}",
                      String(model.ticketShop.pricePaw),
                    )}
                  </button>
                  {onRateUpDraw ? (
                    <button
                      type="button"
                      className="menu-sheet-cta is-secondary"
                      onClick={() => {
                        closeSheet();
                        onClose();
                        onRateUpDraw();
                      }}
                    >
                      {model.ticketShop.ticketsHeld > 0 ? (
                        "이용권으로 확률업 뽑기"
                      ) : (
                        <span className="ticket-shop-draw-cta">
                          <span className="ticket-shop-ad-badge">광고</span>
                          30초 광고 보고 확률업 뽑기
                        </span>
                      )}
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
                    {`받기 · ${withdrawAmount}원`}
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

      </aside>

      {helpOpen ? (
        <HelpEarnSheet initialTab={helpTab} onClose={() => setHelpOpen(false)} />
      ) : null}
    </div>
  );
}
