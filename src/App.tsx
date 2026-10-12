import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AudioManager } from "./audio/AudioManager";
import { AdModal } from "./components/AdModal";
import { MenuPanel } from "./components/MenuPanel";
import { FeatureIntroBubble, TutorialCoach } from "./components/TutorialCoach";
import { toKstDateKey } from "./lib/date";
import { buildMenuViewModel } from "./lib/menuModel";
import { syncAudioSettingsFromStorage } from "./lib/menuSettings";
import type { MockAdKind } from "./lib/mockAds";
import { cancelDrawReservation, preloadDrawImages, reserveDraw } from "./lib/mockDrawApi";
import { configureNavigationBar, haptic } from "./lib/native";
import { loadOpsConfig } from "./lib/opsConfig";
import {
  confirmDrawAfterAd,
  grantPawAdReward,
} from "./lib/opsRewards";
import {
  daysSinceInstall,
  nextDrawSlot,
  remainingPawAds,
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
  getRewardsIntroConfig,
  isNcoinIntroThen,
  mainStepMark,
  ncoinIntroMark,
  ncoinNextMark,
  rewardsIntroMark,
} from "./lib/tutorialFlow";
import { DRAW_REVEAL_WAIT_MAX_MS, DrawRevealScreen } from "./screens/DrawRevealScreen";
import { CollectionScreen } from "./screens/CollectionScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { RatesGuideScreen } from "./screens/RatesGuideScreen";
import { RoomScreen } from "./screens/RoomScreen";
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
};

