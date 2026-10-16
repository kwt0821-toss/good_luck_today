import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AudioManager } from "./audio/AudioManager";
import { AchievementsSheet } from "./components/AchievementsSheet";
import { AdModal } from "./components/AdModal";
import { NyangNotifyHost } from "./components/NyangNotifyHost";
import { nyNotify } from "./lib/nyangNotify";
import { MenuPanel } from "./components/MenuPanel";
import { FeatureIntroBubble, TutorialCoach } from "./components/TutorialCoach";
import {
  EMPTY_RIBBON_COPY,
  buildAchvProgressList,
  claimableAchvCount,
  computeAchvMetrics,
  loadAchievementsConfig,
  type AchvConfig,
  type AchvProgress,
} from "./lib/achievements";
import { toKstDateKey } from "./lib/date";
import { buildMenuViewModel } from "./lib/menuModel";
import {
  MENU_SETTINGS_EVENT,
  shouldReduceMenuMotion,
  syncAudioSettingsFromStorage,
} from "./lib/menuSettings";
import type { MockAdKind } from "./lib/mockAds";
import { countClaimableDexRewards } from "./lib/dexRewards";
import { newCardPaw, nyangCoinForCard } from "./lib/nyangCoinGrade";
import { cancelDrawReservation, preloadDrawImages, reserveDraw } from "./lib/mockDrawApi";
import { getWithdrawRules } from "./lib/mockWallet";
import { configureNavigationBar, haptic } from "./lib/native";
import { useTossSafeArea } from "./lib/useTossSafeArea";
import { loadOpsConfig } from "./lib/opsConfig";
import {
  buildPawAdRequestId,
  confirmDrawAfterAd,
  grantPawAdReward,
} from "./lib/opsRewards";
import {
  adGroupIdForKind,
  isTossFullScreenAdSupported,
  playTossFullScreenAd,
  preloadTossAds,
} from "./lib/tossAds";
import type { DexCard } from "./lib/dexTypes";
import { highlightRatesFromEconomy, rateUpAdSecondsFromEconomy } from "./lib/drawRates";
import {
  rateUpTicketShopOffer,
  shouldOfferTicketShopOnRateUp,
} from "./lib/mockTicketShop";
import {
  daysSinceInstall,
  nextDrawSlot,
  remainingNormalDraws,
  remainingRateUpDraws,
  remainingTotalDraws,
  willUseRateUpTicket,
} from "./lib/opsState";
import { loadOpsState, saveOpsState } from "./lib/opsStorage";
import type {
  CoachMark,
  DrawReservation,
  FeatureIntro,
  OpsConfig,
  OpsState,
  TutorialStep,
} from "./lib/opsTypes";
import type { MenuSheetId } from "./lib/menuTypes";
import {
  dexAfterClaimMark,
  dexCardBreedLabel,
  dexCardGradeLabel,
  dexClaimCoachMark,
  dexSlotCoachMark,
  getRewardsIntroConfig,
  isNcoinIntroThen,
  mainStepMark,
  ncoinIntroMark,
  ncoinNextMark,
  rewardsIntroMark,
  roomDoneCoachMark,
  roomPickCoachMark,
  roomPointsCoachMark,
  roomPreviewCoachMark,
  step5CoachMark,
  type RewardsTutPhase,
} from "./lib/tutorialFlow";
import type { DexTutorialPhase } from "./screens/DexScreen";
import { DRAW_REVEAL_WAIT_MAX_MS, DrawRevealScreen } from "./screens/DrawRevealScreen";
import { CollectionScreen } from "./screens/CollectionScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { RatesGuideScreen } from "./screens/RatesGuideScreen";
import { RoomScreen, type RoomTutorialPhase } from "./screens/RoomScreen";
import type { Screen } from "./types";
import "./App.css";

type RevealTutPhase = "wait-toast" | "ncoin-intro" | "to-dex";
type RewardsIntroSession = {
  stepId: string;
  replay: boolean;
};

function initialScreen(): Screen {
  if (typeof window === "undefined") return { name: "home" };
  const name = new URLSearchParams(window.location.search).get("screen");
  if (
    name === "collection" ||
    name === "room" ||
    name === "draw" ||
    name === "rates" ||
    name === "reveal"
  ) {
    return { name };
  }
  return { name: "home" };
}

function initialMenuOpen(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("screen") === "menu";
}

type AdSession = {
  kind: MockAdKind;
  purpose: "draw" | "paw" | "attendanceDay7";
  drawId?: string;
  /** Idempotency key for point-ad reward (tossUserKey + requestId). */
  requestId?: string;
  /** sdk = Toss full-screen ad group; mock = browser AdModal fallback. */
  presentation: "sdk" | "mock";
};

type AttendanceDay7AdResult = "completed" | "cancelled" | "failed";

function startAdPresentation(): AdSession["presentation"] {
  return isTossFullScreenAdSupported() ? "sdk" : "mock";
}

