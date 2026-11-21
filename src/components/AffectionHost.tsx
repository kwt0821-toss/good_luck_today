import { useEffect, useState } from "react";

import {
  affectionConfig,
  affectionLevel,
  affectionProgress,
  catAffection,
  chooseFavorite,
  claimAffectionLevel,
  favoriteAffection,
  pendingGiftLevel,
  publishAffection,
  QUESTION_CAT,
  todayAffectionXp,
} from "../lib/affection";
import { loadDexOwned } from "../lib/dexCollection";
import { syncHeartBed } from "../lib/heartBed";
import { saveOpsState } from "../lib/opsStorage";
import type { AffectionConfig, OpsEconomy, OpsState } from "../lib/opsTypes";
import { roomAsset } from "../lib/roomCatalog";
import { loadRoomState, saveRoomState } from "../lib/roomStore";
import { loadRoomCatalog, loadRoomGrid, loadRoomsFile } from "../lib/roomCatalog";
import { resolveCozyStatus } from "../lib/roomCozy";
import { loadOpsConfig } from "../lib/opsConfig";
import { loadRoomCats, type RoomCatEntry } from "../lib/roomCats";
import "./AffectionHost.css";

type AffectionHostProps = {
  ops: OpsState;
  economy: OpsEconomy;
  onOps: (next: OpsState) => void;
  onOpenRoom?: () => void;
};

type PickerCat = RoomCatEntry & { owned: boolean };

