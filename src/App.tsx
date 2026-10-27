import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AudioManager } from "./audio/AudioManager";
import { AchievementsSheet } from "./components/AchievementsSheet";
import { AdIntro } from "./components/AdIntro";
import { AdModal } from "./components/AdModal";
import { NyangNotifyHost } from "./components/NyangNotifyHost";
import { ServerSaveDebug } from "./components/ServerSaveDebug";
import { nyConfirm, nyDismiss, nyNotify } from "./lib/nyangNotify";
import { AttendanceNotifyCard } from "./components/AttendanceNotifyCard";
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
import { adPlacementOf, track } from "./lib/analytics";
import { toKstDateKey } from "./lib/date";
import { refreshServerTime } from "./lib/tossClock";
import { isTossApp } from "./lib/tossEnv";
import { ensureGameUserHash } from "./lib/user";
import { installServerSaveLifecycle, syncGameSaveOnBoot } from "./lib/serverSave";
import { buildMenuViewModel } from "./lib/menuModel";
import {
  MENU_SETTINGS_EVENT,
  shouldReduceMenuMotion,
  syncAudioSettingsFromStorage,
} from "./lib/menuSettings";
import type { MockAdKind } from "./lib/mockAds";
import { newCardPaw, nyangCoinForCard } from "./lib/nyangCoinGrade";
import { cancelDrawReservation, preloadDrawImages, reserveDraw } from "./lib/mockDrawApi";
import { getWithdrawRules } from "./lib/mockWallet";
import { configureNavigationBar, haptic, isInTossApp } from "./lib/native";
import { isOffline } from "./lib/network";
import { useTossSafeArea } from "./lib/useTossSafeArea";
import { isWeekendDoublePaw, loadOpsConfig } from "./lib/opsConfig";
import { josa } from "./lib/josa";
import { readDay7BonusConfig } from "./lib/attendanceServer";
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
  drawAgainLabel,
  nextDrawKind,
  nextDrawSlot,
  remainingNormalDraws,
  remainingRateUpDraws,
  remainingTotalDraws,
  willUseRateUpTicket,
} from "./lib/opsState";
import { loadOpsState, saveOpsState } from "./lib/opsStorage";
import { clearPromoUrl, readPromoTarget, type PromoTarget } from "./lib/promoEntry";
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
  revealDexButtonMark,
  rewardsIntroMark,
  roomDoneCoachMark,
  roomPickCoachMark,
  roomPointsCoachMark,
  roomPreviewCoachMark,
  step5CoachMark,
  tutorialStepLabel,
  withTutorialProgress,
  type RewardsTutPhase,
} from "./lib/tutorialFlow";
import type { DexTutorialPhase } from "./screens/DexScreen";
import { DrawRevealScreen } from "./screens/DrawRevealScreen";
import { preloadFrameAssets } from "./lib/preloadFrames";

const DRAW_LOADING_MESSAGES = ["카드를 섞는 중이냥...", "거의 다 됐다냥!", "하암~ 곧 일어날게냥"];
import { preloadAdFallbackCat, preloadLoadingAssets } from "./lib/preloadLoading";
import { setLoadingBlocked, useLoadingHold } from "./lib/loadingGate";
import { DevBackButton } from "./components/DevBackButton";
import { useAttendanceNotifyOffer } from "./lib/useAttendanceNotifyOffer";
import { useBackHandler } from "./hooks/useBackHandler";
import { useExitConfirmOnBack } from "./hooks/useExitConfirmOnBack";
import { CollectionScreen } from "./screens/CollectionScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { RatesGuideScreen } from "./screens/RatesGuideScreen";
import { RoomErrorBoundary } from "./components/RoomErrorBoundary";
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
  if (readPromoTarget() === "dex") return { name: "collection" };
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
  if (readPromoTarget() === "rewards") return true;
  return new URLSearchParams(window.location.search).get("screen") === "menu";
}

