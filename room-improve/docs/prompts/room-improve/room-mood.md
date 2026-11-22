# 방꾸미기 분위기 창 (D: 밝기 3단계 + 방 소리)

방꾸미기 화면에 **분위기 창**을 만들어 줘. 그림자·밝기·방 소리를 한곳에서 바꾸는 작은 창이야. 서버 작업은 없어.
승인된 시안: `docs/mockups/room-improve/D-mood.png`, 규칙 메모: `docs/mockups/room-improve/plan-memo.md`의 "D. 방 소리·밝기".

## 0. 먼저 확인 (꼭 이 순서로)
1. **압축 폴더 위치 바로잡기**: 저장소 맨 위에 `room-bigger/` 나 `room-improve/` 폴더가 있으면, 그 안의 `public/…` 는 맨 위 `public/…` 같은 자리로, `docs/…` 는 맨 위 `docs/…` 같은 자리로 옮기고 빈 폴더는 지워 줘. (같은 이름 파일이 이미 있으면 새 파일로 덮어써.) 옮긴 뒤 `public/assets/room/ui/icon-visit.svg`, `public/assets/audio/ambience-winter_cabin.m4a`, `docs/sounds-license.md` 가 있어야 해.
2. **방 크게 보기(room-bigger) 작업이 먼저** 들어가 있어야 해. `src/`에 `clientToStage` helper와 한 줄 제목 화면이 없으면, 이 작업은 하지 말고 "room-bigger 먼저 적용해 주세요"라고만 알려 줘.

