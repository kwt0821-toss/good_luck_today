import { adaptive } from "@toss/tds-colors";
import { ProgressBar, Text, Top } from "@toss/tds-mobile";
import { useEffect, useState } from "react";

import { ScreenHeader } from "../components/ScreenHeader";

const STEPS = [
  "오늘의 흐름을 읽고 있어요",
  "행운의 숫자를 고르고 있어요",
  "당신에게 맞는 조언을 고르고 있어요",
];

type ReadingScreenProps = {
  onCancel: () => void;
  onComplete: () => void;
};

export function ReadingScreen({ onCancel, onComplete }: ReadingScreenProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setStep(1), 700),
      window.setTimeout(() => setStep(2), 1400),
      window.setTimeout(onComplete, 2200),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [onComplete]);

  return (
    <div className="screen reading-screen">
      <ScreenHeader title="오늘의 행운" showBack onBack={onCancel} />
      <Top
        title={<Top.TitleParagraph size={22}>{STEPS[step]}</Top.TitleParagraph>}
        subtitleBottom={
          <Top.SubtitleParagraph size={15}>잠시만 기다려 주세요</Top.SubtitleParagraph>
        }
      />
      <div className="reading-body">
        <div className="reading-emoji" aria-hidden="true">
          🍀
        </div>
        <ProgressBar size="bold" progress={(step + 1) / STEPS.length} color="#12B886" animate />
        <Text typography="t6" color={adaptive.grey500} display="block">
          {step + 1} / {STEPS.length}
        </Text>
      </div>
    </div>
  );
}