export default function App() {
  // Opaque Toss title bar → webview is already below it; sync bottom/side insets.
  useTossSafeArea();

  const [ops, setOps] = useState<OpsState | null>(null);
  const [config, setConfig] = useState<OpsConfig | null>(null);
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [menuOpen, setMenuOpen] = useState(initialMenuOpen);
  const [menuIconDot, setMenuIconDot] = useState(false);
  const [dexClaimDot, setDexClaimDot] = useState(false);
  const [achvOpen, setAchvOpen] = useState(false);
  const [achvConfig, setAchvConfig] = useState<AchvConfig | null>(null);
  const [achvList, setAchvList] = useState<AchvProgress[]>([]);
  const [revealCard, setRevealCard] = useState<DexCard | null>(null);
  const [tutorialReplayStep, setTutorialReplayStep] = useState<number | null>(null);
  const [revealTutPhase, setRevealTutPhase] = useState<RevealTutPhase | null>(null);
  const [hideRevealToast, setHideRevealToast] = useState(false);
  const [rewardsIntro, setRewardsIntro] = useState<RewardsIntroSession | null>(null);
  const [forceMenuSheet, setForceMenuSheet] = useState<MenuSheetId>(null);
  const [stepThenActive, setStepThenActive] = useState(false);
  const [dexTutPhase, setDexTutPhase] = useState<DexTutorialPhase>(null);
  const [roomTutPhase, setRoomTutPhase] = useState<RoomTutorialPhase>(null);
  const [roomScreenReady, setRoomScreenReady] = useState(false);
  const [rewardsTutPhase, setRewardsTutPhase] = useState<RewardsTutPhase>(null);
  const [reduceMotion, setReduceMotion] = useState(() => shouldReduceMenuMotion());
  const menuHistRef = useRef(false);
  const ncoinTimerRef = useRef(0);
  const claimToastTimerRef = useRef(0);
  const rewardsArmedRef = useRef(false);
  const [ad, setAd] = useState<AdSession | null>(null);
  const [reservation, setReservation] = useState<DrawReservation | null>(null);
  const [revealReady, setRevealReady] = useState(false);
  const [waitFailed, setWaitFailed] = useState(false);
  const [revealToast, setRevealToast] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [featureIntro, setFeatureIntro] = useState<FeatureIntro | null>(null);
  const attendanceDay7AdResolverRef = useRef<((result: AttendanceDay7AdResult) => void) | null>(
    null,
  );

  const today = toKstDateKey();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [nextConfig, nextOps] = await Promise.all([loadOpsConfig(), loadOpsState()]);
        if (cancelled) return;
        setConfig(nextConfig);
        setOps(nextOps);
        syncAudioSettingsFromStorage();
        await AudioManager.init();
        AudioManager.installTapCapture();
        preloadTossAds(nextConfig.economy.ads);
      } catch (error) {
        if (!cancelled) {
          setBootError(error instanceof Error ? error.message : "설정을 불러오지 못했어요");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (menuOpen) {
      AudioManager.setScreen("menu");
      return;
    }
    AudioManager.setScreen(screen.name);
  }, [screen.name, menuOpen]);

  useEffect(() => {
    const sync = () => setReduceMotion(shouldReduceMenuMotion());
    sync();
    window.addEventListener(MENU_SETTINGS_EVENT, sync);
    return () => window.removeEventListener(MENU_SETTINGS_EVENT, sync);
  }, []);

  useEffect(() => {
    if (ad) AudioManager.onAdOpen();
    else AudioManager.onAdClose();
  }, [ad]);

  useEffect(() => {
    if (!ops) return;
    let cancelled = false;
    void buildMenuViewModel(ops).then((model) => {
      if (!cancelled) setMenuIconDot(model.menuIconDot);
    });
    void countClaimableDexRewards(ops).then((count) => {
      if (!cancelled) setDexClaimDot(count > 0);
    });
    void (async () => {
      try {
        const cfg = achvConfig ?? (await loadAchievementsConfig());
        if (cancelled) return;
        if (!achvConfig) setAchvConfig(cfg);
        const metrics = await computeAchvMetrics(ops);
        if (cancelled) return;
        setAchvList(buildAchvProgressList(cfg, ops, metrics));
      } catch {
        // achievements optional during boot
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ops, achvConfig]);

  useEffect(() => {
    if (!menuOpen) return;
    if (!menuHistRef.current) {
      window.history.pushState({ menu: true }, "");
      menuHistRef.current = true;
    }
    const onPop = () => {
      menuHistRef.current = false;
      setMenuOpen(false);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [menuOpen]);

  useEffect(() => {
    const openDex = () => setScreen({ name: "collection" });
    const openRewards = () => {
      setScreen({ name: "home" });
      setForceMenuSheet("rewards");
      setMenuOpen(true);
    };
    window.addEventListener("lucky-open-dex", openDex);
    window.addEventListener("lucky-open-rewards", openRewards);
    return () => {
      window.removeEventListener("lucky-open-dex", openDex);
      window.removeEventListener("lucky-open-rewards", openRewards);
    };
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    if (menuHistRef.current) {
      menuHistRef.current = false;
      window.history.back();
    }
  }, []);

  useEffect(() => {
    void configureNavigationBar({
      withBackButton: screen.name !== "home",
    });
  }, [screen]);

  const persistOps = useCallback(async (next: OpsState) => {
    setOps(next);
    await saveOpsState(next);
  }, []);

  const remainingDraws = ops && config ? remainingTotalDraws(ops, config) : 0;
  const remainingNormal = ops && config ? remainingNormalDraws(ops, config) : 0;
  const remainingRateUp = ops && config ? remainingRateUpDraws(ops, config) : 0;
  const rateLabels = config ? highlightRatesFromEconomy(config.economy) : { normalPct: "0%", rateUpPct: "0%" };
  const rateUpAdSeconds = config ? rateUpAdSecondsFromEconomy(config.economy) : 30;
  const offerTicketShop = ops && config ? shouldOfferTicketShopOnRateUp(ops, config) : false;
  const ticketShopPricePaw = config ? rateUpTicketShopOffer(config).pricePaw : 200;

  const tutorialStep: TutorialStep | null = useMemo(() => {
    if (!ops || !config) return null;
    if (tutorialReplayStep != null) {
      return config.tutorial.steps.find((step) => step.step === tutorialReplayStep) ?? null;
    }
    if (ops.tutorialDone) return null;
    return config.tutorial.steps.find((step) => step.step === ops.tutorialStep) ?? null;
  }, [ops, config, tutorialReplayStep]);

  const rewardsIntroConfig = config ? getRewardsIntroConfig(config.tutorial) : null;

  const tutorialCardId = reservation?.cardId ?? revealCard?.id ?? null;
  const tutorialVars = useMemo(() => {
    const paw = config ? newCardPaw(config.economy) : 20;
    const nyangCoin =
      revealCard && config ? nyangCoinForCard(config.economy, revealCard) : 1;
    return {
      cardId: tutorialCardId,
      breed: dexCardBreedLabel(revealCard),
      grade: dexCardGradeLabel(revealCard),
      nyangCoin,
      paw,
    };
  }, [tutorialCardId, revealCard, config]);

  const coachMark: CoachMark | null = useMemo(() => {
    if (!ops || !config) return null;
    const dailyLimit = getWithdrawRules(config.economy).dailyLimit;

    if (rewardsIntro && rewardsIntroConfig) {
      return rewardsIntroMark(rewardsIntroConfig, rewardsIntro.stepId, ops, dailyLimit);
    }

    if (!tutorialStep) return null;
    const vars = tutorialVars;

    if (tutorialStep.step === 2) {
      if (screen.name === "reveal") {
        if (revealTutPhase === "ncoin-intro" && isNcoinIntroThen(tutorialStep.then)) {
          return ncoinIntroMark(tutorialStep.then);
        }
        if (revealTutPhase === "to-dex" && isNcoinIntroThen(tutorialStep.then)) {
          return ncoinNextMark(tutorialStep.then);
        }
        // Wait for toast / ncoin-intro — no coach on the card itself.
        return null;
      }
      // Replay without a live reveal: show ncoin-intro only (no toast / to-dex).
      if (tutorialReplayStep != null && isNcoinIntroThen(tutorialStep.then)) {
        return { ...ncoinIntroMark(tutorialStep.then), target: "#stage-cat" };
      }
      return null;
    }

    // Step 3: scroll → slot → claim → toast → ncoin-after (still STEP 3/4).
    if (tutorialStep.step === 3 && screen.name === "collection") {
      if (dexTutPhase === "scroll" || dexTutPhase === "toast" || dexTutPhase == null) return null;
      if (dexTutPhase === "slot") return dexSlotCoachMark(tutorialStep, vars);
      if (dexTutPhase === "claim") return dexClaimCoachMark(tutorialStep, vars);
      if (dexTutPhase === "ncoin-after") return dexAfterClaimMark(tutorialStep);
    }

    // Step 4: pick → preview(✓) → done (STEP 4/5). Wait until RoomScreen finishes loading.
    if (tutorialStep.step === 4 && screen.name === "room") {
      if (!roomScreenReady) return null;
      if (roomTutPhase === "pick" || roomTutPhase == null) return roomPickCoachMark(tutorialStep);
      if (roomTutPhase === "preview" || roomTutPhase === "drag") return roomPreviewCoachMark(tutorialStep);
      if (roomTutPhase === "done") return roomDoneCoachMark(tutorialStep);
      if (roomTutPhase === "points") return roomPointsCoachMark(tutorialStep);
    }

    // Step 5: menu → rewards row → withdraw sheet (STEP 5/5).
    if (tutorialStep.step === 5) {
      return step5CoachMark(tutorialStep, rewardsTutPhase ?? "menu", ops, dailyLimit);
    }

    if (stepThenActive && tutorialStep.then && !isNcoinIntroThen(tutorialStep.then)) {
      return mainStepMark(tutorialStep, "then", vars);
    }

    return mainStepMark(tutorialStep, "base", vars);
  }, [
    ops,
    config,
    rewardsIntro,
    rewardsIntroConfig,
    tutorialStep,
    screen.name,
    revealTutPhase,
    stepThenActive,
    tutorialReplayStep,
    tutorialVars,
    dexTutPhase,
    roomTutPhase,
    roomScreenReady,
    rewardsTutPhase,
  ]);

  const coachLockDismiss = Boolean(rewardsIntro && rewardsIntroConfig?.lockDismiss);

  // Enter step-2 reveal tutorial: hold toast and wait for #dex-toast.
  useEffect(() => {
    if (!tutorialStep || tutorialStep.step !== 2 || screen.name !== "reveal") {
      if (revealTutPhase != null && screen.name !== "reveal") {
        setRevealTutPhase(null);
        setHideRevealToast(false);
      }
      return;
    }
    if (revealTutPhase == null) {
      setRevealTutPhase("wait-toast");
      setHideRevealToast(false);
    }
  }, [tutorialStep, screen.name, revealTutPhase]);

  // Resume / enter: seed room & rewards tutorial phases from persisted step.
  useEffect(() => {
    if (!tutorialStep) return;
    if (tutorialStep.step === 4 && roomTutPhase == null && screen.name === "room") {
      setRoomTutPhase("pick");
    }
    if (tutorialStep.step === 5 && rewardsTutPhase == null) {
      setRewardsTutPhase("menu");
      if (screen.name !== "home") setScreen({ name: "home" });
    }
  }, [tutorialStep, roomTutPhase, rewardsTutPhase, screen.name]);

  // Reset room-ready gate when leaving the room screen.
  useEffect(() => {
    if (screen.name !== "room") setRoomScreenReady(false);
  }, [screen.name]);

  // Step 5: menu open advances 5-1 → 5-2; rewards sheet advances 5-2 → 5-3.
  useEffect(() => {
    if (!tutorialStep || tutorialStep.step !== 5) return;
    if (rewardsTutPhase === "menu" && menuOpen) {
      setRewardsTutPhase("row");
    }
  }, [tutorialStep, rewardsTutPhase, menuOpen]);

  // Contextual rewards-intro: first of (nyangCoin≥10 from r1) or (open rewards from r3).
  useEffect(() => {
    if (!ops || !config || !rewardsIntroConfig) return;
    if (rewardsIntro) return;
    if (tutorialReplayStep != null) return;
    if (!ops.tutorialDone) return;
    if (ops.tut.rewardsIntro !== "unseen") return;
    if (ad || screen.name === "reveal" || screen.name === "draw") return;
    if (featureIntro) return;
    if (menuOpen) return; // open-rewards trigger handled via onSheetOpen
    if (ops.nyangCoinBalance < 10) return;
    if (rewardsArmedRef.current) return;
    rewardsArmedRef.current = true;
    if (screen.name !== "home") setScreen({ name: "home" });
    setRewardsIntro({ stepId: "r1", replay: false });
  }, [
    ops,
    config,
    rewardsIntroConfig,
    rewardsIntro,
    tutorialReplayStep,
    ad,
    screen.name,
    menuOpen,
    featureIntro,
  ]);

  useEffect(() => {
    if (!ops || !config || !ops.tutorialDone || featureIntro || rewardsIntro) return;
    const day = daysSinceInstall(ops, today);
    const ownedDup = false; // day-5 condition checked lightly; full dup check in dex later
    const candidate = config.tutorial.featureIntros.schedule.find((intro) => {
      if (ops.featureIntrosSeen.includes(intro.id)) return false;
      if (intro.day > day) return false;
      if (intro.condition === "중복 카드 1장 이상" && !ownedDup) return false;
      return true;
    });
    if (candidate) setFeatureIntro(candidate);
  }, [ops, config, today, featureIntro, rewardsIntro]);

  const beginDraw = useCallback(
    async (forceSlot?: "tutorial" | "normal" | "rateUp") => {
      if (!ops || !config) return;
      const slot = forceSlot ?? nextDrawSlot(ops, config);
      if (!slot) {
        nyNotify({
          key: "draw-empty",
          kind: "info",
          title: "오늘 뽑기를 모두 했어요",
          sub: "내일 0시에 다시 만나요",
        });
        return;
      }

      setRevealReady(false);
      setWaitFailed(false);
      setRevealToast(null);

      const reserved = await reserveDraw(ops, { forceSlot: slot });
      await persistOps(reserved.state);
      if (!reserved.reservation) {
        nyNotify({
          key: "draw-reserve-fail",
          kind: "error",
          title: "뽑기를 시작하지 못했어요",
          sub: reserved.error ?? "잠시 후 다시 눌러 주세요",
          action: {
            label: "다시 시도",
            onClick: () => {
              void beginDraw(forceSlot);
            },
          },
        });
        return;
      }

      setReservation(reserved.reservation);
      // Prefetch while the ad plays; the 1.5s wait clock starts when the ad closes.
      void preloadDrawImages(reserved.reservation).then((quality) => {
        if (quality !== "none") setRevealReady(true);
      });

      if (slot === "tutorial" || (slot === "rateUp" && willUseRateUpTicket(ops, config))) {
        // Free / ticket draws: no ad → no ad-draw 냥코인.
        const confirmed = await confirmDrawAfterAd(reserved.state, reserved.reservation.drawId, {
          adCompleted: false,
        });
        if ("error" in confirmed) {
          nyNotify({
            key: "draw-confirm-fail",
            kind: "error",
            title: "연결이 잠시 끊겼어요",
            sub: confirmed.error || "다시 시도해 주세요",
            action: { label: "다시 시도", onClick: () => void beginDraw(forceSlot) },
          });
          return;
        }
        await persistOps(
          slot === "tutorial"
            ? { ...confirmed.state, tutorialStep: Math.max(confirmed.state.tutorialStep, 2) }
            : confirmed.state,
        );
        setReservation(confirmed.reservation);
        setRevealCard(confirmed.card);
        setRevealToast(confirmed.toast);
        if (!confirmed.reservation.isNew) {
          nyNotify({
            key: "draw-dup",
            kind: "info",
            title: "이미 만난 고양이예요",
            sub: "메뉴 › 중복 카드 교환에서 바꿀 수 있어요",
          });
        }
        setRevealReady(true);
        setWaitFailed(false);
        await haptic("success");
        setScreen({ name: "reveal" });
        return;
      }

      setAd({
        kind: slot === "rateUp" ? "long" : "short",
        purpose: "draw",
        drawId: reserved.reservation.drawId,
        presentation: startAdPresentation(),
      });
    },
    [ops, config, persistOps],
  );

  const completeAd = useCallback(async () => {
    if (!ad || !ops) return;
    if (ad.purpose === "attendanceDay7") {
      setAd(null);
      setMenuOpen(true);
      attendanceDay7AdResolverRef.current?.("completed");
      attendanceDay7AdResolverRef.current = null;
      return;
    }
    if (ad.purpose === "paw") {
      const requestId = ad.requestId || buildPawAdRequestId();
      const result = await grantPawAdReward(ops, { requestId });
      setAd(null);
      setMenuOpen(true);
      if ("error" in result) {
        nyNotify({
          key: "paw-ad-fail",
          kind: "error",
          title: "포인트를 받지 못했어요",
          sub: result.error || "네트워크를 확인하고 다시 눌러 주세요",
          action: { label: "다시 시도", onClick: () => setMenuOpen(true) },
        });
        return;
      }
      await persistOps(result.state);
      if (result.adPawNyangCoin > 0) {
        nyNotify({
          key: `ad-paw-ncoin:${requestId}`,
          kind: "reward",
          title:
            result.adPawNotice ??
            `광고를 봐서 냥코인x${result.adPawNyangCoin}이 지급되었습니다.`,
          count: result.adPawNyangCoin,
        });
      }
      nyNotify({
        key: "paw-ad",
        kind: "reward",
        title: `{paw} <b>+${result.gained}</b> 받았어요`,
        sub: "메뉴 › 포인트 받기",
        count: result.gained,
      });
      await haptic("success");
      return;
    }

    if (!ad.drawId) {
      setAd(null);
      return;
    }
    // Ad completed → confirm draw + ad-draw 냥코인 in one server transaction.
    const confirmed = await confirmDrawAfterAd(ops, ad.drawId, { adCompleted: true });
    setAd(null);
    if ("error" in confirmed) {
      nyNotify({
        key: "draw-confirm-fail",
        kind: "error",
        title: "연결이 잠시 끊겼어요",
        sub: confirmed.error || "다시 시도해 주세요",
        action: { label: "다시 시도", onClick: () => void beginDraw() },
      });
      return;
    }
    await persistOps(confirmed.state);
    // Show ad-draw 냥코인 notice before the reveal card.
    if (confirmed.adNyangCoin > 0) {
      nyNotify({
        key: `ad-draw-ncoin:${confirmed.reservation.drawId}`,
        kind: "reward",
        title:
          confirmed.adNyangNotice ??
          `카드를 뽑아 냥코인x${confirmed.adNyangCoin}이 지급되었습니다.`,
        count: confirmed.adNyangCoin,
      });
    }
    setReservation(confirmed.reservation);
    setRevealCard(confirmed.card);
    setRevealToast(confirmed.toast);
    if (!confirmed.reservation.isNew) {
      nyNotify({
        key: "draw-dup",
        kind: "info",
        title: "이미 만난 고양이예요",
        sub: "메뉴 › 중복 카드 교환에서 바꿀 수 있어요",
      });
    }
    // Start the post-ad wait clock now (images may already be decoded).
    if (!revealReady) {
      window.setTimeout(() => {
        setRevealReady((prev) => {
          if (!prev) setWaitFailed(true);
          return prev;
        });
      }, DRAW_REVEAL_WAIT_MAX_MS);
    } else {
      setWaitFailed(false);
    }
    await haptic("success");
    setScreen({ name: "reveal" });
  }, [ad, ops, persistOps, revealReady]);

  const cancelAd = useCallback(async () => {
    if (!ops) {
      setAd(null);
      attendanceDay7AdResolverRef.current?.("cancelled");
      attendanceDay7AdResolverRef.current = null;
      return;
    }
    if (ad?.purpose === "attendanceDay7") {
      setAd(null);
      setMenuOpen(true);
      attendanceDay7AdResolverRef.current?.("cancelled");
      attendanceDay7AdResolverRef.current = null;
      return;
    }
    if (ad?.purpose === "draw") {
      const next = await cancelDrawReservation(ops);
      await persistOps(next);
      setReservation(null);
      nyNotify({
        key: "ad-cancel-draw",
        kind: "error",
        title: "광고를 끝까지 보지 못했어요",
        sub: "뽑기권은 그대로예요",
      });
    }
    setAd(null);
    // Paw ads start with the menu left open; restore it if anything closed it.
    if (ad?.purpose === "paw") setMenuOpen(true);
  }, [ad, ops, persistOps]);

  const runAttendanceDay7Ad = useCallback((): Promise<AttendanceDay7AdResult> => {
    return new Promise((resolve) => {
      attendanceDay7AdResolverRef.current = resolve;
      setAd({
        kind: "long",
        purpose: "attendanceDay7",
        presentation: startAdPresentation(),
      });
    });
  }, []);

  const completeAdRef = useRef(completeAd);
  const cancelAdRef = useRef(cancelAd);
  completeAdRef.current = completeAd;
  cancelAdRef.current = cancelAd;

  /** Play console ad groups in Toss; fall back to AdModal in browser / on failure. */
  useEffect(() => {
    if (!ad || ad.presentation !== "sdk") return;
    const snap = { kind: ad.kind, purpose: ad.purpose, drawId: ad.drawId };
    const groupId = adGroupIdForKind(snap.kind, config?.economy.ads);
    let active = true;
    AudioManager.onAdOpen();
    void playTossFullScreenAd(snap.kind, groupId).then((result) => {
      AudioManager.onAdClose();
      if (!active) return;
      if (result === "completed") {
        void completeAdRef.current();
        return;
      }
      if (result === "cancelled") {
        void cancelAdRef.current();
        return;
      }
      // unsupported / failed → mock modal (browser preview or load miss)
      // For attendance day7: load already retried once inside playTossFullScreenAd;
      // if still failed, resolve as failed so UI can offer [그냥 받기].
      if (result === "failed" && snap.purpose === "attendanceDay7") {
        setAd(null);
        setMenuOpen(true);
        attendanceDay7AdResolverRef.current?.("failed");
        attendanceDay7AdResolverRef.current = null;
        return;
      }
      setAd((prev) => {
        if (!prev || prev.presentation !== "sdk") return prev;
        if (prev.kind !== snap.kind || prev.purpose !== snap.purpose || prev.drawId !== snap.drawId) {
          return prev;
        }
        return { ...prev, presentation: "mock" };
      });
    });
    return () => {
      active = false;
    };
  }, [ad?.presentation, ad?.kind, ad?.purpose, ad?.drawId, config?.economy.ads]);

  const finishRewardsIntro = useCallback(
    async (status: "seen" | "skipped") => {
      const wasReplay = Boolean(rewardsIntro?.replay);
      setRewardsIntro(null);
      setForceMenuSheet(null);
      rewardsArmedRef.current = false;
      if (wasReplay) {
        setScreen({ name: "home" });
        setMenuOpen(false);
        return;
      }
      if (!ops) return;
      await persistOps({
        ...ops,
        tut: { ...ops.tut, rewardsIntro: status },
      });
    },
    [ops, persistOps, rewardsIntro],
  );

  const advanceRewardsIntro = useCallback(async () => {
    if (!rewardsIntro || !rewardsIntroConfig || !ops) return;
    const order = rewardsIntroConfig.steps.map((step) => step.id);
    const index = order.indexOf(rewardsIntro.stepId);
    const current = rewardsIntroConfig.steps[index];
    if (!current) {
      await finishRewardsIntro("seen");
      return;
    }

    if (current.id === "r1") {
      setMenuOpen(true);
      setForceMenuSheet(null);
      setRewardsIntro({ ...rewardsIntro, stepId: "r2" });
      return;
    }
    if (current.id === "r2") {
      setMenuOpen(true);
      setForceMenuSheet("rewards");
      setRewardsIntro({ ...rewardsIntro, stepId: "r3" });
      return;
    }
    if (current.id === "r3") {
      setRewardsIntro({ ...rewardsIntro, stepId: "r4" });
      return;
    }
    await finishRewardsIntro("seen");
  }, [rewardsIntro, rewardsIntroConfig, ops, finishRewardsIntro]);

  const skipTutorial = useCallback(async () => {
    if (rewardsIntro) {
      await finishRewardsIntro("skipped");
      return;
    }
    if (tutorialReplayStep != null) {
      // Skip remaining main steps → still run rewards-intro from r1 (replay).
      setTutorialReplayStep(null);
      setStepThenActive(false);
      setRevealTutPhase(null);
      setHideRevealToast(false);
      setScreen({ name: "home" });
      setMenuOpen(false);
      setForceMenuSheet(null);
      setRewardsIntro({ stepId: "r1", replay: true });
      return;
    }
    if (!ops) return;
    await persistOps({
      ...ops,
      tutorialDone: true,
      tutorialStep: 99,
      tutorialInterruptions: ops.tutorialInterruptions + 1,
      tut: { ...ops.tut, rewardsIntro: "skipped" },
    });
    setRevealTutPhase(null);
    setHideRevealToast(false);
    setStepThenActive(false);
    setDexTutPhase(null);
    setRoomTutPhase(null);
    setRewardsTutPhase(null);
    setMenuOpen(false);
    setForceMenuSheet(null);
    window.clearTimeout(claimToastTimerRef.current);
  }, [ops, persistOps, tutorialReplayStep, rewardsIntro, finishRewardsIntro]);

  const onRevealToastShown = useCallback(() => {
    if (!tutorialStep || tutorialStep.step !== 2) return;
    if (revealTutPhase !== "wait-toast") return;
    if (!isNcoinIntroThen(tutorialStep.then)) {
      setRevealTutPhase("to-dex");
      return;
    }
    const delay = tutorialStep.then.delayAfterToastMs ?? 600;
    window.clearTimeout(ncoinTimerRef.current);
    ncoinTimerRef.current = window.setTimeout(() => {
      setRevealTutPhase("ncoin-intro");
    }, delay);
  }, [tutorialStep, revealTutPhase]);

  const advanceTutorial = useCallback(async () => {
    if (rewardsIntro) {
      await advanceRewardsIntro();
      return;
    }
    if (!ops || !config || !tutorialStep) return;

    // Step 2 phases: ncoin-intro → to-dex → advance to step 3.
    if (tutorialStep.step === 2) {
      const onReveal = screen.name === "reveal";
      const replaying = tutorialReplayStep != null;
      if (replaying && !onReveal) {
        setTutorialReplayStep(3);
        setRevealTutPhase(null);
        setScreen({ name: "collection" });
        return;
      }
      if (onReveal && revealTutPhase === "ncoin-intro") {
        if (isNcoinIntroThen(tutorialStep.then) && tutorialStep.then.dismissToastWithCta) {
          setHideRevealToast(true);
        }
        setRevealTutPhase("to-dex");
        return;
      }
      if (onReveal && revealTutPhase === "to-dex") {
        await persistOps({ ...ops, tutorialStep: 3 });
        setRevealTutPhase(null);
        setHideRevealToast(false);
        setStepThenActive(false);
        setDexTutPhase("scroll");
        setScreen({ name: "collection" });
        return;
      }
      if (onReveal) return;
    }

    // Step 3 substeps: slot CTA → claim spotlight; claim itself is via badge tap.
    if (tutorialStep.step === 3 && screen.name === "collection") {
      if (dexTutPhase === "slot") {
        setDexTutPhase("claim");
        return;
      }
      if (dexTutPhase === "claim") {
        // Waiting for coin badge tap — CTA / dim do not skip the claim.
        return;
      }
      if (dexTutPhase === "toast") return;
      if (dexTutPhase === "ncoin-after") {
        const nextStep = 4;
        if (tutorialReplayStep != null) {
          setTutorialReplayStep(nextStep);
          setDexTutPhase(null);
          setRoomTutPhase("pick");
          setScreen({ name: "room" });
          return;
        }
        await persistOps({ ...ops, tutorialStep: nextStep });
        setDexTutPhase(null);
        setRoomTutPhase("pick");
        setScreen({ name: "room" });
        return;
      }
      return;
    }

    // Step 4: pick/preview via RoomScreen; done → step 5 (tutorial-1.7 has no 4-4 points tip).
    if (tutorialStep.step === 4 && screen.name === "room") {
      if (roomTutPhase === "pick" || roomTutPhase === "preview" || roomTutPhase === "drag") return;
      if (roomTutPhase === "done" || roomTutPhase === "points") {
        if (tutorialReplayStep != null) {
          setTutorialReplayStep(5);
          setRoomTutPhase(null);
          setRewardsTutPhase("menu");
          setStepThenActive(false);
          setMenuOpen(false);
          setForceMenuSheet(null);
          setScreen({ name: "home" });
          return;
        }
        await persistOps({ ...ops, tutorialStep: 5 });
        setRoomTutPhase(null);
        setRewardsTutPhase("menu");
        setStepThenActive(false);
        setMenuOpen(false);
        setForceMenuSheet(null);
        setScreen({ name: "home" });
        return;
      }
      return;
    }

    // Step 5: 5-1/5-2 advance via menu taps; 5-3 CTA finishes tutorial.
    if (tutorialStep.step === 5) {
      if (rewardsTutPhase === "menu" || rewardsTutPhase === "row") return;
      if (rewardsTutPhase === "sheet") {
        if (tutorialReplayStep != null) {
          setTutorialReplayStep(null);
          setRewardsTutPhase(null);
          setStepThenActive(false);
          setMenuOpen(false);
          setForceMenuSheet(null);
          setScreen({ name: "home" });
          return;
        }
        await persistOps({
          ...ops,
          tutorialDone: true,
          tutorialStep: 5,
          tut: { ...ops.tut, rewardsIntro: "seen" },
        });
        setRewardsTutPhase(null);
        setStepThenActive(false);
        setMenuOpen(false);
        setForceMenuSheet(null);
        setScreen({ name: "home" });
        return;
      }
      return;
    }

    // Replay: walk steps with no rewards / no state mutation of tutorialDone.
    if (tutorialReplayStep != null) {
      if (tutorialStep.step === 3) {
        setDexTutPhase("scroll");
        setScreen({ name: "collection" });
        return;
      }
      if (tutorialStep.step === 4) {
        setRoomTutPhase("pick");
        setScreen({ name: "room" });
        return;
      }
      if (tutorialStep.step === 5) {
        setRewardsTutPhase("menu");
        setMenuOpen(false);
        setForceMenuSheet(null);
        setScreen({ name: "home" });
        return;
      }
      if (
        tutorialStep.then &&
        !isNcoinIntroThen(tutorialStep.then) &&
        !stepThenActive &&
        tutorialStep.step !== 2
      ) {
        setStepThenActive(true);
        if (tutorialStep.screen.includes("dex") || tutorialStep.then.screen === "dex") {
          setScreen({ name: "collection" });
        }
        return;
      }
      if (tutorialStep.complete || tutorialStep.step >= config.tutorial.steps.length) {
        setTutorialReplayStep(null);
        setStepThenActive(false);
        setDexTutPhase(null);
        setRoomTutPhase(null);
        setRewardsTutPhase(null);
        setScreen({ name: "home" });
        setMenuOpen(false);
        setForceMenuSheet(null);
        return;
      }
      const nextStep = tutorialStep.step + 1;
      setTutorialReplayStep(nextStep);
      setStepThenActive(false);
      setDexTutPhase(nextStep === 3 ? "scroll" : null);
      setRoomTutPhase(nextStep === 4 ? "pick" : null);
      setRewardsTutPhase(nextStep === 5 ? "menu" : null);
      setRevealTutPhase(nextStep === 2 ? "ncoin-intro" : null);
      if (nextStep === 3 || tutorialStep.screen.includes("dex")) setScreen({ name: "collection" });
      else if (tutorialStep.screen === "room" || nextStep === 4) setScreen({ name: "room" });
      else if (nextStep === 5 || tutorialStep.screen === "main" || tutorialStep.screen === "draw-reveal") {
        setScreen({ name: "home" });
      }
      return;
    }

    if (tutorialStep.step === 1) {
      await beginDraw("tutorial");
      return;
    }

    if (
      tutorialStep.then &&
      !isNcoinIntroThen(tutorialStep.then) &&
      !stepThenActive &&
      tutorialStep.step !== 3
    ) {
      setStepThenActive(true);
      if (tutorialStep.screen.includes("dex") || tutorialStep.then.screen === "dex") {
        setScreen({ name: "collection" });
      }
      return;
    }

    if (tutorialStep.complete || tutorialStep.step >= config.tutorial.steps.length) {
      await persistOps({
        ...ops,
        tutorialDone: true,
        tutorialStep: tutorialStep.step,
        tut:
          tutorialStep.step >= 5
            ? { ...ops.tut, rewardsIntro: "seen" }
            : ops.tut,
      });
      setStepThenActive(false);
      setDexTutPhase(null);
      setRoomTutPhase(null);
      setRewardsTutPhase(null);
      setScreen({ name: "home" });
      return;
    }
    const nextStep = tutorialStep.step + 1;
    const next = config.tutorial.steps.find((step) => step.step === nextStep);
    await persistOps({ ...ops, tutorialStep: nextStep });
    setStepThenActive(false);
    setDexTutPhase(nextStep === 3 ? "scroll" : null);
    setRoomTutPhase(nextStep === 4 ? "pick" : null);
    setRewardsTutPhase(nextStep === 5 ? "menu" : null);
    if (next?.screen === "room") setScreen({ name: "room" });
    else if (next?.screen.includes("dex") || tutorialStep.screen.includes("dex")) {
      setScreen({ name: "collection" });
    } else if (next?.screen === "main" || next?.screen === "draw-reveal" || nextStep === 5) {
      setScreen({ name: "home" });
    }
  }, [
    ops,
    config,
    tutorialStep,
    tutorialReplayStep,
    tutorialCardId,
    beginDraw,
    persistOps,
    rewardsIntro,
    advanceRewardsIntro,
    screen.name,
    revealTutPhase,
    stepThenActive,
    dexTutPhase,
    roomTutPhase,
    rewardsTutPhase,
  ]);

  if (bootError) {
    return (
      <div className="boot-error">
        <p>설정을 불러오지 못했어요.</p>
        <small>{bootError}</small>
      </div>
    );
  }

  if (!ops || !config) {
    return (
      <div className="boot-error">
        <p>럭키캣</p>
        <small>화면을 불러오는 중이에요.</small>
      </div>
    );
  }

  return (
    <>
      {screen.name === "rates" ? <RatesGuideScreen onBack={() => setScreen({ name: "home" })} /> : null}

      {screen.name === "collection" ? (
        <CollectionScreen
          onBack={() => {
            // Only block during active tutorial step 3 — leftover dexTutPhase
            // from "도감 보기" must not trap the back button forever.
            const tutStep3 =
              tutorialReplayStep === 3 ||
              Boolean(ops && !ops.tutorialDone && ops.tutorialStep === 3);
            if (dexTutPhase && tutStep3) return;
            setDexTutPhase(null);
            setScreen({ name: "home" });
          }}
          ops={ops}
          onOpsChange={(next) => void persistOps(next)}
          floatingToast={
            ops && !ops.tutorialDone && ops.tutorialStep === 3 && dexTutPhase === "scroll"
              ? revealToast
              : null
          }
          focusCardId={
            tutorialStep?.step === 3 || tutorialReplayStep === 3 ? tutorialCardId : null
          }
          tutorialPhase={
            tutorialStep?.step === 3 || tutorialReplayStep === 3 ? dexTutPhase : null
          }
          reduceMotion={reduceMotion}
          onTutorialScrollDone={() => {
            if (dexTutPhase === "scroll") setDexTutPhase("slot");
          }}
          onTutorialClaimed={() => {
            if (dexTutPhase !== "claim") return;
            setDexTutPhase("toast");
            window.clearTimeout(claimToastTimerRef.current);
            claimToastTimerRef.current = window.setTimeout(() => {
              setDexTutPhase("ncoin-after");
            }, 900);
          }}
        />
      ) : null}

      {screen.name === "room" ? (
        <RoomScreen
          onBack={() => {
            if (roomTutPhase) return;
            setScreen({ name: "home" });
          }}
          tutorialActive={Boolean(
            tutorialStep?.screen === "room" &&
              (tutorialReplayStep != null || (ops && !ops.tutorialDone)),
          )}
          tutorialPhase={
            tutorialStep?.step === 4 || tutorialReplayStep === 4 ? roomTutPhase : null
          }
          suggestTile={tutorialStep?.screen === "room" ? (tutorialStep.suggestTile ?? null) : null}
          reduceMotion={reduceMotion}
          onReady={() => setRoomScreenReady(true)}
          onTutorialPicked={() => {
            if (roomTutPhase === "pick") setRoomTutPhase("preview");
          }}
          onTutorialPlaced={() => {
            if (roomTutPhase === "pick" || roomTutPhase === "preview" || roomTutPhase === "drag") {
              setRoomTutPhase("done");
            }
          }}
          onTutorialComplete={() => {
            if (roomTutPhase === "done" || roomTutPhase === "points") void advanceTutorial();
          }}
        />
      ) : null}

      {screen.name === "reveal" && reservation ? (
        <DrawRevealScreen
          reservation={reservation}
          card={revealCard}
          ready={revealReady && !waitFailed}
          waitFailed={waitFailed && !revealReady}
          toastText={revealToast}
          remainingDraws={remainingDraws}
          holdToast={
            Boolean(
              tutorialStep?.step === 2 &&
                (revealTutPhase === "wait-toast" || revealTutPhase === "ncoin-intro"),
            )
          }
          hideToast={hideRevealToast}
          onToastShown={onRevealToastShown}
          onToDex={() => {
            void (async () => {
              if (tutorialReplayStep != null && tutorialReplayStep === 2) {
                setTutorialReplayStep(3);
                setRevealTutPhase(null);
                setHideRevealToast(false);
                setStepThenActive(false);
                setDexTutPhase("scroll");
                setScreen({ name: "collection" });
                return;
              }
              const enterDexTutorial =
                ops.tutorialStep === 2 && !ops.tutorialDone && tutorialReplayStep == null;
              if (enterDexTutorial) {
                await persistOps({ ...ops, tutorialStep: 3 });
              }
              setRevealTutPhase(null);
              setHideRevealToast(false);
              setStepThenActive(false);
              // Only start dex tutorial phase when still in the tutorial flow.
              setDexTutPhase(enterDexTutorial ? "scroll" : null);
              setScreen({ name: "collection" });
            })();
          }}
          onDrawAgain={() => {
            setScreen({ name: "home" });
            void beginDraw();
          }}
          onRetry={() => {
            if (!reservation) return;
            void preloadDrawImages(reservation).then((quality) => {
              if (quality === "none") {
                setWaitFailed(true);
                return;
              }
              setRevealReady(true);
              setWaitFailed(false);
            });
          }}
          onBack={() => {
            // Leave reveal without consuming further tutorial gates.
            setRevealTutPhase(null);
            setHideRevealToast(false);
            setStepThenActive(false);
            setScreen({ name: "home" });
          }}
        />
      ) : null}

      {screen.name === "home" || screen.name === "draw" ? (
        <HomeScreen
          remainingNormal={remainingNormal}
          normalPerDay={config.economy.draws.normalPerDay}
          remainingRateUp={remainingRateUp}
          rateUpTickets={ops.rateUpTickets}
          useRateUpTicket={willUseRateUpTicket(ops, config)}
          rateUpAdSeconds={rateUpAdSeconds}
          offerTicketShop={offerTicketShop}
          ticketShopPricePaw={ticketShopPricePaw}
          firstDrawPending={ops.normalDrawsUsed === 0}
          rateNormalPct={rateLabels.normalPct}
          rateUpPct={rateLabels.rateUpPct}
          menuBadge={menuIconDot}
          dexBadge={dexClaimDot}
          titleRibbon={{
            equippedId: ops.equippedTitleId || null,
            equippedName:
              achvList.find((item) => item.def.id === ops.equippedTitleId)?.def.title ?? null,
            emptyCopy: EMPTY_RIBBON_COPY,
            hasClaimable: claimableAchvCount(achvList) > 0,
          }}
          onDraw={() => void beginDraw()}
          onRateUpDraw={() => void beginDraw("rateUp")}
          onOpenTicketShop={() => {
            setForceMenuSheet("ticketShop");
            setMenuOpen(true);
          }}
          onOpenMenu={() => setMenuOpen(true)}
          onOpenCollection={() => setScreen({ name: "collection" })}
          onOpenRoom={() => setScreen({ name: "room" })}
          onOpenTitles={() => setAchvOpen(true)}
        />
      ) : null}

      <MenuPanel
        open={menuOpen}
        ops={ops}
        onClose={closeMenu}
        onOpsChange={(next) => void persistOps(next)}
        onOpenDex={() => setScreen({ name: "collection" })}
        onOpenRoom={() => setScreen({ name: "room" })}
        onPawAd={() => {
          // Keep the menu open under the ad so we return to it afterward.
          setAd({
            kind: "short",
            purpose: "paw",
            requestId: buildPawAdRequestId(),
            presentation: startAdPresentation(),
          });
        }}
        onAttendanceDay7Ad={() => runAttendanceDay7Ad()}
        onRateUpDraw={() => {
          closeMenu();
          void beginDraw("rateUp");
        }}
        onReplayTutorial={() => {
          closeMenu();
          setScreen({ name: "home" });
          setStepThenActive(false);
          setRevealTutPhase(null);
          setHideRevealToast(false);
          setRewardsIntro(null);
          setRewardsTutPhase(null);
          setRoomTutPhase(null);
          setDexTutPhase(null);
          setForceMenuSheet(null);
          setTutorialReplayStep(1);
        }}
        onDevResetNewUser={() => {
          setTutorialReplayStep(null);
          setFeatureIntro(null);
          setRewardsIntro(null);
          setRewardsTutPhase(null);
          setRoomTutPhase(null);
          setDexTutPhase(null);
          setForceMenuSheet(null);
          setRevealTutPhase(null);
          setMenuOpen(false);
          setScreen({ name: "home" });
        }}
        forceSheet={forceMenuSheet}
        lockDismiss={coachLockDismiss}
        onSheetOpen={(id) => {
          if (forceMenuSheet && id === forceMenuSheet) {
            setForceMenuSheet(null);
          }
          // Main tutorial step 5-2 → 5-3.
          if (
            id === "rewards" &&
            tutorialStep?.step === 5 &&
            (rewardsTutPhase === "row" || rewardsTutPhase === "menu")
          ) {
            setRewardsTutPhase("sheet");
            return;
          }
          if (id !== "rewards" || !ops || !rewardsIntroConfig) return;
          if (rewardsIntro) return;
          if (tutorialReplayStep != null) return;
          if (!ops.tutorialDone) return;
          if (ops.tut.rewardsIntro !== "unseen") return;
          if (ad || screen.name === "reveal") return;
          // First open of rewards box — start from r3 (if ≥10 trigger hasn't fired yet).
          rewardsArmedRef.current = true;
          setMenuOpen(true);
          setForceMenuSheet("rewards");
          setRewardsIntro({ stepId: "r3", replay: false });
        }}
      />

      {achvOpen ? (
        <AchievementsSheet
          ops={ops}
          onOpsChange={(next) => void persistOps(next)}
          onClose={() => setAchvOpen(false)}
        />
      ) : null}

      <AdModal
        open={ad !== null && ad.presentation === "mock"}
        kind={ad?.kind ?? "short"}
        onComplete={() => void completeAd()}
        onCancel={() => void cancelAd()}
      />

      {coachMark &&
      (rewardsIntro ||
        (tutorialStep &&
          ((screen.name === "home" && tutorialStep.screen === "main") ||
            (tutorialStep.step === 5 && (screen.name === "home" || menuOpen)) ||
            (screen.name === "reveal" && tutorialStep.screen === "draw-reveal") ||
            (screen.name === "collection" && tutorialStep.screen.includes("dex")) ||
            (screen.name === "room" && tutorialStep.screen === "room" && roomScreenReady) ||
            (tutorialReplayStep != null &&
              (screen.name === "home" ||
                screen.name === "collection" ||
                (screen.name === "room" && roomScreenReady) ||
                screen.name === "reveal" ||
                menuOpen))))) ? (
        <TutorialCoach
          mark={coachMark}
          onSkip={() => void skipTutorial()}
          onAdvance={() => void advanceTutorial()}
        />
      ) : null}

      {featureIntro ? (
        <FeatureIntroBubble
          intro={featureIntro}
          onDismiss={() => {
            void persistOps({
              ...ops,
              featureIntrosSeen: [...ops.featureIntrosSeen, featureIntro.id],
            });
            setFeatureIntro(null);
          }}
        />
      ) : null}

      <NyangNotifyHost />
    </>
  );
}
