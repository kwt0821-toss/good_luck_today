import { useEffect, useState } from "react";

import { roomAsset } from "../lib/roomCatalog";
import {
  isRoomCatSelectable,
  loadRoomCats,
  ROOM_CAT_SILHOUETTE,
  roomCatRuleText,
  type RoomCatEntry,
} from "../lib/roomCats";

import "./RoomCatsTab.css";

type RoomCatsTabProps = {
  /** roomLayout.roamingCatId */
  selectedId: string | null;
  /** Set roomLayout.roamingCatId and save. Only called for selectable cats. */
  onSelect: (catId: string) => void;
  /** Owned dex card ids, for later unlocks. Not needed at launch. */
  ownedCardIds?: ReadonlySet<string>;
};

export function RoomCatsTab({ selectedId, onSelect, ownedCardIds }: RoomCatsTabProps) {
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
          const selected = selectable && cat.id === selectedId;
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
                  if (!selected) onSelect(cat.id);
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
