import { useEffect, useRef } from "react";

import {
  isPaintItem,
  isPlaceableDecor,
  itemMatchesTab,
  itemMatchesTheme,
  roomAsset,
  ROOM_TABS,
  ROOM_THEME_FILTERS,
} from "../lib/roomCatalog";
import type { PaintFillMode, RoomItem, RoomLayoutState, RoomTab, RoomThemeFilter } from "../lib/roomTypes";

type RoomDrawerProps = {
  tab: RoomTab;
  onTab: (tab: RoomTab) => void;
  themeFilter: RoomThemeFilter;
  onThemeFilter: (filter: RoomThemeFilter) => void;
  items: RoomItem[];
  layout: RoomLayoutState;
  owned: Record<string, number>;
  points: number;
  selectedId: string | null;
  brushId: string | null;
  fillMode: PaintFillMode;
  eraser: boolean;
  canUndo: boolean;
  otherRoomIds: Record<string, string | null>;
  /** When true, 보유 tab sorts NEW placeables first (tutorial). */
  preferOwnedSort?: boolean;
  /** Prefer these ids first among NEW placeables (starter.drawer order). */
  preferNewIds?: string[];
  /** Tutorial: only this item id may be grabbed; others are disabled. */
  tutorialLockId?: string | null;
  /** Tutorial: long-press ms to grab (0 = off). */
  tutorialLongPressMs?: number;
  onTutorialGrab?: (item: RoomItem, clientX: number, clientY: number) => void;
  onPick: (item: RoomItem) => void;
  onFillMode: (mode: PaintFillMode) => void;
  onEraser: () => void;
  onUndo: () => void;
  onExchange: () => void;
};

function tileState(
  item: RoomItem,
  layout: RoomLayoutState,
  owned: Record<string, number>,
  selectedId: string | null,
  brushId: string | null,
  otherRoomId: string | null,
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
  return { locked, placedHere, otherRoom: Boolean(otherRoomId) && !placedHere, selected, brushing };
}

function ownedSortRank(
  item: RoomItem,
  state: ReturnType<typeof tileState>,
): number {
  const isNew = !state.locked && !state.placedHere && !state.otherRoom;
  if (isNew && isPlaceableDecor(item)) return 0;
  if (isNew && isPaintItem(item)) return 1;
  if (isNew) return 2;
  if (!state.locked && state.otherRoom) return 3;
  if (!state.locked && state.placedHere) return 4;
  return 5;
}

