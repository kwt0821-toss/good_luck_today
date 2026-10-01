import { adaptive } from "@toss/tds-colors";
import {
  Button,
  List,
  ListHeader,
  ListRow,
  Text,
  TextField,
  Top,
} from "@toss/tds-mobile";

import { EmojiAsset } from "../components/EmojiAsset";
import { ScreenHeader } from "../components/ScreenHeader";
import type { AppSettings } from "../types";

type SettingsScreenProps = {
  settings: AppSettings;
  onChangeNickname: (nickname: string) => void;
  onResetToday: () => void;
  onBack: () => void;
};

export function SettingsScreen({
  settings,
  onChangeNickname,
  onResetToday,
  onBack,
}: SettingsScreenProps) {
  return (
    <div className="screen">
      <ScreenHeader title="설정" showBack onBack={onBack} />
      <Top
        title={<Top.TitleParagraph size={22}>나만의 행운 앱으로 만들어 보세요</Top.TitleParagraph>}
        subtitleBottom={
          <Top.SubtitleParagraph size={15}>호칭은 홈 화면 인사말에 쓰여요</Top.SubtitleParagraph>
        }
      />

      <div className="field-wrap">
        <TextField
          variant="box"
          label="호칭"
          labelOption="sustain"
          placeholder="예: 민수"
          value={settings.nickname}
          onChange={(event) => onChangeNickname(event.target.value)}
        />
      </div>

      <ListHeader
        title={
          <ListHeader.TitleParagraph typography="t5" color={adaptive.grey800} fontWeight="bold">
            데이터
          </ListHeader.TitleParagraph>
        }
      />
      <List>
        <ListRow
          left={<EmojiAsset backgroundColor={adaptive.red50}>↺</EmojiAsset>}
          contents={
            <ListRow.Texts
              type="2RowTypeA"
              top="오늘 운세 다시 보기"
              bottom="오늘 결과를 닫고 홈에서 다시 열 수 있어요"
            />
          }
          right={
            <Button size="small" color="dark" variant="weak" onClick={onResetToday}>
              초기화
            </Button>
          }
        />
      </List>

      <div className="disclaimer">
        <Text typography="t7" color={adaptive.grey500} display="block">
          오늘의 행운은 앱인토스용 미니앱 예시예요. 운세는 재미로 즐겨 주세요.
        </Text>
      </div>
    </div>
  );
}
