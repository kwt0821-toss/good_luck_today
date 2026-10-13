# 방꾸미기 (MY ROOM.) — dev spec v6 (v5 + floor/wallpaper tiles + angle fix)

Toss in-app mini app (앱인토스). Frame 390×844 pt, assets at 3x.
Status bar 47 pt + Toss nav 56 pt (title "방꾸미기"). **Content top = 103 pt**; all `y` below are content-relative unless marked *screen*.
Mockups: `mockups/room-screen-a-v5.webp` (view), `mockups/room-screen-b-v5.webp` (edit), `mockups/room-v5-catalog.webp` (48 items).
Values marked **(PH)** are placeholders.

**What changed from v3/v4:** every furniture sprite is now true 2:1 isometric and registered to its footprint tiles. All sprites are *pure item* on transparent bg (no floor tile, no baked shadow). Shadows are separate sprites drawn by the app. Wall items ship pre-slanted for each wall (`_L` / `_R`).

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
All world layers are **3840×2160 world px** (3x of a 1280×720 design canvas), transparent except `base-bg`. Stack them in one container of that size and scale the whole container per screen:

| screen | scale (pt per world px) | container left / top (*screen* pt) | container size |
|---|---|---|---|
| A view | 0.24667 (=0.74/3) | −282.33 / 142.0 | 947.2 × 532.8 |
| B edit | 0.28 (=0.84/3) | −342.67 / 39.67 | 1075.2 × 604.8 |

Feather the container edges into the page bg (CSS mask, ~37 pt linear fade). Add 100–120 small twinkling stars on the page bg outside the island.

Layer order (bottom → top):
1. `world/base-bg.webp` — cloud island
2. `world/room-walls.svg`
3. `world/room-floor.svg` (view) / `world/room-floor-edit-grid.svg` (edit)
4. edit-tile overlays — draw in code with the `world/tile-*.svg` styles
5. rug decal `items/decor/pawrug` — see §3.4
6. **contact shadows** — `shadows/shadow-{w}x{d}.png`, one per floor item (§3.5)
7. wall items `items/wall/{id}_L.png` (left wall) / `{id}_R.png` (right wall) (§3.6)
8. `world/string-lights.svg`
9. floor items, depth-sorted (§3.3); on-top items drawn right after their host
10. `world/lamp-glow-additive.webp` — `mix-blend-mode: screen` (or plus-lighter); baked for the lamp at (0,0) — move or re-render if the lamp moves
11. `world/front-puffs-view.svg` / `front-puffs-edit.svg`
12. selection UI (DOM)

`world/_reference/composite-view|edit.webp` show the full stack; `debug-grid.webp` shows the footprints (orange) and each sprite's registered floor diamond (cyan).

## 3. Grid, sprites and placement
### 3.1 Grid
- 8×8, 2:1 iso. Tile = 52×26 design units = **156×78 world px** → A 38.48×19.24 pt, B 43.68×21.84 pt.
- Tile top corner, world px: `x = 1920 + (c−r)·78`, `y = 900 + (c+r)·39`. **col axis** runs down-right along the RIGHT wall (row 0 = right wall); **row axis** runs down-left along the LEFT wall (col 0 = left wall).
- Footprint centre `P(c+w/2, r+d/2)`.
- Tile top corner, *screen* pt: **A** `x = 191.27 + (c−r)·19.24`, `y = 364.00 + (c+r)·9.62`; **B** `x = 194.93 + (c−r)·21.84`, `y = 291.67 + (c+r)·10.92`.
- Hit test: `u = (x − left)/S`, `v = (y − top)/S` (S = 0.74 A / 0.84 B), `c = floor(((u−640)/26 + (v−300)/13)/2)`, `r = floor(((v−300)/13 − (u−640)/26)/2)`.

