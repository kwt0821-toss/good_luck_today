import { useEffect, useState } from "react";

import {
  affectionConfig,
  affectionLevel,
  affectionProgress,
  favoriteAffection,
  QUESTION_CAT,
} from "../lib/affection";
import { roomAsset } from "../lib/roomCatalog";
import { loadRoomCats } from "../lib/roomCats";
import { hasUnreadCatLetter } from "../lib/catLetters";
import type { OpsEconomy, OpsState } from "../lib/opsTypes";
import "./AffectionHost.css";

type HomeFavoriteProps = {
  ops: OpsState;
  economy: OpsEconomy;
  locked?: boolean;
  onGreet?: () => void;
};

export function HomeFavorite({ ops, economy, locked = false, onGreet }: HomeFavoriteProps) {
  const config = affectionConfig(economy);
  const affection = ops.affection;
  const chosen = Boolean(affection.catId);
  const xp = favoriteAffection(affection).xp;
  const level = config ? affectionLevel(xp, config) : 1;
  const progress = config ? affectionProgress(xp, config) : 0;
  const [icon, setIcon] = useState(QUESTION_CAT);
  const [name, setName] = useState("");
  const [greet, setGreet] = useState("");

  useEffect(() => {
    if (!affection.catId) {
      setIcon(QUESTION_CAT);
      setName("");
      return;
    }
    const catId = affection.catId;
    let alive = true;
    void loadRoomCats().then((cats) => {
      if (!alive) return;
      const cat = cats.find((item) => item.id === catId);
      setName(cat?.nameKo ?? "");
      setIcon(cat?.icon ? roomAsset(cat.icon) : QUESTION_CAT);
    });
    return () => {
      alive = false;
    };
  }, [affection.catId]);

  useEffect(() => {
    if (!config || locked || !chosen || level < 3 || !config.greetLines.length) return;
    if (affection.greetedOn === affection.dateKey || greet) return;
    const index =
      Math.abs(hashCode(`${affection.dateKey}:${affection.catId ?? ""}`)) % config.greetLines.length;
    setGreet(config.greetLines[index] ?? "");
    onGreet?.();
  }, [affection.catId, affection.dateKey, affection.greetedOn, chosen, config, greet, level, locked, onGreet]);

  return (
    <button
      type="button"
      className="home-fav"
      disabled={locked}
      aria-label={chosen ? `${name || "최애냥"} 애정도 ${level}` : "최애냥 고르기"}
      onClick={() => {
        if (locked) return;
        window.dispatchEvent(new CustomEvent("lucky-open-affection"));
      }}
    >
      <span className="home-fav-face">
        <img src={icon} alt="" />
      </span>
      {hasUnreadCatLetter(ops) ? <span className="home-fav-dot" aria-label="안 읽은 편지" /> : null}
      {chosen ? (
        <>
          <span className="home-fav-lv">♥ Lv.{level}</span>
          <span className="home-fav-bar" aria-hidden="true">
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </span>
        </>
      ) : (
        <span className="home-fav-lv">최애냥 고르기</span>
      )}
      {greet ? <span className="home-fav-greet">{greet}</span> : null}
    </button>
  );
}

function hashCode(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return hash;
}
