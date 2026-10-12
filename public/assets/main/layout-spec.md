# Lucky Cat — Main screen (Concept B "night editorial") layout spec

Design frame: **390 × 844 pt** (iPhone 14/15 size), assets exported at **3x**.

> **Do not implement the status bar or the Toss nav bar** shown in the mockup (`main-screen-concept-b.png`).
> They were placeholders: iPhone status bar 47 pt + Toss in-app nav bar 56 pt = **103 pt**.
> Toss (앱인토스) renders its own nav bar. **All y values below are relative to the content-area top** (= the bottom edge of the Toss nav bar, screen y 103 in the mockup).
> Screen-y = content-y + 103 (mockup only).

## 0. Global

| token | value |
|---|---|
| cream (main text/icons) | `#F3E9D7` |
| cream 70 % / 65 % / 50 % / 45 % / 35 % / 22 % | `rgba(243,233,215,.70/.65/.50/.45/.35/.22)` |
| amber accent (hint "톡,") | `#FFC48A` |
| chip dot | `#FFB36B` + glow `0 0 6px #FFB36B` |
| pink accent (icons/cheeks) | `#F4A9A8` |
| bg gradient | `radial-gradient(120% 70% at 70% 62%, #3A2F55 0%, #221D38 45%, #14132A 100%)` |
| cat fur / stripes / outline / paws | `#F7CD9F` / `#E2975A` / `#4A3428` / `#FFF3E2` |
| side margins | 24 pt (icons 22 pt) |

Fonts: **Poppins** ExtraBold 800 / Medium 500 (Latin), **Noto Sans KR** (CJK; mockup used Noto Sans CJK) Regular 400 / Bold 700, **Gamja Flower** Regular (hand-written hint, zzz).

## 1. Elements (x, y, w, h in pt, y from content top)

