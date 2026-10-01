import { useCallback, useEffect, useMemo, useState } from "react";

import { configureNavigationBar, haptic } from "./lib/native";
import { toDateKey } from "./lib/date";
import { getCategory, getDailyFortune, getHistoryFortunes } from "./lib/fortune";
import { loadRevealedDates, loadSettings, saveRevealedDates, saveSettings } from "./lib/storage";
import { CategoryScreen } from "./screens/CategoryScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { ReadingScreen } from "./screens/ReadingScreen";
import { ResultScreen } from "./screens/ResultScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import type { AppSettings, CategoryId, Screen } from "./types";
import "./App.css";

const todayKey = toDateKey();

function App() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [settings, setSettings] = useState<AppSettings>({ nickname: "" });
  const [revealedDates, setRevealedDates] = useState<string[]>([]);
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);

  const fortune = useMemo(() => getDailyFortune(selectedDateKey), [selectedDateKey]);
  const todayFortune = useMemo(() => getDailyFortune(todayKey), []);
  const revealedToday = revealedDates.includes(todayKey);
  const historyFortunes = useMemo(() => getHistoryFortunes(revealedDates), [revealedDates]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([loadSettings(), loadRevealedDates()]).then(([nextSettings, dates]) => {
      if (cancelled) return;
      setSettings(nextSettings);
      setRevealedDates(dates);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const withBackButton = screen.name !== "home";
    void configureNavigationBar({ withBackButton });
  }, [screen]);

  const goHome = useCallback(() => {
    setSelectedDateKey(todayKey);
    setScreen({ name: "home" });
  }, []);

  const revealToday = useCallback(async () => {
    const nextDates = Array.from(new Set([...revealedDates, todayKey]));
    setRevealedDates(nextDates);
    await saveRevealedDates(nextDates);
    await haptic("success");
    setSelectedDateKey(todayKey);
    setScreen({ name: "result" });
  }, [revealedDates]);

  const updateNickname = useCallback(
    async (nickname: string) => {
      const next = { ...settings, nickname };
      setSettings(next);
      await saveSettings(next);
    },
    [settings],
  );

  const resetToday = useCallback(async () => {
    const nextDates = revealedDates.filter((date) => date !== todayKey);
    setRevealedDates(nextDates);
    await saveRevealedDates(nextDates);
    setSelectedDateKey(todayKey);
    setScreen({ name: "home" });
  }, [revealedDates]);

  const openCategory = useCallback((category: CategoryId) => {
    setScreen({ name: "category", category });
  }, []);

  if (!ready) {
    return <div className="boot" />;
  }

  if (screen.name === "reading") {
    return <ReadingScreen onCancel={goHome} onComplete={() => void revealToday()} />;
  }

  if (screen.name === "result") {
    return (
      <ResultScreen
        fortune={fortune}
        nickname={settings.nickname}
        onBack={goHome}
        onOpenCategory={openCategory}
      />
    );
  }

  if (screen.name === "category") {
    return (
      <CategoryScreen
        category={getCategory(fortune, screen.category)}
        onBack={() => setScreen({ name: "result" })}
      />
    );
  }

  if (screen.name === "history") {
    return (
      <HistoryScreen
        fortunes={historyFortunes}
        todayKey={todayKey}
        onBack={goHome}
        onSelect={(dateKey) => {
          setSelectedDateKey(dateKey);
          setScreen({ name: "result" });
        }}
      />
    );
  }

  if (screen.name === "settings") {
    return (
      <SettingsScreen
        settings={settings}
        onChangeNickname={(nickname) => void updateNickname(nickname)}
        onResetToday={() => void resetToday()}
        onBack={goHome}
      />
    );
  }

  return (
    <HomeScreen
      fortune={todayFortune}
      revealed={revealedToday}
      nickname={settings.nickname}
      onRead={() => {
        setSelectedDateKey(todayKey);
        setScreen({ name: "reading" });
      }}
      onOpenResult={() => {
        setSelectedDateKey(todayKey);
        setScreen({ name: "result" });
      }}
      onOpenCategory={openCategory}
      onOpenHistory={() => setScreen({ name: "history" })}
      onOpenSettings={() => setScreen({ name: "settings" })}
    />
  );
}

export default App;
