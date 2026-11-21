# Cursor 프롬프트 — 편지함 (행운냥)

아래 전체를 Cursor에 붙여 넣으세요. **앱 코드만** 바꾸세요. 서버(표·wallet 함수)는 `mailbox-server.zip` 으로 따로 준비되어 있고, 원따이님이 대시보드에서 이미 SQL 실행·Deploy 한 뒤여야 합니다. 저장소 안에 `supabase/functions` 나 SQL 을 새로 만들지 마세요.

이 작업은 **주간 미션 프롬프트(`weekly-mission.md`)를 이미 실행한 뒤**를 전제로 합니다. 주간 보드·주간 동기화·메뉴 「주간 미션」 줄이 이미 있어야 합니다.

규칙:
- 뒤로가기 버튼(`DevBackButton` 등)을 새로 만들지 마세요. 창은 바깥 탭·기존 닫기(X)·기기 뒤로가기로 닫습니다.
- `appName`은 `lucky-cat` 그대로 유지하세요.
- 화면 문구에 **포인트 / 토스포인트 / 출금 / 인출 / "P"** 를 쓰지 마세요. 재화 이름은 **발바닥 젤리**(짧게 **젤리**)와 **냥코인**입니다.
- 새 환경 변수·유료 서비스·새 패키지를 추가하지 마세요. 서버 호출은 기존 `wallet` 함수 하나만 씁니다.
- 선물 금액은 **전부 서버가** 정합니다. 특히 **냥코인은 서버 장부로만** 올라가야 합니다. 앱이 `ops` 나 화면에 숫자를 더하면 안 됩니다. 젤리도 서버 잔액을 따릅니다.

**다른 프롬프트와 파일이 겹칩니다.** `src/components/MenuPanel.tsx`, `src/components/MenuPanel.css` 는 `menu-layout-fix.md`, `reward-toss-badge.md`, `weekly-mission.md` 가 같은 파일을 만집니다. 그 작업이 이미 적용되어 있으면 **되돌리거나 덮어쓰지 마세요.** 편지함 줄·편지함 시트·메인 편지 버튼·주간 보드의 「편지함으로 보냈어요」 표시만 더하거나 바꾸세요.

---

## 시안과 그림 zip

`mailbox.zip` 을 **저장소 맨 위 폴더**(`package.json`이 있는 곳)에 풀어 넣으세요. 자세한 경로는 zip 안의 `풀어넣기.md`.

- 그림(그대로 쓰기, 새로 그리지 않기):
  - `public/assets/menu/icon-mailbox.svg` — 메뉴 「편지함」 줄 아이콘(크림색 우체통)
  - `public/assets/mailbox/icon-mailbox-dark.svg` — 메인 화면 편지 버튼 아이콘(어두운 우체통)
  - `public/assets/mailbox/icon-operator.svg` — 운영자 편지 아바타
  - `public/assets/mailbox/letter-cat.webp` — 운영자 편지를 열었을 때 고양이
- 시안(참고용, **빌드에 넣지 않음**): `docs/mockups/mailbox/`
  - `01-list.png` 편지함 목록(받을 선물에 빨간 점, 보낸 이, 선물 아이콘, 남은 기한, 「모두 받기」)
  - `02-open.png` 운영자 편지 열기(본문 + 발바닥 젤리·냥코인 + 「받기」)
  - `03-entry.png` 메인 화면 메뉴 버튼 왼쪽의 편지 버튼과 안 받은 개수 배지

한글 버튼·칩·배지의 위아래 여백이 고르게 보이게 하세요. Gothic A1 한글은 글자 칸 아래가 비어 보이므로, 주간 미션 도장 알약처럼 `padding-top: 2px` 정도로 맞추면 됩니다.

---

## 지금 코드 (이 파일들을 기준으로 고치세요)