## 1. 분위기 버튼
- 지금 "그림자 켜짐/꺼짐" 버튼(`lucky-shadow-toggle`) 자리에 **🕯 분위기** 버튼을 둬(같은 크기·위치, room-bigger에서 옮긴 자리 그대로). 아이콘은 이모지 대신 작은 촛불 SVG를 `public/assets/room/ui/icon-mood.svg`로 만들어 써도 돼(기존 `icon-save.svg`와 같은 선 굵기·색 #F3E9D7).
- 누르면 버튼 아래에 작은 카드(폭 약 220px)가 떠. 바깥을 누르거나 다시 누르면 닫혀. 꾸미기 모드·사진 찍기·방 구경 중에는 버튼을 숨겨.
- 카드 안 순서:
  1. **그림자** 켜기/끄기 스위치 — 지금 그림자 버튼과 똑같이 동작(저장 방식 그대로).
  2. **밝기** 3칸 버튼: 「밝게 · 보통 · 아늑하게」 (기본 보통)
  3. **방 소리** 스위치 + 작은 글씨로 지금 방 소리 이름(예: "벽난로 타닥 · 창밖 바람")
- 화면 문구에 포인트·출금·인출·토스포인트·P는 쓰지 마.

## 2. 밝기 3단계
- 방마다 따로 폰에 저장해(예: localStorage `lucky-cat.room-mood.v1` = `{ [roomId]: { bright: "bright"|"normal"|"cozy", sound: boolean } }`). 서버 저장본에는 넣지 않아도 돼.
- 지금 아침·낮·노을·밤(`is-tod-*`) 변화 **위에 겹쳐서** 적용해. 섬(`.lucky-island`) 래퍼에 클래스 `is-mood-bright` / `is-mood-cozy` 를 붙이는 방식으로:
  - 밝게: 방 그림 레이어에 `filter: brightness(1.1)`
  - 보통: 지금 그대로
  - 아늑하게: 방 그림 레이어 `filter: brightness(0.8) saturate(1.05)` + 램프 불빛(`.lucky-lamp-glow`, `.lucky-item-glow`)의 opacity를 1.5배(최대 1)로. 낮 시간대에도 아늑하게면 램프 불빛이 은은하게 보이게 해 줘.
- filter는 고양이·말풍선·UI에는 걸리지 않게 방 그림 레이어에만 걸어 줘. 고양이 스무스 이동(ref·rAF)과 방 넘기기 최적화가 느려지지 않게, filter는 섬 전체 래퍼 1곳에만 두고 매 프레임 바꾸지 마.
- 사진 찍기(`roomPhoto`)에도 지금 밝기가 그대로 찍혀야 해.

## 3. 방 소리 (환경음)
- 파일(이미 들어 있음, CC0 확인됨, 출처는 `docs/sounds-license.md`):
  - `public/assets/audio/ambience-moon_bedroom.(m4a|mp3)` 귀뚜라미 + 시계 째깍, 32초
  - `ambience-cat_cafe` 카페 웅성임 + 컵 소리, 40초
  - `ambience-sakura_greenhouse` 새소리 + 살랑 바람, 40초
  - `ambience-winter_cabin` 벽난로 타닥 + 창밖 바람, 56초
- `public/assets/audio/sounds.json` 에 `ambience` 묶음을 추가해: 각 `{ "file": "ambience-<roomId>", "volume": 0.2, "loopStart": 0, "loopEndSec": <길이> }` (카페 0.22, 오두막 0.2, 침실 0.18, 온실 0.2). 그리고 방 이름 표시용 `labelKo`도 넣어 줘.
- `src/audio/AudioManager.ts`에 BGM과 **따로** 도는 환경음 채널을 하나 추가해(`setAmbience(roomId | null)`, `isAmbienceEnabled`/`setAmbienceEnabled`).
  - BGM 켜짐/꺼짐(`lc.audio.bgm`)과 상관없이, 분위기 창의 방 소리 스위치로만 켜져. **기본은 꺼짐**이야.
  - BGM과 같이 들릴 수 있어. 둘 다 켜져 있으면 환경음 볼륨을 0.7배로 줄여 줘.
  - 광고 중(`onAdOpen`)·앱이 가려질 때(pagehide/visibility)는 BGM처럼 끄고, 돌아오면 다시 켜. 방꾸미기 화면을 나가면 꺼(다른 화면에서는 안 들려).
  - 방을 넘기면 새 방 소리로 0.6초 크로스페이드. 꾸미기 모드에서도 계속 들려. 사진 찍기 중에도 그대로.
  - AudioContext unlock(첫 터치) 전에는 재생하지 말고 기다렸다가 켜.
  - m4a를 먼저, 안 되면 mp3(지금 BGM과 같은 `formats` 규칙). 파일은 방에 처음 들어갈 때만 받아(미리 4개 다 받지 마).
- 설정 화면의 효과음/배경음 스위치는 그대로 두고, 설명 한 줄만 추가: "방 소리는 방꾸미기 분위기 창에서 켜요".

## 4. 꼭 지켜 줘
- room-bigger의 좌표 변환(`clientToStage`/`stageToClient`), 확대·이동, 고양이 스무스 이동, 방 넘기기 최적화, 벽지·바닥 자르기, 구매 ID 매핑(`wall_`/`floor_`), 하단 탭, 출석·세트 연출, 저장·초기화·되돌리기는 지금처럼 동작해야 해.
- 뒤로가기 버튼은 추가하지 마. appName은 `lucky-cat` 그대로야. 서버(Supabase)·SQL은 건드리지 마.

## 5. 확인
- 360×756, 412×915 폰 크기에서: 분위기 버튼이 COZY 칩·방 이름 칩과 겹치지 않고, 카드가 화면 밖으로 나가지 않아.
- 밝게/보통/아늑하게가 방마다 따로 저장되고, 앱을 다시 열어도 유지돼. 아침·낮·노을·밤 4시간대 모두에서 자연스러워.
- 방 소리: 처음엔 꺼짐 → 켜면 그 방 소리, 방 넘기면 바뀜, 홈으로 가면 꺼짐, 광고 보고 오면 다시 켜짐. 32~56초 반복할 때 끊기는 소리가 없어.
- `npm run build` 와 기존 테스트가 통과해야 해.

작업이 끝나면 main 브랜치에 머지해 줘.
