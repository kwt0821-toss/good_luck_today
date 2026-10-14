import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import {
  isPaintItem,
  isPlaceableDecor,
  itemMatchesTab,
  itemMatchesTheme,
  roomAsset,
  ROOM_TABS,
  ROOM_THEME_FILTERS,
} from "../lib/roomCatalog";
import type { RoomItem, RoomLayoutState, RoomTab, RoomThemeFilter } from "../lib/roomTypes";

const DRAWER_HELP = "중복 고양이 카드를 발바닥 포인트로 바꿀 수 있어요";
const DRAWER_HEIGHT_COLLAPSED = 420;
const DRAWER_HEIGHT_EXPANDED = 560;

export type DrawerItemMeta = {
  remaining: number;
  owned: number;
  otherRoomName: string | null;
  canBuyMore: boolean;
};

type RoomDrawerProps = {
  tab: RoomTab;
  onTab: (tab: RoomTab) => void;
  themeFilter: RoomThemeFilter;
  onThemeFilter: (filter: RoomThemeFilter) => void;
  items: RoomItem[];
  layout: RoomLayoutState;
  owned: Record<string, number>;
  /** Per-item remaining/owned/other-room for count labels + CTAs. */
  itemMeta: Record<string, DrawerItemMeta>;
  points: number;
  selectedId: string | null;
  brushId: string | null;
  canUndo: boolean;
  otherRoomIds: Record<string, string | null>;
  /** When true, 보유 tab sorts NEW placeables first (tutorial). */
  preferOwnedSort?: boolean;
  /** Prefer these ids first among NEW placeables (starter.drawer order). */
  preferNewIds?: string[];
  /** Tutorial: only this item id may be tapped; others are disabled. */
  tutorialLockId?: string | null;
  onPick: (item: RoomItem) => void;
  onMoveHere: (item: RoomItem) => void;
  onBuyMore: (item: RoomItem) => void;
  onUndo: () => void;
  onHelp?: () => void;
};

function tileState(
  item: RoomItem,
  layout: RoomLayoutState,
  owned: Record<string, number>,
  selectedId: string | null,
  brushId: string | null,
  otherRoomId: string | null,
  meta?: DrawerItemMeta,
) {
  const locked = (owned[item.id] ?? 0) < 1;
  const usedOnFloor = layout.floorTiles?.some((row) => row.includes(item.id)) ?? false;
  const usedOnWall = Boolean(layout.wallTiles?.L.includes(item.id) || layout.wallTiles?.R.includes(item.id));
  const placedHere =
    layout.floor.some((place) => place.id === item.id) ||
    layout.walls.some((place) => place.id === item.id) ||
    usedOnFloor ||
    usedOnWall;
  const brushing = brushId === item.id;
  const selected =
    brushing ||
    layout.floor.some((place) => place.instanceId === selectedId && place.id === item.id) ||
    layout.walls.some((place) => place.instanceId === selectedId && place.id === item.id);
  const remaining = meta?.remaining ?? Math.max(0, (owned[item.id] ?? 0) - (placedHere ? 1 : 0));
  const depleted = !locked && !isPaintItem(item) && remaining <= 0;
  return {
    locked,
    placedHere,
    otherRoom: Boolean(otherRoomId) && !placedHere,
    selected,
    brushing,
    remaining,
    depleted,
  };
}

function ownedSortRank(
  item: RoomItem,
  state: ReturnType<typeof tileState>,
): number {
  const isNew = !state.locked && !state.depleted && !state.otherRoom;
  if (isNew && isPlaceableDecor(item)) return 0;
  if (isNew && isPaintItem(item)) return 1;
  if (isNew) return 2;
  if (!state.locked && state.otherRoom) return 3;
  if (!state.locked && state.depleted) return 4;
  if (!state.locked && state.placedHere) return 5;
  return 6;
}

