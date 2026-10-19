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
import { jellyLabel } from "../lib/jellyLabel";
import type { RoomItem, RoomLayoutState, RoomTab, RoomThemeFilter } from "../lib/roomTypes";
import { RoomCatsTab } from "./RoomCatsTab";

const DRAWER_HELP = "중복 고양이 카드를 발바닥 젤리로 바꿀 수 있어요";
const DRAWER_HEIGHT_COLLAPSED = 420;
const DRAWER_HEIGHT_EXPANDED = 560;
const DRAWER_DISMISS_HEIGHT = 280;
const LONG_PRESS_MS = 420;

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
  itemMeta: Record<string, DrawerItemMeta>;
  points: number;
  selectedId: string | null;
  brushId: string | null;
  canUndo: boolean;
  otherRoomIds: Record<string, string | null>;
  preferOwnedSort?: boolean;
  preferNewIds?: string[];
  tutorialLockId?: string | null;
  onPick: (item: RoomItem) => void;
  onMoveHere: (item: RoomItem) => void;
  onBuyMore: (item: RoomItem) => void;
  onUndo: () => void;
  onHelp?: () => void;
  /** Collapsed sheet dragged down past dismiss threshold. */
  onRequestClose?: () => void;
  roamingCatId: string | null;
  onSelectCat: (id: string) => void;
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