### 3.2 Scale rule & anchors (all sprites are 3x world px; draw at 1 sprite px = 1 world px)
- **Furniture (16):** the art was drawn standing on a floor tile. I measured that tile and used an affine to map it onto an exact 2:1 diamond: **1.2 × the 1×1 footprint** for 1×1 items (the item's own base then lands on its tile — the art's tile is ~20% bigger than the item base) and **2×2** for sofa/bed (their base covers the 2×1 / 1×2 footprint). The tile itself is removed.
  Place: `spriteTopLeft = footprintCentreWorldPx − orientations[o].anchorFootprintCenterPx` (items.json). `anchorBackCornerPx` = where the footprint's back (top) corner falls, for reference.
- **Decor (16) + hero cat:** angle-neutral or drawn iso; bottom-centre anchor: width = `displayWidthTiles × 156` px, `x = cx − w/2`, `y_bottom = cy + 0.55·(w+d)/2·39` (cx,cy = footprint centre, world px).
- **On-top items** (moonlamp on cabinet, fishbowl on bookshelf): `x = host.x + host.w·fx − w/2`, `y_bottom = host.y + host.h·fy` at 62% of their decor width; mirror `fx → 1−fx` when the host is mirrored.

### 3.3 Depth sort
Sort floor items by `(c+w−1)+(r+d−1)` ascending, tie-break `c−r` ascending; the selected item is drawn last while it's lifted. Decals (rug) and shadows sit under every item.

### 3.4 Rug (floor decal)
`items/decor/pawrug.png` is the top-down art projected exactly onto the 2×2 footprint: radius 0.96 tile, `(u,v)` tile coords → `x=(u−v)·78`, `y=(u+v)·39`. Centre the image on the footprint centre. No shadow; never blocks placement.

### 3.5 Contact shadows (toggleable, not baked)
| file | footprint | size px | anchor |
|---|---|---|---|
| `shadows/shadow-1x1.png` | 1×1 | 250×126 | image centre |
| `shadows/shadow-2x1.png` | 2×1 (long along col) | 328×164 | image centre |
| `shadows/shadow-1x2.png` | 1×2 (long along row) | 328×164 | image centre |
| `shadows/shadow-2x2.png` | 2×2 | 406×204 | image centre |
Soft iso ellipse (top-down ellipse 92% of the footprint, projected 2:1, blur 3 px), colour `#2A1530`, peak alpha .38. Draw centred on the footprint centre, under all items. Decor and hero use the matching sprite at **80%** scale. When an item rotates 2×1 ↔ 1×2, swap the shadow too. Lifted (selected) items keep the shadow on the floor. Shadows can be turned off without other changes.

### 3.6 Orientation, flip and wall slant
- The default image faces **front-left (+row)** with its back to the **right wall** (row 0). `{id}_m.png` (horizontal mirror) faces **front-right (+col)** with its back to the **left wall** (col 0).
- Choose per placement so the item faces into the room: right wall → default, left wall → mirrored. Footprint for mirrored = `[d,w]` of default. Only 2 directions — no back views.
- **Wall items:** `{id}_L.png` for the left wall, `{id}_R.png` for the right wall (front art compressed horizontally ×0.894 and slanted so horizontal edges follow the wall: left `y′ = y − 0.5·x′`, right `y′ = y + 0.5·x′`; verticals stay vertical). Position: base point `P(0,t)` (left) / `P(t,0)` (right), raised by `heightUnits × 3` px; the image centre sits there. `{id}.png` = flat front art (drawer/catalog).
- Card frames (`cardframe`, `squareframe`) show a card thumbnail in code: render the card into the frame front art first, then apply the same slant.

### 3.7 Footprints & default layout
Furniture: all 1×1 except **sofa 2×1** and **bed 1×2**. Decor 1×1, rug 2×2. Full default layout with world px and orientation → `grid.json → defaultLayout` (24 floor incl. rug + hero, 7 wall, 2 on-top = **33**).

