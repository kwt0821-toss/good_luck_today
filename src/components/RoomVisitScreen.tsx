import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useBackHandler } from "../hooks/useBackHandler";
import { menuAsset } from "../lib/menuConfig";
import { roomAsset } from "../lib/roomCatalog";
import { screenOf } from "../lib/roomLayout";
import {
  loadVisitList,
  loadVisitRoom,
  likeVisitRoom,
  refreshVisitStatus,
  saveVisitNickname,
  turnVisitPrivate,
  turnVisitPublic,
  visitStatusNow,
  type VisitCard,
  type VisitRoom,
  type VisitStatus,
  type VisitTab,
} from "../lib/roomVisit";
import { PHOTO_EXPIRED, VISIT_EMPTY, VISIT_HINT } from "../lib/roomVisitNick";
import { normalizeRoomCatIds } from "../lib/roomStore";
import type { RoomItem } from "../lib/roomTypes";
import { RoomWorld } from "./RoomWorld";
import "./RoomVisitScreen.css";

const TABS: { id: VisitTab; label: string }[] = [
  { id: "friends", label: "친구" },
  { id: "today", label: "오늘의 방" },
  { id: "popular", label: "인기 방" },
];

type Props = {
  itemsById: Map<string, RoomItem>;
  capturePhoto: () => Promise<string | null>;
  onClose: () => void;
  floorCanvas?: boolean;
};

export function RoomVisitScreen({ itemsById, capturePhoto, onClose, floorCanvas = false }: Props) {
  const [tab, setTab] = useState<VisitTab>("friends");
  const [items, setItems] = useState<VisitCard[]>([]);
  const [settings, setSettings] = useState(false);
  const [opened, setOpened] = useState<VisitCard | null>(null);
  const [room, setRoom] = useState<VisitRoom | null>(null);
  const [visitNote, setVisitNote] = useState<string | null>(null);
  const [grant, setGrant] = useState<number | null>(null);
  const [likeBusy, setLikeBusy] = useState(false);

  const shown = items;

  useBackHandler(true, () => {
    if (settings) {
      setSettings(false);
      return;
    }
    onClose();
  }, settings ? 70 : 60);

  useEffect(() => {
    void refreshVisitStatus(true);
  }, []);

  useEffect(() => {
    let alive = true;
    void loadVisitList(tab).then((result) => {
      if (!alive) return;
      setItems(result.error ? [] : result.items);
    });
    return () => {
      alive = false;
    };
  }, [tab]);

  useEffect(() => {
    if (grant == null) return;
    const timer = window.setTimeout(() => setGrant(null), 3600);
    return () => window.clearTimeout(timer);
  }, [grant]);

  const openCard = (card: VisitCard) => {
    setOpened(card);
    setRoom(null);
    setVisitNote(null);
    setGrant(null);
    void loadVisitRoom(card.roomId).then((result) => {
      if (result.ok) {
        setRoom(result.room);
        return;
      }
      setVisitNote(result.message === "local" ? "서버가 필요할 때 볼 수 있어요" : result.message);
    });
  };

  const goNext = () => {
    if (!opened || shown.length < 2) return;
    const index = shown.findIndex((item) => item.roomId === opened.roomId);
    const next = shown[(index < 0 ? 0 : index + 1) % shown.length];
    if (!next || next.roomId === opened.roomId) return;
    openCard(next);
  };

  const onLike = () => {
    if (!opened || likeBusy) return;
    if (room?.isMine) {
      setVisitNote("내 방에는 하트를 누를 수 없어요");
      return;
    }
    if (room?.likedByMe || opened.likedByMe) return;
    setLikeBusy(true);
    void likeVisitRoom(opened.roomId, false).then((outcome) => {
      setLikeBusy(false);
      if (outcome.message) setVisitNote(outcome.message);
      if (outcome.grantAmount != null) setGrant(outcome.grantAmount);
      if (outcome.likes == null || outcome.likedByMe == null) return;
      const likes = outcome.likes;
      const likedByMe = outcome.likedByMe;
      setRoom((prev) => (prev ? { ...prev, likes, likedByMe } : prev));
      setOpened((prev) => (prev ? { ...prev, likes, likedByMe } : prev));
      setItems((prev) =>
        prev.map((item) => (item.roomId === opened.roomId ? { ...item, likes, likedByMe } : item)),
      );
    });
  };

  const screen = (
    <div className="rv-screen">
      {opened ? (
        <VisitView
          card={opened}
          room={room}
          itemsById={itemsById}
          floorCanvas={floorCanvas}
          note={visitNote}
          grant={grant}
          likeBusy={likeBusy}
          canNext={shown.length > 1}
          onLike={onLike}
          onNext={goNext}
          onClose={onClose}
        />
      ) : (
        <ListView
          tab={tab}
          items={shown}
          onTab={setTab}
          onOpen={openCard}
          onSettings={() => setSettings(true)}
          onClose={onClose}
        />
      )}
      {settings ? (
        <VisitSettings
          capturePhoto={capturePhoto}
          onClose={() => setSettings(false)}
        />
      ) : null}
    </div>
  );
  return createPortal(screen, document.body);
}

