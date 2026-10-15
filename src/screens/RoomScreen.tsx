import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";

import { RoomBuySheet, RoomConfirm, RoomUnlockSheet } from "../components/RoomDialogs";
import { NyChip } from "../components/NyChip";
import { nyConfirm, nyNotify } from "../lib/nyangNotify";
import { RoomDrawer, type DrawerItemMeta } from "../components/RoomDrawer";
import { RoomWorld } from "../components/RoomWorld";
import { dexAsset, loadDexCatalog } from "../lib/dexCatalog";
import { loadDexOwned } from "../lib/dexCollection";
import { AudioManager } from "../audio/AudioManager";
import { haptic } from "../lib/native";
import { loadOpsConfig } from "../lib/opsConfig";
import {
  isPaintItem,
  isPlaceableDecor,
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
import { applyOpsPrices, spendRoomPoints, syncRoomSaveWithOps } from "../lib/roomEconomy";
import {
  cloneLayout,
  hitTestPaint,
  hitTestTile,
  hitTestWall,
  isWallDecor,
  nearestHints,
  screenOf,
  snapWallHit,
  spriteRect,
  toggledOrientation,
  wallPlaceFromSlot,
  wallSpriteRect,
  resolvedWallSlot,
} from "../lib/roomLayout";
import {
  currentRoom,
  defaultRecord,
  loadRoomState,
  patchCurrentRoom,
  placedInOtherRoom,
  saveRoomState,
} from "../lib/roomStore";
import {
  clearFurnitureToDrawer,
  commitPlacement,
  findPaintPreviewTarget,
  maxOwnForItem,
  maxOwnForItemSync,
  newRequestId,
  PREVIEW_GHOST_LIFT_PT,
  putBackToDrawer,
  remainingCount,
  startFloorPreviewFromDrawer,
  startWallPreviewFromDrawer,
  validateFloorPreview,
  validateWallPreview,
  type PlacementPreview,
} from "../lib/roomPlacement";
import { paintTargetLabel } from "../lib/roomTiles";
import type { OpsEconomy, PriceTier } from "../lib/opsTypes";
import type {
  FloorPlacement,
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

/** `drag` is kept as an alias of `preview` for older tutorial callers. */
export type RoomTutorialPhase = "pick" | "preview" | "drag" | "done" | "points" | null;

type RoomScreenProps = {
  onBack: () => void;
  tutorialActive?: boolean;
  tutorialPhase?: RoomTutorialPhase;
  suggestTile?: { c: number; r: number } | null;
  reduceMotion?: boolean;
  onTutorialPicked?: () => void;
  onTutorialPlaced?: () => void;
  onTutorialComplete?: () => void;
  /** Fires once when catalog/layout/ops are ready (after loading gate). */
  onReady?: () => void;
};

function formatPoints(value: number) {
  return value.toLocaleString("en-US");
}

export function RoomScreen({
  onBack,
  tutorialActive = false,
  tutorialPhase = null,
  suggestTile = null,
  reduceMotion = false,
  onTutorialPicked,
  onTutorialPlaced,
  onTutorialComplete,
  onReady,
}: RoomScreenProps) {
  const [items, setItems] = useState<RoomItem[]>([]);
  const [grid, setGrid] = useState<RoomGridFile | null>(null);
  const [roomsFile, setRoomsFile] = useState<RoomsFile | null>(null);
  const [state, setState] = useState<RoomSaveState | null>(null);
  const [economyRooms, setEconomyRooms] = useState<OpsEconomy["rooms"]>([]);
  const [itemTiers, setItemTiers] = useState<Record<string, PriceTier>>({});
  const [starterDrawerIds, setStarterDrawerIds] = useState<string[]>([]);
  const [themeFilter, setThemeFilter] = useState<RoomThemeFilter>("all");
  const [unlockRoom, setUnlockRoom] = useState<RoomDefinition | null | "soon">(null);
  const [dragX, setDragX] = useState(0);
  const [viewW, setViewW] = useState(VIEW_W);
  const portRef = useRef<HTMLDivElement | null>(null);
  const [frameThumbs, setFrameThumbs] = useState<string[]>([]);
  const [mode, setMode] = useState<RoomMode>(() =>
    new URLSearchParams(window.location.search).get("edit") || tutorialActive ? "edit" : "view",
  );
  const [tab, setTab] = useState<RoomTab>(tutorialActive ? "보유" : "가구");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RoomLayoutState | null>(null);
  const [buyItem, setBuyItem] = useState<RoomItem | null>(null);
  const [buyMore, setBuyMore] = useState(false);
  const [confirm, setConfirm] = useState<
    "reset" | "discard" | "close-edit" | "save-ph" | "clear-furniture" | null
  >(null);
  const [dragging, setDragging] = useState<RoomDrag | null>(null);
  const [preview, setPreview] = useState<PlacementPreview | null>(null);
  /** Furniture preview HUD: name/reason message XOR edit toolbar (never both). */
  const [previewHudMode, setPreviewHudMode] = useState<"message" | "toolbar">("message");
  const [committing, setCommitting] = useState(false);
  const [placeFxId, setPlaceFxId] = useState<string | null>(null);
  // Treat null phase as pick when tutorial is active (resume / first paint).
  const effectiveTutPhase =
    tutorialActive && tutorialPhase == null ? "pick" : tutorialPhase;
  const tutPreviewPhase =
    effectiveTutPhase === "preview" || effectiveTutPhase === "drag";
  const tutLock = Boolean(
    tutorialActive && (effectiveTutPhase === "pick" || tutPreviewPhase),
  );
  const [activeWall, setActiveWall] = useState<"L" | "R">("L");
  const [brushId, setBrushId] = useState<string | null>(null);
  const [paintHover, setPaintHover] = useState<PaintTarget | null>(null);
  /** One-step undo for last confirm / put-back / fill-all / clear-furniture. */
  const [editUndo, setEditUndo] = useState<RoomSaveState | null>(null);
  const [stars] = useState(() => makeStars());
  const previewRef = useRef<PlacementPreview | null>(null);
  const previewMoving = useRef(false);
  const previewHudModeRef = useRef<"message" | "toolbar">("message");
  const previewItemTap = useRef<{ instanceId: string; x: number; y: number } | null>(null);
  const previewKeyRef = useRef<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const swipe = useRef({ x: 0, y: 0, dx: 0, active: false });
  const itemsById = useMemo(() => itemMap(items), [items]);
  const paintTab = tab === "벽지" || tab === "바닥";

  useEffect(() => {
    previewRef.current = preview;
  }, [preview]);

  useEffect(() => {
    previewHudModeRef.current = previewHudMode;
  }, [previewHudMode]);

  useEffect(() => {
    const key = !preview
      ? null
      : preview.kind === "paint"
        ? `paint:${preview.itemId}`
        : `${preview.kind}:${preview.instanceId}:${preview.origin}`;
    if (key === previewKeyRef.current) return;
    previewKeyRef.current = key;
    // Always start with the edit toolbar so ✓ / ✕ stay reachable.
    // Name/reason chips stay mutually exclusive (hidden while toolbar is open).
    setPreviewHudMode(preview ? "toolbar" : "message");
  }, [preview]);

  useEffect(() => {
    void Promise.all([loadRoomCatalog(), loadRoomGrid(), loadRoomsFile(), loadOpsConfig()]).then(
      async ([catalog, gridFile, rooms, config]) => {
        const priced = await applyOpsPrices(catalog.items);
        setItems(priced);
        setGrid(gridFile);
        setRoomsFile(rooms);
        setEconomyRooms(config.economy.rooms ?? []);
        setItemTiers(
          Object.fromEntries(
            (config.prices.items ?? []).map((row) => [row.id, row.tier]),
          ) as Record<string, PriceTier>,
        );
        setStarterDrawerIds(config.starter.drawer ?? []);
        const loaded = await loadRoomState(priced, rooms, gridFile);
        const synced = await syncRoomSaveWithOps(loaded);
        setState(synced);
        if (
          synced.currentRoomId !== loaded.currentRoomId ||
          synced.unlocked.join() !== loaded.unlocked.join() ||
          synced.points !== loaded.points ||
          synced.cozyLevel !== loaded.cozyLevel
        ) {
          void saveRoomState(synced);
        }
      },
    );
    void Promise.all([loadDexCatalog(), loadDexOwned()]).then(([catalog, owned]) => {
      const thumbs = catalog.cards
        .filter((card) => (owned[card.id]?.count ?? 0) > 0)
        .slice(0, 3)
        .map((card) => dexAsset(card.thumb));
      setFrameThumbs(thumbs);
    });
  }, []);

  const readySent = useRef(false);
  useEffect(() => {
    if (!state || !roomsFile || readySent.current) return;
    readySent.current = true;
    onReady?.();
  }, [state, roomsFile, onReady]);

  // Keep room carousel page width in sync with the real viewport (Toss chrome ≠ 390).
  useEffect(() => {
    const el = portRef.current;
    if (!el) return;
    const apply = () => {
      const w = Math.round(el.clientWidth);
      if (w > 0) setViewW(w);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [Boolean(state && roomsFile)]);

  // If unlocks changed (ops sync), snap currentRoomId back onto an unlocked room.
  useEffect(() => {
    if (!state || !roomsFile) return;
    const unlocked = roomsFile.switcher.order.filter((id) => state.unlocked.includes(id) && state.rooms[id]);
    if (!unlocked.length || unlocked.includes(state.currentRoomId)) return;
    const nextId = unlocked[0];
    const next = { ...state, currentRoomId: nextId };
    setState(next);
    void saveRoomState(next);
  }, [state, roomsFile]);

  useEffect(() => {
    if (!tutorialActive || !state) return;
    setTab("보유");
    setMode((prev) => {
      if (prev === "edit") return prev;
      setSnapshot(cloneLayout(currentRoom(state)));
      setSelectedId(null);
      return "edit";
    });
    // Free starter drawer placeables (e.g. cushions) so #drawer-item-0 can target NEW.
    // Reuse starterDrawerIds from the initial load (avoid a second loadOpsConfig wait).
    if (!starterDrawerIds.length) return;
    const gifts = new Set(starterDrawerIds);
    setState((prev) => {
      if (!prev) return prev;
      const room = currentRoom(prev);
      const nextFloor = room.floor.filter((place) => {
        const item = itemsById.get(place.id);
        if (!item || !gifts.has(place.id)) return true;
        return !isPlaceableDecor(item);
      });
      if (nextFloor.length === room.floor.length) return prev;
      const next = patchCurrentRoom(prev, { ...room, floor: nextFloor });
      void saveRoomState(next);
      return next;
    });
  }, [tutorialActive, state?.currentRoomId, itemsById, starterDrawerIds]);

  const showToast = (message: string, kind: "success" | "reward" | "info" | "error" = "info") => {
    nyNotify({ key: `room:${message.slice(0, 28)}`, kind, title: message.replace(/\n/g, " · ") });
  };

  const persist = (next: RoomSaveState) => {
    setState(next);
    void saveRoomState(next);
  };

  /** Update layout in React state without persisting (preview drafts). */
  const patchLayoutLocal = (nextLayout: RoomLayoutState) => {
    if (!state) return;
    setState(patchCurrentRoom(state, nextLayout));
  };

  const syncDragFromPreview = (next: PlacementPreview | null) => {
    if (!next || next.kind === "paint") {
      setDragging(null);
      return;
    }
    if (next.kind === "floor") {
      setDragging({
        kind: "floor",
        instanceId: next.instanceId,
        col: next.col,
        row: next.row,
      });
      return;
    }
    setDragging({
      kind: "wall",
      instanceId: next.instanceId,
      wall: next.wall,
      slot: next.slot,
      band: next.band,
    });
  };

  if (!state || !roomsFile) {
    return <div className="lucky-room is-loading">방을 불러오는 중이에요.</div>;
  }

  const unlockedIds = roomsFile.switcher.order.filter((id) => state.unlocked.includes(id) && state.rooms[id]);
  // Keep label/hint/roaming tied to a room that is actually unlocked & shown.
  const displayRoomId = unlockedIds.includes(state.currentRoomId)
    ? state.currentRoomId
    : (unlockedIds[0] ?? state.currentRoomId);
  const layout = state.rooms[displayRoomId] ?? currentRoom(state);
  const roomDef = roomById(roomsFile.rooms, displayRoomId) ?? roomsFile.rooms[0];
  const lockedRooms = roomsFile.rooms.filter((room) => !state.unlocked.includes(room.id));
  const currentIndex = Math.max(0, unlockedIds.indexOf(displayRoomId));
  const otherRoomIds = Object.fromEntries(items.map((item) => [item.id, placedInOtherRoom(state, item.id)]));
  const suggestItemId =
    tutorialActive && suggestTile
      ? items
          .filter((item) => (state.owned[item.id] ?? 0) > 0 && isPlaceableDecor(item))
          .find((item) => {
            const placedHere =
              layout.floor.some((place) => place.id === item.id) ||
              layout.walls.some((place) => place.id === item.id);
            const other = Boolean(otherRoomIds[item.id]) && !placedHere;
            return !placedHere && !other;
          })?.id ?? "cushions"
      : null;
  const unlockFor = (roomId: string) => economyRooms.find((row) => row.id === roomId)?.unlock;
  const drawerItemMeta: Record<string, DrawerItemMeta> = Object.fromEntries(
    items.map((item) => {
      const ownedN = state.owned[item.id] ?? 0;
      const rem = isPaintItem(item) ? ownedN : remainingCount(state, item.id);
      const otherId = placedInOtherRoom(state, item.id);
      const otherName = otherId ? (roomById(roomsFile.rooms, otherId)?.nameKo ?? "다른 방") : null;
      const maxOwn = maxOwnForItemSync(item, itemTiers[item.id]);
      return [
        item.id,
        {
          remaining: rem,
          owned: ownedN,
          otherRoomName: otherName,
          canBuyMore: !item.attendanceOnly && !isPaintItem(item) && ownedN < maxOwn,
        } satisfies DrawerItemMeta,
      ];
    }),
  );
  const placedCount = layout.floor.length + layout.walls.length;
  const selected =
    layout.floor.find((item) => item.instanceId === selectedId) ??
    layout.walls.find((item) => item.instanceId === selectedId);
  const selectedItem = selected ? itemsById.get(selected.id) : undefined;
  const selectedFloor = selected && "col" in selected ? selected : null;
  const hints =
    mode === "edit" && selectedFloor && selectedItem && !selectedFloor.onTopOf && !isWallDecor(selectedItem)
      ? nearestHints(selectedItem, selectedFloor.orientation, layout.floor, itemsById, selectedId ?? undefined)
      : null;

  const enterEdit = () => {
    setSnapshot(cloneLayout(layout));
    setMode("edit");
    setSelectedId(null);
    setEditUndo(null);
    setPreview(null);
    setDragging(null);
    void haptic("tap");
  };

  const cancelPreview = (layoutNow: RoomLayoutState = layout) => {
    const current = previewRef.current;
    if (!current) {
      setPreview(null);
      setDragging(null);
      return layoutNow;
    }
    let nextLayout = layoutNow;
    if (current.kind === "floor") {
      if (current.origin === "placed" && current.originFloor) {
        nextLayout = {
          ...nextLayout,
          floor: nextLayout.floor.map((entry) =>
            entry.instanceId === current.instanceId ? { ...current.originFloor! } : entry,
          ),
        };
      } else if (current.origin === "drawer" || current.origin === "move-from") {
        nextLayout = {
          ...nextLayout,
          floor: nextLayout.floor.filter((entry) => entry.instanceId !== current.instanceId),
        };
      }
    } else if (current.kind === "wall") {
      if (current.origin === "placed" && current.originWall) {
        nextLayout = {
          ...nextLayout,
          walls: nextLayout.walls.map((entry) =>
            entry.instanceId === current.instanceId ? { ...current.originWall! } : entry,
          ),
        };
      } else if (current.origin === "drawer" || current.origin === "move-from") {
        nextLayout = {
          ...nextLayout,
          walls: nextLayout.walls.filter((entry) => entry.instanceId !== current.instanceId),
        };
      }
    }
    // Paint previews are visual-only (paintHover) until ✓.
    setPreview(null);
    previewRef.current = null;
    setDragging(null);
    setSelectedId(null);
    setPaintHover(null);
    return nextLayout;
  };

  const leaveEdit = (saved: boolean) => {
    // Spec: unfinished preview is cancelled when leaving edit.
    // Done path persists a cancelled layout first; discard restores snapshot — only clear refs here.
    if (previewRef.current && saved) {
      // already cancelled+persisted by the 완료 handler when needed
    } else if (previewRef.current) {
      previewRef.current = null;
      setPreview(null);
    }
    setMode("view");
    setSelectedId(null);
    setDragging(null);
    setPreview(null);
    setSnapshot(null);
    setPaintHover(null);
    setEditUndo(null);
    if (saved) nyNotify({ key: "room-save", kind: "success", title: "방을 저장했어요", sub: roomDef?.nameKo });
  };

  const applyEditUndo = () => {
    if (!editUndo) return;
    persist(editUndo);
    setEditUndo(null);
    setPreview(null);
    previewRef.current = null;
    setDragging(null);
    setSelectedId(null);
    setPaintHover(null);
    showToast("되돌렸어요");
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

  /** Sample point under the ghost (finger is PREVIEW_GHOST_LIFT_PT below the sprite). */
  const pointerUnderGhost = (clientX: number, clientY: number, rect: DOMRect) => ({
    localX: clientX - rect.left,
    localY: clientY - rect.top - PREVIEW_GHOST_LIFT_PT,
  });

  const moveFloorPreviewTo = (col: number, row: number, base: PlacementPreview & { kind: "floor" }) => {
    const item = itemsById.get(base.itemId);
    if (!item) return;
    const check = validateFloorPreview(
      item,
      col,
      row,
      base.orientation,
      layout.floor,
      itemsById,
      base.instanceId,
    );
    const next: PlacementPreview = { ...base, col, row, valid: check.valid, reason: check.reason };
    setPreview(next);
    previewRef.current = next;
    syncDragFromPreview(next);
    patchLayoutLocal({
      ...layout,
      floor: layout.floor.map((entry) =>
        entry.instanceId === base.instanceId ? { ...entry, col, row, orientation: base.orientation } : entry,
      ),
    });
  };

  const moveWallPreviewTo = (
    wall: "L" | "R",
    slot: number,
    band: number,
    base: PlacementPreview & { kind: "wall" },
  ) => {
    const item = itemsById.get(base.itemId);
    if (!item) return;
    const check = validateWallPreview(item, wall, slot, band, layout.walls, itemsById, base.instanceId);
    const coords = wallPlaceFromSlot(item, wall, slot, band);
    const next: PlacementPreview = {
      ...base,
      wall,
      slot,
      band,
      t: coords.t,
      heightUnits: coords.heightUnits,
      valid: check.valid,
      reason: check.reason,
    };
    setPreview(next);
    previewRef.current = next;
    syncDragFromPreview(next);
    setActiveWall(wall);
    patchLayoutLocal({
      ...layout,
      walls: layout.walls.map((entry) =>
        entry.instanceId === base.instanceId ? { ...entry, ...coords, worldPx: undefined } : entry,
      ),
    });
  };

  const movePaintPreviewTo = (target: PaintTarget, base: PlacementPreview & { kind: "paint" }) => {
    const type = base.itemId.replace(/^(floor_|wall_)/, "");
    let valid = true;
    let reason: string | null = null;
    if (base.fillAll) {
      // fill-all validity comes from whether any tile differs
      const found = findPaintPreviewTarget(
        itemsById.get(base.itemId)!,
        layout.floorTiles,
        layout.wallTiles,
      );
      valid = found.valid;
      reason = found.reason;
    } else if (target.kind === "floor") {
      if (layout.floorTiles[target.row]?.[target.col] === type) {
        valid = false;
        reason = "이미 같은 바닥이 깔려 있어요";
      }
    } else if (layout.wallTiles[target.wall][target.index] === type) {
      valid = false;
      reason = "이미 같은 벽지가 깔려 있어요";
    }
    const next: PlacementPreview = { ...base, target, valid, reason };
    setPreview(next);
    previewRef.current = next;
    setPaintHover(target);
  };

  const onFloorPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (mode !== "edit") return;
    if ((event.target as HTMLElement).closest(".lucky-sprite")) return;

    // Preview active: tap empty tile moves preview (furniture) or paint target.
    if (preview && !tutLock) {
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) return;
      // Tap-to-move uses the tapped tile directly; drag uses ghost-offset sampling.
      const localX = event.clientX - rect.left;
      const localY = event.clientY - rect.top;
      if (preview.kind === "floor") {
        const tile = hitTestTile(localX, localY, mode);
        moveFloorPreviewTo(tile.col, tile.row, preview);
        previewMoving.current = true;
        try {
          stageRef.current?.setPointerCapture(event.pointerId);
        } catch {
          // ignore
        }
        return;
      }
      if (preview.kind === "paint" && preview.paintKind === "floor") {
        const tile = hitTestTile(localX, localY, mode);
        movePaintPreviewTo({ kind: "floor", col: tile.col, row: tile.row }, preview);
        previewMoving.current = true;
        try {
          stageRef.current?.setPointerCapture(event.pointerId);
        } catch {
          // ignore
        }
        return;
      }
      if (preview.kind === "paint" && preview.paintKind === "wall") {
        const target = hitTestPaint(localX, localY, mode, "wall");
        if (target?.kind === "wall") movePaintPreviewTo(target, preview);
        previewMoving.current = true;
        try {
          stageRef.current?.setPointerCapture(event.pointerId);
        } catch {
          // ignore
        }
        return;
      }
      if (preview.kind === "wall") {
        const hit = hitTestWall(localX, localY, mode);
        if (hit) {
          const item = itemsById.get(preview.itemId);
          if (item) {
            const snapped = snapWallHit(item, hit);
            moveWallPreviewTo(snapped.wall, snapped.slot, snapped.band, preview);
          }
        }
        previewMoving.current = true;
        try {
          stageRef.current?.setPointerCapture(event.pointerId);
        } catch {
          // ignore
        }
        return;
      }
    }

    if (preview) return;
    setSelectedId(null);
  };

  const beginPreviewFromPlaced = (instanceId: string) => {
    if (tutLock) return;
    const floorPlace = layout.floor.find((item) => item.instanceId === instanceId);
    const wallPlace = layout.walls.find((item) => item.instanceId === instanceId);
    if (floorPlace && !floorPlace.onTopOf) {
      const item = itemsById.get(floorPlace.id);
      if (!item) return;
      const check = validateFloorPreview(
        item,
        floorPlace.col,
        floorPlace.row,
        floorPlace.orientation,
        layout.floor,
        itemsById,
        floorPlace.instanceId,
      );
      const next: PlacementPreview = {
        kind: "floor",
        itemId: floorPlace.id,
        instanceId: floorPlace.instanceId,
        col: floorPlace.col,
        row: floorPlace.row,
        orientation: floorPlace.orientation,
        origin: "placed",
        originFloor: { ...floorPlace },
        valid: check.valid,
        reason: check.reason,
      };
      setPreview(next);
      previewRef.current = next;
      setSelectedId(instanceId);
      syncDragFromPreview(next);
      void haptic("tap");
      return;
    }
    if (wallPlace) {
      const item = itemsById.get(wallPlace.id);
      if (!item) return;
      const slot = resolvedWallSlot(item, wallPlace);
      const check = validateWallPreview(
        item,
        wallPlace.wall,
        slot.slot,
        slot.band,
        layout.walls,
        itemsById,
        wallPlace.instanceId,
      );
      const next: PlacementPreview = {
        kind: "wall",
        itemId: wallPlace.id,
        instanceId: wallPlace.instanceId,
        wall: wallPlace.wall,
        slot: slot.slot,
        band: slot.band,
        t: wallPlace.t,
        heightUnits: wallPlace.heightUnits,
        origin: "placed",
        originWall: { ...wallPlace },
        valid: check.valid,
        reason: check.reason,
      };
      setPreview(next);
      previewRef.current = next;
      setSelectedId(instanceId);
      setActiveWall(wallPlace.wall);
      syncDragFromPreview(next);
      void haptic("tap");
    }
  };

  const onItemPointerDown = (event: PointerEvent<HTMLButtonElement>, instanceId: string) => {
    if (mode !== "edit" || paintTab) return;
    if (tutLock) {
      // Tutorial: only the active preview draft may be interacted with (move locked separately).
      if (!preview || preview.kind === "paint" || preview.instanceId !== instanceId) return;
      return;
    }
    event.stopPropagation();

    // Same preview instance: wait for tap vs drag (message↔toolbar / cancel).
    if (preview && preview.kind !== "paint" && preview.instanceId === instanceId) {
      previewItemTap.current = { instanceId, x: event.clientX, y: event.clientY };
      previewMoving.current = false;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      return;
    }

    // Tap placed item → enter preview (cancel any other preview first).
    if (preview) {
      const cleared = cancelPreview(layout);
      patchLayoutLocal(cleared);
    }
    beginPreviewFromPlaced(instanceId);
  };

  const onStagePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!preview || !stageRef.current || tutLock) return;

    // Promote a press on the preview item into a drag once the finger moves.
    if (previewItemTap.current && preview.kind !== "paint") {
      const dx = event.clientX - previewItemTap.current.x;
      const dy = event.clientY - previewItemTap.current.y;
      if (Math.hypot(dx, dy) > 8) {
        previewMoving.current = true;
        previewItemTap.current = null;
        // Dragging implies toolbar chrome (message alone can't move).
        if (previewHudModeRef.current !== "toolbar") setPreviewHudMode("toolbar");
      }
    }

    if (!previewMoving.current) return;
    const rect = stageRef.current.getBoundingClientRect();
    const { localX, localY } = pointerUnderGhost(event.clientX, event.clientY, rect);
    if (preview.kind === "floor") {
      const tile = hitTestTile(localX, localY, mode);
      if (tile.col === preview.col && tile.row === preview.row) return;
      moveFloorPreviewTo(tile.col, tile.row, preview);
      return;
    }
    if (preview.kind === "wall") {
      const item = itemsById.get(preview.itemId);
      if (!item) return;
      const hit = hitTestWall(localX, localY, mode);
      if (!hit) return;
      const snapped = snapWallHit(item, hit);
      if (snapped.wall === preview.wall && snapped.slot === preview.slot && snapped.band === preview.band) return;
      moveWallPreviewTo(snapped.wall, snapped.slot, snapped.band, preview);
      return;
    }
    if (preview.kind === "paint" && !preview.fillAll) {
      const prefer = preview.paintKind === "floor" ? "floor" : "wall";
      const target =
        prefer === "floor"
          ? (() => {
              const tile = hitTestTile(localX, localY, mode);
              return { kind: "floor" as const, col: tile.col, row: tile.row };
            })()
          : hitTestPaint(localX, localY, mode, "wall");
      if (!target) return;
      movePaintPreviewTo(target, preview);
    }
  };

  const onStagePointerUp = () => {
    // Toolbar open + tap preview item (no drag) → cancel and restore origin.
    if (
      previewItemTap.current &&
      preview &&
      preview.kind !== "paint" &&
      preview.instanceId === previewItemTap.current.instanceId &&
      !previewMoving.current &&
      previewHudModeRef.current === "toolbar"
    ) {
      const cleared = cancelPreview(layout);
      patchLayoutLocal(cleared);
    }
    previewItemTap.current = null;
    previewMoving.current = false;
    window.dispatchEvent(new Event("lucky-cat:drawer-scroll-unlock"));
  };

  const rotatePreview = () => {
    if (!preview || preview.kind !== "floor" || tutLock) return;
    const item = itemsById.get(preview.itemId);
    if (!item || isWallDecor(item)) return;
    const nextOri = toggledOrientation(preview.orientation);
    const check = validateFloorPreview(
      item,
      preview.col,
      preview.row,
      nextOri,
      layout.floor,
      itemsById,
      preview.instanceId,
    );
    const next: PlacementPreview = {
      ...preview,
      orientation: nextOri,
      valid: check.valid,
      reason: check.reason,
    };
    setPreview(next);
    previewRef.current = next;
    syncDragFromPreview(next);
    patchLayoutLocal({
      ...layout,
      floor: layout.floor.map((entry) =>
        entry.instanceId === preview.instanceId ? { ...entry, orientation: nextOri } : entry,
      ),
    });
  };

  const playPlaceFx = (instanceId: string) => {
    AudioManager.playSfx("item-place");
    void haptic("softMedium");
    if (reduceMotion) {
      setPlaceFxId(instanceId);
      window.setTimeout(() => setPlaceFxId(null), 120);
      return;
    }
    setPlaceFxId(instanceId);
    window.setTimeout(() => setPlaceFxId(null), 240);
  };

  const confirmPreview = async () => {
    if (!preview || !preview.valid || committing || !state) return;
    setCommitting(true);
    const before = structuredClone(state);
    const requestId = newRequestId();
    const result = await commitPlacement({
      state,
      roomId: state.currentRoomId,
      preview,
      itemsById,
      requestId,
    });
    setCommitting(false);
    if (!result.ok) {
      const failed: PlacementPreview = { ...preview, valid: false, reason: result.reason };
      setPreview(failed);
      previewRef.current = failed;
      syncDragFromPreview(failed);
      void haptic("softMedium");
      return;
    }
    setEditUndo(before);
    const placedId = preview.kind === "paint" ? null : preview.instanceId;
    setState(result.state);
    setPreview(null);
    previewRef.current = null;
    setDragging(null);
    setSelectedId(null);
    setPaintHover(null);
    setBrushId(null);
    if (placedId) playPlaceFx(placedId);
    else {
      AudioManager.playSfx("item-place");
      void haptic("softMedium");
    }
    if (tutLock || tutorialActive) onTutorialPlaced?.();
  };

  const putPreviewBack = async () => {
    if (!preview || preview.kind === "paint" || preview.origin !== "placed" || !state) return;
    const before = structuredClone(state);
    const result = await putBackToDrawer({
      state,
      roomId: state.currentRoomId,
      instanceId: preview.instanceId,
      requestId: newRequestId("put"),
    });
    if (!result.ok) {
      showToast(result.reason);
      return;
    }
    setEditUndo(before);
    setState(result.state);
    setPreview(null);
    previewRef.current = null;
    setDragging(null);
    setSelectedId(null);
    nyNotify({ key: "room-drawer", kind: "success", title: "서랍에 넣었어요" });
  };

  const togglePaintFillAll = () => {
    if (!preview || preview.kind !== "paint") return;
    const item = itemsById.get(preview.itemId);
    if (!item) return;
    const fillAll = !preview.fillAll;
    const found = findPaintPreviewTarget(item, layout.floorTiles, layout.wallTiles);
    const next: PlacementPreview = {
      ...preview,
      fillAll,
      valid: found.valid,
      reason: found.reason,
      target: fillAll ? preview.target : found.valid ? found.target : preview.target,
    };
    setPreview(next);
    previewRef.current = next;
    setPaintHover(next.target);
  };

  const startPaintPreview = (item: RoomItem, layoutNow: RoomLayoutState = layout) => {
    const found = findPaintPreviewTarget(item, layoutNow.floorTiles, layoutNow.wallTiles);
    const next: PlacementPreview = {
      kind: "paint",
      itemId: item.id,
      paintKind: found.paintKind,
      target: found.target,
      fillAll: false,
      valid: found.valid,
      reason: found.reason,
    };
    setPreview(next);
    previewRef.current = next;
    setBrushId(item.id);
    setSelectedId(null);
    setDragging(null);
    setPaintHover(found.target);
    void haptic("tap");
  };

  const startFurniturePreview = (
    item: RoomItem,
    origin: "drawer" | "move-from" = "drawer",
    fromRoomId?: string,
    layoutNow: RoomLayoutState = layout,
  ) => {
    if (isWallDecor(item)) {
      const next = startWallPreviewFromDrawer(item, layoutNow.walls, itemsById, activeWall);
      const withOrigin: PlacementPreview = { ...next, origin, fromRoomId };
      const draft: WallPlacement = {
        instanceId: next.instanceId,
        id: next.itemId,
        wall: next.wall,
        t: next.t,
        heightUnits: next.heightUnits,
        slot: next.slot,
        band: next.band,
      };
      patchLayoutLocal({ ...layoutNow, walls: [...layoutNow.walls, draft] });
      setPreview(withOrigin);
      previewRef.current = withOrigin;
      setSelectedId(next.instanceId);
      setActiveWall(next.wall);
      syncDragFromPreview(withOrigin);
      void haptic("tap");
      return;
    }
    const prefer =
      tutorialActive && suggestTile ? { col: suggestTile.c, row: suggestTile.r } : null;
    const next = startFloorPreviewFromDrawer(
      item,
      layoutNow.floor,
      itemsById,
      prefer,
      origin,
      fromRoomId,
    );
    const draft: FloorPlacement = {
      instanceId: next.instanceId,
      id: next.itemId,
      col: next.col,
      row: next.row,
      orientation: next.orientation,
    };
    patchLayoutLocal({ ...layoutNow, floor: [...layoutNow.floor, draft] });
    setPreview(next);
    previewRef.current = next;
    setSelectedId(next.instanceId);
    syncDragFromPreview(next);
    void haptic("tap");
  };

  const pickDrawerItem = async (item: RoomItem) => {
    if (tutLock && suggestItemId && item.id !== suggestItemId) return;

    // Open buy sheet first when locked, then clear preview — avoids a wasted
    // first tap that only cancelled placement without showing the shop.
    if ((state.owned[item.id] ?? 0) < 1) {
      if (item.attendanceOnly) {
        showToast("출석 체크에서만 받을 수 있어요");
        return;
      }
      setBuyMore(false);
      setBuyItem(item);
      if (preview) {
        const cleared = cancelPreview(layout);
        patchLayoutLocal(cleared);
      }
      return;
    }

    let layoutNow: RoomLayoutState = layout;
    // Cancel any active preview when picking another drawer item.
    if (preview) {
      layoutNow = cancelPreview(layout);
      patchLayoutLocal(layoutNow);
    }

    if (isPaintItem(item)) {
      startPaintPreview(item, layoutNow);
      if (tutLock) onTutorialPicked?.();
      return;
    }

    const rem = remainingCount(state, item.id);
    if (rem <= 0) {
      const otherId = placedInOtherRoom(state, item.id);
      if (otherId) {
        const otherName = roomById(roomsFile.rooms, otherId)?.nameKo ?? "다른 방";
        showToast(`다른 방에 있어요\n${otherName}`);
        return;
      }
      if (item.attendanceOnly) {
        showToast("한정 아이템이에요");
        return;
      }
      const maxOwn = await maxOwnForItem(item);
      const owned = state.owned[item.id] ?? 0;
      if (owned < maxOwn) {
        setBuyMore(true);
        setBuyItem(item);
        return;
      }
      showToast("더 이상 가질 수 없어요");
      return;
    }

    startFurniturePreview(item, "drawer", undefined, layoutNow);
    if (tutLock) onTutorialPicked?.();
  };

  const moveHereFromOtherRoom = (item: RoomItem) => {
    let layoutNow: RoomLayoutState = layout;
    if (preview) {
      layoutNow = cancelPreview(layout);
      patchLayoutLocal(layoutNow);
    }
    const otherId = placedInOtherRoom(state, item.id);
    if (!otherId) {
      showToast("다른 방에서 찾을 수 없어요");
      return;
    }
    const otherName = roomById(roomsFile.rooms, otherId)?.nameKo ?? "다른 방";
        showToast(`다른 방에 있어요\n${otherName}`);
      startFurniturePreview(item, "move-from", otherId, layoutNow);
    };

  const openBuyMore = (item: RoomItem) => {
    if (item.attendanceOnly) {
      showToast("한정 아이템이에요");
      return;
    }
    setBuyMore(true);
    setBuyItem(item);
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
    void spendRoomPoints(nextPoints);
    setBuyItem(null);
    setBuyMore(false);
    nyNotify({
      key: "room-buy",
      kind: "success",
      title: `${item.nameKo}을 서랍에 넣었어요`,
      action: { label: "놓으러 가기", onClick: () => { /* stay in room edit */ setMode("edit"); } },
    });
  };

  const screen = screenOf(mode);
  const previewItem = preview ? itemsById.get(preview.itemId) : undefined;
  const hudPlace: FloorPlacement | WallPlacement | null =
    preview?.kind === "floor"
      ? {
          instanceId: preview.instanceId,
          id: preview.itemId,
          col: preview.col,
          row: preview.row,
          orientation: preview.orientation,
        }
      : preview?.kind === "wall"
        ? {
            instanceId: preview.instanceId,
            id: preview.itemId,
            wall: preview.wall,
            t: preview.t,
            heightUnits: preview.heightUnits,
            slot: preview.slot,
            band: preview.band,
          }
        : preview?.kind === "paint"
          ? null
          : selected ?? null;
  const rawHud =
    preview?.kind === "paint"
      ? null
      : previewItem && hudPlace
        ? selectionHud(previewItem, hudPlace, layout, itemsById, screen)
        : null;
  // Keep furniture floating toolbar inside the stage; flip below the sprite when it
  // would collide with the top safe/header band, and clamp horizontally.
  const hud = rawHud
    ? (() => {
        const TOOLBAR_H = 52;
        const SAFE_TOP = 96;
        const MARGIN = 8;
        const viewW = typeof window !== "undefined" ? window.innerWidth : 390;
        const flipped = rawHud.top - TOOLBAR_H < SAFE_TOP;
        const width = rawHud.width;
        const left = Math.min(Math.max(MARGIN, rawHud.left), Math.max(MARGIN, viewW - width - MARGIN));
        return { ...rawHud, left, flipped };
      })()
    : null;

  return (
    <div
      className={`lucky-room is-${mode}`}
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
          <button
            type="button"
            className="lucky-ghost"
            onClick={() => {
              void (async () => {
                const ok = await nyConfirm({
                  key: "room-discard",
                  title: "바꾼 내용을 버릴까요?",
                  body: "꾸미기 모드에 들어오기 전 배치로 돌아가요.",
                  cancelLabel: "계속 꾸미기",
                  confirmLabel: "버리기",
                });
                if (!ok) return;
                previewRef.current = null;
                setPreview(null);
                setDragging(null);
                if (snapshot) persist(patchCurrentRoom(state, snapshot));
                leaveEdit(false);
              })();
            }}
          >
            취소
          </button>
          <p>
            <b>EDIT</b>
            <span>꾸미는 중</span>
          </p>
          <div className="lucky-edit-bar-actions">
            <button
              type="button"
              className="lucky-ghost"
              disabled={!editUndo || tutLock}
              onClick={applyEditUndo}
              aria-label="되돌리기"
            >
              ↩
            </button>
            <button
              type="button"
              className="lucky-ghost"
              disabled={tutLock}
              onClick={() => setConfirm("clear-furniture")}
            >
              가구 모두 넣기
            </button>
            <button
              type="button"
              id="room-done"
              className="lucky-done"
              onClick={() => {
                if (tutorialPhase === "done" || tutorialPhase === "points") {
                  onTutorialComplete?.();
                  return;
                }
                if (tutLock) return;
                if (previewRef.current) {
                  const cleared = cancelPreview(layout);
                  const next = patchCurrentRoom(state, cleared);
                  persist(next);
                } else {
                  persist(state);
                }
                leaveEdit(true);
              }}
            >
              완료
            </button>
          </div>
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
            {roomsFile.switcher.order.map((id) => {
              const unlocked = unlockedIds.includes(id);
              const def = roomById(roomsFile.rooms, id);
              if (unlocked) {
                const index = unlockedIds.indexOf(id);
                return (
                  <button
                    key={id}
                    type="button"
                    className={`lucky-room-dot ${index === currentIndex ? "is-on" : ""}`}
                    aria-label={def?.nameKo ?? id}
                    onClick={() => goToUnlocked(index)}
                  />
                );
              }
              const unlock = unlockFor(id);
              const paw = unlock?.paw;
              const cozy = unlock?.cozyLevel;
              if (paw == null && cozy == null) return null;
              return (
                <button
                  key={id}
                  type="button"
                  className="lucky-room-locked"
                  aria-label={`${def?.nameKo ?? id} 잠김`}
                  onClick={() => setUnlockRoom(def ?? "soon")}
                >
                  <img src={roomAsset("ui/icon-lock.svg")} alt="" />
                  <span>
                    {paw != null ? `${paw.toLocaleString("ko-KR")}P` : ""}
                    {paw != null && cozy != null ? " · " : ""}
                    {cozy != null ? `아늑함 Lv.${cozy}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div
        ref={portRef}
        className="lucky-island-port"
        onPointerDown={mode === "view" ? onSwipeDown : undefined}
        onPointerMove={mode === "view" ? onSwipeMove : undefined}
        onPointerUp={mode === "view" ? onSwipeUp : undefined}
        onPointerCancel={mode === "view" ? onSwipeUp : undefined}
      >
        <div
          className={`lucky-island-slider ${dragX ? "is-dragging" : ""}`}
          style={{
            transform: `translate3d(${mode === "view" ? -currentIndex * viewW + dragX : 0}px, 0, 0)`,
          }}
        >
          {(mode === "edit" ? [displayRoomId] : unlockedIds).map((roomId, index) => {
            const roomLayout = state.rooms[roomId];
            if (!roomLayout) return null;
            const active = roomId === displayRoomId;
            return (
              <div
                key={roomId}
                className="lucky-island-page"
                style={{ left: mode === "view" ? index * viewW : 0, width: viewW }}
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
                      shakeId={null}
                      shadowsEnabled={state.shadowsEnabled}
                      painting={active && (paintTab || preview?.kind === "paint")}
                      paintHover={
                        active && (paintTab || preview?.kind === "paint") ? paintHover : null
                      }
                      paintPreview={
                        active && preview?.kind === "paint"
                          ? {
                              itemId: preview.itemId,
                              paintKind: preview.paintKind,
                              target: preview.target,
                              fillAll: preview.fillAll,
                              valid: preview.valid,
                            }
                          : null
                      }
                      suggestTile={
                        active &&
                        tutorialActive &&
                        (effectiveTutPhase === "pick" ||
                          effectiveTutPhase === "preview" ||
                          effectiveTutPhase === "drag" ||
                          !tutorialPhase)
                          ? suggestTile
                          : null
                      }
                      suggestItemId={
                        active &&
                        tutorialActive &&
                        (effectiveTutPhase === "pick" ||
                          effectiveTutPhase === "preview" ||
                          effectiveTutPhase === "drag" ||
                          !tutorialPhase)
                          ? suggestItemId
                          : null
                      }
                      reduceMotion={reduceMotion}
                      placeFxId={placeFxId}
                      previewGhost={Boolean(active && preview && preview.kind !== "paint")}
                      previewInvalid={Boolean(active && preview && !preview.valid)}
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

      {mode === "edit" && preview?.kind === "paint" && previewItem ? (
        <div
          className={`lucky-paint-dock ${preview.valid ? "" : "is-invalid"} ${
            preview.fillAll ? "is-fill-all" : ""
          }`}
          role="toolbar"
          aria-label="벽지·바닥 미리보기"
        >
          <div className="lucky-paint-dock-copy">
            <strong className="lucky-paint-dock-name">{previewItem.nameKo}</strong>
            {!preview.valid && preview.reason ? (
              <div className="ny-chip-placement is-paint">
                <NyChip
                  arrow="down"
                  arrowX={40}
                  action={
                    preview.reason.includes("벽지")
                      ? {
                          label: "다른 벽지 보기",
                          onClick: () => {
                            const cleared = cancelPreview(layout);
                            patchLayoutLocal(cleared);
                            setTab("벽지");
                          },
                        }
                      : preview.reason.includes("바닥")
                        ? {
                            label: "다른 바닥 보기",
                            onClick: () => {
                              const cleared = cancelPreview(layout);
                              patchLayoutLocal(cleared);
                              setTab("바닥");
                            },
                          }
                        : undefined
                  }
                >
                  {preview.reason.includes("벽지")
                    ? "이미 같은 벽지가 깔려 있어요"
                    : preview.reason}
                </NyChip>
              </div>
            ) : (
              <span className="lucky-paint-dock-status">
                {preview.fillAll
                  ? preview.paintKind === "floor"
                    ? "모든 바닥 칸 미리보기"
                    : "모든 벽 칸 미리보기"
                  : paintTargetLabel(preview.target, previewItem)}
              </span>
            )}
          </div>
          <div className="lucky-paint-dock-actions">
            <button
              type="button"
              aria-label="취소"
              disabled={tutLock}
              onClick={() => {
                if (tutLock) return;
                const cleared = cancelPreview(layout);
                patchLayoutLocal(cleared);
              }}
            >
              ✕
            </button>
            <button
              type="button"
              className="is-text"
              disabled={!preview.valid && !preview.fillAll}
              onClick={togglePaintFillAll}
            >
              {preview.fillAll ? "한 칸만" : "전체 바꾸기"}
            </button>
            <button
              type="button"
              id="placement-confirm"
              className="is-confirm"
              aria-label="확정"
              disabled={!preview.valid || committing}
              onClick={() => void confirmPreview()}
            >
              ✓
            </button>
          </div>
        </div>
      ) : null}

      {mode === "edit" && preview && preview.kind !== "paint" && hud && previewItem ? (
        <div
          className={`lucky-select-hud lucky-placement-hud ${preview.valid ? "" : "is-invalid"} ${
            hud.flipped ? "is-flipped" : ""
          }`}
          style={{ left: hud.left, top: hud.top, width: hud.width, height: hud.height }}
        >
          <div className="lucky-select-box">
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="lucky-placement-toolbar" role="toolbar" aria-label="배치 미리보기">
            <button
              type="button"
              aria-label="취소"
              disabled={tutLock}
              onClick={() => {
                if (tutLock) return;
                const cleared = cancelPreview(layout);
                patchLayoutLocal(cleared);
              }}
            >
              ✕
            </button>
            {preview.kind === "floor" ? (
              <button type="button" aria-label="회전" disabled={tutLock} onClick={rotatePreview}>
                ⟳
              </button>
            ) : null}
            {preview.origin === "placed" ? (
              <button type="button" className="is-text" onClick={() => void putPreviewBack()}>
                서랍에 넣기
              </button>
            ) : null}
            <button
              type="button"
              id="placement-confirm"
              className="is-confirm"
              aria-label="확정"
              disabled={!preview.valid || committing}
              onClick={() => void confirmPreview()}
            >
              ✓
            </button>
          </div>
          {!preview.valid && preview.reason ? (
            <div className="ny-chip-placement">
              <NyChip
                arrow="up"
                arrowX={36}
                action={
                  preview.reason.includes("자리")
                    ? {
                        label: "서랍에 넣기",
                        onClick: () => {
                          void putPreviewBack();
                        },
                      }
                    : undefined
                }
              >
                {preview.reason.includes("자리")
                  ? "방에 자리가 없어요"
                  : preview.reason.includes("겹쳐")
                    ? "다른 가구와 겹쳐요"
                    : preview.reason}
              </NyChip>
            </div>
          ) : null}
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
            if (preview) {
              const cleared = cancelPreview(layout);
              patchLayoutLocal(cleared);
            }
            setTab(next);
            if (next === "벽지" || next === "바닥") {
              setSelectedId(null);
              setDragging(null);
              setBrushId(null);
            } else {
              setPaintHover(null);
              setBrushId(null);
            }
          }}
          themeFilter={themeFilter}
          onThemeFilter={setThemeFilter}
          items={items}
          layout={layout}
          owned={state.owned}
          itemMeta={drawerItemMeta}
          points={state.points}
          selectedId={selectedId}
          brushId={brushId}
          canUndo={Boolean(editUndo)}
          otherRoomIds={otherRoomIds}
          preferOwnedSort={tutorialActive}
          preferNewIds={[...starterDrawerIds].sort((a, b) => {
            // Placeables (cushions…) before wallpaper/floor skins within starter gifts.
            const ia = itemsById.get(a);
            const ib = itemsById.get(b);
            const pa = ia && isPlaceableDecor(ia) ? 0 : 1;
            const pb = ib && isPlaceableDecor(ib) ? 0 : 1;
            if (pa !== pb) return pa - pb;
            return starterDrawerIds.indexOf(a) - starterDrawerIds.indexOf(b);
          })}
          tutorialLockId={tutLock ? suggestItemId : null}
          onPick={pickDrawerItem}
          onMoveHere={moveHereFromOtherRoom}
          onBuyMore={openBuyMore}
          onUndo={applyEditUndo}
          onHelp={() => showToast("중복 고양이 카드를 발바닥 포인트로 바꿀 수 있어요")}
          onRequestClose={() => {
            if (tutLock) return;
            setConfirm("close-edit");
          }}
        />
      )}

      {buyItem ? (
        <RoomBuySheet
          item={buyItem}
          points={state.points}
          confirmLabel={buyMore ? "하나 더 사기" : undefined}
          onClose={() => {
            setBuyItem(null);
            setBuyMore(false);
          }}
          onBuy={() => buy(buyItem)}
        />
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

      {confirm === "close-edit" ? (
        <RoomConfirm
          title="변경사항을 저장할까요?"
          body="꾸미기를 끝낼게요. 저장하지 않으면 들어오기 전 배치로 돌아가요."
          cancel="저장 안 함"
          confirm="저장"
          onDismiss={() => setConfirm(null)}
          onCancel={() => {
            previewRef.current = null;
            setPreview(null);
            setDragging(null);
            if (snapshot) persist(patchCurrentRoom(state, snapshot));
            setConfirm(null);
            leaveEdit(false);
          }}
          onConfirm={() => {
            if (previewRef.current) {
              const cleared = cancelPreview(layout);
              persist(patchCurrentRoom(state, cleared));
            } else {
              persist(state);
            }
            setConfirm(null);
            leaveEdit(true);
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

      {confirm === "clear-furniture" ? (
        <RoomConfirm
          title="가구 모두 넣기"
          body="이 방의 가구·소품·벽 꾸미기를 모두 서랍으로 되돌릴게요. 벽지·바닥은 그대로예요."
          cancel="취소"
          confirm="모두 넣기"
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            void (async () => {
              let base = state;
              if (previewRef.current) {
                const cleared = cancelPreview(layout);
                base = patchCurrentRoom(state, cleared);
              }
              setEditUndo(structuredClone(base));
              const result = await clearFurnitureToDrawer({
                state: base,
                roomId: state.currentRoomId,
                requestId: newRequestId("clear"),
              });
              setConfirm(null);
              if (!result.ok) {
                showToast(result.reason);
                return;
              }
              setState(result.state);
              setPreview(null);
              previewRef.current = null;
              setDragging(null);
              setSelectedId(null);
              showToast("가구를 모두 서랍에 넣었어요");
            })();
          }}
        />
      ) : null}

      {unlockRoom ? (
        <RoomUnlockSheet
          room={unlockRoom === "soon" ? null : unlockRoom}
          unlock={
            unlockRoom && unlockRoom !== "soon" ? unlockFor(unlockRoom.id) : undefined
          }
          onClose={() => setUnlockRoom(null)}
        />
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
