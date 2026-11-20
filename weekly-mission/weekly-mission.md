# Cursor 프롬프트 — 주간 미션 보드 (행운냥)

아래 전체를 Cursor에 붙여 넣으세요. **앱 코드만** 바꾸세요. 서버(표·wallet 함수)는 `weekly-mission-server.zip` 으로 따로 준비되어 있고, 원따이님이 대시보드에서 이미 SQL 실행·Deploy 한 뒤여야 합니다. 저장소 안에 `supabase/functions` 나 SQL 을 새로 만들지 마세요.

규칙:
- 뒤로가기 버튼(`DevBackButton` 등)을 새로 만들지 마세요. 창은 바깥 탭·기존 닫기(X)·기기 뒤로가기로 닫습니다.
- `appName`은 `lucky-cat` 그대로 유지하세요.
- 화면 문구에 **포인트 / 토스포인트 / 출금 / 인출 / "P"** 를 쓰지 마세요. 재화 이름은 **발바닥 젤리**(짧게 **젤리**)와 **냥코인**입니다.
- 새 환경 변수·유료 서비스·새 패키지를 추가하지 마세요. 서버 호출은 기존 `wallet` 함수 하나만 씁니다.
- 선물 금액은 **전부 서버가** 정합니다. 특히 **냥코인 20은 서버 장부(`wallet_earn`)로만** 올라가야 합니다. 앱이 `ops` 나 화면에 숫자를 더하면 안 됩니다. 젤리도 서버 잔액을 따릅니다.

**다른 프롬프트와 파일이 겹칩니다.** `src/components/MenuPanel.tsx`, `src/components/MenuPanel.css` 는 `menu-layout-fix.md`(시트 여백·스크롤바 숨김·출석 버튼 위치)와 `reward-toss-badge.md`(보상함 줄의 금화 말풍선)가 같은 파일을 만집니다. 그 작업이 이미 적용되어 있으면 **되돌리거나 덮어쓰지 마세요.** 주간 미션 줄·주간 시트·뽑기권 보유 문구만 더하세요. 아직 적용 전이면 그 프롬프트의 수정을 전제로 삼지 말고, 지금 파일 위에 주간 미션만 안전하게 더하세요.

---

## 시안과 그림 zip

`weekly-mission.zip` 을 **저장소 맨 위 폴더**(`package.json`이 있는 곳)에 풀어 넣으세요. 자세한 경로는 zip 안의 `풀어넣기.md`.

- 그림(그대로 쓰기, 새로 그리지 않기):
  - `public/assets/menu/icon-weekly.svg` — 메뉴 줄 아이콘
  - `public/assets/weekly/claim-cat.webp` — 상자 받기 축하 창의 고양이(발바닥 젤리를 들고 있어요. 금화를 든 옛 그림으로 바꾸지 마세요)
- 시안(참고용, **빌드에 넣지 않음**): `docs/mockups/weekly-mission/`
  - `01-board.png` 주간 미션 보드 (진행 6/9, 3도장 받음, 6도장 받기)
  - `02-claim.png` 6도장 축하 창 (젤리 50 + 확률업 뽑기권 1장)
  - `03-menu-entry.png` 메뉴 「주간 미션」 줄 (오늘의 미션 바로 아래, 6/9 · 선물 도착, 설정이 한 화면에 보임)

---

## 지금 코드 (이 파일들을 기준으로 고치세요)