export default function App() {
  const [ops, setOps] = useState<OpsState | null>(null);
  const [config, setConfig] = useState<OpsConfig | null>(null);
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [menuOpen, setMenuOpen] = useState(initialMenuOpen);
  const [menuIconDot, setMenuIconDot] = useState(false);
  const [tutorialReplayStep, setTutorialReplayStep] = useState<number | null>(null);
  const [revealTutPhase, setRevealTutPhase] = useState<RevealTutPhase | null>(null);
  const [hideRevealToast, setHideRevealToast] = useState(false);
  const [rewardsIntro, setRewardsIntro] = useState<RewardsIntroSession | null>(null);
  const [forceMenuSheet, setForceMenuSheet] = useState<MenuSheetId>(null);
  const [stepThenActive, setStepThenActive] = useState(false);
  const menuHistRef = useRef(false);
  const ncoinTimerRef = useRef(0);
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
    if (ad) AudioManager.onAdOpen();
    else AudioManager.onAdClose();
  }, [ad]);

  useEffect(() => {
    if (!ops) return;
    let cancelled = false;
    void buildMenuViewModel(ops).then((model) => {
      if (!cancelled) setMenuIconDot(model.menuIconDot);
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
  const remainingRateUp = ops && config ? remainingRateUpDraws(ops, config) : 0;
  const pawAdsLeft = ops && config ? remainingPawAds(ops, config) : 0;

  const tutorialStep: TutorialStep | null = useMemo(() => {
    if (!ops || !config) return null;
    if (tutorialReplayStep != null) {
      return config.tutorial.steps.find((step) => step.step === tutorialReplayStep) ?? null;
    }
    if (ops.tutorialDone) return null;
    return config.tutorial.steps.find((step) => step.step === ops.tutorialStep) ?? null;
  }, [ops, config, tutorialReplayStep]);

  const rewardsIntroConfig = config ? getRewardsIntroConfig(config.tutorial) : null;

  const coachMark: CoachMark | null = useMemo(() => {
    if (!ops || !config) return null;

    if (rewardsIntro && rewardsIntroConfig) {
      return rewardsIntroMark(rewardsIntroConfig, rewardsIntro.stepId, ops);
    }

    if (!tutorialStep) return null;

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

    if (stepThenActive && tutorialStep.then && !isNcoinIntroThen(tutorialStep.then)) {
      return mainStepMark(tutorialStep, "then");
    }

    return mainStepMark(tutorialStep, "base");
  }, [
    ops,
    config,
    rewardsIntro,
    rewardsIntroConfig,
    tutorialStep,
    screen.name,
    revealTutPhase,
    stepThenActive,
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

  // Contextual rewards-intro: first of (nyangCoin≥10 from r1) or (open rewards from r3).
  useEffect(() => {
    if (!ops || !config || !rewardsIntroConfig) return;
    if (rewardsIntro) return;
    if (tutorialReplayStep != null) return;
    if (!ops.tutorialDone) return;
    if (ops.tut.rewardsIntro !== "unseen") return;
    if (ad || screen.name === "reveal" || screen.name === "draw") return;
    if (menuOpen) return; // open-rewards trigger handled via onSheetOpen
    if (ops.nyangCoinBalance < 10) return;
    if (rewardsArmedRef.current) return;
    rewardsArmedRef.current = true;
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
    });
    setRevealTutPhase(null);
    setHideRevealToast(false);
    setStepThenActive(false);
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
        setScreen({ name: "collection" });
        return;
      }
      if (onReveal) return;
    }

    // Replay: walk steps with no rewards / no state mutation of tutorialDone.
    if (tutorialReplayStep != null) {
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
        setScreen({ name: "home" });
        setMenuOpen(false);
        setForceMenuSheet(null);
        setRewardsIntro({ stepId: "r1", replay: true });
        return;
      }
      const nextStep = tutorialStep.step + 1;
      setTutorialReplayStep(nextStep);
      setStepThenActive(false);
      setRevealTutPhase(nextStep === 2 ? "ncoin-intro" : null);
      if (tutorialStep.screen.includes("dex")) setScreen({ name: "collection" });
      else if (tutorialStep.screen === "room") setScreen({ name: "room" });
      else if (tutorialStep.screen === "main" || tutorialStep.screen === "draw-reveal") {
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
      !stepThenActive
    ) {
      setStepThenActive(true);
      if (tutorialStep.screen.includes("dex") || tutorialStep.then.screen === "dex") {
        setScreen({ name: "collection" });
      }
      return;
    }

    if (tutorialStep.complete || tutorialStep.step >= config.tutorial.steps.length) {
      await persistOps({ ...ops, tutorialDone: true, tutorialStep: tutorialStep.step });
      setStepThenActive(false);
      setScreen({ name: "home" });
      return;
    }
    const nextStep = tutorialStep.step + 1;
    const next = config.tutorial.steps.find((step) => step.step === nextStep);
    await persistOps({ ...ops, tutorialStep: nextStep });
    setStepThenActive(false);
    if (next?.screen === "room") setScreen({ name: "room" });
    else if (next?.screen.includes("dex") || tutorialStep.screen.includes("dex")) {
      setScreen({ name: "collection" });
    } else if (next?.screen === "main" || next?.screen === "draw-reveal") {
      setScreen({ name: "home" });
    }
  }, [
    ops,
    config,
    tutorialStep,
    tutorialReplayStep,
    beginDraw,
    persistOps,
    rewardsIntro,
    advanceRewardsIntro,
    screen.name,
    revealTutPhase,
    stepThenActive,
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
          onBack={() => setScreen({ name: "home" })}
          floatingToast={
            ops && !ops.tutorialDone && ops.tutorialStep === 3 ? revealToast : null
          }
        />
      ) : null}

      {screen.name === "room" ? (
        <RoomScreen
          onBack={() => setScreen({ name: "home" })}
          tutorialActive={Boolean(
            tutorialStep?.screen === "room" &&
              (tutorialReplayStep != null || (ops && !ops.tutorialDone)),
          )}
          suggestTile={tutorialStep?.screen === "room" ? (tutorialStep.suggestTile ?? null) : null}
        />
      ) : null}

      {screen.name === "reveal" && reservation ? (
        <DrawRevealScreen
          reservation={reservation}
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
                setScreen({ name: "collection" });
                return;
              }
              if (ops.tutorialStep === 2 && !ops.tutorialDone && tutorialReplayStep == null) {
                await persistOps({ ...ops, tutorialStep: 3 });
              }
              setRevealTutPhase(null);
              setHideRevealToast(false);
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
          remainingDraws={remainingDraws}
          remainingRateUp={remainingRateUp}
          remainingPawAds={pawAdsLeft}
          pawBalance={ops.pawBalance}
          menuBadge={menuIconDot}
          onDraw={() => void beginDraw()}
          onRateUpDraw={() => void beginDraw("rateUp")}
          onPawAd={() => setAd({ kind: "short", purpose: "paw" })}
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
          setAd({ kind: "short", purpose: "paw" });
        }}
        onReplayTutorial={() => {
          closeMenu();
          setScreen({ name: "home" });
          setStepThenActive(false);
          setRevealTutPhase(null);
          setHideRevealToast(false);
          setRewardsIntro(null);
          setForceMenuSheet(null);
          setTutorialReplayStep(1);
        }}
        onDevResetNewUser={() => {
          setTutorialReplayStep(null);
          setFeatureIntro(null);
          setRewardsIntro(null);
          setForceMenuSheet(null);
          setRevealTutPhase(null);
          setMenuOpen(false);
          setScreen({ name: "home" });
        }}
        forceSheet={forceMenuSheet}
        lockDismiss={coachLockDismiss}
        onSheetOpen={(id) => {
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
        open={ad !== null}
        kind={ad?.kind ?? "short"}
        onComplete={() => void completeAd()}
        onCancel={() => void cancelAd()}
      />

      {coachMark &&
      (rewardsIntro ||
        (tutorialStep &&
          ((screen.name === "home" && tutorialStep.screen === "main") ||
            (screen.name === "reveal" && tutorialStep.screen === "draw-reveal") ||
            (screen.name === "collection" && tutorialStep.screen.includes("dex")) ||
            (screen.name === "room" && tutorialStep.screen === "room") ||
            (tutorialReplayStep != null &&
              (screen.name === "home" ||
                screen.name === "collection" ||
                screen.name === "room" ||
                screen.name === "reveal"))))) ? (
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
