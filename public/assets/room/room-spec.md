# 방꾸미기 (MY ROOM.) — dev spec v3

Toss in-app mini app (앱인토스). Frame 390×844 pt, assets at 3x.
Status bar 47 pt + Toss nav 56 pt (title "방꾸미기"). **Content top = 103 pt**; all `y` below are content-relative unless marked *screen*.
Mockups: `mockups/room-screen-a-v3.png` (view), `mockups/room-screen-b-v3.png` (edit).
Values marked **(PH)** are placeholders.

## 1. Tokens
| token | value |
|---|---|
| page bg | `#24182C` (matches the edge colour of `world/base-bg`, so the island blends seamlessly) |
| cream (text/icons) | `#F3E9D7`; secondary text `rgba(243,233,215,.6)`, tertiary `.45` |
| amber (accent/CTA) | `#FFC48A`; CTA gradient `#FFD3A3 → #FFC48A`; text on amber `#221D38` |
| delete red | `#FF9E9E` icon, bg `rgba(255,126,126,.12)` |
| invalid tile (PH) | `#FF7E7E` |
| grain overlay | same noise as main/dex screens, soft-light, opacity .32 |
| fonts | Poppins 800/700/500 (latin, numbers), Noto Sans KR 400/700 (UI), Gamja Flower (hand-written hints) |

## 2. World (the island + room)
All world layers are **3840×2160 world px** (3x of a 1280×720 design canvas), transparent except `base-bg`. Stack them in one container of the same size and scale the whole container per screen (see `grid.json → screens`):

| screen | scale (pt per world px) | container left / top (*screen* pt) | container size |
|---|---|---|---|
| A view | 0.24667 (=0.74/3) | −282.33 / 142.0 | 947.2 × 532.8 |
| B edit | 0.28 (=0.84/3) | −342.67 / 39.67 | 1075.2 × 604.8 |

Feather the container edges into the page bg (CSS mask, ~37 pt linear fade) so there are no seams. Add 100–120 small twinkling stars on the page bg outside the island (cream `#FFF0D6` 70% / amber `#FFD696` 30%, r 0.4–0.8 pt, alpha .3–.8; a few 4-point sparkles).

Layer order (bottom → top):
1. `world/base-bg.webp` — cloud island with cat ears, hanging charms, cards, small clouds, stars
2. `world/room-walls.svg` — 2 plum walls with sparkle wallpaper and cream cap
3. `world/room-floor.svg` (view) / `world/room-floor-edit-grid.svg` (edit: cream grid lines)
4. edit-tile overlays (footprint / hints / drag preview) — draw in code using `world/tile-*.svg` styles
5. rug decal (`items/rug@3x.webp`)
6. contact shadows — generate per item in code (formula in grid.json); `world/contact-shadows.svg` = baked default
7. wall items (`window`, `frames`)
8. `world/string-lights.svg`
9. floor items, depth-sorted (grid.json `depthSort`)
10. `world/lamp-glow-additive.webp` — `mix-blend-mode: screen` (or plus-lighter), follows the lamp
11. `world/front-puffs-view.svg` / `front-puffs-edit.svg` — cloud puffs overlapping the front floor edge (edit version sits lower so the front row stays visible)
12. selection UI (DOM, not in world)

`world/_reference/composite-*.webp` show the full stack.

## 3. Grid (8×8)
- Tile = 52×26 design units = 156×78 world px → **A: 38.48×19.24 pt, B: 43.68×21.84 pt**.
- Tile top corner (*screen* pt): **A** `x = 191.27 + (c−r)·19.24`, `y = 364.00 + (c+r)·9.62`; **B** `x = 194.93 + (c−r)·21.84`, `y = 291.67 + (c+r)·10.92`.
- Hit test: convert the touch (*screen* pt) to design units `u = (x − left)/S`, `v = (y − top)/S` (S = 0.74 on A, 0.84 on B; left/top = world container), then `c = ((u−640)/26 + (v−300)/13)/2`, `r = ((v−300)/13 − (u−640)/26)/2`; floor both.
- Item sprite position = footprintCentre(col,row,w,d) + `anchorOffsetWorldPx` (items.json).

Default layout (col,row · w×d): cabinet (3,0) 2×1 · cattower (0,4) 1×1 · floorlamp (6,0) 1×1 · plant (0,7) 1×1 · catbed (3,3) 2×2 · yarn (5,5) 1×1 · rug decal (3,3) 3×3 · window on the left wall · frames on the right wall.