- 메뉴: `public/assets/menu/menu.json` 의 `sections[id=daily].rows` (지금 `missions`, `attendance`, `points`, `exchange`, `ticketShop`, `rewards`), `rows.missions`(오늘의 미션). 주간 줄이 아직 없습니다.
- 메뉴 UI: `src/components/MenuPanel.tsx`, `src/components/MenuPanel.css`, `src/lib/menuModel.ts`, `src/lib/menuTypes.ts`
- 날짜: `src/lib/date.ts` 의 `toKstDateKey`, **`toKstMondayWeekKey`** (월요일 00:00 KST 주 키). 출석의 신뢰 시각은 `src/lib/attendanceServer.ts` 의 `trustedKstDateKey()`
- 오늘의 미션: `src/lib/dailyMissions.ts` (`bumpMission`, `reconcileMissions`, `drewToday`), `src/lib/opsRewards.ts`, `src/lib/opsState.ts`, `src/App.tsx`(부팅 시 `reconcileMissions`, 방 입장 `onRoomOpened`에서 `room_1` bump, `beginDraw`)
- 쓰다듬기: `src/lib/affection.ts`, `src/screens/RoomScreen.tsx` 의 `petFavorite`
- 방 꾸미기 저장: `src/screens/RoomScreen.tsx` 의 `finishEditSaved`(사용자가 「저장했어요」를 눌렀고 저장이 성공한 경우). 가구 ✓ `confirmPreview` / `commitPlacement` 나 방 입장만으로는 주간 미션이 아니에요.
- 서버 저장: `src/lib/serverSave.ts` (`markDirty`, `markDirtyUrgent`, `markDirtyLifecycleOnly`). 미션 진행이 바뀌면 **긴급 저장 + 실패 시 재시도**를 하세요.
- 서버 호출: `src/lib/serverWallet.ts` 의 `postWallet` — hash·apikey·`x-save-token`, `save_token_invalid` 면 토큰 갱신 후 1번 재시도. 토스가 아니거나 `local-dev` 면 호출 안 함. 친구 초대는 같은 파일의 `fetchInviteStatus` / `claimInvite` 패턴을 따르세요.
- 젤리 표시: `src/lib/serverJelly.ts` (`rememberJelly` 등)
- 뽑기권: `config/economy.json` 의 `tickets.rateUpTicket.maxHold` **3** (상점·출석·초대 한도는 그대로 3). 보유 수는 ops `rateUpTickets`. 상점 표시는 `src/lib/mockTicketShop.ts`, 메뉴 상점 시트 `MenuPanel.tsx` 약 1681행 `{ticketsHeld}/{maxHold}`, 메뉴 줄 메타는 `menuModel.ts` 약 159행 `보유 ${shop.ticketsHeld}장`, `menu.json` 상점 카드 `format`: `"{held}/{maxHold}"`
- 초대 완료 여부: `src/lib/invite.ts` / 서버 `invite_status` (이번 주에 보상까지 끝난 초대가 있으면 주간 선택 미션 달성)

---

## 결정 (그대로 따르세요)

### 미션 (한 주, 도장 합계 9)

| 미션 | 목표 | 도장 |
|---|---|---|
| 출석하기 | 5일 | 2 |
| 카드 뽑기 | 20장 | 2 |
| 고양이 쓰다듬기 | 10번 | 1 |
| 오늘의 미션 다 깨기 | 3일 | 2 |
| 방 꾸미기 저장 | 1번 | 1 |
| 젤리 광고 보기 | 20회 | 1 |
| 친구 초대하기 (선택) | 1명 | 없음, 보너스 젤리 20 |

선택 미션은 보드 맨 아래, 도장 알약이 아니라 「선택 · 젤리 20」처럼 표시하세요(시안 01).

### 상자

- 3도장: 젤리 50
- 6도장: 젤리 50 + 확률업 뽑기권 1장
- 9도장: 젤리 100 + 냥코인 20
- 전용 소품 없음. 이미 받은 상자는 체크, 아직이면 「받기」, 도장이 모자라면 잠긴 표시.

### 뽑기권 한도

- **주간 6도장 상자만** 보유 한도 3장을 넘어 **최대 4장**까지 줄 수 있어요.
- 상점 / 출석 / 친구 초대는 **3장 한도 유지**. 이미 4장이어도 추가 지급 없음(기존 fallback: 상점은 구매 불가, 출석·초대는 지금처럼 뽑기권 없이 다른 보상만).
- 메뉴 뽑기권 줄은 「보유 4장」(장 수만, 분모 없음).
- 한도를 분수로 보여줄 때 **절대 `4/3` 금지**. 3장 이하는 지금처럼 `3/3`, 4장이면 **`4장 (보너스 1장 포함)`**.
- 상점 비활성 문구는 한도 3장을 기준으로 두어도 됩니다. 「4/3」만 쓰지 마세요.

### 리셋·자동 지급