## 4. Screen A — view
| element | layout (pt, content-relative) | style |
|---|---|---|
| eyebrow "방꾸미기" | left 24, top 18 | Noto 11, ls .5, cream .6 |
| logo `ui/logo-myroom.svg` | left 22, top 32 (40 px cap) | "MY" solid, "ROOM." outline 1.1 |
| meta | right 24, top 30, right-aligned | "COZY Lv.3" Poppins 800 12 cream; "ITEMS 33" Poppins 500 9.5, ls 2, cream .55 — **computed**: number of placed items (floor 24 incl. rug + hero, wall 7, on-top 2); "COZY Lv.3" is still **(PH)** |
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
| selection box | sprite bounds + 6 pt pad  | `ui/selection-box.svg` style: dashed 1.8 `#FFC48A` dash 6/4, rx 9, fill amber .06; 4 handles r 4.5 cream fill, amber 2 stroke |
| mini toolbar | centred over box, top = box.top − 50 | h 38, pad 0 6, radius 19, `rgba(28,24,46,.92)`, 1px cream .16, shadow `0 8 18 rgba(0,0,0,.45)`, 9 pt caret below; 4 buttons 30×30 circles gap 4 (bg cream .07; delete bg red .12) with 15 pt icons: `icon-move`, `icon-rotate`, `icon-flip`, `icon-delete` |
| tag | centred under box, top = box.bottom + 6 | amber pill radius 6, pad 1/7, Noto 700 10 `#221D38`: "캣타워 · 1×1" (name · w×d) |
| drawer sheet | bottom 0, h 372 (top = content 369), radius 28 28 0 0 | `radial-gradient(90% 60% at 50% 0, #3A2F55, #251F3D 60%, #1A1730)`, top border cream .12, grain .45 |
| · handle | top 9, 38×4 | cream .3 |
| · header | left 24, top 24 | "ITEMS" Poppins 800 22 ls −.5 + "꾸미기 서랍" Noto 11 cream .55; right: points chip (paw 14 + "1,240" Poppins 700 12, 1px amber .45 border, pill) |
| · hint row | top 58 | Gamja 16.5 cream .78 "중복 카드를 발바닥 포인트로 바꿔 가구를 사요" + link "바꾸기 ›" Noto 700 10 amber |
| · tabs | top 92, gap 15, horizontal scroll (fits 390 pt without scrolling; keep scroll for future tabs) | 가구 · 소품 · 벽 꾸미기 · 벽지 · 바닥 · 카드액자 — Noto 700 13.5; off cream .42; on cream + 2 pt amber underline (glow) 10 pt below; 1px divider cream .12 |
| · grid | top 134, left 24, 4 columns × 75 pt, gap 12 (row) / 14 (col) | tile 75×75 radius 16, bg cream .06, 1px cream .1; icon `tiles/{id}.png` (192×192 px = 64 pt @3x, transparent; draw at 56–64 pt) |
| · tile label | 5 below tile | Noto 700 10.5 cream (locked: cream .45) |
| · tile sub | below label | owned: "보유" / placed: "배치 중" Poppins 500 8 ls 1.2 cream .4; locked: paw 11 + price Poppins 700 10.5 amber |
| · bottom fade | bottom 46 | `→ #1A1730` (scroll hint) |

Tile states: **owned** (plain, "보유") · **placed** (`ui/badge-check.svg` 14 at top-right 5/5, "배치 중") · **selected** (1.5 amber border, amber .1 fill, glow 16 amber .25 + check) · **locked** (icon 32% opacity + grayscale .6, `ui/icon-lock.svg` 13 at top-right, cream .6, price row).