export function AffectionHost({ ops, economy, onOps }: AffectionHostProps) {
  const config = affectionConfig(economy);
  const [open, setOpen] = useState<"pick" | "status" | null>(null);
  const [cats, setCats] = useState<PickerCat[]>([]);
  const [picked, setPicked] = useState<string | null>(ops.affection.catId);
  const [favName, setFavName] = useState("최애냥");
  const giftLevel = config ? pendingGiftLevel(ops, economy) : null;

  useEffect(() => {
    const onOpen = () => {
      if (!ops.affection.catId) setOpen("pick");
      else setOpen("status");
    };
    window.addEventListener("lucky-open-affection", onOpen);
    return () => window.removeEventListener("lucky-open-affection", onOpen);
  }, [ops.affection.catId]);

  useEffect(() => {
    const id = ops.affection.catId;
    if (!id) return;
    let alive = true;
    void loadRoomCats().then((list) => {
      if (!alive) return;
      setFavName(list.find((cat) => cat.id === id)?.nameKo ?? "최애냥");
    });
    return () => {
      alive = false;
    };
  }, [ops.affection.catId]);

  useEffect(() => {
    if (open !== "pick") return;
    let alive = true;
    void Promise.all([loadRoomCats(), loadDexOwned()]).then(([list, owned]) => {
      if (!alive || !owned) return;
      const have = new Set(
        Object.values(owned)
          .filter((row) => row.count > 0)
          .map((row) => row.id),
      );
      void loadBreedIds(have).then((breedIds) => {
        if (!alive) return;
        setCats(
          list
            .filter((cat) => cat.type === "breed" && cat.status === "available")
            .map((cat) => ({ ...cat, owned: cat.default === true || breedIds.has(cat.id) })),
        );
      });
    });
    setPicked(ops.affection.catId);
    return () => {
      alive = false;
    };
  }, [open, ops.affection.catId]);

  if (!config) return null;

  const favorite = favoriteAffection(ops.affection);
  const level = affectionLevel(favorite.xp, config);
  const save = async (next: OpsState) => {
    await saveOpsState(next);
    publishAffection(next);
    onOps(next);
  };

  const commitCat = async () => {
    if (!picked) return;
    const cat = cats.find((item) => item.id === picked);
    if (!cat?.owned) return;
    const next = chooseFavorite(ops, picked);
    syncHeartBed(picked, cat.nameKo, cat.icon ? roomAsset(cat.icon) : null);
    await save(next);
    setOpen(null);
  };

  const claimGift = async () => {
    if (giftLevel == null) return;
    const next = claimAffectionLevel(ops, economy, giftLevel);
    if (giftLevel === config.furnitureLevel) await grantBedToRoom(config.furnitureId);
    await save(next);
  };

  return (
    <>
      {open ? (
        <div className="aff-modal">
          <button type="button" className="aff-modal-back" aria-label="닫기" onClick={() => setOpen(null)} />
          <div
            className="aff-card is-split"
            role="dialog"
            aria-label={open === "pick" ? "최애냥을 골라 주세요" : "최애냥"}
          >
            {open === "pick" ? (
              <>
                <h3>최애냥을 골라 주세요</h3>
                <div className="aff-scroll">
                  <AffectionHow config={config} />
                  <div className="aff-grid">
                    {cats.map((cat) => {
                      const record = catAffection(ops.affection, cat.id);
                      const known = record.xp > 0;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          className={picked === cat.id ? "is-on" : ""}
                          disabled={!cat.owned}
                          onClick={() => setPicked(cat.id)}
                        >
                          <img src={cat.icon ? roomAsset(cat.icon) : QUESTION_CAT} alt="" />
                          <span>{cat.nameKo}</span>
                          {known ? <small>♥ Lv.{affectionLevel(record.xp, config)}</small> : null}
                          {cat.owned ? null : <small>아직 없어요</small>}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="aff-foot">
                  <button
                    type="button"
                    className="aff-go"
                    disabled={!cats.some((cat) => cat.id === picked && cat.owned)}
                    onClick={() => void commitCat()}
                  >
                    {ops.affection.catId ? "바꾸기" : "이 아이로 할래요"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="aff-scroll">
                  <h3>{favName}</h3>
                  <p className="aff-lv">♥ Lv.{level}</p>
                  <div className="aff-bar" aria-hidden="true">
                    <span style={{ width: `${Math.round(affectionProgress(favorite.xp, config) * 100)}%` }} />
                  </div>
                  <p className="aff-today">오늘 애정도 +{todayAffectionXp(ops.affection, config)}</p>
                  <AffectionHow config={config} />
                  <ul className="aff-perks">
                    <li className={level >= 2 ? "is-on" : ""}>Lv.2 방에서 누르면 말을 걸어요</li>
                    <li className={level >= 3 ? "is-on" : ""}>Lv.3 메인에서 하루 한 번 인사해요</li>
                    <li className={level >= config.rateBonus.fromLevel ? "is-on" : ""}>
                      Lv.{config.rateBonus.fromLevel} 뽑기에서 이 품종이 조금 더 잘 나와요
                    </li>
                    <li className={level >= config.furnitureLevel ? "is-on" : ""}>
                      Lv.{config.furnitureLevel} 하트 쿠션 침대
                    </li>
                    <li className={level >= config.frameLevel ? "is-on" : ""}>
                      Lv.{config.frameLevel} 최애 테두리
                    </li>
                  </ul>
                </div>
                <div className="aff-foot">
                  <button
                    type="button"
                    className="aff-mail"
                    onClick={() => {
                      setOpen(null);
                      window.dispatchEvent(new CustomEvent("lucky-open-mailbox"));
                    }}
                  >
                    편지함
                  </button>
                  <button type="button" className="aff-go" onClick={() => setOpen("pick")}>
                    최애냥 변경
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {giftLevel != null && !open ? (
        <div className="aff-modal">
          <div className="aff-card" role="dialog" aria-label="애정도 선물">
            <h3>{giftLevel === config.furnitureLevel ? "하트 쿠션 침대" : "최애 테두리"}</h3>
            <p>
              {giftLevel === config.furnitureLevel
                ? "애정도 선물이 도착했어요. 방에 놓고 최애냥을 재워 주세요."
                : "방 사진에 최애 테두리를 쓸 수 있어요."}
            </p>
            <button type="button" className="aff-go" onClick={() => void claimGift()}>
              선물 받을게요
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function AffectionHow({ config }: { config: AffectionConfig }) {
  const rows: Array<[string, { xp: number; perDay: number }]> = [
    ["출석 선물 받기", config.sources.attend],
    ["최애냥과 같은 품종 뽑기", config.sources.sameDraw],
    ["방에서 최애냥 쓰다듬기", config.sources.pet],
    ["오늘의 미션 보상 받기", config.sources.mission],
  ];
  return (
    <ul className="aff-how">
      {rows.map(([label, rule]) => (
        <li key={label}>
          {label} +{rule.xp} (하루 {rule.perDay}회)
        </li>
      ))}
      <li>하루 최대 {config.dailyCap}까지 올라가요</li>
    </ul>
  );
}

async function loadBreedIds(cardIds: Set<string>): Promise<Set<string>> {
  const { loadDexCatalog } = await import("../lib/dexCatalog");
  const catalog = await loadDexCatalog();
  const breeds = new Set<string>();
  for (const card of catalog.cards) {
    if (card.type !== "breed" || !card.breed?.id) continue;
    if (cardIds.has(card.id)) breeds.add(card.breed.id);
  }
  return breeds;
}

async function grantBedToRoom(itemId: string) {
  const [catalog, grid, rooms, config] = await Promise.all([
    loadRoomCatalog(),
    loadRoomGrid(),
    loadRoomsFile(),
    loadOpsConfig(),
  ]);
  const state = await loadRoomState(catalog.items, rooms, grid);
  if ((state.owned[itemId] ?? 0) > 0) return;
  const owned = { ...state.owned, [itemId]: 1 };
  const cozy = resolveCozyStatus(owned, config.prices, config.economy);
  await saveRoomState({ ...state, owned, cozyLevel: cozy.level });
}