| # | element | x | y | w | h | style / text |
|---|---|---|---|---|---|---|
| 1 | Background | 0 | −103 (full screen, behind Toss bar) | 390 | 844 | `bg-night-base.webp` (+ `moon-glow.png`) **or** `bg-night.webp` (moon baked in). `background-size: cover`, anchor top. |
| 2 | Moon glow | 35 | 167 | 320 | 320 | `moon-glow.png` (centre 195, 327). Behind the cat/card. |
| 3 | Wordmark "LUCKY / CAT." | 24 | 21 | 247.5 | 130.7 | `logo-luckycat.svg`. Or live text: Poppins 800, 76 px, line-height 0.86 (65.4 pt per line), letter-spacing −2 px, `#F3E9D7`; line 2 `color:transparent; -webkit-text-stroke:1.4px #F3E9D7`. Line 1 y 21, line 2 y 86.4. |
| 4 | Menu icon (메뉴) | 340 | 23 | 28 | 28 (+ label → 45) | `icon-menu-paw.svg`; label "메뉴" Noto Bold 9.5 px, cream 70 %, gap 3 pt, centred under icon. Right edge 368 (right: 22). |
| 5 | Daily chip | 263 | 133 | 103 | 25 | right edge 366 (right: 24). Pill: radius 999, border 1 px cream 35 %, padding 4 × 9, no fill, gap 5. Dot 6 × 6 `#FFB36B` + glow. Text "오늘 남은 뽑기 1" Noto Regular 10.5 px `#F3E9D7`. |
| 6 | Rule | 24 | 179 | 342 | 1 | cream 22 % |
| 7 | Sub-copy left | 24 | 187 | ~150 | 16 | "고양이가 골라 주는 오늘의 행운" Noto Regular 11 px, letter-spacing 0.5 px, cream 65 % |
| 8 | Sub-copy right | right-aligned to 366 | 187 | ~118 | 16 | "Nº 023 · FRI 10.09" Poppins Medium 10 px, letter-spacing 2 px, cream 45 % (dynamic: draw no. + date) |
| 9 | **Stage** (tap target group) | 0 | 211 | 390 | 400 | coordinates inside = stage space (the cat SVGs use it) |
| 9a | Cat tail | 252 | 429 | 80 | 94 | `cat-tail.svg/png`; **behind the card**. Sway pivot = tail base, (12, 84) inside the file (stage 262,300 / content 262,511). |
| 9b | Card shadow | centre (195, 583) | | 200 | 20 | ellipse rx 100 ry 10, `#000` 45 %, blur 9 pt |
| 9c | Face-down card | 108 | 311 | 174 | 270.7 | `card-facedown.png` (900×1400) or `card-facedown@3x-onscreen.png` (522×812). `transform: rotate(-2deg)` around its centre (195, 446). |
| 9d | Cat body (head + paws) | 116 | 221 | 158 | 152 | `cat-body.svg/png`; **in front of the card** (paws overlap the card top edge). Breathing origin = bottom centre (79, 142) inside the file. |
| 9e | zzz (live text) | baselines (268, 255) · (288, 235) · (302, 220) | | | | Gamja Flower "z", 28 / 20 / 14 px, cream, opacity .95 / .70 / .50 |
| 10 | Hint line | centred | 597 | 390 | 33 | "**톡,** 깨워서 오늘의 카드 받기" Gamja Flower 26 px `#F3E9D7`; "톡," in `#FFC48A` |
| 11 | Hint sub | centred | 634 | 390 | 14 | "TAP THE CAT TO DRAW" Poppins Medium 9.5 px, letter-spacing 3.5 px, cream 50 % |
| 12 | 도감 icon | 22 | 656 | 28 | 45 | `icon-dex-book.svg` + label "도감" (same label style as #4) |
| 13 | 방꾸미기 icon | 333 (icon at 336.5) | 656 | 35 | 45 | `icon-room-house.svg` + label "방꾸미기"; right edge 368 |
| — | Bottom | | | | | Icons sit 40 pt above the screen bottom = 6 pt above the 34 pt home-indicator safe area → `bottom: calc(env(safe-area-inset-bottom) + 6px)`. |

**Tap target:** make the whole cat + card group tappable (≈ x 100–300, y 211–595), not only the card. The 3 corner icons need ≥ 44 × 44 pt hit areas (pad around the 28 pt glyphs).

**Small screens:** keep the top block (#3–#8) and bottom icons fixed; the stage + hint can scale (≈ 0.85×) and stay centred in the space left between the sub-copy (y 203) and the bottom icons.

## 2. Z-order (back → front)

1. Background base (gradient + grain + stars)  2. Moon glow  3. Wordmark, menu icon, chip, rule, sub-copy
4. Cat tail  5. Card shadow  6. Face-down card  7. Cat body  8. zzz  9. Hint text  10. Bottom corner icons

## 3. Suggested animations (CSS keyframes / Framer Motion)

| target | animation |
|---|---|
| Cat body | breathing `scale 1 → 1.03 → 1`, 3 s, ease-in-out, infinite, `transform-origin: 50% 93%` (bottom centre). |
| Cat tail | sway `rotate −6deg ↔ +6deg` from base, 2.4 s, ease-in-out, infinite alternate, `transform-origin: 15% 89%` (= (12,84) in the 80×94 file). |
| zzz | each "z": translateY 0 → −14 pt, translateX 0 → +6 pt, opacity 0 → 1 → 0, 2.5 s, ease-out, infinite; delays 0 / 0.8 / 1.6 s (small → big order or reversed). |
| Moon glow | opacity .75 ↔ 1 (and optional scale 1 ↔ 1.04), 4–5 s, ease-in-out, infinite alternate. |
| Card | subtle float translateY 0 ↔ −4 pt, 3.6 s, ease-in-out, infinite alternate (keep −2deg rotation). Cat body/tail should follow the card (wrap card + cat in one floating group, breathing/sway inside it). |
| Tap feedback | press: group scale .97 (120 ms); release → cat eyes open / "z" stop → card flip to the drawn card. |
| Reduced motion | respect `prefers-reduced-motion`: disable float/sway, keep a static glow. |

## 4. Files

- `bg-night.png` / `bg-night.webp` — full background incl. moon glow (1170×2532).
- `bg-night-base.png` / `bg-night-base.webp` — same without moon glow (use with `moon-glow.png` to animate the glow).
- `moon-glow.png` — 960×960 (320 pt @3x), transparent radial glow `rgba(255,214,150,.55) 0% → rgba(255,190,130,.22) 38% → 0 at 70%`.
- `cat-body.svg/png`, `cat-tail.svg/png`, `cat-sleeping.svg/png` (combined reference; in the app the card sits between tail and body).
- `card-facedown.png` (900×1400) and `card-facedown@3x-onscreen.png` (522×812 = 174×270.7 pt @3x).
- `logo-luckycat.svg` — text converted to paths (no font needed).
- `icon-menu-paw.svg`, `icon-dex-book.svg`, `icon-room-house.svg` — 28 pt cream line icons with pink accents, transparent.

## 5. 남은 뽑기 어필 (2026-10-12 추가)
목표: 배너 없이 "더 뽑을 수 있다"가 보이게. 시안 `main-draws-3.png`(새 날, 3장 + 확률업), `main-draws-1.png`(2장 뽑은 뒤 1장 남음 + 넛지 CTA, 뽑기권 1장 보유), `main-draws-0.png`(다 뽑음, 잠든 덱 + 카운트다운, 확률업은 남아 있음).
값은 economy.json `draws`(normalPerDay 3, 모두 짧은 광고 · rateUpPerDay 1 긴 광고 · 생애 첫 뽑기만 무료)와 `tickets.rateUpTicket`에서 읽어요. 위의 #5 데일리 칩(우상단)은 **없애고** 아래 요소로 대체해요.

| 요소 | 위치(content y) | 규칙 |
|---|---|---|
| 덱 스택 | 카드(#9c) 뒤 | 남은 일반 뽑기 n장 = 보이는 카드 n장. 뒤 카드: ① translate(14,5) rotate(6°) brightness .62 opacity .85 ② translate(−9,10) rotate(−5°) brightness .52 opacity .70. 맨 위 카드 뒤 amber 글로우(타원 rx118 ry160, #FFC48A 16 %, blur 9). 뽑을 때 맨 위 카드가 뒤집히며 날아가고 뒤 카드가 앞으로 240ms 슬라이드. |
| 새 날 점 | 맨 위 카드 우상단(≈ x 278, y 307) | 빨간 점 9pt `#FF5A5F` + 작은 반짝이. 조건: 남은 뽑기 > 0 && 오늘 아직 안 뽑음. 첫 뽑기 후 사라짐. |
| 카운트 필 | 가운데, y 642, 높이 ≈ 26 | 점 3개(남은 = amber 채움+글로우, 쓴 것 = 테두리만) + 문구. n=3 "오늘 **3장** 뽑을 수 있어요" · 1~2 "오늘 **n장** 더 뽑을 수 있어요" · 0 "내일 00:00에 다시 채워져요 · HH:MM:SS"(KST 자정까지, 1초마다 갱신, Poppins 600 amber). 배경 #14132A 35 % + blur 6, 테두리 cream 28 %. |
| 힌트/CTA | y 587~633 | n=3(오늘 안 뽑음): 기존 힌트 "톡, 깨워서 오늘의 카드 받기"(Gamja 26). 1~2: **"한 장 더 뽑기 [광고] →"** 필 버튼(높이 46, amber 75 % 테두리, 은은한 글로우, Gamja 24) — 넛지: 2.6s마다 위로 3pt 톡 튀기, 처음 1.2s 뒤 시작. 0: "오늘 카드는 다 뽑았어요, 잘 자요"(Gamja 24, cream 85 %). 탭 대상은 고양이+덱 전체 + CTA. |
| 잠든 덱(n=0) | 카드 | 카드 grayscale .55 + brightness .5, 뒤 카드 없음, 글로우 없음, 달빛 glow opacity .55, zzz 유지. 탭하면 토스트 "오늘은 여기까지! 내일 다시 만나요"(확률업이 남아 있으면 "확률업 뽑기는 아직 할 수 있어요"). |
| 확률업 버튼 | 왼쪽 x 12, y 343, 폭 74 | 원 52pt(#FFC48A 1.4pt 테두리 + 글로우) + 반짝이 아이콘, "확률업"(10.5 Bold amber), "5성↑ 10→27%"(rates_proposal normal vs rateUp의 b5+special+character+legend 합, 값이 바뀌면 자동 계산), 하단 "광고"(긴 광고) 또는 뽑기권 있으면 "뽑기권 사용". 뽑기권 보유 시 우상단 배지 [티켓 아이콘 ×n](cream). 오늘 확률업 사용 + 뽑기권 0 → opacity .4, 문구 "내일 다시". 하루 일반 뽑기 한도와 별개. |
| 확률업 말풍선 | 버튼 위 x 10, y 290 (꼬리가 버튼 원 중심을 가리킴) | cream `#F3E9D7` 배경, 1.2pt amber 테두리 + 은은한 amber 글로우, r12, 패딩 6×10, Noto Bold 10.5px 2줄, 강조 단어 `#C46A1C`, 꼬리 10pt 마름모. 문구: 긴 광고가 필요할 때 "**{adSeconds}초** 광고 보고 / 확률업"(economy.json `draws.daily[slot=up].adSeconds`, 기본 30), 뽑기권 보유 시 "뽑기권으로 / 광고 없이 **확률업**", 오늘 사용 + 뽑기권 0이면 **숨김**. 떠 있는 애니메이션 translateY 0↔−3pt 3s ease-in-out 무한, `prefers-reduced-motion`이면 정지. 덱·카운트 필·고양이 머리를 가리지 않게 폭 ≤ 120pt. |
| 결과 화면 | draw-reveal | 보조 버튼 "한 장 더 뽑기 [광고] (남은 n장)" + 같은 넛지, amber 테두리. n=0이면 "확률업 뽑기 [광고]"(남아 있을 때) 또는 숨김. |

- ⚠ 27 %·10 %는 `rates_proposal`(_proposal: true) 기준이라 확률 확정 시 같은 식으로 다시 계산돼요. "두 배" 같은 고정 문구는 쓰지 않아요.
- 접근성: 카운트 필 `aria-live="polite"`, 움직임 줄이기면 넛지·글로우 펄스 끔.

### 5-1. 확률업 버튼 '포인트로 사기' 상태 (2026-10-12 추가)
- 조건: 오늘 광고 확률업을 썼고 + 뽑기권 0장 + 이번 주/오늘 구매 한도 남음.
- 버튼은 흐리지 않고 그대로(amber), 아래 작은 글씨 "200P"(발바닥 아이콘 10pt), 말풍선 "**200P**로 / 광고 없이 확률업". 탭하면 `sheet:ticketShop`(메뉴 스펙 10장, ticket-shop.png).
- 한도도 다 쓰면 기존 "내일 다시" 흐린 상태, 말풍선 없음. 포인트 부족이면 말풍선 대신 버튼 아래 "포인트 n P 부족"(cream 50 %).

- 확률업 버튼 반짝이 아이콘 파일: `icon-rateup-sparkle.svg` (26pt), 뽑기권 배지 아이콘: `icon-ticket-badge.svg` (10~11pt).
