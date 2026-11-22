# COZY 레벨 선물 (A) + 오늘의 가구 (E)

방꾸미기에 두 기능을 추가해 줘. 둘 다 **서버(wallet 함수)가 금액을 정하고**, 앱은 서버 결과만 보여 줘.
승인된 시안: `docs/mockups/room-improve/A-cozy.png`, `docs/mockups/room-improve/E-today.png`
규칙 메모: `docs/mockups/room-improve/plan-memo.md`의 "A. COZY 레벨 선물", "E. 오늘의 가구"
서버는 이미 준비돼 있어(새 wallet 동작: `cozy_status`, `cozy_claim`, `deal_list`, `deal_refresh`, 할인 구매 rewardId `roomDeal:…`). 서버 코드·SQL은 건드리지 마.

## 0. 먼저 확인 (꼭 이 순서로)
1. **압축 폴더 위치 바로잡기**: 저장소 맨 위에 `room-bigger/` 나 `room-improve/` 폴더가 있으면, 그 안의 `public/…` 는 맨 위 `public/…` 같은 자리로, `docs/…` 는 맨 위 `docs/…` 같은 자리로 옮기고 빈 폴더는 지워 줘. 옮긴 뒤 `public/assets/room/themes/cozy/items-cozy.json` 이 있어야 해.
2. **방 크게 보기(room-bigger)**와 **분위기 창(room-mood)** 작업이 먼저 들어가 있어야 해. `clientToStage` helper나 분위기 버튼이 없으면 이 작업은 하지 말고 "room-bigger, room-mood 먼저 적용해 주세요"라고만 알려 줘.

---

## A. COZY 레벨 선물

### 규칙 (서버가 정함 — 앱은 숫자를 계산해서 주지 마)
- COZY Lv.11부터 레벨이 오를 때마다 발바닥 젤리 50개가 **편지함**으로 와.
- Lv.15·20·25에는 **COZY 한정 소품** 1개 + 젤리 50개가 더 붙어: 오로라 스노우글로브(`cozy_aurora_globe`) · 별빛 냥이 쿠션(`cozy_star_cushion`) · 황금 냥이 액자(`cozy_gold_frame`).
- 이미 레벨이 높은 사람은 처음 한 번 지난 레벨 선물을 편지 1통으로 받아(젤리 최대 1,000개, 한정 소품은 다).

### 할 일
1. **한정 소품 카탈로그**: `public/assets/room/themes/cozy/items-cozy.json`(그림·크기·기준점 포함)을 `roomCatalog.ts`에서 출석 한정 아이템(`items-attendance.json`)과 **같은 방식으로** 합쳐 줘.
   - 표시: 「COZY 한정」 태그(출석 한정 태그와 같은 모양, 색만 보라/금색), 최대 1개, 상점·가격 없음, 되팔기 없음.
   - 서랍 "보유" 탭과 원래 분류 탭(소품/벽 꾸미기)에 가지고 있을 때만 보여. 안 가졌으면 상점 목록에도 안 보여.
   - `prices.json`에는 넣지 마. **COZY 점수 계산(`computeCozyPointsFromOwned`)에서 `cozyOnly` 아이템은 빼 줘**(서버 계산과 맞추려고).
   - 오늘의 가구·방 열기 선물·출석 상자 풀에 절대 들어가면 안 돼.
2. **서버 호출** (`src/lib/serverWallet.ts`에 기존 `postWallet` 방식 그대로 추가):
   - `cozyStatus()` → `{ level, points, claimedLevel, fromLevel, perLevel, milestones: { "15": "cozy_aurora_globe", … }, retroCap, items: string[] (받은 한정 소품), waitingItems: string[] (편지함에 있는 것) }`
   - `cozyClaim(owned?)` → `{ sent, fromLevel, toLevel, jelly, items, capped, level, claimedLevel }`
     - `owned`는 **처음 한 번만** 보내는 "서버 전 구매 인정"용이야: 방 저장본의 `owned` 개수 지도(`{아이템id: 개수}`) + `ops.ownedItemIds`(각 1개)를 합친 것. 서버가 1번만 받고 한도(값어치 50,000)를 둬. 폰에 "보냈음" 표시(localStorage `lucky-cat.cozy-legacy-sent.v1`)를 남기고, 그 뒤에는 출석·애정도 선물 id만 담아 보내(서버가 그것만 믿어).
   - 서버 꺼짐/오프라인이면 조용히 넘어가(에러 토스트 없이).