function ListView({
  tab,
  items,
  onTab,
  onOpen,
  onSettings,
  onClose,
}: {
  tab: VisitTab;
  items: VisitCard[];
  onTab: (tab: VisitTab) => void;
  onOpen: (card: VisitCard) => void;
  onSettings: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <header className="rv-head">
        <div>
          <p className="rv-kicker">방꾸미기</p>
          <h1 className="rv-title">
            방 구경<i>.</i>
          </h1>
          <p className="rv-desc">다른 고양이의 방에 놀러 가요</p>
          <button type="button" className="rv-settings-link" onClick={onSettings}>
            내 방 공개 설정
          </button>
        </div>
        <button type="button" className="rv-x" onClick={onClose} aria-label="닫기">
          <img src={menuAsset("icon-close.svg")} alt="" />
        </button>
      </header>
      <div className="rv-tabs" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? "rv-tab is-on" : "rv-tab"}
            onClick={() => onTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="rv-tab-note">{VISIT_HINT[tab]}</p>
      <div className="rv-scroll">
        {items.length === 0 ? (
          <p className="rv-empty">{VISIT_EMPTY[tab]}</p>
        ) : (
          <div className="rv-grid">
            {items.map((item) => (
              <button key={item.roomId} type="button" className="rv-card" onClick={() => onOpen(item)}>
                <span className="rv-shot">
                  {item.photoUrl ? <img src={item.photoUrl} alt="" /> : null}
                </span>
                <span className="rv-card-name">{item.nickname || "고양이"}</span>
                <span className="rv-card-like">
                  <Heart filled />
                  {item.likes}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="rv-foot">닫기를 누르면 내 방으로 돌아와요</p>
    </>
  );
}

function VisitView({
  card,
  room,
  itemsById,
  floorCanvas = false,
  note,
  grant,
  likeBusy,
  canNext,
  onLike,
  onNext,
  onClose,
}: {
  card: VisitCard;
  room: VisitRoom | null;
  itemsById: Map<string, RoomItem>;
  floorCanvas?: boolean;
  note: string | null;
  grant: number | null;
  likeBusy: boolean;
  canNext: boolean;
  onLike: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const layout = room?.layout ?? null;
  const name = room?.nickname || card.nickname || "고양이";
  const likes = room?.likes ?? card.likes;
  const liked = room?.likedByMe || card.likedByMe;
  const mine = room?.isMine === true;
  const fit = screenOf("view");
  return (
    <>
      <header className="rv-head">
        <div>
          <p className="rv-kicker">방 구경</p>
          <h1 className="rv-title">
            <b>{name}</b>님의 방
          </h1>
        </div>
        <button type="button" className="rv-x" onClick={onClose} aria-label="닫기">
          <img src={menuAsset("icon-close.svg")} alt="" />
        </button>
      </header>
      <div className="rv-stage">
        {layout ? (
          <div
            className="lucky-island rv-island"
            style={{ left: fit.left, top: fit.top, width: fit.width, height: fit.height }}
          >
            <div className="lucky-island-scale">
              <RoomWorld
                mode="view"
                roomId={layout.currentRoomId}
                roamingCatIds={normalizeRoomCatIds(layout.room.roamingCatIds)}
                roamingActive
                itemsById={itemsById}
                layout={layout.room}
                selectedId={null}
                dragging={null}
                hints={null}
                frameThumbs={[]}
                shakeId={null}
                shadowsEnabled={layout.shadowsEnabled}
                painting={false}
                paintHover={null}
                floorCanvas={floorCanvas}
                onSelect={() => undefined}
                onItemPointerDown={() => undefined}
                onFloorPointerDown={() => undefined}
              />
            </div>
          </div>
        ) : (
          <p className="rv-empty">{note || "방을 불러오는 중"}</p>
        )}
      </div>
      <p className="rv-look">가구는 만질 수 없어요. 구경만 해요.</p>
      {grant != null ? (
        <div className="rv-grant" role="status">
          <img src={roomAsset("ui/icon-paw-point.svg")} alt="" />
          <p>
            오늘 첫 하트예요! <b>발바닥 젤리 {grant}개</b>를 받았어요
          </p>
        </div>
      ) : null}
      {note && grant == null ? <p className="rv-visit-note">{note}</p> : null}
      <div className="rv-dock">
        <button
          type="button"
          className={liked ? "rv-like is-on" : "rv-like"}
          onClick={onLike}
          disabled={likeBusy || mine || liked}
          aria-label={mine ? "내 방에는 하트를 누를 수 없어요" : liked ? "이미 하트를 눌렀어요" : "하트"}
        >
          <Heart filled={liked} />
          <span>{likes}</span>
        </button>
        {canNext ? (
          <button type="button" className="rv-next" onClick={onNext}>
            다음 방 ›
          </button>
        ) : null}
      </div>
    </>
  );
}

function VisitSettings({
  capturePhoto,
  onClose,
}: {
  capturePhoto: () => Promise<string | null>;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<VisitStatus>(visitStatusNow());
  const [draft, setDraft] = useState(status.nickname);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void refreshVisitStatus(true).then((next) => {
      setStatus(next);
      setDraft((prev) => prev || next.nickname);
    });
  }, []);

  const saveName = () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    void saveVisitNickname(draft).then((result) => {
      setBusy(false);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setStatus(result.status);
      setDraft(result.status.nickname);
      setMessage("닉네임을 저장했어요");
    });
  };

  const togglePublic = () => {
    if (busy) return;
    if (status.isPublic) {
      setBusy(true);
      setMessage(null);
      void turnVisitPrivate().then((result) => {
        setBusy(false);
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
        setStatus(result.status);
      });
      return;
    }
    if (!status.hasNickname) {
      setMessage("닉네임을 먼저 정해 주세요");
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setMessage(null);
    void (async () => {
      const jpeg = await capturePhoto();
      const result = await turnVisitPublic(jpeg);
      setBusy(false);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setStatus(result.status);
    })();
  };

  const relive = () => {
    if (busy || !status.hasNickname) return;
    setBusy(true);
    setMessage(null);
    void (async () => {
      const jpeg = await capturePhoto();
      const result = await turnVisitPublic(jpeg);
      setBusy(false);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setStatus(result.status);
      setMessage("방 사진을 다시 남겼어요");
    })();
  };

  const locked = status.hasNickname && !status.canChangeNickname;

  return (
    <div className="rv-scrim" onClick={onClose}>
      <section className="rv-sheet" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="내 방 공개 설정">
        <div className="rv-sheet-head">
          <h2>내 방 공개 설정</h2>
          <button type="button" className="rv-x" onClick={onClose} aria-label="닫기">
            <img src={menuAsset("icon-close.svg")} alt="" />
          </button>
        </div>
        <p className="rv-now">
          지금 닉네임 <b>{status.nickname || "아직 없어요"}</b>
        </p>
        <label className="rv-label" htmlFor="rv-nick">
          닉네임
        </label>
        <div className="rv-nick-row">
          <input
            id="rv-nick"
            ref={inputRef}
            value={draft}
            maxLength={8}
            disabled={locked || busy}
            placeholder="2~8글자"
            autoComplete="off"
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="button" className="rv-save" onClick={saveName} disabled={locked || busy}>
            저장
          </button>
        </div>
        {locked ? <p className="rv-sheet-note">오늘은 닉네임을 이미 바꿨어요</p> : null}
        <div className="rv-public">
          <div>
            <strong>내 방 공개</strong>
            <small>{status.isPublic ? "목록에 올라가요" : "기본은 꺼져 있어요"}</small>
          </div>
          <button
            type="button"
            className={status.isPublic ? "rv-switch is-on" : "rv-switch"}
            role="switch"
            aria-checked={status.isPublic}
            aria-label="내 방 공개"
            disabled={busy}
            onClick={togglePublic}
          />
        </div>
        {status.isPublic && !status.photoLive ? (
          <>
            <p className="rv-sheet-note">{PHOTO_EXPIRED}</p>
            <button type="button" className="rv-relive" onClick={relive} disabled={busy}>
              사진 다시 남기기
            </button>
          </>
        ) : null}
        {message ? <p className="rv-sheet-note">{message}</p> : null}
      </section>
    </div>
  );
}

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg className={filled ? "rv-heart is-on" : "rv-heart"} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20s-7-4.35-7-9.1A3.9 3.9 0 0 1 12 8.2a3.9 3.9 0 0 1 7 2.7C19 15.65 12 20 12 20z" />
    </svg>
  );
}