- 매주 **월요일 00:00 한국 시간**. 주 키는 기존 `toKstMondayWeekKey` 와 같고, 기준 시각은 출석과 같이 **서버가 믿을 수 있는 KST**(`trustedKstDateKey` 또는 `weekly_status` 의 `weekKey` / `today`). 폰 시계만 믿지 마세요.
- 주가 끝난 뒤 안 받은 상자는 **다음 앱 실행 때 자동 지급**(같은 보상 번호는 한 번만). 받는 즉시 짧은 축하/안내(「지난 주 선물을 받았어요」)를 띄워도 됩니다. 직전 주만 자동 지급하고, 그 이전은 서버가 거절합니다.
- 이전 주 진행 스냅샷은 자동 지급이 끝날 때까지 지우지 마세요.

### 메뉴

- 오늘의 미션 **바로 아래**에 「주간 미션」 줄 (`menu.json` 의 `rows.weeklyMissions`, `sections` daily rows 에서 `missions` 다음).
- 오른쪽 메타: `6/9 · 선물 도착` 또는 받을 게 없으면 `6/9 · 월 0시에 리셋`처럼 짧게. 받을 상자/보너스가 있으면 아이콘에 빨간 점.
- 줄을 누르면 기존 `.menu-sheet` 틀로 주간 보드 시트를 엽니다(시안 01). 새 전체 화면을 만들지 마세요.

---

## 서버 API (wallet 함수, 이미 준비됨)

`src/lib/serverWallet.ts` 에 `fetchWeeklyStatus` / `syncWeeklyProgress` / `claimWeeklyChest` 를 초대 함수와 같은 패턴으로 추가하세요. `postWallet` 로 부릅니다.

1. `weekly_status` — `{}`
   - 응답: `{ ok, enabled, weekKey, prevWeekKey, today, resetAt, rules:{chest3Jelly,chest6Jelly,chest9Jelly,chest9Nyang,inviteJelly,ticketMaxHold}, current, previous }`
   - `current` / `previous` 는 없거나 `{ weekKey, attendDates, draws, petsByDate, dailyClearDates, roomSaved, jellyAdsByDate, inviteDone, stamps, claimed, inviteClaimed, ticketGranted }`
   - 저장 전(`save_not_found`)에도 동작합니다. `allowMissing` 은 false 로. (저장이 이미 있는 계정에 토큰 없이 부르면 `save_token_invalid` 이 납니다. 부팅 후 토큰과 함께 다시 부르세요.)
2. `weekly_sync` — `{ weekKey, progress }`
   - `progress`: `{ attendDates: string[], draws: number, petsByDate: { [YYYY-MM-DD]: number }, dailyClearDates: string[], roomSaved: boolean, jellyAdsByDate: { [YYYY-MM-DD]: number }, inviteDone: boolean }`
   - 서버가 **큰 쪽·날짜 합집합**으로 합칩니다. 작은 숫자로 덮이지 않습니다. 저장 토큰 필요(`allowMissing` true 로 저장이 없으면 먼저 저장).
   - 응답 `{ ok, week: <위 진행 객체> }`
3. `weekly_claim` — `{ weekKey, kind: "3"|"6"|"9"|"invite", ticketsHeld: 지금 rateUpTickets }`
   - 응답 `{ ok, already, kind, weekKey, jelly, nyangCoin, ticketKeys: string[], jellyBalance, nyangCoinBalance, week }`
   - 실패 `error`: `not_ready`, `week_invalid`, `disabled`, `blocked`, `bad_input`
   - 몇 번 불러도 같은 상자는 한 번만 나갑니다. `already:true` 이면 젤리·냥코인 금액은 0입니다.
   - 6도장 뽑기권: `ticketKeys` 예 `["weeklyChest:<weekKey>:6"]`. **같은 키는 한 번만** `rateUpTickets` 에 더하세요(초대 `ticketKeys` 와 동일). `already` 재시도에도 키가 다시 올 수 있으니, 키로 중복을 막아야 앱이 중간에 꺼져도 뽑기권이 유실되지 않습니다. 이미 4장이면 서버가 빈 배열을 줍니다.
   - 냥코인은 응답의 `nyangCoin` / `nyangCoinBalance` 와 기존 지갑 새로고침만 쓰세요. 로컬에 +20 하지 마세요.

