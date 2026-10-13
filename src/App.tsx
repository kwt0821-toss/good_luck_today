import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AudioManager } from "./audio/AudioManager";
import { AdModal } from "./components/AdModal";
import { MenuPanel } from "./components/MenuPanel";
import { FeatureIntroBubble, TutorialCoach } from "./components/TutorialCoach";
import { toKstDateKey } from "./lib/date";
import { buildMenuViewModel } from "./lib/menuModel";
import {
  MENU_SETTINGS_EVENT,
  shouldReduceMenuMotion,
  syncAudioSettingsFromStorage,
} from "./lib/menuSettings";
import type { MockAdKind } from "./lib/mockAds";
import { countClaimableDexRewards } from "./lib/dexRewards";
import { cancelDrawReservation, preloadDrawImages, reserveDraw } from "./lib/mockDrawApi";
import { configureNavigationBar, haptic } from "./lib/native";
import { loadOpsConfig } from "./lib/opsConfig";
import {
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
  remainingRateUpAdSlots,
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
  roomDragCoachMark,
  roomPickCoachMark,
  roomPointsCoachMark,
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
  purpose: "draw" | "paw";
  drawId?: string;
  /** sdk = Toss full-screen ad group; mock = browser AdModal fallback. */
  presentation: "sdk" | "mock";
};

function startAdPresentation(): AdSession["presentation"] {
  return isTossFullScreenAdSupported() ? "sdk" : "mock";
}

