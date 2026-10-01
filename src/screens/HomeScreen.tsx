import { adaptive } from "@toss/tds-colors";
import {
  Badge,
  BottomSheet,
  Button,
  FixedBottomCTA,
  List,
  ListHeader,
  ListRow,
  Text,
  Top,
} from "@toss/tds-mobile";
import { useState } from "react";

import { EmojiAsset } from "../components/EmojiAsset";
import { ScreenHeader } from "../components/ScreenHeader";
import { formatKoreanDate } from "../lib/date";
import { getShareMessage } from "../lib/fortune";
import { haptic, shareText } from "../lib/native";
import type { DailyFortune } from "../types";

type HomeScreenProps = {
  fortune: DailyFortune;
  revealed: boolean;
  nickname: string;
  onRead: () => void;
  onOpenResult: () => void;
  onOpenCategory: (id: DailyFortune["categories"][number]["id"]) => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
};

function gradeColor(grade: DailyFortune["grade"]): "green" | "blue" | "teal" | "yellow" {
  if (grade === "최고") return "green";
  if (grade === "좋음") return "blue";
  if (grade === "무난") return "teal";
  return "yellow";
}

export function HomeScreen({
  fortune,
  revealed,
  nickname,
  onRead,
  onOpenResult,
  onOpenCategory,
  onOpenHistory,
  onOpenSettings,
}: HomeScreenProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const who = nickname.trim() || "당신";

  const handleShare = async () => {
    await haptic("softMedium");
    const result = await shareText(getShareMessage(fortune, nickname));
    setShareOpen(false);
    setToast(result === "copied" ? "행운 메시지를 복사했어요." : "오늘의 행운을 공유했어요.");
    window.setTimeout(() => setToast(null), 2400);
  };

  return (
    <div className="screen">
      <ScreenHeader
        title="오늘의 행운"
        accessoryName="icon-setting-mono"
        accessoryLabel="설정"
        onAccessoryClick={onOpenSettings}
      />

      <Top
        title={
          <Top.TitleParagraph size={22}>
            {revealed ? `${who}의 오늘 행운 지수는 ${fortune.score}점이에요` : `${who}의 오늘 행운을 열어보세요`}
          </Top.TitleParagraph>
        }
        subtitleBottom={
          <Top.SubtitleParagraph size={15}>{formatKoreanDate()}</Top.SubtitleParagraph>
        }
      />

      {revealed ? (
        <section className="luck-card" onClick={onOpenResult} role="button" tabIndex={0}>
          <div className="luck-card-top">
            <span className="luck-card-label">오늘의 행운 지수</span>
            <Badge size="small" color={gradeColor(fortune.grade)} variant="weak">
              {fortune.grade}
            </Badge>
          </div>
          <strong className="luck-card-score">{fortune.score}</strong>
          <p className="luck-card-headline">{fortune.headline}</p>
        </section>
      ) : (
        <section className="intro-card">
          <div className="intro-emoji" aria-hidden="true">
            🍀
          </div>
          <Text typography="t5" fontWeight="bold" color={adaptive.grey800} display="block">
            하루 한 번, 오늘만의 운세를 알려드려요
          </Text>
          <Text typography="t6" color={adaptive.grey600} display="block">
            날짜가 같으면 같은 결과가 나와요. 가볍게 참고하고, 중요한 결정은 스스로 내려주세요.
          </Text>
        </section>
      )}

      <ListHeader
        title={
          <ListHeader.TitleParagraph typography="t5" color={adaptive.grey800} fontWeight="bold">
            운세 살펴보기
          </ListHeader.TitleParagraph>
        }
      />
      <List>
        {fortune.categories.map((category) => (
          <ListRow
            key={category.id}
            left={<EmojiAsset>{category.emoji}</EmojiAsset>}
            contents={
              <ListRow.Texts
                type="2RowTypeA"
                top={category.label}
                bottom={revealed ? category.title : "오늘 운세를 보면 자세히 알려드려요"}
              />
            }
            withArrow
            onClick={() => {
              if (revealed) {
                onOpenCategory(category.id);
              } else {
                onRead();
              }
            }}
          />
        ))}
      </List>

      <ListHeader
        title={
          <ListHeader.TitleParagraph typography="t5" color={adaptive.grey800} fontWeight="bold">
            더보기
          </ListHeader.TitleParagraph>
        }
      />
      <List>
        <ListRow
          left={<EmojiAsset backgroundColor={adaptive.blue50}>📅</EmojiAsset>}
          contents={<ListRow.Texts type="1RowTypeA" top="지난 행운 기록" />}
          withArrow
          onClick={onOpenHistory}
        />
        <ListRow
          left={<EmojiAsset backgroundColor={adaptive.grey100}>⚙️</EmojiAsset>}
          contents={<ListRow.Texts type="1RowTypeA" top="설정" />}
          withArrow
          onClick={onOpenSettings}
        />
      </List>

      {revealed ? (
        <FixedBottomCTA.Double
          leftButton={
            <Button color="dark" variant="weak" onClick={() => setShareOpen(true)}>
              공유하기
            </Button>
          }
          rightButton={<Button onClick={onOpenResult}>자세히 보기</Button>}
        />
      ) : (
        <FixedBottomCTA
          onClick={async () => {
            await haptic("tap");
            onRead();
          }}
        >
          오늘 운세 보기
        </FixedBottomCTA>
      )}

      <BottomSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        header={<BottomSheet.Header>오늘의 행운을 공유할까요?</BottomSheet.Header>}
        headerDescription={
          <BottomSheet.HeaderDescription>
            친구에게 오늘 행운 지수와 한 줄 운세를 보내요.
          </BottomSheet.HeaderDescription>
        }
        cta={<BottomSheet.CTA onClick={handleShare}>공유하기</BottomSheet.CTA>}
      >
        <div className="sheet-preview">
          <Text typography="t6" color={adaptive.grey700} display="block">
            {getShareMessage(fortune, nickname)}
          </Text>
        </div>
      </BottomSheet>

      {toast ? <div className="local-toast">{toast}</div> : null}
    </div>
  );
}
