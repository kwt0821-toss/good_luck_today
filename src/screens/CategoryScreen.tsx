import { adaptive } from "@toss/tds-colors";
import { Badge, FixedBottomCTA, Text, Top } from "@toss/tds-mobile";

import { ScreenHeader } from "../components/ScreenHeader";
import type { CategoryFortune } from "../types";

type CategoryScreenProps = {
  category: CategoryFortune;
  onBack: () => void;
};

export function CategoryScreen({ category, onBack }: CategoryScreenProps) {
  return (
    <div className="screen">
      <ScreenHeader title={category.label} showBack onBack={onBack} />
      <Top
        title={<Top.TitleParagraph size={22}>{category.title}</Top.TitleParagraph>}
        subtitleTop={
          <Top.SubtitleParagraph size={13}>
            {category.emoji} {category.label}
          </Top.SubtitleParagraph>
        }
        subtitleBottom={<Top.SubtitleParagraph size={17}>{category.summary}</Top.SubtitleParagraph>}
      />

      <section className="advice-card">
        <div className="advice-card-top">
          <Text typography="t6" color={adaptive.grey500}>
            오늘 점수
          </Text>
          <Badge size="small" color="blue" variant="weak">
            {category.score}점
          </Badge>
        </div>
        <Text typography="t5" fontWeight="bold" color={adaptive.grey800} display="block">
          이렇게 해보면 좋아요
        </Text>
        <Text typography="t6" color={adaptive.grey700} display="block">
          {category.advice}
        </Text>
      </section>

      <div className="cta-spacer" aria-hidden="true" />

      <FixedBottomCTA takeSpace onClick={onBack}>운세 전체 보기</FixedBottomCTA>
    </div>
  );
}