## 6. Interactions
- **꾸미기 (A→B):** 420 ms `cubic-bezier(.2,.8,.2,1)`: world container scale .74→.84 and moves so design (640,330) lands at content (195,214); floor cross-fades to the edit grid; puffs swap view→edit; the header, hint and bottom bar fade out over 160 ms; the edit bar fades in; the drawer slides up 372 pt (spring, 60 ms delay). Reverse on 완료/취소.
- **Select:** tap a sprite (alpha hit test, topmost in depth order). It lifts 4 units (12 world px) with an ease-out of 120 ms, its contact shadow stays on the floor (does not lift), its footprint gets amber fill + dashed outline drawn above sprites, then the selection box, toolbar and tag appear (fade+scale .96→1, 140 ms). Tap empty floor → deselect. Show soft hint tiles (`tile-hint-empty`) on up to 2 nearest free spots where the item fits.
- **Drag / move:** long-press 200 ms or the move button → the sprite follows the finger (offset kept) and snaps to the tile under the footprint centre; preview footprint tiles: **valid** amber (`tile-place-valid`), **invalid** red (`tile-place-invalid`) if out of the 8×8 grid or overlapping another item (rug/decals never block). On release: if valid → settle with 160 ms spring + light haptic; if invalid → return to the original tile.
- **Rotate:** swap image `default ↔ mirrored` (`{id}.png` ↔ `{id}_m.png`, or `scaleX(-1)` of the default — equivalent within ±1 px of resampling) **and** swap footprint `[w,d]→[d,w]`; re-anchor with the new orientation's `anchorFootprintCenterPx`. Blocked (shake + red flash 300 ms) if the new footprint does not fit. Only 2 directions exist (front-left / front-right); a real 4-direction rotate needs back-view art (not included).
- **Flip:** in v5 flip = rotate (an iso horizontal mirror always swaps the axes). Keep one button (rotate) or make flip an alias.
- **Delete:** the sprite shrinks and fades (180 ms) and flies toward the drawer; the item returns to the drawer as **보유** (no refund).
- **Drawer tap:** owned/unplaced → place on the first free tile that fits (scan by depth key from the back corner, row-major) and auto-select it; placed → select it in the room; locked → purchase sheet (price in paw points; confirm → points −price, state becomes owned) **(PH flow)**.
- **Tabs:** 벽 꾸미기 = wall items (frames, clock, window…). 벽지 / 바닥 = paint mode, see §10.
- **완료:** saves the layout (items: id, col, row, rot, flip; wall item slots; `floorTiles`, `wallTiles` — §10) → toast "방을 저장했어요" → back to view mode. **취소:** discards all changes since entering edit mode (keep a snapshot) → view mode; if changes exist, confirm "변경사항을 버릴까요?" [계속 꾸미기] [버리기] **(PH copy)**.
- **저장 (A):** saves the current room as an image to the gallery / share sheet **(PH)**.
- **초기화 (A):** confirm dialog "방을 처음 상태로 되돌릴까요?" / "배치한 가구는 서랍으로 돌아가요. 산 아이템은 그대로 있어요." [취소] [초기화] → resets to `grid.json → defaultLayout` and `grid.json → tileMaps.defaults` **(PH copy)**.

## 7. Suggested ambient animation animation (view mode; reduce/stop in edit mode except lamp and cat)
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
- `items/furniture/{id}.png|webp` + `{id}_m.png|webp` (registered, pure item)
- `items/decor/{id}`, `items/wall/{id}` + `_L` + `_R`, `items/hero/catbed_cat` — all .png + .webp
- `shadows/shadow-{1x1,2x1,1x2,2x2}.png|webp` + `shadows.json`
- `tiles/{id}.png` — drawer thumbnails, 192×192 transparent (49 incl. hero)
- `world/` — base-bg, room-floor, room-floor-edit-grid, room-walls, string-lights, front-puffs-view/edit (svg + webp), lamp-glow-additive.webp, tile-*.svg styles, `_reference/`
- `ui/` — logo, icons, check badge, selection-box reference
- `items.json` (48 items + heroCat, both orientations, anchors, shadow, tile), `grid.json` (grid, screens, contactShadow, layerOrder, defaultLayout)
- `mockups/` — room-screen-a/b/c/d-v5, room-screen-b-v6, room-angle-fix-proof, room-v5-catalog, room-tiles-catalog (WebP q92 inside the package; full-res PNGs live next to the zip)


## 10. Floor & wallpaper tiles (바닥 · 벽지 paint mode)
Mockups: `mockups/room-screen-c-v5.webp` (바닥 tab, painting a floor tile), `mockups/room-screen-d-v5.webp` (벽지 tab, painting a wall column), `mockups/room-tiles-catalog.webp`.

