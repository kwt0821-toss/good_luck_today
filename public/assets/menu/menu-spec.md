# Lucky Cat — 메뉴 패널 스펙 (menu-1.5)

디자인 프레임 **390 × 844 pt**, 에셋 3x. 시안: `menu-screen-a.png`(패널), `-b`(출석 체크 · 1주차), `-b2`(출석 체크 · 주간 반복), `-c`(확률 안내 시트).
> 상태바 47 + 토스 내비 56 = 103 pt는 시안용이에요. **토스 내비는 앱인토스가 그려요 → 패널/딤은 콘텐츠 영역 top(=0)부터 시작.** 아래 y는 콘텐츠 영역 기준.

## 0. 토큰 (메인화면 layout-spec.md와 동일 + 추가)
| token | value |
|---|---|
| cream | `#F3E9D7` (70/60/55/45/42 % 변형 사용) |
| amber 강조 | `#FFC48A` (숫자 하이라이트, 오늘 칸 테두리, 진행 바) |
| pink | `#F4A9A8` (아이콘 포인트) |
| red dot | `#FF5A5F` 7×7, 링 `0 0 0 2px #1A1731` |
| panel bg | `panel-bg.webp` (또는 .png)(312×741pt @3x, 투명 글로우+별+그레인) 위에 `rgba(22,19,42,.93)` + `backdrop-filter: blur(16px)` |
| sheet bg | `#18152D` + `panel-bg.png` (cover, top) |
| divider | cream 8 % (행), 16–18 % (스탯 박스 테두리) |
| dim | 패널 `rgba(9,8,20,.58)`, 시트 위 추가 딤 `rgba(6,5,14,.55)` |
Fonts: Poppins 800/600/500 (영문·숫자), Noto Sans KR 400/700 (한글).

## 1. 패널 (menu-screen-a)
| 요소 | 값 |
|---|---|
| 패널 | right 0, top 0, bottom 0, **width 312**, radius `28 0 0 28`, border-left 1px cream 14 %, shadow `-18 0 40 rgba(0,0,0,.45)`, padding `0 20 0 22` |
| 타이틀 | top 22. "MENU" Poppins 800 30px, letter-spacing −1, "." 은 amber. 아래 서브 "오늘도 고양이랑 천천히 놀아요" Noto 10.5px cream 60 %, margin-top 7 |
| 닫기 | 36×36 원, 1px cream 25 %, `icon-close.svg` 20 (히트 44×44) |
| 스탯 박스 | margin-top 16, radius 16, 1px cream 18 %, fill cream 4 %, padding 11/0/10, 3등분 + 세로 구분선 |
| 스탯 값 | Poppins 600 15px (분모 `/107` 500 10px cream 55 %), 라벨 Noto 9.5px cream 60 %. 도감은 진행 바 3px(amber, 너비 = owned/total) |
| 섹션 라벨 | "DAILY" / "MORE" Poppins 500 9px, letter-spacing 3, cream 42 %, margin `18 0 2 2` |
| 행 | 높이 48, gap 12: 아이콘 24 → 라벨 Noto 700 14.5px → 메타 Noto 11px cream 60 %(숫자 Poppins 600 amber) → chevron 18 (opacity .45) |
| 배지 | dot: 아이콘 우상단(−2, −3) / pill: 9.5px 700, 1px 테두리, `hot`=amber, `new`=red fill |
| 비활성 행 | opacity .42, chevron 없음, pill "준비 중" |
| 푸터 | bottom = `safe-area-inset-bottom + 6`, "LUCKY CAT · v1.0.0" Poppins 9px ls 2 cream 38 %, 오른쪽 "문의하기" |
| 행 순서 | menu.json `sections[].rows` 그대로 |

## 2. 바텀 시트 (b, c 공통)
radius `28 28 0 0`, padding `10 24 0`, 그랩바 40×4. eyebrow Poppins 800 11px ls 3 cream 50 %, 제목 Noto 700 21px, 설명 12px/1.5 cream 65 %, 닫기 버튼 = 패널과 동일. CTA 높이 52, radius 16, bg cream, 글자 `#1E1A2B` 700 15.5px. 하단 여백 = safe-area + 24.

**출석 체크(b)**: 시트 높이 ≈ 560. 4열 그리드 gap 8, 칸 104 높이 radius 16. DAY n(Poppins 600 8.5px ls 1.5) → 썸네일 50(`gift-{itemId}.png`) → 아이템 이름 10px(prices.json nameKo). 상태: 받음 = 썸네일 35 % + `icon-stamp.svg` 46, −12° / 오늘 = amber 1.5px 테두리 + 글로우 + red dot + "오늘" 태그 / 잠김 = 썸네일 75 %. DAY 7은 2칸 차지, 라벤더→핑크 그라데이션, 썸네일 70. 진행 바 4px amber "n / 7일". CTA "오늘 선물 받기 · {아이템}" → 받으면 "오늘 선물 받았어요"(비활성).

