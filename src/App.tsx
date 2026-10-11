import { useCallback, useEffect, useMemo, useState } from "react";

import { AdModal } from "./components/AdModal";
import { FeatureIntroBubble, TutorialCoach } from "./components/TutorialCoach";
import { toKstDateKey } from "./lib/date";
import type { MockAdKind } from "./lib/mockAds";
import { cancelDrawReservation, preloadDrawImages, reserveDraw } from "./lib/mockDrawApi";
import { configureNavigationBar, haptic } from "./lib/native";
import { loadOpsConfig } from "./lib/opsConfig";
import {
  claimAttendanceIfNeeded,
  confirmDrawAfterAd,
  grantPawAdReward,
} from "./lib/opsRewards";
import {
  daysSinceInstall,
  nextDrawSlot,
  remainingPawAds,
  remainingRateUpDraws,
  remainingTotalDraws,
} from "./lib/opsState";
import { loadOpsState, saveOpsState } from "./lib/opsStorage";
import type { DrawReservation, FeatureIntro, OpsConfig, OpsState, TutorialStep } from "./lib/opsTypes";
import { DRAW_REVEAL_WAIT_MAX_MS, DrawRevealScreen } from "./screens/DrawRevealScreen";
import { CollectionScreen } from "./screens/CollectionScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { RatesGuideScreen } from "./screens/RatesGuideScreen";
import { RoomScreen } from "./screens/RoomScreen";
import { StubScreen } from "./screens/StubScreen";
import type { Screen } from "./types";
import "./App.css";

function initialScreen(): Screen {
  if (typeof window === "undefined") return { name: "home" };
  const name = new URLSearchParams(window.location.search).get("screen");
  if (
    name === "collection" ||
    name === "room" ||
    name === "menu" ||
    name === "draw" ||
    name === "rates" ||
    name === "reveal"
  ) {
    return { name };
  }
  return { name: "home" };
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
        const attendance = await claimAttendanceIfNeeded(nextOps);
        setOps(attendance.state);
        if (attendance.itemId) {
          setLocalToast(`출석 선물: ${attendance.itemId}`);
          window.setTimeout(() => setLocalToast(null), 2200);
        }
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
    if (!ops || !config || ops.tutorialDone) return null;
    return config.tutorial.steps.find((step) => step.step === ops.tutorialStep) ?? null;
  }, [ops, config]);

  useEffect(() => {
    if (!ops || !config || !ops.tutorialDone || featureIntro) return;
    const day = daysSinceInstall(ops, today);
    const ownedDup = false; // day-5 condition checked lightly; full dup check in dex later
    const candidate = config.tutorial.featureIntros.schedule.find((intro) => {
      if (ops.featureIntrosSeen.includes(intro.id)) return false;
      if (intro.day > day) return false;
      if (intro.condition === "중복 카드 1장 이상" && !ownedDup) return false;
      return true;
    });
    if (candidate) setFeatureIntro(candidate);
  }, [ops, config, today, featureIntro]);

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

      if (slot === "tutorial") {
        const confirmed = await confirmDrawAfterAd(reserved.state, reserved.reservation.drawId);
        if ("error" in confirmed) {
          setLocalToast(confirmed.error);
          return;
        }
        await persistOps({
          ...confirmed.state,
          tutorialStep: Math.max(confirmed.state.tutorialStep, 2),
        });
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

  const skipTutorial = useCallback(async () => {
    if (!ops) return;
    await persistOps({
      ...ops,
      tutorialDone: true,
      tutorialStep: 99,
      tutorialInterruptions: ops.tutorialInterruptions + 1,
    });
  }, [ops, persistOps]);

  const advanceTutorial = useCallback(async () => {
    if (!ops || !config || !tutorialStep) return;
    if (tutorialStep.step === 1) {
      await beginDraw("tutorial");
      return;
    }
    if (tutorialStep.complete || tutorialStep.step >= config.tutorial.steps.length) {
      await persistOps({ ...ops, tutorialDone: true, tutorialStep: tutorialStep.step });
      setScreen({ name: "home" });
      return;
    }
    const nextStep = tutorialStep.step + 1;
    await persistOps({ ...ops, tutorialStep: nextStep });
    if (tutorialStep.screen.includes("dex")) setScreen({ name: "collection" });
    if (tutorialStep.screen === "room") setScreen({ name: "room" });
  }, [ops, config, tutorialStep, beginDraw, persistOps]);

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
      {screen.name === "menu" ? (
        <StubScreen
          title="메뉴"
          body="메뉴 화면은 곧 연결될 예정이에요. 확률 안내는 홈에서 열 수 있어요."
          onBack={() => setScreen({ name: "home" })}
        />
      ) : null}

      {screen.name === "rates" ? <RatesGuideScreen onBack={() => setScreen({ name: "home" })} /> : null}

      {screen.name === "collection" ? (
        <CollectionScreen onBack={() => setScreen({ name: "home" })} />
      ) : null}

      {screen.name === "room" ? <RoomScreen onBack={() => setScreen({ name: "home" })} /> : null}

      {screen.name === "reveal" && reservation ? (
        <DrawRevealScreen
          reservation={reservation}
          ready={revealReady && !waitFailed}
          waitFailed={waitFailed && !revealReady}
          toastText={revealToast}
          remainingDraws={remainingDraws}
          onToDex={() => {
            void (async () => {
              if (ops.tutorialStep === 2 && !ops.tutorialDone) {
                await persistOps({ ...ops, tutorialStep: 3 });
              }
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
          onDraw={() => void beginDraw()}
          onRateUpDraw={() => void beginDraw("rateUp")}
          onPawAd={() => setAd({ kind: "short", purpose: "paw" })}
          onOpenMenu={() => setScreen({ name: "menu" })}
          onOpenCollection={() => setScreen({ name: "collection" })}
          onOpenRoom={() => setScreen({ name: "room" })}
          onOpenRates={() => setScreen({ name: "rates" })}
        />
      ) : null}

      <AdModal
        open={ad !== null}
        kind={ad?.kind ?? "short"}
        onComplete={() => void completeAd()}
        onCancel={() => void cancelAd()}
      />

      {screen.name === "home" && tutorialStep && tutorialStep.screen === "main" ? (
        <TutorialCoach step={tutorialStep} onSkip={() => void skipTutorial()} onAdvance={() => void advanceTutorial()} />
      ) : null}

      {screen.name === "reveal" && tutorialStep && tutorialStep.screen === "draw-reveal" ? (
        <TutorialCoach step={tutorialStep} onSkip={() => void skipTutorial()} onAdvance={() => void advanceTutorial()} />
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