### 10.1 Data
```js
room.floorTiles = string[8][8]        // floorTiles[row][col] = textureId, e.g. "wood_honey"
room.wallTiles  = { L: string[8], R: string[8] }   // index i = column counted from the back corner
// defaults (grid.json → tileMaps.defaults): all "wood_honey" / all "plum_sparkle"
```
Saved with the item layout on 완료; restored on 취소 from the edit snapshot; reset by 초기화. items.json entries: `id = floor_<textureId>` / `wall_<textureId>`, `category` 바닥 / 벽지, `placement` floorTile / wallColumn, `price`, `ownedDefault`, `isDefault`, `texture`, `thumb`, `isoTiles` (+`isoTilesGrout`) or `columnsL` / `columnsR`.

### 10.2 Drawing (world px, 3840×2160 container — same as §2)
Layer order with tiles: base-bg → **wall strips** → **floor tiles** → `world/room-frame-view|edit` (svg/webp; = room-walls + room-floor **without** the wall/floor fills: slab, caps, corner line, edit grid, string lights) → edit overlays → rug → shadows → wall items → floor items → glow → puffs → UI. (`room-walls` / `room-floor` from the v5 package are not used when tile maps are on.)
- **Floor tile** (c,r): image `floor/iso/<id>_<c%2><r%2>.png` (160×82 = the 156×78 diamond + 2 px bleed) at top-left `x = 1920+(c−r)·78−80`, `y = 900+(c+r)·39−2`. Draw in any order.
- **Sampling rule:** every floor texture repeats exactly every **2 tiles** in both axes, so each texture ships 4 variants `00 01 10 11` (= col parity, row parity). Picking the variant by parity makes planks, herringbone, checkers, clouds etc. continue seamlessly across neighbouring tiles of the same texture; different textures just meet at the tile edge.
- **Grout variant:** `floor/iso-grout/` — same tiles with a thin (~1–1.5 world px) line in the texture's grout colour on the tile edges (use for tile-like floors if you want visible tiles; off by default).
- **Wall column** i: left wall (along col 0) `wall/L/<id>_<i>.png` at `(1920−(i+1)·78−2, 450+i·39−2)`; right wall (along row 0) `wall/R/<id>_<i>.png` at `(1920+i·78−2, 450+i·39−2)`. Strip 82×493 = 78 px column × 450 px wall height on the 2:1 slope + 2 px bleed. Right-wall strips are pre-shaded ×0.88 (right wall is darker, as in the default room). Each strip is cut from one continuous 8-column texture, so equal neighbours join seamlessly; the baseboard is part of every wallpaper.
- **Thumbnails:** `floor/thumb/<id>.png`, `wall/thumb/<id>.png` 256×256 (85 pt @3x) — square, seamless; drawer shows them full-bleed in the 75 pt tile (radius 15). `floor/flat/` 512 px = 2×2-tile period texture, `wall/flat/` 624×450 = all 8 columns flat (for custom renderers).

### 10.3 Interaction (바닥 / 벽지 tabs)
- Under the tabs: segmented toggle **한 칸씩 · 전체 칠하기** (pill, active = amber gradient) and a **지우개** chip (right).
- Pick a texture in the grid (state "칠하는 중", amber ring). A brush cursor (34 pt amber circle + brush icon) follows the finger with a dashed ring at the tip and a tag "(c, r) 이름" / "오른쪽 벽 N번째 줄".
- **한 칸씩:** tap paints one floor tile (or one wall column on the 벽지 tab: hit test the wall strip quads). Drag paints every tile the finger crosses (stroke). The tile/column under the brush is highlighted (amber fill .38 + 2.2 cream stroke; walls dashed).
- **전체 칠하기 (bucket):** one tap fills the whole floor (바닥) or the whole wall that was tapped (벽지; long-press → both walls) **(PH: whole floor vs. connected same-texture region — recommend whole floor for simplicity)**.
- **지우개:** paints the default texture (`wood_honey` / `plum_sparkle`) — same 한 칸씩/전체 rules.
- Furniture always stays on top and is never moved by painting; tiles under furniture can be painted (only visible gaps change). Optional: dim furniture to 60% while painting **(PH)**.
- Locked textures: tapping opens the purchase sheet instead of painting **(PH flow)**; preview-paint before purchase is optional.
- Undo: keep the edit snapshot (취소); a per-stroke undo button is a possible extension **(PH)**.
- Light haptic per painted tile; 120 ms fade-in of the new tile.

