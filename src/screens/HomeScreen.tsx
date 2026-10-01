import { adaptive } from "@toss/tds-colors";
import { Button, FixedBottomCTA, Text, Top } from "@toss/tds-mobile";

import { CatPortrait } from "../components/CatPortrait";
import { ScreenHeader } from "../components/ScreenHeader";
import { formatKoreanDate } from "../lib/date";
import { GradeBadge } from "../components/GradeBadge";
import { MAX_DAILY_REROLLS } from "../lib/user";
import type { Cat, DrawResult } from "../types";

type HomeScreenProps = {
  pinkJellyBalance: number;
  hasDrawnToday: boolean;
  remainingRerolls: number;
  todayCat: Cat | null;
  lastResult: DrawResult | null;
  onDraw: () => void;
  onOpenResult: () => void;
  onOpenCollection: () => void;
};

export function HomeScreen({
  pinkJellyBalance,
  hasDrawnToday,
  remainingRerolls,
  todayCat,
  lastResult,
  onDraw,
  onOpenResult,
  onOpenCollection,
}: HomeScreenProps) {
  return (
    <div className="screen">
      <ScreenHeader title="럭키캣" />

      <Top
        title={<Top.TitleParagraph size={22}>오늘의 행운 고양이</Top.TitleParagraph>}
        subtitleBottom={
          <Top.SubtitleParagraph size={15}>
            {formatKoreanDate()} · 핑크젤리 {pinkJellyBalance}개
          </Top.SubtitleParagraph>
        }
      />

      <div className="home-hero">
        <button
          type="button"
          className={`bell-button ${hasDrawnToday ? "is-done" : ""}`}
          onClick={() => {
            if (!hasDrawnToday) onDraw();
          }}
          aria-label={hasDrawnToday ? "오늘은 이미 소환했어요" : "고양이 방울 흔들어 소환하기"}
        >
          <span className="bell-sparkle" aria-hidden="true">
            ✦
          </span>
          <span className="bell" aria-hidden="true">
            🔔
          </span>
          <span className="bell-cat" aria-hidden="true">
            🐱
          </span>
        </button>
        <Text typography="t6" color={adaptive.grey600} textAlign="center" display="block">
          {hasDrawnToday
            ? "오늘은 이미 방울을 울렸어요. 내일 00:00에 다시 열려요."
            : "방울을 누르면 광고 후 오늘의 고양이가 나타나요."}
        </Text>
      </div>

      {todayCat && lastResult ? (
        <button type="button" className="today-cat-card" onClick={onOpenResult}>
          <CatPortrait cat={todayCat} size="card" />
          <div className="today-cat-copy">
            <div className="today-cat-top">
              <span>오늘의 고양이</span>
              <GradeBadge grade={todayCat.grade} />
            </div>
            <strong>{todayCat.name}</strong>
            <p>{todayCat.description}</p>
          </div>
        </button>
      ) : (
        <section className="intro-card">
          <Text typography="t5" fontWeight="bold" color={adaptive.grey800} display="block">
            하루 한 번, 행운의 고양이를 소환해요
          </Text>
          <Text typography="t6" color={adaptive.grey600} display="block">
            처음 해금하면 핑크젤리 1개를 받아요. 마음에 들지 않으면 광고를 보고 하루 5번까지 다시
            뽑을 수 있어요.
          </Text>
        </section>
      )}

      <div className="home-meta">
        <Text typography="t6" color={adaptive.grey600} display="block">
          남은 재도전 {remainingRerolls}/{MAX_DAILY_REROLLS}
        </Text>
        <button type="button" className="text-link" onClick={onOpenCollection}>
          고양이 도감
        </button>
      </div>

      <div className="cta-spacer" aria-hidden="true" />

      {hasDrawnToday ? (
        remainingRerolls > 0 ? (
          <FixedBottomCTA.Double
            takeSpace
            leftButton={
              <Button color="dark" variant="weak" disabled>
                내일 다시 도전하세요
              </Button>
            }
            rightButton={<Button onClick={onOpenResult}>다시 뽑기</Button>}
          />
        ) : (
          <FixedBottomCTA takeSpace onClick={() => undefined}>
            내일 다시 도전하세요
          </FixedBottomCTA>
        )
      ) : (
        <FixedBottomCTA takeSpace onClick={onDraw}>
          오늘의 행운 고양이 뽑기
        </FixedBottomCTA>
      )}
    </div>
  );
}