## 4. Screen A — view
| element | layout (pt, content-relative) | style |
|---|---|---|
| eyebrow "방꾸미기" | left 24, top 18 | Noto 11, ls .5, cream .6 |
| logo `ui/logo-myroom.svg` | left 22, top 32 (40 px cap) | "MY" solid, "ROOM." outline 1.1 |
| meta | right 24, top 30, right-aligned | "COZY Lv.3" Poppins 800 12 cream; "ITEMS 09" Poppins 500 9.5, ls 2, cream .55 **(PH values)** |
| warm glow | *screen* left −5, top 228, 400×420 | radial `rgba(255,206,160,.13) → .04 @60% → 0`, blend screen |
| island | see §2 | anchor: design (645,400) → content (195,335) |
| hint | top 586, centred | Gamja 19, cream .9; "쉿," in amber: "**쉿,** 냥이가 자는 동안 방을 꾸며 봐요" |
| bottom bar | left/right 24, top 630, h 62, radius 31 | bg `rgba(38,26,50,.55)`, 1px `rgba(243,233,215,.14)`, blur 6; padding 0 10 0 18 |
| · points | left | `ui/icon-paw-point.svg` 20 + "1,240" Poppins 800 16 + "PAW POINTS" Poppins 500 7.5 ls 1.6 cream .45 |
| · CTA 꾸미기 | centred (+6) | h 42, padding 0 22, radius 21, amber gradient, Noto 700 15 `#221D38`, `ui/icon-brush.svg` 16 (dark icon); glow `0 0 18 rgba(255,196,138,.45)` |
| · 저장 / 초기화 | right, 44 wide each | `ui/icon-save.svg` / `ui/icon-reset.svg` 18 + label Noto 700 8.5 cream .6 |

## 5. Screen B — edit
| element | layout (pt, content-relative) | style |
|---|---|---|
| top fade | top 0, h 96 | `rgba(38,26,50,.92) 30% → 0` |
| vignette | full screen | radial 70%×38% at 50% 34%, `rgba(18,12,30,0) 55% → .6` |
| edit bar | left/right 20, top 14, h 34 | 취소: ghost pill h30, pad 14, 1px cream .25, Noto 700 12 cream .75 · title "EDIT" Poppins 800 13 ls 2.5 + "꾸미는 중" 9.5 cream .5 · 완료: amber pill h30 pad 16, Noto 700 12.5 `#221D38`, glow |
| island | see §2 | anchor design (640,330) → content (195,214) |
| selection box | sprite bounds + 6 pt pad (mockup: x 80.1, y 169.6, 54.0×76.4) | `ui/selection-box.svg` style: dashed 1.8 `#FFC48A` dash 6/4, rx 9, fill amber .06; 4 handles r 4.5 cream fill, amber 2 stroke |
| mini toolbar | centred over box, top = box.top − 50 | h 38, pad 0 6, radius 19, `rgba(28,24,46,.92)`, 1px cream .16, shadow `0 8 18 rgba(0,0,0,.45)`, 9 pt caret below; 4 buttons 30×30 circles gap 4 (bg cream .07; delete bg red .12) with 15 pt icons: `icon-move`, `icon-rotate`, `icon-flip`, `icon-delete` |
| tag | centred under box, top = box.bottom + 6 | amber pill radius 6, pad 1/7, Noto 700 10 `#221D38`: "캣타워 · 1×1" (name · w×d) |
| drawer sheet | bottom 0, h 372 (top = content 369), radius 28 28 0 0 | `radial-gradient(90% 60% at 50% 0, #3A2F55, #251F3D 60%, #1A1730)`, top border cream .12, grain .45 |
| · handle | top 9, 38×4 | cream .3 |
| · header | left 24, top 24 | "ITEMS" Poppins 800 22 ls −.5 + "꾸미기 서랍" Noto 11 cream .55; right: points chip (paw 14 + "1,240" Poppins 700 12, 1px amber .45 border, pill) |
| · hint row | top 58 | Gamja 16.5 cream .78 "중복 카드를 발바닥 포인트로 바꿔 가구를 사요" + link "바꾸기 ›" Noto 700 10 amber |
| · tabs | top 92, gap 17 | 가구 · 소품 · 벽지 · 바닥 · 카드액자 — Noto 700 13.5; off cream .42; on cream + 2 pt amber underline (glow) 10 pt below; 1px divider cream .12 |
| · grid | top 134, left 24, 4 columns × 75 pt, gap 12 (row) / 14 (col) | tile 75×75 radius 16, bg cream .06, 1px cream .1; icon `items/tiles/tile-*.svg` fitted ≤ 56×58 |
| · tile label | 5 below tile | Noto 700 10.5 cream (locked: cream .45) |
| · tile sub | below label | owned: "보유" / placed: "배치 중" Poppins 500 8 ls 1.2 cream .4; locked: paw 11 + price Poppins 700 10.5 amber |
| · bottom fade | bottom 46 | `→ #1A1730` (scroll hint) |

Tile states: **owned** (plain, "보유") · **placed** (`ui/badge-check.svg` 14 at top-right 5/5, "배치 중") · **selected** (1.5 amber border, amber .1 fill, glow 16 amber .25 + check) · **locked** (icon 32% opacity + grayscale .6, `ui/icon-lock.svg` 13 at top-right, cream .6, price row).

