# 고양이 최애 가구 (C)

품종마다 **최애 가구**가 있어서, 그 가구가 방에 있으면 고양이가 더 자주 가고, 오르면 특별 연출이 나오게 해 줘. 서버 작업은 없어(애정도는 지금처럼 폰 저장본에 저장돼).
승인된 시안: `docs/mockups/room-improve/C-favorite.png`, 규칙 메모: `docs/mockups/room-improve/plan-memo.md`의 "C. 고양이 최애 가구".

## 0. 먼저 확인 (꼭 이 순서로)
1. **압축 폴더 위치 바로잡기**: 저장소 맨 위에 `room-bigger/` 나 `room-improve/` 폴더가 있으면, 그 안의 `public/…` 는 맨 위 `public/…` 같은 자리로, `docs/…` 는 맨 위 `docs/…` 같은 자리로 옮기고 빈 폴더는 지워 줘. 옮긴 뒤 `public/assets/room/cat-favorites.json` 과 `public/assets/room/cat/favorite/cheese.webp` 가 있어야 해.
2. **room-bigger, room-mood, room-cozy-deal** 작업이 먼저 들어가 있어야 해. 없으면 이 작업은 하지 말고 "앞 작업 먼저 적용해 주세요"라고만 알려 줘.

## 1. 데이터 (이미 들어 있음)
- `public/assets/room/cat-favorites.json`: 23품종마다 `itemId`(최애 가구), `lines`(말풍선 2줄), `hint`(못 찾았을 때 힌트), `card`/`thumb`(그림, 없으면 null).
  - 예: 치즈냥 → 니트 담요 의자(`knit_chair`) 「여기 최고다냥…♡」 「담요 냄새 좋아」
  - 파일 모양: `favorites` 배열(23개, 각 `catId`·`catNameKo`·`itemId`·`itemNameKo`·`lines`·`hint`·`card`·`thumb`), `seatWeightMul`, `affection`.
- 카드 그림(치비, 표정 풍부, 투명 배경): `public/assets/room/cat/favorite/{cheese,korean_shorthair,russian_blue,ragdoll,scottish_fold,munchkin}.webp` (640px), 썸네일 `…/favorite/thumbs/*.webp` (160px).
- 나머지 17품종은 `card: null` → 기존 고양이 스프라이트의 happy 프레임 + 하트로 카드를 만들어 줘(나중에 그림 파일만 넣으면 바뀌게, 경로 규칙 `cat/favorite/<catId>.webp` 고정).

## 2. 방에서 동작
1. **자리 고르기 가중치**: 지금 최애냥의 하트 쿠션 침대처럼(`seatBias`, `seatWeightMul 4`) 고양이가 앉을 자리를 고를 때, **그 고양이 품종의 최애 가구**가 방에 있으면 가중치 ×4.
   - `seatBias`를 배열로 바꿔 한 고양이가 여러 자리를 좋아할 수 있게 해 줘. 최애냥은 하트 침대(애정도 Lv.7 이상일 때)와 자기 최애 가구 **둘 다** 좋아해. 지금 하트 침대 규칙은 그대로야.
   - 방에 고양이가 여러 마리면 각자 자기 최애 가구에만 가중치. 같은 가구를 두 마리가 노리면 지금 자리 겹침 규칙 그대로(먼저 간 고양이 우선).
   - 최애 가구는 이미 고양이가 올라가는 가구(`cat-seats.json`에 자리 있는 23종)라서 앉는 위치는 지금 데이터를 그대로 써.
2. **오르면 특별 연출** (약 3초, 한 번 앉을 때 1번):
   - 기존 happy 프레임(또는 가장 행복한 프레임) + 하트·반짝이 2~3개가 위로 떠오름.
   - 말풍선: 그 품종 `lines` 중 하나(지금 최애냥 말풍선과 같은 모양·위치 계산). 같은 말풍선이 연속으로 나오지 않게.
   - 고양이 스무스 이동(ref·rAF로 style 직접 쓰기) 구조를 깨지 마. 연출 중에도 React state를 매 프레임 바꾸지 마.
3. **애정도 +5 (하루 1번)**: 지금 정한 최애냥(`ops.affection.catId`)이 **자기 최애 가구에 오르면** 애정도 출처 `favSeat`로 +5, 한국 시간 하루 1번.
   - `public/config/economy.json` → `affection.sources`에 `"favSeat": { "xp": 5, "perDay": 1 }` 추가. 하루 상한(dailyCap 75)은 그대로.
   - `src/lib/affection.ts`: `SOURCES`/`emptyToday`/저장 정리(`countOf`)/두 저장본 합치기에 `favSeat`를 넣고, `affectionConfig`가 `favSeat` 없는 예전 설정도 받아들이게(지금 4개 출처 검사 그대로, `favSeat`는 선택).
   - 최애냥이 아닌 고양이는 연출만 나오고 애정도는 없어.

## 3. 처음 발견 카드
- 그 품종이 자기 최애 가구에 **처음** 오르면 「최애 가구 발견!」 카드를 1번 보여 줘(시안 C-favorite.png):
  - 큰 카드 그림(`card` 또는 happy 프레임 대체), "{고양이 이름}의 최애 가구는 {가구 이름}!", 말풍선 1줄, [좋아요] 버튼.
  - 방 넘기기·꾸미기 중이면 보기 모드로 돌아온 뒤에 보여 줘. 출석·세트 완성 연출과 겹치면 그 뒤에 차례로.
- 발견 기록은 ops 저장본에 `favoriteFound: { [catId]: "YYYY-MM-DD" }`로 남겨(서버 저장본에도 같이 올라가게 기존 ops 저장 흐름 그대로). 두 저장본 합칠 때는 합집합.

## 4. 도감 기록
- 도감 고양이 상세(품종 카드) 아래에 한 줄: 찾았으면 "최애 가구: {가구 이름}" + 작은 썸네일(`thumb`, 없으면 가구 썸네일), 못 찾았으면 "최애 가구: ?" + 회색 글씨 힌트(`hint`).
- 방꾸미기 "고양이 친구" 탭의 고양이 칸에도 찾은 고양이는 작은 하트 표시.

## 5. 꼭 지켜 줘
- room-bigger(좌표 변환·확대), room-mood(분위기 창·방 소리), COZY 레벨 선물·오늘의 가구, 하트 쿠션 침대·애정도 기존 규칙, 고양이 스무스 이동, 방 넘기기 최적화, 방 구경은 지금처럼 동작해야 해.
- 화면 문구에 포인트·출금·인출·토스포인트·P는 쓰지 마. 뒤로가기 버튼은 추가하지 마. appName은 `lucky-cat` 그대로야. 서버(Supabase)·SQL은 건드리지 마.

## 6. 확인
- 360×756, 412×915 폰 크기에서 발견 카드·말풍선·도감 한 줄이 잘리지 않아.
- 최애 가구를 놓으면 그 고양이가 눈에 띄게 자주 가(가중치 4배). 오르면 연출 + 말풍선. 처음 한 번만 발견 카드.
- 최애냥이 자기 최애 가구에 오르면 애정도 +5, 같은 날 두 번째는 0. 하루 상한 75를 넘지 않아.
- 그림이 없는 17품종도 카드가 깨지지 않아(happy 프레임 대체).
- `npm run build` 와 기존 테스트가 통과해야 해.

작업이 끝나면 main 브랜치에 머지해 줘.