보상 번호(참고, 앱이 만들지 않음): 젤리 `weeklyChest:<weekKey>:3|6|9`, `weeklyInvite:<weekKey>` / 냥코인 `weeklyChestNyang:<weekKey>:9`.

로컬 개발(`local-dev`, wallet 호출 안 함)에서는 보드·집계·시트는 동작하되, 실제 젤리·냥코인 지급은 하지 않거나 "서버가 필요할 때 받을 수 있어요" 수준으로 두세요. 로컬에서 냥코인을 더하면 안 됩니다.

---

## 가장 중요한 일: 미션이 빠지면 안 됩니다

사용자는 **미션을 수행했는데 수행되지 않은 것처럼 보이면 안 됩니다.** 아래를 그대로 구현하세요.

### 집계 원칙

- 진행은 **권위 있는 기록**에서 다시 세요. 기억용 카운터만 올리고 끝내지 마세요.
- **앱을 열 때**, 그리고 **각 행동이 성공한 직후**에 주간 진행을 재계산하고 `weekly_sync` 로 서버와 맞추세요(디바운스 가능, 성공 직후는 긴급 저장).
- 로컬과 서버는 **max / 날짜 합집합**. 폰이 두 대여도 작은 쪽이 큰 쪽을 덮지 않습니다.
- 날짜·주 키는 서버 KST 를 우선합니다.

### 주간 로그 (새 모듈 `src/lib/weeklyMissions.ts`)

요일별로 남기고, 주가 바뀌면 새 키로 분리하세요.

- 출석일: 이번 주 `attendDates` (출석 수령 성공·장부 `attDay:` / `att7Paw:` 로도 보강)
- 뽑기 수: 이번 주 성공한 뽑기 **전부** (일반 광고 뽑기, 확률업 광고 뽑기, **뽑기권 뽑기**, **튜토리얼 첫 뽑기**). `lifetimeDraws` 증가가 확정된 시점만.
- 쓰다듬기: `petsByDate[날짜]`. `petFavorite` 가 실제로 쓰다듬기를 반영한 성공만. (하루 횟수 한도는 기존 affection 규칙을 따름. 주간은 그 성공 횟수의 합)
- 오늘의 미션 완료일: 그날 오늘의 미션을 **모두 깬 날**만 `dailyClearDates` 에 넣기
- 방 꾸미기 저장: `finishEditSaved` **저장 성공** 한 번만 `roomSaved=true`. 방 입장(`onRoomOpened`), 사진 저장, 튜토리얼 ✓, 미리보기 확정만으로는 안 칩니다.
- 젤리 광고: `jellyAdsByDate[날짜]`. 젤리 광고 적립이 **성공한 횟수**만 (장부 `adPawJelly:` 로도 보강 가능)
- 친구 초대: 이번 주에 초대 보상이 확정되었거나, 이미 초대를 완료한 기록이 있으면 `inviteDone=true` (서버/초대 모듈 기준으로, 추측 금지)

이 로그를 ops-state 에 주 키와 함께 저장하고, `recountWeekly(state, weekKey)` 로 도장을 다시 계산하세요. 카운터를 "이번에 +1" 만 하고 로그와 어긋나면 로그가 이깁니다.

### 기존 오늘의 미션 구멍도 함께 고치세요

지금 `drewToday` / `reconcileMissions`(`src/lib/dailyMissions.ts`)는 `normalDrawsUsed` / `rateUpUsed` 와 일부 `pendingDraw` 만 봅니다. **뽑기권만 쓴 뽑기는 이 카운터가 오르지 않아** 오늘의 미션 「카드 뽑기」가 빠질 수 있습니다. `opsRewards.ts` 에서 뽑기권 뽑기는 `lifetimeDraws` 만 +1 하고 `rateUpUsed`/`normalDrawsUsed` 는 안 올립니다.