- 메인 헤더: `src/screens/HomeScreen.tsx` 의 `main-header` / `main-menu-btn`, `src/App.css` (메뉴 버튼은 대략 오른쪽 `left: 330px`, `top: 13px`, `40×50`, 크림색 `#F3EBD7`). 편지 버튼은 그 **왼쪽**에 같은 크기·같은 자리로 두세요(시안 03). 자리와 크기를 바꾸지 마세요.
- 최애냥 편지: `src/components/CatLetterSheet.tsx`, `src/components/AffectionHost.tsx`(창 아래 「편지함」 버튼이 `CatLetterInbox` 를 염), `src/lib/catLetters.ts`, `src/components/HomeFavorite.tsx`(안 읽은 최애냥 편지의 빨간 점)
- 메뉴: `public/assets/menu/menu.json` 의 `sections[id=daily].rows`(지금 오늘의 미션이 맨 위, 그 아래 주간 미션), `src/components/MenuPanel.tsx`, `MenuPanel.css`, `src/lib/menuModel.ts`, `src/lib/menuTypes.ts`
- 주간 미션: `src/components/WeeklyBoard.tsx`, `src/components/WeeklyClaimPop.tsx`, `src/lib/weeklyMissions.ts`, `src/lib/weeklySync.ts` — **부팅 때 지난 주 상자를 `claimWeeklyChest` 로 자동 지급하는 코드(`claimKinds(..., "previous")`)를 없애세요.** 지난 주 미수령 상자는 서버가 편지함으로 옮겨 줍니다.
- 친구 초대: `src/lib/invite.ts` 의 `claimInvite` 자동 지급(`runClaim` 등). **초대 선물을 앱이 바로 받지 마세요.** 서버가 편지함으로 넣습니다. 안내가 필요하면 「편지함을 확인해 주세요」 정도로만 보여 주세요.
- 서버 호출: `src/lib/serverWallet.ts` 의 `postWallet` — hash·apikey·`x-save-token`, `save_token_invalid` 면 토큰 갱신 후 1번 재시도. 친구 초대·주간 미션과 같은 패턴입니다.
- 젤리 표시: `src/lib/serverJelly.ts` (`rememberJelly` 등)
- 뽑기권: ops `rateUpTickets`, 초대 `inviteTicketKeys` 처럼 **같은 키는 한 번만** 더하세요. 한도는 상점·출석·초대 3장, 주간 6도장 상자만 4장. 화면에는 `4/3` 을 쓰지 마세요.

---

## 결정 (그대로 따르세요)

1. **최애냥 편지도 같은 편지함에 모읍니다.** 최애냥 창의 기존 편지함 버튼은 **같은 함**을 엽니다. 최애냥 편지에는 선물이 없으니 **빨간 점을 찍지 마세요.** 메인 왼쪽 최애냥 얼굴의 빨간 점은 안 읽은 최애냥 편지용으로 그대로 두세요. 앱을 열 때 최애냥 편지가 뜨는 순서도 지금처럼 두어도 됩니다.
2. **주간 미션 상자도 편지함으로 보냅니다.** 보드에서 「받기」로 바로 지급하지 마세요. 도장을 채운 상자는 「편지함으로 보냈어요」로 표시하세요(이미 받은 것은 체크, 도장이 모자라면 잠금). 지난 주 미수령 상자도 자동 지급하지 말고 편지함으로 들어왔는지 목록만 새로 고치세요.
3. **메인 화면 편지 버튼**은 시안 03처럼 메뉴 버튼 **왼쪽**에 두고, 자리와 크기(메뉴 버튼과 같은 40×50 크림 둥근 네모, 라벨 「편지」)를 그대로 두세요. 안 받은 **선물** 개수만 빨간 숫자 배지로 보여 주세요.