**확률 안내(c)**: 시트 높이 ≈ 640. 세그먼트(일반/확률업) 높이 ~38, 선택 칸 cream fill. 표 열: 등급(74) / 바 / 등급 확률(60, Poppins 600 13px) / 카드 1장(64, 10.5px). 행 33. 5성·스페셜·캐릭터·레전드는 amber(라벨+바). 합계 박스(점선 amber) "5성 + 스페셜 + 캐릭터 + 레전드 = 10%". 카드 1장 확률 = 등급 확률 ÷ 장수, 소수점 셋째 자리.

## 3. 애니메이션
| 대상 | 값 |
|---|---|
| 패널 열기 | translateX(100%→0) 280ms `cubic-bezier(.22,1,.36,1)`; 딤 opacity 0→1 200ms |
| 행 등장 | 각 행 opacity 0→1 + translateX 12→0, 180ms, stagger 30ms (열 때 1회) |
| 패널 닫기 | 220ms `cubic-bezier(.4,0,1,1)`; 딤 탭 / 닫기 / 오른쪽 스와이프 80pt 이상 / 뒤로가기 |
| 시트 | translateY(100%→0) 320ms `cubic-bezier(.22,1,.36,1)`, 아래로 드래그 120pt 이상 닫힘 |
| 출석 받기 | 오늘 칸: scale 1→1.08→1 (240ms) + 스탬프 drop(scale 1.6→1, rotate −30°→−12°, 220ms) + 햅틱 light, 이후 토스트 "서랍에 쏙 넣었어요" |
| red dot | 처음 노출 시 scale 0→1.2→1 (300ms), 반복 X |
| 메뉴 아이콘 | 메인 발바닥 아이콘에도 dot (menu.json `menuIconBadge`) |
| 움직임 줄이기 | `prefers-reduced-motion` 또는 설정 ON → 슬라이드 대신 opacity 150ms, stagger 없음 |

## 4. 데이터 매핑
| 행/요소 | 읽는 곳 |
|---|---|
| 내 포인트 | 유저 API `pawBalance` (초기값 economy.json `currency.paw.startBalance` = starter.json `startPaw` 300) |
| 도감 42/107 | 유저 `dexOwned` / 전체 107 (= 18품종×5 + 스페셜 9 + 캐릭터 4 + 레전드 4, economy `nyangCoin.formula`와 동일) |
| 방 레벨 | 유저 `cozyPoints` → economy.json `cozy.levels`(minCozy) / `beyondLv10` |
| 출석 체크 | starter.json `attendance` (`firstWeek`, `weeklyCycle`, `milestones`, `noReset`), 이름·썸네일 = prices.json `nameKo` / gift-{itemId}.png, 출석 한정 = prices.json `attendanceOnly` |
| 포인트 받기 | economy.json `pawSources.rewardedAd.pawPerAd`(10) / `maxPerDay`(10), 주말 2배 = `events.weekendDoublePaw`; 보상은 광고 완료 콜백 후 서버 지급만 |
| 중복 카드 교환 | economy.json `pawSources.duplicateConvert` (1–2★ 10, 3–5★ 30, 스페셜/캐릭터 60, 레전드 150) |
| 냥코인 | 유저 API `nyangCoinBalance` (시작 0, starter.json `startNyangCoin`) |
| 보상함 | economy.json `pawSources.newCardFirstGet`, `setComplete`(nyangCoin·paw, 보상 id별 1회), `nyangCoin.withdraw`(10 단위·서버 검증) |
| 확률 안내 | economy.json `draws.rates_proposal.normal` / `.rateUp`, `keys` (⚠ `_proposal: true` — 확정 후 같은 키로 교체) |
| 친구 초대 | economy.json `events.friendInvite.enabled`(false → "준비 중") |
| 공지·이벤트 | 공지 API + economy.json `events` |
| 설정 › 배경음악(BGM) / 효과음 | 토글 2개. BGM 기본 OFF, 효과음 기본 ON, localStorage `lc.audio.bgm` / `lc.audio.sfx`. 동작 규칙은 audio-assets/audio-spec.md |
| 설정 › 튜토리얼 다시 보기 | tutorial.json `steps` 재생 (보상 재지급 없음, tutorialDone 유지) |

