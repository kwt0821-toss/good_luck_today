import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

import { RoomBuySheet, RoomConfirm, RoomExchangeSheet } from "../components/RoomDialogs";
import { RoomDrawer } from "../components/RoomDrawer";
import { RoomWorld } from "../components/RoomWorld";
import { dexAsset, loadDexCatalog } from "../lib/dexCatalog";
import { loadDexOwned } from "../lib/dexCollection";
import { haptic, isInTossApp } from "../lib/native";
import { itemMap, loadRoomCatalog, roomAsset } from "../lib/roomCatalog";
import {
  canPlace,
  cloneLayout,
  firstFreeTile,
  hitTestTile,
  itemSize,
  nearestHints,
  occupancy,
  screenOf,
  spriteWorldPos,
  wallSpritePos,
} from "../lib/roomLayout";
import { defaultLayout, loadRoomState, newInstanceId, saveRoomState } from "../lib/roomStore";
import type { DexCard } from "../lib/dexTypes";
import type { FloorPlacement, RoomItem, RoomLayoutState, RoomMode, RoomSaveState, RoomTab } from "../lib/roomTypes";
import "./RoomScreen.css";

type RoomScreenProps = {
  onBack: () => void;
};

function formatPoints(value: number) {
  return value.toLocaleString("en-US");
}

