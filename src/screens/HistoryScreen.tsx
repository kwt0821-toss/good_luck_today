import { adaptive } from "@toss/tds-colors";
import { List, ListHeader, ListRow, Result, Top } from "@toss/tds-mobile";

import { EmojiAsset } from "../components/EmojiAsset";
import { ScreenHeader } from "../components/ScreenHeader";
import { formatShortDate } from "../lib/date";
import type { DailyFortune } from "../types";

type HistoryScreenProps = {
  fortunes: DailyFortune[];
  todayKey: string;
  onBack: () => void;
  onSelect: (dateKey: string) => void;
};

export function HistoryScreen({ fortunes, todayKey, onBack, onSelect }: HistoryScreenProps) {
  return (
    <div className="screen">
      <ScreenHeader title="지난 행운" showBack onBack={onBack} />
      <Top
        title={<Top.TitleParagraph size={22}>열어본 하루만 모아 보여드려요</Top.TitleParagraph>}
        subtitleBottom={
          <Top.SubtitleParagraph size={15}>같은 날짜의 운세는 다시 봐도 똑같아요</Top.SubtitleParagraph>
        }
      />

      {fortunes.length === 0 ? (
        <Result
          title="아직 열어본 운세가 없어요"
          description="홈에서 오늘 운세를 보면 여기에 기록이 쌓여요."
        />
      ) : (
        <>
          <ListHeader
            title={
              <ListHeader.TitleParagraph typography="t5" color={adaptive.grey800} fontWeight="bold">
                최근 기록
              </ListHeader.TitleParagraph>
            }
          />
          <List>
            {fortunes.map((fortune) => (
              <ListRow
                key={fortune.dateKey}
                left={<EmojiAsset>{fortune.dateKey === todayKey ? "🍀" : "🌙"}</EmojiAsset>}
                contents={
                  <ListRow.Texts
                    type="2RowTypeA"
                    top={`${formatShortDate(fortune.dateKey)} · ${fortune.score}점`}
                    bottom={fortune.headline}
                  />
                }
                withArrow
                onClick={() => onSelect(fortune.dateKey)}
              />
            ))}
          </List>
        </>
      )}
    </div>
  );
}