export default function App() {
  const [ops, setOps] = useState<OpsState | null>(null);
  const [config, setConfig] = useState<OpsConfig | null>(null);
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [menuOpen, setMenuOpen] = useState(initialMenuOpen);
  const [menuIconDot, setMenuIconDot] = useState(false);
  const [dexClaimDot, setDexClaimDot] = useState(false);
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
  const [localToast, setLocalToast] = useState<string | null>(null);

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
    return () => {
      cancelled = true;
    };
  }, [ops]);

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

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    if (menuHistRef.current) {
      menuHistRef.current = false;
      window.history.back();
    }
  }, []);

  useEffect(() => {
    void configureNavigationBar({
      withBackButton: screen.name !== "home" && screen.name !== "reveal",
    });
  }, [screen]);

  const persistOps = useCallback(async (next: OpsState) => {
    setOps(next);
    await saveOpsState(next);
  }, []);

  const remainingDraws = ops && config ? remainingTotalDraws(ops, config) : 0;
  const remainingNormal = ops && config ? remainingNormalDraws(ops, config) : 0;
  const remainingRateUp = ops && config ? remainingRateUpDraws(ops, config) : 0;
  const rateUpAdSlots = ops && config ? remainingRateUpAdSlots(ops, config) : 0;
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
  const tutorialVars = useMemo(
    () => ({
      cardId: tutorialCardId,
      breed: dexCardBreedLabel(revealCard),
      grade: dexCardGradeLabel(revealCard),
    }),
    [tutorialCardId, revealCard],
  );

  const coachMark: CoachMark | null = useMemo(() => {
    if (!ops || !config) return null;

    if (rewardsIntro && rewardsIntroConfig) {
      return rewardsIntroMark(rewardsIntroConfig, rewardsIntro.stepId, ops);
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

    // Step 4: pick → drag → done → points (STEP 4/5). Wait until RoomScreen finishes loading.
    if (tutorialStep.step === 4 && screen.name === "room") {
      if (!roomScreenReady) return null;
      if (roomTutPhase === "pick" || roomTutPhase == null) return roomPickCoachMark(tutorialStep);
      if (roomTutPhase === "drag") return roomDragCoachMark(tutorialStep);
      if (roomTutPhase === "done") return roomDoneCoachMark(tutorialStep);
      if (roomTutPhase === "points") return roomPointsCoachMark(tutorialStep);
    }

    // Step 5: menu → rewards row → withdraw sheet (STEP 5/5).
    if (tutorialStep.step === 5) {
      return step5CoachMark(tutorialStep, rewardsTutPhase ?? "menu", ops);
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
        setLocalToast("내일 또 만나요");
        window.setTimeout(() => setLocalToast(null), 1800);
        return;
      }

      setRevealReady(false);
      setWaitFailed(false);
      setRevealToast(null);

      const reserved = await reserveDraw(ops, { forceSlot: slot });
      await persistOps(reserved.state);
      if (!reserved.reservation) {
        setLocalToast(reserved.error ?? "뽑기를 시작하지 못했어요");
        window.setTimeout(() => setLocalToast(null), 1800);
        return;
      }

      setReservation(reserved.reservation);
      // Prefetch while the ad plays; the 1.5s wait clock starts when the ad closes.
      void preloadDrawImages(reserved.reservation).then((quality) => {
        if (quality !== "none") setRevealReady(true);
      });

      if (slot === "tutorial" || (slot === "rateUp" && willUseRateUpTicket(ops, config))) {
        const confirmed = await confirmDrawAfterAd(reserved.state, reserved.reservation.drawId);
        if ("error" in confirmed) {
          setLocalToast(confirmed.error);
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
    if (ad.purpose === "paw") {
      const result = await grantPawAdReward(ops);
      setAd(null);
      if ("error" in result) {
        setLocalToast(result.error);
        return;
      }
      await persistOps(result.state);
      AudioManager.playSfx("reward-coin");
      setLocalToast(`포인트 +${result.gained}`);
      window.setTimeout(() => setLocalToast(null), 1800);
      await haptic("success");
      return;
    }

    if (!ad.drawId) {
      setAd(null);
      return;
    }
    const confirmed = await confirmDrawAfterAd(ops, ad.drawId);
    setAd(null);
    if ("error" in confirmed) {
      setLocalToast(confirmed.error);
      return;
    }
    await persistOps(confirmed.state);
    setReservation(confirmed.reservation);
    setRevealCard(confirmed.card);
    setRevealToast(confirmed.toast);
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
      return;
    }
    if (ad?.purpose === "draw") {
      const next = await cancelDrawReservation(ops);
      await persistOps(next);
      setReservation(null);
    }
    setAd(null);
  }, [ad, ops, persistOps]);

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

    // Step 4: pick/drag via RoomScreen; done → points tip → step 5 (rewards guide).
    if (tutorialStep.step === 4 && screen.name === "room") {
      if (roomTutPhase === "pick" || roomTutPhase === "drag") return;
      if (roomTutPhase === "done") {
        setRoomTutPhase("points");
        return;
      }
      if (roomTutPhase === "points") {
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
            if (dexTutPhase) return;
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
            if (roomTutPhase === "pick") setRoomTutPhase("drag");
          }}
          onTutorialPlaced={() => {
            if (roomTutPhase === "pick" || roomTutPhase === "drag") setRoomTutPhase("done");
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
              if (ops.tutorialStep === 2 && !ops.tutorialDone && tutorialReplayStep == null) {
                await persistOps({ ...ops, tutorialStep: 3 });
              }
              setRevealTutPhase(null);
              setHideRevealToast(false);
              setStepThenActive(false);
              setDexTutPhase("scroll");
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
        />
      ) : null}

      {screen.name === "home" || screen.name === "draw" ? (
        <HomeScreen
          remainingNormal={remainingNormal}
          normalPerDay={config.economy.draws.normalPerDay}
          remainingRateUp={remainingRateUp}
          rateUpTickets={ops.rateUpTickets}
          useRateUpTicket={willUseRateUpTicket(ops, config) || (rateUpAdSlots <= 0 && ops.rateUpTickets > 0)}
          rateUpAdSeconds={rateUpAdSeconds}
          offerTicketShop={offerTicketShop}
          ticketShopPricePaw={ticketShopPricePaw}
          firstDrawPending={ops.normalDrawsUsed === 0}
          rateNormalPct={rateLabels.normalPct}
          rateUpPct={rateLabels.rateUpPct}
          menuBadge={menuIconDot}
          dexBadge={dexClaimDot}
          onDraw={() => void beginDraw()}
          onRateUpDraw={() => void beginDraw("rateUp")}
          onOpenTicketShop={() => {
            setForceMenuSheet("ticketShop");
            setMenuOpen(true);
          }}
          onOpenMenu={() => setMenuOpen(true)}
          onOpenCollection={() => setScreen({ name: "collection" })}
          onOpenRoom={() => setScreen({ name: "room" })}
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
          closeMenu();
          setAd({ kind: "short", purpose: "paw", presentation: startAdPresentation() });
        }}
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

      {localToast ? (
        <div className="local-toast" role="status">
          {localToast}
        </div>
      ) : null}
    </>
  );
}
