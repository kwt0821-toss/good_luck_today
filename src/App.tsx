import { useCallback, useEffect, useMemo, useState } from "react";

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
import type { AdKind, DrawPurpose, Screen, UserState } from "./types";
import "./App.css";

function App() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserState>(createDefaultUser);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [rerollOpen, setRerollOpen] = useState(false);
  const [ad, setAd] = useState<{ kind: AdKind; purpose: DrawPurpose } | null>(null);

  const today = toKstDateKey();
  const drawnToday = hasDrawnToday(user, today);
  const rerollsLeft = remainingRerolls(user, today);
  const todayCat = useMemo(
    () => (user.lastResult ? (getCatById(user.lastResult.catId) ?? null) : null),
    [user.lastResult],
  );

  useEffect(() => {
    let cancelled = false;
    loadUserState().then((next) => {
      if (cancelled) return;
      setUser(next);
      setReady(true);
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

  if (!ready) {
    return <div className="boot" />;
  }

  const resultCat = user.lastResult ? getCatById(user.lastResult.catId) : undefined;

  return (
    <>
      {screen.name === "collection" ? (
        <CollectionScreen user={user} onBack={() => setScreen({ name: "home" })} />
      ) : null}

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
          pinkJellyBalance={user.pinkJellyBalance}
          hasDrawnToday={drawnToday}
          remainingRerolls={rerollsLeft}
          todayCat={todayCat}
          lastResult={user.lastResult}
          onDraw={() => startDraw("daily")}
          onOpenResult={() => {
            if (user.lastResult) setScreen({ name: "result" });
          }}
          onOpenCollection={() => setScreen({ name: "collection" })}
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
