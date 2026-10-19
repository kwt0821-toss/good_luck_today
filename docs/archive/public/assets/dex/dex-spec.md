# Lucky Cat: 고양이 도감 (collection) screen spec

Design frame: **390 × 844 pt**, assets at **3x**. Same rules as `mainscreen-assets/layout-spec.md`:
- Do **not** build the status bar (47 pt) or the Toss nav bar (56 pt) shown in the mockups. Toss draws its own nav bar; set its title to `도감`.
- **All y values are measured from the content top** (the bottom of the Toss nav bar, which is screen y 103 in the mockups). x is measured from the screen's left edge.
- Mockups are in `mockups/`: `dex-screen-a` (breed tab), `-b` (detail sheet), `-special`, `-character`, `-legend`.

## 0. Tokens

| token | value |
|---|---|
| bg | `bg-dex.webp` / `bg-dex.png` (1170×2532, gradient + grain, no UI). Or CSS: `radial-gradient(120% 70% at 70% 30%, #3A2F55 0%, #221D38 45%, #14132A 100%)` plus an optional grain overlay (SVG feTurbulence baseFrequency 1.0, 3 octaves, desaturated, `mix-blend-mode: soft-light`, opacity .5). This differs from the main screen's bg-night: it has no moon glow or stars. |
| cream | `#F3E9D7`; alphas used: .70 .62 .60 .50 .45 .42 .35 .30 .22 .13 .12 |
| amber | `#FFC48A` (accents, active tab, ×N badge, COMPLETE); bar start `#FFB36B` |
| NEW red | `#FF7E7E` |
| ink (text on amber/cream) | `#221D38` |
| special (meme) | lemon `#FFE680`, orange `#FF9F43` / `#FFB36B` |
| character | lavender `#C9B6F2` / `#E6DAFF`, pink `#FF9EC4` |
| legend | navy `#1A2140` (`#28305A` → `#141A33`), gold `#F5D27A` `#C9972E` `#FAE296` `#E8C66E` |
| side margin | 24 pt (content width 342) |

Fonts: **Poppins** 800 / 600 / 500 (Latin and numbers), **Noto Sans KR** 400 / 700 (Korean; the mockups used Noto Sans CJK), **Gamja Flower** (hand-written notes, flip hint, `?` glyphs).

## 1. Header (fixed and shared by all tabs; it may scroll away with the list, your choice)

| element | x | y | w | h | style |
|---|---|---|---|---|---|
| eyebrow "고양이 도감" | 24 | 20 | – | 16 | Noto 400, 11 px, ls .5 px, cream .60 |
| wordmark "COLLEC**TION.**" | 22 | 34 | 287 | 46 | `logo-collection.svg` (291.5×48, baseline 38), **or** live text: Poppins 800, 46 px, lh 1, ls −1.5 px, cream; "TION." uses `color:transparent; -webkit-text-stroke:1.2px #F3E9D7` |
| progress label | 24 | 100 | 342 | 23 | "모은 카드" Noto 11.5 px cream .70 · count **23** Poppins 800 15 px cream (margin 0 2 0 6) · "/ 107" Poppins 500 12 px cream .45 |
| percent (right) | right 366 | 100 | – | – | "21%" Poppins 600 11 px, ls 1 px, amber |
| progress bar | 24 | 132 | 342 | 3 | track cream .12, radius 2; fill `linear-gradient(90deg,#FFB36B,#FFC48A)` + `box-shadow:0 0 8px rgba(255,196,138,.7)`; width = owned / 107 |

## 2. Tabs (segmented, text only)

- Row x 24 to 366, y 150, h 31 (labels 20 + 10 padding + 1 px bottom rule cream .12). `display:flex; gap:17px; align-items:flex-end`.
- Labels: **품종 · 스페셜 · 캐릭터 · 레전드**. Noto 700, 14 px, cream .42, `white-space:nowrap; flex:none`. Measured x: 24 / 96.6 / 172.4 / 248.2 (w 55.6 / 58.8 / 58.8 / 56.8).
- Count as a superscript after each label ("17/90", "3/9", "2/4", "1/4"): Poppins 500, 9 px, ls .5 px, margin-left 3 px, `vertical-align:4px`, cream .35.
- Active tab: label cream `#F3E9D7`, count amber. Underline is 2 px high, the label's width, at `bottom:-11px` (it sits on the rule), radius 1, amber, `box-shadow:0 0 6px rgba(255,196,138,.8)`. Slide it to the tapped tab (see §8).
- Right side: sort "A–Z" at x 342 (right-aligned to 366), Poppins 500, 10 px, ls 1.5 px, cream .45.