고칠 것:
1. **모든 성공 뽑기**(튜토리얼·일반·확률업 광고·뽑기권)를 세는 일일 카운터(예: `drawsByDate[날짜]` 또는 `dailyDraws`)를 성공 확정 시점에 올리고, `drewToday` / `reconcileMissions` / 주간 뽑기 집계가 이 기록을 쓰게 하세요. `pendingDraw` 만 믿지 마세요.
2. 오늘의 미션 `room_1`(방 놀러 가기)는 지금 `App.tsx` 의 `onRoomOpened`에서 bump 후 `saveOpsState` 를 fire-and-forget 합니다. 저장이 실패하면 유실되고, `reconcileMissions` 는 방 방문을 **추측하지 않습니다.** → 성공한 입장 날짜를 `lastRoomVisitDateKST`(또는 같은 역할의 기록)로 남기고, 재계산이 복구하게 하세요. **긴급 저장 + 실패 시 재시도.**
3. 가능하면 오늘의 미션 날짜도 폰 `toKstDateKey()` 만이 아니라 출석과 같은 **신뢰 KST** 를 쓰세요. 자정 경계에서 하루가 밀리지 않게 하세요.
4. 주간 「방 꾸미기 저장」과 오늘의 「방 놀러 가기」를 혼동하지 마세요. 둘은 다른 미션입니다.

저장 일반: 미션 관련 쓰기는 `markDirtyUrgent`(또는 동등한 즉시 저장) + 재시도. `localStorage` 쓰기 실패를 조용히 삼키지 말고, 최소한 한 번 더 시도하고 실패하면 다음 앱 열 때 서버 max 병합으로 회복할 수 있게 로그가 서버에 먼저 가도록 하세요.

100% 불가한 경우(정직하게 두세요): 토스 광고 콜백 자체가 안 온 경우, 기기 저장이 완전히 실패한 뒤 서버에도 못 보낸 경우, 쓰다듬기 주간 로그를 남기기 **전의** 강제 종료(로그를 성공 직후 먼저 남기면 이 구멍을 최소로 줄입니다).

---

## UI (시안 01·02·03)

기존 메뉴 시트 톤(어두운 패널, 민트, 닫기 X, grab)을 재사용하세요.

### 「도장 1」「도장 2」 알약 뱃지 — 위아래 여백 (필수)

이전에 글자가 위로 붙어 위 여백이 거의 없었습니다. 한글(고딕) 베이스라인 때문에 `line-height:1` + flex 만으로는 부족합니다. **아래 CSS를 그대로** 쓰세요(숫자는 시트 스케일에 맞게 가도, 구조는 유지).

```css
.wm-stamp, .wm-bonus {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  height: 20px;
  padding: 0 8px;
  border-radius: 999px;
  font-size: 10.5px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
  white-space: nowrap;
  /* Gothic / 한글은 글자 칸 아래가 비어 보여, 2px 내려 위아래가 같아 보이게 해요 */
  padding-top: 2px;
}
```

완료된 줄의 알약은 민트 배경 + 어두운 글자, 진행 중은 연한 복숭아 글자(시안 01). 구현 후 알약을 확대해서 **글자 위·아래 여백이 같아 보이는지** 확인하세요.

### 보드(01)

- 제목 「주간 미션」, 이번 주 기간, 도장 `6/9`, 월요일 0시 리셋 안내
- 상자 3칸: 3 / 6 / 9 와 보상 짧은 두 줄(예: `젤리 50`, `젤리 50 / 뽑기권`, `젤리 100 / 냥코인 20`). 잘리지 않게.
- 미션 줄: 아이콘, 제목, `12/20` 같은 진행, 오른쪽 알약
- 선택 초대 줄은 도장에 안 넣음
- 시트는 가능한 한 스크롤 없이, 「설정」이 메뉴 한 화면에 남게(시안 03). 줄이 늘어나면 `menu-layout-fix.md` 처럼 스크롤바는 숨기되 내용은 잘리지 않게.

### 축하 창(02)

기존 오늘의 미션/초대 축하 패턴을 재사용하세요. 고양이 그림은 `public/assets/weekly/claim-cat.webp`. 문구 예: 「6도장 달성」, 젤리 50, 확률업 뽑기권 1장. 9도장이면 젤리 100 + 냥코인 20. 한 번 받은 뒤 다시 열리면 금액이 또 더해지면 안 됩니다.

---

## 단위 테스트 (필수)

새 패키지를 `package.json` 에 넣지 마세요. 순수 함수(`src/lib/weeklyMissions.ts` 의 주 키·도장 계산·병합·뽑기권 표시 문구, 그리고 `toKstMondayWeekKey`)를 `src/lib/weeklyMissions.test.ts` 에서 검사하고, 아래처럼 실행해 모두 통과하게 하세요.

