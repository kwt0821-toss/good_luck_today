import { useCallback, useEffect, useState } from "react";

import { AdModal } from "./components/AdModal";
import { getCatById } from "./lib/cats";
import { toKstDateKey } from "./lib/date";
import { getRandomCat } from "./lib/gacha";
import { configureNavigationBar, haptic } from "./lib/native";
import { loadUserState, saveUserState } from "./lib/storage";
import { applyDraw, createDefaultUser, hasDrawnToday, remainingRerolls } from "./lib/user";
import { CollectionScreen } from "./screens/CollectionScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { RoomScreen } from "./screens/RoomScreen";
import { StubScreen } from "./screens/StubScreen";
import type { AdKind, DrawPurpose, Screen, UserState } from "./types";
import "./App.css";

function initialScreen(): Screen {
  if (typeof window === "undefined") return { name: "home" };
  const name = new URLSearchParams(window.location.search).get("screen");
  if (name === "collection" || name === "room" || name === "menu" || name === "draw") {
    return { name };
  }
  return { name: "home" };
}

function App() {
  const [user, setUser] = useState<UserState>(createDefaultUser);
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [rerollOpen, setRerollOpen] = useState(false);
  const [ad, setAd] = useState<{ kind: AdKind; purpose: DrawPurpose } | null>(null);

  const today = toKstDateKey();
  const drawnToday = hasDrawnToday(user, today);
  const rerollsLeft = remainingRerolls(user, today);
  const remainingDraws = drawnToday ? rerollsLeft : 1;

  useEffect(() => {
    let cancelled = false;
    loadUserState()
      .then((next) => {
        if (!cancelled) setUser(next);
      })
      .catch(() => {
        // 브라우저 미리보기에서는 기본 상태로 바로 보여요.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void configureNavigationBar({ withBackButton: screen.name !== "home" });
  }, [screen]);

  const persist = useCallback(async (next: UserState) => {
    setUser(next);
    await saveUserState(next);
  }, []);

  const startDraw = useCallback(
    (purpose: DrawPurpose) => {
      if (purpose !== "daily" && rerollsLeft <= 0) return;
      if (purpose === "daily" && drawnToday) return;
      setRerollOpen(false);
      setAd({
        kind: purpose === "reroll-boosted" ? "rewarded" : "interstitial",
        purpose,
      });
    },
    [drawnToday, rerollsLeft],
  );

  const completeAd = useCallback(async () => {
    if (!ad) return;
    const boosted = ad.purpose === "reroll-boosted";
    const isReroll = ad.purpose !== "daily";
    const cat = getRandomCat(boosted);
    const { next } = applyDraw(user, cat, { isReroll, boosted, today });
    await persist(next);
    await haptic("success");
    setAd(null);
    setScreen({ name: "result" });
  }, [ad, persist, today, user]);

  const resultCat = user.lastResult ? getCatById(user.lastResult.catId) : undefined;

  return (
    <>
      {screen.name === "menu" ? (
        <StubScreen
          title="메뉴"
          body="메뉴 화면은 곧 연결될 예정이에요."
          onBack={() => setScreen({ name: "home" })}
        />
      ) : null}

      {screen.name === "draw" ? (
        <StubScreen
          title="오늘의 카드"
          body="카드 뽑기 화면은 곧 연결될 예정이에요."
          onBack={() => setScreen({ name: "home" })}
        />
      ) : null}

      {screen.name === "collection" ? (
        <CollectionScreen user={user} onBack={() => setScreen({ name: "home" })} />
      ) : null}

      {screen.name === "room" ? <RoomScreen onBack={() => setScreen({ name: "home" })} /> : null}

      {screen.name === "result" && resultCat && user.lastResult ? (
        <ResultScreen
          cat={resultCat}
          result={user.lastResult}
          pinkJellyBalance={user.pinkJellyBalance}
          remainingRerolls={rerollsLeft}
          rerollOpen={rerollOpen}
          onOpenReroll={() => setRerollOpen(true)}
          onCloseReroll={() => setRerollOpen(false)}
          onConfirm={() => setScreen({ name: "home" })}
          onStandardReroll={() => startDraw("reroll-standard")}
          onBoostedReroll={() => startDraw("reroll-boosted")}
        />
      ) : null}

      {screen.name === "home" ? (
        <HomeScreen
          remainingDraws={remainingDraws}
          onDraw={() => setScreen({ name: "draw" })}
          onOpenMenu={() => setScreen({ name: "menu" })}
          onOpenCollection={() => setScreen({ name: "collection" })}
          onOpenRoom={() => setScreen({ name: "room" })}
        />
      ) : null}

      <AdModal
        open={ad !== null}
        kind={ad?.kind ?? "interstitial"}
        onComplete={() => void completeAd()}
        onCancel={() => setAd(null)}
      />
    </>
  );
}

export default App;
