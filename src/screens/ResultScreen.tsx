import { adaptive } from "@toss/tds-colors";
import {
  Badge,
  Button,
  FixedBottomCTA,
  List,
  ListHeader,
  ListRow,
  Text,
  Top,
} from "@toss/tds-mobile";

import { EmojiAsset } from "../components/EmojiAsset";
import { ScreenHeader } from "../components/ScreenHeader";
import { formatKoreanDate } from "../lib/date";
import { getShareMessage } from "../lib/fortune";
import { haptic, shareText } from "../lib/native";
import type { DailyFortune } from "../types";

type ResultScreenProps = {
  fortune: DailyFortune;
  nickname: string;
  onBack: () => void;
  onOpenCategory: (id: DailyFortune["categories"][number]["id"]) => void;
};

function gradeColor(grade: DailyFortune["grade"]): "green" | "blue" | "teal" | "yellow" {
  if (grade === "최고") return "green";
  if (grade === "좋음") return "blue";
  if (grade === "무난") return "teal";
  return "yellow";
}

export function ResultScreen({ fortune, nickname, onBack, onOpenCategory }: ResultScreenProps) {
  const handleShare = async () => {
    await haptic("success");
    await shareText(getShareMessage(fortune, nickname));
  };

  return (
    <div className="screen">
      <ScreenHeader title="오늘 운세" showBack onBack={onBack} />
      <Top
        title={<Top.TitleParagraph size={22}>{fortune.headline}</Top.TitleParagraph>}
        subtitleTop={<Top.SubtitleParagraph size={13}>{formatKoreanDate()}</Top.SubtitleParagraph>}
        subtitleBottom={<Top.SubtitleParagraph size={17}>{fortune.summary}</Top.SubtitleParagraph>}
      />

      <section className="score-panel">
        <div>
          <Text typography="t7" color={adaptive.grey500} display="block">
            행운 지수
          </Text>
          <strong className="score-panel-value">{fortune.score}점</strong>
        </div>
        <Badge size="large" color={gradeColor(fortune.grade)} variant="weak">
          {fortune.grade}
        </Badge>
      </section>

      <ListHeader
        title={
          <ListHeader.TitleParagraph typography="t5" color={adaptive.grey800} fontWeight="bold">
            분야별 운세
          </ListHeader.TitleParagraph>
        }
      />
      <List>
        {fortune.categories.map((category) => (
          <ListRow
            key={category.id}
            left={<EmojiAsset>{category.emoji}</EmojiAsset>}
            contents={
              <ListRow.Texts type="2RowTypeA" top={`${category.label} ${category.score}점`} bottom={category.title} />
            }
            withArrow
            onClick={() => onOpenCategory(category.id)}
          />
        ))}
      </List>

      <ListHeader
        title={
          <ListHeader.TitleParagraph typography="t5" color={adaptive.grey800} fontWeight="bold">
            오늘의 행운 아이템
          </ListHeader.TitleParagraph>
        }
      />
      <List>
        <ListRow
          left={<EmojiAsset backgroundColor={adaptive.yellow50}>🎨</EmojiAsset>}
          contents={<ListRow.Texts type="2RowTypeA" top="행운의 색" bottom={fortune.luckyColor} />}
        />
        <ListRow
          left={<EmojiAsset backgroundColor={adaptive.blue50}>🔢</EmojiAsset>}
          contents={<ListRow.Texts type="2RowTypeA" top="행운의 숫자" bottom={`${fortune.luckyNumber}`} />}
        />
        <ListRow
          left={<EmojiAsset backgroundColor={adaptive.purple50}>⏰</EmojiAsset>}
          contents={<ListRow.Texts type="2RowTypeA" top="행운의 시간" bottom={fortune.luckyTime} />}
        />
        <ListRow
          left={<EmojiAsset backgroundColor={adaptive.orange50}>🍽️</EmojiAsset>}
          contents={<ListRow.Texts type="2RowTypeA" top="행운의 음식" bottom={fortune.luckyFood} />}
        />
        <ListRow
          left={<EmojiAsset backgroundColor={adaptive.teal50}>✨</EmojiAsset>}
          contents={<ListRow.Texts type="2RowTypeA" top="행운의 아이템" bottom={fortune.luckyItem} />}
        />
      </List>

      <div className="disclaimer">
        <Text typography="t7" color={adaptive.grey500} display="block">
          오늘의 행운은 재미로 보는 콘텐츠예요. 중요한 선택은 꼭 스스로 판단해 주세요.
        </Text>
      </div>

      <FixedBottomCTA.Double
        leftButton={
          <Button color="dark" variant="weak" onClick={handleShare}>
            공유하기
          </Button>
        }
        rightButton={<Button onClick={onBack}>홈으로</Button>}
      />
    </div>
  );
}