## 5. 파일
icon-attendance / points / exchange / rewards / rates / notice / invite / settings (행 아이콘 26×26 viewBox, 24pt로 표시), icon-close, icon-chevron, icon-paw-mini, icon-dex-mini, icon-room-mini, icon-stamp, icon-lock, panel-bg.png, gift-*.png(192px, 출석 썸네일), menu.json, menu-spec.md, menu-screen-a/b/b2/c/d/d-low/d2/d3.png, ncoin-128.png / ncoin-24@3x.png / ncoin-16@3x.png (냥코인 아이콘, 원본은 ncoin/).

## 6. 출석 (menu-1.1 추가)
- **규칙(서버)**: 누적 출석일 `attendanceDays` 기준, 빠져도 리셋 없음. 1~7일 = `firstWeek` 출석 한정 아이템, 8일차부터 `weeklyCycle` (cycleNo = floor((n−8)/7)+1, cycleDay = ((n−8) % 7)+1). 30·100일 = `milestones` 추가 지급.
- **시트 상태 2개**: `firstWeek`(menu-screen-b) / `weeklyCycle`(menu-screen-b2). 문구·조건은 menu.json `sheets.attendance.states`.
- **b (1주차)**: 제목 옆 "출석 한정" 태그, DAY 7 칸에도 태그. 나머지 레이아웃은 2번 섹션과 같아요. 시트 높이 ≈ 572.
- **b2 (주간 반복)**: 시트 높이 ≈ 668.
  - 누적 카드: margin-top 16, radius 18, 1px amber 35 %, amber→라벤더 그라데이션. 숫자 Poppins 800 40px + "DAYS" 8.5px ls 2.5. 가운데 "30일 기념 보상까지 **12일**"(12px, 숫자 amber Poppins 700 14px) + 진행 바 4px + 보상 이름 9.5px + 출석 한정 태그. 오른쪽 배지 52×52 (`badge-att-30.svg` / `badge-att-100.svg`).
  - "이번 주 출석" 12px 700 + 오른쪽 "WEEK 02 · DAY 4/7" Poppins 500 9px ls 2.
  - 1~6일 칸: `icon-paw-coin.svg` 40 + "+15P" Poppins 700 13px. 받음/오늘/잠김 상태는 1주차와 같아요.
  - DAY 7 칸(2칸): 확률업 뽑기권 = `icon-ticket.svg` 58, 출석 선물 상자 = `icon-att-box.svg` 70. sub에 다음 주 보상 안내.
  - CTA: "오늘 {paw}포인트 받기" / "오늘 선물 상자 열기" / "오늘 뽑기권 받기".
- **출석 한정 태그**: pill 8.5px 700, bg `#C9B6F2`, 글자 `#1E1A2B`, radius 999, padding 1×6. 출석 시트, 방꾸미기 서랍 카드, 아이템 상세에 표시해요(`item.attendanceOnly`). 상점 목록에는 출석 아이템 자체를 띄우지 않아요.
- **애니메이션 추가**: 선물 상자는 흔들기(rotate ±6°, 3회, 360ms) 후 뚜껑이 열리고 아이템이 scale 0.6→1로 튀어나와요. 뽑기권은 슬라이드 인 후 반짝이 1회. 기념일은 배지가 scale 0→1.15→1(420ms) + 컨페티 대신 별 6개가 퍼져요(움직임 줄이기 ON이면 페이드만).
- **새 파일**: `gift-att_*.png`(출석 한정 14종 타일), `badge-att-30.svg`, `badge-att-100.svg`, `icon-ticket.svg`, `icon-att-box.svg`, `icon-paw-coin.svg`. 방 렌더용 아트·레지스트리는 `attendance-items.zip`(items-attendance.json, items/, tiles/)에 있어요.

## 7. 설정 화면 (menu-1.2)
행 순서: **배경음악(BGM)**(기본 OFF) · **효과음**(기본 ON) · 진동 · 움직임 줄이기 · 튜토리얼 다시 보기 · 문의하기 · 이용약관 · 개인정보처리방침 · 버전.
토글은 cream 트랙(ON = `#FFC48A`, OFF = cream 18 %), 44pt 높이 행. BGM 행 아래 보조 문구(10px, cream 50 %): "토스 안에서는 기본으로 꺼져 있어요". 바꾸는 즉시 적용·저장하고, 효과음을 켤 때는 sfx-tap을 한 번 들려줘요.