## 3. Breed tab (품종): list of rows

- List starts at y 200. Each row is 130 pt high, with 26 pt between rows (pitch 156: rows at y 200, 356, 512, …). Vertical scroll. Bottom fade: an overlay 90 pt high, `linear-gradient(transparent, #14132A 85%)`.
- Row header (h 23), baseline-aligned, gap 7:
  - English breed name: Poppins 600, 15 px, ls .2 px, cream.
  - Korean name: Noto 400, 10.5 px, cream .50.
  - Right side: "**n** / 5" in Poppins 500 11 px cream .50, with n in 700 cream. **Or** the COMPLETE stamp when 5/5.
- Slots sit 10 pt below the header (y +33). There are **5 slots, 62 × 97 pt, gap 8**, x = 24, 94, 164, 234, 304. Radius 6. They show ★1 to ★5 from left to right.
- Owned slot: `thumbs/breed/{id}_thumb.webp` (188×292) with `object-fit:cover`, radius 6, `box-shadow:0 6px 14px rgba(0,0,0,.35)`.
- Locked slot: see §6 (`locked-breed`).

## 4. Special (스페셜) and character (캐릭터) tabs: 3-column grid

- Section header at y 200 (h 23): en (Poppins 600 15 px cream) + ko (Noto 10.5 px cream .50), with "**n** / N" on the right. Text: "Special 스페셜 카드" / "Character 캐릭터 카드".
- Note at y 227 (h 21): Gamja Flower 16 px, cream .62. Text: "별 등급 없이, 딱 한 종류씩만 있는 특별 카드" / "어디서 본 듯한 그 고양이들, 계속 늘어나요".
- Grid at y 262: **3 columns of 106 pt, column gap 12, row gap 18**. Card box **106 × 165**, radius 9. Column x = 24 / 142 / 260. Each cell is 189 high (card + 7 + name) and the row pitch is 207 (rows at y 262, 469, 676).
- Owned image: use `cards/{type}/{id}_front.webp` (660 px wide is sharp at 106 pt), `box-shadow:0 8px 18px rgba(0,0,0,.38)`.
- Name under the slot, 7 pt below: Noto 700 11 px, ls .2, cream, centred. When locked, show "???" in Poppins 600 11 px, ls 2 px, cream .35.
- Character tab: after the 4 real slots, add **COMING SOON** placeholder slots to fill the row. Their name line is "곧 만나요", Noto 400 cream .30.
- Special cards have **no stars**.

## 5. Legend tab (레전드): 2-column grid

- Header and note as in §4: "Legend 레전드 카드", note "아주 가끔, 전설의 고양이가 나타나요".
- Grid at y 262: **2 columns of 150 pt, column gap 42, row gap 20**. Card box **150 × 233**, radius 12. Column x = 24 / 216. Row pitch is 277 (rows at y 262, 539).
- **Gold rim** on every legend slot: a 2 px padding wrapper with `background: linear-gradient(135deg,#F5D27A,#C9972E 35%,#FAE296 55%,#C9972E 75%,#F5D27A)` and `box-shadow:0 0 22px rgba(245,210,122,.18)`. The inner box has radius 10 and `overflow:hidden`.
- Owned: the front image inside the rim, plus a glow `box-shadow:0 0 30px rgba(245,210,122,.38), 0 10px 24px rgba(0,0,0,.4)` and a **shine** overlay: `linear-gradient(115deg, transparent 30%, rgba(255,250,225,.38) 45%, transparent 58%)`, `mix-blend-mode:screen` (animate it, see §8). The name is gold `#F5D27A`.
- Locked: see §6 (`locked-legend`).

## 6. Locked and placeholder slots (implement in CSS; PNGs are reference only)

Reference PNGs are in `locked/*@3x.png` with transparent backgrounds. The glyphs are SVGs in `locked/glyph-*.svg` (the "?" is already outlined, so the font is not needed).

