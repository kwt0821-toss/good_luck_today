import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import { useBackHandler } from "../hooks/useBackHandler";
import { decodeImage } from "../lib/cardArt";
import { frameAssetUrls, type FrameSubject } from "../lib/cardFrames";
import { CardFrame } from "./CardFrame";
import "./CardSpotlight.css";

export type CardSpotlightCard = {
  src: string;
  thumbSrc?: string;
  artId: string;
  name: string;
  dexNo?: string;
  subject: FrameSubject;
};

type CardSpotlightProps = {
  card: CardSpotlightCard;
  line: string;
  onDone: () => void;
};

const LEAVE_MS = 300;

/** 2s, or 3s when the fortune is longer than 40 characters. */
function spotlightHoldMs(line: string): number {
  const chars = line.replace(/\n/g, "").length;
  return chars > 40 ? 3000 : 2000;
}

/** 18 → 16 → 14 → 13px so a long line stays near three rows, without clipping. */
function spotlightLineClass(line: string): string {
  const parts = line
    .split("\n")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (!parts.length) return "";
  const viewport = typeof window === "undefined" ? 390 : window.innerWidth;
  const inner = Math.max(1, viewport - 48);
  const rowsAt = (fontPx: number) => {
    const perLine = Math.max(1, Math.floor(inner / fontPx));
    return parts.reduce((count, part) => count + Math.max(1, Math.ceil(part.length / perLine)), 0);
  };
  if (rowsAt(18) <= 3) return "";
  if (rowsAt(16) <= 3) return "is-16";
  if (rowsAt(14) <= 3) return "is-14";
  return "is-13";
}

export function CardSpotlight({ card, line, onDone }: CardSpotlightProps) {
  const duration = spotlightHoldMs(line);
  const size = spotlightLineClass(line);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const doneRef = useRef(false);
  const leaveTimer = useRef(0);
  const [leaving, setLeaving] = useState(false);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setLeaving(true);
    leaveTimer.current = window.setTimeout(() => onDoneRef.current(), LEAVE_MS);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(finish, duration);
    return () => {
      window.clearTimeout(id);
      window.clearTimeout(leaveTimer.current);
    };
  }, [duration, finish]);

  useEffect(() => {
    const urls = [card.src, card.thumbSrc ?? "", ...frameAssetUrls(card.subject)].filter(Boolean);
    for (const url of urls) void decodeImage(url).catch(() => {});
  }, [card]);

  useBackHandler(true, finish, 35);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      finish();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [finish]);

  const style = { "--spotlight-ms": `${duration}ms` } as CSSProperties;
  const host = document.body;

  return createPortal(
    <div
      className={`card-spotlight ${leaving ? "is-leaving" : ""}`}
      style={style}
      onClick={finish}
      role="presentation"
    >
      <div className="card-spotlight-stars" aria-hidden="true" />
      <div className="card-spotlight-stage">
        <div className="card-spotlight-card">
          <CardFrame
            card={card.subject}
            artId={card.artId}
            catSrc={card.src}
            thumbSrc={card.thumbSrc}
            name={card.name}
            dexNo={card.dexNo}
          />
        </div>
      </div>
      <div className="card-spotlight-copy">
        <p className="card-spotlight-kicker">🍀 오늘의 한 줄</p>
        {line ? <p className={["card-spotlight-line", size].filter(Boolean).join(" ")}>{line}</p> : null}
        <div className="card-spotlight-bar" aria-hidden="true">
          <i />
        </div>
      </div>
    </div>,
    host,
  );
}
