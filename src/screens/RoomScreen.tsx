import { adaptive } from "@toss/tds-colors";
import { BottomSheet, SegmentedControl, Text, Top } from "@toss/tds-mobile";
import { useEffect, useMemo, useState } from "react";

import { RoomArtImage } from "../components/RoomArtImage";
import { RoomCanvas } from "../components/RoomCanvas";
import { ScreenHeader } from "../components/ScreenHeader";
import {
  ITEM_CATEGORIES,
  categoryLabel,
  getItemById,
  getItemsByCategory,
} from "../lib/items";
import { ART_PROMPTS, ROOM_ART } from "../lib/roomArt";
import {
  availableCount,
  isEquipped,
  ownedCount,
} from "../lib/room";
import type { Cat, ItemCategory, RoomTab, ShopItem, UserState } from "../types";

type RoomScreenProps = {
  user: UserState;
  cat: Cat | null;
  toast: string | null;
  onBack: () => void;
  onBuy: (itemId: string) => void;
  onEquip: (itemId: string) => void;
  onPlace: (itemId: string, col: number, row: number) => void;
  onMove: (instanceId: string, col: number, row: number) => void;
  onRemove: (instanceId: string) => void;
};

export function RoomScreen({
  user,
  cat,
  toast,
  onBack,
  onBuy,
  onEquip,
  onPlace,
  onMove,
  onRemove,
}: RoomScreenProps) {
  const [tab, setTab] = useState<RoomTab>("decorate");
  const [filter, setFilter] = useState<ItemCategory | "ALL">("ALL");
  const [placingItemId, setPlacingItemId] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  const ownedItems = useMemo(
    () =>
      getItemsByCategory("ALL").filter(
        (item) => !item.unique && availableCount(user, item.id) > 0,
      ),
    [user],
  );
  const shopItems = getItemsByCategory(filter);
  const selectedPlacement = user.room.placements.find(
    (item) => item.instanceId === selectedInstanceId,
  );
  const selectedPlacedItem = selectedPlacement ? getItemById(selectedPlacement.itemId) : undefined;

  useEffect(() => {
    if (placingItemId && availableCount(user, placingItemId) < 1) {
      setPlacingItemId(null);
    }
  }, [placingItemId, user]);

  return (
    <div className="screen room-screen">
      <ScreenHeader title="고양이방" showBack onBack={onBack} pinkJellyBalance={user.pinkJellyBalance} />
      <Top
        title={<Top.TitleParagraph size={22}>나만의 고양이방</Top.TitleParagraph>}
        subtitleBottom={
          <Top.SubtitleParagraph size={15}>
            핑크젤리로 아이템을 사고, 타일 위에 아기자기하게 꾸며요.
          </Top.SubtitleParagraph>
        }
      />
      <div className="room-guide-link">
        <button type="button" className="text-link" onClick={() => setGuideOpen(true)}>
          그림 넣는 방법
        </button>
      </div>

      <RoomCanvas
        room={user.room}
        cat={cat}
        editable
        selectedInstanceId={selectedInstanceId}
        placingItemId={placingItemId}
        onPlace={(col, row) => {
          if (!placingItemId) return;
          onPlace(placingItemId, col, row);
        }}
        onMove={onMove}
        onSelect={(instanceId) => {
          setSelectedInstanceId(instanceId);
          if (instanceId) setPlacingItemId(null);
        }}
      />

      {selectedPlacedItem && selectedInstanceId ? (
        <div className="room-selected-bar">
          <span>
            {selectedPlacedItem.name} · 다른 타일로 드래그할 수 있어요
          </span>
          <button
            type="button"
            className="text-link"
            onClick={() => {
              onRemove(selectedInstanceId);
              setSelectedInstanceId(null);
            }}
          >
            보관하기
          </button>
        </div>
      ) : (
        <p className="room-hint">
          {tab === "shop"
            ? "젤리를 써서 사고, 벽지·바닥은 사자마자 타일방에 적용돼요."
            : placingItemId
              ? "초록 타일을 누르면 놓여요. 빨가면 겹쳐서 못 놓아요."
              : "아이템을 고른 뒤 타일을 누르거나, 놓인 가구를 드래그하세요."}
        </p>
      )}

      <div className="room-toolbar">
        <SegmentedControl
          value={tab}
          size="small"
          onChange={(value) => {
            setTab(value as RoomTab);
            setPlacingItemId(null);
            setSelectedInstanceId(null);
          }}
        >
          <SegmentedControl.Item value="decorate">꾸미기</SegmentedControl.Item>
          <SegmentedControl.Item value="shop">상점</SegmentedControl.Item>
        </SegmentedControl>
      </div>

      {tab === "decorate" ? (
        <div className="room-inventory">
          {ownedItems.length === 0 ? (
            <div className="intro-card">
              <Text typography="t6" color={adaptive.grey600} display="block">
                놓을 수 있는 가구가 없어요. 상점에서 핑크젤리로 사 보세요.
              </Text>
            </div>
          ) : (
            ownedItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`inventory-chip ${placingItemId === item.id ? "is-active" : ""}`}
                onClick={() => {
                  setSelectedInstanceId(null);
                  setPlacingItemId((current) => (current === item.id ? null : item.id));
                }}
              >
                <RoomArtImage item={item} />
                <strong>{item.name}</strong>
                <span>x{availableCount(user, item.id)}</span>
              </button>
            ))
          )}
        </div>
      ) : (
        <>
          <div className="grade-filters room-filters" role="tablist" aria-label="아이템 종류">
            {ITEM_CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={filter === item}
                className={`grade-filter ${filter === item ? "is-active" : ""}`}
                onClick={() => setFilter(item)}
              >
                {categoryLabel(item)}
              </button>
            ))}
          </div>
          <div className="shop-grid">
            {shopItems.map((item) => (
              <ShopCard
                key={item.id}
                item={item}
                user={user}
                onBuy={() => onBuy(item.id)}
                onEquip={() => onEquip(item.id)}
              />
            ))}
          </div>
        </>
      )}

      {toast ? <div className="local-toast">{toast}</div> : null}

      <BottomSheet
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        header={<BottomSheet.Header>그림 넣는 방법</BottomSheet.Header>}
        headerDescription={
          <BottomSheet.HeaderDescription>
            아이소 벽은 직접 그리지 마세요. 정사각 패턴과 아이템 PNG만 넣으면 맵에 붙어요.
          </BottomSheet.HeaderDescription>
        }
        cta={
          <BottomSheet.CTA onClick={() => setGuideOpen(false)}>
            닫기
          </BottomSheet.CTA>
        }
      >
        <div className="art-guide">
          <p>
            <strong>벽지</strong> {ROOM_ART.wallpaper.width}×{ROOM_ART.wallpaper.height} 심리스 PNG
            <br />
            <code>public/room-art/walls/wall_mint.png</code>
          </p>
          <p>
            <strong>바닥</strong> {ROOM_ART.floor.width}×{ROOM_ART.floor.height} 심리스 PNG
            <br />
            <code>public/room-art/floors/floor_wood.png</code>
          </p>
          <p>
            <strong>1칸 아이템</strong> {ROOM_ART.item1.width}×{ROOM_ART.item1.height}, 배경 투명
            <br />
            <code>public/room-art/items/decor_yarn.png</code>
          </p>
          <p>
            <strong>2칸 아이템</strong> {ROOM_ART.item2.width}×{ROOM_ART.item2.height}
            <br />
            <code>public/room-art/items/furn_bed.png</code>
          </p>
          <p className="art-guide-prompt">
            도안은 <code>/room-art/templates/</code> 에 있어요. AI로 만들 때는 아래를 그대로 쓰세요.
          </p>
          <pre>{ART_PROMPTS.wallpaper}</pre>
          <pre>{ART_PROMPTS.floor}</pre>
          <pre>{ART_PROMPTS.item}</pre>
        </div>
      </BottomSheet>
    </div>
  );
}