| slot | size | box CSS | content |
|---|---|---|---|
| `locked-breed` | 62×97 r6 | `background:linear-gradient(160deg,rgba(243,233,215,.07),rgba(243,233,215,.025)); border:1px solid rgba(243,233,215,.13)` | `glyph-breed.svg` 30×30 centred (opacity .38 is baked into the SVG). Stars (★ × n): live text 7.5 px, ls 1 px, `rgba(255,196,138,.45)`, centred, bottom 8 |
| `locked-special` | 106×165 r9 | `linear-gradient(160deg,rgba(255,230,128,.10),rgba(255,159,67,.03)); border:1px solid rgba(255,159,67,.38)` | `glyph-special.svg` 40×34 centred; label "SPECIAL" Poppins 800 7.5 px, ls 1.8 px, `rgba(255,230,128,.6)`, bottom 10 |
| `locked-character` | 106×165 r9 | `linear-gradient(160deg,rgba(201,182,242,.13),rgba(255,158,196,.04)); border:1px solid rgba(255,158,196,.38)` | `glyph-character.svg` 40×40; label "CHARACTER" same type, `rgba(255,158,196,.7)` |
| `coming-soon` | 106×165 r9 | `background:rgba(243,233,215,.02); border:1px dashed rgba(243,233,215,.2)` | `glyph-plus.svg` 26×26; label "COMING SOON" Poppins 500 8 px, ls 1.4 px, cream .32 |
| `locked-legend` | 150×233 (gold rim as §5) | inner `radial-gradient(80% 60% at 50% 40%, #28305A, #1A2140 70%, #141A33)` | `glyph-legend-q.svg` ("?" in Gamja 58 px with a gold gradient, plus `filter:drop-shadow(0 0 8px rgba(245,210,122,.35))`); 4 sparkles `icons/icon-sparkle.svg` 7–11 px at opacity .55 / .4, placed at (18,22) (right 20, 46) (30, bottom 52) (right 26, bottom 70); label "LEGEND" Poppins 800 8.5 px, ls 2.6 px, `#E8C66E`, bottom 14. The PNG has 24 pt of padding on each side so the glow fits (198×281 pt). |

## 7. Badges and states

| state | rule / style |
|---|---|
| owned | Show the real thumbnail or front image. |
| locked | Use the §6 slot and the name "???". Tapping it can show a toast such as "아직 못 만난 고양이예요" (optional). |
| **NEW** (first draw, not yet viewed) | Tag at top-left 4/4 inside the slot. Poppins 800, 7 px, ls 1 px, white on `#FF7E7E`, radius 3, padding 1×3. Reference: `icons/tag-new.svg`. Clear it after the user opens the card. |
| **duplicate ×N** (N ≥ 2) | Pill at top-right, offset right −4 / top −5 (it overhangs the slot). Poppins 700, 8.5 px, `#221D38` on amber, radius 999, padding 1×5. Text "×2", "×3"… Reference: `icons/badge-dup-x2.svg` (live text recommended). |
| **COMPLETE** (all 5 stars of a breed) | Replaces "n / 5" in the row header. Reference: `icons/stamp-complete.svg` (71×23). CSS: Poppins 800 8.5 px, ls 1.6 px, amber, border 1.2 px amber, radius 4, padding 2 5 1, `rotate(-4deg)`, `box-shadow:0 0 8px rgba(255,196,138,.25)`. |
| coming soon | Character tab only (§6). Not tappable. |
| counts | The tab superscripts and the progress line come from data: owned / `cards.json` counts. Totals are breed 90, special 9, character 4, legend 4 (107 in all). |

## 8. Card detail bottom sheet (tap an owned card)