function ownedSortRank(item: RoomItem, state: ReturnType<typeof tileState>): number {
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
  onRequestClose,
  roamingCatId,
  onSelectCat,
}: RoomDrawerProps) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const scrollLocked = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const [sheetDragging, setSheetDragging] = useState(false);
  const [infoItem, setInfoItem] = useState<RoomItem | null>(null);
  const longPressTimer = useRef(0);
  const longPressArmed = useRef(false);
  const pressOrigin = useRef<{ x: number; y: number; item: RoomItem } | null>(null);
  const sheetDrag = useRef<{
    y: number;
    startHeight: number;
    active: boolean;
    height: number;
    startedExpanded: boolean;
  }>({
    y: 0,
    startHeight: DRAWER_HEIGHT_COLLAPSED,
    active: false,
    height: DRAWER_HEIGHT_COLLAPSED,
    startedExpanded: false,
  });

  const sheetHeight = dragHeight ?? (expanded ? DRAWER_HEIGHT_EXPANDED : DRAWER_HEIGHT_COLLAPSED);

  const onSheetPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (tutorialLockId) return;
    sheetDrag.current = {
      y: event.clientY,
      startHeight: sheetHeight,
      active: true,
      height: sheetHeight,
      startedExpanded: expanded,
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
    const dy = sheetDrag.current.y - event.clientY; // up = positive
    const minH = sheetDrag.current.startedExpanded
      ? DRAWER_HEIGHT_COLLAPSED
      : DRAWER_DISMISS_HEIGHT;
    const next = Math.min(
      DRAWER_HEIGHT_EXPANDED,
      Math.max(minH, sheetDrag.current.startHeight + dy),
    );
    sheetDrag.current.height = next;
    setDragHeight(next);
  };

  const onSheetPointerUp = () => {
    if (!sheetDrag.current.active) return;
    sheetDrag.current.active = false;
    setSheetDragging(false);
    const h = sheetDrag.current.height;
    const startedExpanded = sheetDrag.current.startedExpanded;

    // Dismiss only from collapsed start, dragged well below collapsed.
    if (
      !startedExpanded &&
      !tutorialLockId &&
      onRequestClose &&
      h <= (DRAWER_HEIGHT_COLLAPSED + DRAWER_DISMISS_HEIGHT) / 2
    ) {
      setDragHeight(null);
      setExpanded(false);
      onRequestClose();
      return;
    }

    const mid = (DRAWER_HEIGHT_COLLAPSED + DRAWER_HEIGHT_EXPANDED) / 2;
    setExpanded(h >= mid);
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

  useEffect(() => {
    setInfoItem(null);
  }, [tab, themeFilter]);

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
  const catsTab = tab === "고양이 친구";
  const infoMeta = infoItem ? itemMeta[infoItem.id] : null;
  const infoState = infoItem
    ? tileState(
        infoItem,
        layout,
        owned,
        selectedId,
        brushId,
        otherRoomIds[infoItem.id] ?? null,
        infoMeta ?? undefined,
      )
    : null;

  const cancelLongPressTimer = () => {
    window.clearTimeout(longPressTimer.current);
    longPressTimer.current = 0;
    pressOrigin.current = null;
  };

  const openInfo = (item: RoomItem, fromLongPress = false) => {
    cancelLongPressTimer();
    // Only suppress the trailing click after a real long-press. Setting this on a
    // normal tap (e.g. previewed/depleted cell) ate the next locked-item tap.
    if (fromLongPress) longPressArmed.current = true;
    setInfoItem(item);
  };

  const handleCellClick = (item: RoomItem, state: ReturnType<typeof tileState>) => {
    if (longPressArmed.current) {
      longPressArmed.current = false;
      return;
    }
    const paint = isPaintItem(item);
    // Locked / shoppable tiles always open pick (buy sheet) on the first tap,
    // even while another item is mid-preview — do not require a second click.
    if (state.locked) {
      setInfoItem(null);
      onPick(item);
      return;
    }
    if (paint || state.remaining > 0) {
      setInfoItem(null);
      onPick(item);
      return;
    }
    openInfo(item, false);
  };

  return (
    <section
      className={`lucky-drawer ${paintTab ? "is-paint" : ""} ${catsTab ? "is-cats" : ""} ${tutorialLockId ? "is-tutorial" : ""} ${expanded ? "is-expanded" : ""} ${sheetDragging ? "is-dragging" : ""}`}
      aria-label="꾸미기 서랍"
      style={{ height: sheetHeight }}
    >
      <div
        className="lucky-drawer-handle"
        role="slider"
        aria-label="아이템창 높이"
        aria-valuemin={DRAWER_DISMISS_HEIGHT}
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
            aria-label="발바닥 젤리 도움말"
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
            onClick={(event) => {
              onTab(item.id);
              if (item.id === "고양이 친구") {
                event.currentTarget.scrollIntoView({ inline: "nearest" });
              }
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {catsTab ? (
        <RoomCatsTab selectedId={roamingCatId} onSelect={onSelectCat} />
      ) : (
        <>
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

      {infoItem && infoState ? (
        <div className="lucky-drawer-info" role="dialog" aria-label={infoItem.nameKo}>
          <div className="lucky-drawer-info-copy">
            <strong className="lucky-drawer-info-name">{infoItem.nameKo}</strong>
            <span
              className={`lucky-drawer-info-status ${
                infoState.otherRoom && infoMeta?.otherRoomName ? "is-multiline" : ""
              }`}
            >
              {infoItem.attendanceOnly
                ? "출석 한정 · 다시 살 수 없어요"
                : infoState.otherRoom && infoMeta?.otherRoomName
                  ? `다른 방에 있어요\n${infoMeta.otherRoomName}`
                  : infoState.depleted
                    ? infoMeta?.canBuyMore
                      ? "모두 배치 중"
                      : "더 이상 가질 수 없어요"
                    : infoState.placedHere
                      ? "이 방에 있어요"
                      : infoState.remaining > 0
                        ? `남은 ${infoState.remaining}/${infoMeta?.owned ?? 0}`
                        : "보유"}
            </span>
          </div>
          <div className="lucky-drawer-info-actions">
            {infoState.otherRoom ? (
              <button
                type="button"
                className="lucky-drawer-info-btn"
                onClick={() => {
                  setInfoItem(null);
                  onMoveHere(infoItem);
                }}
              >
                이 방으로 옮기기
              </button>
            ) : null}
            {!infoItem.attendanceOnly && infoMeta?.canBuyMore ? (
              <button
                type="button"
                className="lucky-drawer-info-btn is-amber"
                onClick={() => {
                  setInfoItem(null);
                  onBuyMore(infoItem);
                }}
              >
                하나 더 사기 · {jellyLabel(infoItem.price)}
              </button>
            ) : null}
            <button
              type="button"
              className="lucky-drawer-info-close"
              aria-label="닫기"
              onClick={() => setInfoItem(null)}
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}

      <div ref={gridRef} className={`lucky-drawer-grid ${tutorialLockId ? "is-tut-mode" : ""}`}>
        {visible.map((item, index) => {
          const meta = itemMeta[item.id];
          const state = tileState(item, layout, owned, selectedId, brushId, otherRoomIds[item.id] ?? null, meta);
          const tutLockedOut = Boolean(tutorialLockId && tutorialLockId !== item.id);
          const paint = isPaintItem(item);
          const ownedCount = meta?.owned ?? owned[item.id] ?? 0;
          const remaining = meta?.remaining ?? 0;
          const showCount = !paint && !state.locked && ownedCount > 1;
          const dimmed = !state.locked && !paint && remaining <= 0;

          return (
            <button
              key={item.id}
              id={
                (tutorialLockId && item.id === tutorialLockId) || (!tutorialLockId && index === 0)
                  ? "drawer-item-0"
                  : undefined
              }
              type="button"
              className={`lucky-cell ${state.locked ? "is-locked" : ""} ${state.placedHere ? "is-placed" : ""} ${state.otherRoom || state.depleted ? "is-other" : ""} ${state.selected || infoItem?.id === item.id ? "is-selected" : ""} ${tutLockedOut ? "is-tut-locked" : ""} ${dimmed ? "is-dimmed" : ""}`}
              disabled={tutLockedOut}
              aria-label={item.nameKo}
              onClick={() => handleCellClick(item, state)}
              onPointerDown={(event) => {
                if (tutLockedOut || state.locked) return;
                if (event.button != null && event.button !== 0) return;
                cancelLongPressTimer();
                longPressArmed.current = false;
                pressOrigin.current = { x: event.clientX, y: event.clientY, item };
                longPressTimer.current = window.setTimeout(() => {
                  openInfo(item, true);
                }, LONG_PRESS_MS);
              }}
              onPointerMove={(event) => {
                if (!pressOrigin.current) return;
                const dx = event.clientX - pressOrigin.current.x;
                const dy = event.clientY - pressOrigin.current.y;
                if (Math.hypot(dx, dy) > 10) cancelLongPressTimer();
              }}
              onPointerUp={cancelLongPressTimer}
              onPointerCancel={() => {
                cancelLongPressTimer();
                longPressArmed.current = false;
              }}
            >
              <span className="lucky-cell-tile">
                {item.tileImage || item.id ? (
                  <img
                    src={roomAsset(item.tileImage ?? `tiles/${item.id}.png`)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="lucky-cell-empty" />
                )}
                {item.attendanceOnly && !state.locked ? (
                  <img
                    className="lucky-cell-badge is-tl"
                    src={roomAsset("ui/icon-badge-moon.svg")}
                    alt=""
                    aria-hidden="true"
                  />
                ) : null}
                {state.placedHere && !state.locked && !paint ? (
                  <img
                    className="lucky-cell-badge is-tr"
                    src={roomAsset("ui/badge-check.svg")}
                    alt=""
                    aria-hidden="true"
                  />
                ) : null}
                {state.otherRoom && !state.locked && !paint ? (
                  <img
                    className="lucky-cell-badge is-tr"
                    src={roomAsset("ui/icon-badge-home.svg")}
                    alt=""
                    aria-hidden="true"
                  />
                ) : null}
                {state.locked ? (
                  <img
                    className="lucky-cell-badge is-tr"
                    src={roomAsset("ui/icon-lock.svg")}
                    alt=""
                    aria-hidden="true"
                  />
                ) : null}
                {showCount ? (
                  <span className="lucky-cell-count" aria-label={`남은 ${remaining} / 전체 ${ownedCount}`}>
                    {remaining}/{ownedCount}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
        </>
      )}
      {catsTab ? null : <div className="lucky-drawer-fade" aria-hidden="true" />}
    </section>
  );
}