export function RoomDrawer({
  tab,
  onTab,
  themeFilter,
  onThemeFilter,
  items,
  layout,
  owned,
  itemMeta,
  points,
  selectedId,
  brushId,
  canUndo,
  otherRoomIds,
  preferOwnedSort = false,
  preferNewIds = [],
  tutorialLockId = null,
  onPick,
  onMoveHere,
  onBuyMore,
  onUndo,
  onHelp,
}: RoomDrawerProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const scrollLocked = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [sheetDragging, setSheetDragging] = useState(false);
  const sheetDrag = useRef<{ y: number; startHeight: number; active: boolean; height: number }>({
    y: 0,
    startHeight: DRAWER_HEIGHT_COLLAPSED,
    active: false,
    height: DRAWER_HEIGHT_COLLAPSED,
  });

  const sheetHeight = dragHeight ?? (expanded ? DRAWER_HEIGHT_EXPANDED : DRAWER_HEIGHT_COLLAPSED);

  const onSheetPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (tutorialLockId) return;
    sheetDrag.current = {
      y: event.clientY,
      startHeight: sheetHeight,
      active: true,
      height: sheetHeight,
    };
    setSheetDragging(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  };

  const onSheetPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!sheetDrag.current.active) return;
    const dy = sheetDrag.current.y - event.clientY;
    const next = Math.min(
      DRAWER_HEIGHT_EXPANDED,
      Math.max(DRAWER_HEIGHT_COLLAPSED, sheetDrag.current.startHeight + dy),
    );
    sheetDrag.current.height = next;
    setDragHeight(next);
  };

  const onSheetPointerUp = () => {
    if (!sheetDrag.current.active) return;
    sheetDrag.current.active = false;
    setSheetDragging(false);
    const mid = (DRAWER_HEIGHT_COLLAPSED + DRAWER_HEIGHT_EXPANDED) / 2;
    const open = sheetDrag.current.height >= mid;
    setExpanded(open);
    setDragHeight(null);
  };

  const unlockDrawerScroll = () => {
    const grid = gridRef.current;
    if (!grid || !scrollLocked.current) return;
    scrollLocked.current = false;
    grid.classList.remove("is-scroll-locked");
    grid.style.overflow = "";
    grid.style.touchAction = "";
  };

  useEffect(() => {
    const onUnlock = () => unlockDrawerScroll();
    window.addEventListener("lucky-cat:drawer-scroll-unlock", onUnlock);
    return () => window.removeEventListener("lucky-cat:drawer-scroll-unlock", onUnlock);
  }, []);

  useEffect(() => {
    if (!tutorialLockId) unlockDrawerScroll();
  }, [tutorialLockId]);

  let visible = items.filter((item) => {
    if (tab === "보유") {
      if ((owned[item.id] ?? 0) < 1) return false;
      return itemMatchesTheme(item, themeFilter);
    }
    return (
      itemMatchesTab(item, tab) &&
      itemMatchesTheme(item, themeFilter) &&
      !(item.attendanceOnly && (owned[item.id] ?? 0) < 1)
    );
  });

  if (tab === "보유" || preferOwnedSort) {
    const preferIndex = (id: string) => {
      const idx = preferNewIds.indexOf(id);
      return idx < 0 ? 1000 + id.charCodeAt(0) : idx;
    };
    visible = [...visible].sort((a, b) => {
      const sa = tileState(a, layout, owned, selectedId, brushId, otherRoomIds[a.id] ?? null, itemMeta[a.id]);
      const sb = tileState(b, layout, owned, selectedId, brushId, otherRoomIds[b.id] ?? null, itemMeta[b.id]);
      const ra = ownedSortRank(a, sa);
      const rb = ownedSortRank(b, sb);
      if (ra !== rb) return ra - rb;
      if (ra === 0) {
        const pa = preferIndex(a.id);
        const pb = preferIndex(b.id);
        if (pa !== pb) return pa - pb;
      }
      return a.nameKo.localeCompare(b.nameKo, "ko");
    });
  }

  const paintTab = tab === "벽지" || tab === "바닥";

  return (
    <section
      className={`lucky-drawer ${paintTab ? "is-paint" : ""} ${tutorialLockId ? "is-tutorial" : ""} ${expanded ? "is-expanded" : ""} ${sheetDragging ? "is-dragging" : ""}`}
      aria-label="꾸미기 서랍"
      style={{ height: sheetHeight }}
    >
      <div
        className="lucky-drawer-handle"
        role="slider"
        aria-label="아이템창 높이"
        aria-valuemin={DRAWER_HEIGHT_COLLAPSED}
        aria-valuemax={DRAWER_HEIGHT_EXPANDED}
        aria-valuenow={Math.round(sheetHeight)}
        tabIndex={0}
        onPointerDown={onSheetPointerDown}
        onPointerMove={onSheetPointerMove}
        onPointerUp={onSheetPointerUp}
        onPointerCancel={onSheetPointerUp}
        onDoubleClick={() => {
          if (!tutorialLockId) setExpanded((prev) => !prev);
        }}
      />
      <header className="lucky-drawer-head">
        <div>
          <h2>
            ITEMS <span>꾸미기 서랍</span>
          </h2>
        </div>
        <span className="lucky-points-chip" id="room-points-chip">
          <img src={roomAsset("ui/icon-paw-point.svg")} alt="" />
          {points.toLocaleString("en-US")}
          <button
            type="button"
            className="lucky-points-help"
            aria-label="발바닥 포인트 도움말"
            title={DRAWER_HELP}
            onClick={() => onHelp?.()}
          >
            !
          </button>
        </span>
      </header>
      <div className="lucky-drawer-tabs" role="tablist">
        {ROOM_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? "is-active" : ""}
            onClick={() => onTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="lucky-theme-filters" role="tablist" aria-label="테마 필터">
        {ROOM_THEME_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            className={themeFilter === filter.id ? "is-active" : ""}
            onClick={() => onThemeFilter(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>
      {paintTab ? (
        <div className="lucky-paint-toolbar lucky-paint-toolbar-lite" role="toolbar" aria-label="칠하기 도구">
          <p className="lucky-paint-hint">탭하면 다른 칸에 미리보기로 칠해요</p>
          <button type="button" className="lucky-paint-undo" onClick={onUndo} disabled={!canUndo} aria-label="되돌리기">
            되돌리기
          </button>
        </div>
      ) : null}
      <div ref={gridRef} className={`lucky-drawer-grid ${tutorialLockId ? "is-tut-mode" : ""}`}>
        {visible.map((item, index) => {
          const meta = itemMeta[item.id];
          const state = tileState(item, layout, owned, selectedId, brushId, otherRoomIds[item.id] ?? null, meta);
          const isNew = !state.locked && !state.depleted && !state.otherRoom && !isPaintItem(item);
          const tutLockedOut = Boolean(tutorialLockId && tutorialLockId !== item.id);
          const paint = isPaintItem(item);
          const ownedCount = meta?.owned ?? owned[item.id] ?? 0;
          const remaining = meta?.remaining ?? 0;
          const otherName = meta?.otherRoomName ?? null;
          const canBuyMore = Boolean(meta?.canBuyMore);
          const showCount = !paint && !state.locked && ownedCount > 0;

          return (
            <div
              key={item.id}
              id={
                (tutorialLockId && item.id === tutorialLockId) || (!tutorialLockId && index === 0)
                  ? "drawer-item-0"
                  : undefined
              }
              className={`lucky-cell ${state.locked ? "is-locked" : ""} ${state.placedHere ? "is-placed" : ""} ${state.otherRoom || state.depleted ? "is-other" : ""} ${state.selected ? "is-selected" : ""} ${isNew ? "is-new" : ""} ${tutLockedOut ? "is-tut-locked" : ""}`}
            >
              <button
                type="button"
                className="lucky-cell-main"
                disabled={tutLockedOut}
                onClick={() => onPick(item)}
              >
                <span className="lucky-cell-tile">
                  {item.tileImage || item.id ? (
                    <img src={roomAsset(item.tileImage ?? `tiles/${item.id}.png`)} alt="" />
                  ) : (
                    <span className="lucky-cell-empty" />
                  )}
                  {isNew ? <span className="lucky-cell-new">NEW</span> : null}
                  {showCount ? (
                    <span className="lucky-cell-count" aria-label={`남은 ${remaining} / 전체 ${ownedCount}`}>
                      {remaining}/{ownedCount}
                    </span>
                  ) : null}
                  {state.placedHere && !state.locked && remaining > 0 && !paint ? (
                    <img className="lucky-cell-check" src={roomAsset("ui/badge-check.svg")} alt="" />
                  ) : null}
                  {state.locked ? <img className="lucky-cell-lock" src={roomAsset("ui/icon-lock.svg")} alt="" /> : null}
                </span>
                <strong>
                  {item.nameKo}
                  {item.attendanceOnly ? <span className="lucky-attend-tag">출석 한정</span> : null}
                </strong>
                {state.locked ? (
                  <em>
                    <img src={roomAsset("ui/icon-paw-point.svg")} alt="" />
                    {item.price}
                  </em>
                ) : paint ? (
                  <small>{state.brushing || state.selected ? "미리보기" : "보유 · 계속 쓸 수 있어요"}</small>
                ) : state.depleted && state.otherRoom && otherName ? (
                  <small className="is-other">다른 방에 있어요 · {otherName}</small>
                ) : state.depleted && item.attendanceOnly ? (
                  <small className="is-other">한정 아이템이에요</small>
                ) : state.depleted && canBuyMore ? (
                  <small className="is-other">모두 배치 중</small>
                ) : state.depleted ? (
                  <small className="is-other">더 이상 가질 수 없어요</small>
                ) : (
                  <small>
                    남은 {remaining}/{ownedCount}
                  </small>
                )}
              </button>
              {!state.locked && !paint && state.depleted && state.otherRoom ? (
                <button
                  type="button"
                  className="lucky-cell-cta"
                  disabled={tutLockedOut}
                  onClick={(event) => {
                    event.stopPropagation();
                    onMoveHere(item);
                  }}
                >
                  이 방으로 옮기기
                </button>
              ) : null}
              {!state.locked && !paint && state.depleted && !state.otherRoom && canBuyMore ? (
                <button
                  type="button"
                  className="lucky-cell-cta"
                  disabled={tutLockedOut}
                  onClick={(event) => {
                    event.stopPropagation();
                    onBuyMore(item);
                  }}
                >
                  하나 더 사기
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="lucky-drawer-fade" aria-hidden="true" />
    </section>
  );
}
