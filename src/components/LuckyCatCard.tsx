import { useState } from "react";

import type { Cat } from "../types";

type LuckyCatCardProps = {
  cat: Cat;
  unlocked?: boolean;
  size?: "hero" | "mini";
  flippable?: boolean;
};

function CardBow() {
  return (
    <svg className="lucky-card-bow" viewBox="0 0 72 36" aria-hidden="true">
      <path
        d="M36 20c-3.2 0-5.2-2.4-5.2-5.2 0-4.4 5.2-9.6 5.2-9.6s5.2 5.2 5.2 9.6c0 2.8-2 5.2-5.2 5.2Z"
        fill="#f4a0b8"
      />
      <path d="M36 18.5 18 8.5c-2.2 6.4 1.4 12.6 7.8 13.6L36 20Z" fill="#f7b6c8" />
      <path d="M36 18.5 54 8.5c2.2 6.4-1.4 12.6-7.8 13.6L36 20Z" fill="#f7b6c8" />
      <path d="M36 20.5 24 32c4.8 1.2 8.4-1.4 12-6.5 3.6 5.1 7.2 7.7 12 6.5L36 20.5Z" fill="#ef8aaa" />
      <ellipse cx="36" cy="19" rx="6.2" ry="5.4" fill="#f48fb1" />
      <ellipse cx="36" cy="18" rx="3.2" ry="2.6" fill="#ffd0dc" />
    </svg>
  );
}

export function LuckyCatCard({
  cat,
  unlocked = true,
  size = "hero",
  flippable = true,
}: LuckyCatCardProps) {
  const [flipped, setFlipped] = useState(false);
  const canFlip = flippable && unlocked;
  const className = `lucky-card lucky-card-${size} ${flipped ? "is-flipped" : ""} ${unlocked ? "" : "is-locked"}`;
  const label = unlocked
    ? canFlip
      ? flipped
        ? `${cat.name} 카드 앞면 보기`
        : `${cat.name} 카드 뒷면 보기`
      : cat.name
    : "아직 해금되지 않은 카드";

  const face = (
    <div className="lucky-card-inner">
      <div className="lucky-card-face is-front">
        <div className="lucky-card-frame">
          <CardBow />
          <div className="lucky-card-panel">
            <div className="lucky-card-art">
              {unlocked ? <img src={cat.imageUrl} alt="" /> : null}
            </div>
            <div className="lucky-card-ribbon">
              <span>{unlocked ? cat.name : "???"}</span>
            </div>
            <p className="lucky-card-luck">{unlocked ? cat.luckPhrase : ""}</p>
          </div>
        </div>
      </div>
      <div className="lucky-card-face is-back">
        <div className="lucky-card-frame">
          <CardBow />
          <div className="lucky-card-panel is-back-panel">
            <div className="lucky-card-icon">
              {unlocked ? <img src={cat.imageUrl} alt="" /> : null}
            </div>
            <strong className="lucky-card-back-name">{unlocked ? cat.name : "???"}</strong>
            <div className="lucky-card-blurb">
              <p>{unlocked ? cat.description[0] : ""}</p>
              <p>{unlocked ? cat.description[1] : ""}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!canFlip) {
    return (
      <div className={className} aria-label={label}>
        {face}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={() => setFlipped((current) => !current)}
      aria-label={label}
    >
      {face}
    </button>
  );
}