3. **언제 부르나**: 방꾸미기 화면에 들어올 때 1번, 가구를 산 뒤(디바운스 2초) 1번 `cozyClaim`. `sent`가 true면 편지함 숫자 배지를 새로고침(`refreshMailbox`)하고 nyNotify로 "COZY Lv.N 선물이 편지함에 도착했어요" 한 번.
4. **편지 받기**: `mailbox_claim` / `mailbox_claim_all` 응답에 새로 `cozyItems: string[]`가 붙어. `src/lib/mailbox.ts`의 `applyPaid`에서 이 아이템들을 `ops.ownedItemIds`에 더하고(이미 있으면 그대로), 방 저장본 `owned`에도 1개로 넣어 줘(출석·애정도 선물이 들어오는 방식과 같게). 받은 뒤 "COZY 한정 소품을 받았어요 · 서랍 보유 탭에 있어요" 안내.
   - 복구: 방꾸미기에 들어올 때 `cozyStatus().items`에 있는데 폰에 없는 한정 소품은 조용히 다시 넣어 줘(폰을 바꾼 경우).
5. **COZY 시트(`CozySheet.tsx`) 아래에 "레벨 선물" 줄** (시안 A-cozy.png):
   - 가로로 넘기는 작은 칸: Lv.11 … Lv.25 (지난 칸은 ✓, 다음 칸은 강조, 15·20·25 칸은 한정 소품 썸네일 `themes/cozy/thumbs/*.webp`).
   - 위에 한 줄: "다음 선물: Lv.{n} · 발바닥 젤리 50" (15·20·25면 "+ 한정 소품").
   - 버튼 "편지함 열기"(편지가 있으면) — 기존 편지함 화면으로 이동.
   - 레벨 숫자는 화면의 COZY 레벨(폰 계산) 그대로 쓰고, 선물 칸의 ✓는 서버 `claimedLevel` 기준으로 그려. 서버 레벨이 폰보다 낮으면 작은 글씨로 "서버 기록을 확인하는 중이에요"만 보여 줘.

---

## E. 오늘의 가구

### 규칙 (서버가 정함)
- 한국 시간 하루마다 3개: 큰 가구 1개 **30%**, 나머지 2개 **20%**. 할인가는 10 단위 내림(예: 컵 캣타워 650 → 520).
- 각 할인 가구는 그날 **1번만** 할인가로 살 수 있어. 2번째부터는 정가(기존 구매)야.
- 광고 보고 다시 고르기는 **하루 1번**. 다시 고르면 3개가 모두 바뀌어.

### 할 일
1. **서버 호출** (`serverWallet.ts`):
   - `dealList()` → `{ date: "YYYY-MM-DD", items: [{ itemId, pct, price, salePrice, bought }], refreshesLeft, resetAt }`
   - `dealRefresh()` → 같은 모양. 에러 `refresh_used`면 "오늘은 이미 다시 골랐어요".
