import { useEffect, useState } from "react";

import { nyNotify } from "../lib/nyangNotify";
import { roomAsset } from "../lib/roomCatalog";
import {
  isRoomCatSelectable,
  loadRoomCats,
  ROOM_CAT_SILHOUETTE,
  roomCatRuleText,
  type RoomCatEntry,
} from "../lib/roomCats";
import { ROOM_CAT_MAX } from "../lib/roomStore";

import "./RoomCatsTab.css";

type RoomCatsTabProps = {
  /** Cats currently in this room. */
  selectedIds: string[];
  /** Replace the room's cat list and save. */
  onChange: (catIds: string[]) => void;
  /** Owned dex card ids, for later unlocks. Not needed at launch. */
  ownedCardIds?: ReadonlySet<string>;
};

export function RoomCatsTab({ selectedIds, onChange, ownedCardIds }: RoomCatsTabProps) {
  const [cats, setCats] = useState<RoomCatEntry[]>([]);
  const [info, setInfo] = useState<RoomCatEntry | null>(null);

  useEffect(() => {
    let alive = true;
    void loadRoomCats().then((list) => {
      if (alive) setCats(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  const hasComingSoon = cats.some((cat) => cat.status === "comingSoon");

  return (
    <div className="rc-tab">
      <p className="rc-count">고양이 {selectedIds.length}/{ROOM_CAT_MAX}</p>
      {hasComingSoon ? (
        <div className="rc-banner" role="note">
          <img className="rc-banner-cat" src={roomAsset("cat-friends/cheese.webp")} alt="" aria-hidden="true" />
          <div className="rc-banner-copy">
            <strong className="rc-banner-title">
              고양이 친구 <span aria-hidden="true">✦</span>
            </strong>
            <p className="rc-banner-msg">
              곧 새로운 고양이 친구들이 찾아와요!
              <br />
              품종 1~5성을 모두 모으면 그 고양이가 방에 놀러 와요.
            </p>
          </div>
        </div>
      ) : null}

      {info ? (
        <div className="rc-info" role="status">
          <strong>{info.nameKo}</strong>
          <span>{roomCatRuleText(info)}</span>
          {info.status === "comingSoon" ? <em>곧 추가돼요</em> : null}
          <button type="button" aria-label="닫기" onClick={() => setInfo(null)}>
            ✕
          </button>
        </div>
      ) : null}

      <div className="rc-grid">
        {cats.map((cat) => {
          const selectable = isRoomCatSelectable(cat, ownedCardIds);
          const selected = selectable && selectedIds.includes(cat.id);
          const soon = cat.status === "comingSoon";
          const icon = !soon && cat.icon ? roomAsset(cat.icon) : ROOM_CAT_SILHOUETTE;
          return (
            <button
              key={cat.id}
              type="button"
              className={`rc-cell ${selected ? "is-selected" : ""} ${soon ? "is-soon" : ""} ${!selectable && !soon ? "is-locked" : ""} ${cat.type === "legend" ? "is-legend" : ""}`}
              aria-pressed={selected}
              aria-label={`${cat.nameKo}${soon ? ", 곧 추가돼요" : selected ? ", 방에 있어요" : ""}`}
              onClick={() => {
                if (selectable) {
                  setInfo(null);
                  if (selected) {
                    if (selectedIds.length <= 1) return;
                    onChange(selectedIds.filter((id) => id !== cat.id));
                    return;
                  }
                  if (selectedIds.length >= ROOM_CAT_MAX) {
                    nyNotify({
                      key: "room-cat-cap",
                      kind: "info",
                      title: "한 방에 고양이는 3마리까지 들어갈 수 있어요",
                    });
                    return;
                  }
                  onChange([...selectedIds, cat.id]);
                  return;
                }
                setInfo(cat);
              }}
            >
              {selected ? <span className="rc-badge">방에 있어요</span> : null}
              {soon ? <span className="rc-badge is-soon">곧 추가돼요</span> : null}
              {cat.type === "legend" ? <span className="rc-legend-mark" aria-hidden="true">LEGEND</span> : null}
              <img className="rc-icon" src={icon} alt="" draggable={false} />
              {soon || !selectable ? (
                <img className="rc-lock" src={roomAsset("ui/icon-lock.svg")} alt="" aria-hidden="true" />
              ) : null}
              <span className="rc-name">{cat.nameKo}</span>
              <span className="rc-rule">{roomCatRuleText(cat, true)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default RoomCatsTab;