그 밖에:
- 보관 기한 **30일**. 목록에 「27일 남음」처럼 보여 주세요. 오늘이 마지막이면 「오늘까지」. 기한이 지난 선물은 받을 수 없고, 받기를 눌러도 서버가 거절합니다.
- 뽑기권이 가득 차면 젤리·냥코인만 받고 권은 편지함에 남깁니다. 「모두 받기」도 같아요. 짧게 「뽑기권이 가득 차서 권만 남겨 두었어요」라고 알려 주세요.
- 메뉴 「편지함」 줄은 DAILY **맨 위**(오늘의 미션보다 위, 시안 01). 안 받은 선물이 있으면 아이콘에 빨간 점, 오른쪽 메타는 `안 받은 3통`처럼. 줄을 누르면 기존 `.menu-sheet` 틀로 목록을 엽니다. 새 전체 화면을 만들지 마세요.
- 보상함(냥코인을 토스로 보내기)과는 다른 화면입니다. 보상함 줄은 건드리지 마세요.

---

## 서버 API (wallet 함수, 이미 준비됨)

`src/lib/serverWallet.ts` 에 `fetchMailboxList` / `claimMailboxLetter` / `claimMailboxAll` 를 초대·주간 함수와 같은 패턴으로 추가하세요. `postWallet` 로 부릅니다.

1. `mailbox_list` — `{}`
   - 응답: `{ ok, items, unclaimedCount, ttlDays: 30, today }`
   - `items[]`: `{ id, letterKey, source: "operator"|"invite"|"weekly", title, body, jelly, nyang, tickets, jellyTotal, nyangTotal, ticketsTotal, ticketCap, createdAt, expiresAt, remainDays, status: "pending"|"claimed"|"expired", claimedAt }`
   - `jelly`/`nyang`/`tickets` 는 **아직 안 받은 나머지**입니다. 권을 남긴 편지는 `status` 가 `pending`, `tickets` 만 남아 있어요.
   - 서버가 목록을 열 때, 준비된 주간 상자·초대 선물을 편지로 만들어 줍니다. 예전에 이미 바로 받은 것은 넣지 않습니다.
   - 저장 전에도 동작합니다. `allowMissing` 은 false 로. (저장이 있는 계정은 토큰과 함께 부르세요.)
2. `mailbox_claim` — `{ letterId, ticketsHeld: 지금 rateUpTickets }`
   - 응답: `{ ok, already, letter, jelly, nyangCoin, tickets, ticketKeys, ticketHeldBack, ticketsHeldAfter, jellyBalance, nyangCoinBalance, unclaimedCount }`
   - 실패 `error`: `not_found`, `expired`, `blocked`, `bad_input`
   - 몇 번 불러도 같은 편지는 한 번만 나갑니다. `already:true` 이면 금액은 0입니다. `ticketKeys` 는 앱이 중간에 꺼져도 같은 키를 다시 줄 수 있으니, **키로 중복을 막으세요.**
   - `ticketHeldBack:true` 이면 권만 편지에 남은 것입니다.
3. `mailbox_claim_all` — `{ ticketsHeld }`
   - 응답: `{ ok, claimed, letters, jelly, nyangCoin, tickets, ticketKeys, ticketHeldBack, jellyBalance, nyangCoinBalance, unclaimedCount }`
   - 기한이 남은 안 받은 편지를 순서대로 받습니다. 한도가 차면 이후 권은 남깁니다.

주간 보드용: 기존 `weekly_status` 응답에 `mailbox: { current, previous }` 가 붙습니다. 값은 `{ "3"|"6"|"9"|"invite": "none"|"pending"|"claimed"|"expired" }` 입니다. `pending`/`claimed`/`expired` 이면 보드는 「편지함으로 보냈어요」(이미 받은 것은 체크)로 그리세요. `weekly_claim` 은 이제 젤리·냥코인을 바로 주지 않고 편지함으로만 넣습니다. 보드에서 `claimWeeklyChest` 를 불러 지급하지 마세요.

`weekly_sync` / `weekly_status` / `invite_status` 를 부른 뒤에는 편지함 목록을 한 번 새로 고치면 방금 쌓인 선물이 바로 보여요.

로컬 개발(`local-dev`, wallet 호출 안 함)에서는 목록·시트는 동작하되, 실제 젤리·냥코인 지급은 하지 않거나 "서버가 필요할 때 받을 수 있어요" 수준으로 두세요. 로컬에서 냥코인을 더하면 안 됩니다.