```
node --experimental-strip-types src/lib/weeklyMissions.test.ts
```

(안 되면 `npx --yes tsx src/lib/weeklyMissions.test.ts` 로 한 번만 실행. 의존성은 프로젝트에 고정하지 마세요.)

꼭 넣을 케이스:

1. **주 경계:** 2026-11-22(일) 23:59:59 KST(`2026-11-22T14:59:59Z`) 의 주 키는 `2026-11-16`. 2026-11-23(월) 00:00:00 KST(`2026-11-22T15:00:00Z`) 의 주 키는 `2026-11-23`. 경계 1초 전/후가 다른 주인지.
2. **멀티 디바이스 병합:** 기기 A `draws:10, attendDates:2일`, 기기 B `draws:5, attendDates:다른 1일, roomSaved:true` → 결과는 `draws:10`, 출석 3일, `roomSaved:true`. 같은 날 쓰다듬기 3과 1이면 3.
3. **동작 중 앱 종료:** 상자 클레임이 `already` + 같은 `ticketKeys` 로 다시 와도, 티켓 키 집합에 이미 있으면 보유 수를 또 더하지 않음. 로그를 남긴 뒤 카운터 재계산이 같은 도장을 만듦.
4. **상자 멱등:** 같은 `weekKey`+`kind` 를 두 번 적용해도 젤리·냥코인·뽑기권이 한 번만. 표시 함수는 `4장 (보너스 1장 포함)` 을 만들고 `4/3` 을 만들지 않음.

`toKstMondayWeekKey` 자체를 깨지 마세요. 필요하면 같은 파일에서 Date 인자를 넣어 검사만 추가하세요.

---

## 자가 점검 / QA 목록

구현이 끝나면 아래를 직접 확인하고, 실패한 항목이 있으면 고친 뒤 끝내세요.

- 메뉴: 오늘의 미션 아래 「주간 미션」, 시안 03처럼 설정이 보임. 보상함 금화 말풍선·시트 스크롤 숨김이 있었다면 그대로.
- 알약 「도장 1」「도장 2」 위아래 여백이 같아 보임 (확대 확인).
- 출석 5일·뽑기 20(뽑기권만 쓴 뽑기 포함)·쓰다듬기 10·오늘의 미션 3일 완료·방 꾸미기 **저장 성공** 1회·젤리 광고 20회가 각각 도장에 반영. 초대 1명은 도장 없이 보너스만.
- 방 **입장만** 해서는 주간 「방 꾸미기 저장」이 안 오르고, 오늘의 「방 놀러 가기」는 오름. 입장 직후 앱을 강제 종료했다가 다시 켜도 오늘의 방 미션이 유실되지 않음.
- 뽑기권 뽑기 후 오늘의 미션 「카드 뽑기」와 주간 뽑기가 둘 다 오름.
- 상자 3·6·9 받기, 잔액·뽑기권이 맞음. 같은 상자 다시 받기는 한 번만. 9도장 냥코인 20이 서버 잔액과 일치하고 로컬만 +20 되지 않음.
- 뽑기권 3장일 때 6도장 상자 → 4장, 메뉴 「보유 4장」, 한도 문구 「4장 (보너스 1장 포함)」. 상점/출석/초대는 더 안 줌. 어디에도 `4/3` 없음.
- 주가 바뀐 뒤 앱을 열면 지난 주 미수령 상자가 자동 지급되고, 한 번 더 열어도 또 안 줌.
- 화면 문구에 포인트/출금/인출/"P"/토스포인트 없음. 뒤로가기 버튼 없음.
- 위 단위 테스트가 통과.

---

## 확인

- 시안 01·02·03 과 같은 정보 구조(문구는 자연스러워도 보상 숫자·미션 구성은 동일).
- `menu-layout-fix.md` / `reward-toss-badge.md` 가 만진 메뉴 레이아웃·보상함 말풍선을 훼손하지 않음.
- 새 패키지·새 시크릿·저장소 안 SQL/Edge Function 파일 없음.
- `tsc` / 기존 lint 가 새로 깨지지 않음.

작업이 끝나면 main 브랜치에 머지해 줘.