| element | x | y | w | h | style |
|---|---|---|---|---|---|
| backdrop | 0 | 0 | 390 | full | `rgba(10,9,22,.62)` + `backdrop-filter: blur(3px)`. Tap it to close. |
| sheet | 0 | 101 (bottom 0) | 390 | 640 | radius 28 28 0 0; `radial-gradient(90% 60% at 50% 30%, #3A2F55 0%, #251F3D 55%, #1A1730 100%)` + grain; `box-shadow:0 -10px 40px rgba(0,0,0,.45)`; top border 1 px cream .12 |
| handle | 176 | 111 | 38 | 4 | radius 2, cream .30 (9 pt below the sheet top) |
| close button | 340 | 124 | 30 | 30 | circle, border 1 px cream .20, `icons/icon-close.svg` 12×12 |
| title | 24 | 128 | – | 26 | English breed name or name: Poppins 800, 26 px, ls −.5, cream |
| subtitle | 24 | 160 | – | 16 | "샴 · 3성 카드" Noto 11 px cream .60 + stars "★★★" amber 10 px ls 1. Specials show e.g. "스페셜 카드" with no stars. |
| card | 85 | 200 | **220** | **342** | front image (`cards/…_front.webp` 660×1027), radius 15, `rotate(-1.5deg)`, `box-shadow:0 24px 40px rgba(0,0,0,.5), 0 0 0 1px rgba(243,233,215,.15)` |
| card glow | card −40 on every side | | | | `radial-gradient(closest-side, rgba(255,214,150,.38), transparent)` behind the card |
| flip button | 275 | 510 | 44 | 44 | circle, cream fill, `icons/icon-flip.svg` 22×22, `box-shadow:0 6px 16px rgba(0,0,0,.4)`; anchored right −14 / bottom −12 of the card |
| flip hint | centred | 562 | 390 | 24 | Gamja Flower 19 px cream .85: "**톡,** 뒤집어서 뒷면 보기" ("톡," in amber). Swap to "앞면 보기" when flipped (suggestion). |
| stats | 24 | 606 | 342 | 58 | top rule cream .12, padding-top 14. Three equal columns separated by 1 px cream .12 lines. Key: Noto 10 px, ls .5, cream .50. Value: Poppins 700 15 px cream (small part: 10 px 500 cream .55). Columns: 처음 만난 날 "10.07 2026" · 보유 "×2" (amber) · "{breed} 컬렉션" "3 / 5". For specials use "스페셜 컬렉션 3 / 9" etc. |
| paging dots | centred | 686 | – | 5 | 5 px dots cream .22, gap 6. Active dot is 16×5, radius 3, cream. One dot per card in the current row or grid. |

Interactions: **swipe left/right** on the card moves to the previous/next owned card in the same breed row or tab (skip locked ones) and updates the dots. **Tapping the card or the flip button** flips it. **Drag the sheet down** to close.

## 9. Animations (suggested)

| what | spec |
|---|---|
| sheet open | backdrop opacity 0 → 1 over 220 ms; sheet translateY(100%) → 0 over 380 ms `cubic-bezier(.2,.9,.25,1)`; card scale .92 → 1 with a 60 ms delay. Close reverses this over 260 ms ease-in. |
| card flip | container `perspective:1200px`; inner `transform-style:preserve-3d; transition: transform .5s cubic-bezier(.4,.2,.2,1)`; rotateY 0 → 180deg; front and back faces use `backface-visibility:hidden`, back pre-rotated 180deg. Keep the −1.5deg tilt on the wrapper. |
| tab switch | the underline slides (left/width transition 250 ms ease-out); content cross-fades with a 6 pt slide over 200 ms |
| legend shimmer | move the `.shine` gradient `background-position` (or translateX) from −120% to 120% over 1.6 s ease-in-out, repeat every ~4 s; glow `box-shadow` pulse .3 ↔ .45 alpha, 3 s alternate |
| NEW pulse | tag scale 1 → 1.08 → 1 and opacity .85 → 1, 1.4 s ease-in-out infinite; stop after the card is viewed |
| progress bar | width animates from 0 on first view, 700 ms ease-out |
| COMPLETE stamp | when a breed is completed: scale 1.6 → 1, opacity 0 → 1, rotate −12 → −4deg, 350 ms with an overshoot `cubic-bezier(.3,1.6,.5,1)` |

## 10. Files

```
bg-dex.webp / bg-dex.png        1170×2532 background (no UI)
logo-collection.svg             wordmark as paths
cards.json                      107 cards (id, type, breed{id,en,ko} | name{ko}, nameTemp, stars, front, back, thumb)
cards/{breed|special|character|legend}/{id}_front.webp, _back.webp   660×1027 (220×342 pt @3x), q85, transparent corners
thumbs/{type}/{id}_thumb.webp   188×292 (≈62×97 pt @3x)
locked/glyph-*.svg, locked/*@3x.png
icons/stamp-complete.svg, tag-new.svg, badge-dup-x2.svg, icon-flip.svg, icon-close.svg, icon-sparkle.svg
mockups/dex-screen-*.png
```
Breed ids: `{breed}_{1..5}`, e.g. `abyssinian_3`, `norwegian_forest_5`. Specials, characters, and legends use a short slug: `hangang`, `meowth`, `baekho`, ….
Names marked **`"nameTemp": true`** are placeholders and need the owner's final naming.