### 10.4 Texture list (price = paw points, **PH**)
**바닥 (12)**
| id | 이름 | price | owned |
|---|---|---|---|
| `wood_honey` | 꿀빛 원목 | 기본 | ✓ |
| `wood_oak` | 밝은 오크 | 180 | ✓ |
| `check_pink` | 핑크 체크 | 150 | ✓ |
| `check_mint` | 민트 체크 | 150 | ✓ |
| `herring_lav` | 라벤더 헤링본 | 300 | — |
| `marble_cream` | 크림 대리석 | 260 | — |
| `paw_tile` | 발바닥 타일 | 200 | ✓ |
| `star_navy` | 별가루 네이비 | 280 | — |
| `carpet_pink` | 몽글 핑크 카펫 | 240 | — |
| `meadow` | 초록 들판 | 220 | — |
| `cloud` | 구름 타일 | 260 | — |
| `terrazzo` | 파스텔 테라조 | 240 | — |

**벽지 (12)**
| id | 이름 | price | owned |
|---|---|---|---|
| `plum_sparkle` | 플럼 반짝이 | 기본 | ✓ |
| `lav_stripe` | 라벤더 줄무늬 | 150 | ✓ |
| `pink_polka` | 핑크 도트 | 150 | ✓ |
| `mint_gingham` | 민트 깅엄 | 180 | ✓ |
| `cream_cats` | 크림 냥이 | 220 | — |
| `night_sky` | 밤하늘 별빛 | 260 | — |
| `peach_hearts` | 피치 하트 | 180 | — |
| `wainscot` | 원목 웨인스코팅 | 300 | — |
| `cloud_wall` | 몽실 구름 | 220 | — |
| `paw_wall` | 발바닥 벽지 | 200 | ✓ |
| `sage_leaf` | 세이지 잎사귀 | 220 | — |
| `moon_navy` | 달과 별 | 280 | — |

### 10.5 Files (this package)
- `floor/thumb|flat|iso|iso-grout/`, `wall/thumb|flat|L|R/`
- `world/room-frame-view|edit.svg|webp`, `world/_reference/composite-*.webp` (default tiles, floor paint, wall paint)
- `items.json` (v5 48 items + hero + 24 tile textures, `tileRules`), `grid.json` (+ `tileMaps`, `layerOrderTiles`)
- Everything from `room-assets-v5` (items, shadows, base-bg, ui…) stays valid; this package only adds to it.


## 11. v6 angle fix
Ideal: every straight floor-plane edge runs at **±26.57°** (2:1); verticals at 90°. P = edges parallel to the right wall / col axis (+26.57° in image coords, y down), N = parallel to the left wall / row axis (−26.57°).
Measured with Canny + probabilistic Hough on each sprite; value = length-weighted median of segments within ±16° (before) / ±10° (after) of the ideal.

**Floor sprites fixed** (the source art was drawn with a flatter front face, ~15–18° instead of 26.57°). Per sprite affine `x′ = a·x`, `y′ = c·x + d·y` (verticals stay vertical; area kept: a·d = 1), solved so both edge families hit ±26.57° exactly, refined iteratively. `_m` = mirror of the corrected default. New `size`, `anchorFootprintCenterPx`, `anchorBackCornerPx` in items.json; matrices in `items[].angleFixV6`. Decor: `displayWidthTiles` scaled with the new image width. On-top offsets (`fx`,`fy`) remapped; `defaultLayout.worldPx` recomputed.

