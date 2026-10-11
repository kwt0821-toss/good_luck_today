import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

import { RoomBuySheet, RoomConfirm, RoomExchangeSheet, RoomUnlockSheet } from "../components/RoomDialogs";
import { RoomDrawer } from "../components/RoomDrawer";
import { RoomWorld } from "../components/RoomWorld";
import { dexAsset, loadDexCatalog } from "../lib/dexCatalog";
import { loadDexOwned } from "../lib/dexCollection";
import { haptic } from "../lib/native";
import {
  isPaintItem,
  itemMap,
  loadRoomCatalog,
  loadRoomGrid,
  loadRoomsFile,
  ROOM_HINTS,
  roomAsset,
  roomById,
  type RoomDefinition,
  type RoomGridFile,
  type RoomsFile,
} from "../lib/roomCatalog";
import {
  canPlace,
  canPlaceWall,
  cloneLayout,
  firstFreeTile,
  firstFreeOnWall,
  hitTestPaint,
  hitTestTile,
  hitTestWall,
  inGrid,
  isDecal,
  isWallDecor,
  itemSize,
  nearestHints,
  occupancy,
  screenOf,
  snapWallHit,
  spriteRect,
  toggledOrientation,
  wallOccupancy,
  wallPlaceFromSlot,
  wallSpriteRect,
  resolvedWallSlot,
} from "../lib/roomLayout";
import {
  currentRoom,
  defaultRecord,
  loadRoomState,
  newInstanceId,
  patchCurrentRoom,
  placedCountAll,
  placedInOtherRoom,
  saveRoomState,
} from "../lib/roomStore";
import {
  applyPaint,
  cloneFloorTiles,
  cloneWallTiles,
  paintTargetAnchor,
  paintTargetLabel,
} from "../lib/roomTiles";
import type { DexCard } from "../lib/dexTypes";
import type {
  FloorPlacement,
  PaintFillMode,
  PaintTarget,
  RoomDrag,
  RoomItem,
  RoomLayoutState,
  RoomMode,
  RoomSaveState,
  RoomTab,
  RoomThemeFilter,
  WallPlacement,
} from "../lib/roomTypes";

const VIEW_W = 390;
const SWIPE_THRESHOLD = 56;
import "./RoomScreen.css";

type RoomScreenProps = {
  onBack: () => void;
};

function formatPoints(value: number) {
  return value.toLocaleString("en-US");
}