function ShopCard({
  item,
  user,
  onBuy,
  onEquip,
}: {
  item: ShopItem;
  user: UserState;
  onBuy: () => void;
  onEquip: () => void;
}) {
  const owned = ownedCount(user, item.id);
  const equipped = isEquipped(user, item);
  const uniqueOwned = item.unique && owned > 0;
  const canBuy = !uniqueOwned && user.pinkJellyBalance >= item.price && item.price > 0;

  return (
    <article className="shop-card">
      <div className={`shop-preview ${item.category === "wallpaper" || item.category === "floor" ? "is-surface" : ""}`}>
        <RoomArtImage item={item} />
      </div>
      <strong>{item.name}</strong>
      <span>
        {item.price > 0 ? `🍬 ${item.price}` : "기본 아이템"}
        {owned > 0 ? ` · 보유 ${owned}` : ""}
      </span>
      {item.unique && uniqueOwned ? (
        <button type="button" className="shop-buy" disabled={equipped} onClick={onEquip}>
          {equipped ? "적용 중" : "적용하기"}
        </button>
      ) : item.price <= 0 ? (
        <button type="button" className="shop-buy is-owned" disabled>
          가지고 있어요
        </button>
      ) : (
        <button type="button" className="shop-buy" disabled={!canBuy} onClick={onBuy}>
          {canBuy ? "구매하기" : "젤리 부족"}
        </button>
      )}
    </article>
  );
}