function initialForceSheet(): MenuSheetId {
  return readPromoTarget() === "rewards" ? "rewards" : null;
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

type AttendanceDay7AdResult = "completed" | "cancelled" | "failed" | "offline";

function startAdPresentation(): AdSession["presentation"] {
  return isTossFullScreenAdSupported() ? "sdk" : "mock";
}

function notifyAdOffline() {
  nyNotify({
    key: "ad-offline",
    kind: "error",
    title: "인터넷 연결을 확인해 주세요",
  });
}

function adRetryLabel(kind: AdSession["kind"]): string {
  return kind === "long" ? "30초 광고 보고 다시 시도" : "짧은 광고 보고 다시 시도";
}

function takeOnce(seen: Set<string>, key: string): boolean {
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}

function trackConfirmedDraw(reservation: DrawReservation) {
  const kind =
    reservation.slot === "tutorial"
      ? "tutorial"
      : reservation.slot === "rateUp"
        ? reservation.usedAd
          ? "rateUpAd"
          : "ticket"
        : "normal";
  track("draw", {
    kind,
    grade: reservation.rarity,
    is_new: reservation.isNew,
  });
}

function adSessionKey(session: AdSession): string {
  return session.drawId || session.requestId || `${session.purpose}:${session.kind}`;
}

function pawAdDetail(config: OpsConfig): string {
  const base = config.economy.pawSources.rewardedAd.pawPerAd;
  const multiplier = isWeekendDoublePaw(config.economy)
    ? config.economy.events.weekendDoublePaw.multiplier
    : 1;
  const paw = base * multiplier;
  const ncoin = config.economy.ncoinSources?.adPaw ?? 1;
  return `광고를 끝까지 보면 냥코인 ${ncoin}개와 젤리\u00A0${paw}${josa(String(paw), "을를")} 받아요`;
}

function day7AdDetail(config: OpsConfig, ticketsFull: boolean): string {
  const bonus = readDay7BonusConfig(config);
  if (!bonus) return "광고를 끝까지 보면 2배 보상과 뽑기권을 받아요";
  const ncoin = bonus.adBonus.nyangCoin;
  const paw = bonus.adBonus.paw;
  if (ticketsFull) {
    return `광고를 끝까지 보면 냥코인 ${ncoin}개와 젤리\u00A0${paw}${josa(String(paw), "을를")} 받아요`;
  }
  return `광고를 끝까지 보면 냥코인 ${ncoin}개, 젤리\u00A0${paw}, 뽑기권 1장을 받아요`;
}

export default function App() {
  // Opaque Toss title bar → webview is already below it; sync bottom/side insets.
  useTossSafeArea();

  const [ops, setOps] = useState<OpsState | null>(null);
  const [config, setConfig] = useState<OpsConfig | null>(null);
  const [screen, setScreenState] = useState<Screen>(initialScreen);
  const screenNameRef = useRef(initialScreen.name);
  const setScreen = useCallback((next: Screen) => {
    if (screenNameRef.current !== next.name) {
      nyDismiss();
      screenNameRef.current = next.name;
    }
    setScreenState(next);
  }, []);
  const [menuOpen, setMenuOpen] = useState(initialMenuOpen);
  const [menuIconDot, setMenuIconDot] = useState(false);
  const [dexClaimDot, setDexClaimDot] = useState(false);
  const [achvOpen, setAchvOpen] = useState(false);
  const [achvConfig, setAchvConfig] = useState<AchvConfig | null>(null);
  const [achvList, setAchvList] = useState<AchvProgress[]>([]);
  const [revealCard, setRevealCard] = useState<DexCard | null>(null);
  const [tutorialReplayStep, setTutorialReplayStep] = useState<number | null>(null);
  const [revealTutPhase, setRevealTutPhase] = useState<RevealTutPhase | null>(null);
  const [revealSpotlight, setRevealSpotlight] = useState(false);
  const [hideRevealToast, setHideRevealToast] = useState(false);
  const [rewardsIntro, setRewardsIntro] = useState<RewardsIntroSession | null>(null);
  const attendanceNotifyBlocked = Boolean(
    (ops && !ops.tutorialDone) || tutorialReplayStep != null || rewardsIntro,
  );
  const attendanceNotifyOffer = useAttendanceNotifyOffer(attendanceNotifyBlocked);
  const [forceMenuSheet, setForceMenuSheet] = useState<MenuSheetId>(initialForceSheet);
  const promoTargetRef = useRef<PromoTarget | null>(readPromoTarget());
  const [promoGate, setPromoGate] = useState<PromoTarget | null>(promoTargetRef.current);
  const [promoHoldIntros, setPromoHoldIntros] = useState(false);
  const [promoRewardsBack, setPromoRewardsBack] = useState(false);
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
  const [adIntro, setAdIntro] = useState<{
    token: number;
    session: AdSession;
    headline: string;
    detail: string;
  } | null>(null);
  const adIntroTokenRef = useRef(0);
  /** True from the moment an intro is queued until the ad session is cleared. */
  const adFlowRef = useRef(false);
  /** Dream-fallback sheet is open; keep the draw/paw reservation until the user chooses. */
  const adFallbackPendingRef = useRef(false);
  const adFallbackTokenRef = useRef(0);
  const liveAdRef = useRef<AdSession | null>(null);
  const trackedDrawIdsRef = useRef(new Set<string>());
  const trackedAdRewardRef = useRef(new Set<string>());
  const earlyCloseKeyRef = useRef<string | null>(null);
  const tutorialStepTrackedRef = useRef<number | null>(null);
  const tutorialCompleteTrackedRef = useRef(false);
  const tutorialSkipTrackedRef = useRef(false);
  const drawLockRef = useRef(false);
  const noteTutorialStep = useCallback((step: number) => {
    if (tutorialStepTrackedRef.current === step) return;
    tutorialStepTrackedRef.current = step;
    track("tutorial_step", { step });
  }, []);
  const noteTutorialComplete = useCallback(() => {
    if (tutorialCompleteTrackedRef.current) return;
    tutorialCompleteTrackedRef.current = true;
    track("tutorial_complete");
  }, []);
  const noteTutorialSkip = useCallback((step: number) => {
    if (tutorialSkipTrackedRef.current) return;
    tutorialSkipTrackedRef.current = true;
    track("tutorial_skip", { step });
  }, []);
  const [reservation, setReservation] = useState<DrawReservation | null>(null);
  const [revealReady, setRevealReady] = useState(false);
  const [waitFailed, setWaitFailed] = useState(false);
  const [drawBusy, setDrawBusy] = useState(false);
  const [drawProgress, setDrawProgress] = useState<number | undefined>(undefined);
  const [revealToast, setRevealToast] = useState<string | null>(null);
  const [adNyangToast, setAdNyangToast] = useState<string | null>(null);
  const [dexFocusCardId, setDexFocusCardId] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [featureIntro, setFeatureIntro] = useState<FeatureIntro | null>(null);
  const attendanceDay7AdResolverRef = useRef<((result: AttendanceDay7AdResult) => void) | null>(
    null,
  );

  const today = toKstDateKey();

  useEffect(() => {
    preloadLoadingAssets();
    preloadFrameAssets();
    preloadAdFallbackCat();
  }, []);

  useEffect(() => {
    installServerSaveLifecycle();
    let cancelled = false;
    void (async () => {
      try {
        await syncGameSaveOnBoot();
        if (cancelled) return;
        const [, nextConfig, nextOps] = await Promise.all([
          refreshServerTime(),
          loadOpsConfig(),
          loadOpsState(),
        ]);
        if (isTossApp()) void ensureGameUserHash();
        if (cancelled) return;
        setConfig(nextConfig);
        setOps(nextOps);
        if (promoTargetRef.current && !nextOps.tutorialDone) {
          setScreen({ name: "home" });
          setMenuOpen(false);
          setForceMenuSheet(null);
        }
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
  }, [setScreen]);

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
      if (cancelled) return;
      setMenuIconDot(model.menuIconDot);
      setDexClaimDot(model.rewards.unseenCount > 0);
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
    if (!ops?.tutorialDone || !promoGate || tutorialReplayStep != null) return;
    const target = promoGate;
    // Tutorial completion sets home/menu in the same turn as tutorialDone.
    // Apply the destination after that cleanup so it is not overwritten.
    const timer = window.setTimeout(() => {
      clearPromoUrl();
      setPromoGate(null);
      setPromoHoldIntros(true);
      if (target === "dex") {
        setPromoRewardsBack(false);
        setMenuOpen(false);
        setForceMenuSheet(null);
        setScreen({ name: "collection" });
        return;
      }
      setScreen({ name: "home" });
      setForceMenuSheet("rewards");
      setMenuOpen(true);
      setPromoRewardsBack(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [ops, promoGate, tutorialReplayStep, setScreen]);

  useEffect(() => {
    if (!promoHoldIntros) return;
    const atDex = screen.name === "collection";
    const atRewards = screen.name === "home" && menuOpen;
    if (atDex || atRewards) return;
    setPromoHoldIntros(false);
  }, [promoHoldIntros, screen.name, menuOpen]);

  useEffect(() => {
    if (!menuOpen || promoGate) return;
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
  }, [menuOpen, promoGate]);

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
  }, [setScreen]);

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

  const queueAd = useCallback((session: AdSession, detail: string) => {
    const token = adIntroTokenRef.current + 1;
    adIntroTokenRef.current = token;
    adFlowRef.current = true;
    liveAdRef.current = session;
    setAdIntro({
      token,
      session,
      headline: session.kind === "long" ? "30초 광고를 볼까요?" : "짧은 광고를 볼까요?",
      detail,
    });
    track("ad_intro_show", {
      placement: adPlacementOf(session),
      ad_length: session.kind,
    });
  }, []);

  const confirmAdIntro = useCallback(() => {
    const current = adIntro;
    if (!current || adIntroTokenRef.current !== current.token) return;
    adIntroTokenRef.current = current.token + 1;
    setAdIntro(null);
    setAd(current.session);
    track("ad_intro_confirm", {
      placement: adPlacementOf(current.session),
      ad_length: current.session.kind,
    });
  }, [adIntro]);

  useEffect(() => {
    if (!ad && !adIntro && !adFallbackPendingRef.current) adFlowRef.current = false;
  }, [ad, adIntro]);

  const cancelAdIntro = useCallback(async () => {
    const current = adIntro;
    if (!current || adIntroTokenRef.current !== current.token) return;
    adIntroTokenRef.current = current.token + 1;
    adFlowRef.current = false;
    setAdIntro(null);
    liveAdRef.current = null;
    track("ad_intro_cancel", {
      placement: adPlacementOf(current.session),
      ad_length: current.session.kind,
    });
    if (current.session.purpose === "attendanceDay7") {
      setMenuOpen(true);
      attendanceDay7AdResolverRef.current?.("cancelled");
      attendanceDay7AdResolverRef.current = null;
      return;
    }
    if (current.session.purpose === "draw") {
      if (ops) {
        const next = await cancelDrawReservation(ops);
        await persistOps(next);
      }
      setReservation(null);
      nyNotify({
        key: "ad-intro-cancel-draw",
        kind: "info",
        title: "광고를 취소했어요",
        sub: "뽑기권은 그대로예요",
      });
      return;
    }
    if (current.session.purpose === "paw") setMenuOpen(true);
  }, [adIntro, ops, persistOps]);

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
          return withTutorialProgress(ncoinIntroMark(tutorialStep.then));
        }
        if (revealTutPhase === "to-dex") {
          if (isNcoinIntroThen(tutorialStep.then)) {
            const next = ncoinNextMark(tutorialStep.then);
            if (next) return withTutorialProgress(next);
          }
          return withTutorialProgress(
            revealDexButtonMark(
              tutorialStepLabel(tutorialStep, "STEP 2"),
              tutorialStep.copy,
            ),
          );
        }
        // Card is still turning — wait for the toast before the shade.
        return null;
      }
      // Replay without a live reveal: show ncoin-intro only (no toast / to-dex).
      if (tutorialReplayStep != null && isNcoinIntroThen(tutorialStep.then)) {
        return { ...ncoinIntroMark(tutorialStep.then), target: "#stage-cat" };
      }
      return null;
    }

    // Step 3: scroll → slot (3-1) → claim (3-2) → ncoin (3-3).
    // Stay quiet until the dex is on screen so a missing base target cannot throw.
    if (tutorialStep.step === 3) {
      if (screen.name !== "collection") return null;
      if (dexTutPhase === "scroll" || dexTutPhase === "toast" || dexTutPhase == null) return null;
      if (dexTutPhase === "slot") return withTutorialProgress(dexSlotCoachMark(tutorialStep, vars));
      if (dexTutPhase === "claim") return withTutorialProgress(dexClaimCoachMark(tutorialStep, vars));
      if (dexTutPhase === "ncoin-after") return withTutorialProgress(dexAfterClaimMark(tutorialStep));
      return null;
    }

    // Step 4: pick (4-1) → preview (4-2) → done (4-3). Wait until RoomScreen finishes loading.
    if (tutorialStep.step === 4) {
      if (screen.name !== "room" || !roomScreenReady) return null;
      if (roomTutPhase === "pick" || roomTutPhase == null) return withTutorialProgress(roomPickCoachMark(tutorialStep));
      if (roomTutPhase === "preview" || roomTutPhase === "drag") return withTutorialProgress(roomPreviewCoachMark(tutorialStep));
      if (roomTutPhase === "done") return withTutorialProgress(roomDoneCoachMark(tutorialStep));
      if (roomTutPhase === "points") return withTutorialProgress(roomPointsCoachMark(tutorialStep));
      return null;
    }

    // Step 5: menu (5-1) → rewards row (5-2) → withdraw sheet (5-3).
    if (tutorialStep.step === 5) {
      return withTutorialProgress(step5CoachMark(tutorialStep, rewardsTutPhase ?? "menu", ops, dailyLimit));
    }

    if (stepThenActive && tutorialStep.then && !isNcoinIntroThen(tutorialStep.then)) {
      return mainStepMark(tutorialStep, "then", vars);
    }

    return withTutorialProgress(mainStepMark(tutorialStep, "base", vars));
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
  }, [tutorialStep, roomTutPhase, rewardsTutPhase, screen.name, setScreen]);

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
    if (promoGate || promoHoldIntros) return;
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
    promoGate,
    promoHoldIntros,
    ad,
    screen.name,
    menuOpen,
    featureIntro,
    setScreen,
  ]);

  useEffect(() => {
    if (!ops || !config || !ops.tutorialDone || featureIntro || rewardsIntro) return;
    if (promoGate || promoHoldIntros) return;
    const day = daysSinceInstall(ops, today);
    const ownedDup = false; // day-5 condition checked lightly; full dup check in dex later
    const candidate = config.tutorial.featureIntros.schedule.find((intro) => {
      if (ops.featureIntrosSeen.includes(intro.id)) return false;
      if (intro.day > day) return false;
      if (intro.condition === "중복 카드 1장 이상" && !ownedDup) return false;
      return true;
    });
    if (candidate) setFeatureIntro(candidate);
  }, [ops, config, today, featureIntro, rewardsIntro, promoGate, promoHoldIntros]);

  const beginDraw = useCallback(
    async (forceSlot?: "tutorial" | "normal" | "rateUp") => {
      if (!ops || !config) return;
      if (drawLockRef.current || adFlowRef.current) return;
      drawLockRef.current = true;
      const slot = forceSlot ?? nextDrawSlot(ops, config);
      if (!slot) {
        drawLockRef.current = false;
        nyNotify({
          key: "draw-empty",
          kind: "info",
          title: "오늘 뽑기를 모두 했어요",
          sub: "내일 0시에 다시 만나요",
        });
        return;
      }
      const needsAd = !(slot === "tutorial" || (slot === "rateUp" && willUseRateUpTicket(ops, config)));
      if (needsAd && (await isOffline())) {
        drawLockRef.current = false;
        notifyAdOffline();
        return;
      }

      setRevealReady(false);
      setWaitFailed(false);
      setRevealToast(null);
      setDrawProgress(undefined);
      setDrawBusy(true);

      const reserved = await reserveDraw(ops, { forceSlot: slot });
      await persistOps(reserved.state);
      if (!reserved.reservation) {
        setDrawBusy(false);
        drawLockRef.current = false;
        nyNotify({
          key: "draw-reserve-fail",
          kind: "error",
          title: "뽑기를 시작하지 못했어요",
          sub: reserved.error ?? "잠시 후 다시 눌러 주세요",
          action: {
            label: needsAd ? adRetryLabel(slot === "rateUp" ? "long" : "short") : "다시 시도",
            onClick: () => {
              void beginDraw(forceSlot);
            },
          },
        });
        return;
      }

      setReservation(reserved.reservation);
      // Decode the large art and this grade's frame while the ad plays.
      setDrawProgress(0);
      void preloadDrawImages(reserved.reservation, (progress) => setDrawProgress(progress)).then(
        (quality) => {
          if (quality === "none") {
            setWaitFailed(true);
            return;
          }
          setWaitFailed(false);
          setRevealReady(true);
        },
      );

      if (slot === "tutorial" || (slot === "rateUp" && willUseRateUpTicket(ops, config))) {
        // Free / ticket draws: no ad → no ad-draw 냥코인.
        const confirmed = await confirmDrawAfterAd(reserved.state, reserved.reservation.drawId, {
          adCompleted: false,
        });
        if ("error" in confirmed) {
          setDrawBusy(false);
          drawLockRef.current = false;
          nyNotify({
            key: "draw-confirm-fail",
            kind: "error",
            title: "연결이 잠시 끊겼어요",
            sub: confirmed.error || "다시 시도해 주세요",
            action: { label: "다시 시도", onClick: () => void beginDraw(forceSlot) },
          });
          return;
        }
        const persisted =
          slot === "tutorial"
            ? { ...confirmed.state, tutorialStep: Math.max(confirmed.state.tutorialStep, 2) }
            : confirmed.state;
        await persistOps(persisted);
        if (slot === "tutorial" && persisted.tutorialStep !== reserved.state.tutorialStep) {
          noteTutorialStep(persisted.tutorialStep);
        }
        if (takeOnce(trackedDrawIdsRef.current, confirmed.reservation.drawId)) {
          trackConfirmedDraw(confirmed.reservation);
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
        setAdNyangToast(null);
        await haptic("success");
        setScreen({ name: "reveal" });
        drawLockRef.current = false;
        return;
      }

      setDrawBusy(false);
      queueAd(
        {
          kind: slot === "rateUp" ? "long" : "short",
          purpose: "draw",
          drawId: reserved.reservation.drawId,
          presentation: startAdPresentation(),
        },
        slot === "rateUp"
          ? "광고를 끝까지 보면 확률업으로 카드를 뽑아요"
          : "광고를 끝까지 보면 카드를 뽑아요",
      );
      drawLockRef.current = false;
    },
    [ops, config, persistOps, setScreen, queueAd, noteTutorialStep],
  );

  useEffect(() => {
    if (revealReady || waitFailed) setDrawBusy(false);
  }, [revealReady, waitFailed]);

  const completeAd = useCallback(async () => {
    if (!ad || !ops) return;
    const session = ad;
    const rewardKey = adSessionKey(session);
    earlyCloseKeyRef.current = rewardKey;
    liveAdRef.current = null;
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
          title: "젤리를 받지 못했어요",
          sub: result.error || "네트워크를 확인하고 다시 눌러 주세요",
          action: { label: "다시 시도", onClick: () => setMenuOpen(true) },
        });
        return;
      }
      await persistOps(result.state);
      if (takeOnce(trackedAdRewardRef.current, rewardKey)) {
        track("ad_complete", {
          placement: adPlacementOf(session),
          ad_length: session.kind,
        });
        track("jelly_ad_reward", { amount: result.gained });
      }
      if (result.adPawNyangCoin > 0) {
        nyNotify({
          key: `ad-paw-ncoin:${requestId}`,
          kind: "reward",
          title:
            result.adPawNotice ??
            `광고를 봐서 냥코인 ${result.adPawNyangCoin}개를 받았어요`,
          count: result.adPawNyangCoin,
        });
      }
      nyNotify({
        key: "paw-ad",
        kind: "reward",
        title: `{paw} <b>+${result.gained}</b> 받았어요`,
        sub: "메뉴 › 보상 받기",
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
    const retryLabel = adRetryLabel(ad.kind);
    const confirmed = await confirmDrawAfterAd(ops, ad.drawId, { adCompleted: true });
    setAd(null);
    if ("error" in confirmed) {
      nyNotify({
        key: "draw-confirm-fail",
        kind: "error",
        title: "연결이 잠시 끊겼어요",
        sub: confirmed.error || "다시 시도해 주세요",
        action: { label: retryLabel, onClick: () => void beginDraw() },
      });
      return;
    }
    await persistOps(confirmed.state);
    if (takeOnce(trackedAdRewardRef.current, rewardKey)) {
      track("ad_complete", {
        placement: adPlacementOf(session),
        ad_length: session.kind,
      });
    }
    if (takeOnce(trackedDrawIdsRef.current, confirmed.reservation.drawId)) {
      trackConfirmedDraw(confirmed.reservation);
    }
    // Ad-draw 냥코인 toast lives on #card-reveal only (overlay does not grant again).
    setAdNyangToast(
      confirmed.adNyangCoin > 0
        ? (confirmed.adNyangNotice ??
            `카드를 뽑아 냥코인 ${confirmed.adNyangCoin}개를 받았어요`)
        : null,
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
    await haptic("success");
    setScreen({ name: "reveal" });
  }, [ad, ops, persistOps, setScreen]);

  const abandonAd = useCallback(
    async (purpose: AdSession["purpose"]) => {
      const session = liveAdRef.current;
      if (session && session.purpose === purpose) {
        const key = adSessionKey(session);
        if (earlyCloseKeyRef.current !== key) {
          earlyCloseKeyRef.current = key;
          track("ad_close_early", {
            placement: adPlacementOf(session),
            ad_length: session.kind,
          });
        }
      }
      liveAdRef.current = null;
      if (!ops) {
        setAd(null);
        if (purpose === "attendanceDay7") {
          attendanceDay7AdResolverRef.current?.("cancelled");
          attendanceDay7AdResolverRef.current = null;
        }
        return;
      }
      if (purpose === "attendanceDay7") {
        setAd(null);
        setMenuOpen(true);
        attendanceDay7AdResolverRef.current?.("cancelled");
        attendanceDay7AdResolverRef.current = null;
        return;
      }
      if (purpose === "draw") {
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
      if (purpose === "paw") setMenuOpen(true);
    },
    [ops, persistOps],
  );

  const cancelAd = useCallback(async () => {
    if (!ad) {
      setAd(null);
      return;
    }
    await abandonAd(ad.purpose);
  }, [ad, abandonAd]);

  const runAttendanceDay7Ad = useCallback((): Promise<AttendanceDay7AdResult> => {
    return new Promise((resolve) => {
      void (async () => {
        if (await isOffline()) {
          resolve("offline");
          return;
        }
        attendanceDay7AdResolverRef.current = resolve;
        const maxHold = config?.economy.tickets?.rateUpTicket?.maxHold ?? 3;
        const ticketsFull = (ops?.rateUpTickets ?? 0) >= maxHold;
        queueAd(
          {
            kind: "long",
            purpose: "attendanceDay7",
            presentation: startAdPresentation(),
          },
          config
            ? day7AdDetail(config, ticketsFull)
            : "광고를 끝까지 보면 2배 보상과 뽑기권을 받아요",
        );
      })();
    });
  }, [config, ops, queueAd]);

  const completeAdRef = useRef(completeAd);
  const cancelAdRef = useRef(cancelAd);
  const abandonAdRef = useRef(abandonAd);
  completeAdRef.current = completeAd;
  cancelAdRef.current = cancelAd;
  abandonAdRef.current = abandonAd;

  const releaseOfflineAdRef = useRef<(purpose: AdSession["purpose"]) => void>(() => undefined);
  releaseOfflineAdRef.current = (purpose) => {
    if (purpose === "attendanceDay7") {
      setAd(null);
      setMenuOpen(true);
      attendanceDay7AdResolverRef.current?.("offline");
      attendanceDay7AdResolverRef.current = null;
      return;
    }
    if (purpose === "draw" && ops) {
      void cancelDrawReservation(ops).then((next) => persistOps(next));
      setReservation(null);
    }
    notifyAdOffline();
    setAd(null);
    if (purpose === "paw") setMenuOpen(true);
  };

  /** Play console ad groups in Toss. Mock AdModal only after two online load misses. */
  useEffect(() => {
    if (!ad || ad.presentation !== "sdk") return;
    const snap = {
      kind: ad.kind,
      purpose: ad.purpose,
      drawId: ad.drawId,
      requestId: ad.requestId,
    };
    const groupId = adGroupIdForKind(snap.kind, config?.economy.ads);
    let active = true;
    AudioManager.onAdOpen();
    void playTossFullScreenAd(snap.kind, groupId, (attempt, online) => {
      if (!active) return;
      track("ad_load_fail", {
        placement: adPlacementOf(snap),
        attempt,
        online,
      });
    }).then((result) => {
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
      if (result === "offline") {
        releaseOfflineAdRef.current(snap.purpose);
        return;
      }
      // Two online load misses. Day 7 offers [그냥 받기] instead of the fallback ad.
      if (result === "failed" && snap.purpose === "attendanceDay7") {
        setAd(null);
        setMenuOpen(true);
        attendanceDay7AdResolverRef.current?.("failed");
        attendanceDay7AdResolverRef.current = null;
        return;
      }
      if (result !== "failed") {
        if (snap.purpose === "attendanceDay7") {
          setMenuOpen(true);
          attendanceDay7AdResolverRef.current?.("cancelled");
          attendanceDay7AdResolverRef.current = null;
        }
        setAd(null);
        return;
      }
      // Two online load misses. Ask before opening the dream fallback screen.
      setAd(null);
      adFallbackPendingRef.current = true;
      adFlowRef.current = true;
      const token = adFallbackTokenRef.current + 1;
      adFallbackTokenRef.current = token;
      void (async () => {
        const ok = await nyConfirm({
          key: "ad-fallback",
          title: "광고를 불러오지 못했어요",
          body: "대신 짧은 안내 화면을 보고 보상을 받을 수 있어요",
          confirmLabel: "안내 화면 보기",
          cancelLabel: "취소",
        });
        if (adFallbackTokenRef.current !== token) return;
        adFallbackPendingRef.current = false;
        if (!ok) {
          adFlowRef.current = false;
          await abandonAdRef.current(snap.purpose);
          return;
        }
        adFlowRef.current = true;
        const fallbackSession: AdSession = {
          kind: snap.kind,
          purpose: snap.purpose,
          drawId: snap.drawId,
          requestId: snap.requestId,
          presentation: "mock",
        };
        liveAdRef.current = fallbackSession;
        earlyCloseKeyRef.current = null;
        track("ad_fallback_show", { placement: adPlacementOf(snap) });
        setAd(fallbackSession);
      })();
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
    [ops, persistOps, rewardsIntro, setScreen],
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
    const skippedStep = ops.tutorialStep;
    await persistOps({
      ...ops,
      tutorialDone: true,
      tutorialStep: 99,
      tutorialInterruptions: ops.tutorialInterruptions + 1,
      tut: { ...ops.tut, rewardsIntro: "skipped" },
    });
    noteTutorialSkip(skippedStep);
    setRevealTutPhase(null);
    setHideRevealToast(false);
    setStepThenActive(false);
    setDexTutPhase(null);
    setRoomTutPhase(null);
    setRewardsTutPhase(null);
    setMenuOpen(false);
    setForceMenuSheet(null);
    window.clearTimeout(claimToastTimerRef.current);
  }, [ops, persistOps, tutorialReplayStep, rewardsIntro, finishRewardsIntro, setScreen, noteTutorialSkip]);

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
        noteTutorialStep(3);
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
        noteTutorialStep(3);
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
          noteTutorialStep(nextStep);
          setDexTutPhase(null);
          setRoomTutPhase("pick");
          setScreen({ name: "room" });
          return;
        }
        await persistOps({ ...ops, tutorialStep: nextStep });
        noteTutorialStep(nextStep);
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
          noteTutorialStep(5);
          setRoomTutPhase(null);
          setRewardsTutPhase("menu");
          setStepThenActive(false);
          setMenuOpen(false);
          setForceMenuSheet(null);
          setScreen({ name: "home" });
          return;
        }
        await persistOps({ ...ops, tutorialStep: 5 });
        noteTutorialStep(5);
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
        noteTutorialComplete();
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
      noteTutorialStep(nextStep);
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
      noteTutorialComplete();
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
    noteTutorialStep(nextStep);
    setStepThenActive(false);
    setDexTutPhase(nextStep === 3 ? "scroll" : null);
    setRoomTutPhase(nextStep === 4 ? "pick" : null);
    setRewardsTutPhase(nextStep === 5 ? "menu" : null);
    if (next?.screen.includes("room")) setScreen({ name: "room" });
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
    noteTutorialStep,
    noteTutorialComplete,
    rewardsIntro,
    advanceRewardsIntro,
    screen.name,
    setScreen,
    revealTutPhase,
    stepThenActive,
    dexTutPhase,
    roomTutPhase,
    rewardsTutPhase,
  ]);

  const booting = !bootError && (!ops || !config);
  // First-draw tutorial stays on the reveal scene. The loading window would cover its copy.
  const tutorialDraw = Boolean(
    tutorialReplayStep === 1 ||
      tutorialReplayStep === 2 ||
      (ops && !ops.tutorialDone && ops.tutorialStep <= 2),
  );
  const drawLoading =
    !booting &&
    !ad &&
    !tutorialDraw &&
    (drawBusy ||
      (screen.name === "reveal" && Boolean(reservation) && !revealReady && !waitFailed));
  useLoadingHold("boot", booting);
  useLoadingHold("draw", drawLoading, drawProgress, DRAW_LOADING_MESSAGES);
  // The dream window sits above the coach and swallows taps. Keep it off for the whole tutorial.
  const tutorialLive = Boolean((ops && !ops.tutorialDone) || tutorialReplayStep != null);
  useEffect(() => {
    setLoadingBlocked(tutorialLive);
    return () => setLoadingBlocked(false);
  }, [tutorialLive]);
  const onDexTutorialScrollDone = useCallback(() => {
    setDexTutPhase((phase) => (phase === "scroll" ? "slot" : phase));
  }, []);

  const leaveDex = useCallback(() => {
    const tutStep3 =
      tutorialReplayStep === 3 || Boolean(ops && !ops.tutorialDone && ops.tutorialStep === 3);
    if (dexTutPhase && tutStep3) return;
    setDexTutPhase(null);
    setDexFocusCardId(null);
    setScreen({ name: "home" });
  }, [tutorialReplayStep, ops, dexTutPhase, setScreen]);

  const leaveRoom = useCallback(() => {
    if (roomTutPhase) return;
    setScreen({ name: "home" });
  }, [roomTutPhase, setScreen]);

  // Home only. Menu, sheets, and sub-screens register their own back handlers.
  const adFallbackOpen = Boolean(ad && ad.presentation === "mock");
  const isMainScreen =
    !booting && !bootError && screen.name === "home" && !menuOpen && !adFallbackOpen && !adIntro;
  const { modal: exitModal } = useExitConfirmOnBack(isMainScreen);
  useBackHandler(promoRewardsBack && menuOpen, () => {
    setPromoRewardsBack(false);
    setForceMenuSheet(null);
    closeMenu();
  }, 21);
  useBackHandler(
    adFallbackOpen,
    () => {
      void cancelAd();
    },
    25,
  );
  useBackHandler(
    Boolean(featureIntro),
    () => {
      if (!featureIntro || !ops) return;
      void persistOps({
        ...ops,
        featureIntrosSeen: [...ops.featureIntrosSeen, featureIntro.id],
      });
      setFeatureIntro(null);
    },
    30,
  );
  const showDevBack =
    import.meta.env.DEV &&
    !isInTossApp() &&
    (screen.name !== "home" ||
      menuOpen ||
      achvOpen ||
      Boolean(featureIntro) ||
      adFallbackOpen ||
      Boolean(adIntro));

  if (bootError) {
    return (
      <div className="boot-error">
        <p>설정을 불러오지 못했어요.</p>
        <small>{bootError}</small>
      </div>
    );
  }

  if (!ops || !config) {
    return <div className="boot-error" />;
  }

  return (
    <>
      {screen.name === "rates" ? <RatesGuideScreen onBack={() => setScreen({ name: "home" })} /> : null}

      {screen.name === "collection" ? (
        <CollectionScreen
          onBack={leaveDex}
          ops={ops}
          onOpsChange={(next) => void persistOps(next)}
          floatingToast={
            ops && !ops.tutorialDone && ops.tutorialStep === 3 && dexTutPhase === "scroll"
              ? revealToast
              : null
          }
          focusCardId={
            tutorialStep?.step === 3 || tutorialReplayStep === 3
              ? tutorialCardId
              : dexFocusCardId
          }
          tutorialPhase={
            tutorialStep?.step === 3 || tutorialReplayStep === 3 ? dexTutPhase : null
          }
          reduceMotion={reduceMotion}
          onTutorialScrollDone={onDexTutorialScrollDone}
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
        <RoomErrorBoundary onHome={leaveRoom}>
        <RoomScreen
          onBack={leaveRoom}
          tutorialActive={Boolean(
            (tutorialStep?.step === 4 || tutorialReplayStep === 4) &&
              (tutorialReplayStep != null || (ops && !ops.tutorialDone)),
          )}
          tutorialPhase={
            tutorialStep?.step === 4 || tutorialReplayStep === 4 ? roomTutPhase : null
          }
          suggestTile={
            tutorialStep?.step === 4 || tutorialReplayStep === 4
              ? (tutorialStep?.suggestTile ?? null)
              : null
          }
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
        </RoomErrorBoundary>
      ) : null}

      {screen.name === "reveal" && reservation ? (
        <DrawRevealScreen
          reservation={reservation}
          card={revealCard}
          ready={revealReady && !waitFailed}
          waitFailed={waitFailed && !revealReady}
          toastText={revealToast}
          adNyangToast={adNyangToast}
          remainingDraws={remainingDraws}
          againLabel={drawAgainLabel(nextDrawKind(ops, config))}
          holdToast={tutorialStep?.step === 2}
          hideToast={hideRevealToast || revealTutPhase === "to-dex"}
          onToastShown={onRevealToastShown}
          onSpotlightChange={setRevealSpotlight}
          onToDex={() => {
            void (async () => {
              if (tutorialReplayStep != null && tutorialReplayStep === 2) {
                setTutorialReplayStep(3);
                noteTutorialStep(3);
                setRevealTutPhase(null);
                setHideRevealToast(false);
                setAdNyangToast(null);
                setStepThenActive(false);
                setDexTutPhase("scroll");
                setDexFocusCardId(reservation.cardId);
                setScreen({ name: "collection" });
                return;
              }
              const enterDexTutorial =
                ops.tutorialStep === 2 && !ops.tutorialDone && tutorialReplayStep == null;
              if (enterDexTutorial) {
                await persistOps({ ...ops, tutorialStep: 3 });
                noteTutorialStep(3);
              }
              setRevealTutPhase(null);
              setHideRevealToast(false);
              setAdNyangToast(null);
              setStepThenActive(false);
              setDexFocusCardId(reservation.cardId);
              // Only start dex tutorial phase when still in the tutorial flow.
              setDexTutPhase(enterDexTutorial ? "scroll" : null);
              setScreen({ name: "collection" });
            })();
          }}
          onDrawAgain={() => {
            setAdNyangToast(null);
            setScreen({ name: "home" });
            void beginDraw();
          }}
          onRetry={() => {
            if (!reservation) return;
            setWaitFailed(false);
            setRevealReady(false);
            setDrawProgress(0);
            void preloadDrawImages(reservation, (progress) => setDrawProgress(progress)).then(
              (quality) => {
                if (quality === "none") {
                  setWaitFailed(true);
                  return;
                }
                setRevealReady(true);
                setWaitFailed(false);
              },
            );
          }}
          onBack={() => {
            // Leave reveal without consuming further tutorial gates.
            setRevealTutPhase(null);
            setHideRevealToast(false);
            setAdNyangToast(null);
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
          nextDrawKind={nextDrawKind(ops, config)}
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
          void (async () => {
            if (await isOffline()) {
              notifyAdOffline();
              return;
            }
            queueAd(
              {
                kind: "short",
                purpose: "paw",
                requestId: buildPawAdRequestId(),
                presentation: startAdPresentation(),
              },
              pawAdDetail(config),
            );
          })();
        }}
        onAttendanceDay7Ad={() => runAttendanceDay7Ad()}
        onAttendanceRewarded={attendanceNotifyOffer.offerAfterReward}
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

      <AdIntro
        open={adIntro !== null}
        headline={adIntro?.headline ?? ""}
        detail={adIntro?.detail ?? ""}
        onConfirm={confirmAdIntro}
        onCancel={() => void cancelAdIntro()}
      />

      <AdModal
        open={ad !== null && ad.presentation === "mock"}
        kind={ad?.kind ?? "short"}
        onComplete={() => void completeAd()}
        onCancel={() => void cancelAd()}
      />

      {coachMark &&
      !revealSpotlight &&
      (rewardsIntro ||
        (tutorialStep &&
          ((screen.name === "home" && tutorialStep.screen === "main") ||
            (tutorialStep.step === 5 && (screen.name === "home" || menuOpen)) ||
            (screen.name === "reveal" && tutorialStep.screen === "draw-reveal") ||
            (screen.name === "collection" && tutorialStep.screen.includes("dex")) ||
            (screen.name === "room" && tutorialStep.screen.includes("room") && roomScreenReady) ||
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

      {attendanceNotifyOffer.open ? (
        <AttendanceNotifyCard onClose={attendanceNotifyOffer.dismiss} />
      ) : null}

      <NyangNotifyHost dock={menuOpen && !attendanceNotifyOffer.open ? "bottom" : "top"} />
      <ServerSaveDebug />
      {showDevBack ? <DevBackButton /> : null}
      {exitModal}
    </>
  );
}