export function RoomScreen({ onBack }: RoomScreenProps) {
  const [items, setItems] = useState<RoomItem[]>([]);
  const [grid, setGrid] = useState<RoomGridFile | null>(null);
  const [roomsFile, setRoomsFile] = useState<RoomsFile | null>(null);
  const [state, setState] = useState<RoomSaveState | null>(null);
  const [themeFilter, setThemeFilter] = useState<RoomThemeFilter>("all");
  const [unlockRoom, setUnlockRoom] = useState<RoomDefinition | null | "soon">(null);
  const [dragX, setDragX] = useState(0);
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
  const [dragging, setDragging] = useState<RoomDrag | null>(null);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [activeWall, setActiveWall] = useState<"L" | "R">("L");
  const [brushId, setBrushId] = useState<string | null>(null);
  const [fillMode, setFillMode] = useState<PaintFillMode>("cell");
  const [eraser, setEraser] = useState(false);
  const [paintHover, setPaintHover] = useState<PaintTarget | null>(null);
  const [undoStack, setUndoStack] = useState<
    { floorTiles: RoomLayoutState["floorTiles"]; wallTiles: RoomLayoutState["wallTiles"] }[]
  >([]);
  const [stars] = useState(() => makeStars());
  const toastTimer = useRef(0);
  const longPress = useRef(0);
  const dragOrigin = useRef<FloorPlacement | WallPlacement | null>(null);
  const paintStroke = useRef<{
    dirty: boolean;
    before: { floorTiles: RoomLayoutState["floorTiles"]; wallTiles: RoomLayoutState["wallTiles"] };
    painted: Set<string>;
  } | null>(null);
  const tilesRef = useRef<{
    floorTiles: RoomLayoutState["floorTiles"];
    wallTiles: RoomLayoutState["wallTiles"];
  } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const swipe = useRef({ x: 0, y: 0, dx: 0, active: false });
  const itemsById = useMemo(() => itemMap(items), [items]);
  const paintTab = tab === "벽지" || tab === "바닥";

  useEffect(() => {
    void Promise.all([loadRoomCatalog(), loadRoomGrid(), loadRoomsFile()]).then(async ([catalog, gridFile, rooms]) => {
      const { applyOpsPrices, syncRoomSaveWithOps } = await import("../lib/roomEconomy");
      const priced = await applyOpsPrices(catalog.items);
      setItems(priced);
      setGrid(gridFile);
      setRoomsFile(rooms);
      const loaded = await loadRoomState(priced, rooms, gridFile);
      setState(await syncRoomSaveWithOps(loaded));
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

  const shake = (instanceId: string) => {
    setShakeId(instanceId);
    window.setTimeout(() => setShakeId(null), 300);
  };

  if (!state || !roomsFile) {
    return <div className="lucky-room is-loading">방을 불러오는 중이에요.</div>;
  }

  const layout = currentRoom(state);
  const roomDef = roomById(roomsFile.rooms, state.currentRoomId) ?? roomsFile.rooms[0];
  const unlockedIds = roomsFile.switcher.order.filter((id) => state.unlocked.includes(id) && state.rooms[id]);
  const lockedRooms = roomsFile.rooms.filter((room) => !state.unlocked.includes(room.id));
  const currentIndex = Math.max(0, unlockedIds.indexOf(state.currentRoomId));
  const otherRoomIds = Object.fromEntries(items.map((item) => [item.id, placedInOtherRoom(state, item.id)]));
  if (!paintStroke.current) {
    tilesRef.current = { floorTiles: layout.floorTiles, wallTiles: layout.wallTiles };
  }
  const placedCount = layout.floor.length + layout.walls.length;
  const selected =
    layout.floor.find((item) => item.instanceId === selectedId) ??
    layout.walls.find((item) => item.instanceId === selectedId);
  const selectedItem = selected ? itemsById.get(selected.id) : undefined;
  const selectedFloor = selected && "col" in selected ? selected : null;
  const selectedWall = selected && "wall" in selected && !("col" in selected) ? (selected as WallPlacement) : null;
  const hints =
    mode === "edit" && selectedFloor && selectedItem && !selectedFloor.onTopOf && !isWallDecor(selectedItem)
      ? nearestHints(selectedItem, selectedFloor.orientation, layout.floor, itemsById, selectedId ?? undefined)
      : null;

  const enterEdit = () => {
    setSnapshot(cloneLayout(layout));
    setMode("edit");
    setSelectedId(null);
    setUndoStack([]);
    void haptic("tap");
  };

  const leaveEdit = (saved: boolean) => {
    setMode("view");
    setSelectedId(null);
    setDragging(null);
    setSnapshot(null);
    setPaintHover(null);
    setUndoStack([]);
    paintStroke.current = null;
    if (saved) showToast("방을 저장했어요");
  };

  const patchLayout = (nextLayout: RoomLayoutState) => {
    persist(patchCurrentRoom(state, nextLayout));
  };

  const goToUnlocked = (index: number) => {
    if (index < 0) return;
    if (index >= unlockedIds.length) {
      setUnlockRoom(lockedRooms[0] ?? "soon");
      return;
    }
    const nextId = unlockedIds[index];
    if (!nextId || nextId === state.currentRoomId) return;
    persist({ ...state, currentRoomId: nextId });
    void haptic("tap");
  };

  const rubberX = (dx: number) => {
    if (currentIndex <= 0 && dx > 0) return dx * 0.32;
    if (currentIndex >= unlockedIds.length - 1 && dx < 0) return dx * 0.32;
    return dx;
  };

  const onSwipeDown = (event: PointerEvent<HTMLDivElement>) => {
    if (mode !== "view") return;
    swipe.current = { x: event.clientX, y: event.clientY, dx: 0, active: true };
  };

  const onSwipeMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!swipe.current.active) return;
    const dx = event.clientX - swipe.current.x;
    const dy = event.clientY - swipe.current.y;
    if (Math.abs(dx) < 8 && Math.abs(dragX) === 0) return;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dragX) === 0) return;
    swipe.current.dx = dx;
    setDragX(rubberX(dx));
  };

  const onSwipeUp = () => {
    if (!swipe.current.active) return;
    const dx = swipe.current.dx;
    swipe.current.active = false;
    setDragX(0);
    if (dx <= -SWIPE_THRESHOLD) goToUnlocked(currentIndex + 1);
    else if (dx >= SWIPE_THRESHOLD) goToUnlocked(currentIndex - 1);
  };

  const onSelect = (instanceId: string | null) => {
    if (mode !== "edit") return;
    setSelectedId(instanceId);
    const wall = layout.walls.find((item) => item.instanceId === instanceId);
    if (wall) setActiveWall(wall.wall);
    if (instanceId) void haptic("tap");
  };

  const paintPrefer = (): "floor" | "wall" | "any" => {
    if (eraser) return "any";
    if (tab === "벽지") return "wall";
    if (tab === "바닥") return "floor";
    return "any";
  };

  const paintBrushId = (target?: PaintTarget | null) => {
    if (eraser) {
      if (target?.kind === "floor") return roomDef.defaultFloor;
      if (target?.kind === "wall") return roomDef.defaultWall[target.wall];
      if (tab === "벽지") return roomDef.defaultWall.L;
      if (tab === "바닥") return roomDef.defaultFloor;
      return null;
    }
    return brushId;
  };

  const beginPaintStroke = (layoutNow: RoomLayoutState) => {
    paintStroke.current = {
      dirty: false,
      before: {
        floorTiles: cloneFloorTiles(layoutNow.floorTiles),
        wallTiles: cloneWallTiles(layoutNow.wallTiles),
      },
      painted: new Set(),
    };
  };

  const paintAt = (target: PaintTarget) => {
    const id = paintBrushId(target);
    if (!id || !state) return;
    const key = target.kind === "floor" ? `f:${target.col},${target.row}` : `w:${target.wall}:${target.index}`;
    const stroke = paintStroke.current;
    if (stroke?.painted.has(key) && fillMode === "cell") return;
    const current = tilesRef.current ?? { floorTiles: layout.floorTiles, wallTiles: layout.wallTiles };
    const next = applyPaint(current.floorTiles, current.wallTiles, target, id, fillMode === "fill");
    if (!next.changed) return;
    tilesRef.current = { floorTiles: next.floor, wallTiles: next.walls };
    if (stroke) {
      stroke.dirty = true;
      stroke.painted.add(key);
    }
    persist(
      patchCurrentRoom(state, { ...state.rooms[state.currentRoomId], floorTiles: next.floor, wallTiles: next.walls }),
    );
    void haptic("tap");
  };

  const endPaintStroke = () => {
    const stroke = paintStroke.current;
    paintStroke.current = null;
    if (!stroke?.dirty) return;
    setUndoStack((stack) => [...stack.slice(-19), stroke.before]);
  };

  const undoPaint = () => {
    const prev = undoStack[undoStack.length - 1];
    if (!prev || !state) return;
    setUndoStack((stack) => stack.slice(0, -1));
    persist(
      patchCurrentRoom(state, {
        ...currentRoom(state),
        floorTiles: cloneFloorTiles(prev.floorTiles),
        wallTiles: cloneWallTiles(prev.wallTiles),
      }),
    );
  };

  const onFloorPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (mode !== "edit") return;
    if (!paintTab) {
      if ((event.target as HTMLElement).closest(".lucky-sprite")) return;
      setSelectedId(null);
      return;
    }
    event.preventDefault();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const target = hitTestPaint(event.clientX - rect.left, event.clientY - rect.top, mode, paintPrefer());
    setPaintHover(target);
    if (!target) return;
    beginPaintStroke(layout);
    paintAt(target);
    try {
      stageRef.current?.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  };

  const onItemPointerDown = (event: PointerEvent<HTMLButtonElement>, instanceId: string) => {
    if (mode !== "edit" || paintTab) return;
    event.stopPropagation();
    setSelectedId(instanceId);
    const floorPlace = layout.floor.find((item) => item.instanceId === instanceId);
    const wallPlace = layout.walls.find((item) => item.instanceId === instanceId);
    if (wallPlace) setActiveWall(wallPlace.wall);
    window.clearTimeout(longPress.current);
    longPress.current = window.setTimeout(() => {
      if (floorPlace && !floorPlace.onTopOf) {
        dragOrigin.current = { ...floorPlace };
        setDragging({ kind: "floor", instanceId, col: floorPlace.col, row: floorPlace.row });
        return;
      }
      if (wallPlace) {
        const item = itemsById.get(wallPlace.id);
        const slot = item ? resolvedWallSlot(item, wallPlace) : { slot: wallPlace.slot, band: wallPlace.band };
        dragOrigin.current = { ...wallPlace };
        setDragging({ kind: "wall", instanceId, wall: wallPlace.wall, slot: slot.slot, band: slot.band });
      }
    }, 200);
  };

  const onStagePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (mode === "edit" && paintTab && stageRef.current) {
      const rect = stageRef.current.getBoundingClientRect();
      const target = hitTestPaint(event.clientX - rect.left, event.clientY - rect.top, mode, paintPrefer());
      setPaintHover(target);
      if (paintStroke.current && target) paintAt(target);
    }
    if (!dragging || !stageRef.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    if (dragging.kind === "floor") {
      const tile = hitTestTile(localX, localY, mode);
      setDragging((current) => (current?.kind === "floor" ? { ...current, col: tile.col, row: tile.row } : current));
      return;
    }
    const place = layout.walls.find((item) => item.instanceId === dragging.instanceId);
    const item = place ? itemsById.get(place.id) : undefined;
    if (!item) return;
    const hit = hitTestWall(localX, localY, mode);
    if (!hit) return;
    const snapped = snapWallHit(item, hit);
    setActiveWall(snapped.wall);
    setDragging((current) =>
      current?.kind === "wall"
        ? { ...current, wall: snapped.wall, slot: snapped.slot, band: snapped.band }
        : current,
    );
  };

  const onStagePointerUp = () => {
    window.clearTimeout(longPress.current);
    if (paintStroke.current) endPaintStroke();
    if (!dragging) return;
    if (dragging.kind === "floor") {
      const place = layout.floor.find((item) => item.instanceId === dragging.instanceId);
      const item = place ? itemsById.get(place.id) : undefined;
      if (place && item) {
        const [w, d] = itemSize(item, place.orientation);
        const used = occupancy(layout.floor, itemsById, place.instanceId);
        const ok = isDecal(item)
          ? inGrid(dragging.col, dragging.row, w, d)
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
    } else {
      const place = layout.walls.find((item) => item.instanceId === dragging.instanceId);
      const item = place ? itemsById.get(place.id) : undefined;
      if (place && item) {
        const used = wallOccupancy(layout.walls, itemsById, place.instanceId);
        const ok = canPlaceWall(item, dragging.wall, dragging.slot, dragging.band, used);
        if (ok) {
          const next = wallPlaceFromSlot(item, dragging.wall, dragging.slot, dragging.band);
          patchLayout({
            ...layout,
            walls: layout.walls.map((entry) =>
              entry.instanceId === place.instanceId ? { ...entry, ...next, worldPx: undefined } : entry,
            ),
          });
          setActiveWall(next.wall);
          void haptic("softMedium");
        } else {
          shake(place.instanceId);
        }
      }
    }
    setDragging(null);
    dragOrigin.current = null;
  };

  const rotateSelected = () => {
    if (!selectedFloor || !selectedItem || isWallDecor(selectedItem)) return;
    const next = toggledOrientation(selectedFloor.orientation);
    const [w, d] = itemSize(selectedItem, next);
    const used = occupancy(layout.floor, itemsById, selectedFloor.instanceId);
    if (!selectedFloor.onTopOf && !isDecal(selectedItem) && !canPlace(selectedFloor.col, selectedFloor.row, w, d, used)) {
      shake(selectedFloor.instanceId);
      return;
    }
    patchLayout({
      ...layout,
      floor: layout.floor.map((entry) => {
        if (entry.instanceId === selectedFloor.instanceId) {
          return { ...entry, orientation: next };
        }
        if (entry.onTopOf === selectedFloor.id || entry.onTopOf === selectedFloor.instanceId) {
          return { ...entry, fx: 1 - (entry.fx ?? 0.5) };
        }
        return entry;
      }),
    });
  };

  const deleteSelected = () => {
    if (!selected) return;
    const hostId = selected.instanceId;
    const hostItemId = selected.id;
    patchLayout({
      ...layout,
      floor: layout.floor
        .filter((entry) => entry.instanceId !== hostId)
        .map((entry) => {
          if (entry.onTopOf === hostId || entry.onTopOf === hostItemId) {
            const host = selectedFloor;
            return {
              ...entry,
              onTopOf: undefined,
              fx: undefined,
              fy: undefined,
              col: host?.col ?? entry.col,
              row: host?.row ?? entry.row,
            };
          }
          return entry;
        }),
      walls: layout.walls.filter((entry) => entry.instanceId !== selected.instanceId),
    });
    setSelectedId(null);
  };

  const startMove = () => {
    if (selectedFloor && !selectedFloor.onTopOf) {
      dragOrigin.current = { ...selectedFloor };
      setDragging({
        kind: "floor",
        instanceId: selectedFloor.instanceId,
        col: selectedFloor.col,
        row: selectedFloor.row,
      });
      return;
    }
    if (selectedWall && selectedItem) {
      const slot = resolvedWallSlot(selectedItem, selectedWall);
      dragOrigin.current = { ...selectedWall };
      setDragging({
        kind: "wall",
        instanceId: selectedWall.instanceId,
        wall: selectedWall.wall,
        slot: slot.slot,
        band: slot.band,
      });
    }
  };

  const sendToOtherWall = () => {
    if (!selectedWall || !selectedItem) return;
    const other: "L" | "R" = selectedWall.wall === "L" ? "R" : "L";
    const current = resolvedWallSlot(selectedItem, selectedWall);
    const used = wallOccupancy(layout.walls, itemsById, selectedWall.instanceId);
    const target = canPlaceWall(selectedItem, other, current.slot, current.band, used)
      ? wallPlaceFromSlot(selectedItem, other, current.slot, current.band)
      : firstFreeOnWall(
          selectedItem,
          layout.walls.filter((entry) => entry.instanceId !== selectedWall.instanceId),
          itemsById,
          other,
        );
    if (!target) {
      shake(selectedWall.instanceId);
      return;
    }
    patchLayout({
      ...layout,
      walls: layout.walls.map((entry) =>
        entry.instanceId === selectedWall.instanceId ? { ...entry, ...target, worldPx: undefined } : entry,
      ),
    });
    setActiveWall(other);
  };

  const pickDrawerItem = (item: RoomItem) => {
    if ((state.owned[item.id] ?? 0) < 1) {
      if (item.attendanceOnly) {
        showToast("출석 체크에서만 받을 수 있어요");
        return;
      }
      setBuyItem(item);
      return;
    }
    if (isPaintItem(item)) {
      setBrushId(item.id);
      setEraser(false);
      setSelectedId(null);
      return;
    }
    const remaining = (state.owned[item.id] ?? 0) - placedCountAll(state, item.id);
    const existingHere =
      layout.floor.find((place) => place.id === item.id) ?? layout.walls.find((place) => place.id === item.id);
    if (remaining <= 0) {
      if (existingHere) {
        setSelectedId(existingHere.instanceId);
        return;
      }
      showToast("다른 방에 배치 중");
      return;
    }
    if (isWallDecor(item)) {
      const slot = firstFreeOnWall(item, layout.walls, itemsById, activeWall);
      if (!slot) {
        showToast("걸 자리가 없어요");
        return;
      }
      const instanceId = newInstanceId(item.id);
      const draft: WallPlacement = {
        instanceId,
        id: item.id,
        wall: slot.wall,
        t: slot.t,
        heightUnits: slot.heightUnits,
        slot: slot.slot,
        band: slot.band,
      };
      patchLayout({
        ...layout,
        walls: [...layout.walls, draft],
      });
      setSelectedId(instanceId);
      setActiveWall(slot.wall);
      return;
    }
    const spot = firstFreeTile(item, "default", layout.floor, itemsById);
    if (!spot) {
      showToast("놓을 칸이 없어요");
      return;
    }
    const instanceId = newInstanceId(item.id);
    patchLayout({
      ...layout,
      floor: [
        ...layout.floor,
        { instanceId, id: item.id, col: spot.col, row: spot.row, orientation: "default" },
      ],
    });
    setSelectedId(instanceId);
    void haptic("tap");
  };

  const buy = (item: RoomItem) => {
    if (item.attendanceOnly) {
      showToast("출석 한정 아이템은 구매할 수 없어요");
      setBuyItem(null);
      return;
    }
    if (state.points < item.price) return;
    const nextPoints = state.points - item.price;
    persist({
      ...state,
      points: nextPoints,
      owned: { ...state.owned, [item.id]: (state.owned[item.id] ?? 0) + 1 },
    });
    void import("../lib/roomEconomy").then(({ spendRoomPoints }) => spendRoomPoints(nextPoints));
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
  const hudPlace =
    dragging?.kind === "wall" && selectedWall && selectedItem
      ? {
          ...selectedWall,
          ...wallPlaceFromSlot(selectedItem, dragging.wall, dragging.slot, dragging.band),
          worldPx: undefined,
        }
      : selected;
  const hud =
    selectedItem && hudPlace ? selectionHud(selectedItem, hudPlace, layout, itemsById, screen) : null;

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

      {mode === "view" ? (
        <header className="lucky-header">
          <div className="lucky-title-row">
            <button type="button" className="lucky-back" onClick={onBack} aria-label="뒤로 가기">
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M15 5l-7 7 7 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <p className="lucky-eyebrow">방꾸미기</p>
          </div>
          <img className="lucky-logo" src={roomAsset("ui/logo-myroom.svg")} alt="MY ROOM." />
          <div className="lucky-meta">
            <strong id="cozy-meter">COZY Lv.{state.cozyLevel}</strong>
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
            id="room-done"
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

      <button
        type="button"
        className={`lucky-shadow-toggle ${state.shadowsEnabled ? "is-on" : ""}`}
        aria-pressed={state.shadowsEnabled}
        onClick={() => persist({ ...state, shadowsEnabled: !state.shadowsEnabled })}
      >
        그림자 {state.shadowsEnabled ? "켜짐" : "꺼짐"}
      </button>

      {mode === "view" ? (
        <div
          className="lucky-switcher"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <div className="lucky-room-chip">
            <button type="button" aria-label="이전 방" onClick={() => goToUnlocked(currentIndex - 1)}>
              ‹
            </button>
            <span>{roomDef.nameKo}</span>
            <button type="button" aria-label="다음 방" onClick={() => goToUnlocked(currentIndex + 1)}>
              ›
            </button>
          </div>
          <div className="lucky-room-pager">
            {unlockedIds.map((id, index) => (
              <button
                key={id}
                type="button"
                className={`lucky-room-dot ${index === currentIndex ? "is-on" : ""}`}
                aria-label={roomById(roomsFile.rooms, id)?.nameKo ?? id}
                onClick={() => goToUnlocked(index)}
              />
            ))}
            <button
              type="button"
              className="lucky-new-room"
              onClick={() => setUnlockRoom(lockedRooms[0] ?? "soon")}
            >
              <img src={roomAsset("ui/icon-lock.svg")} alt="" />
              + 새 방
            </button>
          </div>
        </div>
      ) : null}

      <div
        className="lucky-island-port"
        onPointerDown={mode === "view" ? onSwipeDown : undefined}
        onPointerMove={mode === "view" ? onSwipeMove : undefined}
        onPointerUp={mode === "view" ? onSwipeUp : undefined}
        onPointerCancel={mode === "view" ? onSwipeUp : undefined}
      >
        <div
          className={`lucky-island-slider ${dragX ? "is-dragging" : ""}`}
          style={{
            transform: `translate3d(${mode === "view" ? -currentIndex * VIEW_W + dragX : 0}px, 0, 0)`,
          }}
        >
          {(mode === "edit" ? [state.currentRoomId] : unlockedIds).map((roomId, index) => {
            const roomLayout = state.rooms[roomId];
            if (!roomLayout) return null;
            const active = roomId === state.currentRoomId;
            return (
              <div
                key={roomId}
                className="lucky-island-page"
                style={{ left: mode === "view" ? index * VIEW_W : 0 }}
              >
                <div
                  className={`lucky-island ${mode === "view" ? "is-float" : ""}`}
                  style={{
                    left: screen.left,
                    top: screen.top,
                    width: screen.width,
                    height: screen.height,
                    pointerEvents: active ? "auto" : "none",
                  }}
                >
                  <div className="lucky-island-scale" style={{ transform: `scale(${screen.scale})` }}>
                    <RoomWorld
                      mode={active ? mode : "view"}
                      roomId={roomId}
                      roamingCatId={roomLayout.roamingCatId}
                      roamingActive={active}
                      itemsById={itemsById}
                      layout={roomLayout}
                      selectedId={active && !paintTab ? selectedId : null}
                      dragging={active && !paintTab ? dragging : null}
                      hints={active && !paintTab ? hints : null}
                      frameThumbs={frameThumbs}
                      shakeId={active ? shakeId : null}
                      shadowsEnabled={state.shadowsEnabled}
                      painting={active && paintTab}
                      paintHover={active && paintTab ? paintHover : null}
                      onSelect={onSelect}
                      onItemPointerDown={onItemPointerDown}
                      onFloorPointerDown={onFloorPointerDown}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {mode === "edit" && paintTab && paintHover ? (
        <div
          className="lucky-paint-hud"
          style={{
            left: screen.left + paintTargetAnchor(paintHover).x * screen.scale,
            top: screen.top + paintTargetAnchor(paintHover).y * screen.scale,
          }}
        >
          <span>{paintTargetLabel(paintHover, brushId ? itemsById.get(brushId) : null)}</span>
          <i className="lucky-paint-pencil" aria-hidden="true">
            <img src={roomAsset("ui/icon-brush.svg")} alt="" />
          </i>
        </div>
      ) : null}

      {mode === "edit" && hud && selectedItem && selected && !paintTab ? (
        <div
          className="lucky-select-hud"
          style={{ left: hud.left, top: hud.top, width: hud.width, height: hud.height }}
        >
          <div className="lucky-select-box">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="lucky-mini-toolbar">
            <button type="button" aria-label="이동" onClick={startMove}>
              <img src={roomAsset("ui/icon-move.svg")} alt="" />
            </button>
            {selectedWall ? (
              <button type="button" aria-label="반대쪽 벽으로 보내기" onClick={sendToOtherWall}>
                <img src={roomAsset("ui/icon-flip.svg")} alt="" />
              </button>
            ) : (
              <>
                <button type="button" aria-label="회전" onClick={rotateSelected}>
                  <img src={roomAsset("ui/icon-rotate.svg")} alt="" />
                </button>
                <button type="button" aria-label="뒤집기" onClick={rotateSelected}>
                  <img src={roomAsset("ui/icon-flip.svg")} alt="" />
                </button>
              </>
            )}
            <button type="button" className="is-delete" aria-label="삭제" onClick={deleteSelected}>
              <img src={roomAsset("ui/icon-delete.svg")} alt="" />
            </button>
          </div>
          <span className="lucky-select-tag">
            {selectedItem.nameKo} ·{" "}
            {selectedFloor
              ? itemSize(selectedItem, selectedFloor.orientation).join("×")
              : `${(dragging?.kind === "wall" ? dragging.wall : selectedWall?.wall) === "R" ? "오른쪽 벽" : "왼쪽 벽"}`}
          </span>
        </div>
      ) : null}

      {mode === "view" ? (
        <>
          <p className="lucky-hint">
            {ROOM_HINTS[roomDef.id]?.lead ? <span>{ROOM_HINTS[roomDef.id].lead}</span> : null}
            {ROOM_HINTS[roomDef.id]?.rest ?? roomDef.hint}
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
          onTab={(next) => {
            setTab(next);
            if (next === "벽지" || next === "바닥") {
              setSelectedId(null);
              setDragging(null);
              const ownedPaint = items.find(
                (item) =>
                  (next === "벽지"
                    ? item.category === "벽지" || item.placement === "wallpaper"
                    : item.category === "바닥" || item.placement === "floor-skin") && (state.owned[item.id] ?? 0) > 0,
              );
              if (ownedPaint && (!brushId || itemsById.get(brushId)?.category !== next)) {
                setBrushId(ownedPaint.id);
              }
              setEraser(false);
            } else {
              setPaintHover(null);
            }
          }}
          themeFilter={themeFilter}
          onThemeFilter={setThemeFilter}
          items={items}
          layout={layout}
          owned={state.owned}
          points={state.points}
          selectedId={selectedId}
          brushId={brushId}
          fillMode={fillMode}
          eraser={eraser}
          canUndo={undoStack.length > 0}
          otherRoomIds={otherRoomIds}
          onPick={pickDrawerItem}
          onFillMode={(next) => {
            setFillMode(next);
            setEraser(false);
          }}
          onEraser={() => setEraser((value) => !value)}
          onUndo={undoPaint}
          onExchange={() => void openExchange()}
        />
      )}

      {buyItem ? (
        <RoomBuySheet item={buyItem} points={state.points} onClose={() => setBuyItem(null)} onBuy={() => buy(buyItem)} />
      ) : null}

      {confirm === "reset" ? (
        <RoomConfirm
          title="이 방을 처음 상태로 되돌릴까요?"
          body="지금 보고 있는 방만 기본 배치로 돌아가요. 산 아이템은 그대로 있어요."
          cancel="취소"
          confirm="초기화"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            persist(patchCurrentRoom(state, defaultRecord(roomDef, grid ?? undefined)));
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
            if (snapshot) persist(patchCurrentRoom(state, snapshot));
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

      {unlockRoom ? (
        <RoomUnlockSheet
          room={unlockRoom === "soon" ? null : unlockRoom}
          onClose={() => setUnlockRoom(null)}
        />
      ) : null}

      {exchangeOpen ? (
        <RoomExchangeSheet
          cards={dupes}
          onClose={() => setExchangeOpen(false)}
          onConfirm={(picks) => {
            const gained = dupes.reduce((sum, row) => {
              const n = picks[row.card.id] ?? 0;
              const rate =
                row.card.type === "legend"
                  ? 150
                  : row.card.type === "special" || row.card.type === "character"
                    ? 60
                    : (row.card.stars ?? 0) >= 4
                      ? 30
                      : 10;
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
  place: FloorPlacement | WallPlacement,
  layout: RoomLayoutState,
  byId: Map<string, RoomItem>,
  screen: { scale: number; left: number; top: number },
) {
  const pad = 6;
  const rect =
    "col" in place ? spriteRect(item, place, layout.floor, byId) : wallSpriteRect(item, place);
  return {
    left: screen.left + rect.x * screen.scale - pad,
    top: screen.top + rect.y * screen.scale - pad,
    width: rect.w * screen.scale + pad * 2,
    height: rect.h * screen.scale + pad * 2,
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