export function RoomScreen({ onBack }: RoomScreenProps) {
  const [items, setItems] = useState<RoomItem[]>([]);
  const [state, setState] = useState<RoomSaveState | null>(null);
  const [frameThumbs, setFrameThumbs] = useState<string[]>([]);
  const [mode, setMode] = useState<RoomMode>(() =>
    new URLSearchParams(window.location.search).get("edit") ? "edit" : "view",
  );
  const [tab, setTab] = useState<RoomTab>("가구");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RoomLayoutState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [buyItem, setBuyItem] = useState<RoomItem | null>(null);
  const [confirm, setConfirm] = useState<"reset" | "discard" | "save-ph" | null>(null);
  const [exchangeOpen, setExchangeOpen] = useState(false);
  const [dupes, setDupes] = useState<{ card: DexCard; extra: number; pick: number }[]>([]);
  const [dragging, setDragging] = useState<{ instanceId: string; col: number; row: number } | null>(null);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [stars] = useState(() => makeStars());
  const toastTimer = useRef(0);
  const longPress = useRef(0);
  const dragOrigin = useRef<FloorPlacement | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const itemsById = useMemo(() => itemMap(items), [items]);

  useEffect(() => {
    void loadRoomCatalog().then(async (catalog) => {
      setItems(catalog.items);
      setState(await loadRoomState(catalog.items));
    });
    void Promise.all([loadDexCatalog(), loadDexOwned()]).then(([catalog, owned]) => {
      const thumbs = catalog.cards
        .filter((card) => (owned[card.id]?.count ?? 0) > 0)
        .slice(0, 3)
        .map((card) => dexAsset(card.thumb));
      setFrameThumbs(thumbs);
    });
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  };

  const persist = (next: RoomSaveState) => {
    setState(next);
    void saveRoomState(next);
  };

  if (!state) {
    return <div className="lucky-room is-loading">방을 불러오는 중이에요.</div>;
  }

  const layout = state.layout;
  const placedCount = layout.floor.length + layout.walls.length;
  const selected =
    layout.floor.find((item) => item.instanceId === selectedId) ??
    layout.walls.find((item) => item.instanceId === selectedId);
  const selectedItem = selected ? itemsById.get(selected.id) : undefined;
  const selectedFloor = selected && "col" in selected ? selected : null;
  const hints =
    mode === "edit" && selectedFloor && selectedItem && selectedItem.placement === "floor"
      ? nearestHints(selectedItem, selectedFloor.rot, layout.floor, itemsById, selectedId ?? undefined)
      : null;

  const enterEdit = () => {
    setSnapshot(cloneLayout(layout));
    setMode("edit");
    setSelectedId(null);
    void haptic("tap");
  };

  const leaveEdit = (saved: boolean) => {
    setMode("view");
    setSelectedId(null);
    setDragging(null);
    setSnapshot(null);
    if (saved) showToast("방을 저장했어요");
  };

  const patchLayout = (nextLayout: RoomLayoutState) => {
    persist({ ...state, layout: nextLayout });
  };

  const onSelect = (instanceId: string | null) => {
    if (mode !== "edit") return;
    setSelectedId(instanceId);
    if (instanceId) void haptic("tap");
  };

  const onFloorPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (mode !== "edit") return;
    if ((event.target as HTMLElement).closest(".lucky-sprite")) return;
    setSelectedId(null);
  };

  const onItemPointerDown = (event: PointerEvent<HTMLButtonElement>, instanceId: string) => {
    if (mode !== "edit") return;
    event.stopPropagation();
    const place = layout.floor.find((item) => item.instanceId === instanceId);
    setSelectedId(instanceId);
    if (!place) return;
    window.clearTimeout(longPress.current);
    longPress.current = window.setTimeout(() => {
      dragOrigin.current = { ...place };
      setDragging({ instanceId, col: place.col, row: place.row });
      event.currentTarget.setPointerCapture(event.pointerId);
    }, 200);
  };

  const onStagePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const tile = hitTestTile(event.clientX - rect.left, event.clientY - rect.top, mode);
    setDragging((current) => (current ? { ...current, col: tile.col, row: tile.row } : current));
  };

  const onStagePointerUp = () => {
    window.clearTimeout(longPress.current);
    if (!dragging) return;
    const place = layout.floor.find((item) => item.instanceId === dragging.instanceId);
    const item = place ? itemsById.get(place.id) : undefined;
    if (place && item) {
      const [w, d] = itemSize(item, place.rot);
      const used = occupancy(layout.floor, itemsById, place.instanceId);
      const ok =
        item.layer === "decal"
          ? dragging.col >= 0 && dragging.row >= 0 && dragging.col + w <= 8 && dragging.row + d <= 8
          : canPlace(dragging.col, dragging.row, w, d, used);
      if (ok) {
        patchLayout({
          ...layout,
          floor: layout.floor.map((entry) =>
            entry.instanceId === place.instanceId ? { ...entry, col: dragging.col, row: dragging.row } : entry,
          ),
        });
        void haptic("softMedium");
      }
    }
    setDragging(null);
    dragOrigin.current = null;
  };

  const rotateSelected = () => {
    if (!selectedFloor || !selectedItem || selectedItem.placement !== "floor") return;
    const nextRot: 0 | 1 = selectedFloor.rot === 0 ? 1 : 0;
    const [w, d] = itemSize(selectedItem, nextRot);
    const used = occupancy(layout.floor, itemsById, selectedFloor.instanceId);
    if (!canPlace(selectedFloor.col, selectedFloor.row, w, d, used) && selectedItem.layer !== "decal") {
      setShakeId(selectedFloor.instanceId);
      window.setTimeout(() => setShakeId(null), 300);
      return;
    }
    patchLayout({
      ...layout,
      floor: layout.floor.map((entry) =>
        entry.instanceId === selectedFloor.instanceId ? { ...entry, rot: nextRot, flip: !entry.flip } : entry,
      ),
    });
  };

  const flipSelected = () => {
    if (!selectedFloor) return;
    patchLayout({
      ...layout,
      floor: layout.floor.map((entry) =>
        entry.instanceId === selectedFloor.instanceId ? { ...entry, flip: !entry.flip } : entry,
      ),
    });
  };

  const deleteSelected = () => {
    if (!selected) return;
    patchLayout({
      ...layout,
      floor: layout.floor.filter((entry) => entry.instanceId !== selected.instanceId),
      walls: layout.walls.filter((entry) => entry.instanceId !== selected.instanceId),
    });
    setSelectedId(null);
  };

  const startMove = () => {
    if (!selectedFloor) return;
    dragOrigin.current = { ...selectedFloor };
    setDragging({ instanceId: selectedFloor.instanceId, col: selectedFloor.col, row: selectedFloor.row });
  };

  const pickDrawerItem = (item: RoomItem) => {
    if ((state.owned[item.id] ?? 0) < 1) {
      setBuyItem(item);
      return;
    }
    if (item.placement === "wallpaper") {
      patchLayout({ ...layout, wallpaper: item.id });
      return;
    }
    if (item.placement === "floor-skin") {
      patchLayout({ ...layout, floorSkin: item.id });
      return;
    }
    const existing =
      layout.floor.find((place) => place.id === item.id) ?? layout.walls.find((place) => place.id === item.id);
    if (existing && !item.stackable) {
      setSelectedId(existing.instanceId);
      return;
    }
    if (item.placement === "wall") {
      const wall = item.wall ?? "L";
      const instanceId = newInstanceId(item.id);
      patchLayout({
        ...layout,
        walls: [
          ...layout.walls,
          {
            instanceId,
            id: item.id,
            wall,
            slot: 0,
            span: item.footprint?.[0] ?? 3,
            worldPx: item.wallPosWorldPx ?? [1699, 549],
          },
        ],
      });
      setSelectedId(instanceId);
      return;
    }
    const spot = firstFreeTile(item, 0, layout.floor, itemsById);
    if (!spot) {
      showToast("놓을 칸이 없어요");
      return;
    }
    const instanceId = newInstanceId(item.id);
    patchLayout({
      ...layout,
      floor: [...layout.floor, { instanceId, id: item.id, col: spot.col, row: spot.row, rot: 0, flip: false }],
    });
    setSelectedId(instanceId);
    void haptic("tap");
  };

  const buy = (item: RoomItem) => {
    if (state.points < item.price) return;
    persist({
      ...state,
      points: state.points - item.price,
      owned: { ...state.owned, [item.id]: 1 },
    });
    setBuyItem(null);
    showToast(`${item.nameKo}를 샀어요`);
  };

  const openExchange = async () => {
    const [catalog, owned] = await Promise.all([loadDexCatalog(), loadDexOwned()]);
    const rows = catalog.cards
      .map((card) => {
        const extra = Math.max(0, (owned[card.id]?.count ?? 0) - 1);
        return { card, extra, pick: extra };
      })
      .filter((row) => row.extra > 0);
    setDupes(rows);
    setExchangeOpen(true);
  };

  const screen = screenOf(mode);
  const hud = selectedItem && selected ? selectionHud(selectedItem, selected, screen) : null;

  return (
    <div
      className={`lucky-room is-${mode} ${shakeId ? "is-shaking" : ""}`}
      ref={stageRef}
      onPointerMove={onStagePointerMove}
      onPointerUp={onStagePointerUp}
      onPointerCancel={onStagePointerUp}
    >
      <div className="lucky-stars" aria-hidden="true">
        {stars.map((star) => (
          <span
            key={star.id}
            className={`lucky-star ${star.sparkle ? "is-sparkle" : ""}`}
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: star.r,
              height: star.r,
              animationDelay: `${star.delay}s`,
              animationDuration: `${star.duration}s`,
              background: star.amber ? "#ffd696" : "#fff0d6",
              opacity: star.alpha,
            }}
          />
        ))}
      </div>
      <div className="lucky-grain" aria-hidden="true" />
      <div className="lucky-warm-glow" aria-hidden="true" />

      {!isInTossApp() ? (
        <button type="button" className="lucky-back" onClick={onBack} aria-label="뒤로 가기">
          ←
        </button>
      ) : null}

      {mode === "view" ? (
        <header className="lucky-header">
          <p className="lucky-eyebrow">방꾸미기</p>
          <img className="lucky-logo" src={roomAsset("ui/logo-myroom.svg")} alt="MY ROOM." />
          <div className="lucky-meta">
            <strong>COZY Lv.{state.cozyLevel}</strong>
            <span>ITEMS {String(placedCount).padStart(2, "0")}</span>
          </div>
        </header>
      ) : (
        <div className="lucky-edit-bar">
          <button type="button" className="lucky-ghost" onClick={() => setConfirm("discard")}>
            취소
          </button>
          <p>
            <b>EDIT</b>
            <span>꾸미는 중</span>
          </p>
          <button
            type="button"
            className="lucky-done"
            onClick={() => {
              persist(state);
              leaveEdit(true);
            }}
          >
            완료
          </button>
        </div>
      )}

      <div
        className={`lucky-island ${mode === "view" ? "is-float" : ""}`}
        style={{
          left: screen.left,
          top: screen.top,
          width: screen.width,
          height: screen.height,
        }}
      >
        <div className="lucky-island-scale" style={{ transform: `scale(${screen.scale})` }}>
          <RoomWorld
            mode={mode}
            itemsById={itemsById}
            layout={layout}
            selectedId={selectedId}
            dragging={dragging}
            hints={hints}
            frameThumbs={frameThumbs}
            onSelect={onSelect}
            onItemPointerDown={onItemPointerDown}
            onFloorPointerDown={onFloorPointerDown}
          />
        </div>
      </div>

      {mode === "edit" && hud && selectedItem && selected ? (
        <div
          className="lucky-select-hud"
          style={{ left: hud.left, top: hud.top, width: hud.width, height: hud.height }}
        >
          <div className="lucky-select-box" />
          {selectedFloor ? (
            <div className="lucky-mini-toolbar">
              <button type="button" aria-label="이동" onClick={startMove}>
                <img src={roomAsset("ui/icon-move.svg")} alt="" />
              </button>
              <button type="button" aria-label="회전" onClick={rotateSelected}>
                <img src={roomAsset("ui/icon-rotate.svg")} alt="" />
              </button>
              <button type="button" aria-label="뒤집기" onClick={flipSelected}>
                <img src={roomAsset("ui/icon-flip.svg")} alt="" />
              </button>
              <button type="button" className="is-delete" aria-label="삭제" onClick={deleteSelected}>
                <img src={roomAsset("ui/icon-delete.svg")} alt="" />
              </button>
            </div>
          ) : null}
          <span className="lucky-select-tag">
            {selectedItem.nameKo} · {selectedFloor ? itemSize(selectedItem, selectedFloor.rot).join("×") : "벽"}
          </span>
        </div>
      ) : null}

      {mode === "view" ? (
        <>
          <p className="lucky-hint">
            <span>쉿,</span> 냥이가 자는 동안 방을 꾸며 봐요
          </p>
          <div className="lucky-bar">
            <div className="lucky-bar-points">
              <img src={roomAsset("ui/icon-paw-point.svg")} alt="" />
              <div>
                <strong>{formatPoints(state.points)}</strong>
                <small>PAW POINTS</small>
              </div>
            </div>
            <button type="button" className="lucky-cta" onClick={enterEdit}>
              <img src={roomAsset("ui/icon-brush.svg")} alt="" />
              꾸미기
            </button>
            <button type="button" className="lucky-bar-btn" onClick={() => setConfirm("save-ph")}>
              <img src={roomAsset("ui/icon-save.svg")} alt="" />
              저장
            </button>
            <button type="button" className="lucky-bar-btn" onClick={() => setConfirm("reset")}>
              <img src={roomAsset("ui/icon-reset.svg")} alt="" />
              초기화
            </button>
          </div>
        </>
      ) : (
        <RoomDrawer
          tab={tab}
          onTab={setTab}
          items={items}
          layout={layout}
          owned={state.owned}
          points={state.points}
          selectedId={selectedId}
          onPick={pickDrawerItem}
          onExchange={() => void openExchange()}
        />
      )}

      {buyItem ? (
        <RoomBuySheet item={buyItem} points={state.points} onClose={() => setBuyItem(null)} onBuy={() => buy(buyItem)} />
      ) : null}

      {confirm === "reset" ? (
        <RoomConfirm
          title="방을 처음 상태로 되돌릴까요?"
          body="배치한 가구는 서랍으로 돌아가요. 산 아이템은 그대로 있어요."
          cancel="취소"
          confirm="초기화"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            persist({ ...state, layout: defaultLayout() });
            setConfirm(null);
            showToast("기본 배치로 돌아갔어요");
          }}
        />
      ) : null}

      {confirm === "discard" ? (
        <RoomConfirm
          title="변경사항을 버릴까요?"
          body="꾸미기 모드에 들어오기 전 배치로 돌아가요."
          cancel="계속 꾸미기"
          confirm="버리기"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            if (snapshot) persist({ ...state, layout: snapshot });
            setConfirm(null);
            leaveEdit(false);
          }}
        />
      ) : null}

      {confirm === "save-ph" ? (
        <RoomConfirm
          title="방 사진 저장"
          body="갤러리 저장은 곧 열려요. 지금은 배치만 기억해 둘게요."
          cancel="닫기"
          confirm="확인"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            void saveRoomState(state);
            setConfirm(null);
            showToast("방을 기억해 두었어요");
          }}
        />
      ) : null}

      {exchangeOpen ? (
        <RoomExchangeSheet
          cards={dupes}
          onClose={() => setExchangeOpen(false)}
          onConfirm={(picks) => {
            const gained = dupes.reduce((sum, row) => {
              const n = picks[row.card.id] ?? 0;
              const rate = row.card.type === "legend" ? 150 : row.card.type === "special" || row.card.type === "character" ? 60 : (row.card.stars ?? 0) >= 4 ? 30 : 10;
              return sum + n * rate;
            }, 0);
            persist({ ...state, points: state.points + gained });
            setExchangeOpen(false);
            if (gained) showToast(`발바닥 +${gained} 받았어요`);
          }}
        />
      ) : null}

      {toast ? (
        <div className="local-toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function selectionHud(
  item: RoomItem,
  place: FloorPlacement | { instanceId: string; id: string },
  screen: { scale: number; left: number; top: number },
) {
  const pad = 6;
  if ("col" in place) {
    const pos = spriteWorldPos(item, place.col, place.row, place.rot);
    const size = item.spriteWorldPx ?? [120, 160];
    return {
      left: screen.left + pos.x * screen.scale - pad,
      top: screen.top + pos.y * screen.scale - pad,
      width: size[0] * screen.scale + pad * 2,
      height: size[1] * screen.scale + pad * 2,
    };
  }
  const wall = place as { worldPx?: [number, number] };
  const pos = wallSpritePos(item, {
    instanceId: place.instanceId,
    id: item.id,
    wall: item.wall ?? "L",
    slot: 0,
    span: 3,
    worldPx: "worldPx" in wall && wall.worldPx ? wall.worldPx : (item.wallPosWorldPx ?? [1699, 549]),
  });
  const size = item.spriteWorldPx ?? [230, 341];
  return {
    left: screen.left + pos.x * screen.scale - pad,
    top: screen.top + pos.y * screen.scale - pad,
    width: size[0] * screen.scale + pad * 2,
    height: size[1] * screen.scale + pad * 2,
  };
}

function makeStars() {
  const stars = [];
  let seed = 42;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 110; i += 1) {
    stars.push({
      id: i,
      x: rand() * 100,
      y: rand() * 58,
      r: 0.4 + rand() * 0.4,
      alpha: 0.3 + rand() * 0.5,
      delay: rand() * 4,
      duration: 2 + rand() * 3,
      amber: rand() > 0.7,
      sparkle: rand() > 0.92,
    });
  }
  return stars;
}