---

## 화면

### 메인 편지 버튼 (시안 03)

- 메뉴 버튼 왼쪽에 같은 크기·모양의 크림 버튼. 아이콘은 `icon-mailbox-dark.svg`, 아래 라벨 「편지」.
- 안 받은 선물 개수가 1 이상이면 오른쪽 위에 빨간 숫자 배지(시안처럼 작은 원, 숫자 3). 0이면 배지 숨김.
- 누르면 편지함 시트를 엽니다(메뉴를 거치지 않아도 됩니다).

### 메뉴 줄 (시안 01 위쪽)

- DAILY 맨 위 「편지함」. 아이콘 `icon-mailbox.svg`. 안 받은 선물이 있으면 빨간 점과 `안 받은 N통`.
- 누르면 같은 편지함 시트.

### 편지함 목록 (시안 01)

- 기존 메뉴 시트 틀(grab, 제목, 닫기 X). eyebrow `MAIL`, 제목 `편지함`, 설명 `선물은 30일 동안 보관해요.`
- 각 줄: 보낸 이(운영자 / 친구 초대 / 주간 미션 / 최애냥), 제목, 선물 아이콘(발바닥 젤리·냥코인·뽑기권), 남은 기한. 받을 선물이 있는 줄만 빨간 점.
- 최애냥 편지는 선물 칸 없이 「편지」 정도로만, 빨간 점 없음. 줄을 누르면 기존 최애냥 편지지(`CatLetterPaper`)를 엽니다.
- 아래 고정 「모두 받기」(받을 선물이 있을 때만). 안내 「창 밖을 누르면 닫혀요」.
- 스크롤바는 다른 메뉴 시트와 같이 숨기세요.

### 편지 열기 (시안 02)

- 운영자·초대·주간 미션 줄을 누르면 크림색 카드가 목록 위에 떠요. 닫기 X, 뒤로가기 버튼 없음. 바깥을 누르면 닫혀요.
- 운영자 편지는 `letter-cat.webp` 와 본문, 선물 칩(「발바닥 젤리 100」·「냥코인 10」), 「받기」 버튼을 시안 02처럼 배치하세요. 초대·주간 편지도 같은 틀로, 보낸 이와 선물만 바꾸면 됩니다.
- 「받기」 후 잔액을 서버 응답으로 맞추고, 짧게 「선물을 받았어요」를 보여 준 뒤 목록으로 돌아가도 됩니다. 이미 받은 편지·만료된 편지는 받기 버튼을 비활성하거나 안내만 보여 주세요.
- 권을 남긴 경우에는 버튼을 「남은 권은 나중에」처럼 바꾸지 말고, 목록에서 권이 남은 채로 보이게 하고 안내 문구만 띄우세요.

---

## 구현 주의

- 부팅 후(저장 토큰이 생긴 다음) `mailbox_list` 를 불러 배지·메뉴 숫자를 맞추세요. 주간 동기화·초대 현황을 받은 뒤에도 한 번 더 부르세요.
- `ticketKeys` 는 초대·주간과 같은 저장소에 **키 기준으로** 더하세요. 서버가 같은 키를 다시 줘도 뽑기권이 두 배가 되면 안 됩니다.
- `jellyBalance` / `nyangCoinBalance` 가 오면 그걸 쓰고, 로컬에 +100 하지 마세요.
- 최애냥 편지 데이터는 지금처럼 앱(`catLetters`)에 두고, 서버 목록과 **한 화면에서만** 합치면 됩니다. 서버에 최애냥 편지를 올리지 마세요.
- 테스트: 메인 배지, 메뉴 줄, 최애냥 창 편지함 버튼이 같은 함을 여는지 / 초대·주간 선물이 편지함으로 들어오는지 / 받기·모두 받기·중복 받기 / 권 한도에 권이 남는지 / 최애냥 편지에 빨간 점이 없는지 / 주간 보드에 「편지함으로 보냈어요」가 보이는지.

작업이 끝나면 main 브랜치에 머지해 줘.