2. **꾸미기 서랍 첫 탭 "오늘의 가구"** (시안 E-today.png): `ROOM_TABS` 맨 앞(보유 앞)에 추가. 꾸미기 모드로 들어오면 처음엔 이 탭이 열려(튜토리얼 중에는 지금처럼 튜토리얼 탭).
   - 카드 3장: 그림, 이름, `30%` 또는 `20%` 배지(30%는 "특가" 리본), 정가 취소선 + 할인가 + 발바닥 젤리 아이콘, 이미 샀으면 "오늘 할인 구매 완료".
   - 위에 "매일 밤 12시에 바뀌어요 · 남은 시간 HH:MM" (서버 `resetAt` 기준, 1분마다 갱신).
   - 아래에 "광고 보고 다시 고르기 (오늘 1번)" 버튼 — 지금 발바닥 젤리 광고와 같은 **짧은 보상형 광고** 흐름(`playTossFullScreenAd("short", …)`)을 쓰고, 광고가 끝나면 `dealRefresh()`. 광고 실패/취소면 부르지 마. 남은 횟수 0이면 버튼 비활성.
   - 카드를 누르면 기존 구매 확인 시트를 열되 가격을 할인가로 보여 줘.
3. **할인 구매**: 서버 젤리가 켜져 있을 때 rewardId를 `roomDeal:${spendId}:${date}:${newRequestId("deal")}`로 `jellySpend` 해.
   - `spendId`는 지금 일반 구매와 같은 `roomSpendItemId(prices, item.id)`, `date`는 `dealList()`가 준 날짜.
   - 성공하면 일반 구매 성공과 **똑같이** 처리(`ops.ownedItemIds`, 방 `owned`, `finishBuy`, COZY 재계산, 그 뒤 `cozyClaim` 디바운스).
   - 에러: `DEAL_USED` "오늘 이 가구는 이미 할인으로 샀어요" / `DEAL_EXPIRED` "날짜가 바뀌었어요. 새 목록을 불러올게요"(→ `dealList()` 다시) / `DEAL_NOT_FOUND` 같음 / 잔액 부족은 기존 문구.
   - 서버 젤리가 꺼진 환경(로컬 개발)에서는 이 탭을 숨겨.
4. **배너 광고**: `public/config/economy.json` → `ads.banner`에 `"roomDeal": { "adGroupId": "ait.v2.live.1acc32a6f5004806" }`를 추가하고(도감과 같은 광고 그룹), `BannerPlacement` 타입에 `roomDeal`을 넣어. **오늘의 가구 탭 카드 아래에만** `<BannerAdSlot placement="roomDeal" />` 1개. 다른 꾸미기 탭에는 넣지 마. 서랍 높이(room-bigger에서 정한 접힘/펼침 높이)를 넘지 않게, 배너가 안 뜨면 자리도 접혀.

---

## 꼭 지켜 줘
- 금액·할인율·레벨 선물은 앱이 정하지 마. 서버가 준 값만 보여 줘.
- room-bigger(좌표 변환·확대·한 줄 서랍), room-mood(분위기 창), 고양이 스무스 이동, 방 넘기기 최적화, 벽지·바닥 자르기, 구매 ID 매핑(`wall_`/`floor_`), 출석·세트 연출, 방 구경, 편지함(주간 미션·초대 편지)은 지금처럼 동작해야 해.
- 화면 문구는 "발바닥 젤리"로 써. 포인트·출금·인출·토스포인트·P는 쓰지 마. 뒤로가기 버튼은 추가하지 마. appName은 `lucky-cat` 그대로야.
- 서버(Supabase) 코드·SQL은 건드리지 마.

## 확인
- 360×756, 412×915 폰 크기에서: 오늘의 가구 카드 3장 + 배너가 서랍 안에 들어가고, 글자가 잘리지 않아. COZY 시트의 레벨 선물 줄이 옆으로 잘 넘겨져.
- 로컬 모의 서버(있다면)나 테스트로: 레벨이 11 넘으면 편지 1통 → 받으면 젤리 + (15레벨 넘었으면) 한정 소품이 서랍 보유 탭에 1개. 같은 레벨 편지가 두 번 오지 않아.
- 할인 구매: 할인가만큼만 줄고, 같은 가구 두 번째는 할인 안 됨. 다시 고르기는 하루 1번.
- `npm run build` 와 기존 테스트가 통과해야 해.

작업이 끝나면 main 브랜치에 머지해 줘.
