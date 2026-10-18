import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import { cardArtStyle, watchDecodedImage } from "../lib/cardArt";
import {
  FRAME_LAYOUT,
  boxStyle,
  resolveFrame,
  type FrameSubject,
} from "../lib/cardFrames";
import "./CardFrame.css";

type CardFrameProps = {
  card: FrameSubject;
  /** Catalog id, used to place the transparent cat inside the grade window. */
  artId?: string;
  catSrc: string;
  /** Small stand-in shown blurred until `catSrc` has been decoded. */
  thumbSrc?: string;
  name?: string;
  /** "No.023" — cards.json order, full cards only. */
  dexNo?: string;
  variant?: "full" | "mini";
  className?: string;
};

/** Plate name: card height × start, shrinking to × min so one line fits the plate. */
function useFitPlateName(label: string, active: boolean) {
  const plateRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    if (!active) return;
    const plate = plateRef.current;
    const text = textRef.current;
    const card = plate?.closest(".card-frame");
    if (!plate || !text || !(card instanceof HTMLElement)) return;

    const { startOfCardHeight, minOfCardHeight } = FRAME_LAYOUT.nameFont;
    let cancelled = false;

    const fit = () => {
      if (cancelled) return;
      const cardH = card.clientHeight;
      const plateW = plate.clientWidth;
      if (cardH < 1 || plateW < 1) return;
      const start = cardH * startOfCardHeight;
      const min = cardH * minOfCardHeight;
      text.style.fontSize = `${start}px`;
      const needed = text.scrollWidth;
      if (needed > plateW && needed > 0) {
        text.style.fontSize = `${Math.max(min, start * (plateW / needed))}px`;
      }
    };

    fit();
    const fonts = document.fonts;
    if (fonts) void fonts.ready.then(fit);
    const observer = new ResizeObserver(fit);
    observer.observe(card);
    observer.observe(plate);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [label, active]);

  return { plateRef, textRef };
}

export const CardFrame = forwardRef<HTMLDivElement, CardFrameProps>(function CardFrame(
  { card, artId = "", catSrc, thumbSrc = "", name = "", dexNo = "", variant = "full", className },
  ref,
) {
  const frame = resolveFrame(card);
  const tier = frame.tier;
  const mini = variant === "mini";
  const artStyle = cardArtStyle(artId);
  const artRef = useRef<HTMLImageElement>(null);
  /** loading: blurred thumb + indicator. sharp: full art. thumb: sharp thumbnail fallback. */
  const [artPhase, setArtPhase] = useState<"loading" | "sharp" | "thumb">("loading");
  const showName = Boolean(name);
  const { plateRef, textRef } = useFitPlateName(name, showName);
  const { starsFont, labelFont } = FRAME_LAYOUT;

  useEffect(() => {
    if (mini || !thumbSrc) {
      setArtPhase("sharp");
      return;
    }
    const node = artRef.current;
    if (node?.complete && node.naturalWidth > 0) {
      setArtPhase("sharp");
      return;
    }
    setArtPhase("loading");
    const unwatch = watchDecodedImage(catSrc, (status) => {
      setArtPhase(status === "ok" ? "sharp" : "thumb");
    });
    const timer = window.setTimeout(() => {
      const img = artRef.current;
      if (img?.complete && img.naturalWidth > 0) {
        setArtPhase("sharp");
        return;
      }
      setArtPhase((phase) => (phase === "loading" ? "thumb" : phase));
    }, 3000);
    return () => {
      unwatch();
      window.clearTimeout(timer);
    };
  }, [catSrc, mini, thumbSrc]);

  const showBlur = !mini && Boolean(thumbSrc);
  const sharpReady = !showBlur || artPhase === "sharp";
  const classes = [
    "card-frame",
    sharpReady && showBlur ? "is-sharp-ready" : "",
    showBlur && artPhase === "thumb" ? "is-art-fallback" : "",
    mini ? "is-mini" : "",
    frame.foil ? "foil" : "",
    frame.glit ? "glit" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const starsStyle: CSSProperties = {
    ...boxStyle(tier.stars),
    color: starsFont.color,
    fontSize: `calc(100cqw * ${tier.starCount >= 5 ? starsFont.size5OfCardWidth : starsFont.sizeOfCardWidth})`,
    WebkitTextStroke: `calc(100cqw * 0.004) ${starsFont.stroke}`,
  };

  const labelSize =
    tier.label === "LEGEND" ? labelFont.sizeOfCardWidth : labelFont.sizeMemeCharOfCardWidth;
  const labelStyle: CSSProperties = {
    ...boxStyle(tier.stars),
    color: labelFont.color,
    fontSize: `calc(100cqw * ${labelSize})`,
    WebkitTextStroke: `calc(100cqw * 0.006) ${labelFont.stroke}`,
    filter: `drop-shadow(0 0 calc(100cqw * 0.02) ${labelFont.glow}) drop-shadow(0 1px 2px rgba(0,0,0,.5))`,
  };

  return (
    <div ref={ref} className={classes}>
      <div className="win" style={boxStyle(tier.win)}>
        <img
          className="bg"
          src={frame.windowSrc}
          srcSet={mini ? undefined : frame.windowSrcSet}
          alt=""
          draggable={false}
        />
        {!mini && thumbSrc ? (
          <img className="art is-preview" src={thumbSrc} alt="" draggable={false} style={artStyle} />
        ) : null}
        <img
          ref={artRef}
          className={`art ${showBlur ? (sharpReady ? "is-ready" : "is-pending") : ""}`}
          src={catSrc}
          alt=""
          draggable={false}
          decoding="async"
          style={artStyle}
          onLoad={(event) => {
            const img = event.currentTarget;
            if (img.complete && img.naturalWidth > 0) setArtPhase("sharp");
          }}
          onError={() => {
            if (showBlur) setArtPhase("thumb");
          }}
        />
        {showBlur && artPhase === "loading" ? (
          <span className="art-loading" role="status" aria-label="카드 그림을 불러오는 중" />
        ) : null}
      </div>
      <img
        className="frame"
        src={frame.frameSrc}
        srcSet={mini ? undefined : frame.frameSrcSet}
        alt=""
        draggable={false}
      />
      {showName ? (
        <div ref={plateRef} className="plate" style={{ ...boxStyle(tier.plate), color: frame.nameColor }}>
          <span ref={textRef} className="name-text">
            {name}
          </span>
        </div>
      ) : null}
      {tier.showStars ? (
        <div className="stars" style={starsStyle}>
          {"★".repeat(tier.starCount)}
        </div>
      ) : null}
      {!tier.showStars && tier.label ? (
        <div className="grade-label" style={labelStyle}>
          {tier.label}
        </div>
      ) : null}
      {!mini && dexNo ? (
        <span className="stamp" style={{ ...boxStyle(tier.stamp), color: frame.nameColor }}>
          <span className="stamp-face">{dexNo}</span>
        </span>
      ) : null}
    </div>
  );
});