export function RoomDrawer({
  tab,
  onTab,
  themeFilter,
  onThemeFilter,
  items,
  layout,
  owned,
  points,
  selectedId,
  brushId,
  fillMode,
  eraser,
  canUndo,
  otherRoomIds,
  preferOwnedSort = false,
  preferNewIds = [],
  tutorialLockId = null,
  tutorialLongPressMs = 0,
  onTutorialGrab,
  onPick,
  onFillMode,
  onEraser,
  onUndo,
  onExchange,
}: RoomDrawerProps) {
  const pressTimer = useRef(0);
  const pressOrigin = useRef<{ x: number; y: number; item: RoomItem } | null>(null);
  const grabbed = useRef(false);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const scrollLocked = useRef(false);

  const lockDrawerScroll = () => {
    const grid = gridRef.current;
    if (!grid || scrollLocked.current) return;
    scrollLocked.current = true;
    grid.classList.add("is-scroll-locked");
    grid.style.overflow = "hidden";
    grid.style.touchAction = "none";
  };

  const unlockDrawerScroll = () => {
    const grid = gridRef.current;
    if (!grid || !scrollLocked.current) return;
    scrollLocked.current = false;
    grid.classList.remove("is-scroll-locked");
    grid.style.overflow = "";
    grid.style.touchAction = "";
  };

  // RoomScreen fires this when a from-drawer drag ends (place or cancel).
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
      // Attendance-only items are excluded from the shop list until granted.
      !(item.attendanceOnly && (owned[item.id] ?? 0) < 1)
    );
  });

  if (tab === "보유" || preferOwnedSort) {
    const preferIndex = (id: string) => {
      const idx = preferNewIds.indexOf(id);
      return idx < 0 ? 1000 + id.charCodeAt(0) : idx;
    };
    visible = [...visible].sort((a, b) => {
      const sa = tileState(a, layout, owned, selectedId, brushId, otherRoomIds[a.id] ?? null);
      const sb = tileState(b, layout, owned, selectedId, brushId, otherRoomIds[b.id] ?? null);
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
      className={`lucky-drawer ${paintTab ? "is-paint" : ""} ${tutorialLockId ? "is-tutorial" : ""}`}
      aria-label="꾸미기 서랍"
    >
      <div className="lucky-drawer-handle" />
      <header className="lucky-drawer-head">
        <div>
          <h2>
            ITEMS <span>꾸미기 서랍</span>
          </h2>
        </div>
        <span className="lucky-points-chip">
          <img src={roomAsset("ui/icon-paw-point.svg")} alt="" />
          {points.toLocaleString("en-US")}
        </span>
      </header>
      <p className="lucky-drawer-hint">
        중복 카드를 발바닥 포인트로 바꿔 가구를 사요
        <button type="button" onClick={onExchange}>
          바꾸기 ›
        </button>
      </p>
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
        <div className="lucky-paint-toolbar" role="toolbar" aria-label="칠하기 도구">
          <div className="lucky-paint-toggle">
            <button
              type="button"
              className={fillMode === "cell" && !eraser ? "is-active" : ""}
              onClick={() => onFillMode("cell")}
            >
              한 칸씩
            </button>
            <button
              type="button"
              className={fillMode === "fill" && !eraser ? "is-active" : ""}
              onClick={() => onFillMode("fill")}
            >
              전체 칠하기
            </button>
          </div>
          <button type="button" className={`lucky-paint-eraser ${eraser ? "is-active" : ""}`} onClick={onEraser}>
            <img src={roomAsset("ui/icon-eraser.svg")} alt="" />
            지우개
          </button>
          <button type="button" className="lucky-paint-undo" onClick={onUndo} disabled={!canUndo} aria-label="되돌리기">
            되돌리기
          </button>
        </div>
      ) : null}
      <div
        ref={gridRef}
        className={`lucky-drawer-grid ${tutorialLockId ? "is-tut-mode" : ""}`}
      >
        {visible.map((item, index) => {
          const state = tileState(item, layout, owned, selectedId, brushId, otherRoomIds[item.id] ?? null);
          const isNew = !state.locked && !state.placedHere && !state.otherRoom;
          const tutLockedOut = Boolean(tutorialLockId && tutorialLockId !== item.id);
          const tutGrab = Boolean(tutorialLongPressMs > 0 && onTutorialGrab && tutorialLockId === item.id);
          return (
            <button
              key={item.id}
              id={
                (tutorialLockId && item.id === tutorialLockId) || (!tutorialLockId && index === 0)
                  ? "drawer-item-0"
                  : undefined
              }
              type="button"
              className={`lucky-cell ${state.locked ? "is-locked" : ""} ${state.placedHere ? "is-placed" : ""} ${state.otherRoom ? "is-other" : ""} ${state.selected ? "is-selected" : ""} ${isNew ? "is-new" : ""} ${tutLockedOut ? "is-tut-locked" : ""} ${tutGrab ? "is-tut-grab" : ""}`}
              disabled={tutLockedOut}
              style={tutGrab ? { touchAction: "none", zIndex: 131, position: "relative" } : undefined}
              onClick={(event) => {
                if (tutGrab) {
                  event.preventDefault();
                  return;
                }
                onPick(item);
              }}
              onPointerDown={
                tutGrab
                  ? (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      grabbed.current = false;
                      lockDrawerScroll();
                      pressOrigin.current = { x: event.clientX, y: event.clientY, item };
                      window.clearTimeout(pressTimer.current);
                      const startX = event.clientX;
                      const startY = event.clientY;
                      pressTimer.current = window.setTimeout(() => {
                        if (!pressOrigin.current || grabbed.current) return;
                        grabbed.current = true;
                        onTutorialGrab?.(item, startX, startY);
                      }, tutorialLongPressMs);
                      try {
                        event.currentTarget.setPointerCapture(event.pointerId);
                      } catch {
                        // ignore
                      }
                    }
                  : undefined
              }
              onPointerMove={
                tutGrab
                  ? (event) => {
                      if (!pressOrigin.current || grabbed.current) return;
                      const dx = event.clientX - pressOrigin.current.x;
                      const dy = event.clientY - pressOrigin.current.y;
                      if (Math.hypot(dx, dy) < 8) return;
                      event.preventDefault();
                      event.stopPropagation();
                      window.clearTimeout(pressTimer.current);
                      grabbed.current = true;
                      lockDrawerScroll();
                      onTutorialGrab?.(pressOrigin.current.item, event.clientX, event.clientY);
                    }
                  : undefined
              }
              onPointerUp={
                tutGrab
                  ? () => {
                      window.clearTimeout(pressTimer.current);
                      pressOrigin.current = null;
                      // Keep scroll locked while world drag continues; RoomScreen unlocks via class clear on phase change.
                      if (!grabbed.current) unlockDrawerScroll();
                    }
                  : undefined
              }
              onPointerCancel={
                tutGrab
                  ? () => {
                      window.clearTimeout(pressTimer.current);
                      pressOrigin.current = null;
                      grabbed.current = false;
                      unlockDrawerScroll();
                    }
                  : undefined
              }
            >
              <span className="lucky-cell-tile">
                {item.tileImage || item.id ? (
                  <img src={roomAsset(item.tileImage ?? `tiles/${item.id}.png`)} alt="" />
                ) : (
                  <span className="lucky-cell-empty" />
                )}
                {isNew ? <span className="lucky-cell-new">NEW</span> : null}
                {state.placedHere && !state.locked ? (
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
              ) : (
                <small className={state.otherRoom ? "is-other" : ""}>
                  {state.brushing
                    ? "칠하는 중"
                    : state.otherRoom
                      ? "다른 방에 배치 중"
                      : state.placedHere
                        ? "사용 중"
                        : "보유"}
                </small>
              )}
            </button>
          );
        })}
      </div>
      <div className="lucky-drawer-fade" aria-hidden="true" />
    </section>
  );
}
