import { itemMatchesTab, roomAsset, ROOM_TABS } from "../lib/roomCatalog";
import type { RoomItem, RoomLayoutState, RoomTab } from "../lib/roomTypes";

type RoomDrawerProps = {
  tab: RoomTab;
  onTab: (tab: RoomTab) => void;
  items: RoomItem[];
  layout: RoomLayoutState;
  owned: Record<string, number>;
  points: number;
  selectedId: string | null;
  onPick: (item: RoomItem) => void;
  onExchange: () => void;
};

function tileState(item: RoomItem, layout: RoomLayoutState, owned: Record<string, number>, selectedId: string | null) {
  const locked = (owned[item.id] ?? 0) < 1;
  const placed =
    layout.floor.some((place) => place.id === item.id) ||
    layout.walls.some((place) => place.id === item.id) ||
    (item.placement === "wallpaper" && layout.wallpaper === item.id) ||
    (item.placement === "floor-skin" && layout.floorSkin === item.id);
  const selected =
    layout.floor.some((place) => place.instanceId === selectedId && place.id === item.id) ||
    layout.walls.some((place) => place.instanceId === selectedId && place.id === item.id);
  return { locked, placed, selected };
}

export function RoomDrawer({
  tab,
  onTab,
  items,
  layout,
  owned,
  points,
  selectedId,
  onPick,
  onExchange,
}: RoomDrawerProps) {
  const visible = items.filter((item) => itemMatchesTab(item, tab));

  return (
    <section className="lucky-drawer" aria-label="꾸미기 서랍">
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
      <div className="lucky-drawer-grid">
        {visible.map((item) => {
          const state = tileState(item, layout, owned, selectedId);
          return (
            <button
              key={item.id}
              type="button"
              className={`lucky-cell ${state.locked ? "is-locked" : ""} ${state.placed ? "is-placed" : ""} ${state.selected ? "is-selected" : ""}`}
              onClick={() => onPick(item)}
            >
              <span className="lucky-cell-tile">
                {item.tileImage || item.id ? (
                  <img src={roomAsset(item.tileImage ?? `tiles/${item.id}.png`)} alt="" />
                ) : (
                  <span className="lucky-cell-empty" />
                )}
                {state.placed && !state.locked ? (
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
                <small>{state.placed ? "배치 중" : "보유"}</small>
              )}
            </button>
          );
        })}
      </div>
      <div className="lucky-drawer-fade" aria-hidden="true" />
    </section>
  );
}
