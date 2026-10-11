import { itemMatchesTab, itemMatchesTheme, roomAsset, ROOM_TABS, ROOM_THEME_FILTERS } from "../lib/roomCatalog";
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
  onPick,
  onFillMode,
  onEraser,
  onUndo,
  onExchange,
}: RoomDrawerProps) {
  const visible = items.filter((item) => itemMatchesTab(item, tab) && itemMatchesTheme(item, themeFilter));
  const paintTab = tab === "벽지" || tab === "바닥";

  return (
    <section className={`lucky-drawer ${paintTab ? "is-paint" : ""}`} aria-label="꾸미기 서랍">
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
      <div className="lucky-drawer-grid">
        {visible.map((item) => {
          const state = tileState(item, layout, owned, selectedId, brushId, otherRoomIds[item.id] ?? null);
          return (
            <button
              key={item.id}
              type="button"
              className={`lucky-cell ${state.locked ? "is-locked" : ""} ${state.placedHere ? "is-placed" : ""} ${state.otherRoom ? "is-other" : ""} ${state.selected ? "is-selected" : ""}`}
              onClick={() => onPick(item)}
            >
              <span className="lucky-cell-tile">
                {item.tileImage || item.id ? (
                  <img src={roomAsset(item.tileImage ?? `tiles/${item.id}.png`)} alt="" />
                ) : (
                  <span className="lucky-cell-empty" />
                )}
                {state.placedHere && !state.locked ? (
                  <img className="lucky-cell-check" src={roomAsset("ui/badge-check.svg")} alt="" />
                ) : null}
                {state.locked ? <img className="lucky-cell-lock" src={roomAsset("ui/icon-lock.svg")} alt="" /> : null}
              </span>
              <strong>{item.nameKo}</strong>
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