| item | before P / N | after P / N |
|---|---|---|
| bed | 24.2° / -28.1° | 26.8° / -26.6° |
| bookshelf | 15.5° / -27.4° | 26.6° / -26.6° |
| cabinet | 15.4° / -25.9° | 26.3° / -24.6° |
| catchair | 18.4° / -25.8° | 26.1° / -26.6° |
| desk | 17.8° / -27.3° | 27.1° / -26.2° |
| feeder | 18.4° / -20.6° | 26.6° / -30.6° |
| fridge | 17.2° / -26.0° | 26.1° / -25.9° |
| scratcher | 21.8° / -27.2° | 24.8° / -25.8° |
| sofa | 15.8° / -28.2° | 26.1° / -26.2° |
| aquarium | 18.1° / -27.1° | 26.0° / -26.6° |
| archmirror | 16.3° / -31.8° | 27.0° / -25.9° |
| cushions | 16.4° / -30.7° | 26.1° / -26.6° |
| gifts | 18.8° / -27.3° | 26.0° / -27.9° |
| gramophone | 16.6° / -31.4° | 26.0° / – |

**Wall items fixed:** the flat front art had horizontals tilted 4.5–7.3° (drawn slightly angled), so the slanted copies were ~20°/32° instead of 26.57°. The front art is de-skewed first, then `_L`/`_R` are re-sheared (x′ = 0.894·x, y′ = y ∓ 0.5·x′). Verticals = 90.0°.

| item | front tilt | L before → after | R before → after |
|---|---|---|---|
| archwindow | 6.6° | -20.2° → -26.6° | 32.2° → 26.9° |
| calendar | 5.9° | -20.6° → -25.9° | 32.5° → 26.9° |
| cardframe | 4.7° | -22.1° → -26.2° | 30.7° → 26.8° |
| catsteps | 6.5° | -20.0° → -25.4° | 33.7° → 32.3° |
| corkboard | 4.5° | -22.2° → -26.1° | 30.6° → 26.7° |
| squareframe | 5.8° | -20.9° → -26.6° | 31.9° → 26.6° |
| wallshelf | 7.3° | -20.1° → -27.4° | 32.1° → 26.2° |

Wall draw scale: `s = displayWidthTiles·156 / frontWidth` applied to `_L`/`_R` (see grid.json → wallPlacement).

**Unchanged:** round/organic items (beanbag, catbed, cattower, floorlamp, teatable, plant, monstera, fishbowl, moonlamp, yarnbasket, xmastree, globe, catcactus, starlight, hero cat) have no straight floor edges; their ellipses are left symmetric. Pawrug was projected exactly in v5. Other wall items (bunting, catclock, dreamcatcher, earmirror, fairylights, heartneon, moonmobile, porthole, starlamp) measured within ~1.5° or have no straight edges.

**Redrawn in v6.1 (new 3/4 art):** `radioclock`, `maneki`, `tent` were re-cut from a new sheet. Pipeline: measured the cream sheet tile (L/B/R corners) → affine onto the exact 2:1 diamond ×1.2 with verticals kept vertical → tile, tile outline and soft contact shadow removed (no halo) → edge angles measured and the v6 affine correction applied → scaled uniformly about the footprint centre to the previous on-screen height → `_m` = mirror. All three now have `orientations` with anchors (maneki too: draw 1:1 at `anchorFootprintCenterPx`; `displayWidthTiles` kept for the on-top rule). Old files: `../room-assets-v6_old/`.

| item | after tile registration P / N | final P / N | size px |
|---|---|---|---|
| radioclock | 18.4° / -26.6° | 26.6° / -27.9° | 101×119 |
| maneki | 25.2° / -25.8° | 28.1° / -27.3° | 98×100 |
| tent | 15.3° / -27.5° | 26.0° / -23.2° | 115×122 |

(Tent is a dome: its P edges are the door trim / base rim; the base N edge is short, ±3–4° measurement noise.)

**Optional new art:** `catsteps` / `wallshelf` (3D shelves: wall-direction edges are exact, the depth direction comes from the shear).
