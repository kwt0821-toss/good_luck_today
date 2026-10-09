import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AdModal } from "./components/AdModal";
import { getCatById } from "./lib/cats";
import { toKstDateKey } from "./lib/date";
import { getRandomCat } from "./lib/gacha";
import { configureNavigationBar, haptic } from "./lib/native";
import { buyItem, equipSurface, movePlacement, placeItem, removePlacement } from "./lib/room";
import { loadUserState, saveUserState } from "./lib/storage";
import { applyDraw, createDefaultUser, hasDrawnToday, remainingRerolls } from "./lib/user";
import { CollectionScreen } from "./screens/CollectionScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { RoomScreen } from "./screens/RoomScreen";
import { StubScreen } from "./screens/StubScreen";
import type { AdKind, DrawPurpose, Screen, UserState } from "./types";
import "./App.css";

function App() {
  const [user, setUser] = useState<UserState>(createDefaultUser);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [rerollOpen, setRerollOpen] = useState(false);
  const [ad, setAd] = useState<{ kind: AdKind; purpose: DrawPurpose } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number>(0);

  const today = toKstDateKey();
  const drawnToday = hasDrawnToday(user, today);
  const rerollsLeft = remainingRerolls(user, today);
  const remainingDraws = drawnToday ? rerollsLeft : 1;
  const todayCat = useMemo(
    () => (user.lastResult ? (getCatById(user.lastResult.catId) ?? null) : null),
    [user.lastResult],
  );

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

  const showToast = useCallback((message: string) => {
    if (!message) return;
    window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  }, []);

  const applyRoomAction = useCallback(
    async (result: ReturnType<typeof buyItem>, withHaptic = false) => {
      if (!result.ok) {
        showToast(result.message);
        return;
      }
      await persist(result.next);
      showToast(result.message);
      if (withHaptic) await haptic("success");
    },
    [persist, showToast],
  );

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

      {screen.name === "room" ? (
        <RoomScreen
          user={user}
          cat={todayCat}
          toast={toast}
          onBack={() => setScreen({ name: "home" })}
          onBuy={(itemId) => void applyRoomAction(buyItem(user, itemId), true)}
          onEquip={(itemId) => void applyRoomAction(equipSurface(user, itemId), true)}
          onPlace={(itemId, col, row) => void applyRoomAction(placeItem(user, itemId, col, row))}
          onMove={(instanceId, col, row) => {
            const result = movePlacement(user, instanceId, col, row);
            if (result.ok) void persist(result.next);
          }}
          onRemove={(instanceId) => void applyRoomAction(removePlacement(user, instanceId))}
        />
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
