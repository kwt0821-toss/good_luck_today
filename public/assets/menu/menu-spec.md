# Lucky Cat — 메뉴 패널 스펙 (menu-1.0)

디자인 프레임 **390 × 844 pt**, 에셋 3x. 시안: `menu-screen-a.png`(패널), `-b`(출석 체크 시트), `-c`(확률 안내 시트).
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
| 도감 42/107 | 유저 `dexOwned` / 전체 107 (= 18품종×5 + 스페셜 9 + 캐릭터 4 + 레전드 4, economy `tossPayout.formula`와 동일) |
| 방 레벨 | 유저 `cozyPoints` → economy.json `cozy.levels`(minCozy) / `beyondLv10` |
| 출석 체크 | starter.json `attendance7`(day, itemId, tier) + `attendanceRule`, 이름·썸네일 = prices.json `nameKo` / gift-{itemId}.png |
| 포인트 받기 | economy.json `pawSources.rewardedAd.pawPerAd`(10) / `maxPerDay`(10), 주말 2배 = `events.weekendDoublePaw`; 보상은 광고 완료 콜백 후 서버 지급만 |
| 중복 카드 교환 | economy.json `pawSources.duplicateConvert` (1–2★ 10, 3–5★ 30, 스페셜/캐릭터 60, 레전드 150) |
| 보상함 | economy.json `pawSources.newCardFirstGet`, `setComplete`, `tossPayout`(서버 검증·계정당 1회) |
| 확률 안내 | economy.json `draws.rates_proposal.normal` / `.rateUp`, `keys` (⚠ `_proposal: true` — 확정 후 같은 키로 교체) |
| 친구 초대 | economy.json `events.friendInvite.enabled`(false → "준비 중") |
| 공지·이벤트 | 공지 API + economy.json `events` |
| 설정 › 튜토리얼 다시 보기 | tutorial.json 메인 4단계 + contextual.rewards-intro(r1부터) 재생 (보상 재지급 없음, tutorialDone·tut.rewardsIntro 유지) |

## 5. 파일
icon-attendance / points / exchange / rewards / rates / notice / invite / settings (행 아이콘 26×26 viewBox, 24pt로 표시), icon-close, icon-chevron, icon-paw-mini, icon-dex-mini, icon-room-mini, icon-stamp, icon-lock, panel-bg.png, gift-*.png(192px, 출석 썸네일), menu.json, menu-spec.md, menu-screen-a/b/c.png.


## 6. 출석 시트 상태 (attendance-1.1)
서버 필드 `attendanceDays` / `lastAttendDateKST` / `phase`(`firstWeek`|`weeklyCycle`) / `cycleNo` / `cycleDay` / `canClaimToday`.

| 상태 | 조건 | 시안 | UI |
|---|---|---|---|
| firstWeek | phase=firstWeek (누적 1–7일 구간) | `menu-screen-b.png` | 기존 4열 그리드, DAY7=2칸, gift 썸네일, 오늘 칸 amber+글로우+"오늘" 태그 |
| weeklyCycle | phase=weeklyCycle (8일째~) | `menu-screen-b2.png` | 누적 일수 카드 + "{기념}까지 N일" + 배지 + 이번 주 7칸(cycleDay) |

- 메뉴 행 빨간 점: `canClaimToday` (menu.json `rows.attendance.badge`).
- `item.attendanceOnly` 이면 서랍 카드·아이템 상세·출석 시트에 **출석 한정** 태그 (`menu.json attendanceOnlyTag`).
- 보상·티켓·마일스톤 숫자는 `starter.json` / `economy.json` / `prices.json` 만 읽음 (하드코딩 금지).
- 출석 한정 아이템(`prices.attendanceOnly.ids` / `source==attendance`)은 상점·구매·서랍 기본지급·방 해금 선물·기타 보상 풀에서 제외. 지급은 출석 API만.

## 7. 보상함·냥코인 지갑 (menu-screen-d)
시안: `menu-screen-d` (지갑+칩), `d-low` (10 미만 비활성), `d2` (확인), `d3` (성공/기록).

| 요소 | 값 |
|---|---|
| 헤더 스탯 | 4칸: 포인트 · 냥코인 · 도감 · 방 레벨 |
| 보상함 행 meta | `🪙{잔액} 냥코인 · 받을 보상 {n}` |
| 지갑 카드 | 잔액 + ncoin-24@3x, 10단위 칩(최대 기본 선택) |
| CTA | `토스 포인트 전환` (가운데 정렬) / 10 미만 시 비활성 + 힌트 "10 냥코인부터 받을 수 있어요" |
| 출금 | 클라이언트는 POST `/wallet/withdraw` 만 호출 (토스 지급 API 직접 호출 금지) |
| 기록 | GET `/wallet/history` — 완료 / 처리 중 / 실패 |
| 화폐 | economy `currency.nyangCoin`, 지급 규칙 `nyangCoin` (구 tossPayout). 1냥코인 = 토스포인트 1원 |