## 8. 냥코인 · 보상함 (menu-1.3)
- **화폐**: 냥코인 = 토스포인트로 바뀌는 화폐(1냥코인 = 토스포인트 1원). 포인트(발바닥 P)는 앱 안 화폐로 그대로. UI에서 '토스 N원 지급' 문구는 쓰지 않고 'N냥코인'으로 표시해요.
- **헤더 통계**: 4칸(포인트 · 냥코인 · 도감 · 방 레벨), 숫자 Pop 600 14px, 아이콘 12~14pt. 냥코인 칸을 누르면 보상함 시트가 열려요 (menu-screen-a).
- **보상함 행 meta**: `[ncoin 14] 37 냥코인 · 받을 보상 2`.
- **보상함 시트 (menu-screen-d, 높이 ≈ 668)**: 지갑 카드(r20, amber 45% 테두리, 코인 52pt, 잔액 Pop 800 32px, "1냥코인 = 토스포인트 1원", "받은 기록 ›") → "얼마나 받을까요?" 칩(높이 38, 10 단위, 최대값 기본 선택 + '최대' 태그) → 버튼 "토스포인트로 받기 · 30원" → 남는 냥코인 안내 → 받을 보상 목록(썸네일 38×52, +N냥코인/+NP 칩, 받기) → 하단 안내.
- **10 미만 (menu-screen-d-low)**: 칩·버튼 비활성(cream 12%), 힌트 "10냥코인부터 받을 수 있어요 · N개 더 모으면 돼요".
- **확인 시트 (menu-screen-d2, 높이 ≈ 452, 보상함 위에 겹침)**: 30냥코인 → 토스포인트 30원 카드 2개, 받는 곳/남는 냥코인, 취소 + "30원 받기", "받은 토스포인트는 냥코인으로 되돌릴 수 없어요".
- **성공 + 기록 (menu-screen-d3)**: 코인 96pt + 초록 체크, "토스포인트 30원을 받았어요", "지금 7 냥코인", 받은 기록(완료/처리 중/실패 칩), 확인. sfx-reward-coin + 햅틱 success.
- **동작**: 받기 → 버튼 로딩(중복 탭 막기) → 서버 `POST /wallet/withdraw {amount, requestId}` → done이면 성공 화면, pending이면 "처리 중이에요" 토스트 후 기록으로, failed면 잔액 복구 안내. 클라이언트는 토스 지급 API를 직접 부르지 않아요.
- 값·문구: menu.json `sheets.rewards`, 규칙: economy.json `nyangCoin`.

## 9. 튜토리얼 대상 id (menu-1.4)
- 행: `#menu-row-{rowId}` (예: `#menu-row-rewards`), 메뉴 아이콘 `#icon-menu`.
- 보상함 시트: `#wallet-card`, `#withdraw-picker`(라벨+칩+받기 버튼), `#btn-withdraw`, `#btn-claim-all`, `#btn-wallet-history`.
- 보상함 튜토리얼(tutorial.json `contextual.rewards-intro`): 냥코인이 처음 10개가 되거나 보상함을 처음 열 때 1회. 시안 tutorial-rewards-1/2/3.png. 코치마크 중에는 메뉴 패널·시트 스와이프 닫기를 막고, 건너뛰기는 말풍선 아래줄에 둬요(패널 닫기 버튼과 겹치지 않게).

## 10. 뽑기권 (menu-1.5)
- **사는 곳은 하나**: 바텀 시트 `sheet:ticketShop` (ticket-shop.png). 들어가는 길 2개: ① 메인 확률업 버튼(오늘 광고 확률업을 썼고 뽑기권 0장일 때) ② 메뉴 DAILY › **뽑기권** 행(보상함 위, `icon-ticket.svg`, meta "보유 1/3 · 이번 주 2/7").
- 시트: 뽑기권 카드(아이콘 64, "확률업 뽑기권", "광고 없이 확률업 1회 · 5성↑ 27%", 가격 발바닥 아이콘 + 200 Pop 700 amber) → 한도 3칸(이번 주 n/7 · 오늘 n/2 · 보유 n/3) → 내 포인트(→ 산 뒤 잔액 미리보기) → "200P로 사기"(cream) → 보유 ≥1이면 보조 버튼 "지금 확률업 뽑기 (뽑기권 n장)" → 안내 "포인트는 방꾸미기에도 써요 · 이번 주 구매는 월요일 00:00에 다시 열려요".
- 사면 토스트(상단, 초록 체크) "확률업 뽑기권 1장을 샀어요 / 남은 포인트 1,040P · 보유 1/3". 비활성 문구는 menu.json `sheets.ticketShop.disabled`.
- 값은 economy.json `shop.tickets.rateUpTicket` (가격·한도), `tickets.rateUpTicket.maxHold`.

## 11. 보상함 변경 (menu-1.6, claimMode manual)
받을 보상 목록과 모두 받기를 없앴어요. 보상함에는 지갑(출금)과 바로가기 #btn-rewards-to-dex "도감에서 받을 보상 {n}개 · 도감 가기 ›"만 남아요. 받기는 도감 한 곳에서만 해요 (축하 연출을 도감에서 보여 주고, 중복 요청과 혼동을 막기 위해). n=0이면 "받을 도감 보상을 모두 받았어요"
