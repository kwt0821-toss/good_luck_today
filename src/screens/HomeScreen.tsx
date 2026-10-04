import { adaptive } from "@toss/tds-colors";
import { Button, FixedBottomCTA, Text, Top } from "@toss/tds-mobile";

import { CatPortrait } from "../components/CatPortrait";
import { ScreenHeader } from "../components/ScreenHeader";
import { formatKoreanDate } from "../lib/date";
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
  onOpenRoom: () => void;
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
  onOpenRoom,
}: HomeScreenProps) {
  return (
    <div className="screen">
      <ScreenHeader title="럭키캣" pinkJellyBalance={pinkJellyBalance} />

      <Top
        title={<Top.TitleParagraph size={22}>오늘의 행운 고양이</Top.TitleParagraph>}
        subtitleBottom={
          <Top.SubtitleParagraph size={15}>{formatKoreanDate()}</Top.SubtitleParagraph>
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
            </div>
            <strong>{todayCat.name}</strong>
            <p>
              토스포인트 +{lastResult.earnedTossPoints}원 · 핑크젤리 +{lastResult.earnedPinkJelly}
            </p>
          </div>
        </button>
      ) : (
        <section className="intro-card">
          <Text typography="t5" fontWeight="bold" color={adaptive.grey800} display="block">
            하루 한 번, 행운의 고양이를 소환해요
          </Text>
          <Text typography="t6" color={adaptive.grey600} display="block">
            뽑을 때마다 토스포인트와 핑크젤리를 바로 받아요. 성이 높을수록 1원·1개씩 더 쌓여요.
            핑크젤리로는 고양이방 아이템을 살 수 있어요.
          </Text>
        </section>
      )}

      <button type="button" className="today-cat-card" onClick={onOpenRoom}>
        <div className="room-entry-icon" aria-hidden="true">
          🏠
        </div>
        <div className="today-cat-copy">
          <div className="today-cat-top">
            <span>핑크젤리 상점</span>
          </div>
          <strong>고양이방</strong>
          <p>아이템을 사고 드래그해서 나만의 방을 꾸며요.</p>
        </div>
      </button>

      <div className="home-meta">
        <Text typography="t6" color={adaptive.grey600} display="block">
          남은 재도전 {remainingRerolls}/{MAX_DAILY_REROLLS}
        </Text>
        <div className="home-links">
          <button type="button" className="text-link" onClick={onOpenCollection}>
            고양이 도감
          </button>
          <button type="button" className="text-link" onClick={onOpenRoom}>
            고양이방
          </button>
        </div>
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
