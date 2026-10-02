import { adaptive } from "@toss/tds-colors";
import { BottomSheet, Button, FixedBottomCTA, Text, Top } from "@toss/tds-mobile";

import { CatPortrait } from "../components/CatPortrait";
import { GradeBadge } from "../components/GradeBadge";
import { ScreenHeader } from "../components/ScreenHeader";
import { MAX_DAILY_REROLLS } from "../lib/user";
import type { Cat, DrawResult } from "../types";

type ResultScreenProps = {
  cat: Cat;
  result: DrawResult;
  pinkJellyBalance: number;
  remainingRerolls: number;
  rerollOpen: boolean;
  onOpenReroll: () => void;
  onCloseReroll: () => void;
  onConfirm: () => void;
  onStandardReroll: () => void;
  onBoostedReroll: () => void;
};

export function ResultScreen({
  cat,
  result,
  pinkJellyBalance,
  remainingRerolls,
  rerollOpen,
  onOpenReroll,
  onCloseReroll,
  onConfirm,
  onStandardReroll,
  onBoostedReroll,
}: ResultScreenProps) {
  const remainingLabel = `다시 뽑기 (남은 횟수: ${remainingRerolls}/${MAX_DAILY_REROLLS})`;

  return (
    <div className="screen result-screen">
      <ScreenHeader title="소환 결과" showBack onBack={onConfirm} pinkJellyBalance={pinkJellyBalance} />
      <Top
        title={<Top.TitleParagraph size={22}>{cat.name}</Top.TitleParagraph>}
        subtitleBottom={
          <Top.SubtitleParagraph size={15}>{cat.description}</Top.SubtitleParagraph>
        }
      />

      <div className="result-hero">
        <div className={`result-burst grade-${cat.grade.toLowerCase()}`} />
        <CatPortrait cat={cat} size="hero" />
        <GradeBadge grade={cat.grade} size="large" />
      </div>

      <div className="reward-banner" role="status">
        <div className="reward-pills">
          <span className="reward-pill is-point">토스포인트 +{result.earnedTossPoints}원</span>
          <span className="reward-pill is-jelly">핑크젤리 +{result.earnedPinkJelly}</span>
        </div>
        <p>
          {result.isNew
            ? "NEW! 도감에 새로 등록됐어요."
            : "이미 도감에 있는 고양이예요. 중복 카운터가 올라갔어요."}
        </p>
        <p className="reward-hint">핑크젤리로는 고양이방 아이템을 살 수 있어요.</p>
      </div>

      {result.boosted ? (
        <Text typography="t7" color={adaptive.grey500} textAlign="center" display="block">
          확률업 재소환 결과
        </Text>
      ) : null}

      <div className="cta-spacer" aria-hidden="true" />

      {remainingRerolls > 0 ? (
        <FixedBottomCTA.Double
          takeSpace
          leftButton={
            <Button color="dark" variant="weak" onClick={onOpenReroll}>
              {remainingLabel}
            </Button>
          }
          rightButton={<Button onClick={onConfirm}>수령하기</Button>}
        />
      ) : (
        <FixedBottomCTA takeSpace onClick={onConfirm}>
          수령하기
        </FixedBottomCTA>
      )}

      <BottomSheet
        open={rerollOpen}
        onClose={onCloseReroll}
        header={<BottomSheet.Header>어떻게 다시 뽑을까요?</BottomSheet.Header>}
        headerDescription={
          <BottomSheet.HeaderDescription>
            남은 재도전 {remainingRerolls}/{MAX_DAILY_REROLLS}. 광고를 보면 바로 다시 소환해요.
          </BottomSheet.HeaderDescription>
        }
      >
        <div className="reroll-options">
          <button type="button" className="reroll-option" onClick={onStandardReroll}>
            <strong>일반 재소환</strong>
            <span>전면형 짧은 광고 · 일반 확률</span>
          </button>
          <button type="button" className="reroll-option is-boost" onClick={onBoostedReroll}>
            <strong>확률업 재소환 ⚡</strong>
            <span>30초 리워드 광고 · 고급 등급 확률 상승</span>
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
