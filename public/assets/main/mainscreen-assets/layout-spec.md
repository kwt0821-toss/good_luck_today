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