## 6. Interactions
- **꾸미기 (A→B):** 420 ms `cubic-bezier(.2,.8,.2,1)`: world container scale .74→.84 and moves so design (640,330) lands at content (195,214); floor cross-fades to the edit grid; puffs swap view→edit; the header, hint and bottom bar fade out over 160 ms; the edit bar fades in; the drawer slides up 372 pt (spring, 60 ms delay). Reverse on 완료/취소.
- **Select:** tap a sprite (alpha hit test, topmost in depth order). It lifts 4 units (12 world px) with an ease-out of 120 ms, its footprint gets amber fill + dashed outline drawn above sprites, then the selection box, toolbar and tag appear (fade+scale .96→1, 140 ms). Tap empty floor → deselect. Show soft hint tiles (`tile-hint-empty`) on up to 2 nearest free spots where the item fits.
- **Drag / move:** long-press 200 ms or the move button → the sprite follows the finger (offset kept) and snaps to the tile under the footprint centre; preview footprint tiles: **valid** amber (`tile-place-valid`), **invalid** red (`tile-place-invalid`) if out of the 8×8 grid or overlapping another item (rug/decals never block). On release: if valid → settle with 160 ms spring + light haptic; if invalid → return to the original tile.
- **Rotate:** swap footprint `[w,d]→[d,w]` and mirror the sprite horizontally (`scaleX(-1)` about the footprint centre); blocked (shake + red flash 300 ms) if the new footprint does not fit.
- **Flip:** mirror the sprite only; the footprint stays the same.
- **Delete:** the sprite shrinks and fades (180 ms) and flies toward the drawer; the item returns to the drawer as **보유** (no refund).
- **Drawer tap:** owned/unplaced → place on the first free tile that fits (scan by depth key from the back corner, row-major) and auto-select it; placed → select it in the room; locked → purchase sheet (price in paw points; confirm → points −price, state becomes owned) **(PH flow)**.
- **Tabs:** 벽지 / 바닥 swap the wall/floor skin immediately (preview) and apply on 완료.
- **완료:** saves the layout (items: id, col, row, rot, flip; wall item slots; skins) → toast "방을 저장했어요" → back to view mode. **취소:** discards all changes since entering edit mode (keep a snapshot) → view mode; if changes exist, confirm "변경사항을 버릴까요?" [계속 꾸미기] [버리기] **(PH copy)**.
- **저장 (A):** saves the current room as an image to the gallery / share sheet **(PH)**.
- **초기화 (A):** confirm dialog "방을 처음 상태로 되돌릴까요?" / "배치한 가구는 서랍으로 돌아가요. 산 아이템은 그대로 있어요." [취소] [초기화] → resets to `grid.json → defaultLayout` **(PH copy)**.

## 7. Suggested ambient animation (view mode; reduce/stop in edit mode except lamp and cat)
- **Island float:** whole world container translateY 0 → −4 pt → 0, 6 s ease-in-out infinite.
- **Charms swinging** (hanging paws/stars under the island): they are baked into base-bg — for motion, mask the base and overlay rotating copies, or simply skip; light alternative: ±2° rotation of a separate charm sprite **(asset TODO if wanted)**.
- **Fortune cards drifting** (baked in base-bg): optional parallax: the base layer moves 0.3× of the island float **(TODO separate sprites)**.
- **Lamp glow flicker:** glow opacity .85 ↔ 1 with irregular keyframes over 3.2 s; string-light bulbs twinkle (opacity .6–1, staggered).
- **Cat breathing:** reuse the main-screen sleeping cat breathing (scaleY 1 → 1.025 from the bottom, 3.6 s) on the catbed sprite's cat area (or swap in `mainscreen-assets/cat-sleeping.svg` layered on an empty bed later).
- **Stars twinkle:** random 2–5 s opacity loops.
- Respect `prefers-reduced-motion`.

## 8. Duplicate cards → paw points (바꾸기) — PLACEHOLDER
- "바꾸기 ›" in the drawer opens a bottom sheet "중복 카드 바꾸기": a list of duplicate cards (thumb, name, ×count, stepper) and a total, CTA "발바닥 N개로 바꾸기".
- Suggested rates **(PH)**: 일반 10 · 레어 30 · 스페셜 60 · 레전드 150 paw points per duplicate. You can never convert the last copy of a card (it stays in the 도감).
- After confirming: update the points chip with a count-up animation and toast "발바닥 +N 받았어요".

## 9. Files
- `world/` — base-bg (.webp, .png), room-floor, room-floor-edit-grid, room-walls, string-lights, contact-shadows, edit-footprint-hints (svg + webp), front-puffs-view/edit (svg + webp), lamp-glow-additive.webp, tile style SVGs (`tile-footprint-selected`, `tile-place-valid`, `tile-place-invalid`, `tile-hint-empty`, `tile-grid-edit`), `_reference/`
- `items/` — `{id}@3x.webp|png` world sprites (cut from the approved concept; slightly soft, worth a hi-res redraw later), `rug-source.svg`, `yarn-vector.svg`, `tiles/tile-{id}.svg|@3x.png` drawer icons
- `ui/` — logo, icons, check badge, selection-box reference
- `items.json`, `grid.json`, `mockups/`
