# 고양이 친구 탭 (launch version)

The 방꾸미기 drawer gets a new last tab, "고양이 친구".
- At launch only 치즈냥 (the default cat) is available, and it is selected.
- The other 22 cats show as silhouettes with "곧 추가돼요": 18 breeds, then 4 legends, in cards.json order.
- There are no progress bars and no dates. Only the unlock rule is shown, as a teaser.
- Preview: `preview.png`.

## Where the files go (repo `good_luck_today`)
| This package | Repo |
|---|---|
| `public/assets/room/cat-friends/roomCats.json` (same file as `roomCats.json` at the top level) | `public/assets/room/cat-friends/roomCats.json` |
| `public/assets/room/cat-friends/cheese.webp` (168px, about 10KB) | same path. Icon from the existing cheese-cat `sit` frame. |
| `public/assets/room/cat-friends/silhouette.webp` (about 3KB) | same path. Shared silhouette for cats that aren't out yet. |
| `src/lib/roomCats.ts` | `src/lib/`: types, `loadRoomCats()`, `roomCatRuleText()`, `isRoomCatSelectable()` |
| `src/components/RoomCatsTab.tsx` + `.css` | `src/components/` |

Existing things it relies on (unchanged):
- `roomAsset()` (src/lib/roomCatalog.ts)
- `ui/icon-lock.svg`
- the `--cream` / `--amber` tokens in RoomScreen.css
- the Jua / Gaegu fonts (src/styles/fonts.css)
- `roomLayout.roamingCatId` (default "cheese")
- `CAT_BREEDS` (src/lib/roomCat.ts)

## How it hooks in
1. `src/lib/roomTypes.ts`: add `"고양이 친구"` to `RoomTab`.
2. `src/lib/roomCatalog.ts`: add `{ id: "고양이 친구", label: "고양이 친구" }` to the end of `ROOM_TABS`. In `itemMatchesTab`, return false for that tab, so no furniture shows there.
3. `src/components/RoomDrawer.tsx`: when `tab === "고양이 친구"`, hide the theme filters, the paint toolbar and the item grid, and render `<RoomCatsTab selectedId={roamingCatId} onSelect={onSelectCat} />` instead.
   - New props: `roamingCatId`, `onSelectCat`.
   - When the tab is picked, scroll the tab bar so it is visible. It is the last tab and is off-screen on a 390pt-wide phone.
4. `src/screens/RoomScreen.tsx`: pass the current room's `roamingCatId`.
   - `onSelectCat` saves the change through the existing room save path.
   - It only fires for selectable cats, so at launch it is effectively a no-op for 치즈냥.

## Data (`roomCats.json`)
```json
{ "id": "siamese", "nameKo": "샴", "type": "breed", "unlockRule": { "breedId": "siamese" },
  "status": "comingSoon", "sprite": null, "icon": null }
```
- `type`: `breed` or `legend`. Legends use `unlockRule.legendCardId`. 치즈냥 has `default: true` and `unlockRule: null`.
- `sprite` is relative to `/assets/room/cat/`. It must use the same layout as `cat-sprite.png`/`.json`: 24 frames, 174×137, anchor (87,132).
- `icon` is relative to `/assets/room/`.

## Adding a cat later (one per day)
1. Put the sprite sheet in `public/assets/room/cat/` and a 168px icon in `public/assets/room/cat-friends/`.
2. In `roomCats.json`, set `"status": "available"` and fill in `sprite` and `icon`.
3. In `src/lib/roomCat.ts`, add the breed to `CAT_BREEDS` (`spriteSheet` = the same file), or build `CAT_BREEDS` from `roomCats.json`.
4. The unlock check is already written: `isRoomCatSelectable(cat, ownedCardIds)` needs `{breedId}_1..5` for a breed, or the legend card id. Pass the owned dex card ids once the first cat goes live.
   - Until then, a cat set to `available` with no `ownedCardIds` passed counts as open to everyone.
   - Pass `ownedCardIds` from the first breed launch onward.

## Copy
- Banner title: 고양이 친구 (Jua)
- Banner message: 곧 새로운 고양이 친구들이 찾아와요! / 품종 1~5성을 모두 모으면 그 고양이가 방에 놀러 와요. (Gaegu)
- Cell: name, a short rule ("1~5성 모두 모으면" / "레전드 카드 얻으면"), and a "곧 추가돼요" badge.
- Tapping a cat that isn't out yet shows an info bar with the full line: "샴 1~5성을 모두 모으면 놀러 와요" / "레전드 '수호신 백호' 카드를 얻으면 놀러 와요", plus a "곧 추가돼요" tag.
